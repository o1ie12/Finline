/**
 * Spec 12: the teacher page, the lesson plans and the class-mode rules.
 * The browser side (rendered pages, the print PDF, the endpoints) is
 * tests/e2e/teachers-e.mjs; this file covers the rules and the sources.
 */
import assert from "node:assert/strict";
import { randomInt } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { COURSES } from "@/content/curriculum";
import { FLOW_STEPS } from "@/content/flow";
import sitemap from "@/app/sitemap";
import {
  CLASS_COPY,
  JOIN_MAX_WRONG_DEVICE,
  JOIN_MAX_WRONG_IP,
  JOIN_WINDOW_MS,
  MAX_OPEN_ROOMS,
  ROOM_CODE_ALPHABET,
  ROOM_IDLE_MS,
  generateRoomCode,
  isRoomOpen,
  joinBlocked,
  roomResults,
} from "@/lib/classRooms";
import { courseOutline } from "@/lib/curriculum";
import { UNIT_BUDGET, coursePeriods, lessonPlan, splitPeriods, wrapMinutes } from "@/lib/lessonPlan";
import { LEGAL_CHANGES, LEGAL_UPDATED_AT } from "@/lib/legal";
import { fillFigures } from "@/lib/tasks/figures";
import { allLineContent } from "@/lib/tasks/registry";
import { getLine } from "@/lib/lines";
import { safeNext } from "@/lib/safeNext";

const read = (p: string) => readFileSync(p, "utf8");
const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));

// ---------------------------------------------------------------- periods-e
test("periods-e: units fill a 45-minute period in order; a long unit gets its own", () => {
  // Follow-up item 4: units may take 35 minutes; 31 to 35 leaves 5 minutes to close instead of 10.
  assert.equal(UNIT_BUDGET, 35);
  assert.deepEqual(splitPeriods([7, 6, 8, 8]), [[0, 1, 2, 3]]);
  assert.deepEqual(splitPeriods([6, 14, 10]), [[0, 1, 2]]);
  assert.deepEqual(splitPeriods([11, 10, 10]), [[0, 1, 2]]);
  assert.deepEqual(splitPeriods([24, 11, 4]), [[0, 1], [2]]);
  assert.deepEqual(splitPeriods([9, 8, 9, 9, 8, 10]), [[0, 1, 2, 3], [4, 5]]);
  assert.deepEqual(splitPeriods([40, 5]), [[0], [1]]);
  assert.deepEqual(splitPeriods([]), []);
  assert.deepEqual([0, 30, 31, 35].map(wrapMinutes), [10, 10, 5, 5]);
  for (const c of COURSES) {
    for (const period of lessonPlan(c.slug).periods) {
      const units = period.units.reduce((a, u) => a + u.minutes, 0);
      assert.equal(period.wrap, units >= 31 ? 5 : 10, `${c.slug} period ${period.number}`);
      assert.ok(period.long || 5 + units + period.wrap <= 45, `${c.slug} period ${period.number} fits 45 minutes`);
    }
  }
});

test("periods-e: the spec's reference courses, and one source for the number on all three pages", () => {
  const periods = Object.fromEntries(COURSES.map((c) => [c.slug, coursePeriods(courseOutline(c.slug))]));
  assert.equal(periods.touzi, 1);
  assert.equal(periods.zhiya, 1);
  assert.equal(periods.cunqian, 1, "31 minutes of units is one period with a 5-minute close");
  assert.ok(periods.zhapian >= 2);
  // The plan page shows the plan's own periods, which are the same split.
  for (const c of COURSES) assert.equal(lessonPlan(c.slug).periods.length, periods[c.slug], c.slug);
  // /teachers and the course page call the same function; nothing divides minutes by 45 on its own.
  assert.match(read("app/(site)/teachers/page.tsx"), /coursePeriods\(o\)/);
  assert.match(read("components/course/CoursePage.tsx"), /const periods = coursePeriods\(o\);/);
  assert.match(read("components/course/CoursePage.tsx"), /建議 \{periods\} 節課（每節 45 分鐘，含暖身和討論）/);
  assert.ok(!/minutes \/ 45/.test(read("components/course/CoursePage.tsx")));
});

