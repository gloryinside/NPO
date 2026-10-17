/**
 * 여정 메시지 문구 채우기 — 순수 함수.
 * 문구와 값 모두 HTML로 해석하지 않는다(이스케이프). 줄바꿈은 문단·줄바꿈으로, 주소는 링크로 바꾼다.
 */
import type { JourneyVariable } from "./steps";

export type JourneyVars = Partial<Record<JourneyVariable, string>>;

export function fillText(template: string, vars: JourneyVars): string {
  return template.replace(/\{\{\s*([^}\s]+)\s*\}\}/g, (m, name: string) =>
    name in vars ? (vars[name as JourneyVariable] ?? "") : m,
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function linkify(escaped: string): string {
  return escaped.replace(/https?:\/\/[^\s<]+/g, (url) => `<a href="${url}" style="color:#1f5e5b">${url}</a>`);
}

/** 제목은 한 줄 평문, 본문은 이메일 HTML */
export function renderJourneyEmail(
  t: { subject: string; body: string },
  vars: JourneyVars,
  footer: { orgName: string; settingsUrl: string | null; ad?: boolean },
): { subject: string; html: string; text: string } {
  const plain = fillText(t.subject, vars).replace(/[\r\n]+/g, " ").trim();
  // 광고성 메일(마케팅 동의자 대상)은 제목 앞에 '(광고)' — 정보통신망법 제50조
  const subject = (footer.ad && !plain.startsWith("(광고)") ? `(광고) ${plain}` : plain).slice(0, 200);
  const text = fillText(t.body, vars);
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${linkify(escapeHtml(p)).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const settings = footer.settingsUrl
    ? `더 받고 싶지 않으시면 <a href="${escapeHtml(footer.settingsUrl)}" style="color:#6b7280">알림 설정</a>에서 끌 수 있습니다.`
    : "더 받고 싶지 않으시면 이 메일에 답장해 주세요.";
  const adNote = footer.ad ? "광고성 정보 수신에 동의하신 분께 보내는 메일입니다. " : "";
  const html = `<div style="font-family:-apple-system,'Noto Sans KR','Apple SD Gothic Neo',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937;font-size:15px;line-height:1.7">${paragraphs}<hr style="border:0;border-top:1px solid #e5e7eb;margin:24px 0 12px"><p style="font-size:12px;color:#6b7280;margin:0">${escapeHtml(footer.orgName)} · ${adNote}${settings}</p></div>`;
  return { subject, html, text };
}
