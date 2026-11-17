# Where the redesign stands (2026-10-18, second session)

All review findings are fixed and committed except the items below.
`npm run check`: 130 tests pass, contract ALL PASS, content 0 errors. tsc clean.

## Must happen before any push or deploy
1. The branch history still contains organisation names in two early
   commits (lib/tasks/validate.ts, tests/tasks.test.ts). The current files
   are clean (hashed list). Either approve a history rewrite of this
   branch, or publish a squashed copy.
2. Apply migrations 21-26 to production first (order and safety in
   plan.md §10). The new pages read the new tables.

## Not verified this session (kept the machine light)
- `next build` (last passed before the review fixes; only TypeScript
  changes since, all typechecked).
- Browser runs: tests/e2e scripts (keyboard-only, hidden tab), 360/1440
  screenshots, reduced motion, 6x CPU throttle.
- Lighthouse (an earlier run under heavy load: accessibility 100,
  performance 69 with the first-visit tour as the LCP element).

## Small follow-ups
- On phones, move the SMART ticks card up next to the amount fields on
  /onboarding/goal.
- Tests for submitTask itself (it imports server-only code; needs a
  dev-store harness).
