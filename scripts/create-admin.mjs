#!/usr/bin/env node
/**
 * 초기 관리자 계정 부트스트랩 스크립트.
 *
 * Supabase Admin API 를 통해 안전하게 auth.users 에 계정을 생성하고,
 * raw_user_meta_data 에 { role: "admin", org_id: <uuid> } 를 주입한다.
 *
 * 사용:
 *   ENV: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필수
 *
 *   대화형 (권장):
 *     node scripts/create-admin.mjs
 *
 *   비대화형 (CI/자동화):
 *     ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=StrongPass123! \
 *     ADMIN_ORG_SLUG=demo node scripts/create-admin.mjs
 *
 * 동작:
 *   1. org_slug 로 orgs 테이블에서 기관 조회 (없으면 에러)
 *   2. 동일 이메일 계정이 이미 있으면:
 *      - metadata 에 role/org_id 만 주입 (기존 비밀번호 유지)
 *   3. 없으면:
 *      - createUser 로 신규 생성 (email_confirm: true)
 *      - metadata 주입
 *   4. 결과 출력 (성공/실패 + 다음 단계 안내)
 *
 * 중요: 이 스크립트는 service_role key 를 사용하므로 프로덕션에서도
 *      서버 환경변수로만 실행하고, 절대 commit 하지 말 것.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { resolve } from "node:path";

// ─── 환경변수 로드 ────────────────────────────────────────────────────────
// Next.js 는 자동으로 .env.local 을 로드하지만, 이 스크립트는 단독 실행이므로
// 수동으로 파싱한다 (dotenv 의존성 추가 회피).
function loadEnvFile(path) {
  try {
    const text = readFileSync(path, "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!m) continue;
      const [, key, raw] = m;
      if (process.env[key]) continue; // 기존 값 존중
      // 양쪽 따옴표 제거
      process.env[key] = raw.replace(/^["']|["']$/g, "");
    }
  } catch {
    /* 파일 없으면 무시 */
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"));
loadEnvFile(resolve(process.cwd(), ".env"));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "❌ NEXT_PUBLIC_SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다.\n" +
      "   .env.local 에 설정하거나 직접 export 해 주세요."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ─── 입력 받기 ────────────────────────────────────────────────────────────
async function prompt(question, { silent = false, defaultValue } = {}) {
  if (process.env[`ADMIN_${question.key}`]) {
    return process.env[`ADMIN_${question.key}`];
  }
  const rl = createInterface({ input: stdin, output: stdout, terminal: true });
  try {
    const suffix = defaultValue ? ` (기본값: ${defaultValue})` : "";
    const prefix = silent ? "*** " : "";
    const answer = await rl.question(`${prefix}${question.prompt}${suffix}: `);
    return answer.trim() || defaultValue || "";
  } finally {
    rl.close();
  }
}

// ─── 메인 플로우 ──────────────────────────────────────────────────────────
async function main() {
  console.log("🔐 NPO 후원관리 시스템 — 초기 관리자 생성\n");

  // 1. org 선택
  const orgSlug = await prompt(
    { key: "ORG_SLUG", prompt: "기관 slug" },
    { defaultValue: "demo" }
  );

  const { data: org, error: orgErr } = await supabase
    .from("orgs")
    .select("id, slug, name")
    .eq("slug", orgSlug)
    .maybeSingle();

  if (orgErr) {
    console.error(`❌ orgs 조회 실패: ${orgErr.message}`);
    process.exit(1);
  }
  if (!org) {
    console.error(
      `❌ slug='${orgSlug}' 인 기관을 찾을 수 없습니다.\n` +
        `   마이그레이션을 먼저 적용하거나 orgs 에 행을 추가해 주세요.\n` +
        `   (시드 마이그레이션은 'demo', 'hope' 기관을 생성합니다)`
    );
    process.exit(1);
  }
  console.log(`✓ 기관 확인: ${org.name} (${org.slug})`);

  // 2. 이메일/비밀번호
  const email = await prompt({ key: "EMAIL", prompt: "관리자 이메일" });
  if (!email || !email.includes("@")) {
    console.error("❌ 유효한 이메일을 입력해 주세요.");
    process.exit(1);
  }

  const password = await prompt(
    { key: "PASSWORD", prompt: "비밀번호 (최소 8자)" },
    { silent: true }
  );
  if (!password || password.length < 8) {
    console.error("❌ 비밀번호는 최소 8자 이상이어야 합니다.");
    process.exit(1);
  }

  // 3. 기존 계정 확인
  const { data: existing } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const existingUser = existing?.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );

  const metadata = {
    role: "admin",
    org_id: org.id,
  };

  if (existingUser) {
    console.log(`ℹ️  이미 존재하는 계정입니다 (${existingUser.id}). metadata 만 갱신합니다.`);
    const { error } = await supabase.auth.admin.updateUserById(existingUser.id, {
      user_metadata: {
        ...existingUser.user_metadata,
        ...metadata,
      },
      // 비밀번호도 갱신하고 싶다면 아래 주석 해제
      // password,
    });
    if (error) {
      console.error(`❌ 계정 갱신 실패: ${error.message}`);
      process.exit(1);
    }
    console.log(`✓ 기존 계정을 '${org.name}' 기관 관리자로 승격했습니다.`);
  } else {
    const { data: created, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // 개발 환경 편의 — 이메일 검증 생략
      user_metadata: metadata,
    });
    if (error) {
      console.error(`❌ 계정 생성 실패: ${error.message}`);
      process.exit(1);
    }
    console.log(`✓ 관리자 계정 생성 완료 (${created.user.id})`);
  }

  // 4. 다음 단계 안내
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  console.log("\n✅ 완료. 다음 링크에서 로그인하세요:\n");
  console.log(`   ${origin}/admin/login`);
  console.log(`   📧 ${email}`);
  console.log(
    `\n   서브도메인 라우팅이 설정된 환경에서는 '${org.slug}' 서브도메인으로 접속해야 합니다.`
  );
  console.log(
    `   로컬 개발: http://${org.slug}.localhost:3000/admin/login\n`
  );
}

main().catch((err) => {
  console.error("❌ 예상치 못한 오류:", err);
  process.exit(1);
});
