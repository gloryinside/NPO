// Integration test setup — load local env so tests can talk to Supabase.
// `.env.local` takes precedence over `.env` (Next.js convention).
import { config as loadEnv } from "dotenv";
import path from "node:path";

loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

// 파일마다 만든 공유 테스트 계정 정리 — helpers/api를 쓰지 않은 파일에선 아무 일도 하지 않는다
import { afterAll } from "vitest";
afterAll(async () => {
  const { cleanupSharedUser } = await import("./helpers/api");
  await cleanupSharedUser();
});
