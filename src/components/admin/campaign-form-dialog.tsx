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
  onSuccess: (newCampaignId?: string) => void;
};

const PAY_METHOD_CHOICES: Array<{ value: string; label: string }> = [
  { value: "card", label: "카드" },
  { value: "transfer", label: "계좌이체" },
  { value: "cms", label: "CMS" },
  { value: "manual", label: "수기" },
];

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
  const [startedAt, setStartedAt] = useState(campaign?.started_at?.slice(0, 10) ?? "");
  const [endedAt, setEndedAt] = useState(campaign?.ended_at?.slice(0, 10) ?? "");
  const [description, setDescription] = useState(campaign?.description ?? "");
  const [thumbnailUrl, setThumbnailUrl] = useState(campaign?.thumbnail_url ?? "");
  const [donationType, setDonationType] = useState<Campaign["donation_type"]>(
    campaign?.donation_type ?? "both"
  );
  const [presetAmountsText, setPresetAmountsText] = useState(
    (campaign?.preset_amounts ?? []).join(", ")
  );
  const [impactUnitAmount, setImpactUnitAmount] = useState(
    campaign?.impact_unit_amount != null ? String(campaign.impact_unit_amount) : ""
  );
  const [impactUnitLabel, setImpactUnitLabel] = useState(
    campaign?.impact_unit_label ?? ""
  );
  const [payMethods, setPayMethods] = useState<string[]>(
    campaign?.pay_methods ?? ["card"]
  );
  const [gaTrackingId, setGaTrackingId] = useState(campaign?.ga_tracking_id ?? "");
  const [metaPixelId, setMetaPixelId] = useState(campaign?.meta_pixel_id ?? "");
  const [seoTitle, setSeoTitle] = useState(campaign?.seo_title ?? "");
  const [seoDescription, setSeoDescription] = useState(campaign?.seo_description ?? "");
  const [ogImageUrl, setOgImageUrl] = useState(campaign?.og_image_url ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function togglePayMethod(method: string) {
    setPayMethods((prev) =>
      prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const presetAmounts = presetAmountsText
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n) && n > 0);

      const body = {
        title: title.trim(),
        slug: slug.trim(),
        status,
        goal_amount: goalAmount ? Number(goalAmount) : null,
        started_at: startedAt || null,
        ended_at: endedAt || null,
        description: description || null,
        thumbnail_url: thumbnailUrl || null,
        donation_type: donationType,
        preset_amounts: presetAmounts.length > 0 ? presetAmounts : null,
        impact_unit_amount: impactUnitAmount ? Number(impactUnitAmount) : null,
        impact_unit_label: impactUnitLabel.trim() || null,
        pay_methods: payMethods.length > 0 ? payMethods : ["card"],
        ga_tracking_id: gaTrackingId || null,
        meta_pixel_id: metaPixelId || null,
        seo_title: seoTitle || null,
        seo_description: seoDescription || null,
        og_image_url: ogImageUrl || null,
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
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "오류가 발생했습니다.");
        return;
      }

      const data = (await res.json()) as { campaign?: { id?: string } };
      onOpenChange(false);
      if (!isEdit) {
        onSuccess(data.campaign?.id);
      } else {
        onSuccess();
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    background: "var(--surface-2)",
    borderColor: "var(--border)",
    color: "var(--text)",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle style={{ color: "var(--text)" }}>
            {isEdit ? "캠페인 수정" : "새 캠페인"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          {/* 기본 정보 */}
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
              style={inputStyle}
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
              placeholder="my-campaign-2026"
              style={inputStyle}
            />
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              영문 소문자, 숫자, 하이픈만 사용
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="status" style={{ color: "var(--text)" }}>
                상태
              </Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as Campaign["status"])}
              >
                <SelectTrigger style={inputStyle}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent
                  style={{ background: "var(--surface)", borderColor: "var(--border)" }}
                >
                  <SelectItem value="draft">draft</SelectItem>
                  <SelectItem value="active">active</SelectItem>
                  <SelectItem value="closed">closed</SelectItem>
                  <SelectItem value="archived">archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="donation_type" style={{ color: "var(--text)" }}>
                후원 유형
              </Label>
              <Select
                value={donationType}
                onValueChange={(v) => setDonationType(v as Campaign["donation_type"])}
              >
                <SelectTrigger style={inputStyle}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent
                  style={{ background: "var(--surface)", borderColor: "var(--border)" }}
                >
                  <SelectItem value="both">정기+일시 모두</SelectItem>
                  <SelectItem value="regular">정기만</SelectItem>
                  <SelectItem value="onetime">일시만</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
              style={inputStyle}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="started_at" style={{ color: "var(--text)" }}>시작일</Label>
              <Input
                id="started_at"
                type="date"
                value={startedAt}
                onChange={(e) => setStartedAt(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="ended_at" style={{ color: "var(--text)" }}>종료일</Label>
              <Input
                id="ended_at"
                type="date"
                value={endedAt}
                onChange={(e) => setEndedAt(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* 대표 이미지 */}
          <div className="flex flex-col gap-1">
            <Label htmlFor="thumbnail_url" style={{ color: "var(--text)" }}>
              대표 이미지 URL
            </Label>
            <Input
              id="thumbnail_url"
              type="url"
              value={thumbnailUrl}
              onChange={(e) => setThumbnailUrl(e.target.value)}
              placeholder="https://.../image.jpg"
              style={inputStyle}
            />
          </div>

          {/* 금액 프리셋 */}
          <div className="flex flex-col gap-1">
            <Label htmlFor="preset_amounts" style={{ color: "var(--text)" }}>
              후원 금액 프리셋 (쉼표 구분)
            </Label>
            <Input
              id="preset_amounts"
              value={presetAmountsText}
              onChange={(e) => setPresetAmountsText(e.target.value)}
              placeholder="10000, 30000, 50000, 100000"
              style={inputStyle}
            />
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              공개 페이지에서 빠른 선택 버튼으로 보여줍니다.
            </p>
          </div>

          {/* 임팩트 환산 (G-D173) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="impact_unit_amount" style={{ color: "var(--text)" }}>
                임팩트 단가 (원)
              </Label>
              <Input
                id="impact_unit_amount"
                type="number"
                min={1}
                value={impactUnitAmount}
                onChange={(e) => setImpactUnitAmount(e.target.value)}
                placeholder="3000"
                style={inputStyle}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="impact_unit_label" style={{ color: "var(--text)" }}>
                임팩트 단위
              </Label>
              <Input
                id="impact_unit_label"
                value={impactUnitLabel}
                onChange={(e) => setImpactUnitLabel(e.target.value)}
                placeholder="끼, 회 방문, 권"
                style={inputStyle}
              />
            </div>
            <p
              className="col-span-2 text-xs"
              style={{ color: "var(--muted-foreground)" }}
            >
              후원자 마이페이지에서 누적 금액을 단위로 환산해 보여줍니다.
              예: &quot;3,000원 = 1끼&quot;로 설정 시 30,000원 후원 → 10끼 제공.
            </p>
          </div>

          {/* 결제 수단 */}
          <div className="flex flex-col gap-2">
            <Label style={{ color: "var(--text)" }}>결제 수단</Label>
            <div className="flex flex-wrap gap-2">
              {PAY_METHOD_CHOICES.map((m) => {
                const checked = payMethods.includes(m.value);
                return (
                  <label
                    key={m.value}
                    className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm cursor-pointer transition-colors"
                    style={{
                      background: checked
                        ? "color-mix(in srgb, var(--accent) 15%, var(--surface-2))"
                        : "var(--surface-2)",
                      borderColor: checked ? "var(--accent)" : "var(--border)",
                      color: checked ? "var(--accent)" : "var(--muted-foreground)",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePayMethod(m.value)}
                      className="h-3.5 w-3.5"
                    />
                    {m.label}
                  </label>
                );
              })}
            </div>
          </div>

          {/* 추적 ID */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="ga_tracking_id" style={{ color: "var(--text)" }}>
                GA 추적 ID
              </Label>
              <Input
                id="ga_tracking_id"
                value={gaTrackingId}
                onChange={(e) => setGaTrackingId(e.target.value)}
                placeholder="G-XXXXXXXXXX"
                style={inputStyle}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="meta_pixel_id" style={{ color: "var(--text)" }}>
                Meta 픽셀 ID
              </Label>
              <Input
                id="meta_pixel_id"
                value={metaPixelId}
                onChange={(e) => setMetaPixelId(e.target.value)}
                placeholder="000000000000000"
                style={inputStyle}
              />
            </div>
          </div>

          {/* SEO & OG (Tier A #8) */}
          <div className="rounded-md border p-3" style={{ borderColor: "var(--border)" }}>
            <div className="mb-2 text-sm font-semibold" style={{ color: "var(--text)" }}>
              SEO / 공유 설정
            </div>
            <p className="mb-3 text-xs" style={{ color: "var(--muted-foreground)" }}>
              비워두면 제목·설명·썸네일이 폴백으로 사용됩니다.
            </p>
            <div className="flex flex-col gap-2">
              <div>
                <Label htmlFor="seo_title" style={{ color: "var(--text)" }}>
                  공유 제목 (SEO)
                </Label>
                <Input
                  id="seo_title"
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                  placeholder="검색 결과/카카오톡 공유에 표시될 제목"
                  style={inputStyle}
                />
              </div>
              <div>
                <Label htmlFor="seo_description" style={{ color: "var(--text)" }}>
                  SEO 설명 (meta description)
                </Label>
                <textarea
                  id="seo_description"
                  rows={2}
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                  placeholder="검색 결과 아래 표시될 짧은 설명"
                  className="rounded-md border px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  style={inputStyle}
                />
              </div>
              <div>
                <Label htmlFor="og_image_url" style={{ color: "var(--text)" }}>
                  OG 이미지 URL
                </Label>
                <Input
                  id="og_image_url"
                  value={ogImageUrl}
                  onChange={(e) => setOgImageUrl(e.target.value)}
                  placeholder="https://example.com/og-image.png (1200×630 권장)"
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          {/* 설명 */}
          <div className="flex flex-col gap-1">
            <Label htmlFor="description" style={{ color: "var(--text)" }}>
              간단 설명 (목록용)
            </Label>
            <textarea
              id="description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="캠페인 설명을 입력하세요."
              className="rounded-md border px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-[var(--accent)]"
              style={inputStyle}
            />
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              본문은 페이지 편집기에서 작성합니다.
            </p>
          </div>

          {/* 페이지 편집기 링크 — 수정 모드에서만 표시 */}
          {campaign?.id && (
            <a
              href={`/admin/campaigns/${campaign.id}/edit`}
              className="inline-block rounded border px-3 py-2 text-sm"
              style={{ color: "var(--text)", borderColor: "var(--border)" }}
            >
              페이지 편집기 열기
            </a>
          )}

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
