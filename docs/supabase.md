# Supabase Setup

This project is prepared for Supabase, but local secrets are not committed.

## Local environment

Create `.env.local` from `.env.example`:

```bash
cp .env.example .env.local
```

Then fill:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` for trusted scripts and jobs only

## Database

The schema migrations live in:

```txt
supabase/migrations/20260508190000_initial_schema.sql
supabase/migrations/20260508203000_add_data_snapshots.sql
supabase/migrations/20260512132000_add_puzzle_kind.sql
```

Apply them from the Supabase dashboard SQL editor in filename order, or install the Supabase CLI and run them as migrations once the project is linked.

After applying `20260512132000_add_puzzle_kind.sql`, populate the new daily/practice model:

```bash
npm run db:publish:practice
npm run db:publish:daily -- --date 2026-05-12
```

`db:publish:daily` publishes one ranked daily puzzle. Use `--mode club_club`, `--mode club_year`, or `--mode club_nationality` to choose a mode explicitly; otherwise the script rotates by date.

## Data snapshots

Football reference data is versioned through:

- `data_sources`
- `data_snapshots`
- `data_snapshot_id` on countries, clubs, players, career spells, and puzzles

This lets us import prototype data now, then switch to a better provider later without breaking historical puzzles, accepted answers, or leaderboard results.

For development, hard-flushing football data is possible, but it should only be done before real user results matter. In production, prefer creating a new active snapshot and generating future puzzles from it while keeping older snapshots available for historical grids.

## Seed prototype data

The prototype seed script reads:

```txt
src/data/players.generated.json
src/data/puzzles.generated.json
```

It writes a rerunnable prototype snapshot:

```txt
data_sources.slug = prototype-l1-2025-26
data_snapshots.version = v1
```

Preview what it will import without touching Supabase:

```bash
npm run db:seed:prototype:dry-run
```

Write the data to Supabase:

```bash
npm run db:seed:prototype
```

The script uses `SUPABASE_SERVICE_ROLE_KEY`, so run it only locally or from trusted CI. It deletes and recreates only the prototype snapshot data before reseeding.

By default, seeded prototype puzzles use today's date. Override that with:

```bash
PROTOTYPE_PUZZLE_DATE=2026-05-08 npm run db:seed:prototype
```

Development-only hard flush shape:

```sql
truncate table
  accepted_answers,
  puzzle_cells,
  puzzle_axes,
  puzzles,
  career_spells,
  player_nationalities,
  players,
  clubs,
  countries,
  data_snapshots,
  data_sources
restart identity cascade;
```

## Intended backend shape

- Public football reference data is readable through RLS policies.
- User-owned profile/result data is protected with `auth.uid()`.
- Daily ranked attempts should be written through trusted server code, not directly from arbitrary client payloads.
- Data ingestion and puzzle generation should run as scripts/GitHub Actions with the service role key.
