-- 캠페인별 후원 단위(임팩트) 환산 정보
--
-- impact_unit_amount: 1건에 해당하는 금액 (예: 3000원 = 한 끼니)
-- impact_unit_label : 1건의 표현 단위 (예: "끼니", "회 방문", "권")
--
-- 후원자 마이페이지에서 누적 금액을 단위로 환산해 "내 후원이 만든 변화"를
-- 감정적으로 전달하기 위함. NULL 허용 (미설정 캠페인은 환산 문구 숨김).

alter table campaigns
  add column if not exists impact_unit_amount bigint,
  add column if not exists impact_unit_label text;

comment on column campaigns.impact_unit_amount is
  '1건에 해당하는 금액 (KRW). 예: 결식아동 급식 3,000원 = 한 끼';
comment on column campaigns.impact_unit_label is
  '1건의 단위 라벨. 예: "끼", "회 방문", "권", "명"';

-- 값이 음수거나 0이면 나누기 오류 나므로 체크
alter table campaigns
  add constraint campaigns_impact_unit_amount_positive
  check (impact_unit_amount is null or impact_unit_amount > 0);
