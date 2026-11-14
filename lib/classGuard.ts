import "server-only";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { CLASS_COPY, MAX_OPEN_ROOMS, joinBlocked } from "@/lib/classRooms";
import { listOpenClassRoomsForHost, recentJoinMisses, recordJoinMiss, touchClassRoom } from "@/lib/db";
import { getLine } from "@/lib/lines";
import { getCurrentStudent } from "@/lib/session";
import type { ClassRoom, Student } from "@/lib/types";

/**
 * Class-mode checks shared by the room endpoints (spec 12 TCH-5): who may
 * host, how many rooms they may keep open, and the limit on wrong codes.
 */

/** Hosting needs an account: the room is counted against it. */
export async function requireHost(): Promise<Student | NextResponse> {
  const student = await getCurrentStudent();
  return student ?? NextResponse.json({ error: "no_session" }, { status: 401 });
}

/** What the host screen lists when the limit is reached: enough to tell the rooms apart and close one. */
export function roomSummary(room: ClassRoom) {
  const life = room.kind === "life";
  return { room_id: room.id, code: room.code, kind: life ? "life" : "quiz", name: life ? "人生賽局" : (getLine(room.line_slug)?.name ?? ""), created_at: room.created_at };
}

/** Null when the host may open another room; otherwise the refusal, with their open rooms. */
export async function refuseOverLimit(student: Student): Promise<NextResponse | null> {
  const open = await listOpenClassRoomsForHost(student.id);
  if (open.length < MAX_OPEN_ROOMS) return null;
  return NextResponse.json({ error: "too_many_rooms", message: CLASS_COPY.tooManyRooms, rooms: open.map(roomSummary) }, { status: 409 });
}

/**
 * The visitor, as a salted hash of their address: enough to count wrong
 * codes for ten minutes, and nothing that can be read back as an address.
 */
export function visitorHash(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || req.headers.get("x-real-ip") || "unknown";
  const salt = process.env.CLASS_RATE_SALT || process.env.SESSION_SECRET || "finline-class-rooms";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

/** Null when this visitor may try a code; otherwise the 429. */
export async function refuseIfBlocked(req: Request): Promise<NextResponse | null> {
  const misses = await recentJoinMisses(visitorHash(req));
  if (!joinBlocked(misses, Date.now())) return null;
  return NextResponse.json({ error: "too_many_attempts", message: CLASS_COPY.tooManyTries }, { status: 429 });
}

/** A code that matched no room: count it, and answer as before. */
export async function wrongCode(req: Request): Promise<NextResponse> {
  await recordJoinMiss(visitorHash(req));
  return NextResponse.json({ error: "room_not_found" }, { status: 404 });
}

export function roomClosed(): NextResponse {
  return NextResponse.json({ error: "room_closed", message: CLASS_COPY.roomClosed }, { status: 410 });
}

/** A life round is used for a whole period: restart the 12-hour clock at most every ten minutes. */
export async function touchIfStale(room: ClassRoom): Promise<void> {
  const last = room.last_active_at ? new Date(room.last_active_at).getTime() : 0;
  if (Date.now() - last > 10 * 60 * 1000) await touchClassRoom(room.id);
}
