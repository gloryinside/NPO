-- 개인정보 처리 기록(접속기록) — 개인정보의 안전성 확보조치 기준: 계정·일시·접속지·처리한 정보주체·수행 업무.
-- 접속지(IP)가 없어 추가한다. audit_logs 는 추가만 하는 표라 2년 이상 보관 요건도 맞는다(고유식별정보 처리 시 2년).
alter table audit_logs add column if not exists ip_address text;
