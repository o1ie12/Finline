/**
 * Class mode, both flows, with a teacher browser and a student browser
 * (SHIP-LOG step 3). Class mode has no "student does a station, teacher sees
 * it" flow; these are the two it has:
 *
 *   1. 即時測驗: the teacher opens a room on a line's question bank, a student
 *      joins with the code, the teacher starts, the student answers all ten
 *      and sends, and the teacher's leaderboard shows the student's score.
 *   2. 人生賽局: the teacher opens a room and starts it, a signed-in student
 *      joins a team and plays one month, and the teacher's table ranks the
 *      team.
 *
 *   USE_DEV_STORE=1 SUPABASE_URL= SUPABASE_SERVICE_ROLE_KEY= npx next dev -p 3210
 *   BASE_URL=http://localhost:3210 node tests/e2e/class-e.mjs
 */
import { chromium } from "playwright";
import { playTurn, waitHeading } from "./playDriver.mjs";
import { createTracker } from "./realDb.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3210";
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) throw new Error("local dev server only");

const results = [];
const errors = [];
const check = (ok, what) => results.push(`${ok ? "ok  " : "FAIL"} ${what}`);
const browser = await chromium.launch();
const open = async (cookie) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  if (cookie) await ctx.addCookies(["fs_access_code", "fs_signed_in"].map((n, i) => ({ name: n, value: i ? "1" : cookie, domain: "localhost", path: "/" })));
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  return { ctx, page };
};

// spec 12 TCH-5: opening a room needs an account. On a real database (E2E_REAL_DB=1) this is always the one
// test account, and everything the run creates is deleted at the end (tests/e2e/realDb.mjs).
const track = createTracker({ base: BASE, out: process.env.OUT ?? process.cwd() });
track.onCrash();
const account = (name) => track.account(name);

// ---- 1. 即時測驗 ------------------------------------------------------------
{
  const teacher = await open(await account("測驗老師"));
  await teacher.page.goto(BASE + "/class/host", { waitUntil: "networkidle" });
  // the radio is visually hidden; a person clicks its label
  await teacher.page.locator("label", { hasText: "信用線" }).first().click();
  check(await teacher.page.getByRole("radio", { name: "信用線" }).isChecked(), "測驗: the teacher picks 信用線");
  await teacher.page.getByRole("button", { name: "建立房間" }).click();
  const codeEl = teacher.page.locator("p.money").first();
  await codeEl.waitFor({ timeout: 15_000 });
  const code = (await codeEl.innerText()).trim();
  check(/^[A-Z0-9]{4,6}$/.test(code), `測驗: the teacher gets a room code (${code})`);
  track.code(code);

  const student = await open();
  await student.page.goto(BASE + "/class/play", { waitUntil: "networkidle" });
  await student.page.getByLabel("房間代碼").fill(code);
  await student.page.getByLabel("你的名字").fill("課堂走查");
  await student.page.getByRole("button", { name: "加入" }).click();
  await student.page.getByText("已加入房間").waitFor({ timeout: 15_000 });
  await teacher.page.getByText("課堂走查").waitFor({ timeout: 15_000 });
  check(true, "測驗: the student joins and shows on the teacher's screen");

  await teacher.page.getByRole("button", { name: "開始測驗" }).click();
  const send = student.page.getByRole("button", { name: /^送出/ });
  await send.waitFor({ timeout: 20_000 });
  // Answer every question with its first option (the score is whatever it is).
  for (const fs of await student.page.locator("fieldset").all()) await fs.getByRole("button").first().click();
  await send.click();
  // 2026-11-14: correct answers only. The student sees their own score; the teacher's screen shows the
  // class by question and the median, and each student only as handed in.
  await student.page.getByText(/^答對 \d+ \/ 10 題$/).waitFor({ timeout: 15_000 });
  const scoreText = (await student.page.getByText(/^答對 \d+ \/ 10 題$/).innerText()).trim();
  const score = scoreText.match(/答對 (\d+) \/ 10 題/)?.[1];
  const studentText = (await student.page.locator("main").innerText()).replace(/\s+/g, " ");
  check(score != null && !/秒|排行榜/.test(studentText), `測驗: the student sees their own score and no time or ranking (${scoreText})`);
  await teacher.page.getByText("全班結果 · 1 人交卷").waitFor({ timeout: 15_000 });
  const teacherText = (await teacher.page.locator("main").innerText()).replace(/\s+/g, " ");
  check(teacherText.includes(`中位數 ${score} / 10 題`) && teacherText.includes("課堂走查 已交卷") && !/排行榜|秒/.test(teacherText) && !new RegExp(`課堂走查 ${score} / 10`).test(teacherText), `測驗: the teacher sees results by question and the median (${score}), not the student's score`);
  await teacher.page.getByRole("button", { name: "結束這場" }).click();
  await teacher.ctx.close();
  await student.ctx.close();
}

