import { NextResponse } from "next/server";
import { isNotConfigured, updateStudentProfile } from "@/lib/db";
import { WEEK_GOALS } from "@/lib/review";
import { getCurrentStudent } from "@/lib/session";

export const runtime = "nodejs";

/** Set the weekly goal (2026-11-13). Body: { goal } (one of WEEK_GOALS, modules a week). */
export async function POST(req: Request) {
  let body: { goal?: unknown } | null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const goal = body?.goal;
  if (typeof goal !== "number" || !(WEEK_GOALS as readonly number[]).includes(goal)) return NextResponse.json({ error: "invalid_goal" }, { status: 400 });
  try {
    const student = await getCurrentStudent();
    if (!student) return NextResponse.json({ error: "no_session" }, { status: 401 });
    await updateStudentProfile(student.id, { weeklyGoal: goal });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (isNotConfigured(e)) return NextResponse.json({ error: "backend_not_configured" }, { status: 503 });
    console.error("week goal save failed", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
