import { SOURCES, type SourceId } from "@/content/sources";
import { lineFacts } from "@/lib/stationFacts";
import Link from "next/link";
import { stationLetterCode } from "@/lib/design/lineCode";
import { lineVars } from "@/lib/design/lineVars";
import { LINES, START_LINE, endStation, getLine, type LineMeta, type LineSlug } from "@/lib/lines";
import { lineStats } from "@/lib/lineStats";
import { getModule } from "@/lib/modules";
import { sampleQuestion } from "@/lib/coursePreview";
import { lessonForStation } from "@/lib/tasks/registry";
import { SampleQuestion } from "@/components/course/SampleQuestion";
import { Arrow, SectionTag } from "./bits";
import { FareGate } from "./FareGate";
import s from "./landing.module.css";

// The start line first (06 G5 item 3), then three more.
const FEATURED: LineSlug[] = [START_LINE, ...(["xinyong", "cunqian", "zhapian"] as LineSlug[]).filter((s) => s !== START_LINE)].slice(0, 4) as LineSlug[];
const BOARD: LineSlug[] = [START_LINE, ...(["xinyong", "cunqian", "qixin", "zhapian", "touzi"] as LineSlug[]).filter((s) => s !== START_LINE)].slice(0, 5) as LineSlug[];

// 11 COPY-1, COPY-2: the minutes come from data, never typed.
const ALL_MINUTES = LINES.flatMap((l) => lineFacts(l).stations.map((st) => st.minutes));
const MIN_MINUTES = Math.min(...ALL_MINUTES);
const MAX_MINUTES = Math.max(...ALL_MINUTES);

// The figures the lessons already teach (lib/modules.ts, content/lines/xinyong.ts)
// and the old landing showed; the 0.3% stock rate is pinned by tests/regressions.
// 11 VERIFY-1: every figure has a primary source (content/sources.ts),
// shown under it.
const TAIWAN: { title: string; body: string; figure: string; unit: string; source: SourceId }[] = [
  { title: "股票價差不課所得稅", body: "個人買賣上市櫃股票和 ETF 的價差，目前停徵所得稅；改在賣出時課證交稅，賺賠都收。", figure: "0.1%", unit: "ETF 證交稅（股票 0.3%）", source: "securitiesTax" },
  { title: "勞退自動幫你存", body: "一上工，雇主依法每月提繳至少月薪的 6% 到你的勞退個人專戶，不用申請。", figure: "6%", unit: "雇主每月至少提繳", source: "pension" },
  { title: "全民健保自動納保", body: "上班族的保費由自己、雇主和政府分攤，不綁定任何一家私人保險公司。", figure: "3 方", unit: "分攤保費", source: "healthInsurance" },
  { title: "信用卡利率有上限", body: "信用卡循環利率最高 15%；只繳最低應繳時，沒繳的部分就用這個利率算利息。", figure: "15%", unit: "循環利率上限", source: "revolvingCap" },
];

// 2026-11-17: the 誰在做錢途 section had only placeholders. Set this to true
// once the team's photos and names (and any partner's written agreement) are in.
const SHOW_TEAM = false;

const lineCode = (line: LineMeta) => stationLetterCode(line, 1).replace(/\d+$/, "");
const stationName = (n: number) => getModule(n)?.station ?? "";

/**
 * The public landing (2026-10-24 redesign; 2026-11-13: it opens on doing):
 * the departure board hero whose button starts the first module without an
 * account, one real question to try, the first courses, Taiwan's rules, and
 * the fare gate that leads to sign-up. Every line, station and minute comes
 * from the lines themselves.
 */
