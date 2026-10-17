-- 기부금 유형 코드(소득세법 시행규칙 별지 제45호서식 기부금명세서 코드)
--   10 특례기부금 · 20 정치자금기부금 · 40 일반기부금(종교단체 외) · 41 일반기부금(종교단체) · 42 우리사주조합기부금 · 43 고향사랑기부금
-- 기부금영수증·연말정산 간소화 자료에 기부금 종류를 적어야 한다. 기관이 받는 기부금의 공제 유형으로 정한다.
alter table orgs add column if not exists donation_type_code text;
alter table orgs drop constraint if exists orgs_donation_type_code_check;
alter table orgs add constraint orgs_donation_type_code_check
  check (donation_type_code is null or donation_type_code in ('10', '20', '40', '41', '42', '43'));
