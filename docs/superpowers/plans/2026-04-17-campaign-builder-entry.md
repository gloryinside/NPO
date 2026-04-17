# Campaign Builder Entry Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자가 캠페인을 생성하면 자동으로 빌더로 이동하고, 기존 캠페인 목록에서 "페이지 편집" 버튼으로 빌더에 직접 진입할 수 있게 한다.

**Architecture:** `CampaignFormDialog`의 `onSuccess` 콜백을 `(newCampaignId?: string) => void`로 변경해 신규 생성 시 id를 전달하고, `CampaignList`에서 id를 수신하면 `router.push`로 빌더로 이동한다. 기존 캠페인 행에는 빌더 직접 진입 버튼을 추가한다.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, vitest + jsdom (unit tests)

---

## File Map

| 역할 | 파일 | 변경 유형 |
|------|------|-----------|
| 캠페인 생성/수정 다이얼로그 | `src/components/admin/campaign-form-dialog.tsx` | Modify |
| 캠페인 목록 + 액션 버튼 | `src/components/admin/campaign-list.tsx` | Modify |
| 다이얼로그 단위 테스트 | `tests/unit/campaign-form-dialog.test.tsx` | Create |
| 목록 단위 테스트 | `tests/unit/campaign-list.test.tsx` | Create |

---

## Task 1: CampaignFormDialog — onSuccess 시그니처 변경 및 id 전달

**Files:**
- Modify: `src/components/admin/campaign-form-dialog.tsx`
- Create: `tests/unit/campaign-form-dialog.test.tsx`

### 배경

`CampaignFormDialog`의 `Props` 타입에서 `onSuccess: () => void`를 `onSuccess: (newCampaignId?: string) => void`로 바꾼다. 신규 생성 성공 시 API 응답의 `campaign.id`를 인자로 넘기고, 수정 성공 시에는 인자 없이 호출한다.

---

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/unit/campaign-form-dialog.test.tsx` 파일을 새로 만든다.

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CampaignFormDialog } from "@/components/admin/campaign-form-dialog";

// fetch를 vi.fn()으로 대체
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CampaignFormDialog — 신규 생성", () => {
  it("생성 성공 시 onSuccess에 새 캠페인 id를 전달한다", async () => {
    const newId = "campaign-uuid-123";
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ campaign: { id: newId } }),
    });

    const onSuccess = vi.fn();
    render(
      <CampaignFormDialog
        open={true}
        onOpenChange={vi.fn()}
        onSuccess={onSuccess}
      />
    );

    // 필수 필드 입력
    fireEvent.change(screen.getByLabelText("캠페인 제목"), {
      target: { value: "테스트 캠페인" },
    });
    fireEvent.change(screen.getByLabelText("슬러그 (URL)"), {
      target: { value: "test-campaign" },
    });

    fireEvent.click(screen.getByRole("button", { name: "생성" }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(newId);
    });
  });
});

describe("CampaignFormDialog — 수정", () => {
  it("수정 성공 시 onSuccess를 인자 없이 호출한다", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ campaign: { id: "existing-id" } }),
    });

    const onSuccess = vi.fn();
    const existingCampaign = {
      id: "existing-id",
      org_id: "org-1",
      title: "기존 캠페인",
      slug: "existing",
      description: null,
      goal_amount: null,
      status: "draft" as const,
      started_at: null,
      ended_at: null,
      thumbnail_url: null,
      donation_type: "both" as const,
      preset_amounts: null,
      pay_methods: null,
      ga_tracking_id: null,
      meta_pixel_id: null,
      page_content: null,
      published_content: null,
      form_settings: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    render(
      <CampaignFormDialog
        campaign={existingCampaign}
        open={true}
        onOpenChange={vi.fn()}
        onSuccess={onSuccess}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "수정" }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(/* no args */);
      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(onSuccess.mock.calls[0][0]).toBeUndefined();
    });
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd /Users/gloryinside/NPO_S
npx vitest run tests/unit/campaign-form-dialog.test.tsx --reporter=verbose
```

Expected: FAIL — `onSuccess` 타입 불일치 또는 id 미전달

- [ ] **Step 3: CampaignFormDialog Props 타입 및 handleSubmit 수정**

`src/components/admin/campaign-form-dialog.tsx`에서 아래 두 곳을 수정한다.

