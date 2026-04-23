import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkCsrf } from "@/lib/security/csrf";
import { hasAnyRole } from "@/lib/auth/admin-rbac";
import { logAudit } from "@/lib/audit";
import { generateMemberCode } from "@/lib/codes";

/**
 * G-D184: 회원 일괄 초대.
 *
 * POST /api/admin/members/batch-invite
 *   Content-Type: text/csv  (headers: email,name,phone,note)
 *   또는 JSON: { rows: [{ email, name, phone?, note? }] }
 *
 * 동작:
 *   1. 각 행에 대해 email + org_id 기준 upsert (존재하면 name/phone 업데이트)
 *   2. 신규 생성된 member 에 member_code 자동 부여
 *   3. 결과 요약(created, updated, skipped, failed) 반환
 *
 * 권한: super 또는 campaign_manager.
 * 한 번에 최대 500건.
 */
type InputRow = { email: string; name: string; phone?: string | null; note?: string | null };

export async function POST(req: NextRequest) {
  const csrf = checkCsrf(req);
  if (csrf) return csrf;
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant, user } = guard.ctx;
  if (
    !(await hasAnyRole(user.id, tenant.id, ["super", "campaign_manager"]))
  ) {
    return NextResponse.json(
      { error: "super 또는 campaign_manager 역할 필요" },
      { status: 403 }
    );
  }

  const ct = req.headers.get("content-type") ?? "";
  let rows: InputRow[];
  if (ct.includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as { rows?: unknown };
    rows = normalize(Array.isArray(body.rows) ? body.rows : []);
  } else {
    const text = await req.text();
    rows = parseCsv(text);
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "입력이 없습니다." }, { status: 400 });
  }
  if (rows.length > 500) {
    return NextResponse.json(
      { error: "한 번에 500건 까지만 처리합니다." },
      { status: 400 }
    );
  }

  const supabase = createSupabaseAdminClient();

  // 기존 member_code 의 최대 seq 기준
  const year = new Date().getFullYear();
  const { data: lastRows } = await supabase
    .from("members")
    .select("member_code")
    .eq("org_id", tenant.id)
    .like("member_code", `M-${year}%`)
    .order("member_code", { ascending: false })
    .limit(1);
  let nextSeq = 1;
  const lastCode = (lastRows?.[0]?.member_code ?? null) as string | null;
  const parsed = lastCode?.match(/^M-(\d{4})(\d{5})$/);
  if (parsed && Number(parsed[1]) === year) {
    nextSeq = Number(parsed[2]) + 1;
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const r of rows) {
    const emailLc = r.email.toLowerCase().trim();
    if (!emailLc || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLc)) {
      failed++;
      continue;
    }

    const { data: existing } = await supabase
      .from("members")
      .select("id, name, phone")
      .eq("org_id", tenant.id)
      .eq("email", emailLc)
      .maybeSingle();

    if (existing) {
      // name/phone 업데이트 (빈 값이면 유지)
      const u: Record<string, string | null> = {};
      if (r.name && existing.name !== r.name) u.name = r.name;
      if (r.phone && existing.phone !== r.phone) u.phone = r.phone;
      if (Object.keys(u).length === 0) {
        skipped++;
        continue;
      }
      const { error } = await supabase
        .from("members")
        .update(u)
        .eq("id", existing.id);
      if (error) failed++;
      else updated++;
    } else {
      const code = generateMemberCode(year, nextSeq++);
      const { error } = await supabase.from("members").insert({
        org_id: tenant.id,
        member_code: code,
        name: r.name,
        email: emailLc,
        phone: r.phone ?? null,
        status: "active",
        join_path: "batch_invite",
        note: r.note ?? null,
      });
      if (error) failed++;
      else created++;
    }
  }

  await logAudit({
    orgId: tenant.id,
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "member.invite",
    resourceType: "members",
    summary: `회원 일괄 초대 ${created}신규 / ${updated}업데이트 / ${skipped}동일 / ${failed}실패`,
    metadata: { created, updated, skipped, failed, total: rows.length },
  }).catch(() => {});

  return NextResponse.json({ ok: true, created, updated, skipped, failed });
}

function normalize(raw: unknown[]): InputRow[] {
  const out: InputRow[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const email = typeof o.email === "string" ? o.email : "";
    const name = typeof o.name === "string" ? o.name : "";
    if (!email || !name) continue;
    out.push({
      email,
      name,
      phone: typeof o.phone === "string" ? o.phone : null,
      note: typeof o.note === "string" ? o.note : null,
    });
  }
  return out;
}

function parseCsv(text: string): InputRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length <= 1) return [];
  const headers = splitCsvLine(lines[0]!).map((h) => h.toLowerCase().trim());
  const idxEmail = headers.indexOf("email");
  const idxName = headers.indexOf("name");
  const idxPhone = headers.indexOf("phone");
  const idxNote = headers.indexOf("note");
  if (idxEmail < 0 || idxName < 0) return [];
  const rows: InputRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]!);
    const email = cells[idxEmail] ?? "";
    const name = cells[idxName] ?? "";
    if (!email || !name) continue;
    rows.push({
      email,
      name,
      phone: idxPhone >= 0 ? (cells[idxPhone] ?? null) : null,
      note: idxNote >= 0 ? (cells[idxNote] ?? null) : null,
    });
  }
  return rows;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuote) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQuote = false;
      } else cur += ch;
    } else {
      if (ch === ",") {
        cells.push(cur);
        cur = "";
      } else if (ch === '"') inQuote = true;
      else cur += ch;
    }
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}
