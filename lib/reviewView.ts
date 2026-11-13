import "server-only";
import type { CSSProperties } from "react";
import { courseOutline } from "@/lib/curriculum";
import { lineVars } from "@/lib/design/lineVars";
import { getLine } from "@/lib/lines";
import { reviewEntries } from "@/lib/review";
import { prepareLesson } from "@/lib/tasks/prepare";
import { findTaskSet } from "@/lib/tasks/registry";
import type { StationLesson } from "@/lib/tasks/types";
import type { TaskResultRow } from "@/lib/types";

/**
 * 錯題夾 for the pages (2026-11-13): lib/review.ts decides what is in the
 * folder; this adds each module's name, the questions' wording and the link
 * that asks them again.
 */
export interface ReviewGroup {
  taskSetId: string;
  lineName: string;
  code: string;
  vars: CSSProperties;
  title: string;
  /** 1-based place in the course. */
  index: number;
  href: string;
  items: { stepId: string; prompt: string; sure: boolean }[];
  due: boolean;
  daysLeft: number;
}

/** A module the student can open now, or null. */
function moduleOf(taskSetId: string): { lesson: StationLesson; slug: string; index: number } | null {
  const found = findTaskSet(taskSetId);
  if (!found || found.lesson.placement !== "station" || found.lesson.stationId === null) return null;
  const line = getLine(found.line.slug);
  const at = line ? line.stationModules.indexOf(found.lesson.stationId) : -1;
  return line && at >= 0 ? { lesson: found.lesson, slug: line.slug, index: at + 1 } : null;
}

const scoredSteps = (taskSetId: string) => moduleOf(taskSetId)?.lesson.task.steps.filter((s) => s.scored !== false).map((s) => s.id) ?? null;

export function reviewGroups(results: TaskResultRow[], now: Date = new Date()): ReviewGroup[] {
  return reviewEntries(results, scoredSteps, now).flatMap((e) => {
    const m = moduleOf(e.taskSetId);
    const line = m ? getLine(m.slug) : null;
    if (!m || !line) return [];
    const steps = prepareLesson(m.lesson).task.steps;
    return [
      {
        taskSetId: e.taskSetId,
        lineName: line.name,
        code: courseOutline(line.slug)?.info.code ?? "",
        vars: lineVars(line),
        title: m.lesson.task.title,
        index: m.index,
        href: `/line/${line.slug}/station/${m.lesson.stationId}?review=1`,
        items: e.missed.map((x) => ({ stepId: x.stepId, prompt: steps.find((s) => s.id === x.stepId)?.prompt ?? "", sure: x.sure })),
        due: e.due,
        daysLeft: e.daysLeft,
      },
    ];
  });
}

/** The folder in numbers, for the home card. */
export function reviewSummary(groups: ReviewGroup[]): { due: number; later: number; href: string | null } {
  const count = (gs: ReviewGroup[]) => gs.reduce((a, g) => a + g.items.length, 0);
  const due = groups.filter((g) => g.due);
  return { due: count(due), later: count(groups.filter((g) => !g.due)), href: due[0]?.href ?? null };
}

/**
 * Asking a module's missed questions again: which steps are asked and which
 * answers are carried from the latest attempt (06 G1 redo). A step drawn
 * per attempt is always asked again, because a carried answer is scored
 * against the previous attempt's draw and the student may not have seen
 * that one (a module played before sign-up, or a carry of a carry).
 */
export function reviewRedo(lesson: StationLesson, latest: TaskResultRow, writes: Record<string, string> | undefined): { steps: string[]; carry: Record<string, unknown> } | null {
  const task = lesson.task;
  const stored = new Map((latest.result?.steps ?? []).map((s) => [s.stepId, s]));
  const ask = task.steps.filter((s) => {
    if (s.type === "rate" && s.drawCount !== undefined) return true;
    if (s.scored === false) return false;
    const was = stored.get(s.id);
    return !was || was.correct < 1 - 1e-9;
  });
  const missed = ask.filter((s) => s.scored !== false && (stored.get(s.id)?.correct ?? 0) < 1 - 1e-9);
  if (!missed.length) return null;
  const asked = new Set(ask.map((s) => s.id));
  const carry: Record<string, unknown> = {};
  for (const s of task.steps) {
    if (asked.has(s.id)) continue;
    // A write step's text lives in the student's profile only (06 F3.3).
    carry[s.id] = s.type === "write" ? { text: writes?.[`${task.id}:${s.id}`] ?? "" } : (stored.get(s.id)?.answer ?? null);
  }
  return { steps: ask.map((s) => s.id), carry };
}
