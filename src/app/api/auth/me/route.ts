import { NextResponse } from "next/server";
import { AuthenticationError, requireAppUser } from "@/lib/auth/server";
import { getServerEnvironment } from "@/lib/config/env";
import { getMonthlySpendEur } from "@/lib/data/persistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireAppUser();
    const monthlySpendEur = user.demo ? 0 : await getMonthlySpendEur();
    return NextResponse.json({
      user: { id: user.id, email: user.email, displayName: user.displayName, demo: user.demo },
      budget: {
        monthlySpendEur,
        monthlyLimitEur: getServerEnvironment().MONTHLY_AI_BUDGET_EUR,
      },
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: "Konto konnte nicht geladen werden." }, { status: 500 });
  }
}
