-- G-D157: 후원자 우편 주소 (물품·감사편지·영수증 원본 발송용)
--
-- 한국 우편번호 체계(5자리)를 가정하며, 부분 입력도 허용(NULL 가능).
-- 민감정보에 준해 admin·본인만 조회 — RLS는 members 와 동일 정책.

alter table members
  add column if not exists postal_code text,
  add column if not exists address_line1 text,
  add column if not exists address_line2 text;

comment on column members.postal_code is
  'G-D157 우편번호 (KR: 5자리). 국제 확장 시 별도 컬럼';
comment on column members.address_line1 is
  'G-D157 기본 주소 (도로명/지번)';
comment on column members.address_line2 is
  'G-D157 상세 주소 (동/호수/건물)';
