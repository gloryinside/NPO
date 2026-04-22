"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CampaignFormDialog } from "@/components/admin/campaign-form-dialog";
import type { Campaign } from "@/types/campaign";

type Props = {
  campaigns: Campaign[];
};

const STATUS_LABELS: Record<Campaign["status"], string> = {
  draft: "초안",
  active: "진행중",
  closed: "종료",
  archived: "보관됨",
};

function StatusBadge({ status }: { status: Campaign["status"] }) {
  const styles: Record<Campaign["status"], React.CSSProperties> = {
    draft: {
      background: "rgba(136,136,170,0.15)",
      color: "var(--muted-foreground)",
    },
    active: {
      background: "rgba(34,197,94,0.15)",
      color: "var(--positive)",
    },
    closed: {
      background: "rgba(245,158,11,0.15)",
      color: "var(--warning)",
    },
    archived: {
      background: "rgba(239,68,68,0.15)",
      color: "var(--negative)",
    },
  };

  return (
    <Badge style={styles[status]} className="border-0 font-medium">
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export function CampaignList({ campaigns: initialCampaigns }: Props) {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>(initialCampaigns);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Campaign | undefined>(undefined);

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

  const handleNew = () => {
    setEditTarget(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (campaign: Campaign) => {
    setEditTarget(campaign);
    setDialogOpen(true);
  };

  const handlePageEdit = useCallback((id: string) => {
    router.push(`/admin/campaigns/${id}/edit`);
  }, [router]);

  const handleArchive = async (campaign: Campaign) => {
    if (!confirm(`"${campaign.title}" 캠페인을 보관하시겠습니까?`)) return;
    try {
      await fetch(`/api/admin/campaigns/${campaign.id}`, { method: "DELETE" });
      await refresh();
    } catch {
      // silently fail
    }
  };

  const formattedGoal = (amount: number | null) =>
    amount != null
      ? new Intl.NumberFormat("ko-KR").format(amount) + "원"
      : "-";

  const dateRange = (c: Campaign) => {
    if (c.started_at && c.ended_at) return `${c.started_at} ~ ${c.ended_at}`;
    if (c.started_at) return `${c.started_at} ~`;
    if (c.ended_at) return `~ ${c.ended_at}`;
    return "-";
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
          캠페인 관리
        </h1>
        <Button
          onClick={handleNew}
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          새 캠페인
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-20 text-center"
          style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
        >
          <span className="mb-3 text-5xl">📋</span>
          <p className="text-base font-medium">등록된 캠페인이 없습니다.</p>
          <p className="mt-1 text-sm">위의 '새 캠페인' 버튼으로 첫 번째 캠페인을 만들어보세요.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {campaigns.map((campaign) => (
            <div
              key={campaign.id}
              className="flex flex-col overflow-hidden rounded-xl border transition-shadow hover:shadow-md"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            >
              {/* Thumbnail */}
              <div className="relative h-36 w-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
                {campaign.thumbnail_url ? (
                  <Image src={campaign.thumbnail_url} alt={campaign.title} fill className="object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-4xl">📣</div>
                )}
              </div>

              {/* Body */}
              <div className="flex flex-1 flex-col p-4">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h3 className="line-clamp-2 text-sm font-semibold leading-snug" style={{ color: "var(--text)" }}>
                    {campaign.title}
                  </h3>
                  <StatusBadge status={campaign.status} />
                </div>
                <p className="mb-1 font-mono text-xs" style={{ color: "var(--muted-foreground)" }}>
                  {campaign.slug}
                </p>
                <p className="mb-3 text-xs" style={{ color: "var(--muted-foreground)" }}>
                  {dateRange(campaign)}
                </p>
                {campaign.goal_amount != null && (
                  <p className="mb-3 text-xs font-medium" style={{ color: "var(--text)" }}>
                    목표 {formattedGoal(campaign.goal_amount)}
                  </p>
                )}

                {/* Actions */}
                <div className="mt-auto flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => handlePageEdit(campaign.id)}
                    style={{ background: "var(--accent)", color: "#fff" }}
                  >
                    페이지 편집
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    onClick={() => handleEdit(campaign)}
                    style={{ borderColor: "var(--border)", color: "var(--text)" }}
                  >
                    수정
                  </Button>
                  {/* G-90: 리포트 페이지 진입점 — closed 캠페인에서 가장 유용하지만 active도 실시간 지표 확인 가능 */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    onClick={() => router.push(`/admin/campaigns/${campaign.id}/report`)}
                    disabled={campaign.status === "draft"}
                    style={{ borderColor: "var(--border)", color: "var(--accent)" }}
                  >
                    📊 리포트
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    onClick={() => handleArchive(campaign)}
                    disabled={campaign.status === "archived"}
                    style={{ borderColor: "var(--border)", color: "var(--negative)" }}
                  >
                    보관
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <CampaignFormDialog
        campaign={editTarget}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={refresh}
      />
    </div>
  );
}
