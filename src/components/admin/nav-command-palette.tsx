"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ADMIN_NAV, searchNav, ALL_NAV_ITEMS } from "@/lib/admin/nav";
import { useNavFavorites } from "./nav-favorites";

/**
 * 메뉴 검색(⌘K / Ctrl+K) — 메뉴 이름·동의어로 바로 이동.
 * 검색어가 없으면 즐겨찾기와 각 허브의 주요 메뉴를 보여 준다.
 */
export function NavCommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const { favorites } = useNavFavorites();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  // AI에게 물어보기 — 메뉴 이름을 모를 때 질문으로 찾기
  const [ai, setAi] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "done"; answer: string; steps: string[]; links: Array<{ href: string; label: string; hubLabel: string }> }
    | { status: "error"; message: string }
  >({ status: "idle" });

  async function askAi() {
    const q = query.trim();
    if (q.length < 4) return;
    setAi({ status: "loading" });
    try {
      const res = await fetch("/api/admin/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 503) {
        setAi({ status: "error", message: "AI 도움말이 아직 켜져 있지 않아요. 아래 메뉴 검색 결과에서 찾아보세요." });
        return;
      }
      if (!res.ok) {
        setAi({ status: "error", message: json.error ?? "답을 만들지 못했습니다. 아래 메뉴 검색 결과를 확인해 보세요." });
        return;
      }
      setAi({ status: "done", answer: json.answer, steps: json.steps ?? [], links: json.links ?? [] });
    } catch {
      setAi({ status: "error", message: "연결이 끊겼습니다. 잠시 후 다시 물어봐 주세요." });
    }
  }

  // ⌘K / Ctrl+K 로 열고 닫기
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const results = useMemo(() => {
    if (query.trim()) return searchNav(query);
    const fav = favorites
      .map((h) => ALL_NAV_ITEMS.find((i) => i.href === h))
      .filter((i): i is (typeof ALL_NAV_ITEMS)[number] => !!i);
    const primary = ADMIN_NAV.flatMap((h) =>
      h.items.filter((i) => i.primary && !favorites.includes(i.href)).map((i) => ({ ...i, hubId: h.id, hubLabel: h.label })),
    );
    return [...fav, ...primary];
  }, [query, favorites]);

  function go(href: string) {
    onOpenChange(false);
    setQuery("");
    setCursor(0);
    setAi({ status: "idle" });
    router.push(href);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setQuery("");
          setCursor(0);
          setAi({ status: "idle" });
        }
      }}
    >
      <DialogContent showCloseButton={false} className="top-[15%] translate-y-0 gap-0 p-0 sm:max-w-lg">
        <DialogTitle className="sr-only">메뉴 검색</DialogTitle>
        <div className="border-b border-[var(--border)] p-3">
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
              if (ai.status !== "loading") setAi({ status: "idle" });
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor((c) => Math.min(c + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setCursor((c) => Math.max(c - 1, 0));
              } else if (e.key === "Enter" && results[cursor]) {
                e.preventDefault();
                go(results[cursor].href);
              } else if (e.key === "Enter" && results.length === 0) {
                // 맞는 메뉴가 없으면 질문으로 보고 AI에게 묻는다
                e.preventDefault();
                void askAi();
              }
            }}
            placeholder="무엇을 하시겠어요? 예: 영수증 발급, 결제 실패 확인, 직원 초대…"
            aria-label="메뉴 검색"
            aria-controls="nav-palette-results"
            aria-activedescendant={results[cursor] ? `nav-opt-${cursor}` : undefined}
            className="w-full bg-transparent px-1 text-sm text-[var(--text)] outline-none placeholder:text-[var(--muted-2)]"
          />
        </div>
        {query.trim().length >= 4 && (
          <div className="border-b border-[var(--border)] px-3 py-2">
            {ai.status === "idle" && (
              <button
                type="button"
                onClick={askAi}
                className="w-full rounded-lg px-2.5 py-2 text-left text-sm text-[var(--accent)] transition-colors hover:bg-[var(--accent-soft)]"
              >
                AI에게 물어보기: “{query.trim()}”
              </button>
            )}
            {ai.status === "loading" && (
              <p role="status" className="px-2.5 py-2 text-sm text-[var(--muted-foreground)]">
                답을 찾는 중…
              </p>
            )}
            {ai.status === "error" && (
              <p role="alert" className="px-2.5 py-2 text-sm text-[var(--muted-foreground)]">
                {ai.message}
              </p>
            )}
            {ai.status === "done" && (
              <div role="status" className="space-y-2 px-2.5 py-2 text-sm">
                <p className="text-[var(--text)]">{ai.answer}</p>
                {ai.steps.length > 0 && (
                  <ol className="list-decimal space-y-0.5 pl-5 text-[var(--muted-foreground)]">
                    {ai.steps.map((st, i) => (
                      <li key={i}>{st}</li>
                    ))}
                  </ol>
                )}
                {ai.links.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {ai.links.map((l) => (
                      <button
                        key={l.href}
                        type="button"
                        onClick={() => go(l.href)}
                        className="rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-white hover:bg-[var(--accent-hover)]"
                      >
                        {l.label} 열기
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-[var(--muted-2)]">AI 답변은 틀릴 수 있어요. 세금·법률 판단은 세무사에게 확인하세요.</p>
              </div>
            )}
          </div>
        )}
        <ul id="nav-palette-results" role="listbox" className="max-h-80 overflow-y-auto p-2">
          {!query.trim() && (
            <li className="px-2.5 pb-1 pt-0.5 text-[11px] font-medium text-[var(--muted-2)]">
              {favorites.length ? "즐겨찾기 · 주요 메뉴" : "주요 메뉴"}
            </li>
          )}
          {results.length === 0 && (
            <li className="px-2.5 py-6 text-center text-sm text-[var(--muted-foreground)]">
              맞는 메뉴가 없습니다. Enter를 누르면 AI에게 물어봐요.
            </li>
          )}
          {results.map((r, i) => (
            <li
              key={r.href}
              id={`nav-opt-${i}`}
              role="option"
              aria-selected={i === cursor}
              onMouseEnter={() => setCursor(i)}
              onClick={() => go(r.href)}
              className={`flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-sm ${
                i === cursor ? "bg-[var(--surface-2)] text-[var(--text)]" : "text-[var(--muted-foreground)]"
              }`}
            >
              <span className="min-w-0">
                <span className="block font-medium text-[var(--text)]">{r.label}</span>
                <span className="block truncate text-xs text-[var(--muted-foreground)]">{r.desc}</span>
              </span>
              <span className="ml-3 shrink-0 text-xs text-[var(--muted-2)]">{r.hubLabel}</span>
            </li>
          ))}
        </ul>
        <div className="flex gap-3 border-t border-[var(--border)] px-4 py-2 text-[11px] text-[var(--muted-2)]">
          <span>↑↓ 이동</span>
          <span>Enter 열기</span>
          <span>Esc 닫기</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
