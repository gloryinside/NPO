-- M1-M10 신규 테이블 13종 RLS 정책
--   패턴:
--     - {table}_admin_all:   is_org_admin(org_id) 으로 admin 전체 CRUD
--     - {table}_self_read:   donor가 자기 데이터만 조회 (해당되는 테이블만)
--     - service_role:        모든 정책 우회 (서버 admin client)
--   기존 패턴 (20260415000007_rls_policies.sql) 과 동일하게 작성.

-- ============================================================================
-- M1. member_tags (org-wide 마스터 — admin only)
-- ============================================================================
drop policy if exists "member_tags_admin_all" on member_tags;
create policy "member_tags_admin_all" on member_tags
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

-- ============================================================================
-- M1. member_tag_assignments — admin 전체 + donor 자기 부여 태그 조회
-- ============================================================================
drop policy if exists "member_tag_assignments_admin_all" on member_tag_assignments;
create policy "member_tag_assignments_admin_all" on member_tag_assignments
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "member_tag_assignments_self_read" on member_tag_assignments;
create policy "member_tag_assignments_self_read" on member_tag_assignments
  for select using (
    member_id in (select id from members where supabase_uid = auth.uid())
  );

-- ============================================================================
-- M2. in_kind_donations — admin 전체 + donor 자기 기부 조회
-- ============================================================================
drop policy if exists "in_kind_donations_admin_all" on in_kind_donations;
create policy "in_kind_donations_admin_all" on in_kind_donations
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "in_kind_donations_self_read" on in_kind_donations;
create policy "in_kind_donations_self_read" on in_kind_donations
  for select using (
    member_id in (select id from members where supabase_uid = auth.uid())
  );

-- ============================================================================
-- M3. volunteer_activities — admin 전체 + 봉사자 본인 조회
-- ============================================================================
drop policy if exists "volunteer_activities_admin_all" on volunteer_activities;
create policy "volunteer_activities_admin_all" on volunteer_activities
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "volunteer_activities_self_read" on volunteer_activities;
create policy "volunteer_activities_self_read" on volunteer_activities
  for select using (
    volunteer_id in (select id from members where supabase_uid = auth.uid())
  );

-- ============================================================================
-- M4. programs / budget_items / expenses / funding — admin 전체 (회계 정보)
-- ============================================================================
drop policy if exists "programs_admin_all" on programs;
create policy "programs_admin_all" on programs
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "program_budget_items_admin_all" on program_budget_items;
create policy "program_budget_items_admin_all" on program_budget_items
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "program_expenses_admin_all" on program_expenses;
create policy "program_expenses_admin_all" on program_expenses
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "program_funding_admin_all" on program_funding;
create policy "program_funding_admin_all" on program_funding
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

-- ============================================================================
-- M5. events — admin 전체 + status='open'/'closed'/'completed' 는 익명 공개
--    event_attendances — admin 전체 + 본인(회원) 참석 조회
-- ============================================================================
drop policy if exists "events_admin_all" on events;
create policy "events_admin_all" on events
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "events_public_read" on events;
create policy "events_public_read" on events
  for select using (status in ('open','closed','completed'));

drop policy if exists "event_attendances_admin_all" on event_attendances;
create policy "event_attendances_admin_all" on event_attendances
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "event_attendances_self_read" on event_attendances;
create policy "event_attendances_self_read" on event_attendances
  for select using (
    member_id in (select id from members where supabase_uid = auth.uid())
  );

-- ============================================================================
-- M6. gift_rules / gift_shipments — admin 전체 + 본인 발송 조회
-- ============================================================================
drop policy if exists "gift_rules_admin_all" on gift_rules;
create policy "gift_rules_admin_all" on gift_rules
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "gift_shipments_admin_all" on gift_shipments;
create policy "gift_shipments_admin_all" on gift_shipments
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "gift_shipments_self_read" on gift_shipments;
create policy "gift_shipments_self_read" on gift_shipments
  for select using (
    member_id in (select id from members where supabase_uid = auth.uid())
  );

-- ============================================================================
-- M7. tax_invoices — admin 전체 + 본인(법인 후원자) 조회
-- ============================================================================
drop policy if exists "tax_invoices_admin_all" on tax_invoices;
create policy "tax_invoices_admin_all" on tax_invoices
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "tax_invoices_self_read" on tax_invoices;
create policy "tax_invoices_self_read" on tax_invoices
  for select using (
    member_id in (select id from members where supabase_uid = auth.uid())
  );

-- ============================================================================
-- M8. mail_campaigns / mail_dispatches — admin 전체 (내부 운영 데이터)
-- ============================================================================
drop policy if exists "mail_campaigns_admin_all" on mail_campaigns;
create policy "mail_campaigns_admin_all" on mail_campaigns
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "mail_dispatches_admin_all" on mail_dispatches;
create policy "mail_dispatches_admin_all" on mail_dispatches
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

-- ============================================================================
-- M9. donation_channels / channel_settlements — admin 전체
-- ============================================================================
drop policy if exists "donation_channels_admin_all" on donation_channels;
create policy "donation_channels_admin_all" on donation_channels
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "channel_settlements_admin_all" on channel_settlements;
create policy "channel_settlements_admin_all" on channel_settlements
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

-- ============================================================================
-- M10. beneficiaries — admin 전체 + 결연된 후원자만 read
--      sponsorships — admin 전체 + 자기 결연 read
--      sponsor_letters — admin 전체 + 자기 결연 편지 read
--      beneficiary_updates — admin 전체 + 결연 수혜자의 근황 read
-- ============================================================================
drop policy if exists "beneficiaries_admin_all" on beneficiaries;
create policy "beneficiaries_admin_all" on beneficiaries
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "beneficiaries_sponsor_read" on beneficiaries;
create policy "beneficiaries_sponsor_read" on beneficiaries
  for select using (
    id in (
      select beneficiary_id from sponsorships
      where sponsor_member_id in (select id from members where supabase_uid = auth.uid())
    )
  );

drop policy if exists "sponsorships_admin_all" on sponsorships;
create policy "sponsorships_admin_all" on sponsorships
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "sponsorships_self_read" on sponsorships;
create policy "sponsorships_self_read" on sponsorships
  for select using (
    sponsor_member_id in (select id from members where supabase_uid = auth.uid())
  );

drop policy if exists "sponsor_letters_admin_all" on sponsor_letters;
create policy "sponsor_letters_admin_all" on sponsor_letters
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "sponsor_letters_self_read" on sponsor_letters;
create policy "sponsor_letters_self_read" on sponsor_letters
  for select using (
    sponsorship_id in (
      select id from sponsorships
      where sponsor_member_id in (select id from members where supabase_uid = auth.uid())
    )
    -- 후원자는 검수/전달 완료된 것만 본다
    and status in ('reviewed','delivered')
  );

drop policy if exists "beneficiary_updates_admin_all" on beneficiary_updates;
create policy "beneficiary_updates_admin_all" on beneficiary_updates
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "beneficiary_updates_sponsor_read" on beneficiary_updates;
create policy "beneficiary_updates_sponsor_read" on beneficiary_updates
  for select using (
    visibility = 'public'
    or beneficiary_id in (
      select beneficiary_id from sponsorships
      where sponsor_member_id in (select id from members where supabase_uid = auth.uid())
    )
  );
