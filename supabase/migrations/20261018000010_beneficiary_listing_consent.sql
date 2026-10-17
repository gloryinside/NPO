-- 결연 아동 공개(사진·소개)의 보호자 동의 기록 — 만 14세 미만 아동 정보 공개는 법정대리인 동의가 필요하다
-- (개인정보 보호법 제22조의2). 공개를 켤 때 누가·언제 동의했는지 남긴다.
alter table beneficiaries add column if not exists listing_consent_by text;
alter table beneficiaries add column if not exists listing_consent_relation text;
alter table beneficiaries add column if not exists listing_consent_date date;
alter table beneficiaries add column if not exists listing_consent_recorded_by uuid;
