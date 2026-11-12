import Link from "next/link";
import { Icon } from "@/components/ui/icons";
import { durationText } from "@/lib/curriculum";
import type { ProgramCourse } from "@/lib/programView";
import s from "./catalogue.module.css";
import k from "./kit.module.css";

/** Where a student stands in a course, in a few words. */
export function stateText(c: ProgramCourse): string {
  return c.state === "done" ? "已完成" : c.state === "started" ? `進行中 · ${c.done} / ${c.modules}` : "看課程";
}

/**
 * A course as a tile (2026-11-12): the line's tint on top with the code
 * plate, the name and one dot per module; what it teaches, how long it is
 * and where the student stands below. The wrapper sets --line (c.vars).
 */
export function CourseTile({ c, signedIn }: { c: ProgramCourse; signedIn: boolean }) {
  return (
    <Link href={`/line/${c.slug}`} className={`${k.tile} ${s.tile}`}>
      <span className={s.tileTop}>
        <span className={s.tileKicker}>
          <span className={k.plate}>{c.code}</span>
          {c.areaName}
        </span>
        <span className={s.tileName}>{c.name}</span>
        <span className={`${k.dots} ${s.tileDots}`} role="img" aria-label={signedIn ? `完成 ${c.done} / ${c.modules} 個單元` : `${c.modules} 個單元`}>
          {Array.from({ length: c.modules }, (_, i) => (
            <span key={i} data-done={i < c.done || undefined} />
          ))}
        </span>
      </span>
      <span className={s.tileBody}>
        <span className={s.tilePromise}>{c.promise}</span>
        <span className={s.tileMeta}>
          <span>{c.difficulty}</span>
          <span>{c.modules} 個單元</span>
          <span>{durationText(c.minutes)}</span>
        </span>
        <span className={s.tileState} data-state={c.state}>
          {c.state === "done" ? <Icon name="check" size={16} strokeWidth={2.6} /> : null}
          {stateText(c)}
          <Icon name="chevron" size={16} />
        </span>
      </span>
    </Link>
  );
}
