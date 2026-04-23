import { getTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "문의하기" };
export const revalidate = 3600;

export default async function ContactPage() {
  const tenant = await getTenant();
  if (!tenant) {
    return (
      <main className="mx-auto max-w-lg px-4 py-12">
        <p>잘못된 접근입니다.</p>
      </main>
    );
  }

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("orgs")
    .select("name, contact_email, contact_phone, contact_address")
    .eq("id", tenant.id)
    .maybeSingle();

  const name = data?.name ?? tenant.name;

  return (
    <main className="mx-auto max-w-lg px-4 py-12">
      <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
        문의하기
      </h1>
      <p className="mt-2 text-sm" style={{ color: "var(--muted-foreground)" }}>
        {name} 에 궁금한 점이 있으시면 아래 연락처로 문의해주세요.
      </p>
      <ul className="mt-6 space-y-3 text-sm">
        {data?.contact_email && (
          <li>
            <span className="text-[var(--muted-foreground)]">이메일 </span>
            <a
              href={`mailto:${data.contact_email}`}
              style={{ color: "var(--accent)" }}
            >
              {data.contact_email}
            </a>
          </li>
        )}
        {data?.contact_phone && (
          <li>
            <span className="text-[var(--muted-foreground)]">전화 </span>
            <a
              href={`tel:${data.contact_phone}`}
              style={{ color: "var(--accent)" }}
            >
              {data.contact_phone}
            </a>
          </li>
        )}
        {data?.contact_address && (
          <li>
            <span className="text-[var(--muted-foreground)]">주소 </span>
            <span style={{ color: "var(--text)" }}>{data.contact_address}</span>
          </li>
        )}
        {!data?.contact_email && !data?.contact_phone && !data?.contact_address && (
          <li className="text-[var(--muted-foreground)]">
            연락처 정보가 아직 등록되지 않았습니다.
          </li>
        )}
      </ul>
    </main>
  );
}
