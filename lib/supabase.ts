/**
 * lib/supabase.ts — SERVER-SIDE ONLY
 *
 * `import 'server-only'` causes a hard build error if this module is ever
 * imported from a Client Component, preventing the service role key from
 * being bundled into the browser.
 *
 * OWASP A02:2021 Cryptographic Failures — never expose the service role key
 * client-side.  The anon key (NEXT_PUBLIC_) is intentionally public and is
 * protected by Supabase Row Level Security policies.
 */
import 'server-only';

import { createClient } from '@supabase/supabase-js';

// ─── Env validation ───────────────────────────────────────────────────────────
// Fail at module-load time so misconfiguration is caught on first request
// rather than silently failing deep inside an API handler.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_URL');
if (!supabaseAnonKey) throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_ANON_KEY');

// ─── Anon client ──────────────────────────────────────────────────────────────

/**
 * Standard Supabase client using the anon key.
 * Respects Row Level Security — use this for user-scoped reads.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ─── Admin client ─────────────────────────────────────────────────────────────

/**
 * Admin client using the service role key — bypasses RLS.
 *
 * SECURITY: Only call this from API route handlers (server-side).
 * Never import this module in any file that might be bundled for the browser.
 * The `import 'server-only'` at the top of this file enforces that at build time.
 */
export function getSupabaseAdmin() {
  if (!supabaseServiceKey) {
    throw new Error('Missing env: SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(supabaseUrl!, supabaseServiceKey, {
    auth: {
      // Disable auto session management — this is a server-to-server client
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
