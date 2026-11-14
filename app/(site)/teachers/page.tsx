import type { Metadata } from "next";
import Link from "next/link";
import { COURSES, TRACKS, type TrackId } from "@/content/curriculum";
import { courseOutline } from "@/lib/curriculum";
import { lineVars } from "@/lib/design/lineVars";
import { coursePeriods } from "@/lib/lessonPlan";
import { pageMeta } from "@/lib/pageMeta";
import { CONTACT_EMAIL, CONTACT_UNAVAILABLE_TEXT } from "@/lib/site";
import k from "@/components/course/kit.module.css";
import s from "./teachers.module.css";

export const metadata: Metadata = pageMeta({
  title: "給老師",
  description: "在課堂上用錢途：每門課約 1 到 2 節課，附教案、學習單和課堂模式。免費。",
  path: "/teachers",
});

const TRACK_ORDER: TrackId[] = ["core", "elective", "capstone"];
// The letter a teacher sends: what we need to know to help, nothing collected on the site.
const MAIL_QUERY = "?subject=錢途課堂使用&body=學校：%0A年級和班級人數：%0A想用的課程：%0A預計日期：";

/**
 * 給老師 (spec 12 TCH-1): the one place a teacher starts. How a period runs,
 * a lesson plan for every course, class mode, what we keep about students,
 * and how to write to us. Public, and every number comes from the courses.
 */
export default function TeachersPage() {
  const rows = COURSES.map((c) => {
    const o = courseOutline(c.slug);
    return { o, periods: coursePeriods(o) };
  });

  return (
    <div className={s.page}>
      <div className={s.head}>
        <h1 className={s.h1}>在課堂上用錢途</h1>
        <p className={s.lead}>錢途免費，學生只要一個暱稱就能開始，不用 email。每門課約 1 到 2 節課，用手機或電腦都能上。老師不需要金融背景，任務和解析會帶內容。</p>
      </div>

      <section className={s.section} aria-labelledby="how-h">
        <h2 id="how-h" className={s.h2}>
          一節課怎麼上
        </h2>
        <ol className={s.steps}>
          <li>暖身 5 分鐘：用這門課第一個單元的「想一想」問全班，先不講答案。</li>
          <li>做任務：學生一人或兩人一組，在自己的裝置上做單元。</li>
          <li>討論和收尾 10 分鐘：用教案裡的討論題，請學生說說一開始怎麼想、後來為什麼改，最後每個人寫下一件帶走的事。</li>
        </ol>
      </section>

      <section className={s.section} aria-labelledby="plans-h">
        <h2 id="plans-h" className={s.h2}>
          各課教案
        </h2>
        <div className={s.tableCard}>
          <table className={s.table}>
            <thead>
              <tr>
                <th scope="col">代碼</th>
                <th scope="col">課程</th>
                <th scope="col">單元</th>
                <th scope="col">時間</th>
                <th scope="col">節數</th>
                <th scope="col">教案</th>
              </tr>
            </thead>
            {TRACK_ORDER.map((t) => (
              <tbody key={t}>
                <tr className={s.group}>
                  <th colSpan={6} scope="rowgroup">
                    {TRACKS[t].name}
                  </th>
                </tr>
                {rows
                  .filter((r) => r.o.info.track === t)
                  .map(({ o, periods }) => (
                    <tr key={o.line.slug} style={lineVars(o.line)}>
                      <td data-label="代碼">
                        <span className={k.plate}>{o.info.code}</span>
                      </td>
                      <th scope="row" data-label="課程">
                        <Link href={`/line/${o.line.slug}`}>{o.line.name}</Link>
                      </th>
                      <td data-label="單元">{o.totals.modules} 個</td>
                      <td data-label="時間">{o.totals.minutes} 分鐘</td>
                      <td data-label="節數">{periods} 節</td>
                      <td data-label="教案">
                        <Link href={`/teachers/${o.line.slug}`} className={s.planLink} aria-label={`看教案：${o.line.name}`}>
                          看教案
                        </Link>
                      </td>
                    </tr>
                  ))}
              </tbody>
            ))}
          </table>
        </div>
      </section>

      <section className={s.section} aria-labelledby="class-h">
        <h2 id="class-h" className={s.h2}>
          課堂模式
        </h2>
        <p className={s.text}>想讓全班一起作答？開一個房間，學生輸入代碼就能加入。題目來自每門課的前後測題庫。</p>
        <div className={s.cards}>
          <Link href="/class/host" className={s.cardDark}>
            開一個房間
          </Link>
          <Link href="/class/play" className={s.cardLight}>
            學生加入
          </Link>
          <Link href="/class/life/host" className={s.cardLight}>
            人生賽局
          </Link>
        </div>
        <p className={s.note}>開房間要先登入。房間在最後一次使用後 12 小時自動關閉。</p>
      </section>

      <section className={s.section} aria-labelledby="data-h">
        <h2 id="data-h" className={s.h2}>
          學生的資料
        </h2>
        <p className={s.text}>學生只需要暱稱，學校和年級選填。我們不收真實姓名、電話、email 或任何金融帳號。課堂模式的排名看財務健康分，不比誰最有錢。</p>
        <p className={s.text}>
          <Link href="/privacy" className={s.link}>
            看隱私權政策
          </Link>
        </p>
      </section>

      <section className={s.section} aria-labelledby="mail-h">
        <h2 id="mail-h" className={s.h2}>
          聯絡我們
        </h2>
        <p className={s.text}>想在班上試用、需要協助，或發現內容有錯，寫信給我們。</p>
        {/* The repo's rule (lib/site.ts): never a mailto that goes nowhere. */}
        {CONTACT_EMAIL ? (
          <a href={`mailto:${CONTACT_EMAIL}${MAIL_QUERY}`} className={k.go}>
            寫信給錢途
          </a>
        ) : (
          <p className={s.note}>{CONTACT_UNAVAILABLE_TEXT}</p>
        )}
      </section>
    </div>
  );
}
