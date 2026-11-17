# Finline (錢途)

Finline is a free financial literacy platform for high school students in
Taiwan, written in Traditional Chinese. Students read a realistic payslip,
bill or contract and answer questions about it, one short unit at a time. It
is live at [finlinetw.org](https://www.finlinetw.org).

## Status

Finline was built by two high school students using AI coding tools, mainly
Claude Code. It works and real students use it. It has never had an engineer
who owns the backend.

**We are looking for a backend engineer to own it.** The list of what needs
doing is in [`docs/backend-roadmap.md`](docs/backend-roadmap.md). Start
there after this page.

Because of how it was built, expect code that is carefully commented and
well tested in places, and uneven in others. `docs/archive/` holds the specs
and reports from each round of work, if you want to see how it got here.

## What the product is

- **12 courses** (called lines, after the Taipei Metro). Six are core, five
  are electives, one is a capstone. Each has a code from FL101 to FL401.
- **54 units.** A course has 1 to 5 stations and one final. That is 42
  stations and 12 finals.
- **A task engine.** A station is a task set: a short brief, one or more
  documents, and questions of seven kinds (choice, number, find, sort, order,
  rate, write). The content files hold 56 task sets with 140 questions.
  Answers stay on the server and are checked there.
- **Finals.** The last unit of a course is either a task set or an older
  interactive simulation.
- **Progress.** Grades per unit, a folder of missed questions that come back
  two days later, a weekly goal, and a card to save when a course is done.
- **Class mode.** A teacher opens a room, students join with a code, and the
  screen shows how the class did on each question. The quiz questions come
  from a bank of 113 before-and-after questions.
- **Teacher pages.** A lesson plan and a printable worksheet for every
  course, built from the course content.
- **An AI coach** that comments on a student's simulation result. Today it
  covers only a few courses (see the roadmap).
- **A life simulation** (monthly turns with a budget). It is finished but
  switched off in production.

A student signs up with a nickname and gets a six-character code. No email,
no password, no real name.

## Tech stack

- **Next.js 16** (App Router) and **React 19**, in **TypeScript**
- **Tailwind CSS v4**, plus CSS modules and design tokens in `app/tokens.css`
- **Supabase (Postgres)** for all data, reached only from the server
- **Google sign-in** through Supabase Auth (optional, next to the code login)
- **Anthropic** and **OpenRouter** for the AI coach
- **Vercel** for hosting. `main` deploys to production. Functions run in
  `icn1` (`vercel.json`).
- Tests with Node's test runner through `tsx`. Browser checks with Playwright.

This Next.js version has breaking changes from older ones. Read the guide in
`node_modules/next/dist/docs/` before using an API you remember from before
(`AGENTS.md`).

## Architecture

```
app/        pages and API routes
components/ React components
content/    the courses, as data
lib/        the logic: database, sessions, task engine, scoring
scripts/    checks that run in `npm run check`, and one-off tools
supabase/   schema, migrations, local database tooling
tests/      unit tests (tests/*.test.ts) and browser scripts (tests/e2e/)
docs/       database.md, backend-roadmap.md, sources.md, archive/
```

**Pages** are in three route groups. The group name is not part of the URL.

- `app/(site)` is public: the landing page, the catalogue, sign-up, class
  mode, teacher pages, privacy and terms.
- `app/(app)` is everything after sign-in, inside one shell with three tabs
  (學習, 課程, 成績).
- `app/(game)` holds older pages that still work: the original simulations,
  the completion record, the toolbox.

**The backend** is the route handlers in `app/api/` (40 of them). They are
thin. Each one checks the session, calls into `lib/`, and returns JSON.

**The database layer** is one file, `lib/db.ts`. Nothing else talks to the
database. It has two backends: Supabase, and a JSON file for running without
credentials. See `docs/database.md` for the tables.

**Sessions** are in `lib/session.ts`. A cookie identifies the student and
`getCurrentStudent()` loads the row.

**Courses are data.** Each course is one file in `content/lines/`.
`content/curriculum.ts` gives it a code, a track and learning goals.
`lib/lines.ts` holds the list of courses and their stations.
`scripts/check-content.ts` validates all of it.

**The task engine** is `lib/tasks/`. The rule that matters most: a page gets
a lesson with every answer removed (`publicLesson.ts`). The answer comes back
only after the student answers, from `POST /api/task/check` for one question
and `POST /api/task` for the whole unit. `submit.ts` scores the unit and
writes the result. The screen is `components/player/ModulePlayer.tsx`.

**Progress** comes from three tables. `task_results` has every attempt.
`module_progress` says a unit is done. `simulation_runs` says a final is
done. `lib/progressModel.ts` and `lib/grades.ts` turn them into what pages
show.

**Class mode** rules are pure functions in `lib/classRooms.ts`.
`lib/classGuard.ts` applies them in `app/api/class/`.

**Feature switches** are four build-time variables in `next.config.ts`,
read through `lib/flags.ts`. They exist so a change can be rolled back with
a redeploy.

Figures in the lessons (tax rates, insurance limits, minimum wage) are
cited. `docs/sources.md` lists each one with its primary source.

## Local setup

You need Node 20 or newer.

```bash
npm install
cp .env.example .env.local
```

Open `.env.local`, leave the Supabase lines empty, and add:

```
USE_DEV_STORE=1
```

Then:

```bash
npm run dev
```

Open http://localhost:3000. Sign up with any nickname. Everything works
except Google sign-in and real AI replies (the coach shows a fixed message).

Leave `NEXT_PUBLIC_SITE_URL` unset on your machine. With it set to the
production address, the local server answered 404 on every page when we
tried it.

With `USE_DEV_STORE=1` the data lives in `.devstore.json` in the project
folder. Delete that file to start over. It is a JSON file with no
constraints, so it will not catch a bad query. For that, use a real database.

## Database setup

Short version, for a new Supabase project:

1. Run `supabase/schema.sql` in the SQL editor.
2. Run `supabase/seed-lines.sql`.
3. Put `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_ANON_KEY`
   in `.env.local`, and remove `USE_DEV_STORE`.
4. Run `npx tsx scripts/seed-historical-prices.ts`.

The details, how to change the schema, and how to run Postgres on your own
machine without Docker are in [`supabase/README.md`](supabase/README.md).
What each table holds is in [`docs/database.md`](docs/database.md).

The service role key is a secret. It is only ever read on the server. Every
table has row level security on with no policies, so the public key can read
nothing.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server on port 3000. |
| `npm run build` | Production build. Includes a strict type check. |
| `npm run start` | Serve the production build. |
| `npm run lint` | ESLint. |
| `npm test` | The unit tests in `tests/*.test.ts`. No database or browser needed. |
| `npm run check` | The unit tests, then four checks: stored simulation results can be read by everything that reads them, the course content is valid, colour contrast passes, and the design and copy rules hold. Run this before a pull request. |
| `npm run check:contrast` | The contrast check on its own. |
| `npm run check:names` | Fails if a partner organisation's name appears in files or commit messages changed since `main`. |
| `npm run check:screens` | A browser check that screens fit the viewport. Needs a dev server on the file store. |

Other tools:

- `supabase/local/build-schema.sh` rebuilds `supabase/schema.sql` from the
  migrations.
- `supabase/test/run-redesign-migrations.sh` tests the migrations.
- `tests/e2e/*.mjs` are browser scripts, run by hand against a local server.
  Each file says how at the top.

## Routes

Pages:

| Route | What it is |
|---|---|
| `/` | Landing page |
| `/lines` | Course catalogue |
| `/line/[slug]` | A course: syllabus, sample question, grades |
| `/line/[slug]/station/[n]` | A unit. The first unit of a course opens without an account. |
| `/line/[slug]/end`, `/line/[slug]/simulation` | A course's final |
| `/line/[slug]/certificate` | Completion record and the card to save |
| `/signup` | Sign up, or sign in with a code or Google |
| `/today`, `/map`, `/grades` | The three signed-in tabs |
| `/review` | Missed questions to try again |
| `/settings` | Account settings |
| `/teachers`, `/teachers/[slug]` | Teacher guide and lesson plans |
| `/class`, `/class/host`, `/class/play` | Class quiz rooms |
| `/class/life/host`, `/class/life/play` | Class round of the life simulation |
| `/invest-replay` | Investing replay simulator |
| `/about`, `/partnerships`, `/privacy`, `/terms` | Static pages |

Some older pages and developer previews are not listed (`/dev/*`,
`/design-preview/*`, `/passport`, `/transfer`). The full list is the folders
under `app/`.

API routes, all under `/api`:

| Area | Routes |
|---|---|
| Accounts | `signup`, `session`, `auth/google/*`, `avatar`, `mode`, `goal`, `week-goal`, `tour` |
| Learning | `task`, `task/check`, `progress`, `simulation`, `line-test`, `preview`, `tools`, `rides` |
| Class mode | `class/create`, `class/join`, `class/room`, `class/start`, `class/submit`, `class/leaderboard`, `class/close`, `class/life/*` |
| Coach | `coach` |
| Life simulation | `life-game`, `life-game/action`, `life-game/reset` |
| Investing replay | `sim-portfolio`, `sim-portfolio/allocate`, `sim-portfolio/rebalance`, `sim-portfolio/reveal` |

## Where we need help

[`docs/backend-roadmap.md`](docs/backend-roadmap.md) lists eight tasks, each
with what it is, why it matters, where it lives and a rough size. In short:

1. Track migrations and move to the Supabase CLI
2. Add continuous integration
3. Test against a real database
4. Harden sign-in and sessions
5. Split `lib/db.ts` and generate its types
6. Backups, restore, and student data
7. Decide what the AI coach is, then finish it
8. Score class quizzes on the server

## Contributing

1. Branch from `main`. Name it for what it does, for example
   `fix/session-rate-limit`.
2. Keep each commit to one change, with a message that says what and why.
3. Before you open a pull request, run:

   ```bash
   npm run lint
   npm run check
   npm run build
   ```

4. Open a pull request against `main`. Say what you changed and how you
   tested it.
5. Someone else reviews it before it is merged. `main` deploys to production
   on its own, so nothing goes in without a review.

A few rules that are easy to miss:

- Never commit `.env.local` or any key.
- A schema change is a new numbered migration with a way back. See
  `supabase/README.md`.
- The users are minors. Do not add a field that collects personal data
  without asking first.
- Text shown to students is in Traditional Chinese and follows copy rules
  that `npm run check` enforces.
