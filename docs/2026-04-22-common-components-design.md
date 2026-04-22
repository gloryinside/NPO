# 후원금 관리 시스템 공통 컴포넌트 5종 설계 스펙

## 1. 배경 및 목적

관리자·후원자 페이지마다 헤더·KPI 카드·필터·테이블·상세 패널 스타일이 제각각이라 일관성과 재사용성이 부족함. 5개 공통 컴포넌트를 `src/components/common/` 하위에 도입하여 후원금 관리 시스템 전체 UX를 수평적으로 고도화한다.

## 2. 결정 사항

| 항목 | 결정 | 근거 |
|------|------|------|
| PageHeader 레이아웃 | 통합형 (제목 + KPI 스트립 + 액션 + 탭) | 후원금 업무 특성상 지표·상태 전환·액션이 한 상단 컨텍스트에 모이는 것이 생산성 ↑ |
| StatCard 표현 | 증감 표시형 (값 + 전월 대비 delta) | "지금 잘 되고 있는가"를 한눈에 판단 |
| FilterBar 레이아웃 | 두 줄형 (상단 탭, 하단 필터) | 탭=상태 구분, 필터=세부 조건 역할 분리 |
| DataTable 밀도 | 컴팩트 + 호버 액션 | 한 화면 20+행, 업무 시스템 최적 |
| DetailDrawer | 우측 슬라이드 520px | 목록 유지하며 상세 확인, 순차 탐색 최적 |

## 3. 아키텍처

### 파일 구조

```
src/components/common/
├── page-header.tsx          # 제목 + KPI 스트립 + 액션 + 탭
├── stat-card.tsx            # 값 + 증감 표시
├── filter-bar.tsx           # 검색 + 필터 + 초기화 (+ FilterDropdown 별도 export)
├── data-table.tsx           # 컴팩트 + 호버 액션 + 선택 + 빈상태/로딩
└── detail-drawer.tsx        # 우측 슬라이드 패널
```

### 의존성 방향 (단방향)

- `PageHeader` → 내부에서 `stats` 슬롯에 `<StatCard>`를 composition으로 받음
- `PageHeader`와 `FilterBar`는 독립 (페이지가 나란히 배치)
- `DataTable`과 `DetailDrawer`는 독립 (페이지가 `state`로 연결)

각 컴포넌트는 **독립적으로 테스트·사용 가능**. PageHeader 내부 탭·stats는 선택적 prop.

## 4. 컴포넌트 인터페이스

### 4-1. PageHeader

```typescript
export interface PageHeaderTab {
  key: string;
  label: string;
  count?: number;
  href: string;
}

export interface PageHeaderProps {
  title: string;
  description?: string;
  stats?: ReactNode;      // <StatCard> 여러 개를 외부에서 composition
  actions?: ReactNode;    // 우측 버튼들
  tabs?: PageHeaderTab[];
  activeTab?: string;
}
```

렌더 순서: `title + description + actions` → `stats 스트립` → `tabs`. 모든 slot optional.

### 4-2. StatCard

```typescript
export interface StatCardDelta {
  value: string;           // "+946,300원" 또는 "3건"
  direction: 'up' | 'down' | 'flat';
  tone: 'positive' | 'negative' | 'neutral';  // 의미적 색상
}

export interface StatCardProps {
  label: string;             // "당월 수납"
  value: string;             // "12,450,000원"
  delta?: StatCardDelta;
  hint?: string;             // "전월 대비"
  tone?: 'default' | 'negative' | 'warning';  // 값 자체 색상 강조
}
```

표시 규칙:
- `delta.direction = 'up'` → `▲`, `'down'` → `▼`, `'flat'` → `―`
- `delta.tone`은 배지 배경/텍스트 색 결정 (positive=green, negative=red, neutral=muted)
- `tone='negative'`이면 `value` 자체가 빨간색 (미납 카드 등)

### 4-3. FilterBar + FilterDropdown

```typescript
export interface FilterBarProps {
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (v: string) => void;
  filters?: ReactNode;         // <FilterDropdown>들을 composition
  onReset?: () => void;
  hasActiveFilters?: boolean;
}

export interface FilterDropdownOption<V extends string> {
  value: V;
  label: string;
}

export interface FilterDropdownProps<V extends string> {
  label: string;                       // "이번 달"
  value: V | null;
  options: FilterDropdownOption<V>[];
  onChange: (v: V | null) => void;     // null = "전체"
  allowClear?: boolean;
}
```

`FilterDropdown`은 `filter-bar.tsx` 내에서 별도 named export. 재사용 편의.

### 4-4. DataTable

```typescript
export interface DataTableColumn<T> {
  key: string;
  header: string;
  align?: 'left' | 'right' | 'center';
  width?: string;               // "120px", "20%"
  render: (row: T) => ReactNode;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  isLoading?: boolean;
  emptyMessage?: string;        // default: "데이터가 없습니다."
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  rowActions?: (row: T) => ReactNode;  // 호버 시 우측 fade-in
  onRowClick?: (row: T) => void;       // 행 클릭 (드로어 연결)
}
```

렌더 규칙:
- `isLoading=true` → 5행 스켈레톤
- `rows.length === 0` → 중앙 정렬 `emptyMessage`
- `selectable=true` → 첫 컬럼에 체크박스 추가 (헤더 = 전체 선택)
- `rowActions` 반환 → 마지막 셀에 고정 너비 80px, `opacity-0 group-hover:opacity-100 transition`
- `onRowClick` 지정 시 행 `cursor-pointer`, 체크박스·rowActions 클릭은 `stopPropagation`

### 4-5. DetailDrawer

