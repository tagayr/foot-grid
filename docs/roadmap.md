# Foot Grid Roadmap

This document captures the current state of the project and the next work packages. The goal is to make tasks separable so two people can work in parallel without constantly stepping on the same files.

## Product Target

Foot Grid should become a daily football trivia game with:

- authenticated user accounts
- one ranked daily grid
- random unranked or lightly ranked grids
- leaderboards for today's grid, streaks, and all-time performance
- automatically generated puzzles from database-backed football data
- reproducible historical puzzles even after data provider changes
- mobile-first web UX and a future mobile app wrapper

## Current State

The project has moved beyond the original single-file prototype.

Implemented:

- Next.js + TypeScript app shell
- React component split for the game UI
- `useGame` hook for local game state
- local generated players/puzzles as fallback data
- Supabase Auth client integration
- login/signup/account panel
- Supabase schema migrations
- data source and data snapshot model
- prototype Supabase seed script
- published-puzzle loader from Supabase with local fallback
- basic tests for validation, search, and scoring

Important files:

- App shell: `src/components/FootGridApp.tsx`
- Game logic: `src/game/`
- Game UI components: `src/components/game/`
- Auth UI/provider: `src/components/auth/`
- Supabase clients/types: `src/lib/supabase/`
- Supabase puzzle loader: `src/lib/puzzles/`
- Supabase migrations: `supabase/migrations/`
- Prototype seed script: `scripts/seed-prototype-supabase.mjs`

## Current Limitations

- Daily attempts are not yet persisted.
- Leaderboards are not yet shown in the UI.
- The game still validates live answers mostly client-side.
- The player database is prototype data and should not be treated as production-quality.
- Random grid generation is not implemented.
- Puzzle generation is currently manual/prototype, not an automated quality-scored pipeline.
- Supabase types are manually maintained for now.
- The old `index.html`, `players_raw.json`, and `players_clean.json` still exist as prototype/reference artifacts.

## Work Packages

### 1. Ranked Daily Attempts

Goal: logged-in users can play today's grid once for ranking.

Tasks:

- Add server-side action or route handler to create/resume a daily attempt.
- Record `started_at` from the server, not from the client.
- Add final result submission.
- Compute score and duration on the trusted side.
- Enforce one ranked attempt per user per daily puzzle.
- Add client states: not started, in progress, completed, already played.
- Decide whether answers are submitted one by one or only at the end.

Suggested owner: backend/game logic.

Primary files:

- `src/app/api/`
- `src/hooks/useGame.ts`
- `src/game/scoring.ts`
- `supabase/migrations/`

Acceptance criteria:

- A logged-in user can complete today's grid and create a `daily_attempts` row.
- Refreshing the page does not allow a second ranked submission.
- Anonymous users can still play locally, but cannot submit to ranked leaderboard.

### 2. Leaderboards

Goal: users can see today's ranking and streak rankings.

Tasks:

- Fetch `daily_leaderboard` for today's puzzle.
- Fetch `streak_leaderboard`.
- Add leaderboard UI sections.
- Add "my rank" treatment.
- Decide pagination or top-N display.
- Add empty/loading/error states.

Suggested owner: frontend/product UI.

Primary files:

- `src/components/leaderboard/`
- `src/lib/supabase/`
- `src/lib/puzzles/`

Acceptance criteria:

- Today's leaderboard displays score, time, found count, and display name.
- Streak leaderboard displays current and best streaks.
- UI is readable on mobile.

### 3. User Space

Goal: the account panel becomes a real user area.

Tasks:

- Add profile editing: username, display name.
- Add user's recent daily results.
- Add streak display.
- Add account state for email confirmation and logged-out view.
- Add RLS-safe update policies if needed.

Suggested owner: frontend/auth.

Primary files:

- `src/components/auth/`
- `src/components/account/`
- `supabase/migrations/`

Acceptance criteria:

- User can update display name/username.
- User can see their own history.
- Profile data survives logout/login.

### 4. Random Grid Mode

Goal: a user can play a random grid separately from the ranked daily challenge.

Tasks:

- Add home/menu split: "Play today's grid" and "Random grid".
- Add mode picker for random: club x club, club x year, club x nationality, surprise me.
- Decide whether random grids are generated on demand or selected from a pre-generated pool.
- Store optional `random_attempts`.
- Keep random play from affecting daily streaks.

Suggested owner: frontend/game loop.

