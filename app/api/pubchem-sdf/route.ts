/**
 * GET /api/pubchem-sdf?cid=<number>
 *
 * Proxies PubChem's 3D SDF file for a given compound CID.
 * The browser cannot fetch PubChem directly (blocked by CSP connect-src);
 * this route fetches server-side and forwards the SDF text.
 *
 * Security:
 *   • CID validated as positive integer (no injection surface)
 *   • Rate limited (20 req / 60 s per IP)
 *   • PubChem response streamed as plain text — no JSON parsing risk
 */

import { NextRequest } from 'next/server';
import { checkRateLimit, getClientIp, rateLimitHeaders } from '@/lib/rateLimit';

const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;

export async function GET(request: NextRequest) {
  // ── 1. Rate limiting ─────────────────────────────────────────────────────
  const ip = getClientIp(request);
  const rl = checkRateLimit(`pubchem-sdf:${ip}`, RATE_LIMIT, RATE_WINDOW_MS);
  const rlHeaders = rateLimitHeaders(rl, RATE_LIMIT);

  if (!rl.allowed) {
    return new Response(
      JSON.stringify({ error: `Too many requests. Please wait ${rl.retryAfter} seconds.` }),
      { status: 429, headers: { ...rlHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // ── 2. Validate CID ──────────────────────────────────────────────────────
  const rawCid = new URL(request.url).searchParams.get('cid');
  if (!rawCid || !/^\d{1,9}$/.test(rawCid)) {
    return new Response(
      JSON.stringify({ error: 'Invalid or missing cid parameter.' }),
      { status: 400, headers: { ...rlHeaders, 'Content-Type': 'application/json' } }
    );
  }
  const cid = parseInt(rawCid, 10);
  if (cid <= 0) {
    return new Response(
      JSON.stringify({ error: 'Invalid cid: must be a positive integer.' }),
      { status: 400, headers: { ...rlHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // ── 3. Fetch 3D SDF from PubChem ─────────────────────────────────────────
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8_000);

  try {
    const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/SDF?record_type=3d`;
    const res = await fetch(url, {
      signal: controller.signal,
      next: { revalidate: 86_400 }, // cache 24 h — 3D structures don't change
    });

    if (res.status === 404) {
      return new Response(
        JSON.stringify({ error: 'No 3D conformer available for this compound.' }),
        { status: 404, headers: { ...rlHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: `PubChem error: ${res.status}` }),
        { status: 502, headers: { ...rlHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sdf = await res.text();
    return new Response(sdf, {
      status: 200,
      headers: {
        ...rlHeaders,
        'Content-Type': 'chemical/x-mdl-sdfile',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    return new Response(
      JSON.stringify({ error: 'Unable to reach PubChem. Please try again.' }),
      { status: 502, headers: { ...rlHeaders, 'Content-Type': 'application/json' } }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
