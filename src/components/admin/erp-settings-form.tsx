"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  erpApiKeyMasked: string | null;
  erpWebhookUrl: string | null;
};

export function ErpSettingsForm({ erpApiKeyMasked, erpWebhookUrl: initialWebhookUrl }: Props) {
  const router = useRouter();

  const [apiKeyInput, setApiKeyInput] = useState("");
  const [apiKeyEditMode, setApiKeyEditMode] = useState(erpApiKeyMasked === null);

  const [webhookUrl, setWebhookUrl] = useState(initialWebhookUrl ?? "");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSuccess(null);
    setError(null);

    const body: Record<string, string | null> = {
      erpWebhookUrl: webhookUrl.trim() || null,
    };
    if (apiKeyEditMode) {
      body.erpApiKey = apiKeyInput.trim() || null;
    }

    try {
      const res = await fetch("/api/admin/settings/erp", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? "저장에 실패했습니다.");
      }
      setSuccess("저장되었습니다.");
      setApiKeyInput("");
      setApiKeyEditMode(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border p-6 bg-[var(--surface)] border-[var(--border)]"
    >
      <div className="flex flex-col gap-5">
        {/* ERP API Key (도너스 연동용) */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-sm font-medium text-[var(--text)]">
            ERP API Key
          </Label>
          <p className="text-xs text-[var(--muted-foreground)]">
            ERP 시스템이 <code className="bg-[var(--surface-2)] px-1 rounded">/api/v1/payments</code>에 접근할 때 사용하는 Bearer 토큰입니다.
          </p>
          {apiKeyEditMode ? (
            <div className="mt-1 flex items-center gap-2">
              <Input
                type="password"
                placeholder="api_key_..."
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                className="flex-1"
              />
              {erpApiKeyMasked !== null && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setApiKeyEditMode(false);
                    setApiKeyInput("");
                  }}
                >
                  취소
                </Button>
              )}
            </div>
          ) : (
            <div className="mt-1 flex items-center gap-2">
              <div className="flex h-8 flex-1 items-center rounded-lg border border-[var(--border)] bg-transparent px-2.5 py-1 font-mono text-sm text-[var(--muted-foreground)]">
                {erpApiKeyMasked ?? "미설정"}
              </div>
              <Button type="button" variant="outline" onClick={() => setApiKeyEditMode(true)}>
                변경하기
              </Button>
            </div>
          )}
        </div>

        {/* ERP Webhook URL (Push 방식) */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-sm font-medium text-[var(--text)]">
            ERP Webhook URL
          </Label>
          <p className="text-xs text-[var(--muted-foreground)]">
            납입 확정 시 실시간으로 Push 알림을 받을 ERP 엔드포인트입니다. (선택)
          </p>
          <Input
            type="url"
            placeholder="https://erp.your-org.com/webhook/donation"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            className="mt-1"
          />
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            비워두면 Push 연동이 비활성화됩니다.
          </p>
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90"
        >
          {loading ? "저장 중..." : "저장"}
        </Button>

        {success && <p className="text-sm" style={{ color: "var(--positive)" }}>{success}</p>}
        {error && <p className="text-sm" style={{ color: "var(--negative)" }}>{error}</p>}
      </div>
    </form>
  );
}
