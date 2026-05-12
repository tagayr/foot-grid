/**
 * Import generated grid candidates into Supabase as draft puzzles.
 *
 * Usage:
 *   node scripts/import-generated-grids.mjs            # import missing generated drafts
 *   node scripts/import-generated-grids.mjs --dry-run  # validate local files, write nothing
 *
 * Inputs:
 *   data/puzzle-cells.json
 *   data/generated-grids.json
 */

import { readFile, readFileSync } from "node:fs";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";

const readFileAsync = promisify(readFile);

const SOURCE_SLUG = "transfermarkt-big5";
const SNAPSHOT_VERSION = "v1";
const PUZZLE_CELLS_FILE = "data/puzzle-cells.json";
const GENERATED_GRIDS_FILE = "data/generated-grids.json";
const SEED_PREFIX = `${SOURCE_SLUG}-${SNAPSHOT_VERSION}-generated`;
const DRY_RUN = process.argv.includes("--dry-run");

loadEnvFile(".env.local");

const puzzleCells = JSON.parse(await readFileAsync(PUZZLE_CELLS_FILE, "utf8"));
const generatedGrids = JSON.parse(await readFileAsync(GENERATED_GRIDS_FILE, "utf8"));
const cellLookupByMode = buildCellLookups(puzzleCells);
const candidates = buildCandidates(generatedGrids, cellLookupByMode);

console.log(JSON.stringify({
  source: SOURCE_SLUG,
  snapshot: SNAPSHOT_VERSION,
  dryRun: DRY_RUN,
  candidates: candidates.length,
  cells: candidates.length * 9,
  acceptedAnswers: candidates.reduce((sum, candidate) => (
    sum + candidate.cells.reduce((cellSum, cell) => cellSum + cell.solutionIds.length, 0)
  ), 0),
}, null, 2));

if (DRY_RUN) {
  console.log("\nDry run - nothing written.");
  process.exit(0);
}

const supabase = createAdminClient();
const snapshot = await getActiveSnapshot();
let refs = await loadReferenceIds();
const repairedRefs = await ensureAxisReferenceRows(candidates, refs, snapshot.id);
if (repairedRefs) {
  refs = await loadReferenceIds();
}
const existingSeeds = await loadExistingSeeds();
const toImport = candidates.filter((candidate) => !existingSeeds.has(candidate.seed));

console.log(`\nActive snapshot: ${snapshot.id}`);
console.log(`Existing generated drafts/puzzles: ${candidates.length - toImport.length}`);
console.log(`Importing: ${toImport.length}`);

let imported = 0;
for (const candidate of toImport) {
  await importCandidate(candidate, snapshot.id, refs);
  imported += 1;
  if (imported % 25 === 0 || imported === toImport.length) {
    console.log(`Imported ${imported}/${toImport.length}`);
  }
}

console.log("\nGenerated grid import complete.");

function buildCellLookups(cellsByMode) {
  const result = {};
  for (const [mode, cells] of Object.entries(cellsByMode)) {
    result[mode] = new Map(
      cells.map((cell) => [cellKey(mode, cell.rowAxis, cell.colAxis), cell])
    );
  }
  return result;
}

function buildCandidates(gridsByMode, cellLookupByMode) {
  const candidates = [];

  for (const [mode, buckets] of Object.entries(gridsByMode)) {
    for (const [difficulty, grids] of Object.entries(buckets)) {
      for (const [index, grid] of grids.entries()) {
        const cells = grid.cells.map((cell, cellIndex) => {
          const sourceCell = cellLookupByMode[mode]?.get(cellKey(mode, cell.row, cell.col));
          if (!sourceCell) {
            throw new Error(`Missing source cell for ${mode}: ${cell.row} x ${cell.col}`);
          }
          return {
            ...cell,
            rowPosition: Math.floor(cellIndex / 3),
            colPosition: cellIndex % 3,
            solutionIds: sourceCell.solutions,
          };
        });

        candidates.push({
          mode,
          difficulty,
          index,
          seed: `${SEED_PREFIX}-${mode}-${difficulty}-${String(index + 1).padStart(4, "0")}`,
          rows: grid.rows,
          cols: grid.cols,
          cells,
        });
      }
    }
  }

  return candidates;
}

