-- G-D98: 마케팅·뉴스레터 수신 동의 컬럼
--   - marketing_consent: true/false
--   - marketing_consent_at: 최근 동의(또는 철회) 시각 — 감사용
--
-- 기부 wizard Step2에서 별도 선택 체크박스로 수집하고, 설정 페이지에서 언제든
-- 철회할 수 있다. 철회 시 false 기록 + at 갱신.

alter table members
  add column if not exists marketing_consent boolean default false,
  add column if not exists marketing_consent_at timestamptz;

comment on column members.marketing_consent is
  'G-D98 마케팅·뉴스레터 수신 동의 (true/false)';
comment on column members.marketing_consent_at is
  'G-D98 최근 동의·철회 시각 (감사용)';
