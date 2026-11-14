import { NextResponse } from "next/server";
import { refuseIfBlocked, wrongCode } from "@/lib/classGuard";
import { isRoomOpen } from "@/lib/classRooms";
import { getClassRoomByCode, isNotConfigured } from "@/lib/db";
import { normalizeAccessCode } from "@/lib/accessCode";

export const runtime = "nodejs";

// Polled by a waiting student to find out when the teacher starts the round.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = normalizeAccessCode(url.searchParams.get("code") ?? "");
  if (!code) return NextResponse.json({ error: "invalid_code" }, { status: 400 });

  try {
    // spec 12 TCH-5: this lookup takes a code too, so it shares the join limit.
    const blocked = await refuseIfBlocked(req);
    if (blocked) return blocked;
    const room = await getClassRoomByCode(code);
    if (!room) return wrongCode(req);
    return NextResponse.json({
      room_id: room.id,
      line_slug: room.line_slug,
      status: room.status,
      open: isRoomOpen(room, new Date()),
    });
  } catch (e) {
    if (isNotConfigured(e)) {
      return NextResponse.json({ error: "backend_not_configured" }, { status: 503 });
    }
    console.error("class room lookup failed", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
