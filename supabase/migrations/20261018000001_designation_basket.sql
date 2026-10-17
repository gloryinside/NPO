-- 여러 사업 담기 — 후원자가 고른 사업별 금액(lib/donations/designation-basket SplitItem[])
--   payments.designation_split : 이 결제의 나눔
--   promises.designation / designation_split : 정기후원이 매달 만드는 결제에 그대로 옮긴다
--     (예전에는 정기 약정에 후원 목적이 없어 둘째 달부터 목적이 사라졌다)
alter table payments add column if not exists designation_split jsonb;
alter table promises add column if not exists designation text;
alter table promises add column if not exists designation_split jsonb;

comment on column payments.designation_split is '후원자가 고른 사업별 금액 [{key,label,amount,programId}]';
comment on column promises.designation_split is '정기후원 사업별 금액 — 매월 결제에 복사';
