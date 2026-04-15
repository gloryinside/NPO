import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
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
