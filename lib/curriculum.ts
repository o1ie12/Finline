/**
 * A course's syllabus (2026-11-12), read from the line's own content: one
 * module per station plus the last one, each with the items a student meets
 * in order, the questions that are scored, the pass mark and the documents
 * on the desk. The course page, the catalogue and the grades table all read
 * this; nothing in it is typed by hand (content/curriculum.ts holds the
 * program-level copy: codes, objectives, sequence).
 *
 * Counts and minutes come from lib/stationFacts.ts, the one source for both.
 */
import { COURSES, DEFAULT_PASS, DOCUMENT_NAMES, ITEM_TYPES, courseInfo, type CourseInfo } from "@/content/curriculum";
import { LINE_PAGES, type LinePage } from "@/content/linePages";
import { endStation, getLine, type LineMeta, type LineSlug } from "@/lib/lines";
import { stationFacts } from "@/lib/stationFacts";
import { fillFigures } from "@/lib/tasks/figures";
import { lessonForStation, libraryLessons, lineContent, terminalLesson } from "@/lib/tasks/registry";
import type { LessonCard, StationLesson, TaskStep } from "@/lib/tasks/types";

export interface OutlineItem {
  type: keyof typeof ITEM_TYPES;
  title: string;
}

export interface OutlineModule {
  /** 1-based place in the course. */
  index: number;
  code: string;
  /** The station's module number; null for the last module. */
  moduleNumber: number | null;
  title: string;
  /** The station's name on the line (卡片站). */
  station: string;
  /** What the module teaches, one line. */
  summary: string;
  /** What the student does, one line. */
  does: string | null;
  minutes: number;
  items: OutlineItem[];
  taskId: string | null;
  /** Every question in the task; null when the module is a simulation. */
  questions: number | null;
  /** The ones that count toward the score. */
  scored: number;
  /** 0..1; null when nothing is scored. */
  pass: number | null;
  stepTypes: TaskStep["type"][];
  documents: string[];
  /** The self-check criteria of the module's written answers. */
  selfCheck: string[];
  takeaway: string | null;
  final: boolean;
  /** The module is a simulation with decisions, not a task set. */
  simulation: boolean;
  /** The module's concept cards, for the first module's preview. */
  cards: LessonCard[];
  hook: string | null;
}

export interface OutlineElective {
  taskId: string;
  title: string;
  summary: string;
  minutes: number;
  questions: number;
}

export interface CourseOutline {
  info: CourseInfo;
  line: LineMeta;
  page: LinePage;
  /** The course's place in the program, 1-based. */
  order: number;
  modules: OutlineModule[];
  electives: OutlineElective[];
  totals: {
    modules: number;
    minutes: number;
    concepts: number;
    /** Modules with a scored task. */
    tasks: number;
    /** Scored questions across the course. */
    scored: number;
    simulation: boolean;
  };
  documents: string[];
  stepTypes: TaskStep["type"][];
  /**
   * When the course's facts were checked, YYYY-MM: the oldest check among
   * its task sets, and only when every one of them carries a date.
   */
  verifiedOn: string | null;
}

const uniq = <T,>(xs: T[]): T[] => [...new Set(xs)];
const isScored = (s: TaskStep) => s.scored !== false;

function moduleFromLesson(lesson: StationLesson): Pick<OutlineModule, "items" | "taskId" | "questions" | "scored" | "pass" | "stepTypes" | "documents" | "selfCheck" | "takeaway" | "cards" | "hook"> {
  const steps = lesson.task.steps;
  const scored = steps.filter(isScored).length;
  return {
    items: [
      { type: "hook", title: lesson.hook.question },
      ...lesson.lessonCards.map((c): OutlineItem => ({ type: "concept", title: c.title })),
      { type: "task", title: lesson.task.title },
      { type: "review", title: lesson.takeaway.name ? `重點整理：${lesson.takeaway.name}` : "解析" },
    ],
    taskId: lesson.task.id,
    questions: steps.length,
    scored,
    pass: scored ? (lesson.task.passScore ?? DEFAULT_PASS) : null,
    stepTypes: uniq(steps.map((s) => s.type)),
    documents: uniq(lesson.task.materials.map((m) => DOCUMENT_NAMES[m.kind] ?? m.kind)),
    selfCheck: steps.flatMap((s) => (s.type === "write" ? s.selfCheck : [])),
    takeaway: lesson.takeaway.name || null,
    cards: lesson.lessonCards,
    hook: lesson.hook.question,
  };
}

export function courseOutline(slug: LineSlug): CourseOutline {
  const line = getLine(slug);
  const info = courseInfo(slug);
  if (!line || !info) throw new Error(`courseOutline: no course for "${slug}"`);
  const content = lineContent(slug);
  const end = endStation(line);

  const modules: OutlineModule[] = [...line.stationModules, null].map((n, i) => {
    const facts = stationFacts(line, n);
    const raw = n === null ? terminalLesson(slug) : lessonForStation(slug, n);
    const lesson = raw ? fillFigures(raw) : null;
    const base = { index: i + 1, code: facts.code, moduleNumber: n, station: facts.name, minutes: facts.minutes, final: n === null };
    if (lesson) {
      return {
        ...base,
        ...moduleFromLesson(lesson),
        title: lesson.task.title,
        summary: lesson.task.brief.learn,
        does: lesson.task.brief.do ?? null,
        simulation: false,
      };
    }
    // The last module of a line that keeps its original simulation.
    const cards = content?.terminal?.lessonCards ?? [];
    return {
      ...base,
      title: end.title,
      summary: line.sim.covers,
      does: line.sim.subtitle,
      items: [...cards.map((c): OutlineItem => ({ type: "concept", title: c.title })), { type: "sim", title: end.title }],
      taskId: null,
      questions: null,
      scored: 0,
      pass: null,
      stepTypes: [],
      documents: [],
      selfCheck: [],
      takeaway: content?.takeaway.name ?? null,
      simulation: true,
      cards,
      hook: null,
    };
  });

  const electives = libraryLessons(slug).map((raw) => {
    const l = fillFigures(raw);
    return { taskId: l.task.id, title: l.task.title, summary: l.task.brief.learn, minutes: l.minutes, questions: l.task.steps.length };
  });

  const checked = (content?.lessons ?? []).filter((l) => l.placement !== "library").map((l) => l.task.verifiedOn);
  const verifiedOn = checked.length && checked.every((d): d is string => typeof d === "string") ? [...checked].sort()[0] : null;

  return {
    info,
    line,
    page: LINE_PAGES[slug],
    order: COURSES.findIndex((c) => c.slug === slug) + 1,
    modules,
    electives,
    totals: {
      modules: modules.length,
      minutes: modules.reduce((a, m) => a + m.minutes, 0),
      concepts: modules.reduce((a, m) => a + m.items.filter((x) => x.type === "concept").length, 0),
      tasks: modules.filter((m) => m.scored > 0).length,
      scored: modules.reduce((a, m) => a + m.scored, 0),
      simulation: modules.some((m) => m.simulation),
    },
    documents: uniq(modules.flatMap((m) => m.documents)),
    stepTypes: uniq(modules.flatMap((m) => m.stepTypes)),
    verifiedOn,
  };
}

/** Every course in teaching order. */
export function programOutline(): CourseOutline[] {
  return COURSES.map((c) => courseOutline(c.slug));
}

/** 約 1 小時 20 分 / 約 45 分鐘. */
export function durationText(minutes: number): string {
  if (minutes < 60) return `約 ${minutes} 分鐘`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `約 ${h} 小時 ${m} 分` : `約 ${h} 小時`;
}
