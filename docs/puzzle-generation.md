# Puzzle Generation Pipeline

## Overview

The generation pipeline transforms the player database into ready-to-use 3×3 grids for all three game modes. It runs from local JSON data, outputs candidate grids, and can import those candidates to Supabase as draft puzzles for later review/publishing.

## Files

| File | Role |
|------|------|
| `data/players_all.json` | Source: 2 475 players from the Big 5 leagues (Transfermarkt import) |
| `scripts/import-players.mjs` | Imports `players_all.json` into Supabase (`players`, `clubs`, `countries`, `career_spells`) |
| `scripts/generate-puzzles.mjs` | Generates all valid cells and assembles grids — outputs to `data/` |
| `scripts/import-generated-grids.mjs` | Imports generated grids to Supabase as draft puzzles |
| `data/puzzle-cells.json` | All valid axis pairs with solutions and difficulty (≈3 MB) |
| `data/generated-grids.json` | Assembled 3×3 grids grouped by mode and difficulty (≈1.5 MB) |

## Running the pipeline

```bash
# Step 1 — import player data into Supabase (run once, or --reset to reimport)
node scripts/import-players.mjs
node scripts/import-players.mjs --dry-run   # preview only
node scripts/import-players.mjs --reset     # wipe snapshot and reimport

# Step 2 — generate cells and grids (reads from data/players_all.json)
node scripts/generate-puzzles.mjs
node scripts/generate-puzzles.mjs --dry-run  # print stats, write nothing

# Step 3 — import generated candidates as draft Supabase puzzles
node scripts/import-generated-grids.mjs
node scripts/import-generated-grids.mjs --dry-run
```

## Game modes

| Mode | Rows | Cols | Cell rule |
|------|------|------|-----------|
| `club_club` | 3 clubs | 3 different clubs | Player played for both the row club AND the col club |
| `club_year` | 3 clubs | 3 two-year ranges | Player had a spell at the row club that overlaps the col year range |
| `club_nationality` | 3 clubs | 3 nationalities | Player played for the row club AND holds the col nationality |

Year ranges are non-overlapping 2-year windows: 1994-95, 1996-97, …, 2024-25.

## Axis filtering

To exclude obscure clubs and rare nationalities from grid axes:

- A club must appear in the careers of **≥ 3 players** in the database.
- A nationality must be held by **≥ 5 players** in the database.

With the current Big 5 dataset this yields **569 qualifying clubs** and **78 qualifying nationalities**.

## Difficulty scoring

Each cell gets a difficulty level based on the **best (lowest) fame rank** among its valid solutions.

| Fame rank of best player | Cell difficulty |
|--------------------------|----------------|
| rank ≤ 200 | 1 — stars / top club regulars |
| rank ≤ 1000 | 2 — well-known |
| rank ≤ 2000 | 3 — league regular |
| rank > 2000 | 4 — obscure / squad depth |

**Fame source: `rang_mondial` (Transfermarkt world ranking)** enriched into `players_all.json`. 2 274 out of 2 475 players have a real rank. The 201 unranked players receive fallback ranks after the last real rank, sorted by `valeur_marchande` then career span.

Grid difficulty is derived from its cells:

| Grid difficulty | Rule |
|----------------|------|
| Easy | All 9 cells ≤ difficulty 2 |
| Medium | At least one cell = difficulty 3, none = difficulty 4 |
| Hard | At least one cell = difficulty 4, all cells ≥ difficulty 2 |

## Grid assembly

Grids are assembled greedily from the cell pool. Each (rowAxis, colAxis) pair can only appear in **one grid** — no reuse across grids.

Algorithm:
1. Build adjacency map: `rowAxis → Set<colAxis>` from valid cells.
2. Sort row axes by degree (most connected first).
3. For each triple of row axes (r1, r2, r3): find col axes that connect to all three.
4. Pick three available cols, form a grid, mark all 9 pairs as used.
5. Repeat until no more valid triples can be formed.

## Current generation results (Big 5 snapshot v1)

Thresholds currently used by `scripts/generate-puzzles.mjs`: rank ≤ 200, ≤ 1000, ≤ 2000.

| Mode | Valid cells | Easy grids | Medium grids | Hard grids |
|------|------------|------------|--------------|------------|
| club_club | 10 785 | 2 | 24 | 500 |
| club_year | 2 919 | 7 | 16 | 77 |
| club_nationality | 4 851 | 7 | 19 | 70 |

The current generated set has been imported to Supabase as **722 draft puzzles**, with **6 498 puzzle cells** and **13 110 accepted answers**.

## Known limitations and next steps

1. **Admin review**: generated grids should be reviewed before being scheduled as daily puzzles (see roadmap §6).
2. **Publish/schedule flow**: drafts are in Supabase, but there is not yet a UI or script to publish one for a specific date.
3. **Data coverage**: the current snapshot covers only Big 5 league seasons scraped from Transfermarkt. Historical data (pre-2020) and loan spells may be incomplete.
4. **Year-range mode balance**: the `club_year` mode produces fewer grids because many clubs only appear in a small number of year windows. Expanding the player database (longer history) would improve coverage.
5. **Snapshot semantics**: the player importer still needs a review so future provider imports preserve historical reproducibility cleanly.
