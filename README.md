# Foot Grid

Football trivia grid game inspired by Immaculate Grid, focused on European football.

The product goal is a daily football challenge with authenticated users, ranked daily attempts, streaks, leaderboards, and a separate random-grid mode.

## Current Stack

- Next.js + React + TypeScript
- Supabase Auth + Postgres + RLS
- Vitest for game-engine tests
- Static generated JSON as a fallback/prototype data bridge
- Supabase seed scripts for prototype football data

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open:

```txt
http://localhost:3000
```

## Useful Commands

```bash
npm run dev
npm run lint
npm run test
npm run build
npm run verify
npm run generate:data
npm run db:seed:prototype:dry-run
npm run db:seed:prototype
```

## Documentation

- Roadmap: [docs/roadmap.md](docs/roadmap.md)
- Supabase setup: [docs/supabase.md](docs/supabase.md)
- Original prototype notes: [CLAUDE.md](CLAUDE.md)

## Important Security Note

`.env.local` is ignored and must never be committed. If a Supabase service role key is exposed in chat, logs, or screenshots, rotate it in the Supabase dashboard.
