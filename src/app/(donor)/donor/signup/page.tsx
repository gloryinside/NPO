import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Suspense } from "react";
import { getDonorSession } from "@/lib/auth";
import { DonorSignupForm } from "@/components/donor/signup-form";
import { isDonorAuthBypassEnabled } from "@/lib/auth/donor-bypass";

/**
 * Phase 7-B / G-118: 초대 URL(`/donor/signup?ref=코드`) 공유 시 카톡/페북 미리보기 지원.
 * `ref` 존재 시에만 og:image를 /api/public/invite-og로 가리키고, 없으면 기본 메타.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  const title = "후원 초대";
  const description = "후원 프로그램에 함께해 주세요.";

  if (!ref) {
    return { title, description };
  }

  const hdrs = await headers();
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host");
  if (!host) return { title, description };

  const imageUrl = `${proto}://${host}/api/public/invite-og?ref=${encodeURIComponent(ref)}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website" as const,
      images: [{ url: imageUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image" as const,
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function DonorSignupPage() {
  const session = await getDonorSession();
  if (session) {
    redirect("/donor");
  }

  // 개발용 우회 모드에서는 회원가입 불필요 — bypass 로그인으로 이동
  if (isDonorAuthBypassEnabled()) {
    redirect("/donor/login");
  }

  return (
    <Suspense fallback={null}>
      <DonorSignupForm />
    </Suspense>
  );
}