```typescript
export interface DetailDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;              // default 520
}
```

구조:
- 반투명 배경(`bg-black/40`) + 우측 고정 패널
- 헤더: 제목/부제 + ✕ 버튼
- 본문: 스크롤 가능 영역
- 푸터(optional): 하단 고정, `border-top`

닫기 트리거: ✕ / ESC / 오버레이 클릭. `useEffect`로 ESC 이벤트 바인딩.

## 5. 스타일 가드레일

모든 컴포넌트는 CSS 변수만 사용 (하드코딩 색상 0).

### 색상

| 용도 | 클래스 |
|------|--------|
| 카드/패널 배경 | `bg-[var(--surface)]` |
| 카드 경계 | `border-[var(--border)]` |
| 테이블 헤더/강조 행 | `bg-[var(--surface-2)]` |
| 드로어 오버레이 | `bg-black/40` |
| 기본 텍스트 | `text-[var(--text)]` |
| 보조 텍스트 | `text-[var(--muted-foreground)]` |
| 의미색 | `text-[var(--positive\|negative\|warning\|accent)]` |

### 의미색 배지 (StatCard delta, DataTable 상태)

| tone | 배경 | 텍스트 |
|------|------|--------|
| positive | `bg-[var(--positive-soft)]` | `text-[var(--positive)]` |
| negative | `bg-[var(--negative-soft)]` | `text-[var(--negative)]` |
| warning | `bg-[var(--warning-soft)]` | `text-[var(--warning)]` |
| accent | `bg-[var(--accent-soft)]` | `text-[var(--accent)]` |

### 타이포

| 요소 | 스타일 |
|------|--------|
| StatCard 라벨 | `text-[11px] uppercase tracking-[0.5px]` |
| StatCard 값 | `text-[22px] font-bold` |
| StatCard delta | `text-[11px]` |
| PageHeader title | `text-[20px] font-bold` |
| PageHeader description | `text-[13px]` |
| DataTable 본문 | `text-[13px]` |
| 탭/필터 컨트롤 | `text-[13px]` |

### 간격

- PageHeader 내부 섹션 간: `gap-4`
- DataTable 행 패딩: `py-[7px] px-3`
- Drawer 패딩: `p-5`

라이트/다크 모드는 CSS 변수가 자동 처리. 컴포넌트 코드에 테마 분기 없음.

## 6. 테스트 전략

12 unit tests (vitest):

| 파일 | 테스트 수 | 내용 |
|------|:---:|------|
| `tests/unit/common/stat-card.test.tsx` | 3 | direction별 기호 렌더 / tone별 className / delta 미지정 시 배지 숨김 |
| `tests/unit/common/filter-bar.test.tsx` | 2 | `hasActiveFilters=false` 시 초기화 숨김 / `onReset` 호출 |
| `tests/unit/common/data-table.test.tsx` | 3 | 빈 배열 → emptyMessage / `isLoading` → 스켈레톤 / 선택 체크박스 토글 |
| `tests/unit/common/detail-drawer.test.tsx` | 2 | `open=false`일 때 렌더 안 함 / ESC 누르면 `onClose` 호출 |
| `tests/unit/common/page-header.test.tsx` | 2 | stats·tabs 미지정 시 해당 영역 숨김 / tabs 지정 시 탭 렌더 |

시각적 검증 (드로어 슬라이드 애니메이션, 호버 fade-in)은 Playwright 수동 확인.

## 7. 적용 페이지 (1차 범위)

| 페이지 | PageHeader | StatCard 수 | FilterBar | DataTable | DetailDrawer |
|--------|:---:|:---:|:---:|:---:|:---:|
| `/admin` | ✅ (title+desc) | 4 (기존 KPI 재배치) | ❌ | ❌ | ❌ |
| `/admin/payments` | ✅ + tabs | 4 (당월수납/미납/CMS성공률/수입대기) | ✅ | ✅ | ✅ (납입 상세) |
| `/admin/promises` | ✅ + tabs | 3 (활성/해지예정/연체) | ✅ | ✅ | ✅ (약정 상세) |
| `/admin/members` | ✅ + tabs | 3 (활성/신규/이탈위험) | ✅ | ✅ | ✅ (회원 360°) |

**2차 (별도 스펙)**: `/admin/receipts`, `/admin/stats`, `/admin/unpaid`, donor 페이지들. 1차 검증 후 확장.

## 8. 제외 범위 (YAGNI)

- 컬럼 헤더 클릭 정렬 (서버사이드 정렬로 충분)
- 페이지네이션 UI 표준화 (기존 range 방식 유지)
- 테마 variant (CSS 변수로 자동 처리)
- 드래그 앤 드롭 행 순서 변경 (요구사항 없음)

## 9. 수동 QA 체크리스트

- [ ] PageHeader 통합형이 /admin/payments 등에서 올바르게 렌더
- [ ] StatCard 증감 배지 색상 (positive=green, negative=red) 정상
- [ ] FilterBar의 초기화 버튼이 필터 활성 시에만 노출
- [ ] DataTable 호버 시 액션 버튼 fade-in
- [ ] DataTable 빈 상태/로딩 상태 메시지 정상
- [ ] DataTable 체크박스 전체 선택/해제 토글 정상
- [ ] DetailDrawer 우측 슬라이드 애니메이션 자연스러움
- [ ] DetailDrawer ESC 키·오버레이 클릭·✕ 버튼 모두 닫힘
- [ ] 라이트/다크 테마 양쪽에서 모든 컴포넌트 가독성 확보
- [ ] 모바일 폭(~375px)에서 레이아웃 깨짐 없음
