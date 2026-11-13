"use client";

/**
 * The module player (2026-11-13): one question per screen, checked at once.
 *
 * 想一想 first (no right answer), then each question on its own screen with
 * the document it reads beside it (above it on a phone) and the answer
 * controls where the thumb is. 我有把握 / 我是猜的 both check the answer
 * (POST /api/task/check) and the feedback says what was right before what
 * was not. After the last question the task is submitted once, exactly as
 * the one-page workspace did, and the module ends on one card
 * (EndCard.tsx). Same props as StationWorkspace, so StationRunner can run
 * either (lib/flags.ts PLAYER_V3).
 *
 * Nothing here waits on an animation frame or an animation end: a hidden
 * tab finishes too.
 */
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { renderMaterial } from "@/components/documents";
import type { StationWorkspaceProps } from "@/components/flow/StationWorkspace";
import { StepFeedback } from "@/components/flow/WorkspaceResults";
import { inShownOrder } from "@/components/flow/results";
import { LessonCardView } from "@/components/tasks/LessonCardView";
import type { SubmitResult } from "@/components/tasks/StationFlow";
import {
  draftProblem,
  draftToAnswer,
  emptyDraft,
  showsReasons,
  type ChoiceDraft,
  type Draft,
  type FindDraft,
  type NumberDraft,
  type OrderDraft,
  type RateDraft,
  type SortDraft,
  type WriteDraft,
} from "@/components/tasks/answers";
import { FindStepView } from "@/components/tasks/steps/FindStepView";
import { OrderStepView } from "@/components/tasks/steps/OrderStepView";
import { WriteStepView } from "@/components/tasks/steps/WriteStepView";
import { Icon } from "@/components/ui/icons";
import { RatingRow } from "@/components/ui/Options";
import { reportHref, showReport } from "@/lib/reportMistake";
import type { StepScore } from "@/lib/tasks/scoring";
import type { Confidence, TaskStep } from "@/lib/tasks/types";
import { EndCard } from "./EndCard";
import { TapSort } from "./TapSort";
import p from "./player.module.css";

export interface Checked {
  answer: unknown;
  detail: StepScore;
  /** The step with its answers, in the order this student saw it. */
  key: TaskStep;
  sure: Confidence | null;
}

const FULL = 1 - 1e-9;
const isScored = (step: TaskStep, d: StepScore) => d.scored && step.scored !== false && !d.unresolved;

/** What the feedback says first: what was right, then what was not. */
function verdict(step: TaskStep, c: Checked): { tone: "good" | "part" | "miss" | "note"; title: string; line: string } {
  const d = c.detail;
  if (!isScored(step, d)) return { tone: "note", title: step.type === "write" ? "寫好了" : "沒有標準答案", line: step.type === "write" ? "對照一下參考答案，自己檢查。" : "你的想法已經記下來。" };
  if (d.credit >= FULL) {
    return { tone: "good", title: "答對了", line: c.sure === "guess" ? "猜對了。看一下為什麼，下次就不用猜。" : c.sure === "sure" ? "你有把握，也答對了。" : "" };
  }
  if (d.credit > 0) {
    const items = d.perItem ?? [];
    const right = items.filter((x) => x.credit >= FULL).length;
    if (step.type === "choice" && items.length === 2) {
      const choiceRight = (items.find((x) => x.id === "choice")?.credit ?? 0) >= FULL;
      return { tone: "part", title: "對了一半", line: choiceRight ? "答案選對了，理由再看一下。" : "理由對了，答案再看一下。" };
    }
    return { tone: "part", title: "對了一部分", line: items.length ? `${right} 個對了，${items.length - right} 個再看一下。` : "有些地方對了。" };
  }
  return { tone: "miss", title: "和建議答案不同", line: c.sure === "sure" ? "你很有把握，但這題不是這樣。這種題最值得記住。" : "猜錯沒關係，現在知道了。" };
}

function rateIds(step: TaskStep): string[] {
  return step.type === "rate" ? step.items.map((it) => it.id) : [];
}

