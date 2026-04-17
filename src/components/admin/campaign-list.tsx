"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

      <div
        className="rounded-lg border overflow-hidden"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <Table>
          <TableHeader>
            <TableRow style={{ borderColor: "var(--border)" }}>
              <TableHead style={{ color: "var(--muted-foreground)" }}>
                제목
              </TableHead>
              <TableHead style={{ color: "var(--muted-foreground)" }}>
                슬러그
              </TableHead>
              <TableHead style={{ color: "var(--muted-foreground)" }}>
                상태
              </TableHead>
              <TableHead style={{ color: "var(--muted-foreground)" }}>
                목표금액
              </TableHead>
              <TableHead style={{ color: "var(--muted-foreground)" }}>
                기간
              </TableHead>
              <TableHead
                style={{ color: "var(--muted-foreground)" }}
                className="text-right"
              >
                액션
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center py-12"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  등록된 캠페인이 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              campaigns.map((campaign) => (
                <TableRow
                  key={campaign.id}
                  style={{ borderColor: "var(--border)" }}
                >
                  <TableCell
                    className="font-medium"
                    style={{ color: "var(--text)" }}
                  >
                    {campaign.title}
                  </TableCell>
                  <TableCell
                    className="font-mono text-sm"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {campaign.slug}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={campaign.status} />
                  </TableCell>
                  <TableCell style={{ color: "var(--text)" }}>
                    {formattedGoal(campaign.goal_amount)}
                  </TableCell>
                  <TableCell
                    className="text-sm"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {dateRange(campaign)}
                  </TableCell>
                  <TableCell className="text-right">
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
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePageEdit(campaign.id)}
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
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <CampaignFormDialog
        campaign={editTarget}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={refresh}
      />
    </div>
  );
}
