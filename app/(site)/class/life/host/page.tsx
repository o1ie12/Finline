import type { Metadata } from "next";
import { redirect } from "next/navigation";
import "@/app/(game)/game.css";
import { getCurrentStudent } from "@/lib/session";
import { ClassLifeHost } from "@/components/classLife/ClassLifeHost";
import { ClassLifeShell } from "@/components/classLife/ClassLifeShell";

export const metadata: Metadata = {
  title: "人生賽局",
  description: "開一場人生賽局：學生分隊，全班同一個開局，依財務健康分排名。",
  robots: { index: false },
};

/** The teacher's screen for a class 人生賽局 round (02 §8). Hosting needs an account (spec 12 TCH-5). */
export default async function ClassLifeHostPage() {
  const student = await getCurrentStudent().catch(() => null);
  if (!student) redirect(`/signup?next=${encodeURIComponent("/class/life/host")}`);
  return (
    <ClassLifeShell>
      <ClassLifeHost />
    </ClassLifeShell>
  );
}
