"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import k from "@/components/course/kit.module.css";
import { LINES } from "@/lib/lines";
import type { LineSlug } from "@/lib/lines";
import type { RoomResults } from "@/lib/classRooms";
import type { ClassRoomStatus } from "@/lib/types";

/** A student on the class screen: a nickname and whether they have handed in. No score. */
interface Joined {
  id: string;
  display_name: string;
  submitted: boolean;
}
import { GuideLink, OpenRooms, type OpenRoom } from "./OpenRooms";

interface RoomState {
  room_id: string;
  code: string;
  host_token: string;
  line_slug: string;
  status: ClassRoomStatus;
}

/**
 * The teacher's quiz room (spec 12 TCH-5): pick a course (preselected from
 * /class/host?line=), get a code, start and end the round, and see each
 * question's percent correct and the room's median. Students are listed in
 * the order they joined with whether they have handed in: no scores and no
 * ranking on this screen, which is usually projected.
 */
export function QuizHost({ initialLine }: { initialLine: LineSlug | null }) {
  const [lineSlug, setLineSlug] = useState<LineSlug>(initialLine ?? LINES[0].slug);
  const [results, setResults] = useState<(RoomResults & { questions: string[] }) | null>(null);
  const [openRooms, setOpenRooms] = useState<OpenRoom[] | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [status, setStatus] = useState<ClassRoomStatus>("waiting");
  const [participants, setParticipants] = useState<Joined[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    if (!room) return;
    async function poll() {
      try {
        const res = await fetch(`/api/class/leaderboard?room_id=${room!.room_id}`);
        const data = await res.json();
        if (Array.isArray(data.participants)) setParticipants(data.participants);
        if (data.results && Array.isArray(data.results.percent)) setResults(data.results);
      } catch {
        /* keep last known state on a transient poll failure */
      }
    }
    void poll();
    pollRef.current = window.setInterval(poll, 3000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [room]);

  async function createRoom() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/class/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ line_slug: lineSlug }),
      });
      const data = await res.json();
      if (res.status === 401) {
        window.location.assign(`/signup?next=${encodeURIComponent("/class/host")}`);
        return;
      }
      if (res.status === 409 && data.error === "too_many_rooms" && Array.isArray(data.rooms)) {
        setOpenRooms(data.rooms);
        return;
      }
      if (!res.ok) {
        setError("建立房間時發生問題，請再試一次。");
        return;
      }
      setOpenRooms(null);
      setRoom(data);
      setStatus(data.status);
    } catch {
      setError("網路連線出了問題，請再試一次。");
    } finally {
      setCreating(false);
    }
  }

  async function setRoomStatus(action: "active" | "finished") {
    if (!room) return;
    try {
      const res = await fetch("/api/class/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_id: room.room_id, host_token: room.host_token, action }),
      });
      if (res.ok) setStatus(action);
    } catch {
      /* keep current status; the button stays available to retry */
    }
  }

  const line = LINES.find((l) => l.slug === lineSlug)!;

  if (!room) {
    return (
      <div className="mx-auto max-w-md px-4 py-14 sm:px-6">
        <p className="text-xs font-semibold text-ink-faint">課堂模式</p>
        <h1 className="mt-1.5 text-3xl font-bold tracking-tight">開一個房間</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">選一門課，題目來自那門課的前後測題庫。</p>

        <fieldset className="mt-6 space-y-2">
          {LINES.map((l) => (
            <label
              key={l.slug}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 bg-surface p-3 transition-colors ${
                lineSlug === l.slug ? "" : "border-hairline hover:border-ink/30"
              }`}
              style={lineSlug === l.slug ? { borderColor: l.color } : undefined}
            >
              <input
                type="radio"
                name="line"
                checked={lineSlug === l.slug}
                onChange={() => setLineSlug(l.slug)}
                className="sr-only"
              />
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: l.color }} aria-hidden="true" />
              <span className="font-semibold">{l.name}</span>
            </label>
          ))}
        </fieldset>

        {error && <p className="mt-4 text-sm text-negative">{error}</p>}
        {openRooms?.length ? <OpenRooms rooms={openRooms} onChange={(left) => setOpenRooms(left.length ? left : null)} /> : null}

        <button
          type="button"
          onClick={createRoom}
          disabled={creating}
          className={`${k.go} mt-6 w-full disabled:opacity-50`}
        >
          {creating ? "建立中…" : "建立房間"}
        </button>
        <div className="mt-6">
          <GuideLink />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="text-xs font-semibold" style={{ color: line.colorInk }}>
        課堂模式 · {line.name}
      </p>

      <div className="mt-3 rounded-2xl bg-ink p-8 text-center text-white">
        <p className="text-sm text-white/70">房間代碼</p>
        <p className="money mt-1 text-6xl font-bold tracking-[0.15em]">{room.code}</p>
        <p className="mt-3 text-sm text-white/70">
          學生到 <span className="font-semibold text-white">/class/play</span> 輸入這組代碼加入
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {status === "waiting" && (
          <button
            type="button"
            onClick={() => setRoomStatus("active")}
            className={k.go}
          >
            開始測驗
          </button>
        )}
        {status === "active" && (
          <button
            type="button"
            onClick={() => setRoomStatus("finished")}
            className={k.ghost}
          >
            結束這場
          </button>
        )}
        <span className="text-sm text-ink-faint">
          {status === "waiting" && "等待中 · 學生可以先加入，按「開始測驗」後大家同時開始作答"}
          {status === "active" && "進行中"}
          {status === "finished" && "已結束"}
        </span>
      </div>

      {/* spec 12 TCH-5: the room's results by question, then who has handed in. */}
      {results && results.submitted > 0 ? (
        <section aria-labelledby="results-heading" className="mt-8">
          <h2 id="results-heading" className="text-lg font-bold">
            全班結果 · {results.submitted} 人交卷
          </h2>
          <p className="mt-1 text-sm text-ink-soft">中位數 {results.median} / {results.questions.length} 題</p>
          <ol className="mt-3 space-y-2">
            {results.questions.map((q, i) => (
              <li key={i} className="rounded-xl border border-hairline bg-surface px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm leading-relaxed">
                    {i + 1}. {q}
                  </span>
                  <span className="money shrink-0 text-sm font-bold">{results.percent[i] === null ? "沒有紀錄" : `答對 ${results.percent[i]}%`}</span>
                </div>
                {results.percent[i] !== null ? (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-hairline" aria-hidden="true">
                    <div className="h-full rounded-full bg-ink" style={{ width: `${results.percent[i]}%` }} />
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section aria-labelledby="students-heading" className="mt-8">
        <h2 id="students-heading" className="text-lg font-bold">
          學生 · {participants.length} 人加入，{participants.filter((p) => p.submitted).length} 人交卷
        </h2>
        <div className="mt-3 space-y-2">
          {participants.length === 0 && (
            <p className="text-sm text-ink-faint">還沒有人加入。</p>
          )}
          {participants.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-hairline bg-surface px-4 py-3">
              <span className="font-semibold">{p.display_name}</span>
              <span className="text-sm text-ink-faint">{p.submitted ? "已交卷" : status === "active" ? "作答中…" : "已加入"}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-1">
        <Link href="/class" className="inline-flex min-h-11 items-center text-sm font-medium text-ink underline underline-offset-4">
          回到課堂模式
        </Link>
        <GuideLink />
      </div>
    </div>
  );
}
