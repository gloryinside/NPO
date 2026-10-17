import Image from "next/image";

// 앱 전역 404 — 후원자 포털 밖(공개·관리자 경로)에서 쓰인다.
export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4">
      <div className="animate-rise w-full max-w-md text-center">
        <Image
          src="/img/error/404.webp"
          alt=""
          width={480}
          height={320}
          priority
          className="art-adapt mx-auto h-64 w-auto"
        />
        <p className="eyebrow mt-6">404 · Not Found</p>
        <h1 className="mt-2 text-[1.625rem] font-bold tracking-[-0.025em] text-[var(--text)]">
          페이지를 찾을 수 없습니다
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">
          주소가 잘못되었거나 페이지가 이동했을 수 있습니다.
        </p>
        <a
          href="/"
          className="mt-6 inline-flex items-center rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white no-underline shadow-glow transition-colors hover:bg-[var(--accent-hover)]"
        >
          처음으로
        </a>
      </div>
    </main>
  );
}
