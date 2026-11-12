import type { Metadata } from "next";
import { Catalogue } from "@/components/course/Catalogue";
import { PROGRAM } from "@/content/curriculum";
import { getLatestSimulationRunsByLine, getLineCompletions, getProgress } from "@/lib/db";
import { LINES, START_LINE, getLine } from "@/lib/lines";
import { lineStats } from "@/lib/lineStats";
import { effectiveMode } from "@/lib/modeModel";
import { pageMeta } from "@/lib/pageMeta";
import { allLineStatuses } from "@/lib/progressModel";
import { programView, type StudentProgress } from "@/lib/programView";
import { getCurrentStudent } from "@/lib/session";

const STATIONS = LINES.reduce((a, l) => a + lineStats(l).stations, 0);

export const metadata: Metadata = pageMeta({
  title: "課程目錄",
  description: `${PROGRAM.name}：${LINES.length} 門課、${STATIONS} 個單元。每個單元讀一份真實格式的帳單、契約或薪資單，做一份計分的實作任務。`,
  path: "/lines",
});

/**
 * The course catalogue (2026-11-12): the program, its sequence and every
 * course, before you sign up. Signed in, each course shows your progress.
 */
export default async function LinesPage() {
  let mine: StudentProgress | null = null;
  try {
    const student = await getCurrentStudent();
    if (student) {
      const mode = effectiveMode(student.mode);
      const [progress, runsByLine, completed] = await Promise.all([getProgress(student.id), getLatestSimulationRunsByLine(student.id), getLineCompletions(student.id)]);
      mine = { statuses: allLineStatuses(progress, runsByLine, mode, completed), progress, runsByLine, mode };
    }
  } catch {
    /* not configured: the catalogue without progress */
  }
  const start = getLine(START_LINE)!;
  return <Catalogue courses={programView(mine)} signedIn={Boolean(mine)} start={mine ? { href: "/today", label: "回到我的學習" } : { href: `/line/${START_LINE}`, label: `從第一門課開始：${start.name}` }} />;
}
