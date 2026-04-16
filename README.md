# NPO 후원관리 시스템

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## 초기 관리자 계정 생성

이 시스템은 Supabase Auth 를 사용하며, **사전에 정해진 기본 관리자 계정이 없습니다**. 처음 배포하거나 로컬 환경을 셋업할 때 아래 방법 중 하나로 관리자 1명을 생성하세요.

### 방법 A — 부트스트랩 스크립트 (권장)

`.env.local` 에 `NEXT_PUBLIC_SUPABASE_URL` 과 `SUPABASE_SERVICE_ROLE_KEY` 가 설정되어 있어야 합니다.

**대화형:**

```bash
npm run create-admin
# 프롬프트에 따라 기관 slug / 이메일 / 비밀번호 입력
```

**비대화형 (CI / 자동화):**

```bash
ADMIN_EMAIL=admin@your-org.kr \
ADMIN_PASSWORD=StrongPass123! \
ADMIN_ORG_SLUG=demo \
npm run create-admin
```

동작:

- 지정한 `org_slug` 로 `orgs` 테이블에서 기관 조회
- 동일 이메일 계정이 있으면 `raw_user_meta_data` 에 `{ role: "admin", org_id: <uuid> }` 만 주입 (기존 비밀번호 유지)
- 없으면 Supabase Admin API (`supabase.auth.admin.createUser`) 로 신규 생성 (`email_confirm: true`)
- 로그인 URL 과 서브도메인 접속 경로 안내

### 방법 B — 로컬 SQL 시드 (로컬 Supabase 전용)

`supabase/migrations/20260416000008_seed_admin.sql` 마이그레이션이 `demo` 기관에 기본 관리자를 자동 생성합니다.

- 이메일: `admin@demo.example`
- 비밀번호: `admin1234!`
- 기관: `demo`

```bash
supabase db reset   # 로컬 Supabase CLI 가 모든 마이그레이션을 재실행
```

⚠️ **프로덕션에서는 방법 A 를 쓰세요.** SQL 시드는 `auth.users` 에 직접 INSERT 하며, 프로덕션 Supabase Cloud 에서는 권한 제약으로 조용히 스킵되도록 설계되어 있습니다 (`EXCEPTION WHEN OTHERS` 블록).

### 방법 C — Supabase Dashboard (수동)

1. Supabase Dashboard → Authentication → Users → `Add user`
2. 이메일·비밀번호 입력하여 계정 생성
3. 생성된 사용자 열어서 **User Metadata** 에 JSON 추가:

   ```json
   { "role": "admin", "org_id": "<orgs 테이블의 UUID>" }
   ```

4. `orgs` 테이블의 UUID 는 SQL Editor 에서 `SELECT id, slug, name FROM orgs;` 로 확인

### 관리자 로그인 후 추가 관리자 초대

첫 관리자가 로그인하면 `/admin/users` 페이지에서 **관리자 초대** 버튼으로 다른 관리자를 이메일로 초대할 수 있습니다. 초대 메일 링크 클릭 시 자동으로 `role: "admin"` 과 `org_id` 가 부여됩니다.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
