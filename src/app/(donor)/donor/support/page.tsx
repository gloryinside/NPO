import Link from "next/link";
import { getDonorSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata = { title: "고객지원" };

export default async function DonorSupportPage() {
  const session = await getDonorSession();
  if (!session) redirect("/donor/login");

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">고객지원</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          문의하기, 공지사항, FAQ를 확인하세요.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link
          href="/donor/support/inquiries"
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 no-underline hover:bg-[var(--surface-2)] transition-colors"
        >
          <div className="text-2xl mb-2">💬</div>
          <div className="font-semibold text-[var(--text)]">내 문의</div>
          <div className="mt-1 text-xs text-[var(--muted-foreground)]">
            문의 내역 확인 및 새 문의 작성
          </div>
        </Link>

        <Link
          href="/donor/support/notice"
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 no-underline hover:bg-[var(--surface-2)] transition-colors"
        >
          <div className="text-2xl mb-2">📢</div>
          <div className="font-semibold text-[var(--text)]">공지사항</div>
          <div className="mt-1 text-xs text-[var(--muted-foreground)]">
            중요 안내 및 서비스 업데이트
          </div>
        </Link>

        <Link
          href="/donor/support/faq"
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 no-underline hover:bg-[var(--surface-2)] transition-colors"
        >
          <div className="text-2xl mb-2">❓</div>
          <div className="font-semibold text-[var(--text)]">FAQ</div>
          <div className="mt-1 text-xs text-[var(--muted-foreground)]">
            자주 묻는 질문과 답변
          </div>
        </Link>
      </div>
    </div>
  );
}
