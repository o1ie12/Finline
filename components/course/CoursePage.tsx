import Link from "next/link";
import { Icon } from "@/components/ui/icons";
import { AREAS, COURSE_FAQ, ITEM_TYPES, STEP_RUBRIC, TRACKS } from "@/content/curriculum";
import type { SampleQuestion as Sample } from "@/lib/coursePreview";
import { durationText, type CourseOutline, type OutlineModule } from "@/lib/curriculum";
import { LEVEL_NAME, moduleGrade, percent, type Best } from "@/lib/grades";
import type { LessonCard } from "@/lib/tasks/types";
import { DocArt } from "./DocArt";
import { SampleQuestion } from "./SampleQuestion";
import k from "./kit.module.css";
import s from "./course.module.css";

export interface ModuleState {
  status: "done" | "current" | "next";
  href?: string;
  /** The module is not needed to finish the course in the student's mode. */
  optional: boolean;
  /** The student's best attempt at the module's task. */
  best: Best | null;
}

export interface CourseView {
  outline: CourseOutline;
  signedIn: boolean;
  /** One per outline module, in order. */
  modules: ModuleState[];
  next: { index: number; title: string; href: string } | null;
  complete: boolean;
  certificate: { earned: boolean; href: string };
  snippet: string | null;
  prerequisites: { slug: string; name: string; code: string; done: boolean }[];
  electives: { title: string; summary: string; minutes: number; href: string }[];
  electivesTitle: string;
  branches: { title: string; href: string }[];
  tests: { title: string; body: string; href: string; link: string }[];
  /** What finishing the course opens in the life simulation; null when it is off. */
  unlocks: { text: string; on: boolean } | null;
  /** One real question to try on this page (lib/coursePreview.ts). */
  sample: Sample | null;
}

const DISCLAIMER = "這是學習練習的紀錄，不是真實的工作經驗。";
const pct = percent;

/** What a module contains, in one line: 2 個重點概念 · 1 個實作任務（4 題） */
function includes(m: OutlineModule): string {
  const concepts = m.items.filter((i) => i.type === "concept").length;
  const parts: string[] = [];
  if (concepts) parts.push(`${concepts} 個重點概念`);
  if (m.simulation) parts.push("1 個模擬");
  else if (m.questions) parts.push(`1 個實作任務（${m.questions} 題）`);
  return parts.join(" · ");
}

/**
 * A course's page (2026-11-12): what you will learn, one real question to
 * try, what is in every module, how it is graded and what you leave with,
 * before you start. The same page is the course home once you have:
 * progress, grades and where to continue. Reads lib/curriculum.ts; no figure
 * on it is typed by hand.
 *
 * One white sheet, not a stack of boxes: sections are divided by a rule.
 * The course's color is spent on the code plate, the route and the desk the
 * task's real document lies on.
 */
