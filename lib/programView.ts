/**
 * The program as a student sees it (2026-11-12): every course in teaching
 * order with its facts (lib/curriculum.ts) and, signed in, where the student
 * stands in it. The catalogue (/lines, /map) and the home page read this.
 */
import type { CSSProperties } from "react";
import { AREAS, type AreaId, type TrackId } from "@/content/curriculum";
import { buildLineStations } from "@/lib/buildStations";
import { programOutline } from "@/lib/curriculum";
import { lineVars } from "@/lib/design/lineVars";
import type { LineSlug } from "@/lib/lines";
import type { LineStatus } from "@/lib/progressModel";
import type { ModuleProgress, SimulationRun, StudentMode } from "@/lib/types";

export interface ProgramCourse {
  slug: LineSlug;
  /** 1-based place in the program. */
  order: number;
  code: string;
  name: string;
  promise: string;
  difficulty: string;
  track: TrackId;
  area: AreaId;
  areaName: string;
  modules: number;
  minutes: number;
  /** Scored questions. */
  scored: number;
  prerequisites: string[];
  vars: CSSProperties;
  state: "done" | "started" | "new";
  /** Modules finished, the last one included. */
  done: number;
  /** Where the student continues in this course. */
  nextHref: string | null;
  /** The module that link opens. */
  next: { index: number; title: string; minutes: number } | null;
}

export interface StudentProgress {
  statuses: LineStatus[];
  progress: ModuleProgress[];
  runsByLine: Record<string, SimulationRun>;
  mode: StudentMode;
}

const toStation = (href: string) => href.replace(/^\/line\/([^/]+)\/course\//, "/line/$1/station/");

export function programView(p: StudentProgress | null): ProgramCourse[] {
  const outlines = programOutline();
  const nameOf = new Map(outlines.map((o) => [o.line.slug, o.line.name]));
  return outlines.map((o) => {
    const st = p?.statuses.find((s) => s.line.slug === o.line.slug) ?? null;
    const built = p ? buildLineStations(o.line, p.progress, p.runsByLine[o.line.slug] ?? null, p.mode) : [];
    const done = built.filter((r) => r.status === "done").length;
    const at = built.findIndex((r) => r.status === "current" && r.href);
    const current = at >= 0 ? built[at] : undefined;
    const mod = at >= 0 ? o.modules[at] : undefined;
    return {
      slug: o.line.slug,
      order: o.order,
      code: o.info.code,
      name: o.line.name,
      promise: o.page.promise,
      difficulty: o.page.difficulty,
      track: o.info.track,
      area: o.info.area,
      areaName: AREAS[o.info.area].name,
      modules: o.totals.modules,
      minutes: o.totals.minutes,
      scored: o.totals.scored,
      prerequisites: o.info.prerequisites.map((s) => nameOf.get(s) ?? s),
      vars: lineVars(o.line),
      state: st?.complete ? "done" : st?.started || done > 0 ? "started" : "new",
      done,
      nextHref: current?.href ? toStation(current.href) : null,
      next: mod ? { index: mod.index, title: mod.title, minutes: mod.minutes } : null,
    };
  });
}
