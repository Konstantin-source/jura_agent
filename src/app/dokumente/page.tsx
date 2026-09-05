import type { Metadata } from "next";
import { DocumentLibrary } from "@/components/document-library";
import { requirePageUser } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Dokumente" };
export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  await requirePageUser();
  return <DocumentLibrary />;
}
