import type { NextConfig } from "next";
import path from "path";

// Supabase storage host — ENV에서 추출해 remotePatterns 에 등록
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseHost = (() => {
  if (!supabaseUrl) return null;
  try {
    return new URL(supabaseUrl).host;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Next.js 16이 워크스페이스 루트를 잘못 추론하는 경우 명시적으로 고정.
  // (.worktrees 하위 프로젝트가 같은 파일시스템에 있어 상위 디렉토리로 추론됨)
  turbopack: {
    root: path.join(__dirname),
  },
  images: {
    // G-D89: next/image 최적화 대상 호스트
    remotePatterns: [
      ...(supabaseHost
        ? [
            {
              protocol: "https" as const,
              hostname: supabaseHost,
              pathname: "/storage/v1/object/public/**",
            },
          ]
        : []),
      // Toss, 카카오 등 3rd-party 이미지는 필요 시 추가
    ],
  },
};

export default nextConfig;
