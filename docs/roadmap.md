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
- Supabase player search data for published Supabase puzzles
- draft player import, puzzle generation, and generated-grid import scripts for a Big 5 dataset
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
- Draft player importer: `scripts/import-players.mjs`
- Draft puzzle generator: `scripts/generate-puzzles.mjs`
- Draft generated-grid importer: `scripts/import-generated-grids.mjs`
- Daily publish script: `scripts/publish-daily-puzzles.mjs`

## Current Limitations

- Daily attempts are not yet persisted.
- Leaderboards are not yet shown in the UI.
- The game still validates live answers mostly client-side.
- The player database is prototype data and should not be treated as production-quality.
- Random grid play is not implemented in the app.
- Puzzle generation depends on local ignored source/artifact files under `data/`, so a fresh checkout still needs `data/players_all.json` before it can reproduce the pipeline.
- Generated puzzle candidates have been imported to Supabase as drafts; the next model publishes one ranked daily puzzle per date and uses the rest as practice.
- There is a manual publish script, but not yet an admin review UI or recurring scheduler.
- Supabase player search currently loads display names only; richer player metadata and server-side search can come later.
- Daily vs practice mode is implemented in code, pending application of `supabase/migrations/20260512132000_add_puzzle_kind.sql` in Supabase.
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

Goal: generate candidate grids from football reference data automatically, then publish reviewed candidates to Supabase.

**Status: draft pipeline implemented, not yet productized** — see `docs/puzzle-generation.md` for full details.

Done:

- [x] `scripts/import-players.mjs` — draft importer for a Big 5 `players_all.json` dataset into Supabase.
- [x] `scripts/generate-puzzles.mjs` — draft generator that computes valid cells for all three modes, scores difficulty, and assembles non-overlapping 3x3 grids.
- [x] `scripts/import-generated-grids.mjs` — imports generated candidates into Supabase as draft puzzles with axes, cells, and accepted answers.
- [x] `scripts/publish-daily-puzzles.mjs` — publishes one generated daily puzzle for a selected date.
- [x] `scripts/publish-practice-puzzles.mjs` — publishes generated drafts into the practice pool.
- [x] `useSupabasePlayers` — loads Supabase player names for search when published Supabase puzzles are active.
- [x] Daily/practice home split in the frontend.
- [x] `puzzle_kind` migration prepared for Supabase.
- [x] Imported current generated candidates into Supabase: 722 draft puzzles, 6 498 cells, and 13 110 accepted answers.
- [x] Previously published one generated medium puzzle per mode for 2026-05-12 before the daily/practice split; this should be normalized after the migration is applied.
- [x] `docs/puzzle-generation.md` — documents Clement's current pipeline assumptions, commands, and reported generation results.
- [x] `package.json` commands for player import, puzzle generation, generated-grid import, and daily publishing.

Important current caveats:

- [ ] `data/players_all.json` is required by both scripts, but is intentionally ignored by Git. Each developer needs to obtain it locally before reproducing the pipeline.
- [ ] `data/puzzle-cells.json` and `data/generated-grids.json` are generated artifacts, also ignored by Git.
- [ ] The generator currently reads local JSON, not the active Supabase snapshot. That is fine for a draft, but not yet the database-backed production flow described in the product target.
- [ ] The importer uses snapshot fields, but the entity reuse/snapshot semantics still need review before relying on historical reproducibility.
- [ ] The scripts are wired into `package.json`, but not CI yet.

Remaining tasks:

- [ ] Reconcile difficulty docs with code thresholds and decide the first production calibration.
- [ ] Apply `20260512132000_add_puzzle_kind.sql` to Supabase, then publish the practice pool and one daily puzzle under the new model.
- [ ] Decide whether production generation reads directly from Supabase snapshots or from generated local data files.
- [ ] Improve player search with richer Supabase metadata, ranking, and server-side filtering if the dataset grows.
- [ ] Build admin review UI or a safer scheduling workflow for selecting future daily puzzles.
- [ ] Add a command for scheduled/CI use (GitHub Actions nightly run).
- [ ] Validate generated grids manually before scheduling as daily puzzles.

Suggested owner: data/backend.

Primary files:

- `scripts/generate-puzzles.mjs`
- `scripts/import-players.mjs`
- `data/players_all.json`
- `docs/puzzle-generation.md`
- `supabase/migrations/`

Acceptance criteria:

- A fresh developer checkout can reproduce the pipeline after obtaining the documented source data file.
- Script can generate multiple valid puzzle candidates for all three modes.
- Difficulty scoring distributes grids reasonably across easy/medium/hard.
- Generated puzzles can be pushed to Supabase as draft rows ready for admin review.

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
