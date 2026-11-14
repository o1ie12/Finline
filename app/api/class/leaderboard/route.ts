import { NextResponse } from "next/server";
import { roomResults } from "@/lib/classRooms";
import { getClassParticipants, getClassRoom, isNotConfigured } from "@/lib/db";
import { isLineSlug } from "@/lib/lines";
import { getPrePostQuestions } from "@/lib/prePostQuestions";

export const runtime = "nodejs";

// Polled by the teacher's host screen: who has joined and who has handed in
// (in the order they joined, by the nickname they typed), each question's
// percent correct and the room's median. No student's score leaves the
// server here, and nothing is ranked: each student sees only their own.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const roomId = url.searchParams.get("room_id");
  if (!roomId) return NextResponse.json({ error: "invalid_room" }, { status: 400 });

  try {
    const [participants, room] = await Promise.all([getClassParticipants(roomId), getClassRoom(roomId).catch(() => null)]);
    const questions = room && isLineSlug(room.line_slug) ? getPrePostQuestions(room.line_slug) : [];
    const results = roomResults(participants, questions.length);
    return NextResponse.json({
      participants: [...participants]
        .sort((a, b) => a.joined_at.localeCompare(b.joined_at))
        .map((p) => ({ id: p.id, display_name: p.display_name, submitted: Boolean(p.submitted_at) })),
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
