"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/layer";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { JOIN_PATHS } from "@/lib/donations/donor-profile";
import { TIERS, TIER_LABEL, describeSegment, type SegmentFilter, type SegmentMember } from "@/lib/members/segments";

/** 조건 저장형 후원자 명단 — 조건을 이름 붙여 저장해 두고 언제든 지금 인원으로 다시 본다 */

export type SegmentRow = { id: string; name: string; filters: SegmentFilter; count: number };
type Tag = { id: string; name: string };

/** 자주 쓰는 조건 묶음 — 처음 쓰는 기관이 바로 고를 수 있게 */
const PRESETS: Array<{ name: string; filters: SegmentFilter }> = [
  { name: "미납 2회 이상", filters: { status: "active", has_active_regular: true, unpaid_min: 2 } },
  { name: "1년 이상 정기후원자", filters: { status: "active", has_active_regular: true, regular_months_min: 12 } },
  { name: "6개월 넘게 후원이 없는 분", filters: { status: "active", has_active_regular: false, last_gift_days_min: 180 } },
  { name: "고액 후원자(골드 이상)", filters: { status: "active", tiers: ["gold", "platinum", "diamond"] } },
];

const sel = "h-9 w-full rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 text-sm text-[var(--text)]";

function Chips({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((c) => (
        <span key={c} className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-xs text-[var(--text)]">
          {c}
        </span>
      ))}
    </div>
  );
}

