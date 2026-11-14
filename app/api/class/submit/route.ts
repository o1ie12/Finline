import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CLASS_PARTICIPANT_COOKIE } from "@/lib/session";
import { submitClassResult, isNotConfigured, touchClassRoom } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const b = (body ?? {}) as Record<string, unknown>;
  const participantId = b.participant_id;
  const score = Number(b.score);

  if (typeof participantId !== "string") {
    return NextResponse.json({ error: "invalid_participant" }, { status: 400 });
  }
  // Only the browser that joined as this participant may submit for them.
  // Anyone holding a projected class code could otherwise post a perfect
  // score under any participant id read off the leaderboard.
  const store = await cookies();
  if (store.get(CLASS_PARTICIPANT_COOKIE)?.value !== participantId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!Number.isFinite(score) || score < 0 || score > 10) {
    return NextResponse.json({ error: "invalid_score" }, { status: 400 });
  }
  // 2026-11-14: a quiz counts correct answers only. A time an older page
  // still sends is ignored, and none is stored.

  // spec 12 TCH-5: right or wrong per question, for the room's percent
  // correct. Optional, and only its shape is trusted: true/false, at most
  // 20, and as many trues as the score.
  const marks = Array.isArray(b.correct) && b.correct.length <= 20 && b.correct.every((x) => typeof x === "boolean") ? (b.correct as boolean[]) : null;
  const answers = marks && marks.filter(Boolean).length === score ? marks : null;

  try {
    const participant = await submitClassResult(participantId, score, null, answers);
    if (!participant) {
      return NextResponse.json({ error: "participant_not_found" }, { status: 404 });
    }
    await touchClassRoom(participant.room_id);
    return NextResponse.json({ participant });
  } catch (e) {
    if (isNotConfigured(e)) {
      return NextResponse.json({ error: "backend_not_configured" }, { status: 503 });
    }
    console.error("class submit failed", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
