import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readJsonObject } from "@/lib/http/body";

const VALID_STATUS = new Set(["available", "sponsored", "graduated", "withdrawn"]);

export async function GET(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const status = req.nextUrl.searchParams.get("status");

  const supabase = createSupabaseAdminClient();
  let q = supabase
    .from("beneficiaries")
    .select("id, code, name, birth_year, gender, region, status, photo_url, enrolled_at, program_id")
    .eq("org_id", tenant.id)
    .order("code");
  if (status && VALID_STATUS.has(status)) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;

  const parsed = await readJsonObject(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const code = typeof body.code === "string" ? body.code.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!code || !name) {
    return NextResponse.json({ error: "code, name 필수" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("beneficiaries")
    .insert({
      org_id: tenant.id,
      code, name,
      birth_year: Number.isInteger(body.birthYear) ? body.birthYear : null,
      gender: typeof body.gender === "string" ? body.gender : null,
      region: typeof body.region === "string" ? body.region : null,
      bio: typeof body.bio === "string" ? body.bio : null,
      program_id: typeof body.programId === "string" ? body.programId : null,
      photo_url: typeof body.photoUrl === "string" ? body.photoUrl : null,
      enrolled_at: typeof body.enrolledAt === "string" ? body.enrolledAt : null,
      status: "available",
    })
    .select("id")
    .maybeSingle();
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "이미 존재하는 code" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ id: data?.id });
}
