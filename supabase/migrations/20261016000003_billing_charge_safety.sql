-- 정기후원 자동결제 안전장치 (토스 자동결제 규격 대비 보완)
--
-- charging_started_at: 결제 행 선점(claim). 월 청구·자동 재시도·수동 재시도가 동시에 돌아도
--   조건부 UPDATE로 먼저 잡은 한 곳만 토스를 호출한다(이중 결제 방지). 15분 지나면 만료로 보고 다시 잡을 수 있다.
-- toss_order_id: 토스에 보낸 주문번호(시도별). 정산·대사 때 토스 결제내역과 맞추는 키.

alter table payments add column if not exists charging_started_at timestamptz;
alter table payments add column if not exists toss_order_id text;

create index if not exists idx_payments_toss_order
  on payments (org_id, toss_order_id) where toss_order_id is not null;

comment on column payments.charging_started_at is '자동결제 호출 중 선점 시각(이중 결제 방지). 끝나면 null';
comment on column payments.toss_order_id is '토스에 보낸 orderId(시도별, 대사용)';

-- 웹훅 중복 수신 방지 — 토스는 실패 시 최대 7회 재전송한다(tosspayments-webhook-transmission-id 고유).
alter table webhook_events add column if not exists transmission_id text;
create unique index if not exists uq_webhook_events_transmission
  on webhook_events (provider, transmission_id) where transmission_id is not null;

-- 카드 분쟁 중복 기록 방지
create unique index if not exists uq_chargebacks_case
  on chargebacks (org_id, toss_case_id) where toss_case_id is not null;
