import Link from "next/link";
import { AREAS, COURSE_FAQ, DEFAULT_PASS, PROGRAM, type AreaId } from "@/content/curriculum";
import { FLOW_EXTRAS, FLOW_STEPS } from "@/content/flow";
import { durationText } from "@/lib/curriculum";
import { LIFE_SIM } from "@/lib/flags";
import type { ProgramCourse } from "@/lib/programView";
import type { Material } from "@/lib/tasks/types";
import s from "./catalogue.module.css";
import { CourseBrowser } from "./CourseBrowser";
import { DocArt } from "./DocArt";
import k from "./kit.module.css";

const AREA_ORDER: AreaId[] = ["income", "spending", "saving", "credit", "investing", "risk"];

/**
 * The course catalogue (2026-11-12): the program in one card with the real
 * documents its tasks use, the courses (by track, or by a moment in your
 * life), then one sheet for the topic areas, how a module runs, grading and
 * the questions people ask. Signed in, each course shows where you stand.
 */
export function Catalogue({
  courses,
  signedIn,
  start,
  framed = false,
  art = [],
  teachers = false,
}: {
  courses: ProgramCourse[];
  signedIn: boolean;
  start: { href: string; label: string };
  framed?: boolean;
  /** The public catalogue points teachers to 給老師 (spec 12 TCH-2); the signed-in 課程 tab does not. */
  teachers?: boolean;
  /** Up to three task documents, drawn as the header's artwork (lib/coursePreview.ts). */
  art?: Material[];
}) {
  const minutes = courses.reduce((a, c) => a + c.minutes, 0);
  const modules = courses.reduce((a, c) => a + c.modules, 0);
  const scored = courses.reduce((a, c) => a + c.scored, 0);
  const finished = courses.filter((c) => c.state === "done").length;
  const steps = FLOW_STEPS.filter((st) => LIFE_SIM || st.id !== "life");

  return (
    <div className={s.page} data-framed={framed || undefined}>
      <header className={`${k.card} ${s.head}`}>
        <span className={s.stripe} aria-hidden="true" />
        <div className={s.headMain}>
          <p className={s.kicker}>課程目錄</p>
          <h1 className={s.h1}>{PROGRAM.name}</h1>
          <p className={s.intro}>{PROGRAM.promise}</p>
          {teachers ? (
            <p className={s.teach}>
              老師想在課堂上用？看 <Link href="/teachers">給老師</Link>。
            </p>
          ) : null}
          <p className={s.facts}>
            <span>{courses.length} 門課</span>
            <span>{modules} 個單元</span>
            <span>{durationText(minutes)}</span>
            <span>{scored} 題計分</span>
            <span>免費</span>
          </p>
          <div className={s.actions}>
            <Link href={start.href} className={k.go}>
              {start.label}
            </Link>
            {!signedIn ? (
              <Link href="/signup" className={k.ghost}>
                免費註冊
              </Link>
            ) : (
              <span className={s.done}>
                已完成 {finished} / {courses.length} 門課
              </span>
            )}
          </div>
          <p className={s.audience}>適合：{PROGRAM.audience}</p>
        </div>
        {art.length ? (
          <div className={s.headArt} aria-hidden="true">
            {art.slice(0, 3).map((m, i) => (
              <DocArt key={i} material={m} className={s.sheet} />
            ))}
          </div>
        ) : null}
      </header>

      <CourseBrowser courses={courses} signedIn={signedIn} />

      <div className={`${k.card} ${s.paper}`}>
        <section className={s.section} aria-labelledby="areas-h">
          <h2 id="areas-h" className={s.h2}>
            涵蓋的主題領域
          </h2>
          <p className={s.lead}>六個領域，每個領域至少有一門核心課程。</p>
          <dl className={s.areas}>
            {AREA_ORDER.map((a) => (
              <div key={a}>
                <dt>
                  {AREAS[a].name}
                  <small>{AREAS[a].en}</small>
                </dt>
                <dd>
                  {AREAS[a].blurb}
                  <span>
                    {courses
                      .filter((c) => c.area === a)
                      .map((c) => (
                        <Link key={c.slug} href={`/line/${c.slug}`} style={c.vars}>
                          {c.name}
                        </Link>
                      ))}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className={s.section} aria-labelledby="how-h">
          <h2 id="how-h" className={s.h2}>
            每個單元怎麼上
          </h2>
          <ol className={s.how}>
            {/* 11 COPY-1: the stops from content/flow.ts. */}
            {steps.map((st, i) => (
              <li key={st.id}>
                <b>{i + 1}</b>
                <strong>{st.label}</strong>
                <span>{st.meaning}</span>
              </li>
            ))}
          </ol>
          <p className={s.fine}>{FLOW_EXTRAS}</p>
        </section>

        <section className={s.section} aria-labelledby="grade-h">
          <h2 id="grade-h" className={s.h2}>
            評分與完成
          </h2>
          <dl className={s.policy}>
            <div>
              <dt>自動計分</dt>
              <dd>每個實作任務交出後馬上計分，並排顯示你的答案和建議答案。</dd>
            </div>
            <div>
              <dt>及格標準 {Math.round(DEFAULT_PASS * 100)}%</dt>
              <dd>每門課的課程頁列出每個任務的題數和及格標準。</dd>
            </div>
            <div>
              <dt>可以重做</dt>
              <dd>成績表顯示最高分。第二次作答後沒達標，單元會記為完成並標示「未達標」。</dd>
            </div>
            <div>
              <dt>完成紀錄</dt>
              <dd>完成一門課的必修單元和期末，就有一份完成紀錄。這是學習練習的紀錄，不是真實的工作經驗。</dd>
            </div>
          </dl>
        </section>

        <section className={s.section} aria-labelledby="faq-h">
          <h2 id="faq-h" className={s.h2}>
            常見問題
          </h2>
          <div className={s.faq}>
            {COURSE_FAQ.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
