import { describe, it, expect, vi } from "vitest";
import { getDashboardSnapshot } from "@/lib/donor/dashboard-snapshot";
import type { DonorDashboardSnapshot } from "@/types/dashboard";

const emptySnapshot: DonorDashboardSnapshot = {
  active_promises: [],
  recent_payments: [],
  latest_receipt: null,
  total_paid: 120000,
  upcoming_payments: [],
  expiring_cards: [],
  action_failed_count: 0,
  action_rrn_count: 0,
  action_changes_count: 0,
  streak: 3,
};

describe("getDashboardSnapshot", () => {
  it("calls the RPC with org and member ids and returns the snapshot", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: emptySnapshot, error: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = { rpc } as any;

    const result = await getDashboardSnapshot(supabase, "org-1", "mem-1");

    expect(result).toEqual(emptySnapshot);
    expect(rpc).toHaveBeenCalledWith("get_donor_dashboard_snapshot", {
      p_org_id: "org-1",
      p_member_id: "mem-1",
    });
  });

  it("returns null when the RPC errors", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: null, error: new Error("db error") });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = { rpc } as any;

    expect(await getDashboardSnapshot(supabase, "org-1", "mem-1")).toBeNull();
  });

  it("returns null when the RPC returns no data", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = { rpc } as any;

    expect(await getDashboardSnapshot(supabase, "org-1", "mem-1")).toBeNull();
  });
});
