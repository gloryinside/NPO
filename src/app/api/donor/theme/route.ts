import { NextResponse } from 'next/server';
import { getDonorSession } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { rateLimit } from '@/lib/rate-limit';
import { parseThemePreference, serializeThemeCookie } from '@/lib/theme/preference';
import { checkCsrf } from '@/lib/security/csrf';

export async function POST(req: Request): Promise<Response> {
  const csrf = checkCsrf(req);
  if (csrf) return csrf;
  const session = await getDonorSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = rateLimit(`theme:${session.member.id}`, 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfterMs: rl.retryAfterMs },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const preference = parseThemePreference(
    typeof body === 'object' && body !== null && 'preference' in body
      ? String((body as { preference: unknown }).preference)
      : undefined,
  );
  if (!preference) {
    return NextResponse.json({ error: 'Invalid preference' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('members')
    .update({ theme_preference: preference })
    .eq('id', session.member.id);
  if (error) {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  const cookie = serializeThemeCookie(preference, {
    isProduction: process.env.NODE_ENV === 'production',
  });
  return new NextResponse(null, {
    status: 204,
    headers: { 'Set-Cookie': cookie },
  });
}
