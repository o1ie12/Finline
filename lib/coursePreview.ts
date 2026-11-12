/**
 * A course's sample question (2026-11-12): one real, scored multiple-choice
 * question from the course, answerable on the course page before signing up.
 *
 * The same rules as a station (lib/tasks/publicLesson.ts): the browser gets
 * the question without its answer; the answer comes back only after an
 * attempt, from POST /api/preview, and only for this one question. Which
 * question it is depends on the course alone, so the page and the endpoint
 * always mean the same one.
 */
import { getLine, type LineSlug } from "@/lib/lines";
import { fillFigures } from "@/lib/tasks/figures";
import { lessonForPage, prepareLesson } from "@/lib/tasks/prepare";
import { lessonForStation } from "@/lib/tasks/registry";
import { resolveTask } from "@/lib/tasks/resolve";
import { scoreStep } from "@/lib/tasks/scoring";
import type { ChoiceStep, Material, StationLesson, TaskStep } from "@/lib/tasks/types";

/** The shuffle key for the sample: every visitor sees the same order. */
const VISITOR = "preview";
const ATTEMPT = 1;

const isSample = (s: TaskStep): s is ChoiceStep => s.type === "choice" && s.scored !== false && Boolean(s.correct || s.correctNearest);

function pick(slug: LineSlug): { lesson: StationLesson; stepId: string; index: number } | null {
  const line = getLine(slug);
  if (!line) return null;
  const lessons = line.stationModules.flatMap((n, i) => {
    const l = lessonForStation(slug, n);
    return l ? [{ lesson: fillFigures(l), index: i + 1 }] : [];
  });
  // A question asked beside exactly one document reads best on its own;
  // then one with no document; then any.
  for (const want of [1, 0, null]) {
    for (const c of lessons) {
      if (want !== null && c.lesson.task.materials.length !== want) continue;
      const step = c.lesson.task.steps.find(isSample);
      if (step) return { lesson: c.lesson, stepId: step.id, index: c.index };
    }
  }
  return null;
}

export interface SampleQuestion {
  slug: LineSlug;
  moduleIndex: number;
  moduleTitle: string;
  /** Who is asking (fictional), and what they ask. */
  from: { name: string; role: string; org: string };
  message: string;
  /** The question as a station sends it: no answer, options shuffled. */
  step: ChoiceStep;
  material: Material | null;
}

export function sampleQuestion(slug: LineSlug): SampleQuestion | null {
  const p = pick(slug);
  if (!p) return null;
  const shown = lessonForPage(p.lesson, VISITOR, ATTEMPT);
  const step = shown.task.steps.find((s) => s.id === p.stepId);
  if (!step || step.type !== "choice") return null;
  return {
    slug,
    moduleIndex: p.index,
    moduleTitle: p.lesson.task.title,
    from: p.lesson.task.brief.from,
    message: p.lesson.task.brief.message,
    step,
    material: shown.task.materials[0] ?? null,
  };
}

export interface SampleResult {
  /** 0..1, as a station scores it. */
  credit: number;
  correct: string | null;
  correctReason: string | null;
  explanation: string;
}

export function scoreSample(slug: LineSlug, answer: unknown): SampleResult | null {
  const p = pick(slug);
  if (!p) return null;
  const task = resolveTask(prepareLesson(p.lesson).task, { goal: null });
  const step = task.steps.find((s) => s.id === p.stepId);
  if (!step || step.type !== "choice") return null;
  const a = answer && typeof answer === "object" ? (answer as Record<string, unknown>) : {};
  const clean = { option: typeof a.option === "string" ? a.option : undefined, reason: typeof a.reason === "string" ? a.reason : undefined };
  const s = scoreStep(step, clean, { taskSetId: task.id, studentId: VISITOR, attempt: ATTEMPT });
  return { credit: s.credit, correct: step.correct ?? null, correctReason: step.correctReason ?? null, explanation: step.explanation };
}

/** Three different task documents, for the catalogue's artwork: the first courses that have one. */
export function catalogueArt(): Material[] {
  const out: Material[] = [];
  for (const slug of ["xinyong", "zhiya", "zhapian", "touzi", "baoxian", "qixin", "cunqian"] as LineSlug[]) {
    const m = sampleQuestion(slug)?.material;
    if (m && !out.some((x) => x.kind === m.kind)) out.push(m);
    if (out.length === 3) break;
  }
  return out;
}
