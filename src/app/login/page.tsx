import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getOptionalAppUser } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Anmelden" };

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getOptionalAppUser();
  if (user && !user.demo) redirect("/");
  return <LoginForm />;
}
