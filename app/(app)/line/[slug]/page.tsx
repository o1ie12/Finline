import type { Metadata } from "next";
import { pageMeta } from "@/lib/pageMeta";
import { notFound } from "next/navigation";
import { CoursePage, type CourseView, type ModuleState } from "@/components/course/CoursePage";
import { TabFrame } from "@/components/ui/TabFrame";
import { LINE_PAGES } from "@/content/linePages";
import { buildLineStations } from "@/lib/buildStations";
import { courseOutline } from "@/lib/curriculum";
import { getLatestSimulationRunForLine, getLineCompletions, getLineTests, getProgress, getTaskResults } from "@/lib/db";
import { lineVars } from "@/lib/design/lineVars";
import { bestAttempts } from "@/lib/grades";
import { branchesForLine } from "@/lib/branches";
import { getLine, type LineSlug } from "@/lib/lines";
import { FLOW_V2, LIFE_SIM } from "@/lib/flags";
import { effectiveMode } from "@/lib/modeModel";
import { comparablePrePost, getPrePostQuestions } from "@/lib/prePostQuestions";
import { lineStatus, moduleDoneSet } from "@/lib/progressModel";
import { getCurrentStudent } from "@/lib/session";
import { lineContent } from "@/lib/tasks/registry";
import type { LineTest, ModuleProgress, SimulationRun, Student, TaskResultRow } from "@/lib/types";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const line = getLine((await params).slug);
  if (!line) return { title: "找不到課程" };
  // 11 META-1: the line's own one-sentence goal.
  return pageMeta({ title: line.name, description: `${line.name}：${LINE_PAGES[line.slug].promise}`, path: `/line/${line.slug}` });
}

