/**
 * Publish generated draft puzzles into the practice pool.
 *
 * Usage:
 *   node scripts/publish-practice-puzzles.mjs --dry-run
 *   node scripts/publish-practice-puzzles.mjs
 *   node scripts/publish-practice-puzzles.mjs --mode club_club --limit 50
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const SOURCE_SLUG = "transfermarkt-big5";
const SNAPSHOT_VERSION = "v1";
const SEED_PREFIX = `${SOURCE_SLUG}-${SNAPSHOT_VERSION}-generated`;
const MODES = ["club_club", "club_year", "club_nationality"];

const args = parseArgs(process.argv.slice(2));
const DRY_RUN = Boolean(args["dry-run"]);
const MODE = args.mode ? normalizeMode(String(args.mode)) : null;
const LIMIT = args.limit ? Number(args.limit) : null;

if (LIMIT !== null && (!Number.isInteger(LIMIT) || LIMIT < 1)) {
  throw new Error(`Invalid --limit value: ${args.limit}`);
}

loadEnvFile(".env.local");
const supabase = createAdminClient();

let candidates = await loadDraftCandidates();
if (LIMIT !== null) {
  candidates = candidates.slice(0, LIMIT);
}

console.log(JSON.stringify({
  dryRun: DRY_RUN,
  mode: MODE,
  limit: LIMIT,
  candidates: candidates.length,
}, null, 2));

if (DRY_RUN) {
  console.log("\nDry run - nothing written.");
  process.exit(0);
}

for (const chunk of chunks(candidates, 200)) {
  const ids = chunk.map((puzzle) => puzzle.id);
  const { error } = await supabase
    .from("puzzles")
    .update({
      kind: "practice",
      status: "published",
      puzzle_date: null,
      published_at: new Date().toISOString(),
    })
    .in("id", ids);
  throwIfError(error, "publish practice puzzles");
  console.log(`Published ${ids.length} practice puzzle(s)`);
}

console.log("\nPractice puzzle pool published.");

async function loadDraftCandidates() {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    let query = supabase
      .from("puzzles")
      .select("id, mode, seed")
      .eq("kind", "practice")
      .eq("status", "draft")
      .like("seed", `${SEED_PREFIX}-%`)
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);

    if (MODE) {
      query = query.eq("mode", MODE);
    }

    const { data, error } = await query;
    throwIfError(error, "load practice draft candidates");
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;

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

function normalizeMode(mode) {
  if (mode === "cc") return "club_club";
  if (mode === "ca") return "club_year";
  if (mode === "cs") return "club_nationality";
  if (MODES.includes(mode)) return mode;
  throw new Error(`Invalid --mode value: ${mode}. Expected club_club, club_year, club_nationality, cc, ca, or cs.`);
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

function chunks(items, size) {
  const result = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

function throwIfError(error, action) {
  if (error) throw new Error(`Failed to ${action}: ${error.message}`);
}
