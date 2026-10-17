import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseSegmentFilter, segmentMemberIds } from "@/lib/members/segments";
import { SegmentBoard, type SegmentRow } from "@/components/admin/segment-board";

export const metadata = { title: "후원자 명단" };

export default async function AdminSegmentsPage() {
  await requireAdminUser();
  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();

  const [{ data: segs }, { data: tags }] = await Promise.all([
    supabase.from("member_segments").select("id, name, filters").eq("org_id", tenant.id).order("name"),
    supabase.from("member_tags").select("id, name").eq("org_id", tenant.id).order("name"),
  ]);

  const rows: SegmentRow[] = await Promise.all(
    ((segs ?? []) as Array<{ id: string; name: string; filters: unknown }>).map(async (s) => {
      const filters = parseSegmentFilter(s.filters);
      return { id: s.id, name: s.name, filters, count: (await segmentMemberIds(supabase, tenant.id, filters)).length };
    }),
  );

  return <SegmentBoard segments={rows} tags={(tags ?? []) as Array<{ id: string; name: string }>} />;
}
