/**
 * Creates a Supabase client that authenticates via the Authorization: Bearer
 * header on the incoming request. Used by campaign-builder API routes so they
 * work both in production (where the JS client passes a session token) and in
 * integration tests (which call route handlers directly with a Bearer token).
 */
import { createClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';

export function createRequestClient(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );

  return client;
}
