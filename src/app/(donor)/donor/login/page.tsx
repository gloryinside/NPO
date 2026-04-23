import { redirect } from "next/navigation";
import { getDonorSession } from "@/lib/auth";
import { DonorLoginForm } from "@/components/donor/login-form";
import { isDonorAuthBypassEnabled } from "@/lib/auth/donor-bypass";

export default async function DonorLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; deleted?: string }>;
}) {
  const session = await getDonorSession();
  if (session) {
    redirect("/donor");
  }

  const sp = await searchParams;
  const bypass = isDonorAuthBypassEnabled();

  const notice =
    sp.reason === "expired"
      ? {
          kind: "warning" as const,
          title: "세션이 만료되었습니다",
          body: "30분 이상 활동이 없어 자동 로그아웃되었습니다. 다시 로그인해주세요.",
        }
      : sp.deleted === "1"
        ? {
            kind: "info" as const,
            title: "계정이 삭제되었습니다",
            body: "그동안의 후원에 감사드립니다. 필요 시 새로 가입해주세요.",
          }
        : null;

  return (
    <>
      {notice && (
        <div
          role="alert"
          className="mx-auto mb-4 max-w-sm rounded-xl px-4 py-3 text-sm"
          style={{
            background:
              notice.kind === "warning"
                ? "var(--warning-soft)"
                : "var(--accent-soft)",
            color:
              notice.kind === "warning" ? "var(--warning)" : "var(--accent)",
            border: `1px solid ${
              notice.kind === "warning" ? "var(--warning)" : "var(--accent)"
            }`,
          }}
        >
          <p className="font-semibold">{notice.title}</p>
          <p className="mt-0.5 text-xs">{notice.body}</p>
        </div>
      )}
      <DonorLoginForm bypass={bypass} />
    </>
  );
}