// ------------------------------------------------------------- lessonplan-e
/** Every sentence a plan may quote: the content's own strings, after figures are filled. */
function contentStrings(): Set<string> {
  const out = new Set<string>();
  for (const line of allLineContent()) {
    out.add(line.hook.question);
    for (const l of line.takeaway.lines) out.add(l);
    const meta = getLine(line.slug)!;
    out.add(meta.sim.subtitle);
    for (const raw of line.lessons) {
      const l = fillFigures(raw);
      out.add(l.hook.question);
      out.add(l.task.title);
      if (l.task.brief.do) out.add(l.task.brief.do);
      for (const t of l.takeaway.lines) out.add(t);
    }
  }
  for (const c of COURSES) for (const m of courseOutline(c.slug).modules) out.add(m.title);
  return out;
}

test("lessonplan-e: all 12 plans have every cell filled, from the course content only", () => {
  const known = contentStrings();
  assert.equal(COURSES.length, 12);
  for (const c of COURSES) {
    const p = lessonPlan(c.slug);
    assert.ok(p.periods.length >= 1, c.slug);
    assert.equal(p.units.length, courseOutline(c.slug).modules.length);
    assert.deepEqual(p.periods.flatMap((x) => x.units.map((u) => u.index)), p.units.map((u) => u.index), `${c.slug}: every unit is in exactly one period, in order`);
    for (const period of p.periods) {
      const shown = period.units.filter((u) => u.shown);
      assert.ok(shown.length > 0, `${c.slug} period ${period.number}: a period with no unit row has no warm-up question`);
      for (const u of shown) {
        for (const [what, text] of [["想一想", u.hook], ["你要做的", u.does], ["title", u.title]] as const) {
          assert.ok(text && text.trim(), `${c.slug} unit ${u.index}: empty ${what}`);
          assert.ok(!/undefined|null|\{\{|\}\}/.test(text!), `${c.slug} unit ${u.index}: ${what} is not finished text`);
          assert.ok(known.has(text!), `${c.slug} unit ${u.index}: ${what} is not in the course content: ${text}`);
        }
        assert.ok(u.minutes > 0);
      }
      for (const t of shown[shown.length - 1].takeaway) assert.ok(known.has(t), `${c.slug}: 帶走這個 not in the content: ${t}`);
    }
    // Follow-up items 1 and 3: a repeated 想一想 points back to the unit it repeats; a plan carries no answers.
    for (const u of p.units) {
      if (u.repeats !== null) {
        assert.ok(u.repeats < u.index, `${c.slug} unit ${u.index} repeats a later unit`);
        assert.equal(p.units[u.repeats - 1].hook, u.hook);
      } else {
        assert.equal(p.units.findIndex((x) => x.hook === u.hook), u.index - 1, `${c.slug} unit ${u.index}: an unmarked repeat`);
      }
    }
    assert.ok(!("answerKey" in p), "no answer key in a plan");
    assert.ok(!/correct|explanation|modelAnswer/.test(JSON.stringify(p)), `${c.slug}: answer fields in the plan`);
    assert.deepEqual(p.objectives, courseOutline(c.slug).info.objectives);
  }
});

test("lessonplan-e: the units that repeat a question, and the ones with no wrong answer, are the expected ones", () => {
  const repeats = Object.fromEntries(COURSES.map((c) => [c.slug, lessonPlan(c.slug).units.filter((u) => u.repeats).map((u) => `${u.index}>${u.repeats}`)]).filter(([, v]) => (v as string[]).length));
  assert.deepEqual(repeats, { zhiya: ["3>1"], qixin: ["3>2"], cunqian: ["3>2"], xuedai: ["6>2"], baoxian: ["6>1"] });
  // Simulation finals and unscored units get the "what did you choose" line; scored units keep 最常選錯.
  const open = Object.fromEntries(COURSES.map((c) => [c.slug, lessonPlan(c.slug).units.filter((u) => u.open).map((u) => u.index)]));
  assert.deepEqual(open.zhiya, [1, 3]);
  assert.deepEqual(open.xinyong, []);
  assert.deepEqual(open.touzi, []);
  for (const c of COURSES) {
    const o = courseOutline(c.slug);
    for (const u of lessonPlan(c.slug).units) assert.equal(u.open, o.modules[u.index - 1].simulation || o.modules[u.index - 1].scored === 0, `${c.slug} unit ${u.index}`);
  }
});

