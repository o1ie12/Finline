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
- [x] One question per screen, checked at once (`POST /api/task/check`,
      `lib/tasks/check.ts`). Desktop: document left, question panel right,
      number keys and Enter. Phone: document above, panel at the thumb.
- [x] The brief is one line; 想一想 is the first screen.
- [x] Sorting by tapping (one card, the boxes as buttons).
- [x] 我有把握 / 我是猜的 as the two check buttons; stored with the result
      (`TaskResult.confidence`, JSON, no migration).
- [x] Feedback says what was right first; full 解析 behind one link.
- [x] The end of a module is one card.
- Flag: `NEXT_PUBLIC_PLAYER` (lib/flags.ts `PLAYER_V3`, default on; =0 is
  the earlier one-page workspace).

Phase 2, first visit:
- [x] The first module of every course plays without an account; sign-up
      then saves what was done.
- [x] A shorter landing that opens on a real question.

Phase 3, coming back:
- [x] 錯題夾: missed questions return after 2 to 3 days, confident misses first.
- [x] A weekly goal (no daily streak, no guilt copy).
- [x] A card to save when a course is finished.

Phase 4 (done): the older pages already share the shell; their wording now says
課 and 單元, and the completion record is redrawn around the card.

Not doing: leaderboards, timers, hearts or energy, push notifications, an
AI tutor. Class mode stays on hold.

## Decisions

- Checking a question returns its answer, so a student could probe the
  endpoint before choosing. Accepted for a free course; grades are still
  computed from the final submission exactly as before.
- No migrations: confidence and the review queue read `task_results.result`.
- A module played before sign-up is scored against the visitor's own draw
  when it is replayed after sign-up (`guest: true` on `POST /api/task`), so
  a drawn step (你是銀行) is judged on the files the visitor saw.
- 錯題夾 is a new attempt with the other answers carried (the 06 G1 redo),
  not a separate practice mode: nothing new to store, and the grade book's
  best score rises when a miss is fixed. A step drawn per attempt is always
  asked again, never carried.
- The weekly goal is the student's own choice of 1, 2, 3 or 5 modules
  (`profile.weeklyGoal`, default 2). It counts different modules worked on
  since Monday in Asia/Taipei. There is no streak and no copy about losing one.
- The card for a finished course shows the course's objectives and a
  nickname that can be left off. It is drawn on a canvas in the browser.

## Verified (2026-11-13, headless, 390 and 1440 wide, file store)

- Guest: landing → first module with no account → sign-up → the result is in 成績.
- 錯題夾: four misses listed, redo asks those four, back to the folder.
- A whole course (two modules and the older career simulation) → 完成紀錄 →
  the image saves; the card fits a phone.
- `npm run check` (208 tests, contract, content, contrast, design), lint,
  `check:names`, one production build.

Not verified: real Supabase (the runs used the file store), Safari on a real
phone, and the share sheet on a touch device (the image download was tested).
