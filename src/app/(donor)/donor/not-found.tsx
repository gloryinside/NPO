export default function DonorNotFound() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div
        className="w-full max-w-md rounded-2xl border p-8 text-center"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <p className="text-5xl mb-4">🔍</p>
        <h2 className="text-lg font-semibold" style={{ color: "var(--text)" }}>
          페이지를 찾을 수 없습니다
        </h2>
        <p
          className="mt-2 text-sm"
          style={{ color: "var(--muted-foreground)" }}
        >
          요청하신 주소가 잘못되었거나 페이지가 이동했을 수 있습니다.
        </p>
        <a
          href="/donor"
          className="mt-6 inline-block rounded-lg px-4 py-2 text-sm font-semibold text-white"
          style={{ background: "var(--accent)", textDecoration: "none" }}
        >
          마이페이지로
        </a>
      </div>
    </div>
  );
}
