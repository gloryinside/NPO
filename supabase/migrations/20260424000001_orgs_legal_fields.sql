-- G-D97: 기관별 법적 문서/연락처 컬럼 추가
--   - privacy_policy_markdown: 개인정보처리방침 (markdown). NULL 이면 기본 템플릿 노출
--   - terms_markdown: 이용약관
--   - contact_email/phone/address: 연락처 (풋터·문의 페이지에 사용)

alter table orgs
  add column if not exists privacy_policy_markdown text,
  add column if not exists terms_markdown text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists contact_address text;

comment on column orgs.privacy_policy_markdown is
  'G-D97 개인정보처리방침 (markdown). NULL이면 기본 템플릿(src/app/(public)/privacy/page.tsx)';
comment on column orgs.terms_markdown is
  'G-D97 이용약관 (markdown). NULL이면 기본 템플릿';
