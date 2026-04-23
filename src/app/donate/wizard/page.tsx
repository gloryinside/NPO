import { notFound } from 'next/navigation';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getDonorSession } from '@/lib/auth';
import { WizardClient } from './WizardClient';
import { FormSettingsSchema, defaultFormSettings } from '@/lib/campaign-builder/form-settings/schema';

export default async function WizardPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string; type?: string; amount?: string; designation?: string; completed?: string }>;
}) {
  const sp = await searchParams;
  if (!sp.campaign) notFound();

  const sb = createSupabaseAdminClient();
  const { data: c } = await sb
    .from('campaigns')
    .select('id, slug, title, status, ended_at, form_settings, org_id')
    .eq('slug', sp.campaign)
    .single();

  if (!c || c.status !== 'active') notFound();

  // G-D87: 종료된 캠페인은 form 제출 자체를 차단하고 다른 캠페인 안내
  if (c.ended_at && new Date(c.ended_at as string) < new Date()) {
    const endedDate = new Date(c.ended_at as string).toLocaleDateString("ko-KR");
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <div
          className="rounded-2xl border p-8 text-center"
          style={{
            borderColor: "var(--border)",
            background: "var(--surface)",
          }}
        >
          <p className="text-5xl mb-3">🏁</p>
          <h1
            className="text-xl font-bold"
            style={{ color: "var(--text)" }}
          >
            이 캠페인은 종료되었습니다
          </h1>
          <p
            className="mt-2 text-sm"
            style={{ color: "var(--muted-foreground)" }}
          >
            <b style={{ color: "var(--text)" }}>{c.title}</b> 은(는) {endedDate}에
            종료되어 새로운 후원을 받을 수 없습니다.
          </p>
          <p
            className="mt-1 text-xs"
            style={{ color: "var(--muted-foreground)" }}
          >
            진행 중인 다른 캠페인을 둘러보세요.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <a
              href="/"
              className="inline-block rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
              style={{
                background: "var(--accent)",
                textDecoration: "none",
              }}
            >
              캠페인 둘러보기 →
            </a>
            <a
              href={`/campaigns/${c.slug}`}
              className="inline-block rounded-xl border px-5 py-2.5 text-sm font-medium"
              style={{
                borderColor: "var(--border)",
                background: "var(--surface-2)",
                color: "var(--text)",
                textDecoration: "none",
              }}
            >
              이 캠페인 결과 보기
            </a>
          </div>
        </div>
      </main>
    );
  }

  const settings = FormSettingsSchema.parse({
    ...defaultFormSettings(),
    ...(c.form_settings ?? {}),
  });

  const donorSession = await getDonorSession();

  return (
    <WizardClient
      campaign={{ id: c.id, slug: c.slug, title: c.title, orgId: c.org_id }}
      settings={settings}
      isLoggedIn={!!donorSession}
      prefill={{
        type: sp.type,
        amount: sp.amount ? Number(sp.amount) : undefined,
        designation: sp.designation,
        completed: sp.completed === '1',
      }}
    />
  );
}
