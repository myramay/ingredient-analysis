/**
 * GET /api/pubchem?ingredient=<name>
 *
 * Proxies to the PubChem REST API (no key required).
 *
 * Security hardening applied:
 *   • Rate limit:   30 requests / 60 s per IP
 *   • Validation:   length limit + character allowlist on the ingredient param
 *   • No reflection: user input is NOT echoed back in error messages
 *   • Response trim: only the 5 fields we need are forwarded (PubChem's full
 *                    response can be 100 KB+ per compound)
 */

import { NextRequest } from 'next/server';
import {
  checkRateLimit,
  getClientIp,
  rateLimitHeaders,
} from '@/lib/rateLimit';
import { validatePubChemInput, ValidationError } from '@/lib/validation';

// 30 look-ups per minute is generous for a human but stops scripted abuse
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

export async function GET(request: NextRequest) {

  // ── 1. Rate limiting ─────────────────────────────────────────────────────
  const ip = getClientIp(request);
  const rl = checkRateLimit(`pubchem:${ip}`, RATE_LIMIT, RATE_WINDOW_MS);
  const rlHeaders = rateLimitHeaders(rl, RATE_LIMIT);

  if (!rl.allowed) {
    return Response.json(
      { error: `Too many requests. Please wait ${rl.retryAfter} seconds.` },
      { status: 429, headers: rlHeaders }
    );
  }

  // ── 2. Input validation ──────────────────────────────────────────────────
  const rawIngredient = new URL(request.url).searchParams.get('ingredient');
  let ingredient: string;
  try {
    ingredient = validatePubChemInput(rawIngredient);
  } catch (err) {
    if (err instanceof ValidationError) {
      return Response.json(
        { error: err.message },
        { status: 400, headers: rlHeaders }
      );
    }
    throw err;
  }

  // ── 3. Fetch from PubChem ────────────────────────────────────────────────
  // `encodeURIComponent` here is a second line of defense — validatePubChemInput
  // already restricts the character set, but encoding ensures the URL is safe
  // regardless of whatever PubChem's parser might accept.
  const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(ingredient)}/JSON`;

  let res: Response;
  try {
    res = await fetch(url, { next: { revalidate: 86_400 } }); // cache 24 h
  } catch {
    return Response.json(
      { error: 'Unable to reach PubChem. Please try again later.' },
      { status: 502, headers: rlHeaders }
    );
  }

  // PubChem returns 404 for unknown compounds — this is expected, not an error
  if (res.status === 404) {
    // Do NOT reflect the ingredient name back — it has already been validated
    // but we still prefer generic messages to avoid any reflected-content risk.
    return Response.json(
      { error: 'Compound not found in PubChem database.' },
      { status: 404, headers: rlHeaders }
    );
  }

  if (!res.ok) {
    return Response.json(
      { error: `PubChem returned an unexpected error (${res.status}).` },
      { status: 502, headers: rlHeaders }
    );
  }

  const data = await res.json();

  // ── 4. Extract only the fields we need ──────────────────────────────────
  const compound = data?.PC_Compounds?.[0];
  if (!compound) {
    return Response.json(
      { error: 'No compound data in PubChem response.' },
      { status: 404, headers: rlHeaders }
    );
  }

  const cid: number | null = compound.id?.id?.cid ?? null;

  type Prop = { urn: { label: string; name?: string }; value: { sval?: string; fval?: number } };
  const props: Prop[] = compound.props ?? [];

  const getSval = (label: string, name?: string): string | null =>
    props.find((p) => p.urn.label === label && (name ? p.urn.name === name : true))
      ?.value?.sval ?? null;

  return Response.json(
    {
      cid,
      iupacName: getSval('IUPAC Name', 'Preferred'),
      molecularFormula: getSval('Molecular Formula'),
      molecularWeight:
        props.find((p) => p.urn.label === 'Molecular Weight')?.value?.fval ?? null,
      inchiKey: getSval('InChIKey'),
    },
    { headers: rlHeaders }
  );
}
