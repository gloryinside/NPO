import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  await requireAdminUser();

  const { id } = await params;

  let tenant;
  try {
    tenant = await requireTenant();
  } catch {
    return NextResponse.json({ error: "Tenant not found" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  const { data: member, error: memberErr } = await supabase
    .from("members")
    .select("*")
    .eq("id", id)
    .eq("org_id", tenant.id)
    .maybeSingle();

  if (memberErr) {
    return NextResponse.json({ error: memberErr.message }, { status: 500 });
  }
  if (!member) {
    return NextResponse.json(
      { error: "후원자를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  const [promisesRes, paymentsRes] = await Promise.all([
    supabase
      .from("promises")
      .select("*, campaigns(id, title)")
      .eq("org_id", tenant.id)
      .eq("member_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("payments")
      .select("*, campaigns(id, title)")
      .eq("org_id", tenant.id)
      .eq("member_id", id)
      .order("pay_date", { ascending: false })
      .limit(100),
  ]);

  if (promisesRes.error) {
    return NextResponse.json(
      { error: promisesRes.error.message },
      { status: 500 }
    );
  }
  if (paymentsRes.error) {
    return NextResponse.json(
      { error: paymentsRes.error.message },
      { status: 500 }
    );
  }

  const promises = promisesRes.data ?? [];
  const payments = paymentsRes.data ?? [];

  const totalAmount = payments
    .filter((p) => p.pay_status === "paid")
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const paymentCount = payments.filter((p) => p.pay_status === "paid").length;
  const activePromiseCount = promises.filter(
    (p) => p.status === "active"
  ).length;

  return NextResponse.json({
    member,
    promises,
    payments,
    stats: { totalAmount, paymentCount, activePromiseCount },
  });
}

/**
 * PATCH /api/admin/members/[id]
 * 후원자 기본정보 업데이트
 */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const user = await requireAdminUser();

  const { id } = await params;

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

  const {
    name,
    phone,
    email,
    birthDate,
    memberType,
    status,
    joinPath,
    note,
    idNumber,
  } = body as {
    name?: string;
    phone?: string | null;
    email?: string | null;
    birthDate?: string | null;
    memberType?: string;
    status?: string;
    joinPath?: string | null;
    note?: string | null;
    idNumber?: string | null;
  };

  const ALLOWED_STATUS = ["active", "inactive", "deceased"];
  const ALLOWED_TYPE = ["individual", "corporate"];

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (name !== undefined) {
    if (!name.trim())
      return NextResponse.json({ error: "이름은 필수입니다." }, { status: 400 });
    update.name = name.trim();
  }
  if (phone !== undefined) update.phone = phone?.trim() || null;
  if (email !== undefined) update.email = email?.trim() || null;
  if (birthDate !== undefined) update.birth_date = birthDate || null;
  if (memberType !== undefined) {
    if (!ALLOWED_TYPE.includes(memberType))
      return NextResponse.json({ error: "잘못된 회원 유형입니다." }, { status: 400 });
    update.member_type = memberType;
  }
  if (status !== undefined) {
    if (!ALLOWED_STATUS.includes(status))
      return NextResponse.json({ error: "잘못된 상태값입니다." }, { status: 400 });
    update.status = status;
  }
  if (joinPath !== undefined) update.join_path = joinPath?.trim() || null;
  if (note !== undefined) update.note = note?.trim() || null;

  if (Object.keys(update).length <= 1 && idNumber === undefined) {
    return NextResponse.json({ error: "수정할 항목이 없습니다." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  // 주민등록번호 암호화 처리 (선택 필드)
  if (idNumber !== undefined) {
    if (idNumber === null || idNumber.trim() === "") {
      update.id_number_encrypted = null;
    } else {
      const raw = idNumber.replace(/-/g, "").trim();
      if (!/^\d{13}$/.test(raw)) {
        return NextResponse.json(
          { error: "주민등록번호는 13자리 숫자여야 합니다." },
          { status: 400 }
        );
      }
      const encKey = process.env.RECEIPTS_ENCRYPTION_KEY;
      if (!encKey) {
        return NextResponse.json(
          { error: "RRN 암호화 키(RECEIPTS_ENCRYPTION_KEY)가 설정되지 않았습니다." },
          { status: 500 }
        );
      }
      const { data: enc, error: encErr } = await supabase.rpc(
        "encrypt_id_number",
        { plaintext: raw, passphrase: encKey }
      );
      if (encErr) {
        return NextResponse.json(
          { error: "주민등록번호 암호화 실패: " + encErr.message },
          { status: 500 }
        );
      }
      update.id_number_encrypted = enc;
    }
  }

  const { data, error } = await supabase
    .from("members")
    .update(update)
    .eq("id", id)
    .eq("org_id", tenant.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)
    return NextResponse.json({ error: "후원자를 찾을 수 없습니다." }, { status: 404 });

  // 감사 로그 — 상태 변경 또는 id_number 변경 시 (일반 필드 수정은 noise)
  if (status !== undefined || idNumber !== undefined) {
    await logAudit({
      orgId: tenant.id,
      actorId: user.id,
      actorEmail: user.email ?? null,
      action:
        idNumber !== undefined ? "member.update_id_number" : "member.update",
      resourceType: "member",
      resourceId: id,
      summary:
        idNumber !== undefined
          ? `후원자 주민등록번호 ${idNumber ? "설정/변경" : "삭제"}`
          : `후원자 상태 변경: ${status}`,
      metadata: { status, name: data.name, id_number_updated: idNumber !== undefined },
    });
  }

  return NextResponse.json({ member: data });
}
