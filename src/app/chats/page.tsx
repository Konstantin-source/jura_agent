import type { Metadata } from "next";
import { ChatLibrary } from "@/components/chat-library";
import { requirePageUser } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Chats" };
export const dynamic = "force-dynamic";

export default async function ChatsPage() {
  await requirePageUser();
  return <ChatLibrary />;
}
