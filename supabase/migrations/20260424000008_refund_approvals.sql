-- G-D128: 부분·전액 환불 승인 워크플로
--   요청자(requested_by)와 승인자(approved_by)가 다르도록 admin 운영 기준을 두고,
--   요청 → 승인/반려 단계를 거친 뒤에만 실제 Toss 환불 API 호출.
--
-- 흐름:
--   1) admin A: POST /api/admin/payments/{id}/refund  body: { amount, reason }
--      → refund_approvals insert (status='pending', requested_by=A)
--      → payment.pay_status 변화 없음 (원상 유지)
--   2) admin B: POST /api/admin/refund-approvals/{id}/approve
--      → 실제 Toss 환불 호출 → 성공 시 payments 갱신 + status='approved', approved_by=B
--   3) 반려: POST /api/admin/refund-approvals/{id}/reject (reason 필수)
--
-- 단독 환불(B가 동일인)은 같은 user가 승인하지 못하도록 코드에서 가드.

create table if not exists refund_approvals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  payment_id uuid not null references payments(id) on delete cascade,
  requested_by uuid,
  requested_by_email text,
  amount bigint not null check (amount > 0),
  reason text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'executed', 'failed')),
  approved_by uuid,
  approved_by_email text,
  rejected_reason text,
  executed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_refund_approvals_org_status
  on refund_approvals (org_id, status, created_at desc);
create index if not exists idx_refund_approvals_payment
  on refund_approvals (payment_id, created_at desc);

alter table refund_approvals enable row level security;
drop policy if exists refund_approvals_admin_only on refund_approvals;
create policy refund_approvals_admin_only on refund_approvals for select using (false);

comment on table refund_approvals is
  'G-D128 부분/전액 환불 승인 워크플로. approved 상태에서만 실제 Toss 환불 실행';
