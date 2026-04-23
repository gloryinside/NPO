import { runCron } from "@/lib/cron/runner";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * G-D209: 정책 기반 자동 익명화.
 *   대상:
 *     - members.status='withdrawn' && deleted_at <= now - retention_days
 *     - org 의 privacy_settings.auto_anonymize=true
 *   동작: fields 에 포함된 컬럼을 NULL 또는 "***" 로 치환.
 */
export async function GET(req: Request) {
  return runCron(req, "cron:auto-anonymize-members", async () => {
    const supabase = createSupabaseAdminClient();
    const { data: orgs } = await supabase
      .from("orgs")
      .select("id, privacy_settings");

    let processed = 0;
    for (const org of (orgs ?? []) as Array<{
      id: string;
      privacy_settings: {
        retention_days?: number;
        auto_anonymize?: boolean;
        fields?: string[];
      } | null;
    }>) {
      const ps = org.privacy_settings ?? {};
      if (!ps.auto_anonymize) continue;
      const retention = Number(ps.retention_days ?? 1825);
      if (!Number.isFinite(retention) || retention < 30) continue;

      const cutoff = new Date();
      cutoff.setUTCDate(cutoff.getUTCDate() - retention);
      const cutoffIso = cutoff.toISOString();

      const { data: targets } = await supabase
        .from("members")
        .select("id")
        .eq("org_id", org.id)
        .eq("status", "withdrawn")
        .lt("deleted_at", cutoffIso)
        .limit(500);

      const targetIds = (targets ?? []).map((r) => r.id as string);
      if (targetIds.length === 0) continue;

      const fields = Array.isArray(ps.fields) ? ps.fields : [];
      const upd: Record<string, unknown> = {};
      for (const f of fields) {
        if (
          ![
            "name",
            "email",
            "phone",
            "birth_date",
            "address_line1",
            "address_line2",
            "postal_code",
          ].includes(f)
        )
          continue;
        if (f === "name") upd.name = "익명";
        else if (f === "email") upd.email = null; // 이미 deleted+suffix 였다면 NULL 치환
        else upd[f] = null;
      }
      if (Object.keys(upd).length === 0) continue;

      const { error } = await supabase
        .from("members")
        .update(upd)
        .in("id", targetIds);
      if (!error) processed += targetIds.length;
    }
    return { processed };
  });
}
