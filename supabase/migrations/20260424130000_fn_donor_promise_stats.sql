-- 약정별 통계: 누적 금액·성공 건수·시작일·최근 12개월 납입 히스토리(월별)
-- 반환: jsonb 배열. 프런트에서 promise_id 기준으로 매칭해 사용.

create or replace function get_donor_promise_stats(
  p_org_id uuid,
  p_member_id uuid
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  with
  month_series as (
    select
      (date_trunc('month', now() at time zone 'Asia/Seoul')::date
        - make_interval(months => 11 - gs.n))::date as month_start
    from generate_series(0, 11) as gs(n)
  ),
  my_promises as (
    select p.id, p.campaign_id, p.started_at, p.amount, p.pay_day
    from promises p
    where p.org_id = p_org_id
      and p.member_id = p_member_id
  ),
  promise_totals as (
    select
      pay.promise_id,
      coalesce(sum(case when pay.pay_status = 'paid' then pay.amount else 0 end), 0) as total_paid,
      count(*) filter (where pay.pay_status = 'paid') as paid_count,
      count(*) filter (where pay.pay_status in ('failed','unpaid')) as failed_count
    from payments pay
    where pay.org_id = p_org_id
      and pay.member_id = p_member_id
      and pay.promise_id is not null
    group by pay.promise_id
  ),
  promise_months as (
    select
      mp.id as promise_id,
      ms.month_start,
      case
        when count(*) filter (where pay.pay_status = 'paid') > 0 then 'paid'
        when count(*) filter (where pay.pay_status in ('failed','unpaid')) > 0 then 'failed'
        else 'none'
      end as status
    from my_promises mp
    cross join month_series ms
    left join payments pay
      on pay.promise_id = mp.id
      and pay.org_id = p_org_id
      and pay.pay_date >= ms.month_start
      and pay.pay_date < (ms.month_start + interval '1 month')
    group by mp.id, ms.month_start
  ),
  promise_history as (
    select
      promise_id,
      jsonb_agg(
        jsonb_build_object(
          'month', to_char(month_start, 'YYYY-MM'),
          'status', status
        )
        order by month_start
      ) as history
    from promise_months
    group by promise_id
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'promise_id', mp.id,
        'total_paid', coalesce(pt.total_paid, 0),
        'paid_count', coalesce(pt.paid_count, 0),
        'failed_count', coalesce(pt.failed_count, 0),
        'history_12m', coalesce(ph.history, '[]'::jsonb)
      )
    ),
    '[]'::jsonb
  )
  into result
  from my_promises mp
  left join promise_totals pt on pt.promise_id = mp.id
  left join promise_history ph on ph.promise_id = mp.id;

  return result;
end;
$$;

grant execute on function get_donor_promise_stats(uuid, uuid) to authenticated, service_role;
