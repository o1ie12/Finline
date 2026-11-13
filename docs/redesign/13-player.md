# 13: the module player and the return loop (2026-11-13)

Working notes for the pass that follows 12-curriculum.md. Research and the
walk-through (phone and desktop) are summarised in the session; the plan the
owner approved ("apply changes") is below. Tick items as they land.

## What was wrong (walk-through, 390 and 1440 wide)

- A module opened on a screen of briefing; the first tappable thing was
  below the fold on a phone and at about y=700 on a 1440x900 desktop.
- Document and questions were stacked (phone) or both pushed below the
  brief (desktop): read, scroll, answer, scroll back.
- Sorting 8 cards = 8 dropdowns; drag as the other way in.
- Answer everything, then one long results page (about three phone screens).
- Nothing brought a student back: no memory of mistakes, no finish moment.
- Older pages (the 12 original simulations, 完成紀錄, 工具箱, 護照, 轉乘站)
  kept other widths and the 站 wording.

## Plan

Phase 1, the module (`components/player/`):
- [ ] One question per screen, checked at once (`POST /api/task/check`,
      `lib/tasks/check.ts`). Desktop: document left, question panel right,
      number keys and Enter. Phone: document above, panel at the thumb.
- [ ] The brief is one line; 想一想 is the first screen.
- [ ] Sorting by tapping (one card, the boxes as buttons).
- [ ] 我有把握 / 我是猜的 as the two check buttons; stored with the result
      (`TaskResult.confidence`, JSON, no migration).
- [ ] Feedback says what was right first; full 解析 behind one link.
- [ ] The end of a module is one card.
- Flag: `NEXT_PUBLIC_PLAYER` (lib/flags.ts `PLAYER_V3`, default on; =0 is
  the earlier one-page workspace).

Phase 2, first visit:
- [ ] The first module of every course plays without an account; sign-up
      then saves what was done.
- [ ] A shorter landing that opens on a real question.

Phase 3, coming back:
- [ ] 錯題夾: missed questions return after 2 to 3 days, confident misses first.
- [ ] A weekly goal (no daily streak, no guilt copy).
- [ ] A card to save when a course is finished.

Phase 4: the older pages on the same widths, buttons and course wording.

Not doing: leaderboards, timers, hearts or energy, push notifications, an
AI tutor. Class mode stays on hold.

## Decisions

- Checking a question returns its answer, so a student could probe the
  endpoint before choosing. Accepted for a free course; grades are still
  computed from the final submission exactly as before.
- No migrations: confidence and the review queue read `task_results.result`.