export function Landing() {
  const stations = LINES.reduce((a, l) => a + lineStats(l).stations, 0);
  const lines = (slugs: LineSlug[]) => slugs.map((slug) => getLine(slug)!);
  const credit = getLine(START_LINE)!;
  const creditFirst = credit.stationModules[0];
  const creditLesson = lessonForStation(START_LINE, creditFirst);
  // 2026-11-13: the first module plays without an account (lib/tasks/check.ts).
  const firstModule = `/line/${START_LINE}/station/${creditFirst}`;
  const sample = sampleQuestion(START_LINE);

  return (
    <div className={s.page}>
      {/* FL01 起點站 */}
      <section className={s.hero}>
        <div className={s.heroText}>
          <SectionTag code="FL01">
            <span className={s.heroStation}>
              起點站
            </span>
          </SectionTag>
          <h1 className={s.h1}>
            理財，
            <br />
            一站一站學。
          </h1>
          <p className={s.lede}>
            給台灣高中生的免費理財課程。每個單元讀一份真的帳單、契約或薪資單，一題一題做，做完馬上對答案。{LINES.length} 門課、{stations} 個單元，一個單元約 {MIN_MINUTES} 到 {MAX_MINUTES} 分鐘。
          </p>
          <div className={s.heroCta}>
            <Link href={firstModule} className={s.primary}>
              直接做第一個單元
              <Arrow />
            </Link>
            <Link href="/lines" className={s.more}>
              看課程目錄
            </Link>
            <span className={s.heroNote}>
              免費 · 不用註冊就能做
              <br />
              做完再決定要不要存
            </span>
          </div>
        </div>

        <div className={s.stage}>
          <div className={s.stageGlass} aria-hidden="true" />
          <div className={s.sign} style={lineVars(credit)} aria-hidden="true">
            <span className={s.signStripe} />
            <div>
              <div className={s.signKicker}>下一站 · {stationLetterCode(credit, 1)}</div>
              <div className={s.signName}>{stationName(creditFirst)}</div>
            </div>
          </div>
          <div className={s.board} role="table" aria-label="即將進站">
            <div className={s.boardHead}>
              <span>
                即將進站
              </span>
              <span className={s.blink}>● 準備發車</span>
            </div>
            <div className={`${s.boardRow} ${s.boardCols}`} role="row">
              <span role="columnheader">路線</span>
              <span role="columnheader">下一站</span>
              <span role="columnheader">開往</span>
              <span role="columnheader">分鐘</span>
            </div>
            {lines(BOARD).map((line) => {
              const [first, second] = line.stationModules;
              const minutes = lessonForStation(line.slug, first)?.minutes;
              return (
                <div key={line.slug} className={s.boardRow} role="row" style={lineVars(line)}>
                  <span role="cell" className={s.boardLine}>
                    <span className={s.code}>{lineCode(line)}</span>
                    {line.name}
                  </span>
                  <span role="cell" className={s.boardNext}>
                    {stationName(first)}
                  </span>
                  <span role="cell" className={s.boardTo}>
                    {second ? stationName(second) : endStation(line).name}
                  </span>
                  <span role="cell" className={s.boardMin}>
                    {minutes ? String(minutes).padStart(2, "0") : "--"}
                  </span>
                </div>
              );
            })}
          </div>
          {creditLesson ? (
            <div className={s.ticket} aria-hidden="true">
              <div className={s.ticketHead}>
                <span>任務單 · {stationLetterCode(credit, 1)}</span>
                <span>{creditLesson.minutes} 分鐘</span>
              </div>
              <div className={s.ticketRule} />
              <div className={s.ticketBody}>{creditLesson.task.brief.do}</div>
            </div>
          ) : null}
        </div>
      </section>

      {/* FL02 one real question (2026-11-13): what a module asks, before anything else is explained */}
      {sample ? (
        <section className={s.section} aria-labelledby="try-h" style={lineVars(credit)}>
          <SectionTag code="FL02">
            <h2 id="try-h" className={s.h2}>
              先做一題看看
            </h2>
          </SectionTag>
          <p className={s.sub}>這是課程裡真的會出現的一題{sample.material ? "，旁邊是你要讀的文件" : ""}。選完按「對答案」，馬上知道建議答案和原因。</p>
          <SampleQuestion q={sample} signedIn={false} startHref={firstModule} />
        </section>
      ) : null}

      {/* FL03 the first lines */}
      <section className={s.section} aria-labelledby="lines-h">
        <div className={s.sectionHead}>
          <SectionTag code="FL03">
            <h2 id="lines-h" className={s.h2}>
              從核心課程開始
            </h2>
          </SectionTag>
          <Link href="/lines" className={s.more}>
            全部 {LINES.length} 門課程 →
          </Link>
        </div>
        <div className={s.lines}>
          {lines(FEATURED).map((line) => {
            const { stations: total, minutes } = lineStats(line);
            return (
              <Link key={line.slug} href={`/line/${line.slug}`} className={s.lineCard} style={lineVars(line)}>
                <span className={s.lineName}>
                  <span className={s.code}>{lineCode(line)}</span>
                  {line.name}
                </span>
                <span className={s.linePromise}>{line.short}</span>
                <span className={s.track} aria-hidden="true">
                  <span className={s.trackBar} />
                  <span className={s.trackDots}>
                    {Array.from({ length: total }, (_, i) => (
                      <span key={i} data-terminal={i === total - 1 || undefined} />
                    ))}
                  </span>
                </span>
                <span className={s.trackEnds}>
                  <span>{stationName(line.stationModules[0])}</span>
                  <span>{endStation(line).name}</span>
                </span>
                <span className={s.lineMeta}>
                  {total} 個單元 · 約 {minutes} 分鐘
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* FL04 Taiwan's rules */}
      <section className={s.section} aria-labelledby="tw-h">
        <SectionTag code="FL04">
          <h2 id="tw-h" className={s.h2}>
            這裡不是美國
          </h2>
        </SectionTag>
        <p className={s.sub}>網路上多數理財內容講的是美國制度。錢途用台灣的規則和數字：</p>
        <dl className={s.rules}>
          {TAIWAN.map((r) => (
            <div key={r.title} className={s.rule}>
              <span className={s.ruleBar} aria-hidden="true" />
              <dt>{r.title}</dt>
              <dd className={s.ruleBody}>{r.body}</dd>
              <dd className={s.ruleFigure}>
                {r.figure}
                <small>{r.unit}</small>
              </dd>
              <dd className={s.ruleSource}>
                資料：
                <a href={SOURCES[r.source].url} target="_blank" rel="noreferrer">
                  {SOURCES[r.source].title}
                </a>
                {r.source === "securitiesTax" ? (
                  <>
                    ；股票價差停徵所得稅見
                    <a href={SOURCES.capitalGains.url} target="_blank" rel="noreferrer">
                      {SOURCES.capitalGains.title}
                    </a>
                  </>
                ) : null}
                （{SOURCES[r.source].checkedOn} 查證）
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* FL05 who is behind it. Photos, names and partner organisations go
          here once each is supplied and has agreed in writing (11 ABOUT-1);
          nothing is claimed until then. Hidden until there is something real
          to show (SHOW_TEAM above): empty frames read as an unfinished site. */}
      {SHOW_TEAM ? (
      <section className={s.section} aria-labelledby="who-h">
        <SectionTag code="FL05">
          <h2 id="who-h" className={s.h2}>
            誰在做錢途
          </h2>
        </SectionTag>
        <p className={s.sub}>團隊和合作單位的介紹整理中，照片和名字確認後會放在這裡。</p>
        <ul className={s.people}>
          {["團隊成員", "團隊成員", "顧問"].map((role, i) => (
            <li key={i}>
              <span className={s.photo} aria-hidden="true" />
              <b>{role}</b>
              <small>照片與介紹待補</small>
            </li>
          ))}
          <li className={s.partners}>
            <b>合作單位</b>
            <span aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <small>標誌待補，取得同意後放上</small>
          </li>
        </ul>
      </section>
      ) : null}

      {/* The fare gate: the last stop, FL06 with the team section and FL05 without it. */}
      <section className={`${s.section} ${s.last}`} aria-labelledby="go-h">
        <FareGate code={SHOW_TEAM ? "FL06" : "FL05"} />
      </section>
    </div>
  );
}