async function download(id: string, name: string) {
  const res = await fetch(`/api/admin/segments/${id}/export`);
  if (!res.ok) return void toast.error("내려받지 못했습니다.");
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function SegmentBoard({ segments, tags }: { segments: SegmentRow[]; tags: Tag[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const tagNames = useMemo(() => Object.fromEntries(tags.map((t) => [t.id, t.name])), [tags]);
  const [editing, setEditing] = useState<{ id?: string; name: string; filters: SegmentFilter } | null>(null);
  const [viewing, setViewing] = useState<SegmentRow | null>(null);

  async function remove(s: SegmentRow) {
    const ok = await confirm({
      title: `'${s.name}' 명단을 지울까요?`,
      description: "저장한 조건만 지워지고 후원자 정보는 그대로예요.",
      confirmText: "지우기",
      tone: "danger",
    });
    if (!ok) return;
    const res = await fetch(`/api/admin/segments/${s.id}`, { method: "DELETE" });
    if (!res.ok) return void toast.error("지우지 못했습니다.");
    toast.success("명단을 지웠어요");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">후원자 명단</h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted-foreground)]">
            &lsquo;미납 2회 이상&rsquo;, &lsquo;1년 이상 정기후원자&rsquo;처럼 조건을 저장해 두면 언제든 지금 기준 인원으로 다시 볼 수 있어요. 엑셀로 내려받아 안내 전화나 문자에 쓰세요.
          </p>
        </div>
        <Button onClick={() => setEditing({ name: "", filters: { status: "active" } })}>+ 새 명단 만들기</Button>
      </div>

      {segments.length === 0 ? (
        <div className="space-y-3 rounded-xl border border-dashed border-[var(--border)] p-6">
          <p className="text-sm text-[var(--text)]">아직 저장한 명단이 없어요. 자주 쓰는 조건으로 시작해 보세요.</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Button key={p.name} variant="outline" size="sm" onClick={() => setEditing({ name: p.name, filters: p.filters })}>
                {p.name}
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          {segments.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-4">
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="font-semibold text-[var(--text)]">{s.name}</p>
                <Chips items={describeSegment(s.filters, tagNames)} />
              </div>
              <p className="text-sm font-semibold tabular-nums text-[var(--text)]">{s.count.toLocaleString("ko-KR")}명</p>
              <div className="flex flex-wrap gap-1.5">
                <Button variant="outline" size="sm" onClick={() => setViewing(s)}>
                  명단 보기
                </Button>
                <Button variant="outline" size="sm" onClick={() => download(s.id, s.name)}>
                  엑셀
                </Button>
                <Button variant="outline" size="sm" onClick={() => setEditing({ id: s.id, name: s.name, filters: s.filters })}>
                  고치기
                </Button>
                <Button variant="outline" size="sm" onClick={() => remove(s)} className="text-[var(--negative)]">
                  지우기
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <EditSheet
          initial={editing}
          tags={tags}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
      {viewing && <ViewSheet segment={viewing} tagNames={tagNames} onClose={() => setViewing(null)} />}
    </div>
  );
}

function usePreview(filters: SegmentFilter) {
  const [state, setState] = useState<{ count: number; members: SegmentMember[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const key = JSON.stringify(filters);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/admin/segments/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: key.length ? JSON.stringify({ filters: JSON.parse(key) }) : "{}",
        });
        const data = (await res.json()) as { count: number; members: SegmentMember[] };
        if (alive && res.ok) setState(data);
      } finally {
        if (alive) setLoading(false);
      }
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [key]);
  return { state, loading };
}

function EditSheet({
  initial,
  tags,
  onClose,
  onSaved,
}: {
  initial: { id?: string; name: string; filters: SegmentFilter };
  tags: Tag[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [f, setF] = useState<SegmentFilter>(initial.filters);
  const [saving, setSaving] = useState(false);
  const { state, loading } = usePreview(f);

  /** 값이 비면 조건에서 뺀다 */
  function set<K extends keyof SegmentFilter>(k: K, v: SegmentFilter[K] | undefined) {
    setF((prev) => {
      const next = { ...prev };
      if (v === undefined || v === null || (Array.isArray(v) && v.length === 0)) delete next[k];
      else next[k] = v;
      return next;
    });
  }
  const num = (v: string) => (v.trim() === "" ? undefined : Number(v));
  const bool = (v: string) => (v === "" ? undefined : v === "yes");

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(initial.id ? `/api/admin/segments/${initial.id}` : "/api/admin/segments", {
        method: initial.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, filters: f }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "저장하지 못했습니다.");
      toast.success("명단을 저장했어요");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={initial.id ? "명단 고치기" : "새 명단 만들기"}
      description="조건은 모두 함께 맞아야 해요(그리고). 비워 둔 조건은 따지지 않아요."
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <p className="text-sm tabular-nums text-[var(--text)]" role="status" aria-live="polite">
            {loading ? "세는 중…" : state ? `지금 ${state.count.toLocaleString("ko-KR")}명` : ""}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              취소
            </Button>
            <Button onClick={save} loading={saving} disabled={!name.trim()}>
              저장
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <label className="block space-y-1.5 text-sm font-medium text-[var(--text)]">
          명단 이름
          <Input id="segment-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="예: 미납 2회 이상" />
        </label>

        <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-semibold text-[var(--text)]">후원 상태</legend>
          <label className="space-y-1 text-sm text-[var(--text)]">
            정기후원
            <select id="seg-regular" className={sel} value={f.has_active_regular === undefined ? "" : f.has_active_regular ? "yes" : "no"} onChange={(e) => set("has_active_regular", bool(e.target.value))}>
              <option value="">상관없음</option>
              <option value="yes">하는 중</option>
              <option value="no">안 함</option>
            </select>
          </label>
          <label className="space-y-1 text-sm text-[var(--text)]">
            결제 방법
            <select id="seg-pay" className={sel} value={f.pay_method ?? ""} onChange={(e) => set("pay_method", (e.target.value || undefined) as SegmentFilter["pay_method"])}>
              <option value="">상관없음</option>
              <option value="card">카드</option>
              <option value="cms">자동이체(CMS)</option>
              <option value="transfer">계좌이체</option>
              <option value="manual">직접 받음</option>
            </select>
          </label>
          <label className="space-y-1 text-sm text-[var(--text)]">
            정기후원 기간 (개월 이상)
            <Input id="seg-months" type="number" min={1} value={f.regular_months_min ?? ""} onChange={(e) => set("regular_months_min", num(e.target.value))} placeholder="예: 12" />
          </label>
          <label className="space-y-1 text-sm text-[var(--text)]">
            최근 6개월 미납 (회 이상)
            <Input id="seg-unpaid" type="number" min={1} value={f.unpaid_min ?? ""} onChange={(e) => set("unpaid_min", num(e.target.value))} placeholder="예: 2" />
          </label>
          <label className="space-y-1 text-sm text-[var(--text)] sm:col-span-2">
            마지막 후원 뒤로 (일 이상 지남)
            <Input id="seg-lastgift" type="number" min={1} value={f.last_gift_days_min ?? ""} onChange={(e) => set("last_gift_days_min", num(e.target.value))} placeholder="예: 180 — 오래 후원이 없는 분" />
          </label>
        </fieldset>

        <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-semibold text-[var(--text)]">후원자 정보</legend>
          <label className="space-y-1 text-sm text-[var(--text)]">
            활동 상태
            <select id="seg-status" className={sel} value={f.status ?? ""} onChange={(e) => set("status", (e.target.value || undefined) as SegmentFilter["status"])}>
              <option value="">상관없음</option>
              <option value="active">활동 중</option>
              <option value="inactive">활동 안 함</option>
            </select>
          </label>
          <label className="space-y-1 text-sm text-[var(--text)]">
            구분
            <select id="seg-type" className={sel} value={f.member_type ?? ""} onChange={(e) => set("member_type", (e.target.value || undefined) as SegmentFilter["member_type"])}>
              <option value="">상관없음</option>
              <option value="individual">개인</option>
              <option value="corporate">기업·단체</option>
            </select>
          </label>
          <label className="space-y-1 text-sm text-[var(--text)]">
            생일이 있는 달
            <select id="seg-bmonth" className={sel} value={f.birthday_month ?? ""} onChange={(e) => set("birthday_month", e.target.value ? Number(e.target.value) : undefined)}>
              <option value="">상관없음</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}월
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm text-[var(--text)]">
            마케팅 수신
            <select id="seg-mkt" className={sel} value={f.marketing_consent === undefined ? "" : f.marketing_consent ? "yes" : "no"} onChange={(e) => set("marketing_consent", bool(e.target.value))}>
              <option value="">상관없음</option>
              <option value="yes">동의함</option>
              <option value="no">동의 안 함</option>
            </select>
          </label>
          <label className="space-y-1 text-sm text-[var(--text)]">
            알게 된 경로
            <select id="seg-join" className={sel} value={f.join_path ?? ""} onChange={(e) => set("join_path", e.target.value || undefined)}>
              <option value="">상관없음</option>
              {JOIN_PATHS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm text-[var(--text)]">
            분류(태그)
            <select id="seg-tag" className={sel} value={f.tag_id ?? ""} onChange={(e) => set("tag_id", e.target.value || undefined)}>
              <option value="">상관없음</option>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <div className="space-y-1 text-sm text-[var(--text)] sm:col-span-2">
            <span>등급 (하나라도 맞으면)</span>
            <div className="flex flex-wrap gap-2">
              {TIERS.map((t) => {
                const on = f.tiers?.includes(t) ?? false;
                return (
                  <label key={t} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => set("tiers", on ? (f.tiers ?? []).filter((x) => x !== t) : [...(f.tiers ?? []), t])}
                    />
                    {TIER_LABEL[t]}
                  </label>
                );
              })}
            </div>
          </div>
        </fieldset>
      </div>
    </Sheet>
  );
}

function ViewSheet({ segment, tagNames, onClose }: { segment: SegmentRow; tagNames: Record<string, string>; onClose: () => void }) {
  const { state, loading } = usePreview(segment.filters);
  return (
    <Sheet
      open
      onClose={onClose}
      title={segment.name}
      description={describeSegment(segment.filters, tagNames).join(" · ")}
      footer={
        <div className="flex w-full items-center justify-between">
          <p className="text-sm tabular-nums text-[var(--text)]">{state ? `${state.count.toLocaleString("ko-KR")}명` : ""}</p>
          <Button onClick={() => download(segment.id, segment.name)}>엑셀로 내려받기</Button>
        </div>
      }
    >
      {loading && !state ? (
        <p className="text-sm text-[var(--muted-foreground)]">불러오는 중…</p>
      ) : !state || state.members.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)]">지금 조건에 맞는 후원자가 없어요.</p>
      ) : (
        <div className="space-y-2">
          {state.count > state.members.length && (
            <p className="text-xs text-[var(--muted-foreground)]">앞쪽 {state.members.length}명만 보여요. 전체는 엑셀로 내려받으세요.</p>
          )}
          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-2)] text-left text-xs text-[var(--muted-foreground)]">
                <tr>
                  <th className="px-3 py-2">이름</th>
                  <th className="px-3 py-2">휴대폰</th>
                  <th className="px-3 py-2">등급</th>
                </tr>
              </thead>
              <tbody>
                {state.members.map((m) => (
                  <tr key={m.id} className="border-t border-[var(--border)]">
                    <td className="px-3 py-2">
                      <a href={`/admin/members/${m.id}`} className="text-[var(--accent)] hover:underline">
                        {m.name}
                      </a>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{m.phone ?? "-"}</td>
                    <td className="px-3 py-2">{m.tier ? (TIER_LABEL as Record<string, string>)[m.tier] ?? m.tier : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Sheet>
  );
}
