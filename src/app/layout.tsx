import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Supporters — NPO 후원관리 플랫폼",
  description: "비영리단체를 위한 후원관리 SaaS",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
