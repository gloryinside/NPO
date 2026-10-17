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
  // 서버 미리보기 — 제외 사유·기관 정보 누락(주민번호는 내려오지 않음)
  const [preview, setPreview] = useState<{
    rowCount: number;
    totalAmount: number;
    excluded: Array<{ receiptCode: string; donorName: string; reason: string }>;
    merged?: Array<{ receiptCode: string; donorName: string; mergedInto: string }>;
    orgIssues: Array<{ message: string; blocking: boolean }>;
  } | null>(null);

  async function handlePreview() {
    setError(null);
    const res = await fetch(`/api/admin/receipts/nts-export?year=${year}&format=json`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setError((json as { error?: string }).error ?? "미리보기 실패");
    setPreview(json as NonNullable<typeof preview>);
  }

  async function handleExport() {
    setLoading(true);
    setError(null);
    try {
      // 파일 생성 — 제출 이력·감사 로그는 서버가 남긴다
      const res = await fetch(`/api/admin/receipts/nts-export?year=${year}`);
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string; issues?: Array<{ message: string }> };
        const detail = json.issues?.map((i) => i.message).join(" ") ?? "";
        throw new Error(`${json.error ?? "파일 생성 실패"} ${detail}`.trim());
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? `nts_donation_${year}.xlsx`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
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

      {preview && (
        <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-card">
          <p className="text-sm font-semibold text-[var(--text)]">
            제출 대상 {preview.rowCount}건 · {formatKRW(preview.totalAmount)}
            {preview.excluded.length > 0 && <span className="text-[var(--warning)]"> · 제외 {preview.excluded.length}건</span>}
            {(preview.merged?.length ?? 0) > 0 && <span className="text-[var(--muted-foreground)]"> · 같은 번호 합산 {preview.merged?.length}건</span>}
          </p>
          {preview.orgIssues.length > 0 && (
            <ul className="space-y-1 text-sm">
              {preview.orgIssues.map((i, k) => (
                <li key={k} className={i.blocking ? "text-[var(--negative)]" : "text-[var(--warning)]"}>
                  {i.blocking ? "필수" : "권장"} · {i.message}
                </li>
              ))}
            </ul>
          )}
          {preview.excluded.length > 0 && (
            <div className="max-h-48 overflow-y-auto rounded-xl border border-[var(--border)]">
              <table className="w-full text-xs">
                <tbody>
                  {preview.excluded.map((x) => (
                    <tr key={x.receiptCode} className="border-b border-[var(--border)] last:border-0">
                      <td className="px-3 py-1.5 font-mono text-[var(--muted-foreground)]">{x.receiptCode}</td>
                      <td className="px-3 py-1.5 text-[var(--text)]">{x.donorName}</td>
                      <td className="px-3 py-1.5 text-[var(--warning)]">{x.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {(preview.merged?.length ?? 0) > 0 && (
            <p className="text-xs text-[var(--muted-foreground)]">
              같은 주민(사업자)등록번호의 영수증은 한 줄로 합산했습니다(홈택스는 번호 중복을 오류로 거부):{" "}
              {preview.merged!.map((m) => `${m.receiptCode}→${m.mergedInto}`).join(", ")}
            </p>
          )}
          <p className="text-xs text-[var(--muted-foreground)]">
            파일은 홈택스 전자기부금영수증 일괄발급(엑셀 업로드)용 기부자별 발급명세입니다. 업로드 전 그해 홈택스 양식의 열 순서와 맞는지 확인하세요.
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handlePreview}
          disabled={loading}
          className="rounded-xl border border-[var(--input)] bg-[var(--surface)] px-4 py-3 text-sm font-semibold text-[var(--text)] hover:bg-[var(--surface-2)] disabled:opacity-50"
        >
          제출 전 점검
        </button>
        <button
          onClick={handleExport}
          disabled={loading || summary.eligibleCount === 0}
          className="flex-1 rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white shadow-glow transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          {loading ? "생성 중…" : "국세청 제출용 엑셀 내려받기"}
        </button>
      </div>

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
                      {log.fileUrl?.startsWith("http") ? (
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