/** 06 G9 item 7: a write step that leans on an earlier rating the student never gave. */
function promptFor(step: TaskStep, answers: Record<string, unknown>): string {
  if (step.type !== "write" || !step.ifNoRating) return step.prompt;
  const from = answers[step.ifNoRating.step] as { ratings?: Record<string, number> } | undefined;
  return Object.values(from?.ratings ?? {}).includes(step.ifNoRating.rating) ? step.prompt : step.ifNoRating.prompt;
}

const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);

export function ModulePlayer({
  lesson,
  stationName,
  kicker,
  goal,
  mode = "station",
  exitHref,
  onSubmit,
  onSaveTool,
  onContinue,
  continueLabel,
  initialHookAnswer = null,
  redo = null,
  onRedo,
  studentId,
  attempt,
  readingHref,
  foldExpert = false,
  guest = false,
}: StationWorkspaceProps & {
  /** Played without an account (a course's first module): the end card offers sign-up. */
  guest?: boolean;
}) {
  const task = lesson.task;
  const head = kicker ?? stationName;
  const storeKey = studentId && attempt ? `finline:player:${studentId}:${task.id}:${attempt}` : null;

  // On a redo only the missed steps are asked; the rest are carried.
  const asked = useMemo(() => (redo ? task.steps.filter((s) => redo.steps.includes(s.id)) : task.steps), [redo, task.steps]);

  const [hook, setHook] = useState<string | null>(initialHookAnswer ?? (redo ? "redo" : null));
  const [at, setAt] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [checked, setChecked] = useState<Record<string, Checked>>({});
  const [checking, setChecking] = useState(false);
  const [failed, setFailed] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [hintOpen, setHintOpen] = useState(false);
  const [rateAt, setRateAt] = useState(0);
  const [sending, setSending] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>(redo?.carry ?? {});
  const headRef = useRef<HTMLHeadingElement>(null);

  // What was done survives leaving the page: restored once, saved on change.
  const restored = useRef(false);
  useEffect(() => {
    if (!storeKey || restored.current) return;
    // One tick after mount, so the first paint matches the server's.
    const t = window.setTimeout(() => {
      if (restored.current) return;
      restored.current = true;
      try {
        const raw = window.localStorage.getItem(storeKey);
        if (!raw) return;
        const d = JSON.parse(raw) as { hook?: string | null; at?: number; drafts?: Record<string, Draft>; checked?: Record<string, Checked> };
        if (d.drafts) setDrafts(d.drafts);
        if (d.checked) setChecked(d.checked);
        if (d.hook && !initialHookAnswer) setHook(d.hook);
        if (typeof d.at === "number" && d.at >= 0 && d.at < asked.length) setAt(d.at);
      } catch {
        /* storage blocked or junk: start clean */
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, [storeKey, initialHookAnswer, asked.length]);
  useEffect(() => {
    if (!storeKey || result) return;
    try {
      window.localStorage.setItem(storeKey, JSON.stringify({ hook, at, drafts, checked }));
    } catch {
      /* nothing to restore later; nothing breaks */
    }
  }, [storeKey, hook, at, drafts, checked, result]);

  const step = asked[Math.min(at, asked.length - 1)];
  const done = checked[step.id] ?? null;
  const draft = drafts[step.id] ?? emptyDraft(step);
  const last = at >= asked.length - 1;
  const stage: "hook" | "ask" | "told" | "end" = result ? "end" : !hook ? "hook" : done ? "told" : "ask";

  // A new screen: its heading takes focus.
  useEffect(() => {
    headRef.current?.focus({ preventScroll: true });
  }, [stage, at]);

  // Documents read by more than one step sit beside the question; a find
  // step is its own document, and a rate step shows one file at a time.
  const sideDocs = useMemo(() => {
    const own = new Set<number>();
    task.steps.forEach((st) => {
      if (st.type === "find") own.add(st.materialIndex);
      if (st.type === "rate") st.items.forEach((it) => own.add(it.materialIndex));
    });
    return task.materials.map((m, i) => ({ m, i })).filter(({ i }) => !own.has(i));
  }, [task.materials, task.steps]);

  const setDraft = (next: Draft) => {
    setDrafts((d) => ({ ...d, [step.id]: next }));
    setProblem(null);
  };

  const check = useCallback(
    async (sure: Confidence | null) => {
      if (checking || done) return;
      const why = draftProblem(step, draft, rateIds(step));
      if (why) {
        setProblem(why);
        return;
      }
      const answer = draftToAnswer(step, draft);
      setChecking(true);
      setFailed(false);
      try {
        const res = await fetch("/api/task/check", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ taskSetId: task.id, stepId: step.id, answer }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const out = (await res.json()) as { detail: StepScore; key: TaskStep };
        setChecked((c) => ({ ...c, [step.id]: { answer, detail: out.detail, key: inShownOrder(step, out.key), sure } }));
      } catch {
        setFailed(true);
      } finally {
        setChecking(false);
      }
    },
    [checking, done, draft, step, task.id],
  );

  const finish = useCallback(async () => {
    if (sending) return;
    const all: Record<string, unknown> = { ...(redo?.carry ?? {}) };
    const confidence: Record<string, Confidence> = {};
    for (const st of asked) {
      const c = checked[st.id];
      if (!c) return;
      all[st.id] = c.answer;
      if (c.sure) confidence[st.id] = c.sure;
    }
    setAnswers(all);
    setSending(true);
    setSendFailed(false);
    try {
      const r = await onSubmit({ taskSetId: task.id, answers: all, hookAnswer: hook === "redo" ? null : hook, carried: redo ? Object.keys(redo.carry) : undefined, confidence });
      setResult(r);
      try {
        if (storeKey) window.localStorage.removeItem(storeKey);
      } catch {
        /* fine */
      }
    } catch {
      setSendFailed(true);
    } finally {
      setSending(false);
    }
  }, [asked, checked, hook, onSubmit, redo, sending, storeKey, task.id]);

  const next = useCallback(() => {
    if (last) {
      void finish();
      return;
    }
    // A new question: its own hint, message and file start over.
    setAt((i) => i + 1);
    setProblem(null);
    setHintOpen(false);
    setRateAt(0);
    setFailed(false);
  }, [finish, last]);

  // Keys on a desktop: 1 to 9 pick an option, Enter checks or goes on.
  // A reflection or a written answer has no right answer: one button, no confidence.
  const reflective = step.scored === false;
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
      const n = /^[1-9]$/.test(e.key) ? Number(e.key) - 1 : -1;
      if (stage === "hook" && n >= 0 && lesson.hook.options[n]) {
        e.preventDefault();
        setHook(lesson.hook.options[n].id);
      } else if (stage === "ask" && n >= 0 && step.type === "choice" && step.options[n]) {
        e.preventDefault();
        setDrafts((d) => ({ ...d, [step.id]: { ...((d[step.id] as ChoiceDraft) ?? {}), option: step.options[n].id } }));
        setProblem(null);
      } else if (e.key === "Enter" && stage === "ask" && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        void check(reflective ? null : "sure");
      } else if (e.key === "Enter" && stage === "told" && !(e.target instanceof HTMLButtonElement) && !(e.target instanceof HTMLAnchorElement)) {
        e.preventDefault();
        next();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [check, lesson.hook.options, next, reflective, stage, step]);

  if (result) {
    return (
      <EndCard
        lesson={lesson}
        head={head}
        mode={mode}
        result={result}
        answers={answers}
        checked={checked}
        goal={goal}
        exitHref={exitHref}
        onContinue={onContinue}
        continueLabel={continueLabel}
        onRedo={onRedo}
        onSaveTool={onSaveTool}
        readingHref={readingHref}
        foldExpert={foldExpert}
        hookAnswer={hook && hook !== "redo" ? hook : null}
        guest={guest}
      />
    );
  }

  const covering = lesson.lessonCards.find((c) => c.covers?.includes(step.id)) ?? lesson.lessonCards[0];
  const rateItem = step.type === "rate" ? step.items[Math.min(rateAt, step.items.length - 1)] : null;
  const rateDoc = rateItem ? task.materials[rateItem.materialIndex] : undefined;
  // What lies on the desk for this screen.
  const desk: "brief" | "find" | "rate" | "docs" | "none" =
    stage === "hook" ? "brief" : stage === "told" ? (step.type === "find" || step.type === "rate" || !sideDocs.length ? "none" : "docs") : step.type === "find" ? "find" : step.type === "rate" ? "rate" : sideDocs.length ? "docs" : "none";
  const v = done ? verdict(step, done) : null;
  const shownAnswers = Object.fromEntries(Object.entries(checked).map(([id, c]) => [id, c.answer]));

  return (
    <div className={p.page}>
      <header className={p.bar}>
        <Link href={exitHref} className={p.close} aria-label="離開，做過的會保留">
          <Icon name="close" size={20} />
        </Link>
        <div className={p.barMain}>
          <p className={p.barTitle}>
            <span>{head}</span>
            {task.title}
          </p>
          <ol className={p.segs} aria-label={`共 ${asked.length} 題`}>
            {asked.map((st, i) => {
              const c = checked[st.id];
              const state = c ? (!isScored(st, c.detail) ? "note" : c.detail.credit >= FULL ? "good" : "miss") : hook && i === at ? "on" : "todo";
              return (
                <li key={st.id} data-state={state} aria-current={hook && i === at ? "step" : undefined}>
                  <span className="sr-only">
                    第 {i + 1} 題{state === "good" ? "，答對" : state === "miss" ? "，要再看" : state === "note" ? "，完成" : ""}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
        <span className={p.count} aria-hidden="true">
          {stage === "hook" ? `${asked.length} 題` : `${at + 1} / ${asked.length}`}
        </span>
      </header>

      <div className={p.stage} data-desk={desk}>
        {desk !== "none" ? (
          <section className={p.desk} aria-label={desk === "brief" ? "這個單元" : "文件"}>
            {desk === "brief" ? (
              <div className={p.brief}>
                <div className={p.from}>
                  <span className={p.avatar} aria-hidden="true">
                    {[...task.brief.from.name][0]}
                  </span>
                  <p>
                    <b>{task.brief.from.name}</b>
                    {task.brief.from.org} · {task.brief.from.role}
                    <small>名稱皆為虛構</small>
                  </p>
                </div>
                <p className={p.message}>{task.brief.message}</p>
                <dl className={p.facts}>
                  <div>
                    <dt>你會學到</dt>
                    <dd>{task.brief.learn}</dd>
                  </div>
                  <div>
                    <dt>你要做的</dt>
                    <dd>{task.brief.do}</dd>
                  </div>
                  <div>
                    <dt>時間</dt>
                    <dd>
                      約 {lesson.minutes} 分鐘 · {asked.length} 題
                    </dd>
                  </div>
                </dl>
              </div>
            ) : null}
            {desk === "find" && step.type === "find" ? (
              <div className={p.paper}>
                <FindStepView step={step} material={task.materials[step.materialIndex]} value={draft as FindDraft} onChange={setDraft} onConfirm={() => {}} onExpand={() => {}} disabled={checking} promptId={`ph-${step.id}`} />
              </div>
            ) : null}
            {desk === "rate" && rateDoc ? <div className={p.paper}>{renderMaterial(rateDoc, { headingLevel: 3 })}</div> : null}
            {desk === "docs"
              ? sideDocs.map(({ m, i }) => (
                  <div key={i} className={p.paper}>
                    {renderMaterial(m, { headingLevel: 3 })}
                  </div>
                ))
              : null}
          </section>
        ) : null}

        <section className={p.panel} aria-live={stage === "told" ? "polite" : undefined}>
          {stage === "hook" ? (
            <>
              <p className={p.kicker}>想一想 · 沒有標準答案</p>
              <h1 ref={headRef} tabIndex={-1} className={p.prompt}>
                {lesson.hook.question}
              </h1>
              <div className={p.choices} role="group" aria-label="你的直覺">
                {lesson.hook.options.map((o, i) => (
                  <button key={o.id} type="button" className={p.choice} onClick={() => setHook(o.id)}>
                    <kbd aria-hidden="true">{i + 1}</kbd>
                    {o.label}
                  </button>
                ))}
              </div>
              <p className={p.small}>選一個就開始。答案沒有對錯，最後會回來看你一開始怎麼想。</p>
            </>
          ) : null}

          {stage === "ask" ? (
            <>
              <div className={p.qTop}>
                <p className={p.kicker}>
                  第 {at + 1} 題{step.scored === false ? " · 沒有標準答案" : ""}
                </p>
                {covering ? (
                  <button type="button" className={p.hintBtn} aria-expanded={hintOpen} onClick={() => setHintOpen((x) => !x)}>
                    <Icon name="info" size={16} />
                    {hintOpen ? "收起提示" : "看提示"}
                  </button>
                ) : null}
              </div>
              <h1 ref={headRef} tabIndex={-1} id={`ph-${step.id}`} className={p.prompt}>
                {promptFor(step, shownAnswers)}
              </h1>
              {hintOpen && covering ? (
                <div className={p.hint}>
                  <LessonCardView card={covering} />
                  <p className={p.small}>看提示不影響分數。</p>
                </div>
              ) : null}

              {step.type === "choice" ? (
                <>
                  <div className={p.choices} role="radiogroup" aria-labelledby={`ph-${step.id}`}>
                    {step.options.map((o, i) => (
                      <button key={o.id} type="button" role="radio" aria-checked={(draft as ChoiceDraft).option === o.id} className={p.choice} disabled={checking} onClick={() => setDraft({ ...(draft as ChoiceDraft), option: o.id })}>
                        <kbd aria-hidden="true">{i + 1}</kbd>
                        {o.label}
                      </button>
                    ))}
                  </div>
                  {showsReasons(step) && step.reasons && (draft as ChoiceDraft).option ? (
                    <>
                      <p className={p.sub} id={`pr-${step.id}`}>
                        為什麼？選一個理由
                      </p>
                      <div className={p.choices} role="radiogroup" aria-labelledby={`pr-${step.id}`}>
                        {step.reasons.map((r) => (
                          <button key={r.id} type="button" role="radio" aria-checked={(draft as ChoiceDraft).reason === r.id} className={p.choice} data-reason="" disabled={checking} onClick={() => setDraft({ ...(draft as ChoiceDraft), reason: r.id })}>
                            {r.label}
                          </button>
                        ))}
                      </div>
                    </>
                  ) : null}
                </>
              ) : null}

              {step.type === "number" ? (
                <label className={p.number}>
                  <span className="sr-only">{step.prompt}</span>
                  {step.unit === "NT$" ? <span>NT$</span> : null}
                  <input
                    inputMode="decimal"
                    enterKeyHint="done"
                    autoComplete="off"
                    value={(draft as NumberDraft).raw}
                    disabled={checking}
                    onChange={(e) => setDraft({ raw: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void check("sure");
                      }
                    }}
                  />
                  {step.unit && step.unit !== "NT$" ? <span>{step.unit}</span> : null}
                </label>
              ) : null}

              {step.type === "find" ? (
                <p className={p.lead}>
                  在上面的文件點出來。已選 {(draft as FindDraft).selected.length} / {step.targetCount ?? step.targets.length}，多點的會扣回。
                </p>
              ) : null}

              {step.type === "rate" && rateItem ? (
                <div className={p.rate}>
                  <p className={p.sub}>
                    第 {rateAt + 1} 位，共 {step.items.length} 位 · {rateItem.label}
                  </p>
                  <RatingRow
                    value={((draft as RateDraft).ratings[rateItem.id] as 1 | 2 | 3 | undefined) ?? null}
                    onChange={(r) => {
                      const ratings = { ...(draft as RateDraft).ratings, [rateItem.id]: r };
                      setDraft({ ratings });
                      // On to the next file that has no rating yet.
                      const nextOpen = step.items.findIndex((it, i) => i > rateAt && !ratings[it.id]);
                      if (nextOpen >= 0) setRateAt(nextOpen);
                    }}
                  />
                  <div className={p.pager}>
                    <button type="button" disabled={rateAt === 0} onClick={() => setRateAt((i) => i - 1)}>
                      上一位
                    </button>
                    <span>
                      已給分 {Object.keys((draft as RateDraft).ratings).length} / {step.items.length}
                    </span>
                    <button type="button" disabled={rateAt >= step.items.length - 1} onClick={() => setRateAt((i) => i + 1)}>
                      下一位
                    </button>
                  </div>
                </div>
              ) : null}

              {step.type === "sort" ? <TapSort step={step} value={draft as SortDraft} onChange={setDraft} disabled={checking} /> : null}
              {step.type === "order" ? <OrderStepView step={step} value={draft as OrderDraft} onChange={setDraft} onConfirm={() => {}} disabled={checking} promptId={`ph-${step.id}`} /> : null}
              {step.type === "write" ? <WriteStepView step={step} value={draft as WriteDraft} onChange={setDraft} onConfirm={() => {}} disabled={checking} promptId={`ph-${step.id}`} /> : null}

              {problem ? (
                <p className={p.problem} role="alert">
                  {problem}
                </p>
              ) : null}
              {failed ? (
                <p className={p.problem} role="alert">
                  沒有連上，答案還在。再按一次。
                </p>
              ) : null}

              <div className={p.actions}>
                {reflective ? (
                  <button type="button" className={p.primary} onClick={() => void check(null)} aria-busy={checking || undefined}>
                    {checking ? "記下來…" : step.type === "write" ? "寫好了" : "記下來"}
                  </button>
                ) : (
                  <>
                    <button type="button" className={p.secondary} onClick={() => void check("guess")} disabled={checking}>
                      我是猜的
                    </button>
                    <button type="button" className={p.primary} onClick={() => void check("sure")} aria-busy={checking || undefined}>
                      {checking ? "對答案中…" : "我有把握"}
                    </button>
                  </>
                )}
              </div>
              {!reflective ? <p className={p.small}>兩個都會馬上對答案。說實話，之後複習才知道要先看哪一題。</p> : null}
            </>
          ) : null}

          {stage === "told" && done && v ? (
            <>
              <div className={p.verdict} data-tone={v.tone}>
                <span className={p.mark} aria-hidden="true">
                  <Icon name={v.tone === "good" ? "check" : "info"} size={18} strokeWidth={v.tone === "good" ? 3 : 2.2} />
                </span>
                <div>
                  <h1 ref={headRef} tabIndex={-1} className={p.verdictTitle}>
                    {v.title}
                  </h1>
                  {v.line ? <p>{v.line}</p> : null}
                </div>
              </div>
              {/* a find or an order answer carries its own heading */}
              {step.type === "find" || step.type === "order" ? null : (
                <p className={p.asked}>
                  第 {at + 1} 題：{promptFor(step, shownAnswers)}
                </p>
              )}
              <div className={p.feedback}>
                <StepFeedback step={done.key} index={task.steps.findIndex((s) => s.id === step.id)} detail={done.detail} answer={done.answer} lesson={lesson} goal={goal} />
              </div>
              {sendFailed ? (
                <p className={p.problem} role="alert">
                  送出失敗，答案還在。再按一次。
                </p>
              ) : null}
              <div className={p.actions}>
                <button type="button" className={p.primary} onClick={next} aria-busy={sending || undefined} data-wide="">
                  {sending ? "算成績中…" : last ? "看結果" : "下一題"}
                  {sending ? null : <Icon name="chevron" size={18} />}
                </button>
              </div>
              {showReport() ? (
                <a className={p.report} href={reportHref({ where: head, taskId: task.id, stepId: step.id })}>
                  這題有錯？回報
                </a>
              ) : null}
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}
