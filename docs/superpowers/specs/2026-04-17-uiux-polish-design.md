# UI/UX 고도화 설계

**작성일**: 2026-04-17
**범위**: 빌더 분할 미리보기 + 빌더 UX + 공개 블록 다크테마 + 관리자 캠페인 목록 카드화
**상위 프로젝트**: NPO 후원관리시스템

---

## 1. 배경 및 목표

### 현재 문제
| 화면 | 문제 |
|------|------|
| 빌더 캔버스 | 블록이 `[ Hero 배너 ]` 텍스트 라벨만 표시 — 편집 결과를 실시간으로 볼 수 없음 |
| 빌더 헤더 | `bg-white` 하드코딩 — 다크테마 디자인 시스템과 불일치 |
| 빌더 팔레트 | 블록 버튼이 단순 텍스트 — 아이콘/시각적 구분 없음 |
| 공개 블록 | `FundraisingProgress`, `DonationQuickForm` 등이 `rose-500`, `bg-white` 하드코딩 — 다크테마 충돌 |
| 관리자 캠페인 목록 | 테이블만 있어 썸네일·상태를 한눈에 파악 불가 |

### 목표
- 빌더에서 편집하면서 즉시 결과를 볼 수 있는 분할 뷰
- 전체 화면에 NPO 디자인 토큰(`--accent`, `--surface` 등) 일관 적용
- 관리자 캠페인 목록을 카드 그리드로 개선

---

## 2. Phase별 변경 범위

### Phase A — 빌더 분할 미리보기 뷰

**핵심 아이디어**: 빌더 우측에 iframe 패널을 추가해 미리보기 URL(`/campaigns/[slug]/preview?token=...`)을 실시간으로 표시. 저장(autosave) 완료 시 iframe을 reload.

**레이아웃 변경**:
```
Before:
┌──────────┬──────────────────┬──────────────┐
│ Palette  │     Canvas       │  PropsPanel  │
│  (224px) │    (flex-1)      │   (320px)    │
└──────────┴──────────────────┴──────────────┘

After:
┌──────────┬────────────┬──────────────┬──────────────┐
│ Palette  │  Canvas    │  Preview     │  PropsPanel  │
│  (200px) │  (280px)   │  (flex-1)    │   (280px)    │
└──────────┴────────────┴──────────────┴──────────────┘
```

**동작 방식**:
1. Editor 마운트 시 `POST /api/admin/campaigns/[id]/preview-token` 호출 → 토큰 저장
2. iframe src = `/campaigns/[slug]/preview?token=[token]`
3. autosave 완료(saved) 시 `iframeRef.current?.contentWindow?.location.reload()` 호출
4. viewport 토글(데스크탑/모바일)이 iframe width에도 적용

**헤더 스타일 변경**:
- `bg-white` → `background: var(--surface)` + `border-color: var(--border)`
- 텍스트 색상 → `var(--text)`, `var(--muted-foreground)`
- 버튼 스타일 → 디자인 토큰 적용

**변경 파일**:
- `src/components/campaign-builder/Editor.tsx` — 분할 뷰, 토큰 로드, iframe ref, 헤더 스타일
- `src/components/campaign-builder/Canvas.tsx` — 빈 상태 메시지 스타일 개선
- `src/components/campaign-builder/Palette.tsx` — 블록 버튼에 아이콘 추가, 스타일 개선

---

### Phase B — 공개 블록 디자인 토큰 적용

**변경 파일 및 내용**:

| 파일 | 변경 내용 |
|------|-----------|
| `src/components/campaign-blocks/FundraisingProgress.tsx` | `rose-500` → `var(--accent)`, `neutral-200` → `var(--surface-2)`, `neutral-700/600` → `var(--text)/var(--muted-foreground)` |
| `src/components/campaign-blocks/DonationQuickForm.tsx` | `bg-white` → `var(--surface)`, 버튼 색상 → `var(--accent)`, 입력 border → `var(--border)` |
| `src/components/campaign-blocks/Hero.tsx` | CTA 버튼 `bg-white text-black` → `var(--accent) text-white` (브랜드 일관성) |
| `src/components/campaign-blocks/RichText.tsx` | prose 색상 `var(--text)` 적용 확인 |
| `src/components/campaign-blocks/SnsShare.tsx` | 버튼 스타일 다크테마 적용 |
| `src/components/campaign-blocks/ImpactStats.tsx` | 카드 배경 `var(--surface)`, 텍스트 토큰 적용 |
| `src/components/campaign-blocks/Faq.tsx` | 아코디언 배경/border 토큰 적용 |

---

### Phase C — 관리자 캠페인 목록 카드 그리드

**변경 내용**:
- 테이블 뷰 → 카드 그리드 (2열, md:3열)
- 카드: 썸네일 이미지 + 제목 + 상태 배지 + 기간 + 액션 버튼
- "새 캠페인" 버튼 강조 (accent 색상)
- 빈 상태: 일러스트 + 안내 문구

**변경 파일**:
- `src/components/admin/campaign-list.tsx` — 테이블 → 카드 그리드로 교체

---

## 3. 변경하지 않는 것

- 빌더의 블록 추가/삭제/순서 변경 로직
- autosave 2초 디바운스 로직
- 미리보기 토큰 API
- 공개 캠페인 페이지(`/campaigns/[slug]`) 레이아웃 전체 구조
- 관리자 캠페인 CRUD API

---

## 4. 엣지 케이스

| 상황 | 처리 |
|------|------|
| 토큰 발급 실패 | iframe 대신 "미리보기 불가" 메시지 표시 |
| iframe 로드 중 | 로딩 스피너 오버레이 |
| 모바일 뷰포트에서 분할 뷰 | iframe width를 390px로 고정, 나머지는 스크롤 |
| 캠페인 썸네일 없음 | 캠페인 카드에 placeholder 배경 표시 |

---

## 5. 범위 밖 (다음 Phase)

- 후원자 로그인/회원가입
- 후원 결제 플로우
- 후원자 마이페이지
