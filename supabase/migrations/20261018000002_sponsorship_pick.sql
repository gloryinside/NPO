-- 결연 아동 선택 신청 — 정기후원 신청서에서 후원자가 결연할 아이를 직접 고른다.
--   beneficiaries.public_listing  : 신청 화면에 보여도 되는 아이(보호자 동의를 받은 경우만 관리자가 켠다)
--   beneficiaries.reserved_*      : 신청이 끝날 때까지 다른 후원자가 고르지 못하게 잡아 둔다(기한이 지나면 풀림)
--   promises.beneficiary_id       : 이 약정으로 결연하려는 아이
--   start_requested_sponsorship() : 약정이 유효해지거나(active) 첫 결제가 되면 결연을 만든다 — 결제·약정을 바꾸는
--                                   곳이 여러 군데라 트리거 한 곳에서 처리한다.

alter table beneficiaries add column if not exists public_listing boolean not null default false;
alter table beneficiaries add column if not exists reserved_promise_id uuid references promises(id) on delete set null;
alter table beneficiaries add column if not exists reserved_until timestamptz;
alter table promises add column if not exists beneficiary_id uuid references beneficiaries(id) on delete set null;

create index if not exists idx_beneficiaries_public
  on beneficiaries (org_id, program_id) where public_listing and status = 'available';

-- 아이를 잡아 둔다 — 이미 다른 신청이 잡고 있으면 false
create or replace function reserve_beneficiary(p_org uuid, p_beneficiary uuid, p_promise uuid, p_until timestamptz)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_id uuid;
begin
  update beneficiaries
     set reserved_promise_id = p_promise, reserved_until = p_until, updated_at = now()
   where id = p_beneficiary and org_id = p_org
     and status = 'available' and public_listing
     and (reserved_until is null or reserved_until < now() or reserved_promise_id = p_promise)
  returning id into v_id;
  return v_id is not null;
end;
$$;

-- 약정이 고른 아이와 결연을 시작한다(이미 시작했으면 아무것도 안 함)
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
  -- 약정이 유효하거나 결제가 한 번이라도 된 경우만
  if p.status <> 'active' and not exists (
       select 1 from payments where promise_id = p.id and pay_status = 'paid') then
    return;
  end if;
  if exists (select 1 from sponsorships where promise_id = p.id) then return; end if;

  select id, name, status, reserved_promise_id, reserved_until into b
    from beneficiaries where id = p.beneficiary_id and org_id = p.org_id for update;
  if b.id is null then return; end if;

  -- 다른 후원자와 이미 결연했거나 잡아 둔 기한이 지나 다른 신청이 잡았으면 관리자에게 알린다
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

-- 트리거 함수는 소유자 권한으로 돈다 — 어느 역할이 행을 바꾸든 결연 함수(클라이언트에는 막아 둠)를 부를 수 있게
create or replace function trg_promise_start_sponsorship() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.beneficiary_id is not null and new.status = 'active'
     and (tg_op = 'INSERT' or old.status is distinct from 'active' or old.beneficiary_id is distinct from new.beneficiary_id) then
    perform start_requested_sponsorship(new.id);
  end if;
  return new;
end;
$$;

create or replace function trg_payment_start_sponsorship() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.promise_id is not null and new.pay_status = 'paid'
     and (tg_op = 'INSERT' or old.pay_status is distinct from 'paid') then
    perform start_requested_sponsorship(new.promise_id);
  end if;
  return new;
end;
$$;

drop trigger if exists promise_start_sponsorship on promises;
create trigger promise_start_sponsorship after insert or update of status, beneficiary_id on promises
  for each row execute function trg_promise_start_sponsorship();

drop trigger if exists payment_start_sponsorship on payments;
create trigger payment_start_sponsorship after insert or update of pay_status on payments
  for each row execute function trg_payment_start_sponsorship();

revoke all on function reserve_beneficiary(uuid, uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function reserve_beneficiary(uuid, uuid, uuid, timestamptz) to service_role;
revoke all on function start_requested_sponsorship(uuid) from public, anon, authenticated;

comment on column beneficiaries.public_listing is '후원 신청 화면에 공개 — 보호자 동의를 받은 아이만';
comment on column promises.beneficiary_id is '이 약정으로 결연하려는 아이 — 약정이 유효해지거나 첫 결제가 되면 결연 생성';
