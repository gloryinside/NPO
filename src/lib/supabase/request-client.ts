/**
 * Creates a Supabase client for API route handlers.
 *
 * Authentication order:
 *   1. Authorization: Bearer header (integration tests, programmatic access)
 *   2. Supabase auth cookies (browser fetch from Editor / admin UI)
 */
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import type { NextRequest } from 'next/server';

export function createRequestClient(req: NextRequest) {
  // 1. Try Bearer token first (tests, programmatic)
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (token) {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
  }

  // 2. Fallback to cookie-based auth (browser fetch)
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll() {
          // Route handlers can't set cookies on the incoming request — no-op.
        },
      },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
