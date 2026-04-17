/**
 * Tiptap JSON → 인라인 CSS 이메일 HTML 변환기.
 * 1. JSON 재귀 순회 → HTML 생성
 * 2. {{variable}} 치환
 * 3. 기관 테마(accent, logo) 래핑
 */

type TiptapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
};

export type ThemeInput = {
  accent?: string;
  logoUrl?: string | null;
  orgName: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
};

// ── 노드 → HTML 변환 ────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderMarks(text: string, marks?: TiptapNode['marks']): string {
  let out = escapeHtml(text);
  if (!marks) return out;
  for (const mark of marks) {
    switch (mark.type) {
      case 'bold':
        out = `<strong>${out}</strong>`;
        break;
      case 'italic':
        out = `<em>${out}</em>`;
        break;
      case 'link': {
        const href = (mark.attrs?.href as string) ?? '#';
        out = `<a href="${escapeHtml(href)}" style="color:inherit;text-decoration:underline">${out}</a>`;
        break;
      }
    }
  }
  return out;
}

function renderNode(node: TiptapNode, _accent: string): string {
  switch (node.type) {
    case 'doc':
      return (node.content ?? []).map((n) => renderNode(n, _accent)).join('');

    case 'paragraph':
      return `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#333">${renderChildren(node, _accent)}</p>`;

    case 'heading': {
      const level = (node.attrs?.level as number) ?? 2;
      const size = level === 2 ? '20px' : '16px';
      return `<h${level} style="margin:0 0 12px;font-size:${size};color:#111">${renderChildren(node, _accent)}</h${level}>`;
    }

    case 'bulletList':
      return `<ul style="margin:0 0 12px;padding-left:20px">${renderChildren(node, _accent)}</ul>`;

    case 'orderedList':
      return `<ol style="margin:0 0 12px;padding-left:20px">${renderChildren(node, _accent)}</ol>`;

    case 'listItem':
      return `<li style="margin:0 0 4px">${renderChildren(node, _accent)}</li>`;

    case 'hardBreak':
      return '<br>';

    case 'text':
      return renderMarks(node.text ?? '', node.marks);

    default:
      return node.content ? renderChildren(node, _accent) : '';
  }
}

function renderChildren(node: TiptapNode, accent: string): string {
  return (node.content ?? []).map((n) => renderNode(n, accent)).join('');
}

// ── 변수 치환 ─────────────────────────────────────────────

export function substituteVariables(
  text: string,
  variables: Record<string, string>
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => variables[key] ?? `{{${key}}}`);
}

// ── 테마 래핑 ─────────────────────────────────────────────

function wrapWithTheme(bodyHtml: string, theme: ThemeInput): string {
  const accent = theme.accent ?? '#7c3aed';
  const logo = theme.logoUrl
    ? `<img src="${escapeHtml(theme.logoUrl)}" alt="${escapeHtml(theme.orgName)}" style="max-height:48px;width:auto;margin-bottom:16px" />`
    : '';
  const orgTitle = `<div style="font-size:18px;font-weight:700;color:${accent};margin-bottom:4px">${escapeHtml(theme.orgName)}</div>`;

  const contactParts: string[] = [];
  if (theme.contactPhone) contactParts.push(`전화: ${escapeHtml(theme.contactPhone)}`);
  if (theme.contactEmail) contactParts.push(`이메일: ${escapeHtml(theme.contactEmail)}`);
  const contactLine = contactParts.length > 0 ? `<div style="margin-top:4px">${contactParts.join(' | ')}</div>` : '';

  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(theme.orgName)}</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0">
<tr><td align="center">
  <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:100%">
    <tr><td style="padding:24px 32px 16px;border-bottom:2px solid ${accent}">
      ${logo}${orgTitle}
    </td></tr>
    <tr><td style="padding:24px 32px 32px">
      ${bodyHtml}
    </td></tr>
    <tr><td style="padding:16px 32px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#999;text-align:center">
      <div>본 메일은 발신 전용입니다.</div>
      ${contactLine}
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

// ── Public API ────────────────────────────────────────────

export function renderTemplate(
  bodyJson: Record<string, unknown>,
  variables: Record<string, string>,
  theme: ThemeInput
): string {
  const accent = theme.accent ?? '#7c3aed';
  const rawHtml = renderNode(bodyJson as TiptapNode, accent);
  const substituted = substituteVariables(rawHtml, variables);
  return wrapWithTheme(substituted, theme);
}

export function renderSubject(
  subjectTemplate: string,
  variables: Record<string, string>
): string {
  return substituteVariables(subjectTemplate, variables);
}