async function importCandidate(candidate, snapshotId, refs) {
  validateCandidateReferences(candidate, refs);

  const puzzle = await insertSingle("puzzles", {
    kind: "practice",
    mode: candidate.mode,
    status: "draft",
    seed: candidate.seed,
    title: generatedTitle(candidate),
    difficulty: averageDifficulty(candidate),
    generated_at: new Date().toISOString(),
    data_snapshot_id: snapshotId,
  });

  await insertMany("puzzle_axes", [
    ...candidate.rows.map((label, position) => buildAxisRow(puzzle.id, "row", position, candidate.mode, label, refs)),
    ...candidate.cols.map((label, position) => buildAxisRow(puzzle.id, "col", position, candidate.mode, label, refs)),
  ]);

  const insertedCells = await insertMany(
    "puzzle_cells",
    candidate.cells.map((cell) => ({
      puzzle_id: puzzle.id,
      row_position: cell.rowPosition,
      col_position: cell.colPosition,
      answer_count: cell.solutionIds.length,
      rarity_score: cell.solutionIds.length ? Number((1 / cell.solutionIds.length).toFixed(4)) : null,
    }))
  );

  const cellIdByPosition = new Map(
    insertedCells.map((cell) => [`${cell.row_position}:${cell.col_position}`, cell.id])
  );

  const answerRows = [];
  for (const cell of candidate.cells) {
    const puzzleCellId = mustGet(cellIdByPosition, `${cell.rowPosition}:${cell.colPosition}`, "puzzle cell");
    for (const [index, transfermarktId] of cell.solutionIds.entries()) {
      answerRows.push({
        puzzle_cell_id: puzzleCellId,
        player_id: mustGet(refs.playerIdByTransfermarktId, String(transfermarktId), "player"),
        is_featured: index === 0,
      });
    }
  }

  await insertMany("accepted_answers", answerRows);
}

function validateCandidateReferences(candidate, refs) {
  for (const label of candidate.rows) {
    mustGet(refs.clubIdByName, label, "club");
  }

  if (candidate.mode === "club_club") {
    for (const label of candidate.cols) mustGet(refs.clubIdByName, label, "club");
  }

  if (candidate.mode === "club_nationality") {
    for (const label of candidate.cols) mustGet(refs.countryIdByName, label, "country");
  }

  for (const cell of candidate.cells) {
    for (const transfermarktId of cell.solutionIds) {
      mustGet(refs.playerIdByTransfermarktId, String(transfermarktId), "player");
    }
  }
}

function buildAxisRow(puzzleId, axis, position, mode, label, refs) {
  if (axis === "row" || mode === "club_club") {
    return {
      puzzle_id: puzzleId,
      axis,
      position,
      kind: "club",
      club_id: mustGet(refs.clubIdByName, label, "club"),
      label,
    };
  }

  if (mode === "club_nationality") {
    return {
      puzzle_id: puzzleId,
      axis,
      position,
      kind: "country",
      country_id: mustGet(refs.countryIdByName, label, "country"),
      label,
    };
  }

  const { start, end } = parseYearRange(label);
  return {
    puzzle_id: puzzleId,
    axis,
    position,
    kind: "year",
    season_start: start,
    season_end: end,
    label,
  };
}

function parseYearRange(label) {
  const match = /^(\d{4})-(\d{2})$/.exec(label);
  if (!match) {
    throw new Error(`Invalid year range label: ${label}`);
  }

  const start = Number(match[1]);
  const shortEnd = Number(match[2]);
  const century = Math.floor(start / 100) * 100;
  const end = century + shortEnd < start ? century + 100 + shortEnd : century + shortEnd;
  return { start, end };
}

function generatedTitle(candidate) {
  return `${modeTitle(candidate.mode)} - ${candidate.difficulty} #${candidate.index + 1}`;
}

function modeTitle(mode) {
  if (mode === "club_club") return "Club x Club";
  if (mode === "club_year") return "Club x Year";
  if (mode === "club_nationality") return "Club x Nationality";
  return mode;
}

function averageDifficulty(candidate) {
  const total = candidate.cells.reduce((sum, cell) => sum + cell.difficulty, 0);
  return Number((total / candidate.cells.length).toFixed(2));
}

function cellKey(mode, row, col) {
  return mode === "club_club" ? [row, col].sort().join("|||") : `${row}|||${col}`;
}

async function getActiveSnapshot() {
  const { data: source, error: sourceError } = await supabase
    .from("data_sources")
    .select("id")
    .eq("slug", SOURCE_SLUG)
    .single();
  throwIfError(sourceError, "find data source");

  const { data: snapshot, error: snapshotError } = await supabase
    .from("data_snapshots")
    .select("*")
    .eq("source_id", source.id)
    .eq("version", SNAPSHOT_VERSION)
    .eq("status", "active")
    .single();
  throwIfError(snapshotError, "find active data snapshot");
  return snapshot;
}

