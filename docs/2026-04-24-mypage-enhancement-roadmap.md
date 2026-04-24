# MyPage 고도화 로드맵 (2026-04-24)

## 배경

`/donor` MyPage는 Tier 1~13에 걸쳐 이미 상당 수준까지 고도화됨. 대시보드(Action Required / 카드 만료 / 첫 후원 온보딩), 설정(알림/동의/언어/데이터 내보내기/계정 삭제), 임팩트 / 영수증 / 응원 벽 / 친구 초대가 모두 구현되어 있음. 선행 스펙: `docs/2026-04-22-mypage-aggregation-design.md` (Phase 7-D-3).

본 문서는 그 **다음 단계 — 20건의 개선 후보를 실행 가능한 sub-project 단위로 분해한 로드맵**이다. 각 sub-project는 독립된 `spec → plan → PR` 사이클로 닫는다.

---

## Decomposition — 20건 → 6 sub-projects

### SP-1. Dashboard 성능·관측 기반 (**1순위**)

`src/app/(donor)/donor/page.tsx`는 현재 Supabase 라운드트립 7회(promises, payments, receipts, paidSum, actions, upcomingPayments, expiringCards) 중 일부만 `Promise.all`. 후속 sub-project는 여기에 섹션을 추가하기 때문에 먼저 바닥이 단단해야 함.

- **F19** — 집계 쿼리를 단일 PostgreSQL RPC(`donor_dashboard_snapshot`)로 통합. Supabase 왕복 7 → 1
- **F20** — App Router Streaming SSR + `<Suspense>`. 히어로 / Action 배너 먼저, 무거운 섹션은 lazy
- **F21** — MyPage LCP · CLS · INP 수집 (PostHog `posthog-js` Web Vitals, `/donor/*` 세그먼트)

**의존성**: 없음
**완료 기준**: `/donor` 서버 쿼리 수 1회, LCP p75 < 2.5s, 대시보드 TTFB 30% 감소

---

### SP-2. 관여·재참여 (Engagement)

정기후원자 이탈 방지를 위한 심리 장치. 기존 `impact/` 라우트 · OG 이미지 · `promise_amount_changes` 이력을 재활용.

- **A1** — 연간 기부 리포트 (`/donor/impact/report/[year]`) + SNS 공유 OG
- **A2** — 연속 후원 스트릭 배지 (`promises.created_at` · `payments.pay_date`에서 파생)
- **A3** — 캠페인별 기여 비중 도넛/스택 차트 (`payments.campaign_id` 기반 집계)
- **A4** — "다음 결제까지 D-N" 카운트다운 — 히어로 내 표시

**의존성**: SP-1 권장 (집계 RPC에 얹는 편이 효율)
**완료 기준**: 리포트 공유 카드 렌더, 스트릭 계산 정확도, 도넛 차트 a11y 테이블 fallback

---

### SP-3. 결제 셀프서비스 완결

Tier 9~13의 dunning / chargeback / card-expiry 백엔드는 탄탄. 프론트 UX 관점의 사용자 셀프 조작 경로가 부족.

- **B5** — 결제 실패 사유 사용자 언어 매핑 (PG 응답 코드 → 한국어 설명 + 복구 가이드)
- **B6** — 약정 일시중지(Pause) — 해지 대체 옵션. `promises.status = 'suspended'` 기존 활용
- **B7** — 증액/감액 셀프서비스 — `promise_amount_changes`에 `actor='donor'` 경로 추가
- **B8** — 월별 결제 예정 캘린더 뷰 (SP-2 · A4와 데이터 공유)

**의존성**: 없음 (SP-1과 병렬 가능)
**완료 기준**: Pause/Resume 플로우 E2E, 금액 변경 감사 로그, 캘린더 접근성

---

### SP-4. 세무·증빙 편의 (한국 특화)

한국 정기후원자 페인포인트. C9는 외부 시스템 + 법무 검토 필요 → 단독 트랙으로 분리.

- **C10** — 가족 공제 대상 영수증 합산 뷰 (`members.household_master_id` 신규 FK 필요)
- **C11** — 영수증 위변조 검증 QR (기존 `api/donor/certificate/` 확장)
- **C9 (별도 트랙)** — 국세청 홈택스 간소화 자동 반영 — 법무/세무 자문 선행

**의존성**: C10은 멤버 스키마 마이그레이션 필요
**완료 기준**: QR 공개 검증 페이지, 가족 그룹 영수증 일괄 PDF, C9는 법무 회신 후 별도 spec

---

### SP-5. 보안·세션 강화

- **E15** — 활성 세션·기기 관리 (Supabase Auth `auth.sessions` 또는 자체 `donor_sessions` 테이블 활용)
- **E16** — 2FA/OTP 선택 활성화 토글 — 기존 `otp-login-form.tsx` 재사용
- **E17** — 새 기기 / 낯선 IP 로그인 시 이메일 알림
- **E18** — 민감 작업(해지 / 금액 변경 / 영수증 다운로드) 비밀번호 재인증

**의존성**: `session.authMethod === 'supabase'` vs 자체 인증 경로 통일 필요 — 스펙 작성 시 조사
**완료 기준**: 세션 revoke 동작, 재인증 우회 불가, 알림 이메일 스팸 처리

---

### SP-6. 품질 마감 (i18n · a11y · 모션)

모든 SP 완료 후 최종 감사로 일괄 돌리는 게 효율적.

- **D12** — MyPage 전체 i18n — `(donor)/donor/**/*.tsx`의 한글 하드코딩 전수 조사 후 i18n 키 치환
- **D13** — WCAG 2.1 AA 감사 — 색 대비(`var(--accent)` 위 흰 텍스트 등), 키보드 탐색, 스크린리더 aria-label
- **D14** — `prefers-reduced-motion` 대응 — 히어로 그라데이션 · 차트 트랜지션

**의존성**: 모든 앞 SP 선행
**완료 기준**: Lighthouse a11y ≥ 95, i18n 커버리지 ≥ 98%, 모션 감소 QA 통과

---

## 실행 순서 (권장)

```
SP-1 ─┬─► SP-2 ─┐
      │         │
      └─► SP-3 ─┼─► SP-6 (최종 감사)
                │
      SP-5 ────┤
                │
      SP-4 ────┘
      (C10 · C11 먼저, C9는 법무 트랙 별도)
```

1. **SP-1** (선행) — 대시보드 바닥 재정비
2. **SP-2 · SP-3** (병렬) — 핵심 사용자 가치
3. **SP-5** (병렬 가능) — 보안 트랙
4. **SP-4-C10 · C11** (병렬 가능), **SP-4-C9** (법무 회신 후 별도)
5. **SP-6** (최종 감사) — 전체 품질 마감

---

## 각 Sub-project 다음 단계

각 SP는 진입 시점에 다음 사이클을 수행한다:

1. **brainstorming** — 한 질문씩 요구/제약/성공 기준 명확화
2. **design spec** — `docs/superpowers/specs/YYYY-MM-DD-sp-N-<topic>-design.md` 작성 + 커밋
3. **user review** — 사용자 승인 대기 (HARD-GATE)
4. **writing-plans** — 승인 후 구현 계획 작성
5. **구현 + PR**

본 로드맵은 **SP-1부터 착수**한다.

---

## 제외 (YAGNI)

- 본 로드맵 범위 밖:
  - 관리자 페이지 고도화 (별도 트랙)
  - 신규 캠페인 빌더 / 기부 플로우 변경
  - 새 결제 수단 추가 (카카오페이 / 토스페이 등)
  - 후원자 앱 (모바일 네이티브)

이들은 요청 시 별도 로드맵으로 분리한다.
