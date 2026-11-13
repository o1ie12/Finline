import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTaskResults } from "@/lib/db";
import { REVIEW_GAP_DAYS } from "@/lib/review";
import { reviewGroups, type ReviewGroup } from "@/lib/reviewView";
import { getCurrentStudent } from "@/lib/session";
import k from "@/components/course/kit.module.css";
import s from "@/components/course/learn.module.css";

export const metadata: Metadata = { title: "錯題夾" };

/**
 * 錯題夾 (2026-11-13): the questions the student's latest attempt missed,
 * by module. Due ones first (two days after the miss), a confident miss at
 * the top. Answering them again is a new attempt at that module with the
 * other answers kept, so the grade book's best score can only go up.
 */
export default async function ReviewPage() {
  const student = await getCurrentStudent().catch(() => null);
  if (!student) redirect("/signup?next=/review");
  const groups = reviewGroups(await getTaskResults(student.id).catch(() => []));
  const due = groups.filter((g) => g.due);
  const later = groups.filter((g) => !g.due);

  return (
    <div className={s.page}>
      <div className={s.inner}>
        <header className={s.hello}>
          <h1>錯題夾</h1>
          <p>做錯的題目會自動放進來，過 {REVIEW_GAP_DAYS} 天再回來考你一次。隔幾天再想一次，比當場重做記得久。</p>
        </header>

        {groups.length ? (
          <>
            {due.length ? <Groups title="可以複習了" groups={due} primary /> : null}
            {later.length ? <Groups title="過幾天再考你" note="想現在練也可以" groups={later} /> : null}
            <p className={s.fine}>再做一次時只會問你錯的那幾題，其他題的答案會保留。成績表記最高的一次，所以重做不會讓分數變低。</p>
          </>
        ) : (
          <section className={s.emptyCard}>
            <p className={s.empty}>錯題夾是空的。之後做錯的題目會出現在這裡。</p>
            <Link href="/today" className={k.go}>
              回到我的學習
            </Link>
          </section>
        )}
      </div>
    </div>
  );
}

function Groups({ title, note, groups, primary = false }: { title: string; note?: string; groups: ReviewGroup[]; primary?: boolean }) {
  return (
    <section className={s.group}>
      <h2 className={s.h2}>
        {title}
        {note ? <small>{note}</small> : null}
      </h2>
      {groups.map((g) => (
        <article key={g.taskSetId} className={s.gradeCard} style={g.vars}>
          <div className={s.gradeHead}>
            {g.code ? <span className={k.plate}>{g.code}</span> : null}
            <b className={s.reviewTitle}>
              {g.title}
              <small>
                {g.lineName} · 單元 {g.index}
              </small>
            </b>
            <em>{g.due ? `${g.items.length} 題` : `${g.daysLeft} 天後`}</em>
          </div>
          <ul className={s.reviewList}>
            {g.items.map((it) => (
              <li key={it.stepId}>
                <span>{it.prompt}</span>
                {it.sure ? <small>你當時很有把握</small> : null}
              </li>
            ))}
          </ul>
          <div className={s.reviewGo}>
            <Link href={g.href} className={primary ? k.go : k.ghost}>
              再做這 {g.items.length} 題
            </Link>
          </div>
        </article>
      ))}
    </section>
  );
}
