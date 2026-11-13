/**
 * 錯題夾 and the weekly goal (lib/review.ts): what is in the folder, when it
 * is due, the order, and the week's count in Asia/Taipei.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_WEEK_GOAL, reviewEntries, weekGoal, weekModules, weekStart } from "@/lib/review";
import type { TaskResult } from "@/lib/tasks/types";

const result = (steps: [string, number][], confidence?: Record<string, "sure" | "guess">): TaskResult =>
  ({ kind: "k", taskSetId: "t", score: 0, total: 0, steps: steps.map(([stepId, correct]) => ({ stepId, answer: null, correct })), hookAnswer: null, revealShown: "", provenance: {}, attempt: 1, ...(confidence ? { confidence } : {}) }) as TaskResult;
const row = (task: string, attempt: number, at: string, steps: [string, number][], confidence?: Record<string, "sure" | "guess">, station: number | null = 40) => ({
  task_set_id: task,
  line_slug: "zhiya",
  station_id: station,
  attempt,
  created_at: at,
  result: result(steps, confidence),
});
const scored = (id: string) => (id === "gone" ? null : ["s1", "s2", "s3"]);
const NOW = new Date("2026-11-13T04:00:00Z");

test("review-a: only the latest attempt counts, and only its scored misses", () => {
  const rows = [
    row("a", 1, "2026-11-01T00:00:00Z", [["s1", 0], ["s2", 0], ["s3", 1]]),
    row("a", 2, "2026-11-02T00:00:00Z", [["s1", 1], ["s2", 0.5], ["s3", 1], ["note", 0]]),
  ];
  const out = reviewEntries(rows, scored, NOW);
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].missed, [{ stepId: "s2", sure: false }]);
  assert.equal(out[0].attempt, 2);
});

test("review-b: a module with nothing missed, a library task and a task that is gone are not in the folder", () => {
  const rows = [
    row("a", 1, "2026-11-01T00:00:00Z", [["s1", 1], ["s2", 1], ["s3", 1]]),
    row("lib", 1, "2026-11-01T00:00:00Z", [["s1", 0]], undefined, null),
    row("gone", 1, "2026-11-01T00:00:00Z", [["s1", 0]]),
  ];
  assert.deepEqual(reviewEntries(rows, scored, NOW), []);
});

test("review-c: due two days after the miss; before that it says how many days are left", () => {
  const out = reviewEntries(
    [row("old", 1, "2026-11-10T04:00:00Z", [["s1", 0]]), row("new", 1, "2026-11-12T16:00:00Z", [["s1", 0]])],
    scored,
    NOW,
  );
  assert.deepEqual(out.map((e) => [e.taskSetId, e.due, e.daysLeft]), [["old", true, 0], ["new", false, 2]]);
});

test("review-d: due first, then confident misses, then the oldest", () => {
  const out = reviewEntries(
    [
      row("guess", 1, "2026-11-01T00:00:00Z", [["s1", 0]], { s1: "guess" }),
      row("sure", 1, "2026-11-05T00:00:00Z", [["s1", 0]], { s1: "sure" }),
      row("fresh", 1, "2026-11-13T03:00:00Z", [["s1", 0]], { s1: "sure" }),
    ],
    scored,
    NOW,
  );
  assert.deepEqual(out.map((e) => e.taskSetId), ["sure", "guess", "fresh"]);
  assert.equal(out[0].missed[0].sure, true);
});

test("week-a: the week starts on Monday in Asia/Taipei", () => {
  // 2026-11-13 is a Friday; Sunday 23:30 UTC is already Monday in Taipei.
  assert.equal(weekStart(NOW), "2026-11-09");
  assert.equal(weekStart(new Date("2026-11-08T23:30:00Z")), "2026-11-09");
  assert.equal(weekStart(new Date("2026-11-08T12:00:00Z")), "2026-11-02");
});

test("week-b: the count is the different modules worked on this week", () => {
  const rows = [
    { task_set_id: "a", created_at: "2026-11-08T15:00:00Z" }, // Sunday 23:00 Taipei: last week
    { task_set_id: "a", created_at: "2026-11-08T16:30:00Z" }, // Monday 00:30 Taipei
    { task_set_id: "a", created_at: "2026-11-10T00:00:00Z" },
    { task_set_id: "b", created_at: "2026-11-12T00:00:00Z" },
  ];
  assert.equal(weekModules(rows, NOW), 2);
  assert.equal(weekModules(rows.slice(0, 1), NOW), 0);
});

test("week-c: a goal is one of the offered ones, else the default", () => {
  assert.equal(weekGoal(5), 5);
  assert.equal(weekGoal(4), DEFAULT_WEEK_GOAL);
  assert.equal(weekGoal(undefined), DEFAULT_WEEK_GOAL);
});
