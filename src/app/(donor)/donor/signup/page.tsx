import { redirect } from "next/navigation";
import { getDonorSession } from "@/lib/auth";
import { DonorSignupForm } from "@/components/donor/signup-form";

export default async function DonorSignupPage() {
  const session = await getDonorSession();
  if (session) {
    redirect("/donor");
  }

  return <DonorSignupForm />;
}