// ---- 2. 人生賽局 ------------------------------------------------------------
{
  // On a real database the same test account hosts the round and plays in it.
  const signup = { access_code: await account("隊伍走查") };
  const teacher = await open(await account("賽局老師"));
  await teacher.page.goto(BASE + "/class/life/host", { waitUntil: "networkidle" });
  await teacher.page.getByRole("button", { name: "建立房間" }).click();
  const codeEl = teacher.page.locator("[aria-label^='房間代碼 ']");
  await codeEl.waitFor({ timeout: 15_000 });
  const code = (await codeEl.innerText()).replace(/\s/g, "");
  check(/^[A-Z0-9]{4,6}$/.test(code), `人生賽局: the teacher gets a room code (${code})`);
  track.code(code);
  await teacher.page.getByRole("button", { name: "開始", exact: true }).click();
  await teacher.page.getByRole("button", { name: "結束這場" }).waitFor({ timeout: 15_000 });

  const student = await open(signup.access_code);
  await student.page.goto(BASE + "/class/life/play", { waitUntil: "networkidle" });
  await student.page.getByLabel("房間代碼").fill(code);
  const name = student.page.getByLabel(/名字/);
  if (await name.count()) await name.first().fill("隊伍走查");
  await student.page.locator("input[name='team']").first().check();
  const team = await student.page.locator("input[name='team']").first().inputValue();
  await student.page.getByRole("button", { name: "加入", exact: true }).click();
  await waitHeading(student.page, 30_000);
  check(true, `人生賽局: the student joins ${team} and the shared save opens`);
  const log = await playTurn(student.page, { timeout: 30_000 });
  check(log.length > 3, `人生賽局: the team plays one month (${log.map((l) => l.from).join(" > ")})`);

  // The teacher's table ranks the team once it has played.
  const ranked = teacher.page.locator("table tr", { hasText: team });
  await ranked.first().waitFor({ timeout: 20_000 });
  check(true, `人生賽局: the teacher's table ranks ${team}`);
  await teacher.page.getByRole("button", { name: "結束這場" }).click();
  await teacher.ctx.close();
  await student.ctx.close();
}

await browser.close();
// A real database: take away the rooms and participants this run created, and say what went.
const cleaned = await track.cleanup();
if (cleaned) {
  console.log("cleanup:", JSON.stringify({ rooms: cleaned.deleted.rooms.length, participants: cleaned.deleted.participants.length, attempts: cleaned.deleted.attempts, refused: cleaned.refused.length, left: cleaned.left }));
  check(cleaned.refused.length === 0 && cleaned.left.roomsOfAccount === 0, "cleanup: every room the test account opened is gone");
}
console.log(results.join("\n"));
console.log(errors.length ? `page errors:\n${errors.join("\n")}` : "page errors: 0");
const fails = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`${results.length} checks, ${fails} failing`);
process.exit(fails || errors.length ? 1 : 0);
