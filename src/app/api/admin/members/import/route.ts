import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseCsv } from "@/lib/csv";
import { generateMemberCode } from "@/lib/codes";
import { logAudit } from "@/lib/audit";

/**
 * POST /api/admin/members/import
 *
 * Form-data `file` 에 CSV 를 업로드해 후원자를 일괄 생성한다.
 *
 * 기대 헤더 (1행):
 *   이름, 연락처, 이메일, 생년월일, 회원유형, 상태, 유입경로, 메모
 *   name, phone, email, birth_date, member_type, status, join_path, note
 *
 * 동작:
 *   - phone 또는 email 이 기존 후원자와 일치하면 skip (중복 방지)
 *   - 이름 누락된 행은 skip (error 로 집계)
 *   - member_code 는 현재 org 의 해당연도 개수 + 1 부터 순차 할당
 *
 * 반환: { created, skipped, errors: [{row, reason}] }
 */

type Row = {
  name: string;
  phone: string | null;
  email: string | null;
  birth_date: string | null;
  member_type: "individual" | "corporate";
  status: "active" | "inactive" | "deceased";
  join_path: string | null;
  note: string | null;
};

// 한글·영문 헤더 모두 허용
const HEADER_MAP: Record<string, keyof Row> = {
  이름: "name",
  name: "name",
  연락처: "phone",
  phone: "phone",
  전화: "phone",
  이메일: "email",
  email: "email",
  생년월일: "birth_date",
  birth_date: "birth_date",
  birthday: "birth_date",
  회원유형: "member_type",
  member_type: "member_type",
  유형: "member_type",
  상태: "status",
  status: "status",
  유입경로: "join_path",
  join_path: "join_path",
  경로: "join_path",
  메모: "note",
  note: "note",
  비고: "note",
};

function normalizeMemberType(raw: string): Row["member_type"] {
  const s = raw.trim().toLowerCase();
  if (s === "법인" || s === "corporate" || s === "company") return "corporate";
  return "individual";
}

function normalizeStatus(raw: string): Row["status"] {
  const s = raw.trim().toLowerCase();
  if (s === "비활성" || s === "inactive") return "inactive";
  if (s === "사망" || s === "deceased") return "deceased";
  return "active";
}

function normalizeBirthDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  // 19901231 / 1990-12-31 / 1990.12.31 / 1990/12/31 모두 수용
  const digits = s.replace(/[^0-9]/g, "");
  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const user = await requireAdminUser();
  const tenant = await requireTenant();

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file 필드에 CSV 파일을 업로드해 주세요." }, { status: 400 });
  }

  const text = await file.text();
  let rows: string[][];
  try {
    rows = parseCsv(text);
  } catch (err) {
    return NextResponse.json(
      {
        error: `CSV 파싱 실패: ${
          err instanceof Error ? err.message : String(err)
        }. 첫 5줄을 확인하세요.`,
        preview: text.split("\n").slice(0, 5),
      },
      { status: 400 }
    );
  }

  if (rows.length < 2) {
    return NextResponse.json({ error: "CSV 에 데이터 행이 없습니다." }, { status: 400 });
  }

  // 헤더 매핑
  const header = rows[0].map((h) => h.trim());
  const colMap = new Map<number, keyof Row>();
  for (let i = 0; i < header.length; i++) {
    const key = HEADER_MAP[header[i].toLowerCase()] ?? HEADER_MAP[header[i]];
    if (key) colMap.set(i, key);
  }

  if (!Array.from(colMap.values()).includes("name")) {
    return NextResponse.json(
      { error: "이름(name) 컬럼을 찾을 수 없습니다." },
      { status: 400 }
    );
  }

  const supabase = createSupabaseAdminClient();
  const year = new Date().getFullYear();
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year + 1}-01-01`;

  // 현재 org 의 해당연도 member 개수 + 기존 phone/email 셋 로드
  const [{ count: seqBase }, { data: existingContacts }] = await Promise.all([
    supabase
      .from("members")
      .select("*", { count: "exact", head: true })
      .eq("org_id", tenant.id)
      .gte("created_at", yearStart)
      .lt("created_at", yearEnd),
    supabase
      .from("members")
      .select("phone, email")
      .eq("org_id", tenant.id),
  ]);

  let nextSeq = (seqBase ?? 0) + 1;
  const phones = new Set(
    (existingContacts ?? [])
      .map((m: { phone: string | null }) => m.phone?.trim())
      .filter((v): v is string => !!v && v.length > 0)
  );
  const emails = new Set(
    (existingContacts ?? [])
      .map((m: { email: string | null }) => m.email?.trim())
      .filter((v): v is string => !!v && v.length > 0)
  );

  let created = 0;
  let skipped = 0;
  const errors: Array<{ row: number; reason: string }> = [];
  const toInsert: Array<Record<string, unknown>> = [];

  // 데이터 행 처리 (헤더 이후)
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    const rec: Partial<Row> = {};

    for (const [colIdx, key] of colMap.entries()) {
      const raw = (cells[colIdx] ?? "").trim();
      if (!raw) continue;
      if (key === "member_type") rec[key] = normalizeMemberType(raw);
      else if (key === "status") rec[key] = normalizeStatus(raw);
      else if (key === "birth_date") rec[key] = normalizeBirthDate(raw);
      else rec[key] = raw;
    }

    if (!rec.name || !rec.name.trim()) {
      errors.push({ row: i + 1, reason: "이름 누락" });
      continue;
    }

    // 중복 체크 (CSV 내 중복 + DB 중복)
    if (rec.phone && phones.has(rec.phone)) {
      skipped++;
      continue;
    }
    if (rec.email && emails.has(rec.email)) {
      skipped++;
      continue;
    }

    const memberCode = generateMemberCode(year, nextSeq++);
    toInsert.push({
      org_id: tenant.id,
      member_code: memberCode,
      name: rec.name.trim(),
      phone: rec.phone ?? null,
      email: rec.email ?? null,
      birth_date: rec.birth_date ?? null,
      member_type: rec.member_type ?? "individual",
      status: rec.status ?? "active",
      join_path: rec.join_path ?? null,
      note: rec.note ?? null,
    });

    if (rec.phone) phones.add(rec.phone);
    if (rec.email) emails.add(rec.email);
  }

  // 배치 insert (200건 단위로 분할)
  const CHUNK = 200;
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const chunk = toInsert.slice(i, i + CHUNK);
    const { error } = await supabase.from("members").insert(chunk);
    if (error) {
      return NextResponse.json(
        {
          error: `DB 저장 실패: ${error.message}`,
          created,
          skipped,
          errors,
        },
        { status: 500 }
      );
    }
    created += chunk.length;
  }

  // 감사 로그
  await logAudit({
    orgId: tenant.id,
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "member.create",
    resourceType: "member",
    resourceId: null,
    summary: `CSV 대량 업로드: ${created}건 생성, ${skipped}건 스킵, ${errors.length}건 오류`,
    metadata: { created, skipped, errorCount: errors.length, fileName: file.name },
  });

  return NextResponse.json({
    created,
    skipped,
    errors,
    total: rows.length - 1,
  });
}
