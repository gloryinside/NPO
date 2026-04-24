-- SP-1: 후원자 대시보드 스냅샷 RPC
-- 기존 7개 쿼리를 단일 PL/pgSQL 함수로 통합해 RTT를 6 → 2로 축소.
-- 포함 필드: active_promises, recent_payments, latest_receipt, total_paid,
-- upcoming_payments, expiring_cards, action_failed_count, action_rrn_count,
-- action_changes_count, streak

CREATE OR REPLACE FUNCTION get_donor_dashboard_snapshot(
  p_org_id    uuid,
  p_member_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now           timestamptz := NOW();
  v_year          int         := EXTRACT(YEAR FROM v_now AT TIME ZONE 'Asia/Seoul');
  v_month         int         := EXTRACT(MONTH FROM v_now AT TIME ZONE 'Asia/Seoul');
  v_today         int         := EXTRACT(DAY FROM v_now AT TIME ZONE 'Asia/Seoul');
  v_year_start    date        := make_date(v_year, 1, 1);
  v_year_end      date        := make_date(v_year + 1, 1, 1);
  v_month_start   date        := make_date(v_year, v_month, 1);
  v_next_month    date        := v_month_start + INTERVAL '1 month';
  v_30_days_ago   timestamptz := v_now - INTERVAL '30 days';
  v_window_days   int         := 60;

  v_active_promises   jsonb;
  v_recent_payments   jsonb;
  v_latest_receipt    jsonb;
  v_total_paid        numeric;
  v_upcoming          jsonb;
  v_expiring          jsonb;
  v_failed_count      int;
  v_rrn_count         int;
  v_changes_count     int;
  v_streak            int := 0;
  v_cur_year          int;
  v_cur_month         int;
  v_has_payment       boolean;
BEGIN
  -- 1. 활성 약정
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_active_promises
  FROM (
    SELECT p.id, p.amount, p.pay_day,
           jsonb_build_object('id', c.id, 'title', c.title) AS campaigns
    FROM promises p
    LEFT JOIN campaigns c ON c.id = p.campaign_id
    WHERE p.org_id = p_org_id AND p.member_id = p_member_id AND p.status = 'active'
    ORDER BY p.created_at DESC
  ) t;

  -- 2. 최근 납입 5건
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_recent_payments
  FROM (
    SELECT py.id, py.amount, py.pay_date, py.pay_status,
           jsonb_build_object('id', c.id, 'title', c.title) AS campaigns
    FROM payments py
    LEFT JOIN campaigns c ON c.id = py.campaign_id
    WHERE py.org_id = p_org_id AND py.member_id = p_member_id
    ORDER BY py.pay_date DESC NULLS LAST
    LIMIT 5
  ) t;

  -- 3. 최신 영수증 1건
  SELECT row_to_json(t)::jsonb
  INTO v_latest_receipt
  FROM (
    SELECT id, year, total_amount, pdf_url
    FROM receipts
    WHERE org_id = p_org_id AND member_id = p_member_id
    ORDER BY year DESC
    LIMIT 1
  ) t;

  -- 4. 누적 후원액 (paid만)
  SELECT COALESCE(SUM(amount), 0)
  INTO v_total_paid
  FROM payments
  WHERE org_id = p_org_id AND member_id = p_member_id AND pay_status = 'paid';

  -- 5. 이번 달 예정 납입 (pay_day >= 오늘, 이번달 paid 기록 없음)
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY (row_to_json(t)->>'scheduled_date')), '[]'::jsonb)
  INTO v_upcoming
  FROM (
    SELECT p.id AS promise_id,
           c.title AS campaign_title,
           p.amount,
           make_date(v_year, v_month, p.pay_day)::text AS scheduled_date
    FROM promises p
    LEFT JOIN campaigns c ON c.id = p.campaign_id
    WHERE p.org_id = p_org_id AND p.member_id = p_member_id
      AND p.type = 'regular' AND p.status = 'active'
      AND p.pay_day IS NOT NULL AND p.pay_day >= v_today
      AND NOT EXISTS (
        SELECT 1 FROM payments py
        WHERE py.org_id = p_org_id AND py.member_id = p_member_id
          AND py.promise_id = p.id
          AND py.pay_status = 'paid'
          AND py.pay_date >= v_month_start AND py.pay_date < v_next_month
      )
  ) t;

  -- 6. 카드 만료 임박 (60일 이내)
  -- card_expiry_year/month는 해당 월 말일까지 유효
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY (row_to_json(t)->>'days_until_expiry')::int), '[]'::jsonb)
  INTO v_expiring
  FROM (
    SELECT p.id AS promise_id,
           c.title AS campaign_title,
           p.card_expiry_year AS expiry_year,
           p.card_expiry_month AS expiry_month,
           ((make_date(p.card_expiry_year, p.card_expiry_month, 1) + INTERVAL '1 month - 1 day')::date
            - CURRENT_DATE)::int AS days_until_expiry
    FROM promises p
    LEFT JOIN campaigns c ON c.id = p.campaign_id
    WHERE p.org_id = p_org_id AND p.member_id = p_member_id
      AND p.status IN ('active', 'suspended')
      AND p.card_expiry_year IS NOT NULL
      AND p.card_expiry_month IS NOT NULL
      AND ((make_date(p.card_expiry_year, p.card_expiry_month, 1) + INTERVAL '1 month - 1 day')::date
           - CURRENT_DATE)::int <= v_window_days
  ) t;

  -- 7. 액션: 결제 실패 (재시도 가능한 건만)
  SELECT COUNT(*) INTO v_failed_count
  FROM payments
  WHERE org_id = p_org_id AND member_id = p_member_id
    AND pay_status = 'failed' AND retry_count < 3;

  -- 8. 액션: 주민번호 미입력 영수증 (올해, 영수증 신청했지만 rrn 대기)
  SELECT COUNT(*) INTO v_rrn_count
  FROM payments
  WHERE org_id = p_org_id AND member_id = p_member_id
    AND pay_status = 'paid' AND receipt_opt_in = true
    AND rrn_pending_encrypted IS NULL AND receipt_id IS NULL
    AND pay_date >= v_year_start AND pay_date < v_year_end;

  -- 9. 액션: 최근 30일 admin에 의한 약정 변경
  SELECT COUNT(*) INTO v_changes_count
  FROM promise_amount_changes
  WHERE org_id = p_org_id AND member_id = p_member_id
    AND actor = 'admin' AND created_at >= v_30_days_ago;

  -- 10. 연속 납입 스트릭 (현재 월부터 역순)
  v_cur_year  := v_year;
  v_cur_month := v_month;
  LOOP
    SELECT EXISTS(
      SELECT 1 FROM payments
      WHERE org_id = p_org_id AND member_id = p_member_id
        AND pay_status = 'paid'
        AND DATE_TRUNC('month', pay_date)::date = make_date(v_cur_year, v_cur_month, 1)
    ) INTO v_has_payment;
    EXIT WHEN NOT v_has_payment;
    v_streak := v_streak + 1;
    IF v_cur_month = 1 THEN
      v_cur_year  := v_cur_year - 1;
      v_cur_month := 12;
    ELSE
      v_cur_month := v_cur_month - 1;
    END IF;
    EXIT WHEN v_streak > 120;  -- 안전 탈출 (10년)
  END LOOP;

  RETURN jsonb_build_object(
    'active_promises',      v_active_promises,
    'recent_payments',      v_recent_payments,
    'latest_receipt',       v_latest_receipt,
    'total_paid',           v_total_paid,
    'upcoming_payments',    v_upcoming,
    'expiring_cards',       v_expiring,
    'action_failed_count',  v_failed_count,
    'action_rrn_count',     v_rrn_count,
    'action_changes_count', v_changes_count,
    'streak',               v_streak
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_donor_dashboard_snapshot(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_donor_dashboard_snapshot(uuid, uuid) TO service_role;

COMMENT ON FUNCTION get_donor_dashboard_snapshot(uuid, uuid) IS
  'SP-1: 후원자 대시보드 단일 RPC. 10개 쿼리 통합. SECURITY DEFINER — 호출자 권한 무관하게 실행.';