Primary files:

- `src/components/game/ModePicker.tsx`
- `src/hooks/useGame.ts`
- `src/lib/puzzles/`
- `supabase/migrations/`

Acceptance criteria:

- Daily and random modes are clearly separated.
- Random play does not pollute daily leaderboard.
- Random grid has at least one valid answer per cell.

### 5. Puzzle Generation Pipeline

Goal: generate candidate grids from the database automatically.

Tasks:

- Build script that reads active snapshot data.
- Generate candidate axes by mode.
- Compute accepted answers for each cell.
- Reject cells with zero answers.
- Reject grids that are too easy, too hard, or repetitive.
- Calculate difficulty score.
- Write candidate puzzles as `draft` or `scheduled`.
- Add a command for local generation and future GitHub Actions use.

Suggested owner: data/backend.

Primary files:

- `scripts/`
- `src/game/validation.ts`
- `supabase/migrations/`

Acceptance criteria:

- Script can generate multiple valid puzzle candidates.
- Generated puzzle rows have axes, cells, and accepted answers.
- Candidate quality metrics are visible in logs.

### 6. Admin Review Workflow

Goal: daily puzzles can be reviewed before publication.

Tasks:

- Add admin-only route or local script to list draft puzzles.
- Show difficulty, answer counts, and featured answers.
- Publish/schedule one puzzle for a date.
- Add admin authorization strategy.

Suggested owner: backend/admin UI.

Primary files:

- `src/app/admin/`
- `src/lib/supabase/admin.server.ts`
- `supabase/migrations/`

Acceptance criteria:

- Admin can review candidate grids.
- Admin can publish a grid for a date/mode.
- Non-admin users cannot access admin actions.

### 7. Data Provider Strategy

Goal: replace prototype data with a maintainable provider-backed dataset.

Tasks:

- Evaluate providers specifically for player career spells, loans, seasons, and nationalities.
- Compare Sportmonks, Wikidata, API-Football, and other football APIs.
- Document data rights and pricing.
- Create provider adapter interface.
- Import into a new `data_snapshots` row instead of overwriting old data.
- Keep old snapshots for historical puzzles.

Suggested owner: data/research.

Primary files:

- `docs/data-sources.md`
- `scripts/`
- `supabase/migrations/`

Acceptance criteria:

- Provider choice is documented.
- Importer can create a new snapshot.
- Puzzles can be generated from a chosen snapshot.

### 8. Mobile Readiness

Goal: keep the web app ready for PWA and future app-store wrappers.

Tasks:

- Audit mobile layout for all game/account/leaderboard states.
- Add PWA manifest and icons.
- Add touch-friendly loading/error states.
- Avoid auth redirect flows that break in WebViews.
- Later evaluate Capacitor for iOS/Android packaging.

Suggested owner: frontend/mobile UX.

Primary files:

- `src/app/`
- `src/components/`
- `public/`

Acceptance criteria:

- All core flows work on mobile viewport.
- App can be installed as a PWA.
- Auth flow works on mobile browser.

### 9. Testing And CI

Goal: stop regressions before they reach `main`.

Tasks:

- Add GitHub Actions for `npm run verify`.
- Add tests for Supabase puzzle adapter.
- Add tests for scoring edge cases.
- Add Playwright smoke tests for mode selection and auth panel.
- Add seed script dry-run to CI.

Suggested owner: infra/testing.

Primary files:

- `.github/workflows/`
- `tests/`

Acceptance criteria:

- Pull requests run typecheck, tests, and build.
- Core game flow has at least one browser-level smoke test.

## Suggested Execution Order

1. Ranked daily attempts
2. Daily leaderboard UI
3. User space profile/results
4. Random grid mode
5. Puzzle generation pipeline
6. Admin review workflow
7. Data provider replacement
8. PWA/mobile packaging

Testing/CI can be started in parallel at any time.

## Parallel Work Plan

If two people are working together:

- Person A: daily attempts, backend submission, leaderboard queries.
- Person B: leaderboard/account UI, mobile layout, UX states.

Then:

- Person A: puzzle generation and data importer.
- Person B: random mode and admin review UI.

## Security Notes

- Never commit `.env.local`.
- The publishable Supabase key is safe in browser code.
- The service role key bypasses RLS and must only be used in trusted scripts/server code.
- If the service role key appears in chat, screenshots, logs, or a public issue, rotate it.
