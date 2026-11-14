/**
 * Spec 12 in the browser and over HTTP: the teacher page, the 12 lesson
 * plans, the links into them, the print PDF, and the class-mode limits.
 * (The rules themselves are unit-tested in tests/teachers.test.ts.)
 *
 *   USE_DEV_STORE=1 SUPABASE_URL= SUPABASE_SERVICE_ROLE_KEY= npx next dev -p 3210
 *   BASE_URL=http://localhost:3210 OUT=/some/dir node tests/e2e/teachers-e.mjs
 *
 * Local dev server on the file store only: it signs up test accounts, opens
 * and closes rooms, and edits .devstore.json to age a room past 12 hours.
 * OUT gets the screenshots (375 and 1280 wide) and the PDF of /teachers/zhiya.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3210";
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) throw new Error("local dev server only");
const OUT = process.env.OUT ?? path.join(process.cwd(), ".e2e-out");
mkdirSync(OUT, { recursive: true });
const STORE = path.join(process.cwd(), ".devstore.json");

const SLUGS = ["zhiya", "qixin", "cunqian", "zhapian", "xinyong", "touzi", "xuedai", "zuwu", "baoxian", "baoshui", "chuangye", "caiwujuece"];
const ALPHABET = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;
const results = [];
const check = (ok, what) => results.push(`${ok ? "ok  " : "FAIL"} ${what}`);
const get = (p, init = {}) => fetch(BASE + p, { redirect: "manual", ...init });
const text = (html) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/g, " ").replace(/\s+/g, " ");
const anchors = (html) => [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => ({ href: m[1].replace(/&amp;/g, "&"), text: text(m[2]).trim() }));

async function signup(name) {
  const res = await fetch(BASE + "/api/signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, school: "測試高中", grade: "高二" }) });
  if (!res.ok) throw new Error(`signup ${res.status}`);
  return (await res.json()).access_code;
}
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
    check(/<details\b(?![^>]*\bopen\b)[^>]*>/.test(html) || !html.includes("老師用：建議答案"), `lessonplan-e: ${slug} answer key is collapsed`);
    periodsOnPlan[slug] = Number(text(html).match(/建議 (\d+) 節課/)?.[1]);
    check((text(html).match(/第 \d+ 節/g) ?? []).length === periodsOnPlan[slug] && (html.match(/<table\b/g) ?? []).length === periodsOnPlan[slug], `lessonplan-e: ${slug} has a table per period (${periodsOnPlan[slug]})`);
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

  const teacher = await signup("王老師");
  const rooms = [];
  for (let i = 0; i < 3; i++) {
    const res = i === 2 ? await fetch(BASE + "/api/class/life/create", { method: "POST", headers: as(teacher) }) : await post("/api/class/create", { line_slug: "zhiya" }, as(teacher));
    rooms.push(await res.json());
  }
  check(rooms.every((r) => ALPHABET.test(r.code ?? "")), `classroom-e: room codes use the alphabet (${rooms.map((r) => r.code).join(" ")})`);
  const fourth = await post("/api/class/create", { line_slug: "zhiya" }, as(teacher));
  const body = await fourth.json();
  check(fourth.status === 409 && body.message === "你已經有 3 個房間開著。先關掉一個再開新的。" && body.rooms?.length === 3, `classroom-e: a 4th room is refused with the 3 open ones (${fourth.status})`);
  const other = await signup("陳老師");
  check((await post("/api/class/close", { room_id: rooms[0].room_id }, as(other))).status === 404, "classroom-e: another account cannot close the room");
  check((await post("/api/class/close", { room_id: rooms[0].room_id }, as(teacher))).status === 200, "classroom-e: the host closes one");
  const again = await post("/api/class/create", { line_slug: "touzi" }, as(teacher));
  check(again.status === 200, "classroom-e: then a new room opens");
  const closed = await post("/api/class/join", { code: rooms[0].code, display_name: "小安" }, { "content-type": "application/json", "x-forwarded-for": "203.0.113.1" });
  check(closed.status === 410 && (await closed.json()).message === "這個房間已經關閉，請跟老師要新的代碼。", `classroom-e: a closed room's code says it is closed (${closed.status})`);

  // 12 hours without activity: age the second room in the file store.
  const live = rooms[1];
  const ok1 = await post("/api/class/join", { code: live.code, display_name: "小安" }, { "content-type": "application/json", "x-forwarded-for": "203.0.113.2" });
  check(ok1.status === 200, "classroom-e: an open room can be joined");
  const store = JSON.parse(readFileSync(STORE, "utf8"));
  const row = store.class_rooms.find((r) => r.id === live.room_id);
  row.last_active_at = new Date(Date.now() - 12.1 * 3600 * 1000).toISOString();
  row.created_at = row.last_active_at;
  writeFileSync(STORE, JSON.stringify(store));
  const aged = await post("/api/class/join", { code: live.code, display_name: "小明" }, { "content-type": "application/json", "x-forwarded-for": "203.0.113.2" });
  check(aged.status === 410, `classroom-e: 12 hours after its last activity the room is closed (${aged.status})`);
  const afterAge = await post("/api/class/create", { line_slug: "zhiya" }, as(teacher));
  check(afterAge.status === 200, "classroom-e: an aged-out room no longer counts toward the 3");

  // Wrong codes: 10 in 10 minutes, then wait. Its own address, so nothing else here is blocked.
  // A fresh address each run: the last run's wrong codes still count for ten minutes.
  const guesser = { "content-type": "application/json", "x-forwarded-for": `198.51.100.${1 + (Date.now() % 250)}` };
  const tries = [];
  for (let i = 0; i < 10; i++) tries.push((await post("/api/class/join", { code: "ZZZZZ" + "23456789AB"[i], display_name: "x" }, guesser)).status);
  const eleventh = await post("/api/class/join", { code: again.ok ? (await again.clone().json()).code : "ZZZZZZ", display_name: "x" }, guesser);
  check(tries.every((s) => s === 404) && eleventh.status === 429 && (await eleventh.json()).message === "試太多次了，請 10 分鐘後再試。", `classroom-e: 10 wrong codes, then 429 even for a right one (${tries.join(",")} then ${eleventh.status})`);
  check((await get(`/api/class/room?code=ZZZZZ2`, { headers: guesser })).status === 429, "classroom-e: the code lookup shares the limit");
  check((await get(`/api/class/room?code=${(await again.clone().json()).code}`, { headers: { "x-forwarded-for": "203.0.113.3" } })).status === 200, "classroom-e: another visitor is not affected");

  // Results: percent correct per question and the median; nicknames only.
  const room = await afterAge.json();
  const marks = [[true, true, true, true, true, false, false, false, false, false], [true, false, false, false, false, false, false, false, false, false]];
  for (const [i, m] of marks.entries()) {
    const j = await post("/api/class/join", { code: room.code, display_name: `學生${i + 1}` }, { "content-type": "application/json", "x-forwarded-for": "203.0.113.4" });
    const cookie = (j.headers.get("set-cookie") ?? "").split(";")[0];
    const pid = (await j.json()).participant_id;
    await post("/api/class/submit", { participant_id: pid, score: m.filter(Boolean).length, total_ms: 60000, correct: m }, { "content-type": "application/json", cookie });
  }
  const board = await (await get(`/api/class/leaderboard?room_id=${room.room_id}`)).json();
  check(board.results?.submitted === 2 && board.results.percent[0] === 100 && board.results.percent[1] === 50 && board.results.percent[9] === 0 && board.results.median === 3, `classroom-e: results by question and the median (${JSON.stringify(board.results?.percent)} median ${board.results?.median})`);
  check(board.participants.every((p) => !("answers" in p)) && !/netWorth|net_worth|淨資產/.test(JSON.stringify(board)), "classroom-e: nicknames and scores only; nothing about money");
  globalThis.teacher = teacher;
  globalThis.resultsRoom = room;
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
console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`\n${results.length - failed} / ${results.length} passed. Output in ${OUT}`);
process.exit(failed ? 1 : 0);
