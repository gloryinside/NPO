"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type InitialData = {
  tossClientKey: string | null;
  tossSecretKeyMasked: string | null;
  tossWebhookSecretMasked: string | null;
};

type Props = {
  initialData: InitialData;
};

export function TossSettingsForm({ initialData }: Props) {
  const router = useRouter();

  // Client key is always editable (public value).
  const [clientKey, setClientKey] = useState<string>(
    initialData.tossClientKey ?? ""
  );

  // Secret key: start in display mode if a value already exists, else edit mode.
  const [secretKeyInput, setSecretKeyInput] = useState<string>("");
  const [secretEditMode, setSecretEditMode] = useState<boolean>(
    initialData.tossSecretKeyMasked === null
  );

  // Webhook secret: same pattern.
  const [webhookInput, setWebhookInput] = useState<string>("");
  const [webhookEditMode, setWebhookEditMode] = useState<boolean>(
    initialData.tossWebhookSecretMasked === null
  );

  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    const body: Record<string, string> = {
      tossClientKey: clientKey,
    };
    if (secretEditMode) {
      body.tossSecretKey = secretKeyInput;
    }
    if (webhookEditMode) {
      body.tossWebhookSecret = webhookInput;
    }

    try {
      const res = await fetch("/api/admin/settings/toss", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? "저장에 실패했습니다.");
      }

      setSuccessMessage("저장되었습니다.");
      // Reset edit modes & clear inputs so refreshed data drives UI.
      setSecretKeyInput("");
      setWebhookInput("");
      router.refresh();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "저장에 실패했습니다."
      );
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
        {/* Client Key */}
        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="toss-client-key"
            className="text-sm font-medium text-[var(--text)]"
          >
            Client Key (공개키)
          </Label>
          <p className="text-xs text-[var(--muted-foreground)]">
            결제 위젯에서 사용되며 공개되어도 안전한 키입니다.
          </p>
          <Input
            id="toss-client-key"
            type="text"
            placeholder="test_gck_..."
            value={clientKey}
            onChange={(e) => setClientKey(e.target.value)}
            className="mt-1"
          />
        </div>

        {/* Secret Key */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-sm font-medium text-[var(--text)]">
            Secret Key (비밀키)
          </Label>
          <p className="text-xs text-[var(--muted-foreground)]">
            서버에서 Toss 승인 API 호출 시 사용됩니다. 절대 유출 금지.
          </p>
          {secretEditMode ? (
            <div className="mt-1 flex items-center gap-2">
              <Input
                id="toss-secret-key"
                type="password"
                placeholder="test_sk_..."
                value={secretKeyInput}
                onChange={(e) => setSecretKeyInput(e.target.value)}
                className="flex-1"
              />
              {initialData.tossSecretKeyMasked !== null && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSecretEditMode(false);
                    setSecretKeyInput("");
                  }}
                >
                  취소
                </Button>
              )}
            </div>
          ) : (
            <div className="mt-1 flex items-center gap-2">
              <div className="flex h-8 flex-1 items-center rounded-lg border border-[var(--border)] bg-transparent px-2.5 py-1 font-mono text-sm text-[var(--muted-foreground)]">
                {initialData.tossSecretKeyMasked}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSecretEditMode(true)}
              >
                변경하기
              </Button>
            </div>
          )}
        </div>

        {/* Webhook Secret */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-sm font-medium text-[var(--text)]">
            Webhook Secret
          </Label>
          <p className="text-xs text-[var(--muted-foreground)]">
            Toss 대시보드에서 발급한 웹훅 서명 시크릿입니다.
          </p>
          {webhookEditMode ? (
            <div className="mt-1 flex items-center gap-2">
              <Input
                id="toss-webhook-secret"
                type="password"
                placeholder="whsec_..."
                value={webhookInput}
                onChange={(e) => setWebhookInput(e.target.value)}
                className="flex-1"
              />
              {initialData.tossWebhookSecretMasked !== null && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setWebhookEditMode(false);
                    setWebhookInput("");
                  }}
                >
                  취소
                </Button>
              )}
            </div>
          ) : (
            <div className="mt-1 flex items-center gap-2">
              <div className="flex h-8 flex-1 items-center rounded-lg border border-[var(--border)] bg-transparent px-2.5 py-1 font-mono text-sm text-[var(--muted-foreground)]">
                {initialData.tossWebhookSecretMasked}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setWebhookEditMode(true)}
              >
                변경하기
              </Button>
            </div>
          )}
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90"
        >
          {loading ? "저장 중..." : "저장"}
        </Button>

        {successMessage && (
          <p className="text-sm text-[var(--positive)]">{successMessage}</p>
        )}
        {errorMessage && (
          <p className="text-sm text-[var(--negative)]">{errorMessage}</p>
        )}
      </div>
    </form>
  );
}
