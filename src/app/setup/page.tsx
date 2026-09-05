import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SetupForm } from "@/components/setup-form";
import { countUsers } from "@/lib/auth/repository";
import { getServerEnvironment, isDemoMode } from "@/lib/config/env";

export const metadata: Metadata = { title: "Ersteinrichtung" };
export const dynamic = "force-dynamic";

export default function SetupPage() {
  if (isDemoMode()) redirect("/");
  const userCount = countUsers();
  if (userCount === 2) redirect("/login");
  return <SetupForm setupAvailable={userCount === 0 && Boolean(getServerEnvironment().SETUP_TOKEN)} />;
}
