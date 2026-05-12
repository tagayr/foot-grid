/**
 * Import players_all.json into Supabase.
 *
 * Usage:
 *   node scripts/import-players.mjs            # import (idempotent)
 *   node scripts/import-players.mjs --dry-run  # print stats, write nothing
 *   node scripts/import-players.mjs --reset    # clear snapshot then reimport
 */

import { readFile, readFileSync } from "node:fs";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";

const readFileAsync = promisify(readFile);

const SOURCE_SLUG = "transfermarkt-big5";
const SOURCE_NAME = "Transfermarkt Big 5";
const SNAPSHOT_VERSION = "v1";
const SNAPSHOT_LABEL = "Big 5 Leagues — Transfermarkt import";
const DATA_FILE = "data/players_all.json";

const DRY_RUN = process.argv.includes("--dry-run");
const RESET = process.argv.includes("--reset");

loadEnvFile(".env.local");
const supabase = createAdminClient();

// ─── Main ─────────────────────────────────────────────────────────────────────

const raw = JSON.parse(await readFileAsync(DATA_FILE, "utf8"));
const { countries, clubs, players, nationalities, spells } = buildImportData(raw);

console.log(JSON.stringify({
  source: SOURCE_SLUG,
  snapshot: SNAPSHOT_VERSION,
  dryRun: DRY_RUN,
  reset: RESET,
  countries: countries.length,
  clubs: clubs.length,
  players: players.length,
  nationalities: nationalities.length,
  careerSpells: spells.length,
}, null, 2));

if (DRY_RUN) {
  console.log("\nDry run — nothing written.");
  process.exit(0);
}

// Ensure data_source exists
const source = await upsertSource();
console.log(`\nSource: ${source.name} (id=${source.id})`);

// Handle existing snapshot
let snapshot = await getSnapshot(source.id);
if (snapshot) {
  if (RESET) {
    console.log(`Resetting snapshot ${snapshot.id}...`);
    await clearSnapshot(snapshot.id);
    await deleteWhere("data_snapshots", "id", snapshot.id);
    snapshot = null;
  } else {
    console.log(`Snapshot already exists (id=${snapshot.id}, status=${snapshot.status}). Use --reset to reimport.`);
    process.exit(0);
  }
}

snapshot = await insertSingle("data_snapshots", {
  source_id: source.id,
  label: SNAPSHOT_LABEL,
  version: SNAPSHOT_VERSION,
  status: "importing",
});
console.log(`Snapshot created: ${snapshot.id}`);

try {
  await importData(snapshot.id, { countries, clubs, players, nationalities, spells });
  await supabase.from("data_snapshots").update({ status: "active", imported_at: new Date().toISOString() }).eq("id", snapshot.id);
  console.log("\nDone. Snapshot marked active.");
} catch (err) {
  await supabase.from("data_snapshots").update({ status: "failed" }).eq("id", snapshot.id);
  console.error("\nImport failed. Snapshot marked as failed.");
  throw err;
}

// ─── Build ─────────────────────────────────────────────────────────────────────

function buildImportData(rawPlayers) {
  const countryNames = new Set();
  const clubNames = new Set();

  for (const p of rawPlayers) {
    for (const n of p.nationalites ?? []) countryNames.add(n);
    for (const c of p.carriere ?? []) clubNames.add(c.club);
  }

  const countrySlugMap = buildSlugMap([...countryNames]);
  const clubSlugMap = buildSlugMap([...clubNames]);

  const countries = [...countryNames].sort(localeCompare).map((name) => ({
    name,
    slug: countrySlugMap.get(name),
    external_id: `country:${countrySlugMap.get(name)}`,
  }));

  const clubs = [...clubNames].sort(localeCompare).map((name) => ({
    name,
    slug: clubSlugMap.get(name),
    external_id: `club:${clubSlugMap.get(name)}`,
  }));

  const players = rawPlayers.map((p) => ({
    display_name: p.nom,
    slug: slugify(p.nom),
    transfermarkt_id: p.id,
    external_id: `player:${p.id}`,
  }));

  const nationalities = [];
  const spells = [];

  for (const p of rawPlayers) {
    const nats = p.nationalites ?? [];
    for (let i = 0; i < nats.length; i++) {
      nationalities.push({
        player_external_id: `player:${p.id}`,
        country_external_id: `country:${countrySlugMap.get(nats[i])}`,
        is_primary: i === 0,
      });
    }
    for (const c of p.carriere ?? []) {
      spells.push({
        player_external_id: `player:${p.id}`,
        club_external_id: `club:${clubSlugMap.get(c.club)}`,
        season_start: c.annee_debut,
        season_end: c.annee_fin,
        external_id: `spell:${p.id}:${clubSlugMap.get(c.club)}:${c.annee_debut}`,
        source: SOURCE_SLUG,
      });
    }
  }

  return { countries, clubs, players, nationalities, spells };
}

function buildSlugMap(names) {
  const map = new Map();
  const seen = new Set();
  for (const name of names) {
    const base = slugify(name);
    let slug = base;
    let i = 2;
    while (seen.has(slug)) slug = `${base}-${i++}`;
    seen.add(slug);
    map.set(name, slug);
  }
  return map;
}

// ─── Import ────────────────────────────────────────────────────────────────────

