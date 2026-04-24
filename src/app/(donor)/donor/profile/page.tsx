import { redirect } from "next/navigation";
import { getDonorSession } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getT } from "@/lib/i18n/donor";
import { ProfileTabs, type ProfileTabKey } from "@/components/donor/profile/ProfileTabs";
import { DonorProfileFullForm } from "@/components/donor/profile/DonorProfileFullForm";
import { PasswordChangeCard } from "@/components/donor/settings/PasswordChangeCard";

export const metadata = { title: "내 정보" };

const VALID_TABS: ProfileTabKey[] = ["info", "password"];

export default async function DonorProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getDonorSession();
  if (!session) redirect("/donor/login");
  const t = await getT();
  const { tab: rawTab } = await searchParams;
  const activeTab: ProfileTabKey = VALID_TABS.includes(rawTab as ProfileTabKey)
    ? (rawTab as ProfileTabKey)
    : "info";

  const supabase = createSupabaseAdminClient();
  const { data: row } = await supabase
    .from("members")
    .select(
      "id, name, phone, email, birth_date, postal_code, address_line1, address_line2"
    )
    .eq("id", session.member.id)
    .maybeSingle();

  const isSupabaseAuth = session.authMethod === "supabase";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">
          {t("donor.profile.title")}
        </h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          {t("donor.profile.subtitle")}
        </p>
      </div>

      <ProfileTabs
        active={activeTab}
        labels={{
          info: t("donor.profile.tab.info"),
          password: t("donor.profile.tab.password"),
        }}
      />

      {activeTab === "info" && row && (
        <DonorProfileFullForm
          initial={{
            name: row.name ?? "",
            phone: row.phone ?? "",
            email: row.email ?? "",
            birthDate: row.birth_date ?? null,
            postalCode: row.postal_code ?? "",
            addressLine1: row.address_line1 ?? "",
            addressLine2: row.address_line2 ?? "",
          }}
        />
      )}

      {activeTab === "password" && (
        <PasswordChangeCard enabled={isSupabaseAuth} />
      )}
    </div>
  );
}
