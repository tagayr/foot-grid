/**
 * Puzzle generator — computes all valid grid cells for each mode and assembles grids.
 *
 * Usage:
 *   node scripts/generate-puzzles.mjs              # compute + assemble, write to data/
 *   node scripts/generate-puzzles.mjs --dry-run    # print stats only
 *
 * Output:
 *   data/puzzle-cells.json   — all valid (axisA × axisB) pairs with solutions + difficulty
 *   data/generated-grids.json — assembled 3×3 grids by mode and difficulty
 *
 * Fame proxy: total career seasons (sum of spell durations). Rank 1 = longest career.
 * Replace with real market-value data when available for better difficulty calibration.
 */

import { readFile, writeFile } from "node:fs/promises";

// ─── Config ────────────────────────────────────────────────────────────────────

const DATA_FILE = "data/players_all.json";
const CELLS_OUTPUT = "data/puzzle-cells.json";
const GRIDS_OUTPUT = "data/generated-grids.json";
const DRY_RUN = process.argv.includes("--dry-run");
const CURRENT_YEAR = 2026;

// 2-year windows from 1994 to 2024
const YEAR_RANGES = [];
for (let y = 1994; y <= 2024; y += 2) {
  YEAR_RANGES.push({ start: y, end: y + 1, label: `${y}-${String(y + 1).slice(2)}` });
}

// Difficulty thresholds based on Transfermarkt rang_mondial.
// Calibrated on the Big 5 dataset (2274 ranked players, ranks up to ~7000+):
//   top 5%  ≈ rank ≤ 100  → level 1 (stars recognizable by any fan)
//   top 20% ≈ rank ≤ 500  → level 2 (well-known in their league)
//   top 33% ≈ rank ≤ 1000 → level 3 (regular starters)
//   beyond             → level 4 (obscure / squad depth)
const FAME_THRESHOLDS = { 1: 100, 2: 500, 3: 1000 };

// Axis filters: skip axes with too few players (avoids obscure clubs)
const MIN_PLAYERS_PER_CLUB = 3;
const MIN_PLAYERS_PER_NAT = 5;

// Grid difficulty rules
//   easy   → all cells ≤ 2
//   medium → max cell = 3, no cell = 4
//   hard   → at least one cell = 4, no cell = 1
const MAX_GRIDS_PER_DIFFICULTY = 500; // cap per (mode, difficulty) to bound runtime

// ─── Main ─────────────────────────────────────────────────────────────────────

const players = JSON.parse(await readFile(DATA_FILE, "utf8"));
console.log(`Loaded ${players.length} players`);

const fameRanks = computeFameRanks(players);

const allCells = {
  club_club: computeClubClub(players, fameRanks),
  club_year: computeClubYear(players, fameRanks),
  club_nationality: computeClubNationality(players, fameRanks),
};

for (const [mode, cells] of Object.entries(allCells)) {
  console.log(`[${mode}] ${cells.size} valid cells`);
}

if (DRY_RUN) {
  console.log("\nDry run — nothing written.");
  process.exit(0);
}

// Save cells
const cellsExport = {};
for (const [mode, cells] of Object.entries(allCells)) {
  cellsExport[mode] = [...cells.values()];
}
await writeFile(CELLS_OUTPUT, JSON.stringify(cellsExport, null, 2));
console.log(`\nCells written to ${CELLS_OUTPUT}`);

// Assemble grids
const gridsExport = {};
for (const [mode, cells] of Object.entries(allCells)) {
  process.stdout.write(`Assembling grids for ${mode}... `);
  const grids = assembleGrids(mode, cells);
  gridsExport[mode] = categorizeGrids(grids);
  const { easy, medium, hard } = gridsExport[mode];
  console.log(`easy=${easy.length} medium=${medium.length} hard=${hard.length}`);
}

await writeFile(GRIDS_OUTPUT, JSON.stringify(gridsExport, null, 2));
console.log(`Grids written to ${GRIDS_OUTPUT}`);

// ─── Fame ranking ──────────────────────────────────────────────────────────────

function computeFameRanks(players) {
  // Primary: rang_mondial (Transfermarkt world ranking).
  // Fallback for unranked players: valeur_marchande, then career span.
  const fameRanks = new Map();
  const withRank = players.filter((p) => p.rang_mondial != null);
  const withoutRank = players.filter((p) => p.rang_mondial == null);

  for (const p of withRank) fameRanks.set(p.id, p.rang_mondial);

  const maxRealRank = withRank.length ? Math.max(...withRank.map((p) => p.rang_mondial)) : 0;
  withoutRank
    .map((p) => ({
      id: p.id,
      score: p.valeur_marchande ?? p.carriere.reduce(
        (sum, s) => sum + (s.annee_fin ?? CURRENT_YEAR) - s.annee_debut, 0
      ),
    }))
    .sort((a, b) => b.score - a.score)
    .forEach(({ id }, i) => fameRanks.set(id, maxRealRank + i + 1));

  return fameRanks;
}

