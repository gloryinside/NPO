-- A/B 비교: 정기후원은 신청 때 결제 행이 아니라 약정이 남는다(카드 등록 대기 결제는 30분 뒤 정리됨) —
-- 정기후원 신청의 성과는 약정에 붙인 실험·안으로 센다.
alter table promises add column if not exists ab_test_id uuid references form_ab_tests(id) on delete set null;
alter table promises add column if not exists ab_variant text check (ab_variant is null or ab_variant in ('A', 'B'));
create index if not exists idx_promises_ab on promises (ab_test_id, ab_variant) where ab_test_id is not null;
