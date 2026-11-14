# 12: teacher page and class mode, report (2026-11-14)

Branch `feat/teachers`, built from `main` at `497c25c`.

**Read the follow-up at the end first.** It changes the periods table, removes
the answer key, and replaces the join limit and the quiz ranking described
below. The first round (up to `1d4fe64`) was merged to `main` on the owner's
instruction and is live; the follow-up commits are on the branch only.

**Before this reaches production, `supabase/migration-27-class-room-limits.sql`
has to be applied** (additive; down file beside it; tested up, down and
re-run on a throwaway database with `supabase/test/run-redesign-migrations.sh`).
The code runs without it, but three limits are weaker until it is applied:
see TCH-5.

## Each ID

| ID | State | Commit | Test |
|---|---|---|---|
| TCH-1 `/teachers` | fixed | `37cba1b`, `99f7d4e` | `teachers-e` |
| TCH-2 links into it | fixed | `37cba1b` | `links-e` |
| TCH-3 lesson plan per course | fixed, with two questions below | `37cba1b`, `99f7d4e` | `lessonplan-e` |
| TCH-4 print layout and worksheet | fixed | `37cba1b`, `99f7d4e` | `print-e` |
| TCH-5 class mode cleanup and limits | fixed in code; full effect needs migration-27 | `5113151`, `99f7d4e` | `classroom-e` |
| TCH-6 class periods on the course page | fixed | `37cba1b` | `periods-e` |
| TCH-7 tests | added | `5113151`, `99f7d4e` | below |

Tests are in two places:

- `tests/teachers.test.ts`: 12 tests under the six names, part of `npm test`
  (220 pass). They cover the rules (period split, room codes, the 12-hour
  close with the clock passed in, the join limit, results) and the sources
  (copy word for word, sections in order, links, no 合作方式, sitemap).
- `tests/e2e/teachers-e.mjs`: 105 checks over HTTP and in a browser against
  a local server on the file store. All pass. It renders the 12 plans,
  crawls the public pages, prints the PDF, and exercises the room limits.
  It is not part of `npm run check`, like the other scripts in `tests/e2e`
  (Playwright is not a repo dependency).
- `tests/e2e/class-e.mjs` (the older two-browser run of a quiz room and a
  人生賽局 round) now signs the teacher in; 9 of 9 pass.

Also run: `npm run check`, lint (0 errors), `check:names` (0 hits), one
production build.

## Periods per course

One function (`coursePeriods` in `lib/lessonPlan.ts`) feeds `/teachers`,
`/teachers/[slug]` and the course page. The browser test reads the number
off all three for every course and they match.

| 代碼 | 課程 | 單元分鐘 | 節數 | 分節 |
|---|---|---|---|---|
| FL101 | 職涯線 | 6 + 14 + 10 = 30 | 1 | 1, 2, 3 |
| FL102 | 消費線 | 6 + 14 + 10 = 30 | 1 | 1, 2, 3 |
| FL103 | 存錢線 | 11 + 10 + 10 = 31 | 2 | 1, 2 / 3 |
| FL104 | 詐騙線 | 9 + 8 + 9 + 9 + 8 + 10 = 53 | 2 | 1, 2, 3 / 4, 5, 6 |
| FL201 | 信用線 | 24 + 11 + 4 = 39 | 2 | 1 / 2, 3 |
| FL202 | 投資線 | 7 + 6 + 8 + 8 = 29 | 1 | 1, 2, 3, 4 |
| FL203 | 學貸線 | 6 + 9 + 6 + 6 + 6 + 10 = 43 | 2 | 1, 2, 3, 4 / 5, 6 |
| FL204 | 租屋線 | 6 + 6 + 6 + 6 + 6 + 10 = 40 | 2 | 1 to 5 / 6 |
| FL205 | 保險線 | 4 + 6 + 6 + 6 + 6 + 10 = 38 | 2 | 1 to 5 / 6 |
| FL301 | 報稅線 | 6 + 6 + 6 + 6 + 6 + 10 = 40 | 2 | 1 to 5 / 6 |
| FL302 | 創業線 | 6 + 6 + 6 + 6 + 6 + 10 = 40 | 2 | 1 to 5 / 6 |
| FL401 | 財務決策線 | 8 + 10 = 18 | 1 | 1, 2 |

存錢線 is one minute over a single period (31 against 30), so the rule gives
it a second period that holds only the 10-minute final. No unit is longer
than 30 minutes, so the 「這個單元比較長」 note does not appear on any plan today.

## Missing fields and hidden rows

No row is hidden. One field was missing and I filled it from course data
rather than hide ten rows; this needs a yes or no:

