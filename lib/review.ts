/**
 * 錯題夾 and the weekly goal (2026-11-13). Pure: tested without a database.
 *
 * A question lands in the folder when the student's latest attempt at a
 * module got it less than fully right. It comes back two days later (spaced
 * retrieval works better than repeating at once), and a miss the student
 * said they were sure about is listed first: being confidently wrong is
 * what is most worth another look. Answering it again is a new attempt at
 * the module with the other answers carried over, so it leaves the folder
 * the moment the latest attempt has it right, and the grade book's best
 * score rises with it. Nothing new is stored.
 *
 * The weekly goal counts the different modules worked on since Monday in
 * Asia/Taipei. A week with nothing in it is just a week: no streak to lose.
 */
import type { TaskResultRow } from "./types";

export const REVIEW_GAP_DAYS = 2;
export const WEEK_GOALS = [1, 2, 3, 5] as const;
export const DEFAULT_WEEK_GOAL = 2;

const DAY = 24 * 60 * 60 * 1000;
const TAIPEI = 8 * 60 * 60 * 1000;
const FULL = 1 - 1e-9;

type Row = Pick<TaskResultRow, "task_set_id" | "line_slug" | "station_id" | "attempt" | "created_at" | "result">;

export interface ReviewEntry {
  taskSetId: string;
  lineSlug: string;
  stationId: number;
  /** The attempt the misses are from: the latest one. */
  attempt: number;
  missedAt: string;
  /** Missed steps in the task's own order; `sure` when the student said 我有把握. */
  missed: { stepId: string; sure: boolean }[];
  due: boolean;
  /** Whole days until it is due (0 when due). */
  daysLeft: number;
}

/**
 * What is in the folder. `scoredSteps` gives a task's scored step ids in
 * order, or null when the task is not a module the student can open now.
 */
export function reviewEntries(rows: Row[], scoredSteps: (taskSetId: string) => string[] | null, now: Date): ReviewEntry[] {
  const latest = new Map<string, Row>();
  for (const r of rows) {
    if (r.station_id === null || r.station_id === undefined) continue;
    const cur = latest.get(r.task_set_id);
    if (!cur || r.attempt > cur.attempt) latest.set(r.task_set_id, r);
  }
  const out: ReviewEntry[] = [];
  for (const r of latest.values()) {
    const scored = scoredSteps(r.task_set_id);
    if (!scored) continue;
    const credit = new Map((r.result?.steps ?? []).map((s) => [s.stepId, s.correct]));
    const said = r.result?.confidence ?? {};
    const missed = scored.filter((id) => credit.has(id) && (credit.get(id) ?? 0) < FULL).map((id) => ({ stepId: id, sure: said[id] === "sure" }));
    if (!missed.length) continue;
    const at = new Date(r.created_at).getTime();
    const left = Number.isFinite(at) ? Math.max(0, Math.ceil((at + REVIEW_GAP_DAYS * DAY - now.getTime()) / DAY)) : 0;
    out.push({ taskSetId: r.task_set_id, lineSlug: r.line_slug, stationId: r.station_id!, attempt: r.attempt, missedAt: r.created_at, missed, due: left === 0, daysLeft: left });
  }
  const sure = (e: ReviewEntry) => e.missed.filter((m) => m.sure).length;
  // Due first; then the confident misses; then the oldest.
  return out.sort((a, b) => Number(b.due) - Number(a.due) || sure(b) - sure(a) || a.missedAt.localeCompare(b.missedAt));
}

/** Monday of this week in Asia/Taipei, as YYYY-MM-DD. */
export function weekStart(now: Date): string {
  const t = new Date(now.getTime() + TAIPEI);
  const back = (t.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() - back)).toISOString().slice(0, 10);
}

/** How many different modules the student worked on this week (Asia/Taipei, from Monday). */
export function weekModules(rows: Pick<TaskResultRow, "task_set_id" | "created_at">[], now: Date): number {
  const from = new Date(`${weekStart(now)}T00:00:00+08:00`).getTime();
  return new Set(rows.filter((r) => new Date(r.created_at).getTime() >= from).map((r) => r.task_set_id)).size;
}

export const weekGoal = (stored: unknown): number => (WEEK_GOALS as readonly number[]).includes(stored as number) ? (stored as number) : DEFAULT_WEEK_GOAL;