test("lessonplan-e: the page uses the spec's fixed labels, and has no answer key", () => {
  const src = read("app/(site)/teachers/[slug]/page.tsx");
  for (const label of ["暖身", "全班一起想", "討論和收尾", "和組員比答案，寫下一件帶走的事", "做完後回頭看：${u.hook}你的想法有變嗎？", "${u.title}：大家最常選錯哪一個？為什麼會這樣想？", "${u.title}：你做了什麼選擇？如果重來一次，你會改哪一個？為什麼？", "同第 ${u.repeats} 個單元的問題，請學生比較做之前和做之後的想法。", "這個單元比較長，討論可以縮短或留到下一節。", "選修，適合提早做完的學生", "列印教案", "開一個房間", "姓名：＿＿＿＿　班級：＿＿＿＿", "我一開始的答案：＿＿＿＿　做完後我的想法：＿＿＿＿", "差在哪？為什麼？", "今天帶走的一件事："]) {
    assert.ok(src.includes(label), `missing: ${label}`);
  }
  // Follow-up item 3: the answer key is gone from the page, and so from print.
  assert.ok(!/<details|建議答案|answerKey/.test(src), "no answer key on the plan page");
  assert.ok(!/\.key\b|keyQ|keyA|keyWhy/.test(read("app/(site)/teachers/teachers.module.css")), "no answer-key styles left");
  assert.match(src, /<td data-label="時間">\{period\.wrap\} 分鐘<\/td>/);
  assert.match(src, /export const dynamicParams = false;/);
  assert.match(src, /href=\{`\/class\/host\?line=\$\{slug\}`\}/);
});

// --------------------------------------------------------------- teachers-e
test("teachers-e: /teachers has the spec's sections in order, its copy, and is in the sitemap", () => {
  const src = read("app/(site)/teachers/page.tsx");
  // The headings as the page draws them (the metadata above also says 課堂模式).
  const body = src.slice(src.indexOf("return ("));
  const order = [">在課堂上用錢途<", "\n          一節課怎麼上\n", "\n          各課教案\n", "\n          課堂模式\n", "\n          學生的資料\n", "\n          聯絡我們\n"].map((h) => body.indexOf(h));
  assert.ok(order.every((i) => i > 0), "a section heading is missing");
  assert.deepEqual([...order].sort((a, b) => a - b), order, "sections are out of order");
  assert.equal((src.match(/<h1/g) ?? []).length, 1);
  for (const copy of [
    "錢途免費，學生只要一個暱稱就能開始，不用 email。每門課約 1 到 2 節課，用手機或電腦都能上。老師不需要金融背景，任務和解析會帶內容。",
    "暖身 5 分鐘：用這門課第一個單元的「{HOOK}」問全班，先不講答案。",
    "const HOOK = FLOW_STEPS[0].label;",
    "做任務：學生一人或兩人一組，在自己的裝置上做單元。",
    "討論和收尾 10 分鐘：用教案裡的討論題，請學生說說一開始怎麼想、後來為什麼改，最後每個人寫下一件帶走的事。",
    "想讓全班一起作答？開一個房間，學生輸入代碼就能加入。題目來自每門課的前後測題庫。",
    "開房間要先登入。房間在最後一次使用後 12 小時自動關閉。",
    "學生只需要暱稱，學校和年級選填。我們不收真實姓名、電話、email 或任何金融帳號。課堂模式的排名看財務健康分，不比誰最有錢。",
    "想在班上試用、需要協助，或發現內容有錯，寫信給我們。",
    "?subject=錢途課堂使用&body=學校：%0A年級和班級人數：%0A想用的課程：%0A預計日期：",
    "在課堂上用錢途：每門課約 1 到 2 節課，附教案、學習單和課堂模式。免費。",
  ]) {
    assert.ok(src.includes(copy), `copy changed: ${copy.slice(0, 20)}`);
  }
  // The step's name comes from content/flow.ts, so the sentence reads as the spec has it.
  assert.equal(FLOW_STEPS[0].label, "想一想");
  assert.ok(!/<form/.test(src), "no form: teacher data is not collected on the site");
  for (const href of ['href="/class/host"', 'href="/class/play"', 'href="/class/life/host"', 'href="/privacy"']) assert.ok(src.includes(href), href);

  const urls = sitemap().map((u) => new URL(u.url).pathname);
  assert.ok(urls.includes("/teachers"));
  for (const c of COURSES) assert.ok(urls.includes(`/teachers/${c.slug}`), c.slug);
});

