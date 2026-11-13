"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { renderMaterial } from "@/components/documents";
import { Icon } from "@/components/ui/icons";
import type { SampleQuestion as Sample, SampleResult } from "@/lib/coursePreview";
import k from "./kit.module.css";
import s from "./sample.module.css";

/**
 * 試做一題 (2026-11-12): one real question from the course, on the course
 * page, before signing up. The document on the left, the question on the
 * right; the answer comes back from POST /api/preview after you choose, the
 * way a station answers. Nothing is stored.
 */
export function SampleQuestion({ q, signedIn, startHref }: { q: Sample; signedIn: boolean; startHref: string }) {
  const uid = useId();
  const [option, setOption] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [result, setResult] = useState<SampleResult | null>(null);
  const reasons = (q.step.reasons?.length ?? 0) >= 2 ? q.step.reasons! : null;
  const ready = Boolean(option && (!reasons || reason));
  const full = result !== null && result.credit >= 1;

  async function check() {
    if (!ready || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch("/api/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug: q.slug, option, reason: reason ?? undefined }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setResult((await res.json()) as SampleResult);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const mark = (id: string, correct: string | null, chosen: string | null) =>
    result ? (id === correct ? "right" : id === chosen ? "wrong" : undefined) : undefined;

  return (
    <div className={s.wrap}>
    <div className={s.sample} data-has-doc={q.material ? "" : undefined}>
      {q.material ? (
        <div className={s.desk} aria-label="這一題要讀的文件">
          <div className={s.paper}>{renderMaterial(q.material, { headingLevel: 4 })}</div>
        </div>
      ) : null}
      <div className={s.ask}>
        <p className={s.from}>
          <b>{q.from.name}</b>
          {q.from.role}
          <small>名稱皆為虛構</small>
        </p>
        <p className={s.message}>{q.message}</p>
        <fieldset className={s.group} disabled={result !== null}>
          <legend className={s.prompt}>{q.step.prompt}</legend>
          {q.step.options.map((o) => (
            <label key={o.id} className={s.opt} data-mark={mark(o.id, result?.correct ?? null, option)}>
              <input type="radio" name={`${uid}-o`} value={o.id} checked={option === o.id} onChange={() => setOption(o.id)} />
              <span>{o.label}</span>
            </label>
          ))}
        </fieldset>
        {reasons ? (
          <fieldset className={s.group} disabled={result !== null}>
            <legend className={s.sub}>為什麼？選一個理由</legend>
            {reasons.map((r) => (
              <label key={r.id} className={s.opt} data-mark={mark(r.id, result?.correctReason ?? null, reason)}>
                <input type="radio" name={`${uid}-r`} value={r.id} checked={reason === r.id} onChange={() => setReason(r.id)} />
                <span>{r.label}</span>
              </label>
            ))}
          </fieldset>
        ) : null}

        {result ? (
          <div className={s.result} data-full={full || undefined} role="status">
            <p className={s.verdict}>
              <Icon name={full ? "check" : "info"} size={18} />
              {full ? "答對了" : result.credit > 0 ? "對了一半" : "和建議答案不同"}
            </p>
            <p className={s.why}>{result.explanation}</p>
            <div className={s.next}>
              <Link href={startHref} className={k.go}>
                {signedIn ? "做完整的單元" : "開始第一個單元，不用註冊"}
              </Link>
              <span>
                這是單元 {q.moduleIndex}「{q.moduleTitle}」裡的一題。
              </span>
            </div>
          </div>
        ) : (
          <div className={s.next}>
            <button type="button" className={k.go} onClick={check} aria-disabled={!ready || busy} data-off={!ready || busy || undefined}>
              {busy ? "對答案中…" : "對答案"}
            </button>
            <span role={failed ? "alert" : undefined}>{failed ? "沒有連上，請再按一次。" : ready ? "不用註冊，也不會留下紀錄。" : reasons ? "選一個答案和一個理由。" : "選一個答案。"}</span>
          </div>
        )}
      </div>
    </div>
    </div>
  );
}
