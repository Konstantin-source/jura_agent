import type { Metadata } from "next";
import { SettingsPanel } from "@/components/settings-panel";
import { requirePageUser } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Einstellungen" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requirePageUser();
  return <SettingsPanel />;
}
