import Link from "next/link";
import { Icon } from "@/components/ui/icons";
import { TRACKS, type TrackId } from "@/content/curriculum";
import { durationText } from "@/lib/curriculum";
import type { ProgramCourse } from "@/lib/programView";
import c from "./catalogue.module.css";
import { GuestSync } from "@/components/player/GuestSync";
import { CourseTile } from "./CourseTile";
import k from "./kit.module.css";
import s from "./learn.module.css";

const TRACK_ORDER: TrackId[] = ["core", "elective", "capstone"];

/**
 * 學習 (2026-11-12): the signed-in home, a dashboard. The course you are in
 * with the sign for your next module; the program's progress and all twelve
 * courses as marks that fill in; then what is in progress, what to take next
 * and what is done.
 */
export function LearnHome({ name, courses }: { name: string; courses: ProgramCourse[] }) {
  const started = courses.filter((x) => x.state === "started");
  const finished = courses.filter((x) => x.state === "done");
  const fresh = courses.filter((x) => x.state === "new");
  // Continue the course in progress; else start the next one in program order.
  const now = started.find((x) => x.nextHref) ?? fresh[0] ?? null;
  const others = started.filter((x) => x !== now);
  const upNext = fresh.filter((x) => x !== now).slice(0, 3);
  const going = now?.state === "started" && now.next;

  return (
    <div className={s.page}>
      <GuestSync />
      <div className={s.inner}>
        <header className={s.hello}>
          <h1>你好，{name}</h1>
          <p>{now ? (now.state === "started" ? "從上次停下來的地方接著上。" : "挑一門課，開始第一個單元。") : "你已經完成所有課程。"}</p>
        </header>

        <div className={s.top}>
          {now ? (
            <section className={`${k.card} ${s.cont}`} style={now.vars} aria-labelledby="cont-h">
              <div className={s.contMain}>
                <p className={s.kicker}>
                  <span className={k.plate}>{now.code}</span>
                  {now.state === "started" ? "繼續學習" : "下一門課"} · {TRACKS[now.track].name}
                </p>
                <h2 id="cont-h" className={s.contTitle}>
                  {now.name}
                </h2>
                <p className={s.contText}>{now.promise}</p>
                <div className={s.contActions}>
                  <Link href={going && now.nextHref ? now.nextHref : `/line/${now.slug}`} className={k.go}>
                    {going ? "繼續上課" : "看這門課"}
                  </Link>
                  {going ? (
                    <Link href={`/line/${now.slug}`} className={k.ghost}>
                      課程大綱
                    </Link>
                  ) : null}
                </div>
              </div>
              <div className={s.contArt}>
                <div className={k.sign}>
                  <span className={k.signStripe} aria-hidden="true" />
                  <div className={k.signBody}>
                    <div className={k.signKicker}>{going ? `下一個單元 · ${now.next!.index} / ${now.modules}` : `${now.modules} 個單元 · ${durationText(now.minutes)}`}</div>
                    <div className={k.signName}>{going ? now.next!.title : "從單元 1 開始"}</div>
                    {going ? <div className={k.signSub}>約 {now.next!.minutes} 分鐘</div> : null}
                  </div>
                </div>
                <div className={s.contDots}>
                  <span className={k.dots} role="img" aria-label={`完成 ${now.done} / ${now.modules} 個單元`}>
                    {Array.from({ length: now.modules }, (_, i) => (
                      <span key={i} data-done={i < now.done || undefined} />
                    ))}
                  </span>
                  <b>
                    {now.done} / {now.modules} 個單元
                  </b>
                </div>
              </div>
            </section>
          ) : null}

          {/* The program: how far along, and every course as a mark that fills in. */}
          <section className={`${k.card} ${s.program}`} aria-labelledby="prog-h">
            <h2 id="prog-h" className={s.cardTitle}>
              學程進度
            </h2>
            <p className={s.big}>
              {finished.length}
              <small> / {courses.length} 門課</small>
            </p>
            <dl className={s.tracks}>
              {TRACK_ORDER.map((t) => {
                const all = courses.filter((x) => x.track === t);
                return (
                  <div key={t}>
                    <dt>{TRACKS[t].name}</dt>
                    <dd>
                      {all.map((x) => (
                        <Link key={x.slug} href={`/line/${x.slug}`} style={x.vars} data-state={x.state} title={x.name} aria-label={`${x.name}：${x.state === "done" ? "已完成" : x.state === "started" ? "進行中" : "還沒開始"}`} />
                      ))}
                    </dd>
                  </div>
                );
              })}
            </dl>
            <Link href="/grades" className={s.cardLink}>
              看成績
              <Icon name="chevron" size={16} />
            </Link>
          </section>
        </div>

        {others.length ? <Tiles title="進行中的課程" courses={others} /> : null}
        {upNext.length ? <Tiles title="建議接著上" note="照學程的順序" courses={upNext} /> : null}
        {finished.length ? <Tiles title="已完成的課程" courses={finished} /> : null}

        <p className={s.more}>
          <Link href="/map">看完整的課程目錄</Link>
        </p>
      </div>
    </div>
  );
}

function Tiles({ title, note, courses }: { title: string; note?: string; courses: ProgramCourse[] }) {
  return (
    <section className={s.group}>
      <h2 className={s.h2}>
        {title}
        {note ? <small>{note}</small> : null}
      </h2>
      <ul className={c.tiles}>
        {courses.map((x) => (
          <li key={x.slug} style={x.vars}>
            <CourseTile c={x} signedIn />
          </li>
        ))}
      </ul>
    </section>
  );
}
