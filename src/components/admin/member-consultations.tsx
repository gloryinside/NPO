"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type LogEntry = {
  id: string;
  log_type: string;
  subject: string;
  content: string | null;
  created_at: string;
};

const TYPE_LABEL: Record<string, string> = {
  phone: "전화",
  email: "이메일",
  visit: "방문",
  other: "기타",
};

export function MemberConsultations({ memberId }: { memberId: string }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [logType, setLogType] = useState("phone");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  async function fetchLogs() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/members/${memberId}/consultations`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLogs();
  }, [memberId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/members/${memberId}/consultations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logType, subject, content: content || undefined }),
      });
      if (res.ok) {
        setSubject("");
        setContent("");
        setShowForm(false);
        fetchLogs();
      }
    } finally {
      setSaving(false);
    }
  }

  function formatDateTime(iso: string) {
    try {
      return new Date(iso).toLocaleString("ko-KR");
    } catch {
      return iso;
    }
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)]">
      <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
        <h2 className="text-sm font-medium text-[var(--muted-foreground)]">
          상담이력 ({logs.length}건)
        </h2>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="bg-[var(--accent)] text-white text-sm px-3 py-1 h-auto"
        >
          {showForm ? "닫기" : "+ 새 상담"}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="p-4 border-b border-[var(--border)] flex flex-col gap-3">
          <div className="flex gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="log-type" className="text-xs text-[var(--muted-foreground)]">��형</label>
              <select
                id="log-type"
                value={logType}
                onChange={(e) => setLogType(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)]"
              >
                <option value="phone">전화</option>
                <option value="email">이메일</option>
                <option value="visit">방문</option>
                <option value="other">기타</option>
              </select>
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <label htmlFor="log-subject" className="text-xs text-[var(--muted-foreground)]">
                제목 <span className="text-[var(--negative)]">*</span>
              </label>
              <Input
                id="log-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="상담 제목"
                className="bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)]"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="log-content" className="text-xs text-[var(--muted-foreground)]">내용</label>
            <textarea
              id="log-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              placeholder="상담 내용을 입력하세요"
              className="rounded-lg border px-3 py-2 text-sm outline-none resize-none bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)]"
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={saving || !subject.trim()}
              className="bg-[var(--accent)] text-white disabled:opacity-60">
              {saving ? "저장 중..." : "저장"}
            </Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="p-8 text-center text-sm text-[var(--muted-foreground)]">
          로딩 중...
        </div>
      ) : logs.length === 0 ? (
        <div className="p-8 text-center text-sm text-[var(--muted-foreground)]">
          상담이력이 없습니다.
        </div>
      ) : (
        <ul>
          {logs.map((log, idx) => (
            <li
              key={log.id}
              className={`p-4 ${idx > 0 ? "border-t border-[var(--border)]" : ""}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs px-2 py-0.5 rounded bg-[var(--surface-2)] text-[var(--muted-foreground)]">
                  {TYPE_LABEL[log.log_type] ?? log.log_type}
                </span>
                <span className="text-sm font-medium text-[var(--text)]">{log.subject}</span>
                <span className="ml-auto text-xs text-[var(--muted-foreground)]">
                  {formatDateTime(log.created_at)}
                </span>
              </div>
              {log.content && (
                <p className="text-sm text-[var(--muted-foreground)] mt-1 whitespace-pre-wrap">
                  {log.content}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
