/**
 * Check one question (2026-11-13): the module player asks after each answer,
 * so feedback comes at once instead of after the whole task.
 *
 * It scores the step exactly as the final submission will (the same
 * resolved task, goal, student and attempt) and returns that step's key.
 * Nothing is stored: the attempt is still recorded once, by submitTask,
 * when the module ends. Because the key comes back, a student could ask
 * before choosing; that is accepted (docs/archive/redesign/13-player.md).
 */
import { countTaskAttempts } from "@/lib/db";
import { getLine } from "@/lib/lines";
import { readProfile } from "@/lib/studentProfile";
import type { Student } from "@/lib/types";
import { prepareLesson } from "./prepare";
import { answerKey, type AnswerKey } from "./publicLesson";
import { findTaskSet } from "./registry";
import { resolveTask } from "./resolve";
import { pickRevealWithSource } from "./reveal";
import { sanitizeAnswers, sanitizeHook } from "./sanitize";
import { scoreStep, scoreTask, type StepScore } from "./scoring";
import type { StationLesson, TaskStep } from "./types";

/** The visitor key for play without an account: the same shuffle for everyone. */
export const GUEST = "guest";

export interface StepCheck {
  detail: StepScore;
  /** The step with its answers and explanations (the answer key's form). */
  key: TaskStep;
}

/** A course's first module can be played without an account. */
export function isOpenLesson(slug: string, lesson: StationLesson): boolean {
  const line = getLine(slug);
  return Boolean(line && lesson.placement === "station" && lesson.stationId !== null && lesson.stationId === line.stationModules[0]);
}

export async function checkStep(
  student: Student | null,
  body: { taskSetId: string; stepId: string; answer: unknown },
): Promise<StepCheck | { error: "unknown_task" | "unknown_step" | "no_session" | "no_answer" }> {
  const found = findTaskSet(body.taskSetId);
  if (!found) return { error: "unknown_task" };
  if (!student && !isOpenLesson(found.line.slug, found.lesson)) return { error: "no_session" };

  const profile = student ? readProfile(student.profile) : null;
  const goal = profile?.goal ? { amount: profile.goal.amount, months: profile.goal.months } : null;
  const attempt = student ? (await countTaskAttempts(student.id, found.task.id)) + 1 : 1;
  const task = resolveTask(prepareLesson(found.lesson).task, { goal });
  const step = task.steps.find((s) => s.id === body.stepId);
  if (!step) return { error: "unknown_step" };

  // Rebuilt from the step's own shape, as the final submission does.
  const answer = sanitizeAnswers(task, { [step.id]: body.answer })[step.id];
  if (answer === undefined) return { error: "no_answer" };
  const s = scoreStep(step, answer, { goal, studentId: student?.id ?? GUEST, attempt, taskSetId: task.id });
  const credit = s.scored ? Math.max(0, Math.min(1, s.credit)) : 1;
  return { detail: { ...s, credit }, key: step };
}

/**
 * A whole task scored for a visitor without an account (a course's first
 * module only): the same result a signed-in submission gets, with nothing
 * stored. The browser keeps the answers and sends them again after sign-up
 * (components/player/GuestSync.tsx), which is when they are recorded.
 */
export function scoreGuest(body: { taskSetId: string; answers: unknown; hookAnswer: unknown }):
  | { score: number; total: number; passed: boolean; details: StepScore[]; stationDone: boolean; reveal: string; attempt: number; answerKey: AnswerKey }
  | { error: "unknown_task" | "no_session" } {
  const found = findTaskSet(body.taskSetId);
  if (!found) return { error: "unknown_task" };
  if (!isOpenLesson(found.line.slug, found.lesson)) return { error: "no_session" };
  const { lesson, task } = found;
  const answers = sanitizeAnswers(task, body.answers);
  const hookAnswer = sanitizeHook(lesson.hook.options, body.hookAnswer);
  const score = scoreTask(task, answers, { goal: null, studentId: GUEST, attempt: 1 });
  const picked = pickRevealWithSource(lesson.reveal, hookAnswer, answers);
  return {
    score: score.score,
    total: score.total,
    passed: score.passed,
    details: score.details,
    stationDone: false,
    reveal: picked.source === "default" && score.passed ? "" : picked.text,
    attempt: 1,
    answerKey: answerKey(prepareLesson(lesson).task, null),
  };
}