function cellDifficulty(solutions, fameRanks) {
  const bestRank = Math.min(...solutions.map((id) => fameRanks.get(id) ?? Infinity));
  if (bestRank <= FAME_THRESHOLDS[1]) return 1;
  if (bestRank <= FAME_THRESHOLDS[2]) return 2;
  if (bestRank <= FAME_THRESHOLDS[3]) return 3;
  return 4;
}

// ─── Intersection computation ──────────────────────────────────────────────────

function computeClubClub(players, fameRanks) {
  const map = new Map(); // "clubA|||clubB" → { rowAxis, colAxis, solutions[], difficulty }

  for (const player of players) {
    const clubs = [...new Set(player.carriere.map((c) => c.club))];
    for (let i = 0; i < clubs.length; i++) {
      for (let j = i + 1; j < clubs.length; j++) {
        const [a, b] = [clubs[i], clubs[j]].sort();
        const key = `${a}|||${b}`;
        if (!map.has(key)) map.set(key, { rowAxis: a, colAxis: b, solutions: [] });
        map.get(key).solutions.push(player.id);
      }
    }
  }

  // Filter and add difficulty
  const clubCounts = countPlayersPerClub(players);
  const filtered = new Map();
  for (const [key, cell] of map) {
    if (
      (clubCounts.get(cell.rowAxis) ?? 0) >= MIN_PLAYERS_PER_CLUB &&
      (clubCounts.get(cell.colAxis) ?? 0) >= MIN_PLAYERS_PER_CLUB
    ) {
      filtered.set(key, { ...cell, difficulty: cellDifficulty(cell.solutions, fameRanks) });
    }
  }
  return filtered;
}

function computeClubYear(players, fameRanks) {
  const map = new Map(); // "club|||YYYY-YY" → cell

  for (const player of players) {
    for (const spell of player.carriere) {
      const spellEnd = spell.annee_fin ?? CURRENT_YEAR;
      for (const range of YEAR_RANGES) {
        // Overlap: spell includes at least part of the 2-year window
        if (spell.annee_debut <= range.end && spellEnd > range.start) {
          const key = `${spell.club}|||${range.label}`;
          if (!map.has(key)) map.set(key, { rowAxis: spell.club, colAxis: range.label, solutions: [] });
          map.get(key).solutions.push(player.id);
        }
      }
    }
  }

  const clubCounts = countPlayersPerClub(players);
  const filtered = new Map();
  for (const [key, cell] of map) {
    if ((clubCounts.get(cell.rowAxis) ?? 0) >= MIN_PLAYERS_PER_CLUB) {
      filtered.set(key, { ...cell, difficulty: cellDifficulty(cell.solutions, fameRanks) });
    }
  }
  return filtered;
}

function computeClubNationality(players, fameRanks) {
  const map = new Map(); // "club|||nationality" → cell

  for (const player of players) {
    const clubs = [...new Set(player.carriere.map((c) => c.club))];
    for (const club of clubs) {
      for (const nat of player.nationalites) {
        const key = `${club}|||${nat}`;
        if (!map.has(key)) map.set(key, { rowAxis: club, colAxis: nat, solutions: [] });
        map.get(key).solutions.push(player.id);
      }
    }
  }

  const clubCounts = countPlayersPerClub(players);
  const natCounts = countPlayersPerNat(players);
  const filtered = new Map();
  for (const [key, cell] of map) {
    if (
      (clubCounts.get(cell.rowAxis) ?? 0) >= MIN_PLAYERS_PER_CLUB &&
      (natCounts.get(cell.colAxis) ?? 0) >= MIN_PLAYERS_PER_NAT
    ) {
      filtered.set(key, { ...cell, difficulty: cellDifficulty(cell.solutions, fameRanks) });
    }
  }
  return filtered;
}

// ─── Grid assembly ─────────────────────────────────────────────────────────────

