"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ExpertSections, ResultsList, resultUnits } from "@/components/flow/WorkspaceResults";
import { inShownOrder } from "@/components/flow/results";
import type { SubmitResult } from "@/components/tasks/StationFlow";
import { Icon } from "@/components/ui/icons";
import { LEVEL_NAME, MASTERY, type Level } from "@/lib/grades";
import { reportHref, showReport } from "@/lib/reportMistake";
import type { Goal } from "@/lib/tasks/compute";
import type { StationLesson, TaskStep } from "@/lib/tasks/types";
import type { Checked } from "./ModulePlayer";
import p from "./player.module.css";

const FULL = 1 - 1e-9;
const short = (s: string, n = 30) => ([...s].length > n ? `${[...s].slice(0, n).join("")}…` : s);

/**
 * The end of a module (2026-11-13): one card. The score as a ring, what the
 * student got right, what to practise (a confident miss first), the one
 * line to take away, and where to go next. The full comparison and the
 * expert notes are the same ones the one-page workspace drew, one tap away.
 */
export function EndCard({
  lesson,
  head,
  mode,
  result,
  answers,
  checked,
  goal,
  exitHref,
  onContinue,
  continueLabel,
  onRedo,
  onSaveTool,
  readingHref,
  foldExpert,
  hookAnswer,
  guest,
}: {
  lesson: StationLesson;
  head: string;
  mode: "station" | "terminal" | "library";
  result: SubmitResult;
  answers: Record<string, unknown>;
  checked: Record<string, Checked>;
  goal: Goal | null;
  exitHref: string;
  onContinue(): void;
  continueLabel?: string;
  onRedo?(steps: string[], carry: Record<string, unknown>): void;
  onSaveTool?(name: string): Promise<void>;
  readingHref?: string | null;
  foldExpert: boolean;
  hookAnswer: string | null;
  guest: boolean;
}) {
  const task = lesson.task;
  const [full, setFull] = useState(false);
  const [saved, setSaved] = useState(false);
  const keyed = useMemo(() => task.steps.map((st) => inShownOrder(st, result.answerKey.steps.find((k) => k.id === st.id))), [result.answerKey.steps, task.steps]);
  const units = resultUnits(keyed, result);

  const rows = keyed.flatMap((st: TaskStep, i) => {
    const d = result.details[i];
    if (!d?.scored || st.scored === false || d.unresolved) return [];
    return [{ id: st.id, label: short(st.prompt), right: d.credit >= FULL, part: d.credit > 0 && d.credit < FULL, sure: checked[st.id]?.sure ?? null }];
  });
  const good = rows.filter((r) => r.right);
  // A confident miss first: the one most worth another look.
  const again = rows.filter((r) => !r.right).sort((a, b) => Number(b.sure === "sure") - Number(a.sure === "sure"));
  const ratio = result.total ? result.score / result.total : null;
  const level: Level | null = ratio === null ? null : ratio + 1e-9 >= MASTERY ? "mastered" : result.passed ? "passed" : "practicing";
  const missed = again.map((r) => r.id);
  const canRedo = missed.length > 0 && Boolean(onRedo) && mode !== "terminal";
  const title =
    ratio === null
      ? "完成了，你的想法已經記下來。"
      : result.passed
        ? ratio + 1e-9 >= MASTERY
          ? "很穩，這個單元你會了。"
          : "過關了。"
        : result.stationDone
          ? "這個單元完成了，還有幾題可以再練。"
          : "還沒過關。把錯的再做一次，或先往下。";
  const next = mode === "library" ? "完成" : (continueLabel ?? "繼續");

  return (
    <div className={p.page}>
      <header className={p.bar}>
        <Link href={exitHref} className={p.close} aria-label="回到課程">
          <Icon name="close" size={20} />
        </Link>
        <div className={p.barMain}>
          <p className={p.barTitle}>
            <span>{head}</span>
            {task.title}
          </p>
        </div>
      </header>

      <div className={p.end}>
        <section className={p.endCard} aria-labelledby="end-title">
          <div className={p.endTop}>
            <div className={p.ring} style={{ "--ring": ratio === null ? 1 : ratio } as React.CSSProperties} data-level={level ?? "passed"} role="img" aria-label={ratio === null ? "完成" : `答對 ${good.length} 題，共 ${rows.length} 題`}>
              <div>
                {ratio === null ? (
                  <Icon name="check" size={34} strokeWidth={3} />
                ) : (
                  <b>
                    {good.length}
                    <small> / {rows.length}</small>
                  </b>
                )}
                {level ? <span>{LEVEL_NAME[level]}</span> : null}
              </div>
            </div>
            <div className={p.endHead}>
              <p className={p.kicker}>{head} · 完成</p>
              <h1 id="end-title" className={p.endTitle}>
                {title}
              </h1>
              {result.attempt > 1 ? <p className={p.small}>這是第 {result.attempt} 次作答。成績表記最高的一次。</p> : null}
              {guest ? <p className={p.small}>你還沒有帳號，這次的成績先留在這台裝置。註冊後會自動存進去。</p> : null}
            </div>
          </div>

          {good.length || again.length ? (
            <div className={p.endLists}>
              {good.length ? (
                <div>
                  <h2>你做對的</h2>
                  <ul>
                    {good.map((r) => (
                      <li key={r.id} data-right="">
                        <Icon name="check" size={16} strokeWidth={3} />
                        <span>{r.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {again.length ? (
                <div>
                  <h2>還要再練的</h2>
                  <ul>
                    {again.map((r) => (
                      <li key={r.id}>
                        <Icon name="info" size={16} />
                        <span>
                          {r.label}
                          {r.part ? <small>對了一部分。</small> : r.sure === "sure" ? <small>你很有把握，但和建議答案不同：最值得複習。</small> : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {!guest && mode === "station" ? <p className={p.small}>這幾題會放進錯題夾，過幾天再回來考你。</p> : null}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className={p.take}>
            <span className={p.takeStripe} aria-hidden="true" />
            <div>
              <p>帶走這個 · {lesson.takeaway.name}</p>
              <ul>
                {lesson.takeaway.lines.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
              {onSaveTool && !guest ? (
                <button
                  type="button"
                  disabled={saved}
                  onClick={async () => {
                    try {
                      await onSaveTool(lesson.takeaway.name);
                      setSaved(true);
                    } catch {
                      /* stays a button: press again */
                    }
                  }}
                >
                  {saved ? "已存到工具箱" : "存到工具箱"}
                </button>
              ) : null}
            </div>
          </div>

          <div className={p.endActions}>
            <button type="button" className={p.primary} onClick={onContinue} data-wide="">
              {next}
              <Icon name="chevron" size={18} />
            </button>
            {canRedo ? (
              <button type="button" className={p.secondary} onClick={() => onRedo!(missed, Object.fromEntries(Object.entries(answers).filter(([id]) => !missed.includes(id))))}>
                把錯的再做一次（{missed.length} 題）
              </button>
            ) : null}
            <button type="button" className={p.textBtn} aria-expanded={full} onClick={() => setFull((x) => !x)}>
              {full ? "收起完整解析" : "看完整解析和專家怎麼想"}
            </button>
          </div>
        </section>

        {full ? (
          <section className={p.fullReview} aria-label="完整解析">
            <ResultsList steps={keyed} result={result} answers={answers} lesson={lesson} goal={goal} head={head} units={units} prompt={(st) => st.prompt} />
            <ExpertSections
              lesson={lesson}
              reveal={result.reveal}
              afterTip={result.answerKey.afterTip}
              saved={saved}
              onSave={undefined}
              readingHref={readingHref}
              foldExpert={foldExpert}
              hookAnswer={hookAnswer}
            />
            {showReport() ? (
              <a className={p.report} href={reportHref({ where: head, taskId: task.id, stepId: "all" })}>
                內容有錯？回報
              </a>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}
