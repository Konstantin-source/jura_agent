import type { Metadata } from "next";
import { Suspense } from "react";
import { LearningWorkspace } from "@/components/learning-workspace";

export const metadata: Metadata = { title: "Lernen" };

export default function LearnPage() {
  return <Suspense fallback={<div className="page-loading">Lernraum wird geöffnet …</div>}><LearningWorkspace /></Suspense>;
}
