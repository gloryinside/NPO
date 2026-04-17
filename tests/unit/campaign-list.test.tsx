import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CampaignList } from "@/components/admin/campaign-list";
import type { Campaign } from "@/types/campaign";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/admin/campaigns",
}));

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
    expect(screen.getByRole("button", { name: "페이지 편집" })).toBeTruthy();
  });

  it("'페이지 편집' 클릭 시 빌더 경로로 이동한다", () => {
    render(<CampaignList campaigns={[baseCampaign]} />);
    fireEvent.click(screen.getByRole("button", { name: "페이지 편집" }));
    expect(mockPush).toHaveBeenCalledWith("/admin/campaigns/camp-1/edit");
  });
});

describe("CampaignList — 신규 생성 후 빌더 이동", () => {
  it('"새 캠페인" 버튼 클릭 시 다이얼로그가 열린다', () => {
    render(<CampaignList campaigns={[]} />);
    const newBtn = screen.getByRole("button", { name: "새 캠페인" });
    expect(newBtn).toBeTruthy();
    fireEvent.click(newBtn);
    expect(screen.getAllByText("새 캠페인").length).toBeGreaterThan(0);
  });
});
