import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Returns the current authenticated user from Supabase session.
 * Returns null if not authenticated.
 */
export async function getAdminUser(): Promise<User | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Throws redirect to /admin/login if not authenticated or not admin role.
 */
export async function requireAdminUser(): Promise<User> {
  const user = await getAdminUser();
  if (!user || user.user_metadata?.role !== "admin") {
    redirect("/admin/login");
  }
  return user;
}
