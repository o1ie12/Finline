# Database

Finline uses one Postgres database on Supabase. Only the server talks to it,
with the service role key. Nothing in a browser reads or writes it. Every
table has row level security on with no policies, so the public key can see
nothing.

What each table holds is in [`docs/database.md`](../docs/database.md).

## What is in this folder

| Path | What it is |
|---|---|
| `schema.sql` | The whole schema for a new, empty database. Generated, do not edit. |
| `seed-lines.sql` | The 12 rows of `lines`. Generated, do not edit. |
| `migration-NN-*.sql` | Every change since the first version, in number order. The source of truth. |
| `migration-NN-*-down.sql` | The way back for that migration (08, 09 and 19 to 27 have one). |
| `migration-08-verify.sql` | Checks to run after migration-08. Not a migration. |
| `schema-legacy.sql` | The schema before migration-08. The local setup and the migration tests build on it. Do not use it for a new database. |
| `bundles/` | One-file copies of migrations that were pasted into the Supabase SQL editor. Kept for the record. |
| `local/` | Run the app against real Postgres on your machine, and rebuild `schema.sql`. |
| `test/` | Migration tests on a throwaway database. |

## A new, empty database

Run these in order. On Supabase, paste each file into the SQL editor.

1. `supabase/schema.sql`
2. `supabase/seed-lines.sql`
3. From your machine, with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set:

   ```bash
   npx tsx scripts/seed-historical-prices.ts
   ```

   This fills `historical_prices` for the investing replay simulator.

`schema.sql` is the same as running `schema-legacy.sql` and then migrations 01
to 27 in order. `supabase/local/build-schema.sh` builds it that way and then
checks that the file rebuilds the same schema on an empty database.

## A database that already exists

There is no migration runner. A migration is applied by hand: open the file,
paste it into the Supabase SQL editor, run it. So:

- Apply migrations in number order. Never skip one.
- Most are written to be safe to run twice (`if not exists`). Read the
  comment at the top of the file first. Some say when they are safe to run.
- `migration-09` is the second half of a two-step change. Read its header
  before running it.
- Nothing in the database records which migrations it has. Check a table or
  column the migration adds. This is the first item in
  [`docs/backend-roadmap.md`](../docs/backend-roadmap.md).

Production, as checked on 2026-11-14: it has the tables and columns from
migrations 20 to 27. Whether `migration-09` (`line_id` NOT NULL) is applied
there was not checked. `schema.sql` includes it.

## Adding a migration

1. Add `migration-NN-short-name.sql` with the next number. Say at the top
   what it does, whether it is additive, and when it is safe to apply.
2. Add `migration-NN-short-name-down.sql`.
3. Add both to `test/run-redesign-migrations.sh` and run it.
4. Add the up file to `local/setup-local-db.sh`.
5. Run `local/build-schema.sh` and commit the new `schema.sql`.
6. Add or change the table's paragraph in `docs/database.md`.
7. Write the code so it still works on a database without the migration, or
   apply the migration before the deploy. `lacksMigration27()` in `lib/db.ts`
   shows one way.

## Running the app against Postgres on your machine

See [`local/README.md`](local/README.md). It uses Homebrew `postgresql@16` and
`postgrest`, no Docker. `local/setup-local-db.sh` builds a database with test
rows from before the migrations, so a migration is tried against old data.

## Tests

```bash
supabase/test/run-redesign-migrations.sh   # 21 to 27: up, down, up again, twice
supabase/test/run-migration-test.sh        # migration-08 on its own
supabase/local/build-schema.sh             # rebuild schema.sql and check it
```

The first and third start their own throwaway Postgres in `/tmp` and delete
it afterwards. The second needs a local Postgres that is already running.

## `bundles/production-migrations-21-26.sql`

Migrations 21 to 26 joined into one file, so they could be pasted into the
SQL editor in one go when the redesign shipped (2026-10-18). The numbered
files are the source of truth. Do not edit the bundle and do not run it on a
database that already has those migrations unless you have read it.