**Q1. The final of ten courses has no 想一想 of its own** (every course
except 信用線 and 投資線). The spec says to hide a row whose field is missing. Hidden,
the plan would not show the final at all, and five courses' second period
would be a table with only 討論和收尾. Each course's data does carry its own
opening question (`content/lines/<slug>.ts`, `hook.question`), the one the
simulation page showed before the final until the one-mode flow. I used that.
In five courses it is the same sentence as one unit's 想一想 (職涯線 unit 1,
消費線 unit 2, 存錢線 unit 2, 學貸線 unit 2, 保險線 unit 1), so the table asks
it again after the final; the worksheet asks each question once. To hide
those rows instead, it is one line in `lessonPlan()`.

**Q2. The fixed discussion line on units with no wrong answer.**
「[unit title]：大家最常選錯哪一個？為什麼會這樣想？」 is printed for every
unit as written. For a simulation final, and for a unit with no scored
question (職涯線 unit 1), nothing can be 選錯. A second fixed sentence for
those units would have to come from you.

Rows hidden for other reasons: 會讀到的文件 is hidden on the five courses with
no documents; 建議先修 on the three with none; 加碼任務 and 延伸閱讀 where a
course has none. The answer key leaves out questions whose answer depends on
the student's own goal, and unscored questions.

## Decisions I made that you should check

1. **Group headings in the table** use the catalogue's names (核心課程, 選修課程,
   總整課程), not 核心 / 選修 / 總整, so the two pages agree.
2. **The mail button** uses the site's own contact address through the
   existing rule in `lib/site.ts` (never a mailto that goes nowhere). On the
   production host that is the address in the spec, with the spec's subject
   and body; the live privacy page already links the same address. On
   localhost and preview hosts the page shows the site's 「目前還沒有正式的
   聯絡信箱」 line instead. Please confirm the mailbox receives mail.
3. **The answer key is public.** `/teachers/[slug]` is a public page, so the
   folded 建議答案 can be opened by a student. That is what the spec asks
   for; until now answers were only sent after an attempt.
4. **Sign-up now returns to `?next=`** (a plain path on this site only,
   `lib/safeNext.ts`). Before, `/signup?next=…` ignored it, and a teacher
   redirected from `/class/host` would have landed on 我的學習.
5. **`/class` landing:** two existing sentences said 路線; I changed those
   words to 門課 and left the rest. The page description no longer promises
   a speed ranking.
6. **Left as it was:** the quiz still tells students 「越快越準分數越高」 and
   lists them by score, then time. The spec adds results by question and the
   median (done) and does not ask for the list's order to change.
7. **The wrong-code limit also covers `GET /api/class/room`**, which takes a
   code too. Without that, codes could be guessed there instead.

## TCH-5 and migration-27

| Rule | With migration-27 | Before it is applied |
|---|---|---|
| Hosting needs sign-in (page 307, API 401) | yes | yes |
| Room codes: 6 characters, the spec's alphabet, `node:crypto` | yes | yes |
| A room closes 12 hours after its last activity | yes, from `last_active_at` | from when it started or was made |
| Closed-room and too-many-tries messages | yes | yes |
| At most 3 open rooms per account, 關閉房間 | yes | not enforced: rooms have no owner column |
| 10 wrong codes per IP per 10 minutes | yes, counted in the database | counted per server instance only |
| Percent correct per question | yes | shows 「沒有紀錄」; the median still works |

Things to know:

- The migration adds `class_rooms.host_student_id`, `class_rooms.last_active_at`,
  `class_participants.answers` and a table `class_join_attempts`.
- **The wrong-code table stores a salted hash of the visitor's address**,
  never the address, and rows older than ten minutes are deleted on the next
  write. It is still a new thing kept about visitors; the privacy page may
  want a line.
- Rooms opened before the migration have no owner: they are not counted
  toward the 3 and cannot be closed from the list. They close by the
  12-hour rule.
- Nothing runs on a timer. A room is treated as closed when it is read.
- Per-question marks come from the student's browser, as the score always
  has; the server only checks their shape and that they add up to the score.

## Attached

In `docs/redesign/12-teachers/`:

- `teachers-375.png`, `teachers-1280.png`
- `teachers-zhiya-375.png`, `teachers-zhiya-1280.png`
- `teachers-zhiya.pdf`: 2 pages (1 period + the worksheet), no site header,
  footer, navigation or buttons
- `class-host-limit-1280.png`: the 4th-room message with three 關閉房間 buttons

The screenshots were taken on localhost, so `/teachers` shows the
「還沒有正式的聯絡信箱」 line where production shows the button.

## Not verified

- A real database: every run used the local file store. The Supabase paths
  (including the fallbacks for a database without migration-27) are written
  against the error codes PostgREST documents and have not been exercised.
