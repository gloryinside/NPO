"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type AdminUser = {
  id: string;
  email: string | undefined;
  created_at: string;
  last_sign_in_at: string | null;
  confirmed: boolean;
};

function formatDate(val: string | null | undefined) {
  if (!val) return "-";
  try {
    return new Date(val).toLocaleDateString("ko-KR");
  } catch {
    return val;
  }
}

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) return;
      const data = await res.json();
      setUsers(data.users ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchUsers(); }, []);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError(null);
    setInviteSuccess(false);
    setInviting(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "초대 실패");
      setInviteSuccess(true);
      setInviteEmail("");
      fetchUsers();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setInviting(false);
    }
  }

  async function handleDelete(userId: string, email: string | undefined) {
    if (!confirm(`${email ?? userId} 계정을 삭제하시겠습니까?`)) return;
    const res = await fetch(`/api/admin/users?userId=${userId}`, { method: "DELETE" });
    if (res.ok) fetchUsers();
  }

  const inputCls = "bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)]";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">사용자 관리</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            관리자 계정을 초대하고 관리합니다.
          </p>
        </div>
        <Button
          onClick={() => {
            setShowInvite(true);
            setInviteSuccess(false);
            setInviteError(null);
          }}
          className="bg-[var(--accent)] text-white"
        >
          + 관리자 초대
        </Button>
      </div>

      <Dialog open={showInvite} onOpenChange={(v) => { if (!v) setShowInvite(false); }}>
        <DialogContent className="max-w-sm bg-[var(--surface)] border-[var(--border)]">
          <DialogHeader>
            <DialogTitle className="text-[var(--text)]">관리자 초대</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleInvite} className="flex flex-col gap-4 mt-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="invite-email" className="text-sm font-medium text-[var(--text)]">
                이메일 주소 <span className="text-[var(--negative)]">*</span>
              </label>
              <Input
                id="invite-email"
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="admin@example.com"
                className={inputCls}
              />
              <p className="text-xs text-[var(--muted-foreground)]">
                초대 메일이 발송되며, 수신자가 링크를 클릭하면 관리자 계정이 활성화됩니다.
              </p>
            </div>
            {inviteError && (
              <p className="text-sm rounded-lg border px-3 py-2 text-[var(--negative)] bg-[rgba(239,68,68,0.1)] border-[rgba(239,68,68,0.4)]">
                {inviteError}
              </p>
            )}
            {inviteSuccess && (
              <p className="text-sm rounded-lg border px-3 py-2 text-[var(--positive)] bg-[rgba(34,197,94,0.1)] border-[rgba(34,197,94,0.4)]">
                초대 메일이 발송되었습니다.
              </p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowInvite(false)}
                className="border-[var(--border)] text-[var(--text)] bg-[var(--surface-2)]"
              >
                닫기
              </Button>
              <Button
                type="submit"
                disabled={inviting}
                className="bg-[var(--accent)] text-white disabled:opacity-60"
              >
                {inviting ? "발송 중..." : "초대 발송"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <div className="rounded-lg border overflow-hidden border-[var(--border)] bg-[var(--surface)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="text-left px-4 py-3 text-[var(--muted-foreground)] font-medium">이메일</th>
              <th className="text-left px-4 py-3 text-[var(--muted-foreground)] font-medium">등록일</th>
              <th className="text-left px-4 py-3 text-[var(--muted-foreground)] font-medium">마지막 로그인</th>
              <th className="text-left px-4 py-3 text-[var(--muted-foreground)] font-medium">상태</th>
              <th className="px-4 py-3 text-[var(--muted-foreground)] font-medium">액션</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="text-center py-10 text-[var(--muted-foreground)]">
                  불러오는 중...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-10 text-[var(--muted-foreground)]">
                  등록된 관리자가 없습니다.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3 text-[var(--text)]">{u.email ?? "-"}</td>
                  <td className="px-4 py-3 text-[var(--muted-foreground)]">{formatDate(u.created_at)}</td>
                  <td className="px-4 py-3 text-[var(--muted-foreground)]">{formatDate(u.last_sign_in_at)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        u.confirmed
                          ? "bg-[rgba(34,197,94,0.15)] text-[var(--positive)]"
                          : "bg-[rgba(245,158,11,0.15)] text-[var(--warning)]"
                      }`}
                    >
                      {u.confirmed ? "활성" : "초대됨"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(u.id, u.email)}
                      className="text-xs text-[var(--negative)] hover:underline"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
