import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { CLASS_COPY, JOIN_MAX_WRONG_DEVICE, JOIN_MAX_WRONG_IP, MAX_OPEN_ROOMS, joinBlocked } from "@/lib/classRooms";
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

/** The device's cookie for the wrong-code limit: a random id, nothing about the person. */
export const CLASS_DEVICE_COOKIE = "fs_class_device";

// The salt has to be a secret: an address hashed with a value anyone can
// read in the repo could be found again by trying every address. The
// database key is on every server that can write these rows and nowhere
// else; it only goes into the hash. CLASS_RATE_SALT overrides it.
const SALT = process.env.CLASS_RATE_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || "finline-class-rooms-local";
const salted = (what: string) => createHash("sha256").update(`${SALT}:${what}`).digest("hex");

/**
 * The visitor's network address as a salted hash: enough to count wrong
 * codes for ten minutes. The address itself is never stored.
 */
export function visitorHash(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return salted(forwarded || req.headers.get("x-real-ip") || "unknown");
}

/** The key a device's wrong codes are counted under (the same table; `dev:` keeps the two kinds apart). */
export const deviceKey = (deviceId: string) => `dev:${salted(deviceId)}`;

async function deviceId(): Promise<string | null> {
  const v = (await cookies()).get(CLASS_DEVICE_COOKIE)?.value;
  return v && /^[0-9a-f-]{36}$/i.test(v) ? v : null;
}

/** Null when this visitor may try a code; otherwise the 429. Ten wrong codes from this device, or fifty from this address, in ten minutes. */
export async function refuseIfBlocked(req: Request): Promise<NextResponse | null> {
  const now = Date.now();
  const device = await deviceId();
  const [fromAddress, fromDevice] = await Promise.all([recentJoinMisses(visitorHash(req)), device ? recentJoinMisses(deviceKey(device)) : Promise.resolve([])]);
  if (!joinBlocked(fromAddress, now, JOIN_MAX_WRONG_IP) && !joinBlocked(fromDevice, now, JOIN_MAX_WRONG_DEVICE)) return null;
  return NextResponse.json({ error: "too_many_attempts", message: CLASS_COPY.tooManyTries }, { status: 429 });
}

/** A code that matched no room: count it for the address and for the device (which gets its cookie now if it had none), and answer as before. */
export async function wrongCode(req: Request): Promise<NextResponse> {
  const known = await deviceId();
  const device = known ?? randomUUID();
  await Promise.all([recordJoinMiss(visitorHash(req)), recordJoinMiss(deviceKey(device))]);
  const res = NextResponse.json({ error: "room_not_found" }, { status: 404 });
  if (!known) res.cookies.set(CLASS_DEVICE_COOKIE, device, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 12 });
  return res;
}

export function roomClosed(): NextResponse {
  return NextResponse.json({ error: "room_closed", message: CLASS_COPY.roomClosed }, { status: 410 });
}

/** A life round is used for a whole period: restart the 12-hour clock at most every ten minutes. */
export async function touchIfStale(room: ClassRoom): Promise<void> {
  const last = room.last_active_at ? new Date(room.last_active_at).getTime() : 0;
  if (Date.now() - last > 10 * 60 * 1000) await touchClassRoom(room.id);
}
