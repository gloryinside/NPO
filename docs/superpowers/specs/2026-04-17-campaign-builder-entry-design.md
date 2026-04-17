# Phase 1 — 캠페인 빌더 진입 플로우 설계

**작성일**: 2026-04-17
**범위**: 관리자가 캠페인을 생성하고 페이지 빌더로 진입하는 플로우
**상위 프로젝트**: NPO 후원관리시스템

---

## 1. 배경 및 목표

### 현재 문제

- `/admin/campaigns/[id]/edit` 경로에 빌더가 구현되어 있으나 진입 경로가 없음
- "새 캠페인" 생성 후 저장하면 목록을 새로고침할 뿐, 빌더로 이동하지 않음
- 기존 캠페인에서 빌더를 열려면 URL을 직접 타이핑해야 함

### 목표

관리자가 캠페인을 생성하거나 기존 캠페인을 선택했을 때, **빌더로 자연스럽게 진입**할 수 있도록 플로우를 연결한다.

---

## 2. 사용자 플로우

### 신규 캠페인 생성

```
캠페인 목록 → "새 캠페인" 버튼 클릭
→ CampaignFormDialog 열림 (기본 정보 입력)
→ "생성" 버튼 클릭 → POST /api/admin/campaigns
→ 성공 시 → router.push('/admin/campaigns/[newId]/edit')
→ 빌더 화면 진입
```

### 기존 캠페인 빌더 진입

```
캠페인 목록 → 해당 행의 "페이지 편집" 버튼 클릭
→ /admin/campaigns/[id]/edit 로 이동
→ 빌더 화면 진입
```

### 기존 캠페인 기본 정보 수정 (기존 유지)

```
캠페인 목록 → 해당 행의 "수정" 버튼 클릭
→ CampaignFormDialog 열림 (기존 값 채워짐)
→ 수정 후 저장 → 목록 새로고침 (기존 동작 유지)
```

---

## 3. 변경 파일

### 3-1. `src/components/admin/campaign-form-dialog.tsx`

**변경 내용**: `onSuccess` 콜백 시그니처 변경

```ts
// Before
onSuccess: () => void

// After
onSuccess: (newCampaignId?: string) => void
```

- 신규 생성(`isEdit === false`) 성공 시: API 응답의 `campaign.id`를 `onSuccess(id)`로 전달
- 수정(`isEdit === true`) 성공 시: 기존과 동일하게 `onSuccess()` 호출 (인자 없음)

### 3-2. `src/components/admin/campaign-list.tsx`

**변경 내용 1**: `onSuccess` 핸들러에서 `newCampaignId` 수신 시 빌더로 이동

```ts
// useRouter 추가
const router = useRouter();

const refresh = useCallback(async (newCampaignId?: string) => {
  if (newCampaignId) {
    router.push(`/admin/campaigns/${newCampaignId}/edit`);
    return;
  }
  // 기존 목록 새로고침 로직
}, [router]);
```

**변경 내용 2**: 캠페인 행 액션 버튼에 "페이지 편집" 추가

```tsx
// 기존: "수정" + "보관"
// 변경: "수정" + "페이지 편집" + "보관"

<Button
  size="sm"
  variant="outline"
  onClick={() => router.push(`/admin/campaigns/${campaign.id}/edit`)}
>
  페이지 편집
</Button>
```

---

## 4. 변경하지 않는 것

- `CampaignFormDialog` 내부 폼 필드 — 변경 없음
- API (`/api/admin/campaigns`) — 변경 없음 (이미 `id` 포함 응답 반환)
- 빌더 자체 (`Editor`, `Canvas`, `Palette` 등) — 변경 없음
- 수정 모드의 `onSuccess` 동작 (목록 새로고침) — 변경 없음

---

## 5. 엣지 케이스

| 상황 | 처리 |
|------|------|
| 생성 API 실패 | 기존과 동일하게 에러 메시지 표시, 이동하지 않음 |
| 생성 성공 후 빌더 페이지 404 | `[id]/edit/page.tsx`의 `notFound()` 처리로 커버됨 |
| "페이지 편집" 클릭 후 빌더 접근 권한 없음 | `requireAdminUser()` 가드로 커버됨 |

---

## 6. 범위 밖 (다음 Phase)

- Phase 2: 후원자 공개 랜딩페이지 렌더링
- Phase 3: 후원 결제 플로우
- Phase 4: 후원자 로그인/회원가입
- Phase 5: 후원자 마이페이지 (납부내역, 기부금영수증)
