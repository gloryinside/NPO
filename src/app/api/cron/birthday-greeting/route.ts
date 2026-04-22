import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { notifyBirthdayGreeting } from '@/lib/notifications/send';
import { resolveBirthdayMatches, extractMonthDay } from '@/lib/notifications/birthday';

/**
 * 매일 00:15 KST 실행. 오늘(KST) 생일인 활성 후원자에게 축하 메시지 발송.
 * notification_prefs.birthday === false 인 회원은 스킵.
 * 전화번호 없으면 skip (알림톡/SMS 기반).
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const header = req.headers.get('x-cron-secret') ?? '';
    if (header !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'CRON_SECRET required' }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const matches = resolveBirthdayMatches(new Date());

  // MM-DD 패턴별 OR LIKE 조건
  const orConds = matches.map((mmdd) => `birth_date.like.%-${mmdd}`).join(',');

  const { data: members, error } = await supabase
    .from('members')
    .select('id, org_id, name, phone, birth_date, notification_prefs, orgs!inner(name)')
    .eq('status', 'active')
    .not('birth_date', 'is', null)
    .or(orConds);

  if (error) {
    console.error('[cron/birthday-greeting] 조회 실패', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;
  let skipped = 0;

  for (const row of members ?? []) {
    const m = row as unknown as {
      id: string;
      org_id: string;
      name: string;
      phone: string | null;
      birth_date: string;
      notification_prefs: Record<string, unknown> | null;
      orgs: { name: string };
    };

    // client-side 재확인 (.like는 다른 패턴도 매칭할 수 있으므로)
    const mmdd = extractMonthDay(m.birth_date);
    if (!mmdd || !matches.includes(mmdd)) {
      skipped++;
      continue;
    }

    // opt-out 체크 (키 없으면 opt-in 간주)
    if (m.notification_prefs && m.notification_prefs.birthday === false) {
      skipped++;
      continue;
    }

    // 전화 없으면 스킵 (알림톡/SMS 기반 시나리오)
    if (!m.phone) {
      skipped++;
      continue;
    }

    notifyBirthdayGreeting({
      orgId: m.org_id,
      phone: m.phone,
      name: m.name,
      orgName: m.orgs?.name ?? '',
    });
    sent++;
  }

  console.log(`[cron/birthday-greeting] matches=${matches.join(',')} sent=${sent} skipped=${skipped}`);
  return NextResponse.json({ matches, sent, skipped });
}
