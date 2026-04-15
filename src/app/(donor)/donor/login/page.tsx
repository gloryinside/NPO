import { redirect } from "next/navigation";
import { getDonorSession } from "@/lib/auth";
import { DonorLoginForm } from "@/components/donor/login-form";

export default async function DonorLoginPage() {
  const session = await getDonorSession();
  if (session) {
    redirect("/donor");
  }

  return <DonorLoginForm />;
}
