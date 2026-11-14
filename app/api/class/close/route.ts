import { NextResponse } from "next/server";
import { requireHost } from "@/lib/classGuard";
import { closeClassRoomAsHost, isNotConfigured } from "@/lib/db";

export const runtime = "nodejs";

/** 關閉房間 (spec 12 TCH-5): the signed-in host ends one of their own rooms. Body: { room_id }. */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const roomId = (body as Record<string, unknown>)?.room_id;
  if (typeof roomId !== "string" || !/^[0-9a-f-]{36}$/i.test(roomId)) {
    return NextResponse.json({ error: "invalid_room" }, { status: 400 });
  }
  try {
    const host = await requireHost();
    if (host instanceof NextResponse) return host;
    const closed = await closeClassRoomAsHost(roomId, host.id);
    return closed ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "room_not_found" }, { status: 404 });
  } catch (e) {
    if (isNotConfigured(e)) return NextResponse.json({ error: "backend_not_configured" }, { status: 503 });
    console.error("class close failed", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
