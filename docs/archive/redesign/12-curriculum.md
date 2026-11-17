# 12: the course-platform pass (2026-11-12)

The ask: stop reading as a game, read as a professional course platform with
a set curriculum. A visitor (a student, a teacher, a nonprofit) should see in
one look what each course teaches, what is in it, how it is graded and what
you leave with, before signing up.

## What the research said

Sources: Coursera course and Specialization pages, Forage simulation pages,
MIT OpenCourseWare, Khan Academy mastery, NGPF's semester course, the CFPB
curriculum review tool, Quality Matters. What was taken from them:

| Pattern | Where it is now |
| --- | --- |
| Course page in a fixed order: outcomes, skills, details, "N modules" accordion with "what's included", grading, FAQ (Coursera) | `/line/[slug]` |
| Program page: N-course series, sequence, per-course level and hours (Coursera Specialization) | `/lines`, the 課程 tab |
| Preview the first module before committing (Coursera's preview) | the first module opens with its concept cards |
| Every task listed with its own minutes; an example answer after you submit; never locked out (Forage) | syllabus rows; the existing 對答案 step |
| Grading policy printed next to the work, pass mark per item, a grades page (Coursera, Quality Matters) | 評分方式 on the course page, the 成績 tab |
| Objectives as "can do" statements tied to activities (NGPF, QM) | 學完這門課，你能夠 |
| A fact block for teachers: topic area, class periods, assessment, when facts were checked (NGPF, CFPB) | 給老師與合作單位 |
| Honest time estimates (the most common complaint about Coursera) | minutes are still computed from each task's questions and documents |

Left out on purpose: reviews, ratings and outcome numbers. There is no real
data to show yet, and the repo's rule is no claim without a source.

## The structure

```
學程 (program)   錢途個人理財學程
  課程 (course)   one line, with a code: FL101 … FL401
    單元 (module)   one station, plus the line's last one
      項目 (item)    情境提問 · 重點概念 · 實作任務 · 解析
```

- **Sequence.** Core (6, in order): 職涯 FL101, 消費 FL102, 存錢 FL103,
  詐騙 FL104, 信用 FL201, 投資 FL202. Electives (5): 學貸 FL203, 租屋 FL204,
  保險 FL205, 報稅 FL301, 創業 FL302. Capstone: 財務決策 FL401. The first
  digit is the level (1 入門, 2 中等, 3 進階, 4 總整).
- **Topic areas.** Six: 收入, 消費與預算, 儲蓄, 信用與借貸, 投資, 風險與保障.
  Each has a core course (a test holds this).
- **Prerequisites** are suggestions and never lock anything.

## Where things live

- `content/curriculum.ts`: the only hand-written part. Program copy, course
  codes, track, area, prerequisites, 3 to 5 objectives per course, the FAQ,
  how each question type is scored.
- `lib/curriculum.ts`: `courseOutline(slug)` builds a course's syllabus from
  the line's own content (modules, items, minutes, scored questions, pass
  mark, documents). Nothing in it is typed by hand, so the syllabus cannot
  drift from what the student does. Counts come from `lib/stationFacts.ts`.
- `lib/grades.ts`: the best attempt per task and what a grade row says.
- `lib/programView.ts`: the program with a student's progress.
- `components/course/`: `CoursePage`, `Catalogue`, `LearnHome` and their CSS.
- `tests/curriculum.test.ts`: codes, order, prerequisites, copy rules, the
  syllabus totals against `lineStats`, the grading rule.

## What changed for a student

| Before | Now |
| --- | --- |
| `/lines`: a route board of metro lines | 課程目錄: the program, its three tracks, 12 course rows, topic areas, grading, FAQ |
| `/line/[slug]`: station dots on a line, 上車 with a train ride | a course page: objectives, skills, details, syllabus accordion, first-module preview, grading table with your scores, outcomes, teacher facts, FAQ |
| Tabs: 今天, 狀態, 路線, 行動 | 學習, 課程, 成績 (plus 設定) |
| 今天: next stop, life-game panel, streak | 學習: continue where you stopped, program progress, in progress, next up, finished |
| no grades page | 成績: every started course, each task's best score against its pass mark |
| a finished station goes to a month of the life game | a finished module goes to the next module; the last one to the course page |
| station header 信用線 · CR02, exit to 今天 | 信用線 · 單元 2 / 3, exit to the course page |

## The life simulation

Off in the main path by default, behind `NEXT_PUBLIC_LIFE_SIM`
(`lib/flags.ts`, `next.config.ts`). Nothing was deleted: the engine, the
saves and the `/turn`, `/status`, `/moves` pages are still there, only the
links to them are gone. Set `NEXT_PUBLIC_LIFE_SIM=1` and redeploy to bring
it back between modules, with its two tabs and the 人生 step.

With it off, onboarding (the savings-goal step) is no longer forced before
the home page.

## Grading, stated honestly

- Every scored task passes at 60% (true of all 101 scored questions' tasks
  today; a test fails if a task's pass mark ever differs from what the
  pages say).
- The grades show the best attempt.
- The server marks a module done on a pass or on the second attempt. A
  second-attempt completion below the pass mark is shown as 已完成，未達標,
  never as 通過.
- 簡答題 are unscored; the course page lists their self-check criteria.

## Not done in this pass

