import type { Metadata } from "next";
import { DocumentLibrary } from "@/components/document-library";

export const metadata: Metadata = { title: "Dokumente" };

export default function DocumentsPage() {
  return <DocumentLibrary />;
}
