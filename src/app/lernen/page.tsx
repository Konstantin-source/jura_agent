import type { Metadata } from "next";
import { Suspense } from "react";
import { LearningWorkspace } from "@/components/learning-workspace";
import { requirePageUser } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Lernen" };
export const dynamic = "force-dynamic";

export default async function LearnPage() {
  await requirePageUser();
  return <Suspense fallback={<div className="page-loading">Lernraum wird geöffnet …</div>}><LearningWorkspace /></Suspense>;
}
