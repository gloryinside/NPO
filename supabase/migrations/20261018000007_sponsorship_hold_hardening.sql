-- 결연 아동 선택 보강(보안 검토)
--  1) 결연 만들기가 실패해도 결제 완료·약정 시작은 막지 않는다 — 트리거 안 오류는 경고로만 남긴다
--  2) 잠근 뒤 결연 존재를 다시 확인 — 약정 시작·결제 완료 트리거가 동시에 돌 때 거짓 '충돌' 알림 방지
--  3) 약정이 취소·종료되면 잡아 둔 아이를 바로 놓아준다
--  4) 회비 납부 이중 기록 방지 — 같은 회원·같은 기간 시작일은 한 건

create or replace function start_requested_sponsorship(p_promise uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  p record;
  b record;
begin
  select id, org_id, member_id, amount, beneficiary_id, status into p from promises where id = p_promise;
  if p.beneficiary_id is null then return; end if;
  if p.status <> 'active' and not exists (
       select 1 from payments where promise_id = p.id and pay_status = 'paid') then
    return;
  end if;
  if exists (select 1 from sponsorships where promise_id = p.id) then return; end if;

  select id, name, status, reserved_promise_id, reserved_until into b
    from beneficiaries where id = p.beneficiary_id and org_id = p.org_id for update;
  if b.id is null then return; end if;
  -- 잠금을 기다리는 사이 다른 트리거가 이미 만들었을 수 있다
  if exists (select 1 from sponsorships where promise_id = p.id) then return; end if;

  if b.status <> 'available'
     or (b.reserved_promise_id is distinct from p.id and b.reserved_until is not null and b.reserved_until >= now()) then
    insert into admin_notifications (org_id, kind, title, body, link)
    values (p.org_id, 'sponsorship_conflict', '결연 신청을 이어 주지 못했어요',
            b.name || ' 아이는 이미 다른 후원자와 결연 중이거나 신청이 진행 중입니다. 후원자에게 다른 아이를 안내해 주세요.',
            '/admin/sponsorships');
    return;
  end if;

  insert into sponsorships (org_id, sponsor_member_id, beneficiary_id, promise_id, start_date, monthly_amount, status)
  values (p.org_id, p.member_id, b.id, p.id, (now() at time zone 'Asia/Seoul')::date, p.amount, 'active')
  on conflict (sponsor_member_id, beneficiary_id, start_date) do nothing;

  update beneficiaries
     set status = 'sponsored', reserved_promise_id = null, reserved_until = null, updated_at = now()
   where id = b.id;
end;
$$;
revoke all on function start_requested_sponsorship(uuid) from public, anon, authenticated;

create or replace function trg_promise_start_sponsorship() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.beneficiary_id is not null and new.status = 'active'
     and (tg_op = 'INSERT' or old.status is distinct from 'active' or old.beneficiary_id is distinct from new.beneficiary_id) then
    begin
      perform start_requested_sponsorship(new.id);
    exception when others then
      raise warning 'start_requested_sponsorship(%) failed: %', new.id, sqlerrm;
    end;
  end if;
  -- 취소·종료된 약정이 잡아 둔 아이는 놓아준다
  if tg_op = 'UPDATE' and new.status in ('cancelled', 'completed') and old.status is distinct from new.status then
    update beneficiaries set reserved_promise_id = null, reserved_until = null, updated_at = now()
     where reserved_promise_id = new.id;
  end if;
  return new;
end;
$$;

create or replace function trg_payment_start_sponsorship() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.promise_id is not null and new.pay_status = 'paid'
     and (tg_op = 'INSERT' or old.pay_status is distinct from 'paid') then
    begin
      perform start_requested_sponsorship(new.promise_id);
    exception when others then
      raise warning 'start_requested_sponsorship(%) failed: %', new.promise_id, sqlerrm;
    end;
  end if;
  return new;
end;
$$;

create unique index if not exists uq_membership_fee_period
  on membership_fee_payments (member_id, fee_plan_id, period_start);
