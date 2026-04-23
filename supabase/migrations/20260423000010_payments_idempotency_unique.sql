-- G-D76: 결제 idempotency/중복 처리 방지
--   - 같은 org 에서 동일 toss_payment_key 가 2개 row 로 확장되는 것 차단
--   - idempotency_key(사전 생성) 도 동일 보호
--   - 부분 인덱스(WHERE NOT NULL) 로 미결제/취소 등 NULL 공존 허용
--
-- 위반 시 INSERT 가 실패 — 웹훅 호출 측은 23505 코드 감지 시 "이미 처리됨"으로 취급할 것.

create unique index if not exists uq_payments_toss_payment_key_org
  on payments (org_id, toss_payment_key)
  where toss_payment_key is not null;

create unique index if not exists uq_payments_idempotency_key_org
  on payments (org_id, idempotency_key)
  where idempotency_key is not null;
