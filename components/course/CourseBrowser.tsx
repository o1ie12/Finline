"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/ui/icons";
import { MOMENTS, TRACKS } from "@/content/curriculum";
import { durationText } from "@/lib/curriculum";
import type { ProgramCourse } from "@/lib/programView";
import s from "./catalogue.module.css";
import { CourseTile, stateText } from "./CourseTile";
import k from "./kit.module.css";

/**
 * The catalogue's courses (2026-11-12). 全部 shows the program as it is
 * built: the core courses as a path in order, the electives as tiles, the
 * capstone on its own. A life moment shows only the courses that help with
 * it. Each layout says something true: only the core courses are a
 * sequence, so only they sit on a line.
 */
export function CourseBrowser({ courses, signedIn }: { courses: ProgramCourse[]; signedIn: boolean }) {
  const [moment, setMoment] = useState<string | null>(null);
  const chosen = MOMENTS.find((m) => m.id === moment) ?? null;
  const core = courses.filter((c) => c.track === "core");
  const electives = courses.filter((c) => c.track === "elective");
  const capstone = courses.filter((c) => c.track === "capstone");

  return (
    <div className={s.browser}>
      <div className={s.filter} role="group" aria-label="依情境挑課程">
        <span className={s.filterLabel}>你現在遇到的是</span>
        <button type="button" aria-pressed={moment === null} onClick={() => setMoment(null)}>
          全部課程
        </button>
        {MOMENTS.map((m) => (
          <button key={m.id} type="button" aria-pressed={moment === m.id} onClick={() => setMoment(m.id)}>
            {m.name}
          </button>
        ))}
      </div>

      {chosen ? (
        <section className={s.track} aria-live="polite">
          <div className={s.trackHead}>
            <h2 className={s.h2}>{chosen.name}</h2>
            <p>{chosen.courses.length} 門課和這件事有關，照這個順序上最順。</p>
          </div>
          <ol className={s.path}>
            {chosen.courses.map((slug, i) => {
              const c = courses.find((x) => x.slug === slug);
              return c ? <PathRow key={slug} c={c} n={i + 1} /> : null;
            })}
          </ol>
        </section>
      ) : (
        <>
          <section id="core" className={s.track} aria-labelledby="core-h">
            <div className={s.trackHead}>
              <h2 id="core-h" className={s.h2}>
                {TRACKS.core.name}
                <span>{core.length} 門</span>
              </h2>
              <p>{TRACKS.core.blurb}</p>
            </div>
            <ol className={s.path}>
              {core.map((c) => (
                <PathRow key={c.slug} c={c} n={c.order} />
              ))}
            </ol>
          </section>

          <section id="elective" className={s.track} aria-labelledby="elective-h">
            <div className={s.trackHead}>
              <h2 id="elective-h" className={s.h2}>
                {TRACKS.elective.name}
                <span>{electives.length} 門</span>
              </h2>
              <p>{TRACKS.elective.blurb}</p>
            </div>
            <ul className={s.tiles}>
              {electives.map((c) => (
                <li key={c.slug} style={c.vars}>
                  <CourseTile c={c} signedIn={signedIn} />
                </li>
              ))}
            </ul>
          </section>

          <section id="capstone" className={s.track} aria-labelledby="capstone-h">
            <div className={s.trackHead}>
              <h2 id="capstone-h" className={s.h2}>
                {TRACKS.capstone.name}
              </h2>
              <p>{TRACKS.capstone.blurb}</p>
            </div>
            <ol className={s.path}>
              {capstone.map((c) => (
                <PathRow key={c.slug} c={c} n={c.order} />
              ))}
            </ol>
          </section>
        </>
      )}
    </div>
  );
}

/** A course as a stop on a path: the order is real, so it is drawn. */
function PathRow({ c, n }: { c: ProgramCourse; n: number }) {
  return (
    <li className={s.stop} style={c.vars} data-state={c.state}>
      <span className={s.stopNo} aria-hidden="true">
        {c.state === "done" ? <Icon name="check" size={14} strokeWidth={3} /> : n}
      </span>
      <Link href={`/line/${c.slug}`} className={s.stopRow}>
        <span className={s.stopMain}>
          <span className={s.stopKicker}>
            <span className={k.plate}>{c.code}</span>
            {c.areaName}
            {c.prerequisites.length ? <small>建議先修：{c.prerequisites.join("、")}</small> : null}
          </span>
          <span className={s.stopName}>{c.name}</span>
          <span className={s.stopPromise}>{c.promise}</span>
        </span>
        <span className={s.stopFacts}>
          <span>{c.difficulty}</span>
          <span>{c.modules} 個單元</span>
          <span>{durationText(c.minutes)}</span>
        </span>
        <span className={s.stopState} data-state={c.state}>
          {stateText(c)}
          <Icon name="chevron" size={16} />
        </span>
      </Link>
    </li>
  );
}
