-- AI 이탈 예측 점수
--   복잡한 ML 모델 대신 휴리스틱 + LR-style 가중치로 점수 산출.
--   members.churn_score (0~100): 높을수록 이탈 위험 큼.
--   churn_factors: jsonb로 점수 기여 요인 기록 (설명 가능성).

alter table members add column if not exists churn_score integer
  check (churn_score >= 0 and churn_score <= 100);
alter table members add column if not exists churn_factors jsonb;
alter table members add column if not exists churn_score_at timestamptz;

create index if not exists idx_members_churn_score
  on members (org_id, churn_score desc nulls last)
  where churn_score is not null;

comment on column members.churn_score is
  '이탈 예측 점수 (0~100). 100=즉각 이탈 위험, 0=충성 후원자.';
comment on column members.churn_factors is
  '점수 기여 요인. {"recent_failed_payments": 30, "no_activity_90d": 20, "amount_decline": 15, ...}';
