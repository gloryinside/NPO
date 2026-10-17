import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readJsonObject } from "@/lib/http/body";

const VALID_TYPE = new Set([
  "income_summary", "expense_summary", "salary_top5",
  "related_party", "fundraising_cost", "donor_top5", "other",
]);

export async function GET(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const year = req.nextUrl.searchParams.get("year");
  const supabase = createSupabaseAdminClient();
  let q = supabase
    .from("transparency_disclosures")
    .select("id, fiscal_year, disclosure_type, title, status, published_at, pdf_url, created_at")
    .eq("org_id", tenant.id).order("fiscal_year", { ascending: false });
  if (year) q = q.eq("fiscal_year", Number(year));
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant, user } = guard.ctx;

  const parsed = await readJsonObject(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const fiscalYear = Number(body.fiscalYear ?? NaN);
  const disclosureType = typeof body.disclosureType === "string" ? body.disclosureType : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!Number.isInteger(fiscalYear) || !VALID_TYPE.has(disclosureType) || !title) {
    return NextResponse.json({ error: "fiscalYear, disclosureType, title 필수" }, { status: 400 });
  }

  const status = body.status === "published" ? "published" : "draft";
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("transparency_disclosures")
    .insert({
      org_id: tenant.id,
      fiscal_year: fiscalYear,
      disclosure_type: disclosureType,
      title,
      content: body.content ?? null,
      pdf_url: typeof body.pdfUrl === "string" ? body.pdfUrl : null,
      status,
      published_at: status === "published" ? new Date().toISOString() : null,
      created_by: user.id,
    })
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data?.id });
}
