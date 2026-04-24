"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Props {
  bounceId: string;
  bounceType: string;
}

const REACTIVATE_TYPES = new Set(["hard", "complaint"]);

export function EmailBounceResolveButton({ bounceId, bounceType }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const canReactivate = REACTIVATE_TYPES.has(bounceType);

  function submit(reactivateMember: boolean) {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/admin/email-bounces/${bounceId}/resolve`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reactivateMember }),
          },
        );
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          setError(data.error ?? `처리 실패 (${res.status})`);
          return;
        }
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "네트워크 오류");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => submit(false)}
          disabled={isPending}
          className="rounded-md border px-2 py-1 text-xs font-medium disabled:opacity-50"
          style={{
            borderColor: "var(--border)",
            background: "var(--surface)",
            color: "var(--text)",
          }}
        >
          {isPending ? "처리 중…" : "처리 완료"}
        </button>
        {canReactivate && (
          <button
            type="button"
            onClick={() => submit(true)}
            disabled={isPending}
            className="rounded-md px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
            style={{ background: "var(--accent)" }}
            title="이메일 수신을 다시 활성화합니다."
          >
            완료 + 재활성화
          </button>
        )}
      </div>
      {error && (
        <p className="text-xs" style={{ color: "var(--negative)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
