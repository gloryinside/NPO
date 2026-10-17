"use client";

import { useEffect, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { useConfirm } from "@/components/ui/confirm-dialog";

const TYPES = ["notice", "faq"] as const;
type PostType = typeof TYPES[number];
const TYPE_LABEL: Record<PostType, string> = { notice: "공지사항", faq: "FAQ" };

const FAQ_CATEGORIES = [
  { value: "payment", label: "결제" },
  { value: "receipt", label: "영수증" },
  { value: "donation", label: "후원" },
  { value: "account", label: "계정" },
  { value: "other", label: "기타" },
];

type Post = {
  id: string;
  post_type: string;
  category: string | null;
  title: string;
  pinned: boolean;
  published: boolean;
  published_at: string | null;
  created_at: string;
};

function formatDate(iso: string) {
  try { return new Date(iso).toLocaleDateString("ko-KR"); } catch { return iso; }
}

export default function AdminBoardPage() {
  const confirm = useConfirm();
  const [tab, setTab] = useState<PostType>("notice");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [, startTransition] = useTransition();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("");
  const [pinned, setPinned] = useState(false);
  const [published, setPublished] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function load(type: PostType) {
    setLoading(true);
    const res = await fetch(`/api/admin/board?type=${type}`);
    if (res.ok) {
      const json = await res.json() as { posts: Post[] };
      setPosts(json.posts);
    }
    setLoading(false);
  }

  useEffect(() => { load(tab); }, [tab]);

  function resetForm() {
    setTitle(""); setBody(""); setCategory(""); setPinned(false); setPublished(true); setErr(""); setShowForm(false);
  }

  async function save() {
    setSaving(true); setErr("");
    const res = await fetch("/api/admin/board", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ post_type: tab, title, body, category: category || null, pinned, published }),
    });
    const data = await res.json().catch(() => ({})) as { error?: string };
    if (!res.ok) { setErr(data.error ?? "오류가 발생했습니다."); setSaving(false); return; }
    setSaving(false);
    resetForm();
    startTransition(() => { load(tab); });
  }

  async function togglePublish(post: Post) {
    await fetch(`/api/admin/board/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: !post.published }),
    });
    startTransition(() => { load(tab); });
  }

  async function togglePin(post: Post) {
    await fetch(`/api/admin/board/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: !post.pinned }),
    });
    startTransition(() => { load(tab); });
  }

  async function deletePost(id: string) {
    if (
      !(await confirm({
        title: "게시글을 삭제할까요?",
        description: "삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.",
        confirmText: "삭제",
        tone: "danger",
      }))
    )
      return;
    await fetch(`/api/admin/board/${id}`, { method: "DELETE" });
    startTransition(() => { load(tab); });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">게시판 관리</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            공지사항과 FAQ를 관리합니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
        >
          + 새 글 작성
        </button>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 border-b border-[var(--border)]">
        {TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--text)]"
            }`}
          >
            {TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      {/* 글 목록 */}
      {loading ? (
        <p className="text-sm text-[var(--muted-foreground)]">로딩 중...</p>
      ) : posts.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center border-[var(--border)] text-[var(--muted-foreground)] text-sm">
          등록된 {TYPE_LABEL[tab]}이 없습니다.
        </div>
      ) : (
        <ul className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          {posts.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
              <div className="flex items-center gap-2 shrink-0">
                {p.pinned && (
                  <Badge className="border-0 bg-[var(--accent-soft)] text-[var(--accent)] text-xs">📌 고정</Badge>
                )}
                {p.category && (
                  <Badge className="border-0 bg-[var(--surface-2)] text-[var(--muted-foreground)] text-xs">
                    {FAQ_CATEGORIES.find((c) => c.value === p.category)?.label ?? p.category}
                  </Badge>
                )}
              </div>
              <span className="flex-1 min-w-0 text-sm font-medium text-[var(--text)] truncate">
                {p.title}
              </span>
              <time className="text-xs text-[var(--muted-foreground)] shrink-0">
                {formatDate(p.created_at)}
              </time>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => togglePin(p)}
                  className="text-xs text-[var(--muted-foreground)] hover:text-[var(--text)] transition-colors"
                >
                  {p.pinned ? "고정 해제" : "고정"}
                </button>
                <button
                  type="button"
                  onClick={() => togglePublish(p)}
                  className={`text-xs transition-colors ${p.published ? "text-[var(--positive)]" : "text-[var(--muted-foreground)]"} hover:opacity-70`}
                >
                  {p.published ? "공개" : "비공개"}
                </button>
                <button
                  type="button"
                  onClick={() => deletePost(p.id)}
                  className="text-xs text-[var(--negative)] hover:opacity-70 transition-opacity"
                >
                  삭제
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* 글 작성 폼 (인라인 슬라이드) */}
      {showForm && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-4">
          <h2 className="text-base font-semibold text-[var(--text)]">
            {TYPE_LABEL[tab]} 작성
          </h2>

          {tab === "faq" && (
            <div>
              <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
                분류
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] outline-none"
              >
                <option value="">분류 선택</option>
                {FAQ_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
              제목
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목을 입력하세요"
              className="w-full rounded-lg border px-3 py-2 text-sm border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] outline-none placeholder:text-[var(--muted-foreground)]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
              내용
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              placeholder="내용을 입력하세요"
              className="w-full rounded-lg border px-3 py-2.5 text-sm border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] outline-none resize-none placeholder:text-[var(--muted-foreground)]"
            />
          </div>

          <div className="flex items-center gap-6 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
              <span className="text-[var(--text)]">상단 고정</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
              <span className="text-[var(--text)]">바로 공개</span>
            </label>
          </div>

          {err && <p className="text-xs text-[var(--negative)]">{err}</p>}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving || !title.trim() || !body.trim()}
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            >
              {saving ? "저장 중..." : "저장"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border px-4 py-2 text-sm font-medium text-[var(--muted-foreground)] border-[var(--border)] hover:bg-[var(--surface-2)] transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
