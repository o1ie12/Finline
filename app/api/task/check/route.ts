import { NextResponse } from "next/server";
import { isNotConfigured } from "@/lib/db";
import { getCurrentStudent } from "@/lib/session";
import { checkStep } from "@/lib/tasks/check";

export const runtime = "nodejs";

/**
 * Check one question of a task (the module player). Body:
 * { taskSetId, stepId, answer } → { detail, key } for that step. Stores
 * nothing. Without a session only a course's first module answers.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (typeof body?.taskSetId !== "string" || typeof body?.stepId !== "string") {
    return NextResponse.json({ error: "missing_step" }, { status: 400 });
  }
  try {
    const student = await getCurrentStudent().catch(() => null);
    const out = await checkStep(student, { taskSetId: body.taskSetId, stepId: body.stepId, answer: body.answer });
    if ("error" in out) return NextResponse.json({ error: out.error }, { status: out.error === "no_session" ? 401 : 400 });
    return NextResponse.json(out);
  } catch (e) {
    if (isNotConfigured(e)) return NextResponse.json({ error: "backend_not_configured" }, { status: 503 });
    console.error("task check failed", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
