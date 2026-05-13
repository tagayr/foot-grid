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
- ranked daily attempt API routes and daily leaderboard display
- streak leaderboard display
- daily attempt status handling with completed-score/rank display
- daily/practice home split with random practice puzzle loading
- logged-in practice attempt persistence and account practice stats
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

- Ranked daily attempts are persisted for logged-in users.
- A first-pass daily leaderboard is shown for the daily puzzle, with top 10 + current user fallback.
- A first-pass streak leaderboard is shown from `streak_leaderboard`.
- Completed daily attempts now show the user's saved score/rank instead of starting a second ranked replay.
- The game still gives immediate client-side feedback, but ranked completion is recomputed server-side from submitted answers and Supabase accepted answers.
- The player database is prototype data and should not be treated as production-quality.
- Practice history and stats are persisted for logged-in users. Practice selection excludes completed puzzles when fresh puzzles remain, then allows replay with a clear "all done" notice.
- Puzzle generation depends on local ignored source/artifact files under `data/`, so a fresh checkout still needs `data/players_all.json` before it can reproduce the pipeline.
- Generated puzzle candidates have been imported to Supabase as drafts; the next model publishes one ranked daily puzzle per date and uses the rest as practice.
- There is a manual publish script, but not yet an admin review UI or recurring scheduler.
- Supabase player search currently loads display names only; richer player metadata and server-side search can come later.
- Ranked daily and practice attempts are persisted for logged-in users, with server-side score verification. Daily attempts store one final answer row per attempted cell; practice attempts currently store aggregate result fields only.
- Supabase types are manually maintained for now.
- The old `index.html`, `players_raw.json`, and `players_clean.json` still exist as prototype/reference artifacts.

## Work Packages

### 1. Ranked Daily Attempts

Goal: logged-in users can play today's grid once for ranking.

**Status: first pass implemented.**

Tasks:

- [x] Add server-side route handler to create/resume a daily attempt.
- [x] Record `started_at` from the server, not from the client.
- [x] Add final result submission.
- [x] Compute duration on the trusted side.
- [x] Enforce one ranked attempt per user per daily puzzle.
- [x] Move score/found/error computation server-side for ranked completion.
- [x] Persist submitted answers in `daily_attempt_answers`.
- [ ] Store full wrong-guess history if we want more detailed anti-cheat/audit data. Current schema stores one final submitted answer row per attempted cell.
- [x] Add first-pass client states: not started, in progress, completed/already played.
- [ ] Add richer saved in-progress resume with submitted answers if we decide to persist every guess.
- [x] Decide whether answers are submitted one by one or only at the end. First pass submits only at the end.

Suggested owner: backend/game logic.

Primary files:

- `src/app/api/`
- `src/hooks/useGame.ts`
- `src/game/scoring.ts`
- `supabase/migrations/`

Acceptance criteria:

- A logged-in user can complete today's grid and create a `daily_attempts` row.
- Refreshing the page does not allow a second ranked submission.
- A completed daily attempt shows saved score/rank and the leaderboard.
- Anonymous users can still play locally, but cannot submit to ranked leaderboard.

### 2. Leaderboards

Goal: users can see today's ranking and streak rankings.

**Status: first pass daily and streak leaderboards implemented.**

Tasks:

- [x] Fetch `daily_leaderboard` for today's puzzle.
- [x] Fetch `streak_leaderboard`.
- [x] Add daily leaderboard UI section.
- [x] Add "my rank" treatment for completed daily result.
- [x] Add highlighted "my rank" treatment inside the leaderboard list.
- [x] Decide first-pass pagination/top-N display: top 10 + current user's row when outside top 10.
- [x] Add empty/loading/error states.
- [ ] Add full pagination or infinite scroll if leaderboard volume warrants it.

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

- [x] Add profile editing: username, display name.
- [x] Add user's recent daily results.
- [x] Add streak display.
- [x] Add practice aggregate stats.
- [x] Add richer practice stats: recent results, min/max duration, per-mode best score, completion percentage.
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

### 4. Practice Mode

Goal: a user can play random practice grids separately from the ranked daily challenge.

**Status: first pass implemented.**

Tasks:

- [x] Add home/menu split: "Daily puzzle" and "Practice".
- [x] Add mode picker for practice: club x club, club x year, club x nationality.
- [x] Select practice grids from the pre-generated published practice pool.
- [x] Exclude puzzles the logged-in user has already completed while fresh puzzles remain.
- [x] Allow replay with a "tout est terminé" state when every puzzle in a practice mode is complete.
- [x] Add practice stats: puzzles played, average correct answers, average duration, per mode.
- [x] Store optional `random_attempts`.
- [x] Add richer practice stats: min/max duration, recent practice results, per-mode best score, completion percentage.
- [ ] Add practice trend/history views.
- [x] Keep practice play from affecting daily leaderboard/streaks.

Suggested owner: frontend/game loop.

Primary files:

- `src/components/game/ModePicker.tsx`
- `src/hooks/useGame.ts`
- `src/lib/puzzles/`
- `supabase/migrations/`

Acceptance criteria:

