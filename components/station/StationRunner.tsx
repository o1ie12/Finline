"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { StationFlow, type FlowLine, type SubmitPayload, type SubmitResult } from "@/components/tasks/StationFlow";
import { StationFlowE } from "@/components/flow/StationFlow";
import { StationWorkspace } from "@/components/flow/StationWorkspace";
import { ModulePlayer } from "@/components/player/ModulePlayer";
import { GUEST_PENDING } from "@/components/player/GuestSync";
import { PLAYER_V3 } from "@/lib/flags";
import type { StationLesson } from "@/lib/tasks/types";
import type { StepScore } from "@/lib/tasks/scoring";
import type { AnswerKey } from "@/lib/tasks/publicLesson";

/**
 * Runs one task set on a page: submits to the right endpoint, re-mounts the
 * flow for a second attempt, saves takeaways, and on 「回到你的人生」 goes to
 * /play for one month, which then rides the train to the next station.
 *
 * `mode`: "station" and "library" post to /api/task; "terminal" posts to
 * /api/simulation (the line's simulation result).
 */
export function StationRunner({
  lesson,
  line,
  station,
  studentId,
  attempt,
  goal,
  mode,
  continueHref,
  continueLabel,
  fullLessonHref,
  fullLessonLabel,
  initialHook = null,
  guest = false,
  initialRedo = null,
  unitTourSeen,
  design,
}: {
  lesson: StationLesson;
  line: FlowLine;
  station: { name: string; code: string } | null;
  studentId: string;
  attempt: number;
  goal: { amount: number; months: number } | null;
  mode: "station" | "library" | "terminal";
  continueHref: string;
  /** The label of the button that goes there (the workspace's default otherwise). */
  continueLabel?: string;
  fullLessonHref?: string;
  fullLessonLabel?: string;
  /** A hook answered before hydration, from ?hook= (05 A8.6). */
  initialHook?: string | null;
  /** Played without an account (a course's first module): scored, kept in the browser until sign-up. */
  guest?: boolean;
  /** 錯題夾 (2026-11-13): open on these steps only, the rest carried from the latest attempt. */
  initialRedo?: { steps: string[]; carry: Record<string, unknown> } | null;
  /** The versions of the unit tours this student has seen (lib/tour.ts). */
  unitTourSeen?: { unit?: number; check?: number };
  /** Run the Part E flow (06 E8) instead of the older one. */
  design?: { stationName: string; kicker?: string; exitHref: string; short?: boolean; readingHref?: string | null; foldExpert?: boolean; howTo?: boolean };
}) {
  const router = useRouter();
  // A retry asks the server for the page again: the next attempt's lesson is
  // shuffled and drawn there (05 A2, A7), so what the student sees always
  // matches what the server scores. The flow then reopens on the brief.
  const [retried, setRetried] = useState(false);
  const [hook, setHook] = useState<string | null>(initialHook);
  // 06 G1 redo: the missed steps and the carried answers, kept across the
  // refresh that draws the next attempt.
  const [redo, setRedo] = useState<{ steps: string[]; carry: Record<string, unknown>; from: number } | null>(initialRedo ? { ...initialRedo, from: attempt - 1 } : null);

  async function submit(p: SubmitPayload): Promise<SubmitResult> {
    setHook(p.hookAnswer);
    if (mode === "terminal") {
      const res = await fetch("/api/simulation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ line_slug: line.slug, taskSetId: p.taskSetId, answers: p.answers, hookAnswer: p.hookAnswer }),
      });
      if (!res.ok) throw new Error(`simulation ${res.status}`);
      const data = (await res.json()) as {
        outcome: {
          score: number;
          total: number;
          passed: boolean;
          details: StepScore[];
          revealShown: string;
          attempt: number;
          answerKey: AnswerKey;
        };
      };
      return {
        score: data.outcome.score,
        total: data.outcome.total,
        passed: data.outcome.passed,
        details: data.outcome.details,
        stationDone: true,
        reveal: data.outcome.revealShown,
        attempt: data.outcome.attempt,
        answerKey: data.outcome.answerKey,
      };
    }
    const res = await fetch("/api/task", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(p),
    });
    if (!res.ok) throw new Error(`task ${res.status}`);
    if (guest) {
      try {
        window.localStorage.setItem(GUEST_PENDING, JSON.stringify({ ...p, carried: undefined, guest: true }));
      } catch {
        /* no storage: the module still ends; it just is not saved at sign-up */
      }
    }
    return (await res.json()) as SubmitResult;
  }

  async function saveTool(name: string) {
    const res = await fetch("/api/tools", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error(`tools ${res.status}`);
  }

  const onRetry =
    mode === "terminal"
      ? undefined
      : () => {
          setRetried(true);
          router.refresh();
        };
  // 2026-11-02: a station is one page (the workspace); a Short keeps its
  // one-question flow.
  if (design && !design.short) {
    // 2026-11-13: the module player (one question per screen); the one-page
    // workspace stays behind NEXT_PUBLIC_PLAYER=0.
    const shared = {
      lesson,
      stationName: design.stationName,
      kicker: design.kicker,
      goal,
      mode,
      exitHref: design.exitHref,
      onSubmit: submit,
      onSaveTool: saveTool,
      onContinue: () => router.push(continueHref),
      continueLabel,
      initialHookAnswer: hook,
      redo: redo && redo.from + 1 === attempt ? { steps: redo.steps, carry: redo.carry } : null,
      onRedo:
        mode === "terminal" || guest
          ? undefined
          : (steps: string[], carry: Record<string, unknown>) => {
              setRedo({ steps, carry, from: attempt });
              setRetried(true);
              router.refresh();
            },
      studentId,
      attempt,
      readingHref: design.readingHref,
      foldExpert: design.foldExpert,
      howTo: design.howTo,
    };
    const key = `${lesson.task.id}:${attempt}`;
    return PLAYER_V3 ? <ModulePlayer key={key} {...shared} guest={guest} tourSeen={unitTourSeen} /> : <StationWorkspace key={key} {...shared} />;
  }
  if (design) {
    return (
      <StationFlowE
        key={`${lesson.task.id}:${attempt}`}
        lesson={lesson}
        stationName={design.stationName}
        kicker={design.kicker}
        goal={goal}
        mode={mode}
        exitHref={design.exitHref}
        onSubmit={submit}
        onSaveTool={saveTool}
        onContinue={() => router.push(continueHref)}
        onRetry={onRetry}
        startAtTask={retried}
        initialHookAnswer={hook}
        short={design.short}
        // Only on the attempt the redo was asked for (the next one).
        redo={redo && redo.from + 1 === attempt ? { steps: redo.steps, carry: redo.carry } : null}
        onRedo={
          mode === "terminal"
            ? undefined
            : (steps, carry) => {
                setRedo({ steps, carry, from: attempt });
                setRetried(true);
                router.refresh();
              }
        }
        studentId={studentId}
        attempt={attempt}
      />
    );
  }
  return (
    <StationFlow
      key={`${lesson.task.id}:${attempt}`}
      lesson={lesson}
      line={line}
      station={station}
      studentId={studentId}
      attempt={attempt}
      mode={mode}
      goal={goal}
      fullLessonHref={fullLessonHref}
      fullLessonLabel={fullLessonLabel}
      onSubmit={submit}
      onSaveTool={saveTool}
      onContinue={() => router.push(continueHref)}
      onRetry={onRetry}
      startAtTask={retried}
      initialHookAnswer={hook}
    />
  );
}
