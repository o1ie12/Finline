import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { buildLineStations } from "@/lib/buildStations";
import { programOutline } from "@/lib/curriculum";
import { getLatestSimulationRunsByLine, getLineCompletions, getProgress, getTaskResults } from "@/lib/db";
import { lineVars } from "@/lib/design/lineVars";
import { LEVEL_NAME, bestAttempts, moduleGrade, percent } from "@/lib/grades";
import { effectiveMode } from "@/lib/modeModel";
import { allLineStatuses } from "@/lib/progressModel";
import { getCurrentStudent } from "@/lib/session";
import k from "@/components/course/kit.module.css";
import s from "@/components/course/learn.module.css";

export const metadata: Metadata = { title: "成績" };

const toStation = (href?: string) => href?.replace(/^\/line\/([^/]+)\/course\//, "/line/$1/station/");

/**
 * 成績 (2026-11-12): the student's transcript. Every course they have
 * started, each module's best attempt against its pass mark, and what is
 * left. The same rule as the course page's grades table (lib/grades.ts).
 */
export default async function GradesPage() {
  const student = await getCurrentStudent().catch(() => null);
  if (!student) redirect("/signup");
  const mode = effectiveMode(student.mode);
  const [progress, runsByLine, completed, results] = await Promise.all([
    getProgress(student.id),
    getLatestSimulationRunsByLine(student.id),
    getLineCompletions(student.id),
    getTaskResults(student.id).catch(() => []),
  ]);
  const statuses = allLineStatuses(progress, runsByLine, mode, completed);
  const best = bestAttempts(results);

  const courses = programOutline()
    .map((o) => {
      const built = buildLineStations(o.line, progress, runsByLine[o.line.slug] ?? null, mode);
      const rows = o.modules.map((m, i) => {
        const done = built[i]?.status === "done";
        const b = m.taskId ? (best.get(m.taskId) ?? null) : null;
        return { m, done, best: b, grade: moduleGrade(m, done, b), href: toStation(built[i]?.href) };
      });
      const st = statuses.find((x) => x.line.slug === o.line.slug);
      return { o, rows, complete: Boolean(st?.complete), active: rows.some((r) => r.done || r.best) };
    })
    .filter((c) => c.active);

  const scored = courses.flatMap((c) => c.rows).filter((r) => r.grade.ratio !== null);
  const passed = scored.filter((r) => r.grade.passed).length;
  const average = scored.length ? scored.reduce((a, r) => a + r.grade.ratio!, 0) / scored.length : null;

  return (
    <div className={s.page}>
      <div className={s.inner}>
        <header className={s.hello}>
          <h1>成績</h1>
          <p>每個計分任務的最高分和及格標準。任務可以重做，這裡只記最高的一次。</p>
        </header>

        {courses.length ? (
          <>
            <dl className={s.stats}>
              <div>
                <dt>完成的課程</dt>
                <dd>{courses.filter((c) => c.complete).length} 門</dd>
              </div>
              <div>
                <dt>進行中的課程</dt>
                <dd>{courses.filter((c) => !c.complete).length} 門</dd>
              </div>
              <div>
                <dt>通過的任務</dt>
                <dd>
                  {passed} / {scored.length} 個
                </dd>
              </div>
              <div>
                <dt>平均最高分</dt>
                <dd>{average === null ? "還沒有" : percent(average)}</dd>
              </div>
            </dl>

            {courses.map(({ o, rows, complete }) => (
              <section key={o.line.slug} className={s.gradeCard} style={lineVars(o.line)}>
                <div className={s.gradeHead}>
                  <span className={k.plate}>{o.info.code}</span>
                  <Link href={`/line/${o.line.slug}`}>{o.line.name}</Link>
                  <em data-done={complete || undefined}>
                    {complete ? "已完成" : `${rows.filter((r) => r.done).length} / ${rows.length} 個單元`}
                  </em>
                </div>
                <div className={s.tableWrap}>
                  <table className={s.table}>
                    <caption className="sr-only">{o.line.name}的成績</caption>
                    <thead>
                      <tr>
                        <th scope="col">單元</th>
                        <th scope="col">評量</th>
                        <th scope="col">及格標準</th>
                        <th scope="col">最高分</th>
                        <th scope="col">程度</th>
                        <th scope="col">
                          <span className="sr-only">動作</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.m.code}>
                          <td>{r.m.index}</td>
                          <th scope="row">
                            {r.m.title}
                            <small>{r.m.simulation ? "期末模擬" : r.m.scored ? `${r.m.scored} 題計分` : "不計分"}</small>
                          </th>
                          <td>{r.m.pass !== null ? percent(r.m.pass) : "完成即可"}</td>
                          <td>
                            {r.grade.ratio !== null && r.m.pass !== null ? (
                              // The bar: the best score, with the pass mark as a tick.
                              <span className={s.score} data-tone={r.grade.tone} aria-hidden="true">
                                <span style={{ width: percent(r.grade.ratio) }} />
                                <i style={{ left: percent(r.m.pass) }} />
                              </span>
                            ) : null}
                            <span className={s.grade} data-tone={r.grade.tone}>
                              {r.grade.text}
                            </span>
                            {r.best && r.best.attempts > 1 ? <small>作答 {r.best.attempts} 次</small> : null}
                          </td>
                          <td>
                            <span className={k.level} data-level={r.grade.level}>
                              {LEVEL_NAME[r.grade.level]}
                            </span>
                          </td>
                          <td>{r.href ? <Link href={r.href}>{r.done || r.best ? "重做" : "開始"}</Link> : null}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
            <p className={s.fine}>程度看最高分：達到及格標準是「達標」，90% 以上是「精熟」，還沒到是「練習中」。第二次作答後沒達標，單元會記為完成並標示「未達標」，讓你可以繼續往下上。</p>
          </>
        ) : (
          <section className={s.emptyCard}>
            <p className={s.empty}>還沒有成績。完成第一個單元的實作任務後，分數會出現在這裡。</p>
            <Link href="/map" className={k.go}>
              到課程目錄挑一門課
            </Link>
          </section>
        )}
      </div>
    </div>
  );
}