// ------------------------------------------------------------------ links-e
test("links-e: no 合作方式 link is left; the course page, footer, catalogue, partnerships and /class point to 給老師", () => {
  const files = [...walk("app"), ...walk("components")].filter((f) => /\.tsx$/.test(f));
  assert.deepEqual(files.filter((f) => read(f).includes("合作方式")), []);

  const course = read("components/course/CoursePage.tsx");
  assert.ok(!course.includes("給老師與合作單位"));
  assert.match(course, /想在班上用這門課？看 <Link href=\{`\/teachers\/\$\{line\.slug\}`\}>這門課的教案<\/Link>，或 <Link href="\/teachers">課堂使用說明<\/Link>。/);

  const footer = read("components/SiteFooter.tsx");
  assert.match(footer, /\{ href: "\/lines", label: "課程目錄" \},\s*\{ href: "\/teachers", label: "給老師" \}/);
  assert.match(read("components/course/Catalogue.tsx"), /老師想在課堂上用？看 <Link href="\/teachers">給老師<\/Link>。/);
  assert.match(read("app/(site)/lines/page.tsx"), /<Catalogue teachers /);
  assert.match(read("app/(site)/partnerships/page.tsx"), /想在課堂上使用錢途？請看[\s\S]{0,160}給老師/);
  assert.match(read("app/(site)/class/page.tsx"), /第一次用？看[\s\S]{0,200}課堂使用說明/);
});

