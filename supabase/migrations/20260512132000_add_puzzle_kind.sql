-- Split published puzzles into the ranked daily puzzle and the practice pool.

create type public.puzzle_kind as enum (
  'daily',
  'practice'
);

alter table public.puzzles
  add column kind public.puzzle_kind not null default 'practice';

alter table public.puzzles
  drop constraint if exists daily_puzzle_requires_date;

alter table public.puzzles
  add constraint daily_puzzle_requires_date check (
    kind <> 'daily'
    or status <> 'published'
    or puzzle_date is not null
  );

drop index if exists public.puzzles_one_published_per_day_mode;

create unique index puzzles_one_published_daily_per_day
  on public.puzzles (puzzle_date)
  where kind = 'daily' and status = 'published';

create index puzzles_kind_status_mode_idx
  on public.puzzles (kind, status, mode);

create index puzzles_daily_date_idx
  on public.puzzles (puzzle_date desc)
  where kind = 'daily';
