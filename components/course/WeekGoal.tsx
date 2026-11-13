"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { WEEK_GOALS } from "@/lib/review";
import s from "./learn.module.css";

/**
 * This week (2026-11-13): how many modules the student has worked on since
 * Monday against a goal they set themselves. It replaces a daily streak: a
 * quiet week costs nothing, and the next one starts at zero for everyone.
 */
export function WeekGoal({ done, goal }: { done: number; goal: number }) {
  const router = useRouter();
  const [picked, setPicked] = useState(goal);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const left = Math.max(0, picked - done);

  async function choose(n: number) {
    if (busy || n === picked) return setOpen(false);
    const before = picked;
    setPicked(n);
    setBusy(true);
    try {
      const res = await fetch("/api/week-goal", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ goal: n }) });
      if (!res.ok) throw new Error(String(res.status));
      setOpen(false);
      router.refresh();
    } catch {
      setPicked(before);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={s.week}>
      <div className={s.weekRing} style={{ "--ring": Math.min(1, done / picked) } as React.CSSProperties} role="img" aria-label={`本週做了 ${done} 個單元，目標 ${picked} 個`} data-met={left === 0 || undefined}>
        <b>
          {done}
          <small> / {picked}</small>
        </b>
      </div>
      <div className={s.weekText}>
        <p>{left === 0 ? "這週的目標達成了。" : done === 0 ? "這週還沒開始，做一個單元就好。" : `再 ${left} 個單元，就到這週的目標。`}</p>
        {open ? (
          <div className={s.weekPick} role="group" aria-label="每週想做幾個單元">
            {WEEK_GOALS.map((n) => (
              <button key={n} type="button" aria-pressed={n === picked} disabled={busy} onClick={() => choose(n)}>
                {n} 個
              </button>
            ))}
          </div>
        ) : (
          <button type="button" className={s.weekEdit} onClick={() => setOpen(true)}>
            每週 {picked} 個單元 · 改目標
          </button>
        )}
      </div>
    </div>
  );
}
