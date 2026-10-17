-- 자동이체(CMS) 청구: 결과를 기다리는 청구 줄에는 같은 결제가 하나만 있을 수 있다.
-- 두 관리자가 동시에 명단을 만들어도 같은 후원자에게서 두 번 출금되지 않도록 DB에서 막는다.
-- (애플리케이션의 "청구 중 제외" 확인과 저장 사이 경쟁 조건 대비)
create unique index if not exists uq_cms_claim_lines_payment_inflight
  on cms_claim_lines (org_id, payment_id)
  where result_code is null and payment_id is not null;
