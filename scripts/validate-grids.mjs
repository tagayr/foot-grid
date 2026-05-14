/**
 * Validates generated grids and prints a human-readable report.
 *
 * Usage:
 *   node scripts/validate-grids.mjs                      # full report
 *   node scripts/validate-grids.mjs --mode club_club     # one mode only
 *   node scripts/validate-grids.mjs --sample 3           # show N sample grids
 */

import { readFile } from "node:fs/promises";

const CELLS_FILE = "data/puzzle-cells.json";
const GRIDS_FILE = "data/generated-grids.json";
const PLAYERS_FILE = "data/players_all.json";

const TARGET_MODE = process.argv.find((a, i) => process.argv[i - 1] === "--mode") ?? null;
const SAMPLE_COUNT = Number(process.argv.find((a, i) => process.argv[i - 1] === "--sample") ?? 2);

const [cells, grids, players] = await Promise.all([
  readFile(CELLS_FILE, "utf8").then(JSON.parse),
  readFile(GRIDS_FILE, "utf8").then(JSON.parse),
  readFile(PLAYERS_FILE, "utf8").then(JSON.parse),
]);

const playerById = new Map(players.map((p) => [p.id, p]));

let totalErrors = 0;

for (const [mode, { easy, medium, hard }] of Object.entries(grids)) {
  if (TARGET_MODE && mode !== TARGET_MODE) continue;

  const modeLabel = { club_club: "CLUB × CLUB", club_year: "CLUB × ANNÉE", club_nationality: "CLUB × NATIONALITÉ" }[mode] ?? mode;
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  ${modeLabel}`);
  console.log(`${"═".repeat(60)}`);
  console.log(`  ${easy.length} easy  /  ${medium.length} medium  /  ${hard.length} hard`);

  const allGrids = [
    ...easy.map((g) => ({ ...g, difficulty: "easy" })),
    ...medium.map((g) => ({ ...g, difficulty: "medium" })),
    ...hard.map((g) => ({ ...g, difficulty: "hard" })),
  ];

  // ── Integrity checks ──────────────────────────────────────────────────────
  const usedPairs = new Set();
  let errors = 0;

  for (const grid of allGrids) {
    // 1. Each grid must have exactly 9 cells
    if (grid.cells.length !== 9) {
      console.error(`  ✗ Grid has ${grid.cells.length} cells (expected 9): rows=${grid.rows}`);
      errors++;
    }

    // 2. Each cell must have ≥1 answer
    for (const cell of grid.cells) {
      if (cell.answer_count < 1) {
        console.error(`  ✗ Cell with 0 answers: ${cell.row} × ${cell.col}`);
        errors++;
      }
    }

    // 3. No pair reused across grids
    for (const cell of grid.cells) {
      const key = `${cell.row}|||${cell.col}`;
      if (usedPairs.has(key)) {
        console.error(`  ✗ Pair reused: ${cell.row} × ${cell.col}`);
        errors++;
      }
      usedPairs.add(key);
    }
  }

  // 4. Cross-check solutions against player database
  const cellsForMode = cells[mode] ?? [];
  const cellMap = new Map(cellsForMode.map((c) => [`${c.rowAxis}|||${c.colAxis}`, c]));
  let orphanSolutions = 0;
  for (const cell of cellsForMode) {
    for (const pid of cell.solutions) {
      if (!playerById.has(pid)) orphanSolutions++;
    }
  }
  if (orphanSolutions > 0) {
    console.warn(`  ⚠ ${orphanSolutions} solution IDs not found in players database`);
  }

  if (errors === 0) {
    console.log(`  ✓ All ${allGrids.length} grids passed integrity checks`);
  } else {
    console.error(`  ✗ ${errors} integrity errors`);
    totalErrors += errors;
  }

  // ── Sample grids ──────────────────────────────────────────────────────────
  const samples = allGrids.slice(0, SAMPLE_COUNT);
  for (const grid of samples) {
    console.log(`\n  ┌─ ${grid.difficulty.toUpperCase()} grid`);
    console.log(`  │  rows: ${grid.rows.join(" · ")}`);
    console.log(`  │  cols: ${grid.cols.join(" · ")}`);

    const colWidth = Math.max(20, ...grid.cols.map((c) => String(c).length)) + 2;
    const header = "".padEnd(22) + grid.cols.map((c) => String(c).padEnd(colWidth)).join("");
    console.log(`  │  ${header}`);

    for (const row of grid.rows) {
      const rowLabel = String(row).padEnd(20);
      const cells = grid.cols.map((col) => {
        const cell = grid.cells.find((c) => c.row === row && c.col === col);
        const tag = `[D${cell?.difficulty ?? "?"}·${cell?.answer_count ?? 0}ans]`;
        return tag.padEnd(colWidth);
      });
      console.log(`  │  ${rowLabel}${cells.join("")}`);
    }

    // Show sample solutions for the first cell
    const firstCell = grid.cells[0];
    const cellData = cellMap.get(`${firstCell.row}|||${firstCell.col}`);
    if (cellData?.solutions?.length) {
      const samplePlayers = cellData.solutions.slice(0, 3).map((id) => playerById.get(id)?.nom ?? id);
      console.log(`  │  ex: ${firstCell.row} × ${firstCell.col} → ${samplePlayers.join(", ")}${cellData.solutions.length > 3 ? ` +${cellData.solutions.length - 3}` : ""}`);
    }
    console.log(`  └${"─".repeat(58)}`);
  }
}

console.log(`\n${"═".repeat(60)}`);
if (totalErrors === 0) {
  console.log("  ✓ All grids valid");
} else {
  console.error(`  ✗ ${totalErrors} total errors`);
  process.exit(1);
}
