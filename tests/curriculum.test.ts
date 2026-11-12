/**
 * The program (2026-11-12): every line is one course with a code, a place
 * in the sequence and objectives; a course's syllabus is read from its own
 * content and agrees with the one count (lib/lineStats.ts); a grade never
 * calls a second-attempt completion a pass.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { AREAS, COURSES, COURSE_FAQ, DEFAULT_PASS, MOMENTS, PROGRAM, STEP_RUBRIC, TRACKS, type AreaId } from "@/content/curriculum";
import { courseOutline, durationText, programOutline } from "@/lib/curriculum";
import { MASTERY, bestAttempts, moduleGrade } from "@/lib/grades";
import { LINES, START_LINE } from "@/lib/lines";
import { lineStats } from "@/lib/lineStats";
import { programView } from "@/lib/programView";

test("curriculum: every line is exactly one course, with a unique code", () => {
  assert.deepEqual([...COURSES.map((c) => c.slug)].sort(), [...LINES.map((l) => l.slug)].sort());
  assert.equal(new Set(COURSES.map((c) => c.code)).size, COURSES.length);
  for (const c of COURSES) assert.match(c.code, /^FL[1-4]\d{2}$/, c.slug);
  assert.equal(COURSES[0].slug, START_LINE, "the program starts with the start line");
});

test("curriculum: core first, then electives, then the capstone; a prerequisite always comes earlier", () => {
  const rank = { core: 0, elective: 1, capstone: 2 } as const;
  const order = COURSES.map((c) => rank[c.track]);
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  assert.equal(COURSES.filter((c) => c.track === "capstone").length, 1);
  COURSES.forEach((c, i) => {
    for (const p of c.prerequisites) {
      const at = COURSES.findIndex((x) => x.slug === p);
      assert.ok(at >= 0 && at < i, `${c.slug}: ${p} comes before it`);
    }
    if (c.prerequisiteNote) assert.ok(c.prerequisites.length > 0, `${c.slug}: a note needs a prerequisite`);
  });
});

test("curriculum: every topic area has a core course", () => {
  for (const a of Object.keys(AREAS) as AreaId[]) {
    if (a === "capstone") continue;
    assert.ok(COURSES.some((c) => c.area === a && c.track === "core"), `${AREAS[a].name} has a core course`);
  }
});

test("curriculum copy: 3 to 5 objectives, no 我, no em dash, no job or outcome promise", () => {
  const all = [PROGRAM.promise, PROGRAM.audience, ...Object.values(AREAS).map((a) => a.blurb), ...Object.values(TRACKS).map((t) => t.blurb), ...COURSE_FAQ.flatMap((f) => [f.q, f.a]), ...Object.values(STEP_RUBRIC).map((r) => r.how)];
  for (const c of COURSES) {
    assert.ok(c.objectives.length >= 3 && c.objectives.length <= 5, `${c.slug}: ${c.objectives.length} objectives`);
    all.push(...c.objectives, c.prerequisiteNote ?? "");
  }
  for (const text of all) {
    assert.doesNotMatch(text, /——|—/, text);
    assert.doesNotMatch(text, /保證|錄取|找到工作|加薪|賺到/, text);
  }
  for (const c of COURSES) for (const o of c.objectives) assert.doesNotMatch(o, /我/, o);
});

test("syllabus: a course's modules, minutes and scored questions come from its content", () => {
  for (const line of LINES) {
    const o = courseOutline(line.slug);
    const stats = lineStats(line);
    assert.equal(o.totals.modules, stats.stations, `${line.slug}: modules = the one station count`);
    assert.equal(o.totals.minutes, stats.minutes, `${line.slug}: minutes = the one minute count`);
    assert.equal(o.modules.at(-1)!.final, true);
    for (const m of o.modules) {
      assert.ok(m.title && m.summary, `${m.code}: a title and a summary`);
      assert.ok(m.items.length > 0, `${m.code}: at least one item`);
      if (m.scored > 0) assert.equal(m.pass, DEFAULT_PASS, `${m.code}: the pass mark the FAQ and the catalogue state`);
      else assert.equal(m.pass, null, `${m.code}: nothing scored, no pass mark`);
      for (const t of m.stepTypes) assert.ok(STEP_RUBRIC[t], `${m.code}: ${t} has a scoring rule on the page`);
      if (m.simulation) assert.equal(m.questions, null);
    }
  }
  assert.equal(programOutline().length, LINES.length);
});

test("grades: the best attempt counts; a second-attempt completion is never a pass", () => {
  const best = bestAttempts([
    { task_set_id: "a", score: 1, total: 4, attempt: 1 },
    { task_set_id: "a", score: 3, total: 4, attempt: 2 },
    { task_set_id: "a", score: 2, total: 4, attempt: 3 },
  ]);
  assert.deepEqual(best.get("a"), { score: 3, total: 4, attempts: 3 });
  const m = { pass: 0.6, simulation: false };
  assert.equal(moduleGrade(m, true, best.get("a")!).text, "通過 · 75%");
  const low = moduleGrade(m, true, { score: 1, total: 4, attempts: 2 });
  assert.equal(low.passed, false);
  assert.match(low.text, /^已完成，未達標/);
  assert.match(moduleGrade(m, false, { score: 1, total: 4, attempts: 1 }).text, /^未達標，可重做/);
  assert.equal(moduleGrade(m, false, null).text, "尚未作答");
  assert.equal(moduleGrade({ pass: null, simulation: true }, true, null).text, "已完成");
  // 3 of 5 is exactly the pass mark.
  assert.equal(moduleGrade(m, true, { score: 3, total: 5, attempts: 1 }).passed, true);
});

test("grades: the level follows the best score (練習中, 達標, 精熟)", () => {
  const m = { pass: 0.6, simulation: false };
  assert.equal(MASTERY, 0.9);
  assert.equal(moduleGrade(m, false, null).level, "none");
  assert.equal(moduleGrade(m, false, { score: 1, total: 4, attempts: 1 }).level, "practicing");
  assert.equal(moduleGrade(m, true, { score: 3, total: 4, attempts: 1 }).level, "passed");
  assert.equal(moduleGrade(m, true, { score: 9, total: 10, attempts: 1 }).level, "mastered");
  assert.equal(moduleGrade({ pass: null, simulation: true }, true, null).level, "passed");
});

test("catalogue filter: every life moment names real courses, at least two, none twice", () => {
  assert.ok(MOMENTS.length >= 3);
  for (const m of MOMENTS) {
    assert.ok(m.courses.length >= 2, m.name);
    assert.equal(new Set(m.courses).size, m.courses.length, m.name);
    for (const slug of m.courses) assert.ok(COURSES.some((c) => c.slug === slug), `${m.name}: ${slug}`);
    assert.doesNotMatch(m.name, /——|—/);
  }
});

test("program view: signed out, every course is new and in teaching order", () => {
  const v = programView(null);
  assert.deepEqual(v.map((c) => c.slug), COURSES.map((c) => c.slug));
  assert.ok(v.every((c) => c.state === "new" && c.done === 0 && c.nextHref === null));
  assert.equal(durationText(45), "約 45 分鐘");
  assert.equal(durationText(60), "約 1 小時");
  assert.equal(durationText(431), "約 7 小時 11 分");
});