- Printing from Safari or Firefox; the PDF is Chromium's.
- A real class: thirty phones on one school network share one address, so
  ten mistyped codes between them inside ten minutes would lock the room's
  join for everyone there. Worth watching in the pilot.

## Not built (spec section 9)

Teacher accounts, assigning courses and a class progress page, exporting
pre/post results, a teacher interest form.

---

# Follow-up (2026-11-14)

On `feat/teachers` after `1d4fe64`. Not pushed to `main`. No email address,
mailto link or contact rule was added, changed or removed (`lib/site.ts` is
untouched; the diff has no line with a mailto or a contact constant).

## Each item

| # | Item | State | Commit | Test |
|---|---|---|---|---|
| 1 | A final's question that repeats an earlier unit's prints 「同第 n 個單元的問題，請學生比較做之前和做之後的想法。」 | fixed | `46e7586` | `lessonplan-e` |
| 2 | Simulation finals and unscored units get 「[unit title]：你做了什麼選擇？如果重來一次，你會改哪一個？為什麼？」 | fixed | `46e7586` | `lessonplan-e` |
| 3 | Answer key removed, page and print | fixed | `46e7586` | `lessonplan-e` |
| 4 | Unit budget 35 minutes; 31 to 35 closes in 5 | fixed | `46e7586` | `periods-e` |
| 5 | Wrong codes: 50 per address, 10 per device cookie, per 10 minutes | fixed | `700f869` | `classroom-e` |
| 6 | Quiz counts correct answers only; no speed; no ranked list | fixed | `700f869` | `classroom-e`, `class-e` |
| 7 | Privacy sentence and date | fixed | `b46ff2e` | `privacy-e` |
| | Tests, and the real-database run | done | `ac03108` and the commit after it | below |

`npm run check`: 223 tests pass, content, contrast and design checks pass,
lint 0 errors, `check:names` 0 hits.

## Notes on each

1. The sentence replaces the question in the unit's own row, and in the
   暖身 row when that unit opens a period (保險線's second period is only its
   final, so both rows there carry it). Five courses: 職涯線 3→1, 消費線 3→2,
   存錢線 3→2, 學貸線 6→2, 保險線 6→1. The worksheet still asks each question once.
2. "Unscored" is a unit with no scored question. Today that is every
   simulation final plus 職涯線 unit 1.
3. `lessonPlan()` no longer builds an answer key at all, so nothing can leak
   it; the styles and the print rule are gone too.
4. One function still feeds `/teachers`, `/teachers/[slug]` and the course
   page. The 「一節課怎麼上」 list on `/teachers` still says 「討論和收尾 10 分鐘」
   (fixed copy from the first spec); four courses now have a period that
   closes in 5.
5. A device is a random-id cookie (`fs_class_device`, httpOnly, 12 hours)
   set on the first wrong code. Its count is kept in the same table as the
   address count, under a `dev:` prefix, so no new migration. A request that
   sends no cookie counts as a new device each time; the address limit is
   what stops that. **The privacy sentence in item 7 speaks only of the
   network address; this cookie is not mentioned there.**
6. Three things you did not give copy for, so I wrote the minimum:
   - the student's result: 「答對 N / 10 題」 and 「這是你自己的分數。老師的畫面只
     顯示全班每一題的答對比例。」;
   - the host screen keeps a list of nicknames **in the order they joined**,
     each marked 已加入 / 作答中 / 已交卷, with no score, time or place. A
     teacher needs to see who is in the room and who is done. Say if the list
     should go entirely;
   - `/class`: the clause 「答完後看誰又快又準」 is deleted from the lead.
   The endpoint the host screen polls no longer sends any student's score or
   time. No time is measured or stored (`total_ms` is null on new rows).
7. The privacy and terms pages share one date by the repo's rule
   (`lib/legal.ts`), so the terms page shows 2026 年 11 月 14 日 too, and the
   privacy page's change list gained one line. To make 「無法還原」 true, the
   hash is now salted with a server-only secret instead of a value readable in
   the repo (`lib/classGuard.ts`).

## Periods per course (35-minute budget)

