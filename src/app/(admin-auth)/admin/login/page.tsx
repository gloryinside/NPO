import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth";
import { LoginForm } from "@/components/admin/login-form";

export default async function AdminLoginPage() {
  const user = await getAdminUser();
  if (user?.user_metadata?.role === "admin") {
    redirect("/admin");
  }

  return <LoginForm />;
}
