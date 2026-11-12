@AGENTS.md

## Architecture after the 2026-10 redesign

- **Route groups.** `app/(site)` = public pages (landing, lines catalogue, signup, class mode) with the site header and footer. `app/(game)` = every page after login, inside the game shell (`app/(game)/layout.tsx`: station scene, top bar with streak and settings menu, no header or footer). Tokens live in `app/(game)/game.css`, scoped to `.game-shell`. No URL changed.
- **Life game** (`lib/lifeGame/`): pure engine, server-run. `engine.ts` applies one `Action` per turn phase (payday → saveFirst → bills → actions → event → ledger); every balance change books both the net-worth and the cash identity (tests/lifeGame.test.ts). Prices are real 0050/0056 monthly closes from `SEED_ROWS`. The browser gets `publicState()` + `turnView()` only (hidden rolls stripped). API: `GET /api/life-game`, `POST /api/life-game/action`. Unlocks are derived from line completions on every load (`unlocks.ts`), never stored as truth.
- **Task engine** (`lib/tasks/`, `components/tasks/`, `components/documents/`): content is data in `content/lines/<slug>.ts` (`LineContent`). Station and 加碼任務 results go to `task_results` via `POST /api/task` (scored on the server) and mark the station done on a pass or the second attempt. A line's terminal task set posts to `/api/simulation` with a `taskSetId` and is a `simulation_runs` kind (`lib/tasks/terminal.ts`, registered in every exhaustive switch). Station kinds are registered in `lib/tasks/kinds.ts`. `scripts/check-content.ts` and block A2 of `scripts/check-sim-contract.ts` enforce both.
- **New kinds:** terminal task kinds in `TERMINAL_TASK_KINDS` (11). Old kinds are unchanged and still render.
- **Migrations 21-26:** `life_game_saves`, `students.avatar`, `daily_activity`, `task_results`, class life rooms (`class_rooms.kind/seed`, `class_participants.team`), RLS on `line_completions`. Each has a down file; `supabase/test/run-redesign-migrations.sh` tests them on a throwaway cluster.
- **Profile** gains optional `goal`, `careerPriority`, `savedTools`, `seenFullRides`, `onboardedVersion`; 信用線's `creditRecord` now comes from the statement task at station 4.
- **Plan and sources:** `docs/redesign/plan.md` (decisions, conflicts), `docs/redesign/sources.md` (verified figures).

## Course platform (2026-11-12)

- **Program → course → module → item.** A line is a course (code, track, topic area, prerequisites, objectives in `content/curriculum.ts`); a station is a module. `lib/curriculum.ts` `courseOutline(slug)` derives the syllabus (items, minutes, scored questions, pass mark, documents) from the line's content; never type a count or a module list by hand. `tests/curriculum.test.ts` holds it to `lineStats`.
- **Pages.** `/line/[slug]` = the course page (`components/course/CoursePage.tsx`); `/lines` and the 課程 tab (`/map`) = the catalogue (`Catalogue.tsx`); `/today` = 學習 (`LearnHome.tsx`); `/grades` = 成績. Grades use one rule (`lib/grades.ts`): best attempt; a second-attempt completion under the pass mark is 已完成，未達標, never 通過.
- **Life simulation** is out of the main path behind `NEXT_PUBLIC_LIFE_SIM` (`lib/flags.ts`, default off): a finished module goes to the next module. The engine and `/turn`, `/status`, `/moves` remain; `=1` and a redeploy restores the tabs, the 人生 step and the month between modules.
- **Look (third pass, 2026-11-12):** a quiet dashboard. Shared parts in `components/course/kit.module.css` (ink button, plate, card, glass, sign, dots, level). Glass only on floating chrome; color is the line's own, spent on the plate, the route and a tint behind a document. `DocArt` draws a task's real document as artwork. No ink outlines or hard shadows (tried and rejected as loud).
- **試做一題:** one scored question per course on the course page, no session: `lib/coursePreview.ts` picks it, `POST /api/preview` scores it; the page never holds the answer.
- **Loading:** `components/loading/TrainLoader.tsx` via `app/(app)/loading.tsx` and `app/(game)/loading.tsx`.
- **Copy rules still apply** to the new pages (`scripts/check-content.ts`): no 證書/認證/證照/資格, no reviews or outcome numbers without real data. Report: `docs/redesign/12-curriculum.md`.
