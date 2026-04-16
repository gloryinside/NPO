"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ImportResult = {
  created: number;
  skipped: number;
  total: number;
  errors: Array<{ row: number; reason: string }>;
};

export function MemberCsvImport() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setResult(null);
    setUploading(true);

    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/members/import", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "업로드 실패");
      }
      setResult(data);
      if (data.created > 0) {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "업로드 중 오류");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function closeDialog() {
    setOpen(false);
    setResult(null);
    setError(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm transition-colors bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface)]"
      >
        CSV 가져오기
      </button>

      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : closeDialog())}>
        <DialogContent className="max-w-md bg-[var(--surface)] border-[var(--border)]">
          <DialogHeader>
            <DialogTitle className="text-[var(--text)]">후원자 CSV 가져오기</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 mt-2">
            <div
              className="rounded-md border p-3 text-xs"
              style={{
                borderColor: "var(--border)",
                background: "var(--surface-2)",
                color: "var(--muted-foreground)",
              }}
            >
              <p className="font-semibold mb-1" style={{ color: "var(--text)" }}>
                지원 컬럼 (1행 헤더, 순서 무관)
              </p>
              <p>
                이름*, 연락처, 이메일, 생년월일, 회원유형, 상태, 유입경로, 메모
              </p>
              <p className="mt-2">
                • 연락처·이메일 중복 시 자동 스킵
                <br />• 생년월일: <code>1990-12-31</code> / <code>19901231</code> 모두 허용
                <br />• 회원유형: 개인/법인, 상태: 활성/비활성/사망
              </p>
            </div>

            {!result && !error && (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileChange}
                  disabled={uploading}
                  className="block w-full text-sm text-[var(--text)]
                    file:mr-3 file:py-2 file:px-4 file:rounded-md
                    file:border-0 file:text-sm file:font-medium
                    file:bg-[var(--accent)] file:text-white
                    hover:file:opacity-90 disabled:opacity-60"
                />
                {uploading && (
                  <p className="mt-3 text-sm" style={{ color: "var(--muted-foreground)" }}>
                    업로드 중...
                  </p>
                )}
              </div>
            )}

            {error && (
              <div
                className="rounded-md border p-3 text-sm"
                style={{
                  borderColor: "rgba(239,68,68,0.4)",
                  background: "rgba(239,68,68,0.1)",
                  color: "var(--negative)",
                }}
              >
                {error}
              </div>
            )}

            {result && (
              <div className="flex flex-col gap-3">
                <div
                  className="rounded-md border p-3 text-sm"
                  style={{
                    borderColor: "rgba(34,197,94,0.4)",
                    background: "rgba(34,197,94,0.08)",
                  }}
                >
                  <p style={{ color: "var(--positive)", fontWeight: 600 }}>
                    처리 완료
                  </p>
                  <p className="mt-1" style={{ color: "var(--text)" }}>
                    총 {result.total}건 중 · 생성 {result.created}건 · 스킵{" "}
                    {result.skipped}건 · 오류 {result.errors.length}건
                  </p>
                </div>

                {result.errors.length > 0 && (
                  <div
                    className="rounded-md border p-3 text-xs max-h-40 overflow-y-auto"
                    style={{
                      borderColor: "var(--border)",
                      background: "var(--surface-2)",
                    }}
                  >
                    <p className="font-semibold mb-2" style={{ color: "var(--text)" }}>
                      오류 내역
                    </p>
                    <ul className="space-y-1" style={{ color: "var(--muted-foreground)" }}>
                      {result.errors.slice(0, 20).map((e) => (
                        <li key={e.row}>
                          · {e.row}행: {e.reason}
                        </li>
                      ))}
                      {result.errors.length > 20 && (
                        <li>... 외 {result.errors.length - 20}건</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              {result && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setResult(null);
                    setError(null);
                  }}
                  className="border-[var(--border)] text-[var(--text)] bg-[var(--surface-2)]"
                >
                  다시 업로드
                </Button>
              )}
              <Button
                type="button"
                onClick={closeDialog}
                className="bg-[var(--accent)] text-white"
              >
                닫기
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
