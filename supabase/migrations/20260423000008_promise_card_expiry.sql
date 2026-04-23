-- G-D50: 정기결제 카드 만료일 저장용 컬럼
--   Toss 빌링키 발급 응답에 cardExpirationYear/Month 포함 → 저장해 사전 알림에 사용.
--   기존 row 는 NULL 허용 — 다음 결제 시도·카드 교체 시 백필.

alter table promises
  add column if not exists card_expiry_year integer check (card_expiry_year is null or (card_expiry_year between 2000 and 2100)),
  add column if not exists card_expiry_month integer check (card_expiry_month is null or (card_expiry_month between 1 and 12));

-- 만료 임박 조회용 부분 인덱스 (월 1일 기준)
create index if not exists idx_promises_card_expiry_active
  on promises (card_expiry_year, card_expiry_month)
  where status in ('active', 'suspended') and toss_billing_key is not null;

comment on column promises.card_expiry_year is 'G-D50 카드 만료 연도. 만료 임박(<=30일) 시 donor 알림';
comment on column promises.card_expiry_month is 'G-D50 카드 만료 월 (1-12)';
