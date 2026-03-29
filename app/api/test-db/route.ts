/**
 * GET /api/test-db
 *
 * Diagnostic endpoint — confirms Supabase connectivity and the `products`
 * table schema.  Inserts a test row and immediately deletes it.
 *
 * SECURITY: Protected by ADMIN_SECRET (same as /api/test-openai).
 *   Request must include: Authorization: Bearer <ADMIN_SECRET>
 *
 * Required Supabase table — run once in the SQL editor:
 *
 *   create table if not exists products (
 *     id                 uuid primary key default gen_random_uuid(),
 *     product_name       text,
 *     ingredient_list    text        not null,
 *     result             jsonb       not null,
 *     transparency_score int         not null,
 *     created_at         timestamptz default now()
 *   );
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import { validateAdminSecret } from '@/lib/validation';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {

  // ── Admin secret guard ───────────────────────────────────────────────────
  const authError = validateAdminSecret(request.headers.get('authorization'));
  if (authError) {
    return Response.json(
      { ok: false, error: authError },
      {
        status: 401,
        headers: { 'WWW-Authenticate': 'Bearer realm="admin"' },
      }
    );
  }

  // ── Env check ────────────────────────────────────────────────────────────
  const missing = [
    !process.env.NEXT_PUBLIC_SUPABASE_URL    && 'NEXT_PUBLIC_SUPABASE_URL',
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    !process.env.SUPABASE_SERVICE_ROLE_KEY   && 'SUPABASE_SERVICE_ROLE_KEY',
  ].filter(Boolean);

  if (missing.length > 0) {
    return Response.json(
      { ok: false, error: `Missing env vars: ${missing.join(', ')}` },
      { status: 500 }
    );
  }

  // ── Insert + immediate delete ────────────────────────────────────────────
  try {
    const db = getSupabaseAdmin();

    const { data, error: insertError } = await db
      .from('products')
      .insert({
        product_name: '[TEST] Connection check',
        ingredient_list: 'Water, Glycerin',
        result: { test: true },
        transparency_score: 0,
      })
      .select()
      .single();

    if (insertError) {
      return Response.json(
        {
          ok: false,
          error: insertError.message,
          hint: 'Make sure the `products` table exists. See the SQL at the top of this file.',
        },
        { status: 500 }
      );
    }

    // Clean up immediately — never leave test data in the table
    await db.from('products').delete().eq('id', data.id);

    return Response.json({
      ok: true,
      message: 'Supabase connected. Test row inserted and deleted successfully.',
      row: data,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