**Props 타입 변경** (파일 상단 `Props` 타입):
```ts
// Before
type Props = {
  campaign?: Campaign;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

// After
type Props = {
  campaign?: Campaign;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (newCampaignId?: string) => void;
};
```

**handleSubmit 내 onSuccess 호출 변경** — 신규 생성 성공 분기를 찾아서:
```ts
// Before (신규 생성 성공 분기)
if (res.ok) {
  onOpenChange(false);
  onSuccess();
}

// After
if (res.ok) {
  const data = await res.json();
  onOpenChange(false);
  if (!isEdit) {
    onSuccess(data.campaign?.id);
  } else {
    onSuccess();
  }
}
```

> 주의: 기존 코드에서 `res.json()`을 이미 호출하는 경우 중복 호출하지 않도록 확인한다. 현재 다이얼로그 코드는 성공 시 `res.json()`을 호출하지 않으므로 위 코드를 그대로 적용한다.

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
npx vitest run tests/unit/campaign-form-dialog.test.tsx --reporter=verbose
```

Expected: PASS (2 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/components/admin/campaign-form-dialog.tsx tests/unit/campaign-form-dialog.test.tsx
git commit -m "feat: CampaignFormDialog — 신규 생성 시 onSuccess에 id 전달"
```

---

## Task 2: CampaignList — 빌더 이동 및 "페이지 편집" 버튼 추가

**Files:**
- Modify: `src/components/admin/campaign-list.tsx`
- Create: `tests/unit/campaign-list.test.tsx`

### 배경

`CampaignList`에서 두 가지를 추가한다:
1. `refresh(newCampaignId?: string)` — id가 있으면 `router.push`로 빌더 이동, 없으면 기존 목록 새로고침
2. 각 캠페인 행 액션 버튼에 "페이지 편집" 추가 — `router.push('/admin/campaigns/[id]/edit')`

---

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/unit/campaign-list.test.tsx` 파일을 새로 만든다.

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CampaignList } from "@/components/admin/campaign-list";
import type { Campaign } from "@/types/campaign";

// next/navigation mock
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/admin/campaigns",
}));

// next/link mock
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const baseCampaign: Campaign = {
  id: "camp-1",
  org_id: "org-1",
  title: "테스트 캠페인",
  slug: "test-campaign",
  description: null,
  goal_amount: null,
  status: "draft",
  started_at: null,
  ended_at: null,
  thumbnail_url: null,
  donation_type: "both",
  preset_amounts: null,
  pay_methods: null,
  ga_tracking_id: null,
  meta_pixel_id: null,
  page_content: null,
  published_content: null,
  form_settings: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CampaignList — 페이지 편집 버튼", () => {
  it("캠페인 행에 '페이지 편집' 버튼이 렌더링된다", () => {
    render(<CampaignList campaigns={[baseCampaign]} />);
    expect(screen.getByRole("button", { name: "페이지 편집" })).toBeInTheDocument();
  });

  it("'페이지 편집' 클릭 시 빌더 경로로 이동한다", () => {
    render(<CampaignList campaigns={[baseCampaign]} />);
    fireEvent.click(screen.getByRole("button", { name: "페이지 편집" }));
    expect(mockPush).toHaveBeenCalledWith("/admin/campaigns/camp-1/edit");
  });
});

describe("CampaignList — 신규 생성 후 빌더 이동", () => {
  it("onSuccess가 newCampaignId와 함께 호출되면 빌더로 이동한다", async () => {
    // CampaignFormDialog의 onSuccess를 직접 트리거하기 위해
    // "새 캠페인" 버튼 클릭 후 다이얼로그가 열리는 것을 확인하고
    // refresh를 직접 호출하는 방식으로 테스트한다.
    // refresh는 CampaignList 내부 함수이므로 버튼 클릭 → 다이얼로그 열림을 확인한다.
    render(<CampaignList campaigns={[]} />);
    // "새 캠페인" 버튼이 있어야 한다
    const newBtn = screen.getByRole("button", { name: "새 캠페인" });
    expect(newBtn).toBeInTheDocument();
    fireEvent.click(newBtn);
    // 다이얼로그가 열린다 (다이얼로그 제목 확인)
    expect(screen.getByText("새 캠페인 만들기")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
npx vitest run tests/unit/campaign-list.test.tsx --reporter=verbose
```

