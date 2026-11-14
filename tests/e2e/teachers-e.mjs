/**
 * Spec 12 in the browser and over HTTP: the teacher page, the 12 lesson
 * plans, the links into them, the print PDF, and the class-mode limits.
 * (The rules themselves are unit-tested in tests/teachers.test.ts.)
 *
 *   USE_DEV_STORE=1 SUPABASE_URL= SUPABASE_SERVICE_ROLE_KEY= npx next dev -p 3210
 *   BASE_URL=http://localhost:3210 OUT=/some/dir node tests/e2e/teachers-e.mjs
 *
 * A local dev server, by default on the file store: it signs up test
 * accounts, opens and closes rooms, and ages one past 12 hours.
 * OUT gets the screenshots (375 and 1280 wide) and the PDF of /teachers/zhiya.
 *
 * E2E_REAL_DB=1 (with E2E_SUPABASE_URL / E2E_SUPABASE_KEY, and the local
 * server pointed at the same database) uses one test account and deletes
 * every room, participant and wrong-code row it made: tests/e2e/realDb.mjs.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { createTracker } from "./realDb.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3210";
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) throw new Error("local dev server only");
const OUT = process.env.OUT ?? path.join(process.cwd(), ".e2e-out");
mkdirSync(OUT, { recursive: true });
const track = createTracker({ base: BASE, out: OUT });

const SLUGS = ["zhiya", "qixin", "cunqian", "zhapian", "xinyong", "touzi", "xuedai", "zuwu", "baoxian", "baoshui", "chuangye", "caiwujuece"];
const ALPHABET = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;
const results = [];
const check = (ok, what) => results.push(`${ok ? "ok  " : "FAIL"} ${what}`);
const get = (p, init = {}) => fetch(BASE + p, { redirect: "manual", ...init });
const text = (html) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/g, " ").replace(/\s+/g, " ");
const anchors = (html) => [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => ({ href: m[1].replace(/&amp;/g, "&"), text: text(m[2]).trim() }));

const as = (code, ip) => ({ cookie: `fs_access_code=${code}; fs_signed_in=1`, "content-type": "application/json", ...(ip ? { "x-forwarded-for": ip } : {}) });
const post = (p, body, headers = { "content-type": "application/json" }) => fetch(BASE + p, { method: "POST", headers, body: JSON.stringify(body) });

// ------------------------------------------------------------ teachers-e
{
  const res = await get("/teachers");
  const html = await res.text();
  check(res.status === 200, "teachers-e: /teachers returns 200");
  check((html.match(/<h1[\s>]/g) ?? []).length === 1, "teachers-e: one h1");
  const t = text(html);
  const order = ["在課堂上用錢途", "一節課怎麼上", "各課教案", "學生的資料", "聯絡我們"].map((h) => t.indexOf(h));
  check(order.every((i) => i >= 0) && order.join() === [...order].sort((a, b) => a - b).join(), "teachers-e: sections in order");
  const plans = anchors(html).filter((a) => a.text === "看教案");
  check(plans.length === 12, `teachers-e: 12 看教案 links (${plans.length})`);
  const codes = await Promise.all(plans.map((a) => get(a.href).then((r) => r.status)));
  check(codes.every((c) => c === 200), `teachers-e: every 看教案 link returns 200 (${codes.join(",")})`);
  // On a host that can receive mail the button is a mailto with the spec's subject and body; on localhost the
  // site shows its "no address yet" line instead of a dead link (lib/site.ts).
  const mail = html.match(/href="(mailto:[^"]+)"/)?.[1].replace(/&amp;/g, "&");
  check(mail ? /^mailto:hello@[a-z.]+\?subject=錢途課堂使用&body=學校：%0A年級和班級人數：%0A想用的課程：%0A預計日期：$/.test(decodeURI(mail).replace(/\n/g, "%0A")) || mail.includes("subject=") : t.includes("目前還沒有正式的聯絡信箱"), `teachers-e: 寫信給錢途 is a mailto, or the honest "no address yet" line on localhost (${mail ?? "no address on this host"})`);
  const map = await (await get("/sitemap.xml")).text();
  check(map.includes("/teachers</loc>") && SLUGS.every((s) => map.includes(`/teachers/${s}</loc>`)), "teachers-e: /teachers and the 12 plans are in /sitemap.xml");
  check((await get("/teachers/not-a-course")).status === 404, "lessonplan-e: an unknown course is a 404");
}

// ---------------------------------------------------------- lessonplan-e
const periodsOnPlan = {};
const periodsOnIndex = {};
{
  const index = text(await (await get("/teachers")).text());
  for (const slug of SLUGS) {
    const res = await get(`/teachers/${slug}`);
    const html = await res.text();
    const cells = [...html.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map((m) => text(m[1]).trim());
    const bad = cells.filter((c) => !c || /undefined|null|\{\{/.test(c));
    check(res.status === 200 && cells.length >= 12 && bad.length === 0, `lessonplan-e: ${slug} renders, ${cells.length} cells, none empty`);
    check(!/<details\b/.test(html) && !text(html).includes("建議答案"), `lessonplan-e: ${slug} has no answer key`);
    periodsOnPlan[slug] = Number(text(html).match(/建議 (\d+) 節課/)?.[1]);
    check((text(html).match(/第 \d+ 節/g) ?? []).length === periodsOnPlan[slug] && (html.match(/<table\b/g) ?? []).length === periodsOnPlan[slug], `lessonplan-e: ${slug} has a table per period (${periodsOnPlan[slug]})`);
  }
  {
    const zhiya = text(await (await get("/teachers/zhiya")).text());
    check(zhiya.includes("同第 1 個單元的問題，請學生比較做之前和做之後的想法。"), "lessonplan-e: 職涯線's final points back to unit 1's question");
    check(zhiya.includes("職涯抉擇模擬：你做了什麼選擇？如果重來一次，你會改哪一個？為什麼？") && zhiya.includes("你的興趣地圖：你做了什麼選擇？") && zhiya.includes("比較兩份工作：大家最常選錯哪一個？為什麼會這樣想？"), "lessonplan-e: the discussion line follows whether a unit has a wrong answer");
    const cunqian = text(await (await get("/teachers/cunqian")).text());
    check(periodsOnPlan.cunqian === 1 && /5 分鐘 討論和收尾/.test(cunqian) && !/10 分鐘 討論和收尾/.test(cunqian), "lessonplan-e: 存錢線 (31 minutes of units) is one period that closes in 5 minutes");
    check(/10 分鐘 討論和收尾/.test(zhiya), "lessonplan-e: 職涯線 (30 minutes of units) keeps the 10-minute close");
    const privacy = text(await (await get("/privacy")).text()).replace(/ /g, "");
    check(privacy.includes("為了防止有人亂猜房間代碼，我們會暫存一組由你的網路位址轉成、無法還原的代碼，10分鐘後自動刪除。") && privacy.includes("最後更新日期：2026年11月14日"), "privacy-e: the new sentence and date are on /privacy");
  }
  // ---------------------------------------------------------- periods-e
  for (const slug of SLUGS) {
    const course = text(await (await get(`/line/${slug}`)).text());
    const onCourse = Number(course.match(/建議 (\d+) 節課（每節 45 分鐘，含暖身和討論）/)?.[1]);
    check(onCourse === periodsOnPlan[slug], `periods-e: ${slug} course page ${onCourse} = plan ${periodsOnPlan[slug]}`);
  }
  const rows = [...index.matchAll(/(FL\d{3}) (\S+) \d+ 個 \d+ 分鐘 (\d+) 節/g)];
  check(rows.length === 12, `periods-e: /teachers lists 12 rows with a 節數 (${rows.length})`);
  rows.forEach((r) => (periodsOnIndex[r[2]] = Number(r[3])));
  console.log("periods per course (from /teachers):", JSON.stringify(periodsOnIndex));
  console.log("periods per course (from the plans): ", JSON.stringify(periodsOnPlan));
  check(JSON.stringify(Object.values(periodsOnIndex)) === JSON.stringify(SLUGS.map((s) => periodsOnPlan[s])), "periods-e: /teachers shows the same periods as the plans, in catalog order");
}

// --------------------------------------------------------------- links-e
{
  const pages = ["/", "/lines", "/teachers", "/partnerships", "/class", "/about", "/privacy", ...SLUGS.map((s) => `/line/${s}`), ...SLUGS.map((s) => `/teachers/${s}`)];
  const seen = new Map();
  let old = 0;
  for (const p of pages) {
    const html = await (await get(p)).text();
    for (const a of anchors(html)) {
      if (a.text.includes("合作方式")) old++;
      if ((a.text.includes("給老師") || a.text.includes("教案") || a.text.includes("課堂使用說明")) && a.href.startsWith("/")) seen.set(a.href, p);
    }
    if (p === "/") check(anchors(html).some((a) => a.text === "給老師" && a.href === "/teachers"), "links-e: the footer has 給老師");
  }
  check(old === 0, "links-e: no 合作方式 link is left");
  const codes = await Promise.all([...seen.keys()].map((h) => get(h).then((r) => [h, r.status])));
  check(codes.length >= 13 && codes.every(([, c]) => c === 200), `links-e: ${codes.length} 給老師 / 教案 links, all 200 ${codes.filter(([, c]) => c !== 200).map(([h, c]) => `${h}=${c}`).join(" ")}`);
  for (const [p, want] of [["/lines", "老師想在課堂上用？看 給老師 。"], ["/partnerships", "想在課堂上使用錢途？請看 給老師 。"], ["/class", "第一次用？看 課堂使用說明 。"], ["/line/zhiya", "想在班上用這門課？看 這門課的教案 ，或 課堂使用說明 。"]]) {
    const t = text(await (await get(p)).text()).replace(/ /g, "");
    check(t.includes(want.replace(/ /g, "")), `links-e: ${p} has its line`);
  }
}

// ----------------------------------------------------------- classroom-e
{
  for (const p of ["/class/host", "/class/life/host", "/class/host?line=zhiya"]) {
    const res = await get(p);
    const want = `/signup?next=${encodeURIComponent(p)}`;
    check(res.status === 307 && (res.headers.get("location") ?? "").endsWith(want), `classroom-e: signed out, ${p} is a 307 to ${want} (${res.status} ${res.headers.get("location")})`);
  }
  check((await get("/class/play")).status === 200, "classroom-e: joining needs no sign-in");
  check((await post("/api/class/create", { line_slug: "zhiya" })).status === 401, "classroom-e: opening a room without an account is refused (401)");
  check((await fetch(BASE + "/api/class/life/create", { method: "POST" })).status === 401, "classroom-e: opening a life round without an account is refused (401)");
  for (const [p, title] of [["/class", "課堂模式 | 錢途"], ["/class/play", "加入房間 | 錢途"]]) {
    check((await (await get(p)).text()).includes(`<title>${title}</title>`), `classroom-e: ${p} title is ${title}`);
  }

  const teacher = await track.account("王老師");
  const rooms = [];
  for (let i = 0; i < 3; i++) {
    const res = i === 2 ? await fetch(BASE + "/api/class/life/create", { method: "POST", headers: as(teacher) }) : await post("/api/class/create", { line_slug: "zhiya" }, as(teacher));
    rooms.push(await res.json());
    track.room(rooms[i]);
  }
  check(rooms.every((r) => ALPHABET.test(r.code ?? "")), `classroom-e: room codes use the alphabet (${rooms.map((r) => r.code).join(" ")})`);
  const fourth = await post("/api/class/create", { line_slug: "zhiya" }, as(teacher));
  const body = await fourth.json();
  track.room(body);
  check(fourth.status === 409 && body.message === "你已經有 3 個房間開著。先關掉一個再開新的。" && body.rooms?.length === 3, `classroom-e: a 4th room is refused with the 3 open ones (${fourth.status})`);
  // A second identity exists only on the file store; a real database gets one test account.
  const other = await track.secondAccount("陳老師");
  if (other) check((await post("/api/class/close", { room_id: rooms[0].room_id }, as(other))).status === 404, "classroom-e: another account cannot close the room");
  check((await post("/api/class/close", { room_id: rooms[0].room_id }, as(teacher))).status === 200, "classroom-e: the host closes one");
  const again = await post("/api/class/create", { line_slug: "touzi" }, as(teacher));
  const againRoom = await again.json();
  track.room(againRoom);
  check(again.status === 200, "classroom-e: then a new room opens");
  const closed = await post("/api/class/join", { code: rooms[0].code, display_name: "小安" }, { "content-type": "application/json", "x-forwarded-for": track.ip("203.0.113.1") });
  check(closed.status === 410 && (await closed.json()).message === "這個房間已經關閉，請跟老師要新的代碼。", `classroom-e: a closed room's code says it is closed (${closed.status})`);

  // 12 hours without activity: age the second room.
  const live = rooms[1];
  const ok1 = await post("/api/class/join", { code: live.code, display_name: "小安" }, { "content-type": "application/json", "x-forwarded-for": track.ip("203.0.113.2") });
  check(ok1.status === 200, "classroom-e: an open room can be joined");
  await track.ageRoom(live.room_id);
  const aged = await post("/api/class/join", { code: live.code, display_name: "小明" }, { "content-type": "application/json", "x-forwarded-for": track.ip("203.0.113.2") });
  check(aged.status === 410, `classroom-e: 12 hours after its last activity the room is closed (${aged.status})`);
  const afterAge = await post("/api/class/create", { line_slug: "zhiya" }, as(teacher));
  const room = await afterAge.json();
  track.room(room);
  check(afterAge.status === 200, "classroom-e: an aged-out room no longer counts toward the 3");

  // Wrong codes, per device: 10 in 10 minutes from one device cookie, then wait. Fresh addresses each run:
  // the last run's wrong codes still count for ten minutes.
  const n = 1 + (Date.now() % 120);
  const addrA = track.ip(`198.51.100.${n}`);
  const json = { "content-type": "application/json" };
  const first = await post("/api/class/join", { code: "ZZZZZ2", display_name: "x" }, { ...json, "x-forwarded-for": addrA });
  const deviceCookie = track.device(first);
  check(first.status === 404 && deviceCookie !== "", "classroom-e: a wrong code is a 404 and gives the device its cookie");
  const tries = [first.status];
  for (let i = 1; i < 10; i++) tries.push((await post("/api/class/join", { code: "ZZZZZ" + "23456789AB"[i], display_name: "x" }, { ...json, "x-forwarded-for": addrA, cookie: deviceCookie })).status);
  const eleventh = await post("/api/class/join", { code: againRoom.code, display_name: "x" }, { ...json, "x-forwarded-for": addrA, cookie: deviceCookie });
  check(tries.every((x) => x === 404) && eleventh.status === 429 && (await eleventh.json()).message === "試太多次了，請 10 分鐘後再試。", `classroom-e: 10 wrong codes from one device, then 429 even for a right one (${tries.join(",")} then ${eleventh.status})`);
  check((await get(`/api/class/room?code=ZZZZZ2`, { headers: { "x-forwarded-for": addrA, cookie: deviceCookie } })).status === 429, "classroom-e: the code lookup shares the limit");
  // The same address, another device: a classmate on the same wifi is not blocked by one phone's mistakes.
  const classmate = await get(`/api/class/room?code=${againRoom.code}`, { headers: { "x-forwarded-for": addrA } });
  check(classmate.status === 200, `classroom-e: another device at the same address still gets in (${classmate.status})`);

  // Wrong codes, per address: 50 in 10 minutes whatever the device, then wait.
  const addrB = track.ip(`198.51.100.${n + 125}`);
  const fromB = [];
  for (let i = 0; i < 50; i++) {
    const res = await post("/api/class/join", { code: "YYYY" + "23456789AB"[i % 10] + "23456789AB"[Math.floor(i / 10)], display_name: "x" }, { ...json, "x-forwarded-for": addrB });
    track.device(res);
    fromB.push(res.status);
  }
  const fiftyFirst = await get(`/api/class/room?code=${againRoom.code}`, { headers: { "x-forwarded-for": addrB } });
  check(fromB.every((x) => x === 404) && fiftyFirst.status === 429, `classroom-e: 50 wrong codes from one address (each a new device), then 429 (${fromB.filter((x) => x === 404).length} x 404, then ${fiftyFirst.status})`);
  check((await get(`/api/class/room?code=${againRoom.code}`, { headers: { "x-forwarded-for": track.ip("203.0.113.3") } })).status === 200, "classroom-e: another address is not affected");

  // Results: percent correct per question and the median. The class screen gets no student's score.
  const marks = [[true, true, true, true, true, false, false, false, false, false], [true, false, false, false, false, false, false, false, false, false]];
  for (const [i, m] of marks.entries()) {
    const j = await post("/api/class/join", { code: room.code, display_name: `學生${i + 1}` }, { "content-type": "application/json", "x-forwarded-for": track.ip("203.0.113.4") });
    const cookie = (j.headers.get("set-cookie") ?? "").split(";")[0];
    const pid = (await j.json()).participant_id;
    await post("/api/class/submit", { participant_id: pid, score: m.filter(Boolean).length, correct: m }, { "content-type": "application/json", cookie });
  }
  const board = await (await get(`/api/class/leaderboard?room_id=${room.room_id}`)).json();
  check(board.results?.submitted === 2 && board.results.percent[0] === 100 && board.results.percent[1] === 50 && board.results.percent[9] === 0 && board.results.median === 3, `classroom-e: results by question and the median (${JSON.stringify(board.results?.percent)} median ${board.results?.median})`);
  check(board.participants.length === 2 && board.participants.every((p) => !("answers" in p) && !("score" in p) && !("total_ms" in p) && p.submitted === true) && board.participants[0].display_name === "學生1" && !/netWorth|net_worth|淨資產/.test(JSON.stringify(board)), "classroom-e: the class screen gets nicknames in join order and who handed in; no score, no time, nothing about money");
  globalThis.teacher = teacher;
}

// ------------------------------------------- browser: preselect, print, shots
const browser = await chromium.launch();
const errors = [];
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addCookies(["fs_access_code", "fs_signed_in"].map((n, i) => ({ name: n, value: i ? "1" : globalThis.teacher, domain: "localhost", path: "/" })));
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(BASE + "/class/host?line=touzi", { waitUntil: "load" });
  await page.waitForSelector("input[name=line]");
  const picked = await page.evaluate(() => document.querySelector("input[name=line]:checked")?.closest("label")?.innerText.trim());
  check(picked === "投資線", `classroom-e: /class/host?line=touzi preselects 投資線 (${picked})`);
  check((await page.title()) === "開一個房間 | 錢途", "classroom-e: /class/host title");
  check((await page.locator("text=選一門課，題目來自那門課的前後測題庫。").count()) === 1 && (await page.getByRole("link", { name: "課堂使用說明" }).count()) >= 1, "classroom-e: the host page's sentence and the guide link");
  // The 4th-room screen with its 關閉房間 buttons (this account has 3 open).
  await page.getByRole("button", { name: "建立房間" }).click();
  await page.waitForSelector("text=你已經有 3 個房間開著。先關掉一個再開新的。");
  check((await page.getByRole("button", { name: "關閉房間" }).count()) === 3, "classroom-e: the limit screen lists 3 rooms, each with 關閉房間");
  await page.screenshot({ path: `${OUT}/class-host-limit-1280.png` });
  // The host screen of a room with results: by question and the median, students without scores or places.
  await page.getByRole("button", { name: "關閉房間" }).first().click();
  await page.waitForFunction(() => [...document.querySelectorAll("button")].filter((x) => x.textContent?.trim() === "關閉房間").length === 2);
  await page.getByRole("button", { name: "建立房間" }).click();
  const hostCode = page.locator("p.money").first();
  await hostCode.waitFor({ timeout: 20_000 });
  const liveCode = (await hostCode.innerText()).trim();
  track.code(liveCode);
  await page.getByRole("button", { name: "開始測驗" }).click();
  for (const [i, m] of [[true, true, false, false, false, false, false, false, false, false], [true, false, false, false, false, false, false, false, false, false]].entries()) {
    const j = await post("/api/class/join", { code: liveCode, display_name: `走查${i + 1}` }, { "content-type": "application/json", "x-forwarded-for": track.ip("203.0.113.5") });
    const cookie = (j.headers.get("set-cookie") ?? "").split(";")[0];
    await post("/api/class/submit", { participant_id: (await j.json()).participant_id, score: m.filter(Boolean).length, correct: m }, { "content-type": "application/json", cookie });
  }
  await page.getByText("全班結果 · 2 人交卷").waitFor({ timeout: 20_000 });
  const hostText = (await page.locator("main").innerText()).replace(/\s+/g, " ");
  check(/中位數 1\.5 \/ 10 題/.test(hostText) && hostText.includes("答對 100%") && hostText.includes("走查1 已交卷") && !/\d \/ 10(?! 題)/.test(hostText) && !/排行榜|秒/.test(hostText), "classroom-e: the host screen shows results by question and the median; students have no score, time or place");
  await page.screenshot({ path: `${OUT}/class-host-results-1280.png`, fullPage: true });
  await page.getByRole("button", { name: "結束這場" }).click();
  await page.goto(BASE + "/class/life/host", { waitUntil: "load" });
  check((await page.title()) === "人生賽局 | 錢途", `classroom-e: /class/life/host title (${await page.title()})`);
  await ctx.close();
}

for (const [w, h] of [[375, 812], [1280, 900]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 700 });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  for (const [p, name] of [["/teachers", "teachers"], ["/teachers/zhiya", "teachers-zhiya"], ["/teachers/xinyong", "teachers-xinyong"]]) {
    await page.goto(BASE + p, { waitUntil: "load" });
    await page.waitForTimeout(1200);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    check(over <= 0, `screens: ${p} at ${w}px has no sideways scroll (${over})`);
    await page.screenshot({ path: `${OUT}/${name}-${w}.png`, fullPage: true });
  }
  await ctx.close();
}

// ---------------------------------------------------------------- print-e
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/teachers/zhiya", { waitUntil: "load" });
  await page.waitForTimeout(1500);
  await page.emulateMedia({ media: "print" });
  const visible = await page.evaluate(() =>
    [...document.querySelectorAll("nav, header, button, footer")].filter((e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden";
    }).map((e) => e.tagName + ":" + (e.textContent ?? "").trim().slice(0, 12)),
  );
  check(visible.length === 0, `print-e: no nav, header, footer or button is visible in print (${visible.join(" | ")})`);
  const sheet = await page.evaluate(() => {
    const h = [...document.querySelectorAll("h2")].find((x) => x.textContent?.includes("職涯線 學習單"));
    const key = document.querySelector("details");
    return { sheet: !!h && h.getBoundingClientRect().height > 0, keyHidden: !key || key.getBoundingClientRect().height === 0, footer: document.body.innerText.includes("錢途 Finline · finlinetw.org/teachers/zhiya") };
  });
  check(sheet.sheet, "print-e: the worksheet is in the printed plan");
  check(sheet.keyHidden, "print-e: the answer key is not printed while folded");
  check(sheet.footer, "print-e: the print footer line is there");
  const pdf = await page.pdf({ format: "A4", preferCSSPageSize: true, printBackground: false });
  writeFileSync(`${OUT}/teachers-zhiya.pdf`, pdf);
  const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page(?![a-zA-Z])/g) ?? []).length;
  const periods = periodsOnPlan.zhiya;
  check(pages === periods + 1, `print-e: the PDF has ${pages} pages, periods + 1 = ${periods + 1}`);
  // A two-period course: each period starts a page.
  await page.goto(BASE + "/teachers/xinyong", { waitUntil: "load" });
  await page.waitForTimeout(1200);
  await page.emulateMedia({ media: "print" });
  const pdf2 = await page.pdf({ format: "A4", preferCSSPageSize: true });
  writeFileSync(`${OUT}/teachers-xinyong.pdf`, pdf2);
  const pages2 = (pdf2.toString("latin1").match(/\/Type\s*\/Page(?![a-zA-Z])/g) ?? []).length;
  check(pages2 >= periodsOnPlan.xinyong + 1, `print-e: 信用線 (${periodsOnPlan.xinyong} periods) prints on ${pages2} pages`);
  await ctx.close();
}
await browser.close();

check(errors.length === 0, `no page errors (${errors.slice(0, 2).join(" | ")})`);

// A real database: take away everything this run created, and say what went.
const cleaned = await track.cleanup();
if (cleaned) {
  console.log("cleanup:", JSON.stringify({ rooms: cleaned.deleted.rooms.length, participants: cleaned.deleted.participants.length, attempts: cleaned.deleted.attempts, refused: cleaned.refused.length, left: cleaned.left }));
  check(cleaned.refused.length === 0 && cleaned.left.roomsOfAccount === 0, "cleanup: every room the test account opened is gone");
}
console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`\n${results.length - failed} / ${results.length} passed. Output in ${OUT}`);
process.exit(failed ? 1 : 0);
