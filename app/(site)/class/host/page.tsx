import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { QuizHost } from "@/components/class/QuizHost";
import { isLineSlug } from "@/lib/lines";
import { getCurrentStudent } from "@/lib/session";

export const metadata: Metadata = { title: "開一個房間", robots: { index: false } };

/**
 * The teacher's quiz room (spec 12 TCH-5). Hosting needs an account: a
 * signed-out visitor goes to sign-up and comes back. ?line= preselects the
 * course (the lesson plans link here).
 */
export default async function ClassHostPage({ searchParams }: { searchParams: Promise<{ line?: string }> }) {
  const { line } = await searchParams;
  const picked = isLineSlug(line) ? line : null;
  const student = await getCurrentStudent().catch(() => null);
  if (!student) redirect(`/signup?next=${encodeURIComponent(picked ? `/class/host?line=${picked}` : "/class/host")}`);
  return <QuizHost initialLine={picked} />;
}
