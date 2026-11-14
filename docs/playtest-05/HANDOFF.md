# Handoff: finish the 05 playtest fixes and push to main

Paste this whole file into the new session as the first message.

## Where things stand

- **Repo:** github.com/o1ie12/finance_learn_tw (public). Vercel deploys `main` to production automatically.
- **Branch:** `fix/playtest-05`. It has 13 commits on top of `main` (326df7a); the newest is `add8a21`. `main` has not moved, so the push is a fast-forward.
- **Done and committed:**
  - Parts A, B and C of the 05 Fix Order.
  - The follow-ups Ryan and Oliver asked for:
    - the 省 streak cap (+5 a month, at most +15, reset by 普通 or 享受), with tests
    - seven article facts fixed against official sources
    - a 信用線 end-to-end walk with a failed attempt, a retry and a pass (12 of 12 checks passed)
    - a partner-name scan (0 hits)
    - the report at `docs/playtest-05/report.md`
- **`npm run check`:** passed (144 tests, contract check, content check with 0 errors).
- **Part D (design reboot):** do NOT start. Ryan and Oliver will pick after seeing 3 mocked directions.

If `fix/playtest-05` is not on GitHub yet, stop and ask the user to push it from their Mac first:

```bash
git push -u origin fix/playtest-05
```

## What is left (do these in order)

1. **Set up:** check out `fix/playtest-05`, run `npm ci`, then `npx playwright install --with-deps chromium`.

2. **Start a dev server on the local file store.** Never let it use a real database. Leaving both Supabase variables empty forces the file store:

   ```bash
   USE_DEV_STORE=1 SUPABASE_URL= SUPABASE_SERVICE_ROLE_KEY= npx next dev -p 3210
   ```

3. **Run the screen check at both sizes.** Every screen must report `fits`, with 0 page errors.

   ```bash
   BASE_URL=http://localhost:3210 npm run check:screens
   VIEWPORT=1440x900 BASE_URL=http://localhost:3210 npm run check:screens
   ```

4. **Re-run the 信用線 walk once more** as a sanity check (12 checks, all ok):

   ```bash
   npx tsx tests/e2e/xinyong-key.ts /tmp/xinyong-key.json
   BASE_URL=http://localhost:3210 node tests/e2e/xinyong-retry.mjs /tmp/xinyong-key.json
   ```

5. **Run `npm run check` once more.** It must show 0 failures and ALL PASS. Then stop the dev server.

6. **If anything fails:** fix it, commit, and re-run the checks. Do not push a failing branch.

7. **Update `docs/playtest-05/report.md`:**
   - The header line says 「Not pushed yet」. Change it to say it was pushed to `main` with Ryan's approval.
   - The 「Final checks before the push」 line in section 10 should list the check:screens results (screens per size, 0 scroll, 0 errors) and the walk result.
   - Commit (see the commit rules below).

8. **Push to `main`.** Ryan approved this push, and the user relayed it:

   ```bash
   git push origin fix/playtest-05:main
   ```

   Before pushing, confirm `origin/main` is still `326df7a`, or at least an ancestor of the branch. If `main` moved, stop and tell the user. Never force-push.

9. **Confirm the deploy.** Find the Vercel status on the pushed commit:

   ```bash
   gh api repos/o1ie12/finance_learn_tw/commits/<sha>/status
   gh api repos/o1ie12/finance_learn_tw/commits/<sha>/check-runs
   ```

   When it reports success, tell the user the commit hash, so the live site can be playtested. If the deploy fails, report the error. Do not push fixes blindly.

## Hard rules

- **Never run anything against production:** no production database, no test accounts on the live site. Test students are created only on the local dev server.
- **No partner organisation names** anywhere: code, comments, content, commit messages. The repo is public. `lib/tasks/validate.ts` has `DENY_HASHES` (names stored as SHA-256) and `containsDeniedName()`. Run it over anything you change. A 3-letter name also matches inside words like `isFinite`, so treat a hit inside a longer ASCII word as a false positive.
- **Never push the branch `redesign/finline-life`,** or anything built from it. Its old commits contain partner names. It only exists on the user's Mac anyway.
- **Copy rules:** no em dashes (— or ——) in any student-facing text. Traditional Chinese for Taiwan, short plain sentences.
- **Next.js:** this is Next.js 16 with breaking changes. Read the relevant guide in `node_modules/next/dist/docs/` before changing framework code.
- **Commit messages:** end with:

  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  ```

- **From now on, once real students use the site:** push a branch first and test the Vercel preview before merging to `main`. This push straight to `main` is a one-time exception, because `main` is still the test site.

## One thing to raise with the user before pushing

An old project note says production had 38 rows in `students` on 2026-09-24. The user says there are no real students yet. Those rows may be test accounts. Mention it in one line before step 8 so the user can confirm. Do not query production to find out.

## Useful context

- **Key code:**
  - Life game: `lib/lifeGame/`. The turn phases are payday → saveFirst → bills → lifestyle → actions → event → ledger.
  - Task engine: `lib/tasks/`, `components/tasks/StationFlow.tsx`.
  - Content: `content/lines/*.ts`, plus the wrapped-station copy in `content/stations.ts`.
  - Articles: `components/lessons/Module<N>.tsx`. Quizzes: `lib/modules.ts`. Pre/post test: `lib/prePostQuestions.ts`.
- **Checks:**
  - `npm run check` = tests (`tsx --test tests/*.test.ts`) + `scripts/check-sim-contract.ts` + `scripts/check-content.ts`.
  - `npm run check:screens` = `scripts/check-screens.mjs`. It needs a running dev server and refuses any URL that isn't localhost.
- **No migrations are needed** for any 05 change.
- **The local `docs/redesign/` folder** (decisions-log.md, next-steps.md) is untracked and not part of this work. Leave it out of commits.

## Open questions still waiting on Ryan and Oliver (from the report, section 7)

1. Part D design direction (after the 3 mocks).
2. Which school office handles 學生團保 (Module 33). No official source was found, so it was left as is.
3. 學生團保 coverage: Module 33 and pre/post question `pp-baoxian-6` call it 「多為意外傷害醫療」. According to 國教署, high-school 團保 has been policy insurance under its own law since 109/8/1 and also covers illness. Not changed yet.
4. Whether the 1.5-month 房仲費 cap, sourced from a 監察院 quote of the 內政部 standard, needs confirming on the ministry's own site.

Do not act on these unless the user answers them.
