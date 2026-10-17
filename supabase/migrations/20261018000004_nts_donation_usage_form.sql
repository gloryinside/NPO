-- 연간 기부금 모금액 및 활용실적 명세서(법인세법 시행규칙 별지 제63호의7서식) 작성본 저장
--   transparency_disclosures 에 disclosure_type='nts_donation_usage', content = lib/disclosure/nts-63-7 Nts637Form
--   기관·연도마다 하나. 초안(draft)으로 두고, 공개 화면에는 기관이 PDF를 올려 게시할 때만 보인다.
alter table transparency_disclosures drop constraint if exists transparency_disclosures_disclosure_type_check;
alter table transparency_disclosures add constraint transparency_disclosures_disclosure_type_check
  check (disclosure_type in (
    'income_summary', 'expense_summary', 'salary_top5', 'related_party',
    'fundraising_cost', 'donor_top5', 'other', 'nts_donation_usage'
  ));
alter table transparency_disclosures add column if not exists updated_at timestamptz;

create unique index if not exists uq_transparency_nts_donation_usage
  on transparency_disclosures (org_id, fiscal_year)
  where disclosure_type = 'nts_donation_usage';
