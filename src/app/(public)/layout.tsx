import PublicNav from "@/components/public/nav";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{ background: "var(--bg)", color: "var(--text)" }}
      className="min-h-screen"
    >
      <PublicNav />
      {children}
    </div>
  );
}
