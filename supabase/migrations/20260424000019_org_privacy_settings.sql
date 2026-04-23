-- G-D209: 기관별 개인정보 보유/익명화 정책.
--   retention_days: withdrawn 이후 N일 경과 후 phone/birth_date 등 추가 익명화
--   auto_anonymize: cron 활성화 여부
--   fields: 대상 컬럼 리스트 (기본값 name, email, phone, birth_date, address_*)

alter table orgs
  add column if not exists privacy_settings jsonb
    not null default '{
      "retention_days": 1825,
      "auto_anonymize": true,
      "fields": ["name","email","phone","birth_date","address_line1","address_line2","postal_code"]
    }'::jsonb;

comment on column orgs.privacy_settings is
  'G-D209 PII 보유·자동 익명화 정책. retention_days 이후 cron 이 추가 마스킹';
