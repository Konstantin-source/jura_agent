import { NextResponse } from "next/server";
import { requireAppUser, AuthenticationError } from "@/lib/auth/server";
import { listConversations } from "@/lib/data/persistence";

export async function GET() {
  try {
    const user = await requireAppUser();
    if (user.demo) return NextResponse.json({ conversations: [], demo: true });
    return NextResponse.json({ conversations: await listConversations(user.id), demo: false });
  } catch (error) {
    if (error instanceof AuthenticationError) return NextResponse.json({ error: error.message }, { status: 401 });
    return NextResponse.json({ error: "Chats konnten nicht geladen werden." }, { status: 500 });
  }
}
