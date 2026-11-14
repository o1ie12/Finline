/**
 * A course's lesson plan for teachers (spec 12, TCH-3 and TCH-6), built only
 * from what the course data already holds: unit titles and minutes, each
 * unit's 想一想 question, 「你要做的」 and the 「帶走這個」 points. Nothing here
 * is written for the plan; a unit that lacks a field is left out of the table
 * and listed in `hidden`. Answers are not part of a plan: the page is public.
 *
 * One function decides the number of class periods, for /teachers,
 * /teachers/[slug] and the course page alike.
 */
import { branchesForLine } from "@/lib/branches";
import { courseOutline, type CourseOutline, type OutlineModule } from "@/lib/curriculum";
import type { LineSlug } from "@/lib/lines";
import { fillFigures } from "@/lib/tasks/figures";
import { lessonForStation, lineContent, terminalLesson } from "@/lib/tasks/registry";
import type { StationLesson } from "@/lib/tasks/types";

/**
 * A class period is 45 minutes: 暖身 5, the units, then 討論和收尾. Units may
 * take up to 35 minutes. Up to 30 leaves the full 10 minutes to close; 31 to
 * 35 leaves 5.
 */
export const PERIOD_MINUTES = 45;
export const WARMUP_MINUTES = 5;
export const WRAP_MINUTES = 10;
export const SHORT_WRAP_MINUTES = 5;
export const UNIT_BUDGET = PERIOD_MINUTES - WARMUP_MINUTES - SHORT_WRAP_MINUTES;

/** 討論和收尾 for a period whose units take this long. */
export function wrapMinutes(unitMinutes: number): number {
  return unitMinutes > PERIOD_MINUTES - WARMUP_MINUTES - WRAP_MINUTES ? SHORT_WRAP_MINUTES : WRAP_MINUTES;
}

/**
 * Units into periods, in order: a new period starts when the next unit would
 * push the period's unit minutes past the budget. A unit longer than the
 * budget gets a period to itself. Returns each period's unit positions.
 */
export function splitPeriods(minutes: number[], budget: number = UNIT_BUDGET): number[][] {
  const periods: number[][] = [];
  let sum = 0;
  minutes.forEach((m, i) => {
    const cur = periods[periods.length - 1];
    if (!cur || sum + m > budget) {
      periods.push([i]);
      sum = m;
    } else {
      cur.push(i);
      sum += m;
    }
  });
  return periods;
}

export interface PlanUnit {
  /** 1-based place in the course. */
  index: number;
  title: string;
  minutes: number;
  /** 「你要做的」 */
  does: string | null;
  /** The unit's 想一想 question. */
  hook: string | null;
  /** 「帶走這個」 points. */
  takeaway: string[];
  /** In the plan table: only when both the question and 「你要做的」 exist. */
  shown: boolean;
  /** The earlier unit (1-based) whose 想一想 this one repeats: the plan then points back to it. */
  repeats: number | null;
  /** A simulation, or a unit with nothing scored: there is no wrong answer to discuss, only choices. */
  open: boolean;
}

export interface PlanPeriod {
  number: number;
  units: PlanUnit[];
  /** 討論和收尾: 10 minutes, or 5 when the units take 31 to 35. */
  wrap: number;
  /** One unit longer than the unit budget: the plan says discussion can shrink. */
  long: boolean;
}

export interface LessonPlan {
  slug: LineSlug;
  code: string;
  name: string;
  level: string;
  minutes: number;
  units: PlanUnit[];
  periods: PlanPeriod[];
  objectives: string[];
  documents: string[];
  prerequisites: { slug: LineSlug; code: string; name: string }[];
  electives: { title: string; minutes: number }[];
  readings: string[];
  /** Units left out of the table, and which field was missing. */
  hidden: { index: number; title: string; missing: string[] }[];
}

/** How many class periods a course takes. The one source for the number. */
export function coursePeriods(outline: CourseOutline): number {
  return splitPeriods(outline.modules.map((m) => m.minutes)).length;
}

function lessonOf(slug: LineSlug, m: OutlineModule): StationLesson | null {
  const raw = m.moduleNumber === null ? terminalLesson(slug) : lessonForStation(slug, m.moduleNumber);
  return raw ? fillFigures(raw) : null;
}

export function lessonPlan(slug: LineSlug): LessonPlan {
  const o = courseOutline(slug);
  const content = lineContent(slug);
  const lessons = o.modules.map((m) => lessonOf(slug, m));

  const units: PlanUnit[] = o.modules.map((m, i) => {
    const lesson = lessons[i];
    const takeaway = lesson ? lesson.takeaway.lines : m.final ? (content?.takeaway.lines ?? []) : [];
    // A final that keeps its original simulation has no 想一想 of its own;
    // the course's own opening question is the one its page showed before it.
    const hook = m.hook ?? (m.final ? (content?.hook.question ?? null) : null);
    return { index: m.index, title: m.title, minutes: m.minutes, does: m.does, hook, takeaway, shown: Boolean(hook && m.does), repeats: null, open: m.simulation || m.scored === 0 };
  });
  units.forEach((u, i) => {
    const first = u.hook ? units.findIndex((x) => x.hook === u.hook) : i;
    if (first < i) u.repeats = units[first].index;
  });

  const periods: PlanPeriod[] = splitPeriods(units.map((u) => u.minutes)).map((at, i) => ({
    number: i + 1,
    units: at.map((j) => units[j]),
    wrap: wrapMinutes(at.reduce((a, j) => a + units[j].minutes, 0)),
    long: at.length === 1 && units[at[0]].minutes > UNIT_BUDGET,
  }));

  return {
    slug,
    code: o.info.code,
    name: o.line.name,
    level: o.page.difficulty,
    minutes: o.totals.minutes,
    units,
    periods,
    objectives: o.info.objectives,
    documents: o.documents,
    prerequisites: o.info.prerequisites.map((p) => {
      const c = courseOutline(p);
      return { slug: p, code: c.info.code, name: c.line.name };
    }),
    electives: o.electives.map((e) => ({ title: e.title, minutes: e.minutes })),
    readings: branchesForLine(slug).map((b) => b.title),
    hidden: units.filter((u) => !u.shown).map((u) => ({ index: u.index, title: u.title, missing: [...(u.hook ? [] : ["想一想"]), ...(u.does ? [] : ["你要做的"])] })),
  };
}
