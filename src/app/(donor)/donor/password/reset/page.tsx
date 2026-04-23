import { ResetPasswordForm } from "@/components/donor/auth/ResetPasswordForm";

export const metadata = { title: "비밀번호 재설정" };

export default function DonorResetPasswordPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-lg">
        <h1 className="mb-2 text-center text-2xl font-semibold text-[var(--text)]">
          비밀번호 재설정
        </h1>
        <p className="mb-6 text-center text-sm text-[var(--muted-foreground)]">
          새 비밀번호를 입력하세요.
        </p>
        <ResetPasswordForm />
      </div>
    </div>
  );
}
