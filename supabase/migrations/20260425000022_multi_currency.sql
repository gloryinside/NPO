-- 다중 통화 지원
--   payments.currency + payments.amount_local + amount_krw (회계 단일화).
--   해외 후원자/오버시즈 캠페인 대비.
--   환율은 환율 스냅샷 테이블에서 조회.

alter table payments add column if not exists currency text default 'KRW';
alter table payments add column if not exists amount_local numeric(14,2);  -- 원화 외 금액
alter table payments add column if not exists fx_rate numeric(14,6);       -- 1 unit currency → KRW

-- 캠페인 단위 통화 (모금 페이지에서 표시)
alter table campaigns add column if not exists supported_currencies text[] default array['KRW'];
alter table campaigns add column if not exists primary_currency text default 'KRW';

-- 환율 스냅샷 (외부 API에서 일배치로 갱신)
create table if not exists fx_rates (
  id uuid primary key default gen_random_uuid(),
  rate_date date not null,
  base_currency text not null default 'KRW',
  quote_currency text not null,             -- USD, EUR, JPY, GBP 등
  rate numeric(14,6) not null,              -- 1 quote → N base
  source text default 'manual',
  created_at timestamptz not null default now(),
  unique (rate_date, base_currency, quote_currency)
);

create index if not exists idx_fx_rates_lookup
  on fx_rates (quote_currency, rate_date desc);

-- fx_rates는 모든 org가 공유 (글로벌)
alter table fx_rates enable row level security;
drop policy if exists "fx_rates_authenticated_read" on fx_rates;
create policy "fx_rates_authenticated_read" on fx_rates
  for select using (auth.role() = 'authenticated' or auth.role() = 'service_role');

comment on column payments.currency is
  '결제 통화 (ISO 4217). KRW 기본, 해외 결제 시 USD/EUR/JPY 등.';
comment on column payments.amount is
  '원화 환산 금액 (회계 단일화 기준). 항상 KRW.';
comment on column payments.amount_local is
  '원본 통화 금액 (currency 가 KRW이면 NULL).';
comment on table fx_rates is
  '환율 스냅샷. 일배치로 외부 API에서 가져와 보관, 결제 시점 환율 조회용.';
