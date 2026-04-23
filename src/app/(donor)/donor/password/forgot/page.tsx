import { ForgotPasswordForm } from "@/components/donor/auth/ForgotPasswordForm";

export const metadata = { title: "비밀번호 찾기" };

export default function DonorForgotPasswordPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-lg">
        <h1 className="mb-2 text-center text-2xl font-semibold text-[var(--text)]">
          비밀번호 찾기
        </h1>
        <p className="mb-6 text-center text-sm text-[var(--muted-foreground)]">
          가입하신 이메일로 재설정 링크를 보내드립니다.
        </p>
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
