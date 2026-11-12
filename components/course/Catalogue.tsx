import Link from "next/link";
import { AREAS, COURSE_FAQ, DEFAULT_PASS, PROGRAM, TRACKS, type AreaId, type TrackId } from "@/content/curriculum";
import { FLOW_EXTRAS, FLOW_STEPS } from "@/content/flow";
import { LIFE_SIM } from "@/lib/flags";
import type { ProgramCourse } from "@/lib/programView";
import s from "./catalogue.module.css";
import { CourseTile } from "./CourseTile";
import k from "./kit.module.css";

const TRACK_ORDER: TrackId[] = ["core", "elective", "capstone"];
const AREA_ORDER: AreaId[] = ["income", "spending", "saving", "credit", "investing", "risk"];

/**
 * The course catalogue (2026-11-12): the twelve courses as one program.
 * A dark board with the program's facts and all twelve course plates, then
 * each track's courses as tiles in their line's color, the topic areas, how
 * a module runs and how work is graded. Signed in, each tile shows where the
 * student stands.
 */
export function Catalogue({ courses, signedIn, start, framed = false }: { courses: ProgramCourse[]; signedIn: boolean; start: { href: string; label: string }; framed?: boolean }) {
  const minutes = courses.reduce((a, c) => a + c.minutes, 0);
  const modules = courses.reduce((a, c) => a + c.modules, 0);
  const scored = courses.reduce((a, c) => a + c.scored, 0);
  const finished = courses.filter((c) => c.state === "done").length;
  const steps = FLOW_STEPS.filter((st) => LIFE_SIM || st.id !== "life");

  return (
    <div className={s.page} data-framed={framed || undefined}>
      <header className={s.head}>
        <span className={s.stripe} aria-hidden="true" />
        <div className={s.headMain}>
          <p className={s.kicker}>課程目錄</p>
          <h1 className={s.h1}>{PROGRAM.name}</h1>
          <p className={s.intro}>{PROGRAM.promise}</p>
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
        <dl className={s.facts}>
          <div>
            <dt>課程</dt>
            <dd>{courses.length}</dd>
          </div>
          <div>
            <dt>單元</dt>
            <dd>{modules}</dd>
          </div>
          <div>
            <dt>計分題</dt>
            <dd>{scored}</dd>
          </div>
          <div>
            <dt>費用</dt>
            <dd>
              <small>免費</small>
            </dd>
          </div>
          <div>
            <dt>總時數</dt>
            <dd>
              {Math.floor(minutes / 60)}
              <small>小時</small>
              {minutes % 60}
              <small>分</small>
            </dd>
          </div>
        </dl>
        {/* All twelve courses at a glance, each in its line's color. */}
        <ul className={s.network} aria-label="所有課程">
          {courses.map((c) => (
            <li key={c.slug} style={c.vars}>
              <Link href={`/line/${c.slug}`}>
                <b>{c.code}</b>
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </header>

      {TRACK_ORDER.map((t) => {
        const list = courses.filter((c) => c.track === t);
        return (
          <section key={t} id={t} className={s.track} aria-labelledby={`${t}-h`}>
            <div className={s.trackHead}>
              <h2 id={`${t}-h`} className={s.h2}>
                {TRACKS[t].name}
                <span>{list.length} 門</span>
              </h2>
              <p>{TRACKS[t].blurb}</p>
            </div>
            <ol className={s.tiles}>
              {list.map((c) => (
                <li key={c.slug} style={c.vars}>
                  <CourseTile c={c} signedIn={signedIn} numbered={t === "core"} />
                </li>
              ))}
            </ol>
          </section>
        );
      })}

      <section className={s.section} aria-labelledby="areas-h">
        <h2 id="areas-h" className={s.h2}>
          涵蓋的主題領域
        </h2>
        <p className={s.lead}>六個領域，每個領域至少有一門核心課程。</p>
        <ul className={s.areas}>
          {AREA_ORDER.map((a) => (
            <li key={a}>
              <b>{AREAS[a].name}</b>
              <small>{AREAS[a].en}</small>
              <p>{AREAS[a].blurb}</p>
              <span className={s.areaCourses}>
                {courses
                  .filter((c) => c.area === a)
                  .map((c) => (
                    <Link key={c.slug} href={`/line/${c.slug}`} style={c.vars}>
                      {c.name}
                    </Link>
                  ))}
              </span>
            </li>
          ))}
        </ul>
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
        <ul className={s.policy}>
          <li>
            <b>自動計分</b>每個實作任務交出後馬上計分，並排顯示你的答案和建議答案。
          </li>
          <li>
            <b>及格標準 {Math.round(DEFAULT_PASS * 100)}%</b>每門課的課程頁列出每個任務的題數和及格標準。
          </li>
          <li>
            <b>可以重做</b>成績表顯示最高分。第二次作答後沒達標，單元會記為完成並標示「未達標」。
          </li>
          <li>
            <b>完成紀錄</b>完成一門課的必修單元和期末，就有一份完成紀錄。這是學習練習的紀錄，不是真實的工作經驗。
          </li>
        </ul>
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
  );
}
