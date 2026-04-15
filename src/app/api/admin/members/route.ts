import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { generateMemberCode } from "@/lib/codes";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function GET(req: NextRequest) {
  await requireAdminUser();

  let tenant;
  try {
    tenant = await requireTenant();
  } catch {
    return NextResponse.json({ error: "Tenant not found" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const statusParam = searchParams.get("status") ?? "active";
  const limit = Math.min(
    Math.max(Number(searchParams.get("limit")) || DEFAULT_LIMIT, 1),
    MAX_LIMIT
  );
  const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);

  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("members")
    .select("*", { count: "exact" })
    .eq("org_id", tenant.id);

  if (statusParam !== "all") {
    query = query.eq("status", statusParam);
  }

  if (q) {
    // 이름/연락처/이메일 부분일치 검색
    const escaped = q.replace(/[%,()]/g, "");
    query = query.or(
      `name.ilike.%${escaped}%,phone.ilike.%${escaped}%,email.ilike.%${escaped}%`
    );
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ members: data ?? [], total: count ?? 0 });
}

/**
 * POST /api/admin/members
 * 어드민이 후원자를 수동으로 등록한다.
 */
export async function POST(req: NextRequest) {
  await requireAdminUser();

  let tenant;
  try {
    tenant = await requireTenant();
  } catch {
    return NextResponse.json({ error: "Tenant not found" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, phone, email, birthDate, memberType, joinPath, note } = body as {
    name?: string;
    phone?: string;
    email?: string;
    birthDate?: string;
    memberType?: string;
    joinPath?: string;
    note?: string;
  };

  if (!name || typeof name !== "string" || !name.trim())
    return NextResponse.json({ error: "이름은 필수입니다." }, { status: 400 });

  const supabase = createSupabaseAdminClient();

  // 중복 체크: phone 또는 email이 이미 이 기관에 있으면 오류
  if (phone) {
    const { data: dup } = await supabase
      .from("members")
      .select("id")
      .eq("org_id", tenant.id)
      .eq("phone", phone.trim())
      .maybeSingle();
    if (dup)
      return NextResponse.json(
        { error: "같은 연락처의 후원자가 이미 존재합니다." },
        { status: 409 }
      );
  }

  if (email) {
    const { data: dup } = await supabase
      .from("members")
      .select("id")
      .eq("org_id", tenant.id)
      .eq("email", email.trim())
      .maybeSingle();
    if (dup)
      return NextResponse.json(
        { error: "같은 이메일의 후원자가 이미 존재합니다." },
        { status: 409 }
      );
  }

  const year = new Date().getFullYear();
  const { count: memberCount } = await supabase
    .from("members")
    .select("*", { count: "exact", head: true })
    .eq("org_id", tenant.id);

  const seq = (memberCount ?? 0) + 1;
  const memberCode = generateMemberCode(year, seq);

  const { data: member, error } = await supabase
    .from("members")
    .insert({
      org_id: tenant.id,
      member_code: memberCode,
      name: name.trim(),
      phone: phone?.trim() || null,
      email: email?.trim() || null,
      birth_date: birthDate || null,
      status: "active",
      member_type: memberType ?? "individual",
      join_path: joinPath?.trim() || null,
      note: note?.trim() || null,
    })
    .select("*")
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ member }, { status: 201 });
}
