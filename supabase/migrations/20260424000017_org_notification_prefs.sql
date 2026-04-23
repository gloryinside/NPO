-- G-D152: 기관별 admin 알림 ON/OFF (어떤 이벤트가 admin_notifications에 푸시될지)
--   JSONB 한 컬럼에 키-boolean 맵. 기본값은 모두 true.
--
-- 대표 키 (코드에서 참조):
--   payment_failed, chargeback, email_bounce_spike,
--   campaign_milestone_50, campaign_milestone_100,
--   manual_payment_requires_match, pg_outage

alter table orgs
  add column if not exists admin_notification_prefs jsonb
    not null default '{
      "payment_failed": true,
      "chargeback": true,
      "email_bounce_spike": true,
      "campaign_milestone_50": true,
      "campaign_milestone_100": true,
      "manual_payment_requires_match": true,
      "pg_outage": true
    }'::jsonb;

comment on column orgs.admin_notification_prefs is
  'G-D152 admin_notifications 로 푸시할 이벤트 ON/OFF';