| 代碼 | 課程 | 單元分鐘 | 節數 | 分節（單元分鐘，收尾） |
|---|---|---|---|---|
| FL101 | 職涯線 | 6 + 14 + 10 = 30 | 1 | 1, 2, 3（30，收尾 10） |
| FL102 | 消費線 | 6 + 14 + 10 = 30 | 1 | 1, 2, 3（30，收尾 10） |
| FL103 | 存錢線 | 11 + 10 + 10 = 31 | **1** (was 2) | 1, 2, 3（31，收尾 5） |
| FL104 | 詐騙線 | 9 + 8 + 9 + 9 + 8 + 10 = 53 | 2 | 1 to 4（35，收尾 5）/ 5, 6（18，收尾 10） |
| FL201 | 信用線 | 24 + 11 + 4 = 39 | 2 | 1, 2（35，收尾 5）/ 3（4，收尾 10） |
| FL202 | 投資線 | 7 + 6 + 8 + 8 = 29 | 1 | 1 to 4（29，收尾 10） |
| FL203 | 學貸線 | 6 + 9 + 6 + 6 + 6 + 10 = 43 | 2 | 1 to 5（33，收尾 5）/ 6（10，收尾 10） |
| FL204 | 租屋線 | 6 + 6 + 6 + 6 + 6 + 10 = 40 | 2 | 1 to 5（30，收尾 10）/ 6（10，收尾 10） |
| FL205 | 保險線 | 4 + 6 + 6 + 6 + 6 + 10 = 38 | 2 | 1 to 5（28，收尾 10）/ 6（10，收尾 10） |
| FL301 | 報稅線 | 6 + 6 + 6 + 6 + 6 + 10 = 40 | 2 | 1 to 5（30，收尾 10）/ 6（10，收尾 10） |
| FL302 | 創業線 | 6 + 6 + 6 + 6 + 6 + 10 = 40 | 2 | 1 to 5（30，收尾 10）/ 6（10，收尾 10） |
| FL401 | 財務決策線 | 8 + 10 = 18 | 1 | 1, 2（18，收尾 10） |

Only 存錢線 changes its number of periods. 信用線's second period now holds a
single 4-minute unit.

## The run against the real database

A local server on this branch's code, pointed at the production Supabase
project (migration-27 confirmed visible first). One test account. Both
scripts pass:

- `tests/e2e/teachers-e.mjs`: 114 of 114.
- `tests/e2e/class-e.mjs`: 10 of 10 (a quiz round and a 人生賽局 round, teacher
  and student in two browsers).

This exercised the Supabase paths that the file store cannot: the owner
column and the 3-room limit, closing a room, the 12-hour rule from
`last_active_at`, both wrong-code counts in `class_join_attempts`, and
per-question marks in `class_participants.answers`.

**One run stopped early, and why.** The first real run stopped on an error
in my own test, not in the product: the step that ages a room by 12 hours
changed `last_active_at` but not `created_at`, so the room still counted as
open, and later steps failed before the cleanup ran. I removed what it left
by exact match (below), fixed the step, and made both scripts clean up even
when they stop on an error.

### Deleted

Every row was matched by its exact id or key. A room was deleted only if the
test account opened it.

| Run | Rooms | Participants | Wrong-code rows |
|---|---|---|---|
| Stopped run, removed by hand | 4: WL6FHB (life), PDEDQQ, MSYJXR, 2EQQNS | 2: 小安, 小明 | 120 |
| `teachers-e` | 6: 7PTZT5 (life), DSEUCC, E8RVXC, VC7FGA, 5CFE3R, 54N6AY | 5: 小安, 學生1, 學生2, 走查1, 走查2 | 120 |
| `class-e` | 2: JAD3A3, LWEM7C (life) | 2: 課堂走查, 隊伍走查 | 0 |
| **Total** | **12** | **9** | **240** |

Row counts before and after:

| Table | Before | After |
|---|---|---|
| `class_rooms` | 1 | 1 (the room that was already there; never touched) |
| `class_participants` | 0 | 0 |
| `class_join_attempts` | 0 | 0 |
| `students` | 40 | 41 |
| `life_game_saves` | 1 | 2 |

### Still there (not in the list I was told to delete)

- The test account: 自動測試帳號, school 自動測試, id
  `6a244ee9-992f-4ba1-9f71-141135be650d`. It has no progress, results or
  activity rows.
- One 人生賽局 team save it made in `class-e`: id
  `cab34a5c-9f5f-4a61-94aa-3f5318d6ce9c` (第1隊 of the deleted room LWEM7C).

Say the word and I will delete both, by those ids.

### How the run was set up

The production address and key were already in `.env.local`, commented out.
That file was not edited. The preview launcher may not read it, so for the
length of the run they were copied into `.env.development.local` (ignored by
git, owner-only permissions), which Next loads first; that file was deleted
as soon as the second script finished, the server was stopped, and nothing
is listening. Neither value was printed or written anywhere else.

## Attached (refreshed)

`docs/redesign/12-teachers/`: the four page screenshots, `teachers-zhiya.pdf`
(2 pages), `class-host-limit-1280.png`, and new `class-host-results-1280.png`
(the host screen with results by question, the median, and students without
scores).

## Not verified

- Printing from Safari or Firefox.
- The join limits on a real school network.
- Production itself does not have these follow-up changes until the branch
  is merged: the live site still shows the answer key and the old quiz
  screens from the first round.

