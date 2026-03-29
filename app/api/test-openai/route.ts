/**
 * GET /api/test-openai
 *
 * Diagnostic endpoint — confirms the OpenAI API key is valid and reachable.
 *
 * SECURITY: Protected by ADMIN_SECRET.
 *   Request must include: Authorization: Bearer <ADMIN_SECRET>
 *   Any request without a valid token receives 401.
 *   Set ADMIN_SECRET in .env.local.  Do not deploy without changing the default.
 *
 * This route should NEVER be accessible without authentication because it
 * consumes real OpenAI credits on every call.
 */

import OpenAI from 'openai';
import { validateAdminSecret } from '@/lib/validation';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {

  // ── Admin secret guard ───────────────────────────────────────────────────
  const authError = validateAdminSecret(request.headers.get('authorization'));
  if (authError) {
    // Return 401 with WWW-Authenticate so the client knows what's expected.
    // We intentionally do NOT distinguish between "wrong secret" and
    // "no secret" — both return 401 to avoid confirming the route exists.
    return Response.json(
      { ok: false, error: authError },
      {
        status: 401,
        headers: { 'WWW-Authenticate': 'Bearer realm="admin"' },
      }
    );
  }

  // ── OpenAI connectivity check ────────────────────────────────────────────
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { ok: false, error: 'OPENAI_API_KEY is not set.' },
      { status: 500 }
    );
  }

  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 30,
      messages: [
        { role: 'user', content: 'Say "ClearSkin AI is connected." and nothing else.' },
      ],
    });

    const message = completion.choices[0]?.message?.content?.trim() ?? '(no response)';
    return Response.json({ ok: true, model: completion.model, message });

  } catch (err) {
    // Return the error message so the operator can diagnose (this route is
    // admin-only so leaking the OpenAI error string is acceptable here).
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