async function loadReferenceIds() {
  const [clubs, countries, players] = await Promise.all([
    selectAll("clubs", "id, name, slug"),
    selectAll("countries", "id, name, slug"),
    selectAll("players", "id, transfermarkt_id"),
  ]);

  return {
    clubIdByName: new Map(clubs.map((club) => [club.name, club.id])),
    countryIdByName: new Map(countries.map((country) => [country.name, country.id])),
    clubSlugs: new Set(clubs.map((club) => club.slug)),
    countrySlugs: new Set(countries.map((country) => country.slug)),
    playerIdByTransfermarktId: new Map(
      players
        .filter((player) => player.transfermarkt_id)
        .map((player) => [String(player.transfermarkt_id), player.id])
    ),
  };
}

async function ensureAxisReferenceRows(candidates, refs, snapshotId) {
  const missingClubNames = new Set();
  const missingCountryNames = new Set();

  for (const candidate of candidates) {
    for (const label of candidate.rows) {
      if (!refs.clubIdByName.has(label)) missingClubNames.add(label);
    }

    if (candidate.mode === "club_club") {
      for (const label of candidate.cols) {
        if (!refs.clubIdByName.has(label)) missingClubNames.add(label);
      }
    }

    if (candidate.mode === "club_nationality") {
      for (const label of candidate.cols) {
        if (!refs.countryIdByName.has(label)) missingCountryNames.add(label);
      }
    }
  }

  const clubRows = [...missingClubNames].sort(localeCompare).map((name) => {
    const slug = uniqueSlug(name, refs.clubSlugs);
    return {
      name,
      slug,
      external_id: `club:${slug}`,
      data_snapshot_id: snapshotId,
    };
  });

  const countryRows = [...missingCountryNames].sort(localeCompare).map((name) => {
    const slug = uniqueSlug(name, refs.countrySlugs);
    return {
      name,
      slug,
      external_id: `country:${slug}`,
      data_snapshot_id: snapshotId,
    };
  });

  if (!clubRows.length && !countryRows.length) {
    return false;
  }

  if (clubRows.length) {
    console.log(`Creating ${clubRows.length} missing club reference row(s): ${clubRows.map((row) => row.name).join(", ")}`);
    await insertMany("clubs", clubRows);
  }

  if (countryRows.length) {
    console.log(`Creating ${countryRows.length} missing country reference row(s): ${countryRows.map((row) => row.name).join(", ")}`);
    await insertMany("countries", countryRows);
  }

  return true;
}

async function loadExistingSeeds() {
  const puzzles = await selectAll("puzzles", "seed");
  return new Set(
    puzzles
      .map((puzzle) => puzzle.seed)
      .filter((seed) => typeof seed === "string" && seed.startsWith(SEED_PREFIX))
  );
}

async function selectAll(table, columns) {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase.from(table).select(columns).range(from, to);
    throwIfError(error, `select ${table}`);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

async function insertSingle(table, row) {
  const { data, error } = await supabase.from(table).insert(row).select("*").single();
  throwIfError(error, `insert ${table}`);
  return data;
}

async function insertMany(table, rows) {
  if (!rows.length) return [];

  const inserted = [];
  for (const chunk of chunks(rows, 500)) {
    const { data, error } = await supabase.from(table).insert(chunk).select("*");
    throwIfError(error, `insert ${table}`);
    inserted.push(...(data ?? []));
  }
  return inserted;
}

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function loadEnvFile(path) {
  try {
    const env = readFileSync(path, "utf8");
    for (const line of env.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const sep = trimmed.indexOf("=");
      if (sep === -1) continue;
      const key = trimmed.slice(0, sep).trim();
      const val = trimmed.slice(sep + 1).trim().replace(/^["']|["']$/g, "");
      process.env[key] ||= val;
    }
  } catch {
    // The caller will get a clearer missing-env error if this file is absent.
  }
}

function mustGet(map, key, label) {
  const value = map.get(key);
  if (!value) {
    throw new Error(`Missing ${label}: ${key}`);
  }
  return value;
}

function chunks(items, size) {
  const result = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

function uniqueSlug(value, existingSlugs) {
  const base = slugify(value);
  let slug = base;
  let index = 2;
  while (existingSlugs.has(slug)) {
    slug = `${base}-${index}`;
    index += 1;
  }
  existingSlugs.add(slug);
  return slug;
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function localeCompare(a, b) {
  return a.localeCompare(b, "fr");
}

function throwIfError(error, action) {
  if (error) throw new Error(`Failed to ${action}: ${error.message}`);
}
