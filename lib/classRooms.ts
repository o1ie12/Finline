/**
 * Class-mode room rules (spec 12 TCH-5). Pure, so each rule is tested
 * without a database or a clock: the code alphabet, when a room counts as
 * open, how many a host may keep open, the join limits, and the room's
 * results (percent correct per question, the median score). A quiz counts
 * correct answers only: no speed, and no ranking of students. Results never
 * involve money: a quiz room has none, and the 人生賽局 round ranks by
 * 財務健康分 (lib/lifeGame/class.ts).
 */
import type { ClassParticipant, ClassRoom } from "./types";

/** No 0, O, 1 or I: a code is read off a projector and typed on a phone. */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 6;

/** `randomIndex(n)` returns an integer in [0, n) from a cryptographic source (node:crypto randomInt on the server). */
export function generateRoomCode(randomIndex: (n: number) => number): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += ROOM_CODE_ALPHABET[randomIndex(ROOM_CODE_ALPHABET.length)];
  return code;
}

export const MAX_OPEN_ROOMS = 3;
export const ROOM_IDLE_MS = 12 * 60 * 60 * 1000;

type RoomClock = Pick<ClassRoom, "status" | "created_at" | "started_at" | "last_active_at">;

/** The last time anything happened in the room. Rooms from before migration-27 fall back to when they started or were made. */
export function roomLastActive(room: RoomClock): number {
  const times = [room.last_active_at, room.started_at, room.created_at].map((t) => (t ? new Date(t).getTime() : NaN)).filter(Number.isFinite);
  return times.length ? Math.max(...times) : 0;
}

/** Open: not ended by its host, and used within the last 12 hours. */
export function isRoomOpen(room: RoomClock, now: Date): boolean {
  return room.status !== "finished" && now.getTime() - roomLastActive(room) <= ROOM_IDLE_MS;
}

export const JOIN_WINDOW_MS = 10 * 60 * 1000;
/**
 * Wrong codes in 10 minutes before the next try is refused: 10 from one
 * device (its cookie), 50 from one network address. A whole class shares
 * its school's address, so that limit is the looser one; a single phone
 * guessing codes is stopped by the first.
 */
export const JOIN_MAX_WRONG_DEVICE = 10;
export const JOIN_MAX_WRONG_IP = 50;

/** `wrongAt` are the times of earlier wrong tries by one device or one address; `max` is that kind's limit. */
export function joinBlocked(wrongAt: number[], now: number, max: number): boolean {
  return wrongAt.filter((t) => now - t < JOIN_WINDOW_MS).length >= max;
}

export interface RoomResults {
  /** How many have handed in. */
  submitted: number;
  /** Percent of them who got each question right, 0 to 100; null when nobody's answers are recorded. */
  percent: (number | null)[];
  /** The median score of those who handed in; null before anyone has. */
  median: number | null;
}

/** The room's results for the class screen. By question and by the middle score, never by who has the most of anything. */
export function roomResults(participants: Pick<ClassParticipant, "score" | "submitted_at" | "answers">[], questions: number): RoomResults {
  const done = participants.filter((p) => p.submitted_at);
  const scores = done.map((p) => p.score).sort((a, b) => a - b);
  const mid = Math.floor(scores.length / 2);
  const median = scores.length ? (scores.length % 2 ? scores[mid] : (scores[mid - 1] + scores[mid]) / 2) : null;
  const marked = done.filter((p) => Array.isArray(p.answers) && p.answers.length === questions);
  const percent = Array.from({ length: questions }, (_, i) => (marked.length ? Math.round((marked.filter((p) => p.answers![i] === true).length / marked.length) * 100) : null));
  return { submitted: done.length, percent, median };
}

/** The copy the spec fixes for these states. */
export const CLASS_COPY = {
  tooManyRooms: "你已經有 3 個房間開著。先關掉一個再開新的。",
  closeRoom: "關閉房間",
  roomClosed: "這個房間已經關閉，請跟老師要新的代碼。",
  tooManyTries: "試太多次了，請 10 分鐘後再試。",
  guide: "課堂使用說明",
} as const;
