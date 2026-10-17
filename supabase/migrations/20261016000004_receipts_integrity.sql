-- 기부금영수증 발급 정합성·보안 보완
--
-- 1) 영수증 번호: 기관·연도별 카운터를 원자적으로 증가(예전: count+1 → 동시 발급 시 번호 중복·실패 연쇄)
create table if not exists receipt_counters (
  org_id uuid not null references orgs(id) on delete cascade,
  year int not null,
  last_seq int not null default 0,
  primary key (org_id, year)
);
alter table receipt_counters enable row level security;
drop policy if exists receipt_counters_service_only on receipt_counters;
create policy receipt_counters_service_only on receipt_counters for select using (false);

-- 기존 발급분 이후 번호부터 시작(RCP-YYYY-NNNNN / RC-YYYY-NNNNN 모두 고려)
insert into receipt_counters (org_id, year, last_seq)
select org_id, year, max(coalesce(nullif(regexp_replace(receipt_code, '^.*-', ''), ''), '0')::int)
from receipts
where receipt_code ~ '-[0-9]+$'
group by org_id, year
on conflict (org_id, year) do update set last_seq = greatest(receipt_counters.last_seq, excluded.last_seq);

create or replace function next_receipt_seq(p_org uuid, p_year int)
returns int
language sql
security definer
set search_path = public
as $$
  insert into receipt_counters (org_id, year, last_seq) values (p_org, p_year, 1)
  on conflict (org_id, year) do update set last_seq = receipt_counters.last_seq + 1
  returning last_seq;
$$;

-- 2) 진위 확인용 토큰(예전: 순차 번호로 조회 → 금액·이름 열거 가능, 기관 간 번호 중복 시 조회 실패)
alter table receipts add column if not exists verify_token text;
create unique index if not exists uq_receipts_verify_token on receipts (verify_token) where verify_token is not null;

-- 3) 영수증 법정 기재사항(기부금 단체) — 영수증 발급 전 필수 검증
alter table orgs add column if not exists representative_name text;   -- 대표자
alter table orgs add column if not exists donee_type text;            -- 기부금단체 구분(예: 공익법인·사회복지법인 등)
alter table orgs add column if not exists donee_legal_basis text;     -- 지정·근거 법령(예: 법인세법 제24조제3항제1호)
alter table orgs add column if not exists donee_code text;            -- 국세청 기부금단체코드(알파벳 3자리)

-- 4) 고유식별정보(주민등록번호) 처리 동의 기록 — 개인정보보호법 제24조
alter table members add column if not exists rrn_consent_at timestamptz;
alter table payments add column if not exists rrn_consent_at timestamptz;

-- 5) 암호화 함수는 서버(service_role)만 호출 — 기본 권한(public 실행) 제거
do $$
declare f text;
begin
  foreach f in array array[
    'encrypt_id_number(text, text)', 'decrypt_id_number(bytea, text)',
    'encrypt_rrn_pending(text, text)', 'decrypt_rrn_pending(bytea, text)',
    'encrypt_secret(text, text)', 'decrypt_secret(bytea, text)', 'decrypt_secret(text, text)'
  ] loop
    if to_regprocedure(f) is not null then
      execute format('revoke execute on function %s from public, anon, authenticated', f);
      execute format('grant execute on function %s to service_role', f);
    end if;
  end loop;
end $$;

revoke execute on function next_receipt_seq(uuid, int) from public, anon, authenticated;
grant execute on function next_receipt_seq(uuid, int) to service_role;
