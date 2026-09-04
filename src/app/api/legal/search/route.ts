import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAppUser, AuthenticationError } from "@/lib/auth/server";
import { getDemoSources } from "@/lib/ai/mock";
import { researchOfficialSources } from "@/lib/legal/composite-provider";

export const runtime = "nodejs";

const querySchema = z.object({
  query: z.string().min(2).max(1_000),
  kind: z.enum(["explanation", "socratic", "correction"]).default("explanation"),
});

export async function GET(request: Request) {
  try {
    const user = await requireAppUser();
    const url = new URL(request.url);
    const parsed = querySchema.safeParse({ query: url.searchParams.get("q"), kind: url.searchParams.get("kind") });
    if (!parsed.success) return NextResponse.json({ error: "Ungültige Suche." }, { status: 400 });
    if (user.demo) {
      return NextResponse.json({ sources: getDemoSources(parsed.data.query), live: false, demo: true, warnings: [] });
    }
    const result = await researchOfficialSources(parsed.data.query, parsed.data.kind);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthenticationError) return NextResponse.json({ error: error.message }, { status: 401 });
    return NextResponse.json({ error: "Die amtliche Suche ist gerade nicht erreichbar." }, { status: 502 });
  }
}
