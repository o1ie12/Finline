# Backend roadmap

Eight backend tasks a new engineer could pick up. Each one comes from
something in the code today, not from a wish list. They are in the order we
would do them, but most do not depend on each other.

The backend in one paragraph: Next.js route handlers in `app/api/` (40 of
them) call `lib/db.ts`, which talks to one Supabase Postgres database with the
service role key. There is no ORM and no migration runner. The site is live
with real students, most of them minors, so changes to data need care.

Sizes are rough: small is a day or two, medium is about a week, large is
several weeks.

---

## 1. Track migrations, and move to the Supabase CLI

**What.** Give the database a record of which migrations it has, and apply
them with a tool instead of by hand.

**Why.** Today a migration is a numbered SQL file that someone pastes into
the Supabase SQL editor. Nothing records that it ran. To find out, you look
for a column it adds. `lib/db.ts` has a helper, `lacksMigration27()`, that
exists only because the code could not know whether migration 27 was there.
Production and the repo have drifted before: one migration is still listed as
"unknown" in `supabase/README.md`.

**Where.** `supabase/migration-*.sql` (27 forward files), `supabase/README.md`,
`supabase/local/build-schema.sh` (rebuilds `schema.sql` from all of them),
`supabase/test/`.

**Size.** Medium. The first step is small: check production against
`schema.sql` and write down the answer.

## 2. Add continuous integration

**What.** Run lint, the type check, the unit tests and the content checks on
every pull request. Run the migration tests and the schema build too.

**Why.** There is no CI at all (no `.github/`). Every check so far was run by
hand on one laptop before a push to `main`, and `main` deploys to production
automatically. A new contributor needs the checks to run for them.

**Where.** `package.json` scripts (`lint`, `test`, `check`, `build`),
`supabase/test/run-redesign-migrations.sh` and
`supabase/local/build-schema.sh` (both start their own Postgres, so they suit
a CI job).

**Size.** Small.

## 3. Test against a real database

**What.** Make the database layer's tests run on Postgres, not only on the
JSON file store.

**Why.** `lib/db.ts` has two backends. With `USE_DEV_STORE=1` it reads and
writes `.devstore.json`, which has no constraints, defaults or foreign keys.
All 223 unit tests and most browser tests use it. Bugs that only Postgres
catches have reached production this way (`supabase/local/README.md` lists
two). A local stack exists (Postgres with PostgREST and a small proxy,
`supabase/local/`) but nothing runs the tests on it. Two browser scripts can
already run against a real database and clean up after themselves
(`tests/e2e/realDb.mjs`); they are a model, not a suite.

**Where.** `lib/db.ts`, `tests/`, `tests/e2e/`, `supabase/local/`.

**Size.** Medium.

## 4. Harden sign-in and sessions

**What.** Replace the current session cookies with signed, revocable
sessions. Add rate limits to sign-in and sign-up. Fix Google sign-in.

**Why.** A student signs in with a six-character code. The session cookie
holds that code, or the student's id for Google accounts, as plain values
that stay valid for a year (`lib/session.ts`). There is no way to sign a
device out from the server. `POST /api/session` and `POST /api/signup` have
no rate limit; the only limited endpoints are the class room codes
(`lib/classGuard.ts`). Google sign-in through Supabase Auth currently fails
with a redirect mismatch, which is a setting in the Google console, not code.

**Where.** `lib/session.ts`, `app/api/session/route.ts`,
`app/api/signup/route.ts`, `app/api/auth/google/`, `lib/supabaseAuth.ts`,
`lib/googleAccount.ts` (this one already signs its cookie, and shows how).

**Size.** Medium. Rate limits alone are small.

## 5. Split `lib/db.ts` and generate its types

**What.** Break the one database file into modules by area, and generate the
row types from the schema instead of writing them by hand.

**Why.** `lib/db.ts` is 1,978 lines with 53 exported functions. Almost every
function is written twice, once for the file store and once for Supabase (51
branches). Row types live in `lib/types.ts` and are kept in step with the
schema by memory. Now that `supabase/schema.sql` is generated, the types can
be too. This task should also decide what the file store is for: a demo mode
without credentials, or something to retire once task 3 is done.

**Where.** `lib/db.ts`, `lib/types.ts`, `supabase/schema.sql`.

**Size.** Large. It touches every route, so do it after tasks 2 and 3.

## 6. Backups, restore, and what happens to student data

**What.** Write down how the database is backed up and prove a restore works.
Add a way to export and delete one student's data. Decide how long class
rooms and their participants are kept.

**Why.** The repo has no backup script and no restore notes; whatever the
Supabase plan does is the only safety net, and nobody has tried a restore.
There is no way to delete or export an account, in the app or as a script,
although every student table cascades from `students` so a delete is one
statement. Class rooms are closed but never deleted, so nicknames typed by
students stay forever (`class_participants`). The users are minors, so this
matters more than usual. There is also a known test account in production.

**Where.** `docs/database.md` (which tables hold student data),
`supabase/schema.sql` (the cascades), `lib/db.ts`, `app/(site)/privacy/`.

**Size.** Medium.

## 7. Decide what the AI coach is, then finish it

**What.** Make the coach work the same way for every course, or cut it back
on purpose. Put a limit and a log around it.

**Why.** `lib/coach.ts` calls a model for only three kinds of result: the
retired first-salary simulation (Anthropic, model name fixed in code), the
savings course and the first version of the investing simulation
(OpenRouter). Every other course gets `lineStub()`, a fixed message built
from the student's numbers. So most students never see an AI reply, and two
providers are maintained for a small part of the product. `POST /api/coach`
has no rate limit and no record of what was sent or what it cost. The prompt
sends choices and numbers only, never a name; that rule should stay.

**Where.** `lib/coach.ts`, `app/api/coach/route.ts`, `lib/tasks/coach.ts`,
`components/CoachPanel.tsx`, table `coach_messages`.

**Size.** Medium.

## 8. Score class quizzes on the server

**What.** Move the scoring of a class quiz from the browser to the server.

**Why.** In a quiz room the student's browser holds the questions with their
answers (`lib/prePostQuestions.ts` is imported by
`components/class/QuizPlay.tsx`), works out the score, and posts it.
`POST /api/class/submit` checks only that the numbers have the right shape.
The station tasks already do this properly: answers stay on the server and
`lib/tasks/submit.ts` scores them. The class quiz should follow the same
pattern. The teacher's screen shows class totals, not ranks, so the risk is
low, but a teacher reading the results should be able to trust them.

**Where.** `components/class/QuizPlay.tsx`, `app/api/class/submit/route.ts`,
`app/api/class/leaderboard/route.ts`, `lib/prePostQuestions.ts`,
`lib/classRooms.ts`. Compare with `lib/tasks/submit.ts` and
`lib/tasks/publicLesson.ts`.

**Size.** Small to medium.

---

## Smaller things worth knowing

- **Errors go to `console.error` only** (37 places in `app/api/`). There is
  no error tracking and no alert when production breaks.
- **`line_slug` and `line_id` both exist** on three tables. The slug came
  first. See migrations 08, 09 and 16 and `docs/database.md`.
- **`students.profile` is one JSON column** that keeps growing: goal, saved
  tools, weekly goal, and the text of written answers.
- **The wrong-code limit falls back to memory** on a database without
  migration 27 (`recentJoinMisses` in `lib/db.ts`). Once task 1 is done that
  fallback can go.
