import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Catalogue } from "@/components/course/Catalogue";
import { catalogueArt } from "@/lib/coursePreview";
import { pageStyles as ps } from "@/components/page/Page";
import { getLatestSimulationRunsByLine, getLineCompletions, getProgress } from "@/lib/db";
import { LIFE_SIM } from "@/lib/flags";
import { effectiveMode } from "@/lib/modeModel";
import { needsOnboarding } from "@/lib/onboarding";
import { allLineStatuses } from "@/lib/progressModel";
import { programView } from "@/lib/programView";
import { getCurrentStudent } from "@/lib/session";

export const metadata: Metadata = { title: "課程目錄" };

/**
 * 課程 (2026-11-12): the course catalogue with the student's progress, the
 * same page as /lines inside the signed-in frame.
 */
export default async function MapPage() {
  const student = await getCurrentStudent().catch(() => null);
  if (!student) redirect("/lines");
  if (LIFE_SIM && needsOnboarding(student)) redirect("/onboarding/goal");
  const mode = effectiveMode(student.mode);
  const [progress, runsByLine, completed] = await Promise.all([getProgress(student.id), getLatestSimulationRunsByLine(student.id), getLineCompletions(student.id)]);
  const courses = programView({ statuses: allLineStatuses(progress, runsByLine, mode, completed), progress, runsByLine, mode });
  const next = courses.find((c) => c.state === "started" && c.nextHref) ?? courses.find((c) => c.state === "new");
  return (
    <div className={ps.frame}>
      <Catalogue art={catalogueArt()} courses={courses} signedIn framed start={next ? { href: next.nextHref ?? `/line/${next.slug}`, label: next.state === "started" ? `繼續：${next.name}` : `開始：${next.name}` } : { href: "/today", label: "回到我的學習" }} />
    </div>
  );
}
