import type { Metadata } from "next";
import { Dashboard } from "@/components/dashboard";
import { requirePageUser } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Start" };
export const dynamic = "force-dynamic";

export default async function HomePage() {
  await requirePageUser();
  return <Dashboard />;
}
