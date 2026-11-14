import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/teachers/PrintButton";
import { COURSES } from "@/content/curriculum";
import { lineVars } from "@/lib/design/lineVars";
import { WARMUP_MINUTES, WRAP_MINUTES, lessonPlan, type PlanPeriod } from "@/lib/lessonPlan";
import { getLine, isLineSlug } from "@/lib/lines";
import { pageMeta } from "@/lib/pageMeta";
import k from "@/components/course/kit.module.css";
import s from "../teachers.module.css";
import "../print.css";

export const dynamicParams = false;
export function generateStaticParams() {
  return COURSES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (!isLineSlug(slug)) return {};
  const p = lessonPlan(slug);
  return pageMeta({ title: `${p.name} 教案`, description: `約 ${p.minutes} 分鐘，${p.units.length} 個單元，建議 ${p.periods.length} 節課`, path: `/teachers/${slug}` });
}

const Lines = ({ n }: { n: number }) => (
  <span className={s.blank} aria-hidden="true">
    {Array.from({ length: n }, (_, i) => (
      <i key={i} />
    ))}
  </span>
);

/**
 * A course's lesson plan (spec 12 TCH-3, TCH-4): one table per class period,
 * the extras, the answer key behind a fold, and a worksheet. Every sentence
 * that is not a fixed label comes from the course data (lib/lessonPlan.ts).
 */
export default async function LessonPlanPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const line = isLineSlug(slug) ? getLine(slug) : null;
  if (!line || !isLineSlug(slug)) notFound();
  const p = lessonPlan(slug);

  return (
    <div className={s.page} style={lineVars(line)} data-lesson-plan="">
      <div className={s.head}>
        <p className={s.crumb} data-no-print="">
          <Link href="/teachers">給老師</Link>
        </p>
        <p className={s.kicker}>
          <span className={k.plate}>{p.code}</span>
          {p.level}
        </p>
        <h1 className={s.h1}>{p.name} 教案</h1>
        <p className={s.lead}>
          約 {p.minutes} 分鐘，{p.units.length} 個單元，建議 {p.periods.length} 節課
        </p>
        <dl className={s.facts}>
          <div>
            <dt>學習目標</dt>
            <dd>
              <ul>
                {p.objectives.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </dd>
          </div>
          {p.documents.length ? (
            <div>
              <dt>會讀到的文件</dt>
              <dd>{p.documents.join("、")}</dd>
            </div>
          ) : null}
          {p.prerequisites.length ? (
            <div>
              <dt>建議先修</dt>
              <dd>{p.prerequisites.map((x) => `${x.code} ${x.name}`).join("、")}</dd>
            </div>
          ) : null}
        </dl>
        <div className={s.actions} data-no-print="">
          <PrintButton className={k.go}>列印教案</PrintButton>
          <Link href={`/class/host?line=${slug}`} className={k.ghost}>
            開一個房間
          </Link>
        </div>
      </div>

      {p.periods.map((period) => (
        <Period key={period.number} period={period} />
      ))}

      {p.electives.length || p.readings.length ? (
        <section className={s.section} aria-label="延伸">
          {p.electives.length ? (
            <>
              <h2 className={s.h2}>加碼任務</h2>
              <p className={s.note}>選修，適合提早做完的學生</p>
              <ul className={s.list}>
                {p.electives.map((e) => (
                  <li key={e.title}>
                    {e.title}（{e.minutes} 分鐘）
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {p.readings.length ? (
            <>
              <h2 className={s.h2}>延伸閱讀</h2>
              <ul className={s.list}>
                {p.readings.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      ) : null}

      {p.answerKey.length ? (
        <details className={s.key}>
          <summary>
            <h2 className={s.h2}>老師用：建議答案</h2>
          </summary>
          {p.answerKey.map(({ unit, questions }) => (
            <div key={unit.index} className={s.keyUnit}>
              <h3 className={s.h3}>
                單元 {unit.index}：{unit.title}
              </h3>
              <ol>
                {questions.map((q) => (
                  <li key={q.prompt}>
                    <p className={s.keyQ}>{q.prompt}</p>
                    {q.answer.length === 1 ? (
                      <p className={s.keyA}>{q.answer[0]}</p>
                    ) : (
                      <ul className={s.keyA}>
                        {q.answer.map((a) => (
                          <li key={a}>{a}</li>
                        ))}
                      </ul>
                    )}
                    <p className={s.keyWhy}>
                      <b>為什麼</b>
                      {q.why}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </details>
      ) : null}

      <section className={s.sheet} aria-labelledby="sheet-h">
        <h2 id="sheet-h" className={s.sheetTitle}>
          {p.name} 學習單
        </h2>
        <p className={s.sheetName}>姓名：＿＿＿＿　班級：＿＿＿＿</p>
        {p.units
          .filter((u) => u.hook)
          .map((u) => (
            <div key={u.index} className={s.sheetUnit}>
              <h3 className={s.h3}>
                單元 {u.index}：{u.title}
              </h3>
              <p>開始前：{u.hook}</p>
              <Lines n={2} />
              <p>我一開始的答案：＿＿＿＿　做完後我的想法：＿＿＿＿</p>
              <p>差在哪？為什麼？</p>
              <Lines n={3} />
            </div>
          ))}
        <div className={s.sheetUnit}>
          <p>今天帶走的一件事：</p>
          <Lines n={3} />
        </div>
      </section>

      <p className={s.printFooter} aria-hidden="true">
        錢途 Finline · finlinetw.org/teachers/{slug}
      </p>
    </div>
  );
}

function Period({ period }: { period: PlanPeriod }) {
  const shown = period.units.filter((u) => u.shown);
  const first = shown[0];
  const last = shown[shown.length - 1];
  return (
    <section className={s.period} aria-labelledby={`p${period.number}`}>
      <h2 id={`p${period.number}`} className={s.h2}>
        第 {period.number} 節
      </h2>
      {period.long ? <p className={s.note}>這個單元比較長，討論可以縮短或留到下一節。</p> : null}
      <table className={s.plan}>
        <thead>
          <tr>
            <th scope="col">時間</th>
            <th scope="col">環節</th>
            <th scope="col">學生做什麼</th>
            <th scope="col">老師可以問</th>
          </tr>
        </thead>
        <tbody>
          {first ? (
            <tr>
              <td data-label="時間">{WARMUP_MINUTES} 分鐘</td>
              <td data-label="環節">暖身</td>
              <td data-label="學生做什麼">全班一起想</td>
              <td data-label="老師可以問">{first.hook}</td>
            </tr>
          ) : null}
          {shown.map((u) => (
            <tr key={u.index}>
              <td data-label="時間">{u.minutes} 分鐘</td>
              <td data-label="環節">
                單元 {u.index}：{u.title}
              </td>
              <td data-label="學生做什麼">{u.does}</td>
              <td data-label="老師可以問">做完後回頭看：{u.hook}你的想法有變嗎？</td>
            </tr>
          ))}
          <tr>
            <td data-label="時間">{WRAP_MINUTES} 分鐘</td>
            <td data-label="環節">討論和收尾</td>
            <td data-label="學生做什麼">和組員比答案，寫下一件帶走的事</td>
            <td data-label="老師可以問">
              <ul>
                {shown.map((u) => (
                  <li key={u.index}>{u.title}：大家最常選錯哪一個？為什麼會這樣想？</li>
                ))}
              </ul>
              {last?.takeaway.length ? (
                <ul className={s.take}>
                  {last.takeaway.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              ) : null}
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
