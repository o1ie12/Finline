/**
 * The first-sign-in tours (lib/tour.ts, 2026-11-23): every step points at
 * an anchor a page actually carries, the copy follows the house rules, and
 * the stored "seen" record is read per tour.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { LINES } from "@/lib/lines";
import { HOME_TOUR_STEPS, TOURS, TOUR_TARGETS, UNIT_TOUR_STEPS, isTourId, seenVersionOf } from "@/lib/tour";

const read = (p: string) => readFileSync(p, "utf8");
const TARGETS = new Set<string>(Object.values(TOUR_TARGETS));

test("tour-a: each tour's steps have unique ids and point at a named anchor or nothing", () => {
  for (const [id, t] of Object.entries(TOURS)) {
    const ids = t.steps.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length, `${id}: duplicate step ids`);
    for (const s of t.steps) assert.ok(s.target === null || TARGETS.has(s.target), `${id}/${s.id}: unknown target ${s.target}`);
    assert.ok(t.version >= 1);
  }
  // The home tour opens and closes on a centred card; only the last can lead somewhere.
  assert.equal(HOME_TOUR_STEPS[0].target, null);
  assert.equal(HOME_TOUR_STEPS.at(-1)!.target, null);
  assert.equal(HOME_TOUR_STEPS.at(-1)!.go, true);
  assert.deepEqual(HOME_TOUR_STEPS.filter((s) => s.go).map((s) => s.id), ["go"]);
  assert.ok(UNIT_TOUR_STEPS.every((s) => s.target !== null && !s.go));
  // The buttons' own tour is the unit tour's last step, word for word.
  assert.deepEqual(TOURS.check.steps, [UNIT_TOUR_STEPS.at(-1)]);
});

test("tour-b: every anchor the home and unit tours use is on the page that shows them", () => {
  const where: Record<string, string> = {
    [TOUR_TARGETS.homeStart]: "components/course/LearnHome.tsx",
    [TOUR_TARGETS.homeProgram]: "components/course/LearnHome.tsx",
    [TOUR_TARGETS.homeWeek]: "components/course/LearnHome.tsx",
    [TOUR_TARGETS.homeReview]: "components/course/LearnHome.tsx",
    [TOUR_TARGETS.tabCourses]: "components/ui/TabBar.tsx",
    [TOUR_TARGETS.tabGrades]: "components/ui/TabBar.tsx",
    [TOUR_TARGETS.tabSettings]: "components/ui/TabBar.tsx",
    [TOUR_TARGETS.unitDoc]: "components/player/ModulePlayer.tsx",
    [TOUR_TARGETS.unitProgress]: "components/player/ModulePlayer.tsx",
    [TOUR_TARGETS.unitHint]: "components/player/ModulePlayer.tsx",
    [TOUR_TARGETS.unitCheck]: "components/player/ModulePlayer.tsx",
  };
  const keyOf = Object.fromEntries(Object.entries(TOUR_TARGETS).map(([k, v]) => [v, k]));
  for (const s of [...HOME_TOUR_STEPS, ...UNIT_TOUR_STEPS]) {
    if (s.target === null) continue;
    const file = where[s.target];
    assert.ok(file, `no page listed for ${s.target}`);
    const src = read(file);
    const named = src.includes(`TOUR_TARGETS.${keyOf[s.target]}`) || src.includes(`"${s.target}"`);
    assert.ok(named, `${s.target} is not set in ${file}`);
  }
  assert.match(read("components/course/LearnHome.tsx"), /<TourAutoStart tour="home" seenVersion=\{tourSeen\}/);
  assert.match(read("components/player/ModulePlayer.tsx"), /<TourAutoStart tour="unit" seenVersion=\{tourSeen\?\.unit\} \/>/);
  assert.match(read("components/player/ModulePlayer.tsx"), /\{!reflective \? <TourAutoStart tour="check" seenVersion=\{tourSeen\?\.check\} \/> : null\}/);
  assert.match(read("app/(app)/(tabs)/today/page.tsx"), /tourSeen=\{seenVersionOf\(readProfile\(student\.profile\), "home"\)\}/);
  assert.match(read("app/(app)/line/[slug]/station/[n]/page.tsx"), /unitTourSeen=\{\{ unit: seenVersionOf\(profile, "unit"\), check: seenVersionOf\(profile, "check"\) \}\}/);
});

test("tour-c: the copy matches the product and the house style", () => {
  const program = HOME_TOUR_STEPS.find((s) => s.id === "program")!;
  assert.match(String(program.body), new RegExp(`全部 ${LINES.length} 門課`));
  for (const s of [...HOME_TOUR_STEPS, ...UNIT_TOUR_STEPS]) {
    const text = `${s.title}${s.body}`;
    assert.ok(!/[—–]/.test(text), `${s.id}: a dash`);
    assert.ok(!/我們/.test(text), `${s.id}: 我們`);
    assert.ok(!/路線|這一站|每一站/.test(text), `${s.id}: metro wording`);
    assert.ok([...String(s.body)].length <= 80, `${s.id}: over 80 characters`);
  }
});

test("tour-d: what was seen is read per tour; only the known tours are accepted", () => {
  assert.equal(seenVersionOf({}, "home"), undefined);
  assert.equal(seenVersionOf({ toursSeen: { home: 1 } }, "home"), 1);
  assert.equal(seenVersionOf({ toursSeen: { home: 1 } }, "unit"), undefined);
  assert.equal(seenVersionOf({ tutorialSeenVersion: 2, toursSeen: { home: 1 } }, "life"), 2);
  assert.ok(isTourId("home") && isTourId("unit") && isTourId("check") && isTourId("life"));
  assert.ok(!isTourId("x") && !isTourId(undefined));
  const api = read("app/api/tour/route.ts");
  assert.match(api, /toursSeen: \{ \.\.\.seen, \[tour\]: version \}/);
  assert.match(api, /const version = TOURS\[tour\]\.version;/);
});

test("tour-e: 設定 is reachable on a phone when the life simulation is off", () => {
  assert.match(read("components/ui/TabBar.tsx"), /\$\{LIFE_SIM \? "" : s\.tabSettingsPhone\}/);
  assert.match(read("components/ui/ui.module.css"), /\.tabSettingsPhone \{\s*display: flex;\s*\}/);
});