/** Part E stations open on /station/; the older flow keeps /course/. */
const toStation = (href?: string) => href?.replace(/^\/line\/([^/]+)\/course\//, "/line/$1/station/");

/**
 * A course's page (2026-11-12): the syllabus, the grading and the outcomes
 * before you start, and the course home once you have. The outline comes
 * from lib/curriculum.ts; this page adds the student's progress and grades.
 */
export default async function LinePage({ params }: { params: Promise<{ slug: string }> }) {
  const line = getLine((await params).slug);
  if (!line) notFound();
  const slug = line.slug as LineSlug;

  let student: Student | null = null;
  let progress: ModuleProgress[] = [];
  let run: SimulationRun | null = null;
  let completed = new Set<string>();
  let tests: { pre: LineTest | null; post: LineTest | null } = { pre: null, post: null };
  let results: TaskResultRow[] = [];
  try {
    student = await getCurrentStudent();
    if (student) {
      const [p, r, t, c, tr] = await Promise.all([
        getProgress(student.id),
        getLatestSimulationRunForLine(student.id, slug),
        getLineTests(student.id, slug),
        getLineCompletions(student.id),
        getTaskResults(student.id),
      ]);
      progress = p;
      run = r;
      tests = { pre: t.pre, post: t.post };
      completed = c;
      results = tr.filter((x) => x.line_slug === slug);
    }
  } catch {
    /* not configured: the public page */
  }

  const mode = effectiveMode(student?.mode ?? null);
  const status = lineStatus(line, moduleDoneSet(progress), run, mode, completed.has(slug));
  const outline = courseOutline(slug);
  const content = lineContent(slug);

  const best = bestAttempts(results);

  // One state per module, from the same station list the map reads
  // (buildLineStations marks at most one module per course as current).
  const built = buildLineStations(line, progress, run, mode);
  const modules: ModuleState[] = outline.modules.map((m) => {
    const row = built.find((r) => (m.moduleNumber === null ? r.terminal : r.key === `${slug}-m${m.moduleNumber}`));
    return {
      status: row?.status === "done" ? "done" : row?.status === "current" ? "current" : "next",
      href: toStation(row?.href),
      optional: row ? row.required === false : false,
      best: m.taskId ? (best.get(m.taskId) ?? null) : null,
    };
  });
  const nextIndex = student ? modules.findIndex((m) => m.status === "current" && m.href) : -1;
  const next = nextIndex >= 0 ? { index: nextIndex + 1, title: outline.modules[nextIndex].title, href: modules[nextIndex].href! } : null;

  // 學習紀錄用語: built only from what the student actually did (F3.5).
  const done = [...new Map(results.map((r) => [r.task_set_id, r])).keys()];
  const doneLessons = (content?.lessons ?? []).filter((l) => done.includes(l.task.id));
  const minutes = doneLessons.reduce((a, l) => a + l.minutes, 0);
  const snippet = doneLessons.length
    ? `完成 Finline「${line.name}」線上自主學習（${doneLessons.length} 個任務，約 ${minutes} 分鐘），做了「${doneLessons
        .slice(0, 3)
        .map((l) => l.task.title)
        .join("」「")}」${doneLessons.length > 3 ? "等任務" : ""}，練習了${outline.page.skills.slice(0, 3).join("、")}。線上自主學習，非實習或工作經驗。`
    : null;

  // 前後測: opt-in, never blocks progress.
  const count = getPrePostQuestions(slug).length;
  const testCards: CourseView["tests"] = [];
  if (FLOW_V2 && student && count > 0) {
    // 06 G0: the quiz leaves the path: one optional card, never gating.
    const post = Boolean(tests.pre);
    testCards.push({
      title: "前後測（選填）",
      body: tests.pre && tests.post && comparablePrePost(tests.pre, tests.post) ? `前測 ${tests.pre.score} 題 → 後測 ${tests.post.score} 題。不影響進度和成績。` : `${count} 題，開始前和完成後各做一次，看自己進步多少。不影響進度和成績。`,
      href: `/line/${slug}/test/${post ? "post" : "pre"}`,
      link: post ? "做後測" : "做前測",
    });
  } else if (student && count > 0) {
    if (!tests.pre && !status.started)
      testCards.push({ title: "開始前，先測一次", body: `${count} 題前測，完成課程後可以再測一次，看見自己的進步。答錯不影響開始。`, href: `/line/${slug}/test/pre`, link: "開始前測" });
    if (status.complete && !tests.post)
      testCards.push({ title: "測一次學到的東西", body: `同樣的 ${count} 題後測${tests.pre ? "，可以和前測比較。" : "。"}`, href: `/line/${slug}/test/post`, link: "開始後測" });
    if (tests.pre && tests.post && comparablePrePost(tests.pre, tests.post))
      testCards.push({ title: `前測 ${tests.pre.score} 題 → 後測 ${tests.post.score} 題`, body: "這就是這門課留下來的東西。", href: `/line/${slug}/test/post`, link: "再測一次" });
  }

  const view: CourseView = {
    outline,
    signedIn: Boolean(student),
    modules,
    next,
    complete: status.complete,
    certificate: { earned: Boolean(student && status.complete && run), href: `/line/${slug}/certificate` },
    snippet,
    prerequisites: outline.info.prerequisites.map((p) => {
      const o = courseOutline(p);
      return { slug: p, name: o.line.name, code: o.info.code, done: completed.has(p) };
    }),
    electives: outline.electives.map((e) => ({ title: e.title, summary: e.summary, minutes: e.minutes, href: `/line/${slug}/bonus/${encodeURIComponent(e.taskId)}` })),
    electivesTitle: slug === "zhapian" ? "案件庫" : "加碼任務",
    branches: branchesForLine(slug).map((b) => ({ title: b.title, href: `/line/${slug}/branch/${b.id}` })),
    tests: testCards,
    unlocks: LIFE_SIM && content ? { text: content.unlocks, on: status.complete } : null,
  };

  const body = (
    <div style={{ ...lineVars(line), display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <CoursePage v={view} />
    </div>
  );
  // Signed in, the course page sits beside the sidebar (the tab bar on a phone).
  return student ? <TabFrame>{body}</TabFrame> : body;
}