async function importData(snapshotId, { countries, clubs, players, nationalities, spells }) {
  // 1. Countries — find or create (name is globally unique)
  process.stdout.write(`Upserting ${countries.length} countries... `);
  const countryIdByExternal = await findOrCreate("countries", "name", "external_id",
    countries.map((c) => ({ ...c, data_snapshot_id: snapshotId }))
  );
  console.log("ok");

  // 2. Clubs — find or create (slug is globally unique)
  process.stdout.write(`Upserting ${clubs.length} clubs... `);
  const clubIdByExternal = await findOrCreate("clubs", "slug", "external_id",
    clubs.map((c) => ({ ...c, data_snapshot_id: snapshotId }))
  );
  console.log("ok");

  // 3. Players — find existing by transfermarkt_id, insert the rest with unique slugs
  process.stdout.write(`Inserting ${players.length} players... `);
  const tmIds = players.map((p) => p.transfermarkt_id).filter(Boolean);
  const { data: existingPlayers, error: epErr } = await supabase
    .from("players").select("id, transfermarkt_id, slug, external_id").in("transfermarkt_id", tmIds);
  throwIfError(epErr, "fetch existing players");

  const playerIdByExternal = new Map((existingPlayers ?? []).map((p) => [`player:${p.transfermarkt_id}`, p.id]));
  const existingTmIds = new Set((existingPlayers ?? []).map((p) => p.transfermarkt_id));
  const existingSlugs = new Set((existingPlayers ?? []).map((p) => p.slug));

  // Also fetch all slugs from DB to avoid conflicts with prototype players
  const { data: allSlugs } = await supabase.from("players").select("slug");
  for (const r of allSlugs ?? []) existingSlugs.add(r.slug);

  const toInsert = players
    .filter((p) => !existingTmIds.has(p.transfermarkt_id))
    .map((p) => {
      let slug = p.slug;
      if (existingSlugs.has(slug)) slug = `${slug}-${p.transfermarkt_id}`;
      existingSlugs.add(slug);
      return { ...p, slug, data_snapshot_id: snapshotId };
    });

  if (toInsert.length) {
    const inserted = await insertMany("players", toInsert);
    for (const p of inserted) playerIdByExternal.set(p.external_id, p.id);
  }
  console.log("ok");

  // 4. Player nationalities
  process.stdout.write(`Inserting ${nationalities.length} nationalities... `);
  const natRows = nationalities
    .filter((n) => playerIdByExternal.has(n.player_external_id) && countryIdByExternal.has(n.country_external_id))
    .map((n) => ({
      player_id: playerIdByExternal.get(n.player_external_id),
      country_id: countryIdByExternal.get(n.country_external_id),
      is_primary: n.is_primary,
    }));
  await insertMany("player_nationalities", natRows);
  console.log("ok");

  // 5. Career spells
  process.stdout.write(`Inserting ${spells.length} career spells... `);
  const spellRows = spells
    .filter((s) => playerIdByExternal.has(s.player_external_id) && clubIdByExternal.has(s.club_external_id))
    .map((s) => ({
      player_id: playerIdByExternal.get(s.player_external_id),
      club_id: clubIdByExternal.get(s.club_external_id),
      season_start: s.season_start,
      season_end: s.season_end,
      external_id: s.external_id,
      source: s.source,
      data_snapshot_id: snapshotId,
    }));
  await insertMany("career_spells", spellRows);
  console.log("ok");
}

// ─── Supabase helpers ──────────────────────────────────────────────────────────

async function upsertSource() {
  const { data, error } = await supabase
    .from("data_sources")
    .upsert({ name: SOURCE_NAME, slug: SOURCE_SLUG }, { onConflict: "slug" })
    .select("*")
    .single();
  throwIfError(error, "upsert data_source");
  return data;
}

async function getSnapshot(sourceId) {
  const { data, error } = await supabase
    .from("data_snapshots")
    .select("*")
    .eq("source_id", sourceId)
    .eq("version", SNAPSHOT_VERSION)
    .maybeSingle();
  throwIfError(error, "get data_snapshot");
  return data;
}

async function clearSnapshot(snapshotId) {
  const { data: snapPlayers } = await supabase.from("players").select("id").eq("data_snapshot_id", snapshotId);
  for (const chunk of chunks((snapPlayers ?? []).map((p) => p.id), 200)) {
    const { error } = await supabase.from("player_nationalities").delete().in("player_id", chunk);
    throwIfError(error, "delete player_nationalities");
  }
  await deleteWhere("career_spells", "data_snapshot_id", snapshotId);
  await deleteWhere("players", "data_snapshot_id", snapshotId);
  await deleteWhere("clubs", "data_snapshot_id", snapshotId);
  await deleteWhere("countries", "data_snapshot_id", snapshotId);
}

async function findOrCreate(table, uniqueKey, externalIdKey, rows) {
  const keyValues = rows.map((r) => r[uniqueKey]);
  const { data: existing, error } = await supabase
    .from(table)
    .select(`id, ${uniqueKey}, ${externalIdKey}`)
    .in(uniqueKey, keyValues);
  throwIfError(error, `fetch existing ${table}`);

  const existingByKey = new Map((existing ?? []).map((r) => [r[uniqueKey], r]));
  const toInsert = rows.filter((r) => !existingByKey.has(r[uniqueKey]));

  if (toInsert.length) {
    const inserted = await insertMany(table, toInsert);
    for (const r of inserted) existingByKey.set(r[uniqueKey], r);
  }

  const idByExternal = new Map();
  for (const row of rows) {
    const found = existingByKey.get(row[uniqueKey]);
    if (found) idByExternal.set(row[externalIdKey], found.id);
  }
  return idByExternal;
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

async function deleteWhere(table, column, value) {
  const { error } = await supabase.from(table).delete().eq(column, value);
  throwIfError(error, `delete from ${table}`);
}

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
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
  } catch { /* .env.local absent — caller gets a clearer error */ }
}

// ─── Utils ─────────────────────────────────────────────────────────────────────

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function chunks(items, size) {
  const result = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

function localeCompare(a, b) {
  return a.localeCompare(b, "fr");
}

function throwIfError(error, action) {
  if (error) throw new Error(`Failed to ${action}: ${error.message}`);
}
