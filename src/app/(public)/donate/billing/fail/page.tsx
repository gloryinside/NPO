import Image from "next/image";

/** 정기후원 카드 등록 실패·취소(토스 결제창 failUrl). 약정은 카드 등록 대기(pending_billing)로 남는다. */
type SP = Promise<{ code?: string; message?: string }>;

export default async function BillingFailPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const message = sp.code === "PAY_PROCESS_CANCELED" ? "카드 등록을 취소하셨습니다." : (sp.message ?? "카드 등록에 실패했습니다.");
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-card">
        <Image src="/img/error/500.webp" alt="" width={480} height={320} className="art-adapt mx-auto mb-2 h-40 w-auto" />
        <h1 className="text-xl font-bold text-[var(--text)]">카드 등록을 완료하지 못했습니다</h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">{message}</p>
        {sp.code && <p className="mt-1 font-mono text-xs text-[var(--muted-2)]">{sp.code}</p>}
        <p className="mt-4 text-xs text-[var(--muted-foreground)]">
          후원자 페이지 → 약정에서 언제든 카드를 다시 등록할 수 있습니다.
        </p>
        <a href="/" className="mt-6 inline-flex rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white no-underline shadow-glow">
          다시 시도하기
        </a>
      </div>
    </main>
  );
}
