import { NextResponse } from "next/server";
import { roomResults } from "@/lib/classRooms";
import { getClassParticipants, getClassRoom, isNotConfigured } from "@/lib/db";
import { isLineSlug } from "@/lib/lines";
import { getPrePostQuestions } from "@/lib/prePostQuestions";

export const runtime = "nodejs";

// Polled by the teacher's host screen: who has joined and handed in, and
// (spec 12 TCH-5) each question's percent correct with the room's median.
// Students appear by the nickname they typed; nothing here involves money.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const roomId = url.searchParams.get("room_id");
  if (!roomId) return NextResponse.json({ error: "invalid_room" }, { status: 400 });

  try {
    const [participants, room] = await Promise.all([getClassParticipants(roomId), getClassRoom(roomId).catch(() => null)]);
    const questions = room && isLineSlug(room.line_slug) ? getPrePostQuestions(room.line_slug) : [];
    const results = roomResults(participants, questions.length);
    return NextResponse.json({
      // Only what the screen shows: no answers array per student.
      participants: participants.map((p) => ({ id: p.id, room_id: p.room_id, display_name: p.display_name, score: p.score, total_ms: p.total_ms, submitted_at: p.submitted_at, joined_at: p.joined_at })),
      results: { ...results, questions: questions.map((q) => q.q) },
    });
  } catch (e) {
    if (isNotConfigured(e)) {
      return NextResponse.json({ error: "backend_not_configured" }, { status: 503 });
    }
    console.error("class leaderboard failed", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