function assembleGrids(mode, cells) {
  // Build adjacency: rowAxis → Set of valid colAxes
  const adj = new Map();
  for (const cell of cells.values()) {
    if (!adj.has(cell.rowAxis)) adj.set(cell.rowAxis, new Set());
    adj.get(cell.rowAxis).add(cell.colAxis);

    // For club_club, the graph is symmetric: also index by colAxis as row
    if (mode === "club_club") {
      if (!adj.has(cell.colAxis)) adj.set(cell.colAxis, new Set());
      adj.get(cell.colAxis).add(cell.rowAxis);
    }
  }

  // Qualified row axes sorted by degree descending (most connected first)
  const rowAxes = [...adj.keys()].sort((a, b) => adj.get(b).size - adj.get(a).size);

  // For club_club: col axes = same pool as row axes (symmetric graph)
  // For other modes: col axes = distinct set (year ranges or nationalities)
  const colAxesPool =
    mode === "club_club"
      ? null // derived per-row-triple from adjacency
      : [...new Set([...cells.values()].map((c) => c.colAxis))];

  const usedPairs = new Set(); // "rowAxis|||colAxis" already in a grid
  const grids = [];

  const lookupCell = (row, col) => {
    const key = mode === "club_club" ? [row, col].sort().join("|||") : `${row}|||${col}`;
    return cells.get(key);
  };

  const isAvailable = (row, col) => {
    const pairKey = `${row}|||${col}`;
    return !usedPairs.has(pairKey) && lookupCell(row, col) != null;
  };

  const markUsed = (rows, cols) => {
    for (const r of rows) for (const c of cols) usedPairs.add(`${r}|||${c}`);
  };

  for (let i = 0; i < rowAxes.length; i++) {
    const r1 = rowAxes[i];
    const r1Cols = adj.get(r1);

    for (let j = i + 1; j < rowAxes.length; j++) {
      const r2 = rowAxes[j];
      if (mode === "club_club" && r2 === r1) continue;
      const r2Cols = adj.get(r2);
      const common12 = intersectSets(r1Cols, r2Cols);
      if (common12.size < 3) continue;

      for (let k = j + 1; k < rowAxes.length; k++) {
        const r3 = rowAxes[k];
        if (r3 === r1 || r3 === r2) continue;
        const r3Cols = adj.get(r3);
        let candidates = [...intersectSets(common12, r3Cols)];

        // For club_club: cols must be distinct from all 3 rows
        if (mode === "club_club") {
          candidates = candidates.filter((c) => c !== r1 && c !== r2 && c !== r3);
        }
        if (candidates.length < 3) continue;

        // Try to form a valid, non-overlapping grid from available cols
        const availableCols = candidates.filter(
          (c) => isAvailable(r1, c) && isAvailable(r2, c) && isAvailable(r3, c)
        );
        if (availableCols.length < 3) continue;

        const c1 = availableCols[0];
        const c2 = availableCols[1];
        const c3 = availableCols[2];
        const rows = [r1, r2, r3];
        const cols = [c1, c2, c3];

        const gridCells = rows.flatMap((r) =>
          cols.map((c) => ({ row: r, col: c, ...lookupCell(r, c) }))
        );

        grids.push({ rows, cols, cells: gridCells });
        markUsed(rows, cols);
      }
    }
  }

  return grids;
}

// ─── Grid categorization ───────────────────────────────────────────────────────

function categorizeGrids(grids) {
  const easy = [];
  const medium = [];
  const hard = [];

  for (const grid of grids) {
    const difficulties = grid.cells.map((c) => c.difficulty);
    const max = Math.max(...difficulties);
    const min = Math.min(...difficulties);

    if (max <= 2 && easy.length < MAX_GRIDS_PER_DIFFICULTY) {
      easy.push(serializeGrid(grid, "easy"));
    } else if (max === 3 && medium.length < MAX_GRIDS_PER_DIFFICULTY) {
      medium.push(serializeGrid(grid, "medium"));
    } else if (max === 4 && min >= 2 && hard.length < MAX_GRIDS_PER_DIFFICULTY) {
      hard.push(serializeGrid(grid, "hard"));
    }
  }

  return { easy, medium, hard };
}

function serializeGrid(grid, difficulty) {
  return {
    difficulty,
    rows: grid.rows,
    cols: grid.cols,
    cells: grid.cells.map((c) => ({
      row: c.row,
      col: c.col,
      difficulty: c.difficulty,
      answer_count: c.solutions.length,
      // Omit full solution list to keep the file compact — use puzzle-cells.json for that
    })),
  };
}

// ─── Utilities ─────────────────────────────────────────────────────────────────

function countPlayersPerClub(players) {
  const counts = new Map();
  for (const p of players) {
    for (const club of new Set(p.carriere.map((c) => c.club))) {
      counts.set(club, (counts.get(club) ?? 0) + 1);
    }
  }
  return counts;
}

function countPlayersPerNat(players) {
  const counts = new Map();
  for (const p of players) {
    for (const nat of p.nationalites) {
      counts.set(nat, (counts.get(nat) ?? 0) + 1);
    }
  }
  return counts;
}

function intersectSets(a, b) {
  const result = new Set();
  for (const x of a) if (b.has(x)) result.add(x);
  return result;
}
