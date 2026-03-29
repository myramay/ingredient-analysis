/**
 * POST /api/analyze
 *
 * Security hardening applied:
 *   • Rate limit:   5 requests / 60 s per IP (protects OpenAI spend)
 *   • Validation:   schema check, type check, length limits, unexpected-field
 *                   rejection, HTML/null-byte sanitization before LLM call
 *   • Content-Type: must be application/json
 *   • Error detail: never leak internal errors to the client
 *   • DB writes:    non-blocking; a Supabase failure never breaks the response
 */

import { NextRequest } from 'next/server';
import { analyzeIngredients, lookupIngredientsByProduct } from '@/app/lib/openai';
import { parseIngredientList } from '@/app/lib/ingredientParser';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  checkRateLimit,
  getClientIp,
  rateLimitHeaders,
} from '@/lib/rateLimit';
import {
  validateAnalyzeInput,
  ValidationError,
} from '@/lib/validation';

// ─── Config ───────────────────────────────────────────────────────────────────

// Fail at startup if the OpenAI key is missing rather than on the first request
if (!process.env.OPENAI_API_KEY) {
  throw new Error('Missing env: OPENAI_API_KEY');
}

// Limit: 5 requests per IP per 60 seconds.
// This is intentionally conservative because each request calls OpenAI.
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {

  // ── 1. Content-Type guard ────────────────────────────────────────────────
  // Reject requests that aren't JSON before doing any parsing work.
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return Response.json(
      { error: 'Content-Type must be application/json.' },
      { status: 415 }
    );
  }

  // ── 2. Rate limiting (IP-based) ──────────────────────────────────────────
  const ip = getClientIp(request);
  const rateKey = `analyze:${ip}`;
  const rl = checkRateLimit(rateKey, RATE_LIMIT, RATE_WINDOW_MS);
  const rlHeaders = rateLimitHeaders(rl, RATE_LIMIT);

  if (!rl.allowed) {
    return Response.json(
      {
        error: `Too many requests. Please wait ${rl.retryAfter} seconds before trying again.`,
      },
      { status: 429, headers: rlHeaders }
    );
  }

  // ── 3. Parse JSON body ───────────────────────────────────────────────────
  // Parse failure → 400, not 500.  Avoids leaking a stack trace for malformed
  // payloads (e.g. a client sending text/plain with no body).
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return Response.json(
      { error: 'Invalid JSON body.' },
      { status: 400, headers: rlHeaders }
    );
  }

  // ── 4. Schema validation + sanitization ─────────────────────────────────
  let ingredientList: string | undefined;
  let productName: string | undefined;
  try {
    ({ ingredientList, productName } = validateAnalyzeInput(rawBody));
  } catch (err) {
    if (err instanceof ValidationError) {
      return Response.json(
        { error: err.message, field: err.field },
        { status: 400, headers: rlHeaders }
      );
    }
    throw err; // unexpected — let the outer handler catch it
  }

  // ── 5. Look up ingredient list from OpenAI if user didn't provide one ────
  let resolvedIngredientList: string;
  if (ingredientList) {
    resolvedIngredientList = ingredientList;
  } else {
    // productName is guaranteed to be present by validation when ingredientList is absent
    try {
      resolvedIngredientList = await lookupIngredientsByProduct(productName!);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not find ingredient list for this product.';
      return Response.json({ error: msg }, { status: 422, headers: rlHeaders });
    }
  }

  // ── 6. Parse ingredient list into an array ───────────────────────────────
  const ingredients = parseIngredientList(resolvedIngredientList);

  if (ingredients.length === 0) {
    return Response.json(
      { error: 'Could not parse any ingredients from the provided text.' },
      { status: 400, headers: rlHeaders }
    );
  }
  if (ingredients.length > 60) {
    return Response.json(
      { error: 'Please limit your ingredient list to 60 ingredients at a time.' },
      { status: 400, headers: rlHeaders }
    );
  }

  // ── 7. OpenAI analysis ───────────────────────────────────────────────────
  try {
    const result = await analyzeIngredients(ingredients, productName);

    // ── 7. Persist to Supabase (non-blocking) ──────────────────────────────
    // A DB write failure must never break the user-facing response.
    (async () => {
      try {
        const db = getSupabaseAdmin();
        const { error } = await db.from('products').insert({
          product_name: productName ?? null,
          ingredient_list: resolvedIngredientList,
          result,
          transparency_score: result.transparencyScore.overall,
        });
        if (error) console.error('[analyze] Supabase insert:', error.message);
      } catch (dbErr) {
        console.error('[analyze] Supabase unavailable:', dbErr);
      }
    })();

    return Response.json(result, { headers: rlHeaders });

  } catch (err) {
    // Log full error server-side; return only a generic message to the client
    // to avoid leaking model names, API structure, or stack traces.
    console.error('[analyze] OpenAI error:', err);
    return Response.json(
      { error: 'Analysis failed. Please try again.' },
      { status: 500, headers: rlHeaders }
    );
  }
}
