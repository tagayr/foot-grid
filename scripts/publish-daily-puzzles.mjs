/**
 * Publish one generated draft puzzle per mode for a daily date.
 *
 * Usage:
 *   node scripts/publish-daily-puzzles.mjs --dry-run
 *   node scripts/publish-daily-puzzles.mjs --date 2026-05-12
 *   node scripts/publish-daily-puzzles.mjs --date 2026-05-12 --difficulty medium
 *   node scripts/publish-daily-puzzles.mjs --date 2026-05-12 --force
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
const DIFFICULTY_ORDER = args.difficulty ? [String(args.difficulty)] : DEFAULT_DIFFICULTY_ORDER;

validateDate(PUZZLE_DATE);
validateDifficulties(DIFFICULTY_ORDER);
loadEnvFile(".env.local");

const supabase = createAdminClient();
const selections = [];

for (const mode of MODES) {
  const existing = await findPublishedPuzzle(mode, PUZZLE_DATE);
  if (existing && !FORCE && DRY_RUN) {
    selections.push({ mode, existing, draft: null, action: "skip_existing" });
    continue;
  }

  if (existing && !FORCE) {
    throw new Error(
      `A published ${mode} puzzle already exists for ${PUZZLE_DATE}: ${existing.id}. Use --force to archive and replace it.`
    );
  }

  const draft = await findDraftCandidate(mode, DIFFICULTY_ORDER);
  if (!draft) {
    throw new Error(`No generated draft candidate found for ${mode} with difficulty order: ${DIFFICULTY_ORDER.join(", ")}`);
  }

  selections.push({ mode, existing, draft, action: existing ? "replace" : "publish" });
}

console.log(JSON.stringify({
  date: PUZZLE_DATE,
  dryRun: DRY_RUN,
  force: FORCE,
  difficultyOrder: DIFFICULTY_ORDER,
  selections: selections.map(({ mode, existing, draft }) => ({
    mode,
    existingPublishedId: existing?.id ?? null,
    draftId: draft?.id ?? null,
    seed: draft?.seed ?? null,
    title: draft?.title ?? null,
    difficulty: draft?.difficulty ?? null,
  })),
}, null, 2));

if (DRY_RUN) {
  console.log("\nDry run - nothing written.");
  process.exit(0);
}

for (const { mode, existing, draft } of selections) {
  if (!draft) {
    console.log(`Skipped ${mode}; a published puzzle already exists for ${PUZZLE_DATE}.`);
    continue;
  }

  if (existing) {
    await updatePuzzle(existing.id, {
      status: "archived",
      published_at: null,
    });
    console.log(`Archived existing ${mode} puzzle ${existing.id}`);
  }

  await updatePuzzle(draft.id, {
    status: "published",
    puzzle_date: PUZZLE_DATE,
    published_at: new Date().toISOString(),
  });
  console.log(`Published ${mode} puzzle ${draft.id} (${draft.seed}) for ${PUZZLE_DATE}`);
}

console.log("\nDaily puzzles published.");

async function findPublishedPuzzle(mode, date) {
  const { data, error } = await supabase
    .from("puzzles")
    .select("id, mode, seed, title")
    .eq("mode", mode)
    .eq("status", "published")
    .eq("puzzle_date", date)
    .maybeSingle();
  throwIfError(error, `find published ${mode} puzzle`);
  return data;
}

async function findDraftCandidate(mode, difficultyOrder) {
  for (const difficulty of difficultyOrder) {
    const { data, error } = await supabase
      .from("puzzles")
      .select("id, mode, seed, title, difficulty, created_at")
      .eq("mode", mode)
      .eq("status", "draft")
      .like("seed", `${SEED_PREFIX}-${mode}-${difficulty}-%`)
      .order("difficulty", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(1);
    throwIfError(error, `find ${difficulty} draft for ${mode}`);

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
