/**
 * 안전한 최소 markdown → HTML 렌더러.
 *   - 헤딩 (# / ## / ###), 단락, 빈 줄, 굵게(**), 기울임(*), 인라인 코드(`)
 *   - 링크 [text](url) — http(s) 만 허용
 *   - 순서·비순서 리스트 (한 줄 단위, 중첩 없음)
 *
 * HTML injection 방지를 위해 입력을 우선 전부 이스케이프한 뒤 패턴만 재치환.
 * 외부 라이브러리 부담 없이 개인정보처리방침/약관 같은 간단한 법적 문서에 충분.
 */
const RE_H3 = /^###\s+(.+)$/;
const RE_H2 = /^##\s+(.+)$/;
const RE_H1 = /^#\s+(.+)$/;
const RE_OL = /^(\d+)\.\s+(.+)$/;
const RE_UL = /^[-*]\s+(.+)$/;

export function renderSimpleMarkdown(src: string): string {
  const esc = escapeHtml(src);

  const lines = esc.split(/\r?\n/);
  const out: string[] = [];
  let inUl = false;
  let inOl = false;
  let paraBuf: string[] = [];

  const flushPara = () => {
    if (paraBuf.length === 0) return;
    const joined = paraBuf.join(" ");
    out.push(`<p>${inlineMd(joined)}</p>`);
    paraBuf = [];
  };
  const closeLists = () => {
    if (inUl) {
      out.push("</ul>");
      inUl = false;
    }
    if (inOl) {
      out.push("</ol>");
      inOl = false;
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushPara();
      closeLists();
      continue;
    }
    const mh3 = line.match(RE_H3);
    const mh2 = line.match(RE_H2);
    const mh1 = line.match(RE_H1);
    if (mh1 || mh2 || mh3) {
      flushPara();
      closeLists();
      if (mh1) out.push(`<h1>${inlineMd(mh1[1]!)}</h1>`);
      else if (mh2) out.push(`<h2>${inlineMd(mh2[1]!)}</h2>`);
      else if (mh3) out.push(`<h3>${inlineMd(mh3[1]!)}</h3>`);
      continue;
    }
    const mol = line.match(RE_OL);
    if (mol) {
      flushPara();
      if (!inOl) {
        closeLists();
        out.push("<ol>");
        inOl = true;
      }
      out.push(`<li>${inlineMd(mol[2]!)}</li>`);
      continue;
    }
    const mul = line.match(RE_UL);
    if (mul) {
      flushPara();
      if (!inUl) {
        closeLists();
        out.push("<ul>");
        inUl = true;
      }
      out.push(`<li>${inlineMd(mul[1]!)}</li>`);
      continue;
    }
    closeLists();
    paraBuf.push(line);
  }
  flushPara();
  closeLists();

  return out.join("\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function inlineMd(s: string): string {
  let out = s.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  return out;
}
