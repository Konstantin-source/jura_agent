import { NextResponse } from "next/server";
import { requireAppUser, AuthenticationError } from "@/lib/auth/server";
import { getConversation } from "@/lib/data/persistence";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAppUser();
    const { id } = await context.params;
    if (user.demo) return NextResponse.json({ conversation: null, messages: [], demo: true });
    return NextResponse.json(await getConversation(user.id, id));
  } catch (error) {
    if (error instanceof AuthenticationError) return NextResponse.json({ error: error.message }, { status: 401 });
    return NextResponse.json({ error: "Chat konnte nicht geladen werden." }, { status: 404 });
  }
}
