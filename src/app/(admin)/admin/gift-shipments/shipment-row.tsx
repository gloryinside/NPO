"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Props {
  row: {
    id: string;
    gift_name: string;
    trigger_value: number | null;
    status: string;
    shipping_address: string | null;
    tracking_no: string | null;
    shipped_at: string | null;
    members: { name: string | null; phone: string | null; address_full: string | null } | null;
  };
}

export function ShipmentRow({ row }: Props) {
  const router = useRouter();
  const [shippingAddress, setShippingAddress] = useState(
    row.shipping_address ?? row.members?.address_full ?? "",
  );
  const [trackingNo, setTrackingNo] = useState(row.tracking_no ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function update(action: "preparing" | "shipped" | "skipped") {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/gift-shipments/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: action,
          shippingAddress: action === "shipped" ? shippingAddress : undefined,
          trackingNo: action === "shipped" ? trackingNo : undefined,
        }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? "실패");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border p-4"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--text)]">
            {row.members?.name ?? "(이름 없음)"} — {row.gift_name}
          </p>
          <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
            {row.members?.phone ?? ""}
            {row.trigger_value != null && (
              <span className="ml-2">달성값: {Number(row.trigger_value).toLocaleString("ko-KR")}</span>
            )}
          </p>
        </div>
        {row.shipped_at && (
          <span className="text-xs" style={{ color: "var(--positive)" }}>
            발송 {new Date(row.shipped_at).toLocaleDateString("ko-KR")}
            {row.tracking_no && ` · 운송장 ${row.tracking_no}`}
          </span>
        )}
      </div>

      {row.status !== "shipped" && row.status !== "skipped" && (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input
            value={shippingAddress}
            onChange={(e) => setShippingAddress(e.target.value)}
            placeholder="배송 주소"
            className="rounded-md border bg-[var(--surface)] px-3 py-2 text-sm"
            style={{ borderColor: "var(--border)", color: "var(--text)" }}
          />
          <input
            value={trackingNo}
            onChange={(e) => setTrackingNo(e.target.value)}
            placeholder="운송장 번호"
            className="rounded-md border bg-[var(--surface)] px-3 py-2 text-sm"
            style={{ borderColor: "var(--border)", color: "var(--text)" }}
          />
        </div>
      )}

      {row.status !== "shipped" && row.status !== "skipped" && (
        <div className="mt-3 flex gap-2">
          {row.status === "queued" && (
            <button type="button" onClick={() => update("preparing")} disabled={isPending}
              className="rounded-md border px-3 py-1.5 text-xs font-medium disabled:opacity-50"
              style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}>
              준비중으로
            </button>
          )}
          <button type="button" onClick={() => update("shipped")} disabled={isPending || !shippingAddress}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            style={{ background: "var(--accent)" }}>
            발송 완료
          </button>
          <button type="button" onClick={() => update("skipped")} disabled={isPending}
            className="rounded-md border px-3 py-1.5 text-xs font-medium disabled:opacity-50"
            style={{ borderColor: "var(--border)", color: "var(--muted-foreground)", background: "var(--surface)" }}>
            제외
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-xs" style={{ color: "var(--negative)" }}>{error}</p>}
    </div>
  );
}
