import { NextResponse } from "next/server";
import { deleteAppSession } from "@/lib/auth/server";
import { isSameOriginRequest } from "@/lib/security/origin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Anfrage von einer fremden Herkunft abgelehnt." }, { status: 403 });
  }
  await deleteAppSession();
  return new NextResponse(null, { status: 204 });
}