- Daily and random modes are clearly separated.
- Logged-in practice completions create `random_attempts` rows.
- Logged-in practice selection prefers uncompleted puzzles, then falls back to replay.
- Account space shows aggregate practice stats.
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
- [x] Published one generated daily puzzle and the generated practice pool under the daily/practice model.
- [x] `docs/puzzle-generation.md` — documents Clement's current pipeline assumptions, commands, and reported generation results.
- [x] `package.json` commands for player import, puzzle generation, generated-grid import, and daily publishing.

Database enrichment status:

- [x] `data/database_5leagues_2025-26.json` committed to the repo — 2 475 players from the Big 5 leagues (2025-26 season), enriched with: `rang_mondial`, `valeur_marchande`, `position`, `position_detail`, `pied`, `taille`, `age`, `date_naissance`, `ville_naissance`, `pays_naissance`, `trophees`, `nb_clubs_carriere`.
- [x] Difficulty scoring now uses `rang_mondial` (Transfermarkt world ranking) as primary source, with `valeur_marchande` + career span as fallback for the 201 unranked players.
- [x] Difficulty thresholds calibrated on the real ranking distribution: level 1 ≤ 200, level 2 ≤ 1 000, level 3 ≤ 2 000.
- [x] Player dominance filter: grids where a single player solves more than 3 of 9 cells are rejected.

Current generation results with enriched database:

| Mode | Valid cells | Easy | Medium | Hard |
|------|------------|------|--------|------|
| club_club | 10 785 | 2 | 24 | 500 |
| club_year | 2 919 | 7 | 16 | 77 |
| club_nationality | 4 851 | 7 | 19 | 70 |

Important current caveats:

- [ ] `data/players_all.json` is still required by both scripts and is intentionally ignored by Git. Use `data/database_5leagues_2025-26.json` as the canonical source going forward — scripts need updating to point to this file.
- [ ] `data/puzzle-cells.json` and `data/generated-grids.json` are generated artifacts, also ignored by Git.
- [ ] The generator currently reads local JSON, not the active Supabase snapshot. That is fine for a draft, but not yet the database-backed production flow described in the product target.
- [ ] The importer uses snapshot fields, but the entity reuse/snapshot semantics still need review before relying on historical reproducibility.
- [ ] The scripts are wired into `package.json`, but not CI yet.

Remaining tasks:

- [ ] **Update pipeline scripts** to read from `data/database_5leagues_2025-26.json` instead of `data/players_all.json`.
- [ ] **Curate axis lists**: define a whitelist of "premium" clubs and nationalities to use as grid axes — ensures grids always feature recognizable names (e.g. no lower-division clubs as row/col headers). Target: top ~100 clubs by European recognition.
- [ ] **Manual grid curation**: review generated easy/medium grids before publishing — validate that all 9 cells have recognizable answers, no cell is trivially obvious, and the overall grid is satisfying to play.
- [ ] **Grid rotation planning**: with ~35 easy+medium grids per mode, establish a rotation schedule (e.g. 3 modes × weekly rotation = ~10 weeks of variety). Growing the database (historical data, more seasons) will increase this pool.
- [ ] **Expand historical coverage**: add career data from past seasons (2015–2024) to increase intersection density — more historical data = more easy/medium grids and richer solutions per cell.
- [ ] **Improve player search**: surface `rang_mondial` and `position` in search results to help players confirm they have the right person.
- [ ] **Build admin review UI** or a safer scheduling workflow for selecting future daily puzzles.
- [ ] **Add CI command** for scheduled/automated generation (GitHub Actions nightly run).

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

Already shipped:
1. ~~Ranked daily attempts~~ ✓
2. ~~Daily leaderboard UI~~ ✓
3. ~~User space profile/results~~ ✓
4. ~~Practice mode (random grids)~~ ✓
5. ~~Puzzle generation pipeline (draft)~~ ✓
6. ~~Big 5 database enrichment (rang_mondial, valeur_marchande, position)~~ ✓

Next priorities:
1. **Curate axis whitelist** — define the ~100 clubs and ~30 nationalities allowed as grid headers
2. **Manual grid review** — play-test and approve easy/medium grids before scheduling
3. **Grid rotation calendar** — plan daily puzzle schedule across modes and difficulty levels
4. **Expand historical data** — add career data from 2015–2024 to increase easy/medium grid count
5. Admin review UI — in-browser tool to approve/reject/schedule draft puzzles
6. Data provider strategy — sustainable long-term data source with incremental updates
7. PWA/mobile packaging

Testing/CI can be started in parallel at any time.

## Parallel Work Plan

If two people are working together:

- Person A: axis whitelist + grid curation + rotation calendar.
- Person B: admin review UI + scheduling workflow.

Then:

- Person A: historical data expansion + pipeline automation.
- Person B: PWA manifest + mobile audit.

## Security Notes

- Never commit `.env.local`.
- The publishable Supabase key is safe in browser code.
- The service role key bypasses RLS and must only be used in trusted scripts/server code.
- If the service role key appears in chat, screenshots, logs, or a public issue, rotate it.