- **Reviews and ratings.** Needs a way to collect them (a table, moderation
  for minors' comments) and a decision on when there are enough to show.
- **A program-level completion record.** Each course still has its own.
- **Standards alignment.** The six areas match the common personal-finance
  framework, but the page names no outside standard. Naming one (and a
  108 課綱 crosswalk) needs a checked source first.
- **Wording inside the station screen.** It still says 這一站 in places; the
  older pages in the game shell (simulations, 完成紀錄, 轉乘站, 護照, 工具箱)
  and the landing's departure-board art keep the metro look.
- **Course names.** Still 職涯線, 信用線 and so on. Renaming them to plain
  course titles is a content decision.
- **e2e walkers** (`tests/e2e`) were written for the old screens and were
  not run or updated.
- **Teacher materials.** Lesson plans, pacing guides and answer keys behind
  a teacher account.

## Verified

`npm run check` (199 tests, the contract, content, contrast and design
checks), `check:names`, lint (0 errors) and `next build`. In the browser on
the local file store: the course page signed out and in, the catalogue, 學習,
成績, one module through to 下一個單元, and no horizontal overflow at 375.

## Second pass, same day: the look

The first version of these pages was plain white cards and hairlines, and
read as generic. The owner asked for color and character back, for high
schoolers, still professional. The direction now, tried "for now":

- **Metro signage.** A course is a block in its line's color; where you go
  next is a dark platform sign; a course's modules are stops on a line (a
  strip in the hero, a vertical line through the syllabus, dots on a tile).
- **One action color:** the platform-edge yellow (`--signal`) on an ink
  edge, pressed down like a real button. It turns white on a block whose
  own color is too close to yellow (`goVars` in `lib/design/lineVars.ts`).
- **Three surfaces, each meaning one thing:** a line-color block (this
  course), a dark sign (next), a white tile with an ink edge (something to
  open). Plain white panels hold text.
- Shared parts: `components/course/kit.module.css`; the course tile is
  `components/course/CourseTile.tsx`.

Applied to: the course page, catalogue, 學習, 成績; the shared button and tab
bar (`components/ui/ui.module.css`), page header and panel
(`components/page`), the lesson screen (`components/flow/workspace.module.css`),
the game shell's card and button (`app/(game)/game.css`), the landing, the
site header and footer, sign-up, and the black buttons on the older pages
(15 files, by pattern). Class mode pages were not touched.

Not looked at one by one after the change: about, partnerships, privacy,
terms, settings, 護照, 轉乘站, 工具箱, 完成紀錄, onboarding and each of the
twelve original simulations. They inherit the buttons and cards; their
layouts are as before.

The owner's first reaction was "more glass, less neobrutalism", then "not
that bad, try this for now". Treat the ink edges and hard shadows as on
trial, not settled.

## Third pass, same day: quiet, like a finance dashboard

The signage look shipped for a few hours and read as loud ("kindergarten").
The owner asked for a professional site a high schooler would still use:
calm, glass on chrome, real documents on the page, a playable preview, fewer
boxes, and all seven changes from the comparison against other platforms
(Coursera, Khan, Brilliant, Codecademy, Duolingo, Forage, 均一, NGPF, Zogo;
then Stripe, Mercury, Wealthsimple, Linear for the dashboard feel).

What the look is now:

- **Surfaces.** White with a hairline and the faintest lift. Glass only on
  chrome that floats over content: the sidebar, the sticky section links,
  the summary card, the public bar. No ink outlines, no hard shadows.
- **One button:** ink. The yellow is an accent (a 練習中 dot, an item
  marker), not a button.
- **Color is the line's own, spent in few places:** the code plate, the
  route (dots and lines), a soft tint behind a document, a tile's top.
- **The artwork is the product.** `DocArt` draws a task's real document
  (the same component a station uses) on the course hero and the catalogue
  header. No stock imagery.
- **Kept from before:** the dark platform sign, the route strip.

What was added:

- **試做一題** (`lib/coursePreview.ts`, `POST /api/preview`,
  `components/course/SampleQuestion.tsx`): one real scored question per
  course, answerable on the course page without signing up. The browser gets
  the question without its answer, as a station does; the answer comes back
  after an attempt, for that one question only. Nothing is stored.
- **Mastery levels** (`lib/grades.ts`): 練習中 / 達標 / 精熟 (90%) from the
  best score, on the syllabus and the grades page.
- **A finish mark:** a 已完成 stamp on a finished course's hero.
- **Catalogue filter by life moment** (`MOMENTS` in `content/curriculum.ts`):
  第一份打工, 準備上大學, 搬出去住, 開始存錢和投資, 不想被騙.
- **Fewer boxes.** The course page is one white sheet with ruled sections;
  the core courses are a path (they are a sequence), electives are tiles.
- **Train loader** (`components/loading/TrainLoader.tsx`, the route groups'
  `loading.tsx` for `(app)` and `(game)`).
- **People and proof placeholders** on the landing (FL05): frames for team
  photos and partner marks, with no names. Partner organisations are not
  named anywhere: `check:names` still enforces that until each has agreed in
  writing.

The shared styles changed in the second pass (buttons, tab bar, page header,
lesson screen, game shell, landing, sign-up, the older pages' buttons) are
back to their calm versions, keeping the course-platform wording and the
cut-off fix.

Verified: 201 tests, the checks, lint, `next build`; headless screenshots of
the course page (signed out and in), catalogue, 學習, 成績, the landing and a
phone-width course page; the sample question answered end to end.