// -------------------------------------------------------------- classroom-e
test("classroom-e: room codes are 6 characters from the unambiguous alphabet, from node:crypto", () => {
  assert.equal(ROOM_CODE_ALPHABET, "ABCDEFGHJKLMNPQRSTUVWXYZ23456789");
  for (const ch of "0O1I") assert.ok(!ROOM_CODE_ALPHABET.includes(ch));
  const seen = new Set<string>();
  for (let i = 0; i < 500; i++) {
    const code = generateRoomCode(randomInt);
    assert.match(code, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    seen.add(code);
  }
  assert.ok(seen.size > 495, "codes repeat far too often to be random");
  // The server generator is the crypto one, and codes are unique in the table.
  assert.match(read("lib/db.ts"), /return roomCode\(randomInt\);/);
  assert.match(read("lib/db.ts"), /import \{ randomInt, randomUUID \} from "node:crypto";/);
  assert.match(read("supabase/migration-06-class-mode.sql"), /code\s+text not null unique/);
});

test("classroom-e: a room closes 12 hours after its last activity (clock passed in), or when its host ends it", () => {
  const t0 = new Date("2026-11-14T00:00:00Z");
  const room = { status: "waiting" as const, created_at: t0.toISOString(), started_at: null, last_active_at: t0.toISOString() };
  const after = (ms: number) => new Date(t0.getTime() + ms);
  assert.equal(ROOM_IDLE_MS, 12 * 60 * 60 * 1000);
  assert.equal(isRoomOpen(room, after(ROOM_IDLE_MS)), true);
  assert.equal(isRoomOpen(room, after(ROOM_IDLE_MS + 1)), false);
  // Activity moves the clock.
  assert.equal(isRoomOpen({ ...room, last_active_at: after(11 * 3600_000).toISOString() }, after(20 * 3600_000)), true);
  assert.equal(isRoomOpen({ ...room, status: "finished" }, after(1)), false);
  // A room from before migration-27 has no last_active_at: its start, then its creation, count.
  assert.equal(isRoomOpen({ status: "active", created_at: t0.toISOString(), started_at: after(3600_000).toISOString() }, after(12.5 * 3600_000)), true);
  assert.equal(isRoomOpen({ status: "active", created_at: t0.toISOString(), started_at: null }, after(12.5 * 3600_000)), false);
});

test("classroom-e: 3 open rooms per account; wrong codes: 10 per device and 50 per address in 10 minutes; the fixed messages", () => {
  assert.equal(MAX_OPEN_ROOMS, 3);
  assert.equal(JOIN_MAX_WRONG_DEVICE, 10);
  assert.equal(JOIN_MAX_WRONG_IP, 50);
  assert.equal(JOIN_WINDOW_MS, 10 * 60 * 1000);
  const now = Date.UTC(2026, 10, 14);
  const tries = (n: number, ago: number) => Array.from({ length: n }, () => now - ago);
  assert.equal(joinBlocked(tries(9, 1000), now, JOIN_MAX_WRONG_DEVICE), false);
  assert.equal(joinBlocked(tries(10, 1000), now, JOIN_MAX_WRONG_DEVICE), true);
  assert.equal(joinBlocked(tries(49, 1000), now, JOIN_MAX_WRONG_IP), false, "a class behind one address can mistype 49 times");
  assert.equal(joinBlocked(tries(50, 1000), now, JOIN_MAX_WRONG_IP), true);
  assert.equal(joinBlocked([...tries(9, 1000), ...tries(5, JOIN_WINDOW_MS + 1)], now, JOIN_MAX_WRONG_DEVICE), false, "old tries no longer count");
  // Both counts are checked before a code is looked up, and both are recorded on a miss.
  const guard = read("lib/classGuard.ts");
  assert.match(guard, /joinBlocked\(fromAddress, now, JOIN_MAX_WRONG_IP\)/);
  assert.match(guard, /joinBlocked\(fromDevice, now, JOIN_MAX_WRONG_DEVICE\)/);
  assert.match(guard, /recordJoinMiss\(visitorHash\(req\)\), recordJoinMiss\(deviceKey\(device\)\)/);
  assert.match(guard, /res\.cookies\.set\(CLASS_DEVICE_COOKIE, device, \{ httpOnly: true/);
  assert.equal(CLASS_COPY.tooManyRooms, "你已經有 3 個房間開著。先關掉一個再開新的。");
  assert.equal(CLASS_COPY.closeRoom, "關閉房間");
  assert.equal(CLASS_COPY.roomClosed, "這個房間已經關閉，請跟老師要新的代碼。");
  assert.equal(CLASS_COPY.tooManyTries, "試太多次了，請 10 分鐘後再試。");
  // Enforced on the server, for both kinds of room and for every lookup that takes a code.
  for (const f of ["app/api/class/create/route.ts", "app/api/class/life/create/route.ts"]) {
    assert.match(read(f), /requireHost\(\)[\s\S]*refuseOverLimit\(host\)/, f);
  }
  for (const f of ["app/api/class/join/route.ts", "app/api/class/life/join/route.ts", "app/api/class/room/route.ts"]) {
    assert.match(read(f), /refuseIfBlocked\(req\)/, f);
    assert.match(read(f), /wrongCode\(req\)/, f);
  }
  for (const f of ["app/api/class/join/route.ts", "app/api/class/life/join/route.ts"]) assert.match(read(f), /if \(!isRoomOpen\(room, new Date\(\)\)\) return roomClosed\(\);/, f);
});

test("classroom-e: hosting redirects a signed-out visitor to sign-up; joining stays open", () => {
  assert.match(read("app/(site)/class/host/page.tsx"), /if \(!student\) redirect\(`\/signup\?next=\$\{encodeURIComponent\(/);
  assert.match(read("app/(site)/class/life/host/page.tsx"), /if \(!student\) redirect\(`\/signup\?next=\$\{encodeURIComponent\("\/class\/life\/host"\)\}`\);/);
  assert.ok(!/redirect\(|getCurrentStudent/.test(read("app/(site)/class/play/page.tsx")));
  // Sign-up comes back only to a path on this site.
  assert.match(read("app/(site)/signup/page.tsx"), /const next = safeNext\(wanted\);/);
  for (const ok of ["/class/host", "/class/host?line=zhiya", "/class/life/host", "/today"]) assert.equal(safeNext(ok), ok);
  for (const bad of ["//evil.example", "https://evil.example", "/\\evil", "javascript:alert(1)", "", undefined, 3]) assert.equal(safeNext(bad), null, String(bad));
});

test("classroom-e: a quiz counts correct answers only: no speed, no ranked list, each student sees their own score", () => {
  const play = read("components/class/QuizPlay.tsx");
  const host = read("components/class/QuizHost.tsx");
  const board = read("app/api/class/leaderboard/route.ts");
  for (const [name, src] of [["QuizPlay", play], ["QuizHost", host], ["/class", read("app/(site)/class/page.tsx")]] as const) {
    assert.ok(!/越快越準|又快又準|速度|排行榜|total_ms|totalMs|toFixed\(1\)/.test(src), `${name} still mentions speed or a ranking`);
  }
  assert.ok(!/Date\.now\(\)|startedAt/.test(play), "the student page measures no time");
  assert.match(play, /答對 \{result\.score\} \/ \{result\.total\} 題/);
  // The class screen gets nicknames and who has handed in, in join order: no score, no time, no rank.
  assert.match(board, /\.sort\(\(a, b\) => a\.joined_at\.localeCompare\(b\.joined_at\)\)\s*\.map\(\(p\) => \(\{ id: p\.id, display_name: p\.display_name, submitted: Boolean\(p\.submitted_at\) \}\)\)/);
  assert.ok(!/score: p\.score|total_ms/.test(board));
  assert.ok(!/p\.score|i \+ 1\}<\/span>/.test(host), "the host screen shows no student's score or place");
  assert.match(host, /全班結果/);
  assert.match(read("app/api/class/submit/route.ts"), /submitClassResult\(participantId, score, null, answers\)/);
});

test("privacy-e: the technical-data paragraph says what the wrong-code limit keeps, and the date moved", () => {
  const src = read("app/(site)/privacy/page.tsx");
  const at = src.indexOf("3. 技術性資料");
  assert.ok(at > 0);
  assert.ok(src.slice(at, at + 400).includes("為了防止有人亂猜房間代碼，我們會暫存一組由你的網路位址轉成、無法還原的代碼，10 分鐘後自動刪除。"));
  // The 2026-11-14 change stays in the log; later edits move the date on.
  assert.ok(LEGAL_CHANGES.some((c) => c.date === "2026-11-14" && c.page === "privacy"));
  const [y, m, d] = LEGAL_CHANGES[0].date.split("-").map(Number);
  assert.equal(String(LEGAL_UPDATED_AT), `${y} 年 ${m} 月 ${d} 日`, "the page date is the newest change's date");
});

test("classroom-e: results are percent correct per question and the median; no class view ranks by money", () => {
  const p = (score: number, answers: boolean[] | null, done = true) => ({ score, answers, submitted_at: done ? "2026-11-14T00:00:00Z" : null });
  const r = roomResults([p(2, [true, true, false]), p(1, [true, false, false]), p(3, [true, true, true]), p(0, null, false)], 3);
  assert.deepEqual(r, { submitted: 3, percent: [100, 67, 33], median: 2 });
  assert.deepEqual(roomResults([p(1, null), p(3, null)], 2), { submitted: 2, percent: [null, null], median: 2 });
  assert.deepEqual(roomResults([], 2), { submitted: 0, percent: [null, null], median: null });

  // The quiz screens have no money at all; the life round's board is ranked by 財務健康分 on the server.
  const money = /netWorth|net_worth|淨資產|最有錢/;
  for (const f of ["components/class/QuizHost.tsx", "components/class/QuizPlay.tsx", "app/api/class/leaderboard/route.ts"]) assert.ok(!money.test(read(f)), f);
  assert.match(read("app/api/class/life/leaderboard/route.ts"), /rankTeams\(saves, room\.id\)/);
  const host = read("components/classLife/ClassLifeHost.tsx").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  assert.ok(!/netWorth|淨資產/.test(host), "the life round's board shows no net worth");
  // The leaderboard endpoint sends nicknames and scores, never a student's per-question marks.
  assert.ok(!/answers: p\.answers/.test(read("app/api/class/leaderboard/route.ts")));
});

test("classroom-e: every /class page has a Chinese title and the link back to 課堂使用說明", () => {
  const titles: Record<string, string> = {
    "app/(site)/class/page.tsx": "課堂模式",
    "app/(site)/class/host/page.tsx": "開一個房間",
    "app/(site)/class/play/page.tsx": "加入房間",
    "app/(site)/class/life/host/page.tsx": "人生賽局",
  };
  for (const [f, title] of Object.entries(titles)) assert.match(read(f), new RegExp(`title: "${title}"`), f);
  const all = [...walk("app/(site)/class"), ...walk("components/class"), ...walk("components/classLife")].filter((f) => /\.tsx?$/.test(f));
  assert.deepEqual(all.filter((f) => /Class Mode|CLASS MODE/.test(read(f))), []);
  assert.deepEqual(all.filter((f) => /路線/.test(read(f).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ""))), []);
  assert.match(read("components/class/QuizHost.tsx"), /選一門課，題目來自那門課的前後測題庫。/);
  for (const f of ["components/class/QuizHost.tsx", "components/class/QuizPlay.tsx"]) assert.match(read(f), /<GuideLink \/>/, f);
  assert.match(read("components/classLife/ClassLifeShell.tsx"), /<Link href="\/teachers">\{CLASS_COPY\.guide\}<\/Link>/);
  assert.equal(CLASS_COPY.guide, "課堂使用說明");
});
