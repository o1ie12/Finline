import { NextResponse, after } from "next/server";
import { isNotConfigured } from "@/lib/db";
import { startTimer } from "@/lib/serverTiming";
import { getCurrentStudent } from "@/lib/session";
import { scoreGuest } from "@/lib/tasks/check";
import { submitTask } from "@/lib/tasks/submit";

export const runtime = "nodejs";

/** Submit a station or library task. Body: { taskSetId, answers, hookAnswer, carried?, confidence?, guest? } (carried: 06 G1 redo; guest: played before sign-up). */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (typeof body?.taskSetId !== "string") {
    return NextResponse.json({ error: "missing_task" }, { status: 400 });
  }
  const t = startTimer();
  try {
    const student = await t.time("session", getCurrentStudent().catch(() => null));
    if (!student) {
      // 2026-11-13: a course's first module plays without an account; scored, not stored.
      const guest = scoreGuest({ taskSetId: body.taskSetId, answers: body.answers, hookAnswer: body.hookAnswer });
      if ("error" in guest) return NextResponse.json({ error: guest.error === "no_session" ? "no_session" : guest.error }, { status: guest.error === "no_session" ? 401 : 400 });
      return NextResponse.json(guest);
    }
    const out = await submitTask(student, {
      taskSetId: body.taskSetId,
      answers: body.answers,
      hookAnswer: body.hookAnswer,
      carried: body.carried,
      confidence: body.confidence,
      guest: body.guest,
    }, (work) => after(work), t);
    if ("error" in out) return NextResponse.json({ error: out.error }, { status: 400 });
    const res = NextResponse.json({
      score: out.score.score,
      total: out.score.total,
      passed: out.passed,
      details: out.score.details,
      stationDone: out.stationDone,
      reveal: out.reveal,
      attempt: out.attempt,
      answerKey: out.answerKey,
    });
    res.headers.set("Server-Timing", t.header());
    return res;
  } catch (e) {
    if (isNotConfigured(e)) return NextResponse.json({ error: "backend_not_configured" }, { status: 503 });
    console.error("task submit failed", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
