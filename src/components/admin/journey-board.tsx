"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/layer";
import type { JourneyStepView } from "@/lib/journey/admin";
import { renderJourneyEmail } from "@/lib/journey/render";
import { JOURNEY_VARIABLES, type JourneyVariable } from "@/lib/journey/steps";

/** 후원자 여정 메시지 — 정해진 시점에 자동으로 나가는 안내를 켜고 문구를 고친다 */

const SAMPLE: Record<JourneyVariable, string> = {
  이름: "홍길동",
  기관명: "우리 기관",
  금액: "30,000원",
  시작일: "2025-10-17",
  후원기간: "1년",
  마이페이지: "https://우리기관.example/donor",
};

async function save(key: string, value: { enabled: boolean; subject: string; body: string }) {
  const res = await fetch(`/api/admin/journeys/${key}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? "저장하지 못했습니다.");
}

function Toggle({ on, label, disabled, onChange }: { on: boolean; label: string; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:opacity-50 ${
        on ? "bg-[var(--accent)]" : "bg-[var(--border)]"
      }`}
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform motion-reduce:transition-none ${on ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
}

export function JourneyBoard({ steps }: { steps: JourneyStepView[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<JourneyStepView | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(s: JourneyStepView, enabled: boolean) {
    setBusy(s.key);
    try {
      await save(s.key, { enabled, subject: s.subject, body: s.body });
      toast.success(enabled ? `'${s.title}'을 켰어요` : `'${s.title}'을 껐어요`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장하지 못했습니다.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">후원자 여정 메시지</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--muted-foreground)]">
          후원을 시작한 다음 날, 첫 후원 한 달 뒤, 기념일과 생일처럼 정해진 때에 이메일이 자동으로 나가요. 필요한 것만 켜고 문구를 우리 기관 말투로 고쳐 주세요.
          한 후원자에게 같은 안내는 한 번만 갑니다. 매일 오전 11시에 보냅니다.
        </p>
      </div>

      <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        {steps.map((s) => (
          <li key={s.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-4">
            <Toggle on={s.enabled} label={`${s.title} 켜기`} disabled={busy === s.key} onChange={(v) => toggle(s, v)} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-[var(--text)]">{s.title}</p>
              <p className="text-xs text-[var(--muted-foreground)]">{s.when}</p>
              <p className="mt-1 truncate text-sm text-[var(--text)]" title={s.subject}>
                제목: {s.subject}
              </p>
            </div>
            <div className="text-right text-xs tabular-nums text-[var(--muted-foreground)]">
              최근 30일 {s.sent30.toLocaleString("ko-KR")}명
              {s.failed30 > 0 && <span className="block text-[var(--negative)]">보내지 못함 {s.failed30.toLocaleString("ko-KR")}명</span>}
            </div>
            <Button variant="outline" size="sm" onClick={() => setEditing(s)}>
              문구 고치기
            </Button>
          </li>
        ))}
      </ul>

      <p className="text-xs text-[var(--muted-foreground)]">
        반송된 이메일 주소, 알림을 끈 후원자, 활동 중이 아닌 후원자에게는 보내지 않아요. 카카오 알림톡은 연동 후 고를 수 있게 됩니다.
      </p>

      {editing && (
        <EditSheet
          step={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function EditSheet({ step, onClose, onSaved }: { step: JourneyStepView; onClose: () => void; onSaved: () => void }) {
  const [subject, setSubject] = useState(step.subject);
  const [body, setBody] = useState(step.body);
  const [enabled, setEnabled] = useState(step.enabled);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const preview = renderJourneyEmail({ subject, body }, SAMPLE, { orgName: SAMPLE.기관명, settingsUrl: "https://우리기관.example/donor/settings" });

  function insertVar(v: JourneyVariable) {
    const el = bodyRef.current;
    const token = `{{${v}}}`;
    if (!el) return setBody((b) => b + token);
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  async function onSave() {
    setSaving(true);
    try {
      await save(step.key, { enabled, subject, body });
      toast.success("저장했어요");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function onTest() {
    setTesting(true);
    try {
      const res = await fetch(`/api/admin/journeys/${step.key}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; to?: string };
      if (!res.ok) throw new Error(data.error ?? "보내지 못했습니다.");
      toast.success(`${data.to}로 미리보기를 보냈어요`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "보내지 못했습니다.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={step.title}
      description={step.when}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <Button variant="outline" onClick={onTest} loading={testing}>
            내 이메일로 미리 받기
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              취소
            </Button>
            <Button onClick={onSave} loading={saving}>
              저장
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <label className="flex items-center gap-3 text-sm text-[var(--text)]">
          <Toggle on={enabled} label="이 안내 켜기" onChange={setEnabled} />
          {enabled ? "켜져 있어요 — 다음 발송부터 나갑니다" : "꺼져 있어요"}
        </label>

        <div className="space-y-1.5">
          <label htmlFor="journey-subject" className="text-sm font-medium text-[var(--text)]">
            제목
          </label>
          <Input id="journey-subject" value={subject} maxLength={120} onChange={(e) => setSubject(e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="journey-body" className="text-sm font-medium text-[var(--text)]">
            본문
          </label>
          <div className="flex flex-wrap gap-1.5" aria-label="넣을 수 있는 값">
            {JOURNEY_VARIABLES.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => insertVar(v)}
                className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-0.5 text-xs text-[var(--text)] hover:border-[var(--accent)]"
              >
                + {v}
              </button>
            ))}
          </div>
          <textarea
            id="journey-body"
            ref={bodyRef}
            value={body}
            maxLength={3000}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm leading-relaxed text-[var(--text)]"
          />
          <p className="text-xs text-[var(--muted-foreground)]">빈 줄로 문단을 나눠요. 버튼을 누르면 커서 자리에 값이 들어가요.</p>
        </div>

        <section aria-label="미리보기" className="space-y-1.5">
          <p className="text-sm font-medium text-[var(--text)]">미리보기 (예시 후원자: 홍길동)</p>
          <div className="rounded-lg border border-[var(--border)] bg-white text-[#1f2937]">
            <p className="border-b border-gray-200 px-4 py-2 text-sm font-semibold">{preview.subject}</p>
            {/* renderJourneyEmail이 문구·값을 모두 이스케이프한 HTML이다 */}
            <div dangerouslySetInnerHTML={{ __html: preview.html }} />
          </div>
        </section>
      </div>
    </Sheet>
  );
}
