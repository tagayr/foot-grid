/**
 * Publish one generated draft puzzle for a daily date.
 *
 * Usage:
 *   node scripts/publish-daily-puzzles.mjs --dry-run
 *   node scripts/publish-daily-puzzles.mjs --date 2026-05-12 --mode club_year
 *   node scripts/publish-daily-puzzles.mjs --date 2026-05-12 --mode club_year --difficulty medium
 *   node scripts/publish-daily-puzzles.mjs --date 2026-05-12 --mode club_year --force
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const SOURCE_SLUG = "transfermarkt-big5";
const SNAPSHOT_VERSION = "v1";
const SEED_PREFIX = `${SOURCE_SLUG}-${SNAPSHOT_VERSION}-generated`;
const MODES = ["club_club", "club_year", "club_nationality"];
const DEFAULT_DIFFICULTY_ORDER = ["medium", "easy", "hard"];

const args = parseArgs(process.argv.slice(2));
const DRY_RUN = Boolean(args["dry-run"]);
const FORCE = Boolean(args.force);
const PUZZLE_DATE = String(args.date ?? todayIsoDate());
const MODE = normalizeMode(args.mode ? String(args.mode) : modeForDate(PUZZLE_DATE));
const DIFFICULTY_ORDER = args.difficulty ? [String(args.difficulty)] : DEFAULT_DIFFICULTY_ORDER;

validateDate(PUZZLE_DATE);
validateDifficulties(DIFFICULTY_ORDER);
loadEnvFile(".env.local");

const supabase = createAdminClient();
const existing = await findPublishedDailyPuzzle(PUZZLE_DATE);

if (existing && !FORCE && !DRY_RUN) {
  throw new Error(
    `A published daily puzzle already exists for ${PUZZLE_DATE}: ${existing.id} (${existing.mode}). Use --force to archive and replace it.`
  );
}

const draft = existing && !FORCE ? null : await findPracticeCandidate(MODE, DIFFICULTY_ORDER);
if (!existing || FORCE) {
  if (!draft) {
    throw new Error(`No generated practice candidate found for ${MODE} with difficulty order: ${DIFFICULTY_ORDER.join(", ")}`);
  }
}

console.log(JSON.stringify({
  date: PUZZLE_DATE,
  mode: MODE,
  dryRun: DRY_RUN,
  force: FORCE,
  difficultyOrder: DIFFICULTY_ORDER,
  existingPublishedId: existing?.id ?? null,
  existingPublishedMode: existing?.mode ?? null,
  draftId: draft?.id ?? null,
  seed: draft?.seed ?? null,
  title: draft?.title ?? null,
  difficulty: draft?.difficulty ?? null,
}, null, 2));

if (DRY_RUN) {
  console.log("\nDry run - nothing written.");
  process.exit(0);
}

if (existing && !FORCE) {
  console.log(`Skipped; a published daily puzzle already exists for ${PUZZLE_DATE}.`);
  process.exit(0);
}

if (existing) {
  await updatePuzzle(existing.id, {
    status: "archived",
    published_at: null,
  });
  console.log(`Archived existing daily puzzle ${existing.id} (${existing.mode})`);
}

await updatePuzzle(draft.id, {
  kind: "daily",
  status: "published",
  puzzle_date: PUZZLE_DATE,
  published_at: new Date().toISOString(),
});
console.log(`Published daily ${MODE} puzzle ${draft.id} (${draft.seed}) for ${PUZZLE_DATE}`);

console.log("\nDaily puzzle published.");

async function findPublishedDailyPuzzle(date) {
  const { data, error } = await supabase
    .from("puzzles")
    .select("id, mode, seed, title")
    .eq("kind", "daily")
    .eq("status", "published")
    .eq("puzzle_date", date)
    .maybeSingle();
  throwIfError(error, "find published daily puzzle");
  return data;
}

async function findPracticeCandidate(mode, difficultyOrder) {
  for (const difficulty of difficultyOrder) {
    const { data, error } = await supabase
      .from("puzzles")
      .select("id, mode, seed, title, difficulty, created_at")
      .eq("kind", "practice")
      .eq("mode", mode)
      .in("status", ["draft", "published"])
      .is("puzzle_date", null)
      .like("seed", `${SEED_PREFIX}-${mode}-${difficulty}-%`)
      .order("difficulty", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(1);
    throwIfError(error, `find ${difficulty} practice candidate for ${mode}`);

    if (data?.length) {
      return data[0];
    }
  }

  return null;
}

async function updatePuzzle(id, row) {
  const { error } = await supabase.from("puzzles").update(row).eq("id", id);
  throwIfError(error, `update puzzle ${id}`);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      continue;
    }

    const [rawKey, inlineValue] = arg.slice(2).split("=");
    if (inlineValue !== undefined) {
      parsed[rawKey] = inlineValue;
      continue;
    }

    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[rawKey] = true;
    } else {
      parsed[rawKey] = next;
      index += 1;
    }
  }
  return parsed;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function validateDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid --date value: ${date}. Expected YYYY-MM-DD.`);
  }
}

function validateDifficulties(difficulties) {
  const allowed = new Set(["easy", "medium", "hard"]);
  for (const difficulty of difficulties) {
    if (!allowed.has(difficulty)) {
      throw new Error(`Invalid --difficulty value: ${difficulty}. Expected easy, medium, or hard.`);
    }
  }
}

function normalizeMode(mode) {
  if (mode === "cc") return "club_club";
  if (mode === "ca") return "club_year";
  if (mode === "cs") return "club_nationality";
  if (MODES.includes(mode)) return mode;
  throw new Error(`Invalid --mode value: ${mode}. Expected club_club, club_year, club_nationality, cc, ca, or cs.`);
}

function modeForDate(date) {
  const day = Math.floor(Date.parse(`${date}T00:00:00.000Z`) / 86400000);
  return MODES[day % MODES.length];
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

function throwIfError(error, action) {
  if (error) throw new Error(`Failed to ${action}: ${error.message}`);
}
