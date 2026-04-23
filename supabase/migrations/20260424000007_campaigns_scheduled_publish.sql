-- G-D138: 캠페인 예약 발행
--   scheduled_publish_at 이 도래하면 cron 이 status='draft' → 'active' 로 전환

alter table campaigns
  add column if not exists scheduled_publish_at timestamptz;

create index if not exists idx_campaigns_scheduled_publish
  on campaigns (scheduled_publish_at)
  where scheduled_publish_at is not null and status = 'draft';

comment on column campaigns.scheduled_publish_at is
  'G-D138 예약 발행 시각. cron(auto-publish-campaigns) 이 도래 시 status=active 로 전환';