export function CoursePage({ v }: { v: CourseView }) {
  const o = v.outline;
  const { line, info, page, totals } = o;
  const area = AREAS[info.area];
  const track = TRACKS[info.track];
  const done = v.modules.filter((m) => m.status === "done").length;
  const started = done > 0 || v.modules.some((m) => m.best);
  const periods = Math.max(1, Math.ceil(totals.minutes / 45));
  // The sign says where this student goes next (the first module before they start).
  const at =
    v.signedIn && v.next
      ? { label: "下一個單元", module: o.modules[v.next.index - 1] }
      : v.signedIn && v.complete
        ? { label: "已完成", module: o.modules[o.modules.length - 1] }
        : { label: "第一個單元", module: o.modules[0] };
  const startHref = v.signedIn ? (v.next?.href ?? v.modules[0]?.href ?? `/line/${line.slug}`) : "/signup";
  const sections = [
    { id: "about", label: "課程介紹" },
    ...(v.sample ? [{ id: "try", label: "試做一題" }] : []),
    { id: "syllabus", label: "課程大綱" },
    { id: "grading", label: "評分方式" },
    { id: "outcomes", label: "完成之後" },
    { id: "faq", label: "常見問題" },
  ];

  const cta = v.signedIn ? (
    v.next ? (
      <Link href={v.next.href} className={k.go}>
        {started ? `繼續：單元 ${v.next.index}` : "開始課程"}
      </Link>
    ) : (
      <Link href={v.certificate.earned ? v.certificate.href : (v.modules[0]?.href ?? `/line/${line.slug}`)} className={k.go}>
        {v.certificate.earned ? "查看完成紀錄" : "再上一次"}
      </Link>
    )
  ) : (
    <Link href="/signup" className={k.go}>
      免費開始上課
    </Link>
  );

  return (
    <div className={s.page} id="top">
      {!v.signedIn ? (
        <header className={s.bar}>
          <Link href="/" className={s.brand}>
            錢途 <span>Finline</span>
          </Link>
          <nav className={s.barNav} aria-label="網站">
            <Link href="/lines">課程目錄</Link>
            <Link href="/signup#login">登入</Link>
            <Link href="/signup" className={s.barCta}>
              免費註冊
            </Link>
          </nav>
        </header>
      ) : null}

      <div className={s.inner} data-framed={v.signedIn || undefined}>
        <nav className={s.crumbs} aria-label="位置">
          <Link href={v.signedIn ? "/map" : "/lines"}>課程目錄</Link>
          <Icon name="chevron" size={14} />
          <span>{track.name}</span>
          <Icon name="chevron" size={14} />
          <span aria-current="page">{line.name}</span>
        </nav>

        <header className={`${k.card} ${s.hero}`}>
          <div className={s.heroTop}>
            <div className={s.heroText}>
              <p className={s.kicker}>
                <span className={k.plate}>{info.code}</span>
                {track.name} · {area.name}
              </p>
              <h1 className={s.h1}>{line.name}</h1>
              <p className={s.promise}>{page.promise}</p>
              <p className={s.meta}>
                <span>{page.difficulty}</span>
                <span>{totals.modules} 個單元</span>
                <span>{durationText(totals.minutes)}</span>
                <span>免費</span>
              </p>
              <div className={s.heroActions}>
                {cta}
                <a href={v.sample ? "#try" : "#syllabus"} className={k.ghost}>
                  {v.sample ? "先試做一題" : "看課程大綱"}
                </a>
              </div>
            </div>
            {/* The desk: the document this course puts in front of you, and the sign for where you start. */}
            <div className={s.heroArt}>
              {v.sample?.material ? (
                <DocArt material={v.sample.material} className={s.heroDoc} />
              ) : o.modules[0].cards[0] ? (
                <div className={s.heroNote} aria-hidden="true">
                  <CardPreview card={o.modules[0].cards[0]} />
                </div>
              ) : null}
              <div className={`${k.sign} ${s.heroSign}`}>
                <span className={k.signStripe} aria-hidden="true" />
                <div className={k.signBody}>
                  <div className={k.signKicker}>
                    {at.label} · {at.module.code}
                  </div>
                  <div className={k.signName}>{at.module.station}</div>
                  <div className={k.signSub}>{at.module.title}</div>
                </div>
              </div>
              {v.complete ? (
                <span className={s.stamp} aria-hidden="true">
                  已完成
                </span>
              ) : null}
            </div>
          </div>
          {/* The course as its line: one stop per module, the last one square. */}
          <ol className={s.strip} aria-label="這門課的單元">
            {o.modules.map((m, i) => {
              const state = v.signedIn ? v.modules[i].status : "next";
              return (
                <li key={m.code} data-state={state} data-final={m.final || undefined}>
                  <a href={`#m${m.index}`}>
                    <span className={s.stopDot}>{state === "done" ? <Icon name="check" size={12} strokeWidth={3} /> : null}</span>
                    <span className={s.stopName}>
                      {m.index}　{m.station}
                    </span>
                    <span className={s.stopMin}>{m.minutes} 分鐘</span>
                  </a>
                </li>
              );
            })}
          </ol>
        </header>

        <nav className={s.tabs} aria-label="本頁內容">
          {sections.map((x) => (
            <a key={x.id} href={`#${x.id}`}>
              {x.label}
            </a>
          ))}
        </nav>

        <div className={s.cols}>
          <div className={`${k.card} ${s.main}`}>
            {/* ---- 課程介紹 ---- */}
            <section id="about" className={s.section} aria-labelledby="about-h">
              <h2 id="about-h" className={s.h2}>
                學完這門課，你能夠
              </h2>
              <ul className={s.objectives}>
                {info.objectives.map((x) => (
                  <li key={x}>
                    <Icon name="check" size={18} strokeWidth={2.6} />
                    <span>{x}</span>
                  </li>
                ))}
              </ul>
              <div className={s.split}>
                <div>
                  <h3 className={s.h3}>你會練到的能力</h3>
                  <p className={s.skills}>{page.skills.join("　·　")}</p>
                  {o.documents.length ? (
                    <>
                      <h3 className={s.h3}>會讀到的文件</h3>
                      <p className={s.skills}>{o.documents.join("　·　")}</p>
                    </>
                  ) : null}
                </div>
                <dl className={s.details}>
                  <div>
                    <dt>程度</dt>
                    <dd>{page.difficulty}</dd>
                  </div>
                  <div>
                    <dt>時間</dt>
                    <dd>
                      {durationText(totals.minutes)}，{totals.modules} 個單元
                    </dd>
                  </div>
                  <div>
                    <dt>評量</dt>
                    <dd>
                      {totals.tasks} 個計分任務，共 {totals.scored} 題{totals.simulation ? "，加 1 個期末模擬" : ""}
                    </dd>
                  </div>
                  <div>
                    <dt>建議先修</dt>
                    <dd>
                      {v.prerequisites.length ? (
                        <>
                          {v.prerequisites.map((p, i) => (
                            <span key={p.slug}>
                              {i ? "、" : ""}
                              <Link href={`/line/${p.slug}`}>
                                {p.name}
                                {p.done ? "（已完成）" : ""}
                              </Link>
                            </span>
                          ))}
                          {info.prerequisiteNote ? <small>{info.prerequisiteNote}</small> : null}
                        </>
                      ) : (
                        "沒有，可以直接開始"
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>語言</dt>
                    <dd>繁體中文</dd>
                  </div>
                </dl>
              </div>
            </section>

            {/* ---- 試做一題 ---- */}
            {v.sample ? (
              <section id="try" className={s.section} aria-labelledby="try-h">
                <h2 id="try-h" className={s.h2}>
                  試做一題
                </h2>
                <p className={s.lead}>這是課程裡真的會出現的一題{v.sample.material ? "，旁邊是你要讀的文件" : ""}。選完按「對答案」，就會看到建議答案和原因。</p>
                <SampleQuestion q={v.sample} signedIn={v.signedIn} startHref={startHref} />
              </section>
            ) : null}

            {/* ---- 課程大綱 ---- */}
            <section id="syllabus" className={s.section} aria-labelledby="syllabus-h">
              <h2 id="syllabus-h" className={s.h2}>
                課程大綱
              </h2>
              <p className={s.lead}>
                {totals.modules} 個單元，建議照順序上。每個單元先問你一個情境問題，再做一份實作任務，作答後看解析和專家的想法。
              </p>
              <ol className={s.modules}>
                {o.modules.map((m, i) => (
                  <ModuleRow key={m.code} m={m} st={v.modules[i]} signedIn={v.signedIn} open={v.signedIn ? v.modules[i].status === "current" : i === 0} first={i === 0} />
                ))}
              </ol>

              {v.electives.length ? (
                <>
                  <h3 className={s.h3}>
                    {v.electivesTitle} <small>選修，不計入完成</small>
                  </h3>
                  <ul className={s.extras}>
                    {v.electives.map((e) => (
                      <li key={e.href}>
                        <Link href={e.href}>
                          <b>{e.title}</b>
                          <span>{e.summary}</span>
                          <small>約 {e.minutes} 分鐘</small>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {v.branches.length ? (
                <>
                  <h3 className={s.h3}>
                    延伸閱讀 <small>想多知道一點</small>
                  </h3>
                  <ul className={s.extras}>
                    {v.branches.map((b) => (
                      <li key={b.href}>
                        <Link href={b.href}>
                          <b>{b.title}</b>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </section>

            {/* ---- 評分方式 ---- */}
            <section id="grading" className={s.section} aria-labelledby="grading-h">
              <h2 id="grading-h" className={s.h2}>
                評分方式
              </h2>
              <dl className={s.policy}>
                <div>
                  <dt>自動計分</dt>
                  <dd>每個實作任務交出後馬上計分，並排顯示你的答案和建議答案。</dd>
                </div>
                <div>
                  <dt>及格標準</dt>
                  <dd>寫在每個任務上。達到標準就是通過；{pct(0.9)} 以上是精熟。</dd>
                </div>
                <div>
                  <dt>可以重做</dt>
                  <dd>成績表顯示最高分。第二次作答後，就算沒達標，單元也會記為完成，並標示「未達標」。</dd>
                </div>
                <div>
                  <dt>完成課程</dt>
                  <dd>完成每個必修單元{totals.simulation ? "和期末模擬" : "和最後一個單元"}，就會得到完成紀錄。</dd>
                </div>
              </dl>

              <div className={s.tableWrap}>
                <table className={s.table}>
                  <caption className="sr-only">{line.name}的評量</caption>
                  <thead>
                    <tr>
                      <th scope="col">單元</th>
                      <th scope="col">評量</th>
                      <th scope="col">計分題數</th>
                      <th scope="col">及格標準</th>
                      {v.signedIn ? <th scope="col">你的成績</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {o.modules.map((m, i) => {
                      const g = moduleGrade(m, v.modules[i].status === "done", v.modules[i].best);
                      return (
                        <tr key={m.code}>
                          <td>{m.index}</td>
                          <th scope="row">
                            {m.title}
                            <small>{m.simulation ? "期末模擬" : m.final ? "期末任務" : v.modules[i].optional ? "實作任務（選修）" : "實作任務"}</small>
                          </th>
                          <td>{m.simulation ? "不計分" : m.scored ? `${m.scored} 題` : "不計分"}</td>
                          <td>{m.pass !== null ? pct(m.pass) : "完成即可"}</td>
                          {v.signedIn ? (
                            <td>
                              <span className={s.grade} data-tone={g.tone}>
                                {g.text}
                              </span>
                              {v.modules[i].best && v.modules[i].best!.attempts > 1 ? <small>作答 {v.modules[i].best!.attempts} 次</small> : null}
                            </td>
                          ) : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {o.stepTypes.length ? (
                <details className={s.fold}>
                  <summary>每種題型怎麼計分</summary>
                  <dl className={s.rubric}>
                    {o.stepTypes.map((t) => (
                      <div key={t}>
                        <dt>{STEP_RUBRIC[t].name}</dt>
                        <dd>{STEP_RUBRIC[t].how}</dd>
                      </div>
                    ))}
                  </dl>
                  {o.modules
                    .filter((m) => m.selfCheck.length)
                    .map((m) => (
                      <div key={m.code} className={s.check}>
                        <p>
                          單元 {m.index}「{m.title}」簡答題的檢核項目
                        </p>
                        <ul>
                          {m.selfCheck.map((c) => (
                            <li key={c}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                </details>
              ) : null}

              {v.tests.map((t) => (
                <Link key={t.href} href={t.href} className={s.test}>
                  <b>{t.title}</b>
                  <span>{t.body}</span>
                  <span className={s.testLink}>{t.link}</span>
                </Link>
              ))}
            </section>

            {/* ---- 完成之後 ---- */}
            <section id="outcomes" className={s.section} aria-labelledby="outcomes-h">
              <h2 id="outcomes-h" className={s.h2}>
                完成之後
              </h2>
              <div className={s.after}>
                <div className={s.afterText}>
                  <h3 className={s.h3}>完成紀錄</h3>
                  <p>{v.certificate.earned ? `你已經完成${line.name}。紀錄上有你走過的每個單元和期末的結果。` : "完成每個必修單元後，會有一份列出每個單元和期末結果的完成紀錄。"}</p>
                  {v.certificate.earned ? (
                    <Link href={v.certificate.href} className={s.textLink}>
                      查看完成紀錄
                    </Link>
                  ) : null}
                  <h3 className={s.h3}>學習紀錄用語</h3>
                  {v.snippet ? <blockquote>{v.snippet}</blockquote> : <p>完成任務後，這裡會用你做過的內容寫出一段可以改寫的文字，方便整理自己的學習紀錄。</p>}
                  {/* TODO-VERIFY (D3): not confirmed that an online self-study record
                      counts as a 學習歷程 多元表現 item (VERIFIED.md item 9). */}
                  <p className={s.fine}>能不能放進學習歷程檔案，請先問學校的老師。{DISCLAIMER}</p>
                </div>
                {/* What the record lists, drawn from this course's own modules. */}
                <div className={s.record} aria-hidden="true">
                  <p className={s.recordHead}>
                    <span className={k.plate}>{info.code}</span>
                    完成紀錄
                  </p>
                  <p className={s.recordName}>{line.name}</p>
                  <ul>
                    {o.modules.map((m, i) => (
                      <li key={m.code} data-done={v.signedIn && v.modules[i].status === "done" ? "" : undefined}>
                        <span>{m.title}</span>
                        <i />
                      </li>
                    ))}
                  </ul>
                  <p className={s.recordFoot}>錢途 Finline · 學習練習的紀錄</p>
                </div>
              </div>
              <details className={s.fold}>
                <summary>面試小提示：3 個問題和回答方向</summary>
                <ol className={s.qa}>
                  {page.interview.map((q) => (
                    <li key={q.q}>
                      <b>{q.q}</b>
                      <span>{q.a}</span>
                    </li>
                  ))}
                </ol>
              </details>
              {v.unlocks ? (
                <p className={s.unlock}>
                  <Icon name={v.unlocks.on ? "check" : "lock"} size={16} />
                  <span>
                    {v.unlocks.on ? "已在人生模擬開放：" : "完成後在人生模擬開放："}
                    {v.unlocks.text}
                  </span>
                </p>
              ) : null}
            </section>

            {/* ---- 給老師與合作單位 ---- */}
            <section className={s.section} aria-labelledby="teach-h">
              <h2 id="teach-h" className={s.h2}>
                給老師與合作單位
              </h2>
              <dl className={s.details}>
                <div>
                  <dt>主題領域</dt>
                  <dd>
                    {area.name}（{area.en}）
                  </dd>
                </div>
                <div>
                  <dt>課堂時間</dt>
                  <dd>約 {periods} 節課（每節 45 分鐘，依任務時間估算）</dd>
                </div>
                <div>
                  <dt>評量</dt>
                  <dd>
                    {totals.scored} 題自動計分{o.modules.some((m) => m.selfCheck.length) ? "，另有不計分的簡答題和檢核項目" : ""}
                  </dd>
                </div>
                {o.verifiedOn ? (
                  <div>
                    <dt>內容查證</dt>
                    <dd>{o.verifiedOn.replace("-", " 年 ")} 月</dd>
                  </div>
                ) : null}
              </dl>
              <p className={s.lead}>
                想在班上或活動裡使用這門課，請看 <Link href="/partnerships">合作方式</Link>。
              </p>
            </section>

            {/* ---- 常見問題 ---- */}
            <section id="faq" className={s.section} aria-labelledby="faq-h">
              <h2 id="faq-h" className={s.h2}>
                常見問題
              </h2>
              <div className={s.faq}>
                <details>
                  <summary>這門課要花多久？</summary>
                  <p>
                    {durationText(totals.minutes)}，分成 {totals.modules} 個單元，每個單元 {Math.min(...o.modules.map((m) => m.minutes))} 到 {Math.max(...o.modules.map((m) => m.minutes))} 分鐘。時間是照每個任務的題數和文件估的，可以分幾天上。
                  </p>
                </details>
                {COURSE_FAQ.map((f) => (
                  <details key={f.q}>
                    <summary>{f.q}</summary>
                    <p>{f.a}</p>
                  </details>
                ))}
              </div>
            </section>
          </div>

          <aside className={`${k.glass} ${s.aside}`} aria-label={v.signedIn ? "你的進度" : "課程摘要"}>
            {v.signedIn ? (
              <>
                <div className={s.progressHead}>
                  <span>你的進度</span>
                  <b>
                    {done} / {totals.modules} 個單元
                  </b>
                </div>
                <div className={s.meter} role="img" aria-label={`完成 ${done} / ${totals.modules} 個單元`}>
                  <span style={{ width: pct(totals.modules ? done / totals.modules : 0) }} />
                </div>
                {v.next ? (
                  <p className={s.nextLine}>
                    下一個：單元 {v.next.index}　{v.next.title}
                  </p>
                ) : v.complete ? (
                  <p className={s.nextLine}>你已經完成這門課。</p>
                ) : null}
              </>
            ) : (
              <p className={s.asideTitle}>這門課包含</p>
            )}
            {cta}
            <ul className={s.includes}>
              <li>
                <Icon name="map" size={18} />
                {totals.modules} 個單元，{durationText(totals.minutes)}
              </li>
              {totals.concepts ? (
                <li>
                  <Icon name="info" size={18} />
                  {totals.concepts} 個重點概念
                </li>
              ) : null}
              <li>
                <Icon name="doc" size={18} />
                {totals.tasks} 個計分任務，共 {totals.scored} 題
              </li>
              {totals.simulation ? (
                <li>
                  <Icon name="bolt" size={18} />1 個期末模擬
                </li>
              ) : null}
              <li>
                <Icon name="award" size={18} />
                完成紀錄
              </li>
            </ul>
            {!v.signedIn ? <p className={s.fine}>免費，不用下載任何東西。</p> : null}
          </aside>
        </div>
      </div>
    </div>
  );
}

function ModuleRow({ m, st, signedIn, open, first }: { m: OutlineModule; st: ModuleState; signedIn: boolean; open: boolean; first: boolean }) {
  const inc = includes(m);
  const label = m.simulation ? "期末模擬" : m.final ? "期末任務" : st.optional ? "選修" : null;
  const grade = signedIn ? moduleGrade(m, st.status === "done", st.best) : null;
  return (
    <li className={s.module} id={`m${m.index}`} data-state={signedIn ? st.status : "next"} data-final={m.final || undefined}>
      <span className={s.modNo} aria-hidden="true">
        {signedIn && st.status === "done" ? <Icon name="check" size={12} strokeWidth={3} /> : null}
      </span>
      <details open={open}>
        <summary>
          <span className={s.modHead}>
            <span className={s.modKicker}>
              單元 {m.index} · {m.station}
              {label ? <em>{label}</em> : null}
              {signedIn && st.status === "current" ? <em data-on>下一個</em> : null}
            </span>
            <span className={s.modTitle}>{m.title}</span>
          </span>
          {grade && grade.level !== "none" ? (
            <span className={k.level} data-level={grade.level}>
              {LEVEL_NAME[grade.level]}
            </span>
          ) : null}
          <span className={s.modMins}>{m.minutes} 分鐘</span>
          <Icon name="down" size={18} />
        </summary>
        <div className={s.modBody}>
          <p className={s.modSummary}>{m.summary}</p>
          {m.does ? <p className={s.modDo}>你要做的：{m.does}</p> : null}
          {inc ? <p className={s.modInc}>包含：{inc}</p> : null}
          <ul className={s.items}>
            {m.items.map((it, i) => (
              <li key={i}>
                <span className={s.itemType} data-type={it.type}>
                  {ITEM_TYPES[it.type].name}
                </span>
                <span className={s.itemTitle}>
                  {it.title}
                  {it.type === "task" && m.questions ? (
                    <small>
                      {m.questions} 題{m.pass !== null ? ` · 及格 ${pct(m.pass)}` : ""}
                      {m.documents.length ? ` · ${m.documents.join("、")}` : ""}
                    </small>
                  ) : null}
                </span>
                <span className={s.itemNote}>{ITEM_TYPES[it.type].note}</span>
              </li>
            ))}
          </ul>
          {first && m.cards.length ? (
            <div className={s.preview}>
              <p className={s.previewLabel}>試看：這個單元的重點概念</p>
              <div className={s.cards}>
                {m.cards.map((c) => (
                  <CardPreview key={c.title} card={c} />
                ))}
              </div>
            </div>
          ) : null}
          {st.href || !signedIn ? (
            <Link href={signedIn ? st.href! : "/signup"} className={k.ghost}>
              {!signedIn ? "註冊後開始這個單元" : st.status === "done" ? "再做一次" : "開始這個單元"}
            </Link>
          ) : null}
        </div>
      </details>
    </li>
  );
}

/** A concept card as plain content (the station screen draws its own). */
function CardPreview({ card }: { card: LessonCard }) {
  return (
    <article className={s.card}>
      <h4>{card.title}</h4>
      {card.kind === "text" ? <p>{card.body}</p> : null}
      {card.kind === "formula" ? (
        <>
          <p className={s.formula}>{card.formula}</p>
          <p>{card.example}</p>
        </>
      ) : null}
      {card.kind === "flow" ? (
        <>
          <ol>
            {card.steps.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ol>
          {card.caption ? <p>{card.caption}</p> : null}
        </>
      ) : null}
      {card.kind === "compare" ? (
        <>
          <div className={s.compare}>
            {[card.left, card.right].map((side) => (
              <dl key={side.name}>
                <dt>{side.name}</dt>
                {side.rows.map((r) => (
                  <dd key={r.label}>
                    <span>{r.label}</span>
                    <b>{r.value}</b>
                  </dd>
                ))}
              </dl>
            ))}
          </div>
          {card.note ? <p>{card.note}</p> : null}
        </>
      ) : null}
      {card.kind === "matrix" ? (
        <ul>
          {card.cells.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
