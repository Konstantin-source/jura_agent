import { NextResponse } from "next/server";
import { requireAppUser, AuthenticationError } from "@/lib/auth/server";
import { listDocuments } from "@/lib/data/persistence";

export async function GET() {
  try {
    const user = await requireAppUser();
    if (user.demo) return NextResponse.json({ documents: [], demo: true });
    return NextResponse.json({ documents: await listDocuments(user.id), demo: false });
  } catch (error) {
    if (error instanceof AuthenticationError) return NextResponse.json({ error: error.message }, { status: 401 });
    return NextResponse.json({ error: "Dokumente konnten nicht geladen werden." }, { status: 500 });
  }
}