Expected: FAIL — "페이지 편집" 버튼 없음

- [ ] **Step 3: CampaignList 수정**

`src/components/admin/campaign-list.tsx` 에서 아래 세 곳을 수정한다.

**1) import에 `useRouter` 추가** (파일 최상단):
```tsx
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
// ... 기존 import 유지
```

**2) 컴포넌트 내부 상단에 `router` 선언 추가**:
```tsx
export function CampaignList({ campaigns: initialCampaigns }: Props) {
  const router = useRouter();  // 추가
  const [campaigns, setCampaigns] = useState<Campaign[]>(initialCampaigns);
  // ... 이하 동일
```

**3) `refresh` 함수 시그니처 및 분기 수정**:
```tsx
// Before
const refresh = useCallback(async () => {
  try {
    const res = await fetch("/api/admin/campaigns");
    if (res.ok) {
      const data = await res.json();
      setCampaigns(data.campaigns ?? []);
    }
  } catch {
    // silently fail refresh
  }
}, []);

// After
const refresh = useCallback(async (newCampaignId?: string) => {
  if (newCampaignId) {
    router.push(`/admin/campaigns/${newCampaignId}/edit`);
    return;
  }
  try {
    const res = await fetch("/api/admin/campaigns");
    if (res.ok) {
      const data = await res.json();
      setCampaigns(data.campaigns ?? []);
    }
  } catch {
    // silently fail refresh
  }
}, [router]);
```

**4) 각 캠페인 행 액션 버튼에 "페이지 편집" 추가** — 기존 "수정"/"보관" 버튼 사이에 삽입:
```tsx
<div className="flex items-center justify-end gap-2">
  <Button
    size="sm"
    variant="outline"
    onClick={() => handleEdit(campaign)}
    style={{
      borderColor: "var(--border)",
      color: "var(--text)",
    }}
  >
    수정
  </Button>
  {/* 추가 */}
  <Button
    size="sm"
    variant="outline"
    onClick={() => router.push(`/admin/campaigns/${campaign.id}/edit`)}
    style={{
      borderColor: "var(--border)",
      color: "var(--text)",
    }}
  >
    페이지 편집
  </Button>
  <Button
    size="sm"
    variant="outline"
    onClick={() => handleArchive(campaign)}
    disabled={campaign.status === "archived"}
    style={{
      borderColor: "var(--border)",
      color: "var(--negative)",
    }}
  >
    보관
  </Button>
</div>
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
npx vitest run tests/unit/campaign-list.test.tsx --reporter=verbose
```

Expected: PASS (3 tests)

- [ ] **Step 5: 전체 unit 테스트 실행 — 회귀 없음 확인**

```bash
npx vitest run --project=unit --reporter=verbose
```

Expected: 모든 기존 테스트 포함 PASS

- [ ] **Step 6: 커밋**

```bash
git add src/components/admin/campaign-list.tsx tests/unit/campaign-list.test.tsx
git commit -m "feat: CampaignList — 신규 생성 후 빌더 이동 및 페이지 편집 버튼 추가"
```

---

## Task 3: 수동 검증

- [ ] **Step 1: 개발 서버 실행**

```bash
npm run dev
```

- [ ] **Step 2: 새 캠페인 생성 플로우 확인**

1. `http://localhost:3000/admin/campaigns` 접속
2. "새 캠페인" 버튼 클릭
3. 제목, 슬러그 입력 후 "생성" 클릭
4. **기대**: `/admin/campaigns/[새id]/edit` 빌더 화면으로 자동 이동

- [ ] **Step 3: 기존 캠페인 페이지 편집 버튼 확인**

1. 캠페인 목록에서 기존 캠페인 행 확인
2. "페이지 편집" 버튼 클릭
3. **기대**: `/admin/campaigns/[id]/edit` 빌더 화면으로 이동

- [ ] **Step 4: 수정 플로우 회귀 확인**

1. "수정" 버튼 클릭
2. **기대**: 기존과 동일하게 `CampaignFormDialog` 열림, 저장 후 목록 새로고침 (빌더로 이동 안 함)

- [ ] **Step 5: 최종 커밋 (필요 시)**

```bash
git add -A
git commit -m "chore: Phase 1 수동 검증 완료"
```
