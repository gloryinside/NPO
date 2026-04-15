"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Campaign } from "@/types/campaign";

type Props = {
  campaign?: Campaign;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

export function CampaignFormDialog({
  campaign,
  open,
  onOpenChange,
  onSuccess,
}: Props) {
  const isEdit = !!campaign;

  const [title, setTitle] = useState(campaign?.title ?? "");
  const [slug, setSlug] = useState(campaign?.slug ?? "");
  const [status, setStatus] = useState<Campaign["status"]>(
    campaign?.status ?? "draft"
  );
  const [goalAmount, setGoalAmount] = useState(
    campaign?.goal_amount != null ? String(campaign.goal_amount) : ""
  );
  const [startedAt, setStartedAt] = useState(campaign?.started_at ?? "");
  const [endedAt, setEndedAt] = useState(campaign?.ended_at ?? "");
  const [description, setDescription] = useState(campaign?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const body = {
        title: title.trim(),
        slug: slug.trim(),
        status,
        goal_amount: goalAmount ? Number(goalAmount) : null,
        started_at: startedAt || null,
        ended_at: endedAt || null,
        description: description || null,
      };

      const url = isEdit
        ? `/api/admin/campaigns/${campaign.id}`
        : "/api/admin/campaigns";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "오류가 발생했습니다.");
        return;
      }

      onSuccess();
      onOpenChange(false);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        className="max-w-lg"
      >
        <DialogHeader>
          <DialogTitle style={{ color: "var(--text)" }}>
            {isEdit ? "캠페인 수정" : "새 캠페인"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="title" style={{ color: "var(--text)" }}>
              제목 <span style={{ color: "var(--negative)" }}>*</span>
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="캠페인 제목"
              style={{
                background: "var(--surface-2)",
                borderColor: "var(--border)",
                color: "var(--text)",
              }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="slug" style={{ color: "var(--text)" }}>
              슬러그 <span style={{ color: "var(--negative)" }}>*</span>
            </Label>
            <Input
              id="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
              placeholder="my-campaign-2024"
              style={{
                background: "var(--surface-2)",
                borderColor: "var(--border)",
                color: "var(--text)",
              }}
            />
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              영문 소문자, 숫자, 하이픈만 사용
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="status" style={{ color: "var(--text)" }}>
              상태
            </Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as Campaign["status"])}
            >
              <SelectTrigger
                style={{
                  background: "var(--surface-2)",
                  borderColor: "var(--border)",
                  color: "var(--text)",
                }}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                style={{
                  background: "var(--surface)",
                  borderColor: "var(--border)",
                }}
              >
                <SelectItem value="draft">draft</SelectItem>
                <SelectItem value="active">active</SelectItem>
                <SelectItem value="closed">closed</SelectItem>
                <SelectItem value="archived">archived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="goal_amount" style={{ color: "var(--text)" }}>
              목표금액 (원)
            </Label>
            <Input
              id="goal_amount"
              type="number"
              min={0}
              value={goalAmount}
              onChange={(e) => setGoalAmount(e.target.value)}
              placeholder="1000000"
              style={{
                background: "var(--surface-2)",
                borderColor: "var(--border)",
                color: "var(--text)",
              }}
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1 flex flex-col gap-1">
              <Label htmlFor="started_at" style={{ color: "var(--text)" }}>
                시작일
              </Label>
              <Input
                id="started_at"
                type="date"
                value={startedAt}
                onChange={(e) => setStartedAt(e.target.value)}
                style={{
                  background: "var(--surface-2)",
                  borderColor: "var(--border)",
                  color: "var(--text)",
                }}
              />
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <Label htmlFor="ended_at" style={{ color: "var(--text)" }}>
                종료일
              </Label>
              <Input
                id="ended_at"
                type="date"
                value={endedAt}
                onChange={(e) => setEndedAt(e.target.value)}
                style={{
                  background: "var(--surface-2)",
                  borderColor: "var(--border)",
                  color: "var(--text)",
                }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="description" style={{ color: "var(--text)" }}>
              설명
            </Label>
            <textarea
              id="description"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="캠페인 설명을 입력하세요."
              className="rounded-md border px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-[var(--accent)]"
              style={{
                background: "var(--surface-2)",
                borderColor: "var(--border)",
                color: "var(--text)",
              }}
            />
          </div>

          {error && (
            <p className="text-sm" style={{ color: "var(--negative)" }}>
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 mt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              style={{ color: "var(--muted-foreground)" }}
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={loading}
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              {loading ? "저장 중..." : isEdit ? "수정" : "생성"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
