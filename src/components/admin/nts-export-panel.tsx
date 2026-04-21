"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatKRW } from "@/lib/format";

type ExportLog = {
  id: string;
  createdAt: string;
  year: number;
  memberCount: number | null;
  totalAmount: number | null;
  fileUrl: string | null;
};

type Summary = {
  issuedCount: number;
  pendingCount: number;
  noIdCount: number;
  eligibleCount: number;
  totalAmount: number;
};

type Props = {
  year: number;
  summary: Summary;
  logs: ExportLog[];
};

export function NtsExportPanel({ year, summary, logs }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setLoading(true);
    setError(null);
    try {
      // 1) 파일 생성 (기존 GET API)
      const res = await fetch(`/api/admin/receipts/nts-export?year=${year}`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error ?? "파일 생성 실패");
      }

      // 헤더에서 집계 정보 추출
      const memberCount = Number(res.headers.get("X-NTS-Count") ?? "0");
      const totalAmount = Number(res.headers.get("X-NTS-Total") ?? "0");

      // 2) 파일 다운로드
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? `nts_${year}.txt`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      // 3) 이력 저장
      await fetch("/api/admin/receipts/nts-export/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, fileUrl: "", memberCount, totalAmount }),
      });

      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* 생성 전 요약 */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <h3 className="mb-4 text-sm font-semibold text-[var(--text)]">{year}년 생성 전 요약</h3>
        <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
          <div>
            <div className="text-xs text-[var(--muted-foreground)]">영수증 발급 완료</div>
            <div className="mt-1 text-lg font-bold text-[var(--positive)]">{summary.issuedCount}명</div>
          </div>
          <div>
            <div className="text-xs text-[var(--muted-foreground)]">미발급</div>
            <div className={`mt-1 text-lg font-bold ${summary.pendingCount > 0 ? "text-[var(--warning)]" : "text-[var(--muted-foreground)]"}`}>
              {summary.pendingCount}명
            </div>
          </div>
          <div>
            <div className="text-xs text-[var(--muted-foreground)]">주민번호 미등록 (자동제외)</div>
            <div className={`mt-1 text-lg font-bold ${summary.noIdCount > 0 ? "text-[var(--negative)]" : "text-[var(--muted-foreground)]"}`}>
              {summary.noIdCount}명
            </div>
          </div>
          <div>
            <div className="text-xs text-[var(--muted-foreground)]">전산매체 포함 예정</div>
            <div className="mt-1 text-lg font-bold text-[var(--text)]">
              {summary.eligibleCount}명 / {formatKRW(summary.totalAmount)}
            </div>
          </div>
        </div>
      </div>

      {summary.noIdCount > 0 && (
        <div className="rounded-lg border border-[var(--warning)] bg-[var(--warning)]/10 px-4 py-3 text-sm text-[var(--text)]">
          ⚠️ 주민번호 미등록 <strong>{summary.noIdCount}명</strong>은 전산매체 파일에서 제외됩니다.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-[var(--negative)] bg-[var(--negative)]/10 px-4 py-3 text-sm text-[var(--negative)]">
          ❌ {error}
        </div>
      )}

      <button
        onClick={handleExport}
        disabled={loading || summary.eligibleCount === 0}
        className="w-full rounded-lg bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
      >
        {loading ? "생성 중..." : "전산매체 파일 생성 및 다운로드"}
      </button>

      {/* 생성 이력 */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-[var(--text)]">생성 이력</h3>
        {logs.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">생성 이력이 없습니다.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-[var(--border)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--surface-2)]">
                  {["생성일시", "대상연도", "인원", "금액", "파일"].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-medium text-[var(--muted-foreground)]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log, idx) => (
                  <tr key={log.id} className={idx > 0 ? "border-t border-[var(--border)]" : ""}>
                    <td className="px-4 py-3 text-xs text-[var(--muted-foreground)]">
                      {new Date(log.createdAt).toLocaleString("ko-KR")}
                    </td>
                    <td className="px-4 py-3 text-[var(--text)]">{log.year}년</td>
                    <td className="px-4 py-3 text-[var(--text)]">{log.memberCount ?? "-"}명</td>
                    <td className="px-4 py-3 text-[var(--text)]">
                      {log.totalAmount ? formatKRW(log.totalAmount) : "-"}
                    </td>
                    <td className="px-4 py-3">
                      {log.fileUrl ? (
                        <a href={log.fileUrl} className="text-xs text-[var(--accent)] hover:underline">
                          재다운로드
                        </a>
                      ) : (
                        <span className="text-xs text-[var(--muted-foreground)]">로컬 다운로드됨</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
