import type { Metadata } from "next";
import { ChatLibrary } from "@/components/chat-library";

export const metadata: Metadata = { title: "Chats" };

export default function ChatsPage() {
  return <ChatLibrary />;
}
