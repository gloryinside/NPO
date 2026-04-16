import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Integration-test helper: provision an auth user, bind them to an existing
 * org via a `members` row (`supabase_uid` FK), and return a Supabase client
 * authenticated as that user. The returned client is subject to RLS.
 *
 * Callers own cleanup: use the returned `dispose` to sign out + delete the
 * auth user + delete the members row. Fixtures for other tables must be
 * cleaned up by the caller.
 */
export interface UserClientForOrg {
  client: SupabaseClient;
  userId: string;
  memberId: string;
  email: string;
  dispose: () => Promise<void>;
}

export async function createUserClientForOrg(
  orgId: string,
  opts: { memberCode?: string; name?: string } = {}
): Promise<UserClientForOrg> {
  const admin = createSupabaseAdminClient();
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `test-${suffix}@example.test`;
  const password = `Test_${suffix}_pw!`;

  const { data: created, error: createErr } = await admin.auth.admin.createUser(
    {
      email,
      password,
      email_confirm: true,
    }
  );
  if (createErr || !created?.user) {
    throw new Error(
      `auth.admin.createUser failed: ${createErr?.message ?? "no user"}`
    );
  }
  const userId = created.user.id;

  const memberCode = opts.memberCode ?? `TEST-${suffix}`;
  const { data: member, error: mErr } = await admin
    .from("members")
    .insert({
      org_id: orgId,
      member_code: memberCode,
      supabase_uid: userId,
      name: opts.name ?? `Test User ${suffix}`,
    })
    .select("id")
    .single();
  if (mErr || !member) {
    // Best-effort cleanup of the orphaned auth user.
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    throw new Error(`members insert failed: ${mErr?.message ?? "no member"}`);
  }

  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { error: signInErr } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (signInErr) {
    await admin.from("members").delete().eq("id", member.id);
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    throw new Error(`signIn failed: ${signInErr.message}`);
  }

  const dispose = async () => {
    try {
      await client.auth.signOut();
    } catch {
      /* ignore */
    }
    await admin.from("members").delete().eq("id", member.id);
    await admin.auth.admin.deleteUser(userId).catch(() => {});
  };

  return { client, userId, memberId: member.id, email, dispose };
}
