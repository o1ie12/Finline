"use client";

import Link from "next/link";
import { useState } from "react";
import { CLASS_COPY } from "@/lib/classRooms";

export interface OpenRoom {
  room_id: string;
  code: string;
  kind: string;
  name: string;
  created_at: string;
}

/**
 * The host's open rooms, shown when a 4th is refused (spec 12 TCH-5): each
 * with a 關閉房間 button. Closing one makes room for a new one.
 */
export function OpenRooms({ rooms, onChange }: { rooms: OpenRoom[]; onChange(rooms: OpenRoom[]): void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function close(id: string) {
    setBusy(id);
    setFailed(false);
    try {
      const res = await fetch("/api/class/close", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ room_id: id }) });
      if (!res.ok) throw new Error(String(res.status));
      onChange(rooms.filter((r) => r.room_id !== id));
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-hairline bg-surface p-4" role="alert">
      <p className="text-[15px] font-semibold">{CLASS_COPY.tooManyRooms}</p>
      <ul className="mt-3 space-y-2">
        {rooms.map((r) => (
          <li key={r.room_id} className="flex items-center justify-between gap-3 rounded-xl border border-hairline px-3 py-2">
            <span className="min-w-0 text-sm">
              <b className="money tracking-[0.1em]">{r.code}</b>
              <span className="ml-2 text-ink-soft">{r.name}</span>
            </span>
            <button
              type="button"
              onClick={() => close(r.room_id)}
              disabled={busy !== null}
              className="inline-flex min-h-11 shrink-0 items-center rounded-lg border border-hairline bg-surface px-3 text-sm font-semibold hover:border-ink disabled:opacity-50"
            >
              {CLASS_COPY.closeRoom}
            </button>
          </li>
        ))}
      </ul>
      {failed ? <p className="mt-2 text-sm text-negative">沒有關閉成功，請再按一次。</p> : null}
    </div>
  );
}

/** Every /class page links back to the guide (spec 12 TCH-5.6). */
export function GuideLink({ className = "" }: { className?: string }) {
  return (
    <Link href="/teachers" className={`inline-flex min-h-11 items-center text-sm font-medium text-ink underline underline-offset-4 ${className}`}>
      {CLASS_COPY.guide}
    </Link>
  );
}
