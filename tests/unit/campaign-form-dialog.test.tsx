import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CampaignFormDialog } from "@/components/admin/campaign-form-dialog";

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

    fireEvent.change(screen.getByLabelText(/제목/), {
      target: { value: "테스트 캠페인" },
    });
    fireEvent.change(screen.getByLabelText(/슬러그/), {
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
      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(onSuccess.mock.calls[0][0]).toBeUndefined();
    });
  });
});
