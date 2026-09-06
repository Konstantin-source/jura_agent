import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAppUser, AuthenticationError } from "@/lib/auth/server";
import { deleteDocument } from "@/lib/data/persistence";
import { isSameOriginRequest } from "@/lib/security/origin";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!isSameOriginRequest(request)) {
      return NextResponse.json({ error: "Anfrage von einer fremden Herkunft abgelehnt." }, { status: 403 });
    }
    const user = await requireAppUser();
    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Ungültige Dokument-ID." }, { status: 400 });
    if (!user.demo) await deleteDocument(user.id, id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof AuthenticationError) return NextResponse.json({ error: error.message }, { status: 401 });
    return NextResponse.json({ error: "Dokument konnte nicht gelöscht werden." }, { status: 500 });
  }
}
