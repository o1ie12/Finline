/**
 * Grades (2026-11-12): a student's best attempt at each task and what a
 * module's row says on the grades table. One rule for the course page and
 * the transcript:
 *   - at or over the pass mark: 通過;
 *   - done on the second attempt without reaching it: 已完成，未達標
 *     (lib/tasks/submit.ts marks the station done then; it is never shown
 *     as a pass);
 *   - a module with nothing scored (a simulation, a reflection): 已完成.
 */
import type { TaskResultRow } from "@/lib/types";

export interface Best {
  score: number;
  total: number;
  attempts: number;
}

/**
 * How well a task is known, from the best attempt: under the pass mark,
 * at it, or at 90% and over. A module with nothing scored is 達標 once done.
 */
export type Level = "none" | "practicing" | "passed" | "mastered";
export const LEVEL_NAME: Record<Level, string> = { none: "尚未開始", practicing: "練習中", passed: "達標", mastered: "精熟" };
export const MASTERY = 0.9;

export interface Grade {
  text: string;
  level: Level;
  tone: "good" | "warn" | "none";
  /** 0..1 of the best attempt; null when nothing was scored or tried. */
  ratio: number | null;
  passed: boolean;
}

const ratioOf = (b: { score: number; total: number }) => (b.total ? b.score / b.total : 0);
export const percent = (x: number) => `${Math.round(x * 100)}%`;

/** The best attempt per task set, with how many times it was tried. */
export function bestAttempts(results: Pick<TaskResultRow, "task_set_id" | "score" | "total" | "attempt">[]): Map<string, Best> {
  const best = new Map<string, Best>();
  for (const r of results) {
    const b = best.get(r.task_set_id);
    const better = !b || ratioOf(r) > ratioOf(b);
    best.set(r.task_set_id, { score: better ? r.score : b!.score, total: better ? r.total : b!.total, attempts: Math.max(b?.attempts ?? 0, r.attempt) });
  }
  return best;
}

export function moduleGrade(m: { pass: number | null; simulation: boolean }, done: boolean, best: Best | null): Grade {
  if (m.simulation || m.pass === null || !best) {
    const waiting = m.simulation || m.pass === null ? "尚未完成" : "尚未作答";
    return done ? { text: "已完成", level: "passed", tone: "good", ratio: null, passed: true } : { text: waiting, level: "none", tone: "none", ratio: null, passed: false };
  }
  const ratio = ratioOf(best);
  if (ratio + 1e-9 >= m.pass) return { text: `通過 · ${percent(ratio)}`, level: ratio + 1e-9 >= MASTERY ? "mastered" : "passed", tone: "good", ratio, passed: true };
  return { text: `${done ? "已完成，未達標" : "未達標，可重做"} · ${percent(ratio)}`, level: "practicing", tone: "warn", ratio, passed: false };
}
