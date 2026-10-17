"use client";

import { useState, useCallback } from "react";
import { PageHeader } from "@/components/common/page-header";

type Channel = "sms" | "alimtalk";

interface MemberRow {
  id: string;
  name: string;
  phone: string | null;
  member_code: string | null;
}

const CHAR_LIMIT = 90;

export default function CommunicationsPage() {
  const [channel, setChannel] = useState<Channel>("sms");
  const [message, setMessage] = useState("");
  // 결제·영수증 같은 안내는 info, 소식·캠페인 홍보는 ad(정보통신망법 제50조 — 동의자에게만, 표시·수신거부 자동 첨부)
  const [purpose, setPurpose] = useState<"info" | "ad">("info");
  const [templateCode, setTemplateCode] = useState("");
  const [templateParams, setTemplateParams] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [searchResults, setSearchResults] = useState<MemberRow[]>([]);
  const [selected, setSelected] = useState<MemberRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ succeeded: number; failed: number; total: number; skippedNoConsent?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const searchMembers = useCallback(async () => {
    if (!memberSearch.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `/api/admin/members?q=${encodeURIComponent(memberSearch)}&limit=20`
      );
      const json = await res.json();
      setSearchResults(json.members ?? json.data ?? []);
    } finally {
      setSearching(false);
    }
  }, [memberSearch]);

  const addMember = (m: MemberRow) => {
    if (!selected.find((s) => s.id === m.id)) {
      setSelected((prev) => [...prev, m]);
    }
  };

  const removeMember = (id: string) => {
    setSelected((prev) => prev.filter((m) => m.id !== id));
  };

  const send = async () => {
    setError(null);
    setResult(null);
    if (selected.length === 0) {
      setError("발송 대상을 선택해주세요.");
      return;
    }
    if (channel === "sms" && !message.trim()) {
      setError("메시지를 입력해주세요.");
      return;
    }
    if (channel === "alimtalk" && !templateCode.trim()) {
      setError("템플릿 코드를 입력해주세요.");
      return;
    }

    setSending(true);
    try {
      let parsedParams: Record<string, string> = {};
      if (channel === "alimtalk" && templateParams.trim()) {
        try {
          parsedParams = JSON.parse(templateParams);
        } catch {
          setError("템플릿 파라미터가 올바른 JSON 형식이 아닙니다.");
          return;
        }
      }

      const res = await fetch("/api/admin/communications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          member_ids: selected.map((m) => m.id),
          channel,
          message: channel === "sms" ? message : undefined,
          purpose: channel === "sms" ? purpose : "info",
          template_code: channel === "alimtalk" ? templateCode : undefined,
          template_params: channel === "alimtalk" ? parsedParams : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "발송 중 오류가 발생했습니다.");
        return;
      }
      setResult(json);
      if (json.failed === 0) {
        setMessage("");
        setSelected([]);
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="문자·이메일 보내기"
        description="선택한 후원자에게 SMS 또는 알림톡을 직접 발송합니다."
      />

      {/* Channel selector */}
      <div className="flex gap-2">
        {(["sms", "alimtalk"] as Channel[]).map((c) => (
          <button
            key={c}
            onClick={() => { setChannel(c); setError(null); setResult(null); }}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              channel === c
                ? "bg-[var(--accent)] text-white"
                : "border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--text)]"
            }`}
          >
            {c === "sms" ? "SMS" : "알림톡 (카카오)"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Message composition */}
        <div className="space-y-4">
          <div
            className="rounded-2xl border p-5 space-y-4"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            <h2 className="text-sm font-semibold text-[var(--muted-foreground)]">
              {channel === "sms" ? "메시지 내용" : "알림톡 설정"}
            </h2>

            {channel === "sms" ? (
              <div>
                <div className="mb-3 flex flex-wrap gap-4 text-sm text-[var(--text)]" role="radiogroup" aria-label="문자 종류">
                  <label className="inline-flex items-center gap-1.5">
                    <input type="radio" name="purpose" checked={purpose === "info"} onChange={() => setPurpose("info")} />
                    안내(결제·영수증·약정 등)
                  </label>
                  <label className="inline-flex items-center gap-1.5">
                    <input type="radio" name="purpose" checked={purpose === "ad"} onChange={() => setPurpose("ad")} />
                    광고(소식·캠페인·행사 홍보)
                  </label>
                </div>
                {purpose === "ad" && (
                  <p className="mb-2 rounded-lg bg-[var(--warning-soft)] px-3 py-2 text-xs text-[var(--text)]">
                    마케팅 수신에 동의한 후원자에게만 보내고, 밤 9시~아침 8시에는 보낼 수 없습니다. 앞에 &lsquo;(광고)기관명&rsquo;, 끝에 &lsquo;무료수신거부 대표전화&rsquo;가 자동으로 붙어 본문은 그만큼 짧아집니다.
                  </p>
                )}
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, CHAR_LIMIT))}
                  rows={5}
                  placeholder="발송할 메시지를 입력하세요 (최대 90자)"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] resize-none"
                />
                <p className="mt-1 text-right text-xs text-[var(--muted-foreground)]">
                  {message.length}/{CHAR_LIMIT}자
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs text-[var(--muted-foreground)]">
                    템플릿 코드
                  </label>
                  <input
                    type="text"
                    value={templateCode}
                    onChange={(e) => setTemplateCode(e.target.value)}
                    placeholder="예: DONATION_THANKS"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[var(--muted-foreground)]">
                    파라미터 (JSON)
                  </label>
                  <textarea
                    value={templateParams}
                    onChange={(e) => setTemplateParams(e.target.value)}
                    rows={3}
                    placeholder={`예: {"name": "홍길동", "amount": "10,000"}`}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 font-mono text-xs text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] resize-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Result / Error */}
          {result && (
            <div
              className={`rounded-xl border px-4 py-3 text-sm ${
                result.failed === 0
                  ? "border-[#22c55e] bg-[color-mix(in_srgb,#22c55e_10%,transparent)] text-[#22c55e]"
                  : "border-[var(--warning)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] text-[var(--warning)]"
              }`}
            >
              {result.succeeded}건 성공 / {result.failed}건 실패 (총 {result.total}건)
              {result.skippedNoConsent ? ` · 수신 미동의 ${result.skippedNoConsent}명 제외` : ""}
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            onClick={send}
            disabled={sending || selected.length === 0}
            className="w-full rounded-xl bg-[var(--accent)] py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            {sending ? "발송 중…" : `${selected.length}명에게 발송`}
          </button>
        </div>

        {/* Recipient selector */}
        <div className="space-y-4">
          {/* Search */}
          <div
            className="rounded-2xl border p-5"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            <h2 className="mb-3 text-sm font-semibold text-[var(--muted-foreground)]">
              후원자 검색
            </h2>
            <div className="flex gap-2">
              <input
                type="search"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchMembers()}
                placeholder="이름 또는 코드"
                className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
              <button
                onClick={searchMembers}
                disabled={searching}
                className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted-foreground)] hover:text-[var(--text)] disabled:opacity-50"
              >
                {searching ? "…" : "검색"}
              </button>
            </div>
            {searchResults.length > 0 && (
              <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-[var(--border)]">
                {searchResults.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => addMember(m)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-[var(--surface-2)]"
                  >
                    <span className="font-medium text-[var(--text)]">{m.name}</span>
                    <span className="text-xs text-[var(--muted-foreground)]">
                      {m.phone ?? "번호없음"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected list */}
          <div
            className="rounded-2xl border p-5"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--muted-foreground)]">
                발송 대상 ({selected.length}명)
              </h2>
              {selected.length > 0 && (
                <button
                  onClick={() => setSelected([])}
                  className="text-xs text-[var(--muted-foreground)] hover:text-[var(--text)]"
                >
                  전체 제거
                </button>
              )}
            </div>
            {selected.length === 0 ? (
              <p className="text-center text-xs text-[var(--muted-foreground)] py-6">
                후원자를 검색해서 추가하세요.
              </p>
            ) : (
              <div className="space-y-1">
                {selected.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-[var(--surface-2)]"
                  >
                    <div>
                      <span className="text-sm font-medium text-[var(--text)]">{m.name}</span>
                      {m.phone && (
                        <span className="ml-2 text-xs text-[var(--muted-foreground)]">
                          {m.phone}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => removeMember(m.id)}
                      className="text-xs text-[var(--muted-foreground)] hover:text-red-500"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
