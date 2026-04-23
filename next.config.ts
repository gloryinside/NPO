import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Next.js 16이 워크스페이스 루트를 잘못 추론하는 경우 명시적으로 고정.
  // (.worktrees 하위 프로젝트가 같은 파일시스템에 있어 상위 디렉토리로 추론됨)
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
