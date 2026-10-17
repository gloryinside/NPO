import { Toaster } from "sonner";

// 후원 신청 화면 안내 메시지(브라우저 alert 대신)
export default function DonateLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster position="top-center" richColors />
    </>
  );
}
