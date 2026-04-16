// Integration test setup — load local env so tests can talk to Supabase.
// `.env.local` takes precedence over `.env` (Next.js convention).
import { config as loadEnv } from "dotenv";
import path from "node:path";

loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });
