# 12: teacher page and class mode, report (2026-11-14)

Branch `feat/teachers`, built from `main` at `497c25c`. Not pushed, not merged.

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
