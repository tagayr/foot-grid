import type { SupabaseClient } from "@supabase/supabase-js";
import { dbModeToAppMode } from "./modes";
import type { AxisType, Mode, Puzzle, PuzzlesByMode } from "@/game/types";
import type { Database } from "@/lib/supabase/database.types";
import { appModeToDbMode } from "./modes";

type PublishedPuzzleRow = {
  id: string;
  mode: Database["public"]["Enums"]["puzzle_mode"];
};

type AxisRow = {
  axis: "row" | "col";
  kind: "club" | "year" | "country";
  label: string;
  position: number;
  puzzle_id: string;
  season_start: number | null;
};

type CellRow = {
  id: number;
  col_position: number;
  puzzle_id: string;
  row_position: number;
};

type AcceptedAnswerRow = {
  puzzle_cell_id: number;
  players: { display_name: string } | { display_name: string }[] | null;
};

export async function loadPublishedPuzzlesForDate(
  supabase: SupabaseClient<Database>,
  date: string
): Promise<Partial<PuzzlesByMode>> {
  const { data: puzzleRows, error: puzzleError } = await supabase
    .from("puzzles")
    .select("id, mode")
    .eq("kind", "daily")
    .eq("status", "published")
    .eq("puzzle_date", date);

  if (puzzleError) {
    throw puzzleError;
  }

  const publishedPuzzles = (puzzleRows ?? []) as PublishedPuzzleRow[];
  if (!publishedPuzzles.length) {
    return {};
  }

  const puzzleIds = publishedPuzzles.map((puzzle) => puzzle.id);
  const { data: axisRows, error: axisError } = await supabase
    .from("puzzle_axes")
    .select("puzzle_id, axis, position, kind, label, season_start")
    .in("puzzle_id", puzzleIds);
  if (axisError) {
    throw axisError;
  }

  const { data: cellRows, error: cellError } = await supabase
    .from("puzzle_cells")
    .select("id, puzzle_id, row_position, col_position")
    .in("puzzle_id", puzzleIds);
  if (cellError) {
    throw cellError;
  }

  const cells = (cellRows ?? []) as CellRow[];
  const cellIds = cells.map((cell) => cell.id);
  const { data: answerRows, error: answerError } = cellIds.length
    ? await supabase
        .from("accepted_answers")
        .select("puzzle_cell_id, players(display_name)")
        .in("puzzle_cell_id", cellIds)
    : { data: [], error: null };
  if (answerError) {
    throw answerError;
  }

  const axesByPuzzle = groupBy((axisRows ?? []) as AxisRow[], (axis) => axis.puzzle_id);
  const cellsByPuzzle = groupBy(cells, (cell) => cell.puzzle_id);
  const answersByCell = groupAnswersByCell((answerRows ?? []) as unknown as AcceptedAnswerRow[]);

  const result: Partial<PuzzlesByMode> = {};
  for (const publishedPuzzle of publishedPuzzles) {
    const puzzle = adaptPuzzle({
      axes: axesByPuzzle.get(publishedPuzzle.id) ?? [],
      cells: cellsByPuzzle.get(publishedPuzzle.id) ?? [],
      answersByCell,
      puzzleId: publishedPuzzle.id
    });
    result[dbModeToAppMode(publishedPuzzle.mode)] = puzzle;
  }

  return result;
}

export async function loadRandomPracticePuzzle(
  supabase: SupabaseClient<Database>,
  mode: Mode
): Promise<Puzzle | null> {
  const { data: puzzleRows, error: puzzleError } = await supabase
    .from("puzzles")
    .select("id, mode")
    .eq("kind", "practice")
    .eq("status", "published")
    .is("puzzle_date", null)
    .eq("mode", appModeToDbMode(mode));

  if (puzzleError) {
    throw puzzleError;
  }

  const publishedPuzzles = (puzzleRows ?? []) as PublishedPuzzleRow[];
  if (!publishedPuzzles.length) {
    return null;
  }

  const selectedPuzzle = publishedPuzzles[Math.floor(Math.random() * publishedPuzzles.length)];
  const puzzles = await loadPuzzlesByIds(supabase, [selectedPuzzle.id]);
  return puzzles.get(selectedPuzzle.id) ?? null;
}

async function loadPuzzlesByIds(supabase: SupabaseClient<Database>, puzzleIds: string[]) {
  const { data: axisRows, error: axisError } = await supabase
    .from("puzzle_axes")
    .select("puzzle_id, axis, position, kind, label, season_start")
    .in("puzzle_id", puzzleIds);
  if (axisError) {
    throw axisError;
  }

  const { data: cellRows, error: cellError } = await supabase
    .from("puzzle_cells")
    .select("id, puzzle_id, row_position, col_position")
    .in("puzzle_id", puzzleIds);
  if (cellError) {
    throw cellError;
  }

  const cells = (cellRows ?? []) as CellRow[];
  const cellIds = cells.map((cell) => cell.id);
  const { data: answerRows, error: answerError } = cellIds.length
    ? await supabase
        .from("accepted_answers")
        .select("puzzle_cell_id, players(display_name)")
        .in("puzzle_cell_id", cellIds)
    : { data: [], error: null };
  if (answerError) {
    throw answerError;
  }

  const axesByPuzzle = groupBy((axisRows ?? []) as AxisRow[], (axis) => axis.puzzle_id);
  const cellsByPuzzle = groupBy(cells, (cell) => cell.puzzle_id);
  const answersByCell = groupAnswersByCell((answerRows ?? []) as unknown as AcceptedAnswerRow[]);
  const result = new Map<string, Puzzle>();

  for (const puzzleId of puzzleIds) {
    result.set(
      puzzleId,
      adaptPuzzle({
        axes: axesByPuzzle.get(puzzleId) ?? [],
        cells: cellsByPuzzle.get(puzzleId) ?? [],
        answersByCell,
        puzzleId
      })
    );
  }

  return result;
}

function adaptPuzzle({
  axes,
  cells,
  answersByCell,
  puzzleId
}: {
  axes: AxisRow[];
  cells: CellRow[];
  answersByCell: Map<number, string[]>;
  puzzleId: string;
}): Puzzle {
  const rows = axes
    .filter((axis) => axis.axis === "row")
    .sort((a, b) => a.position - b.position)
    .map(axisValue);
  const cols = axes
    .filter((axis) => axis.axis === "col")
    .sort((a, b) => a.position - b.position)
    .map(axisValue);
  const rowType = axisType(axes.find((axis) => axis.axis === "row"));
  const colType = axisType(axes.find((axis) => axis.axis === "col"));
  const solutions: Record<string, string[]> = {};

  for (const cell of cells) {
    const row = rows[cell.row_position];
    const col = cols[cell.col_position];
    if (row === undefined || col === undefined) {
      console.warn(`Skipping malformed puzzle cell for puzzle ${puzzleId}.`);
      continue;
    }
    solutions[`${row}-${col}`] = answersByCell.get(cell.id) ?? [];
  }

  return {
    id: puzzleId,
    rows,
    cols,
    rowType,
    colType,
    solutions
  };
}

function axisValue(axis: AxisRow) {
  return axis.kind === "year" ? axis.season_start ?? Number(axis.label.slice(0, 4)) : axis.label;
}

function axisType(axis: AxisRow | undefined): AxisType {
  if (!axis) {
    return "club";
  }
  if (axis.kind === "country") {
    return "sel";
  }
  if (axis.kind === "year") {
    return "annee";
  }
  return "club";
}

function groupAnswersByCell(rows: AcceptedAnswerRow[]) {
  const answersByCell = new Map<number, string[]>();
  for (const row of rows) {
    const player = Array.isArray(row.players) ? row.players[0] : row.players;
    if (!player?.display_name) {
      continue;
    }
    const answers = answersByCell.get(row.puzzle_cell_id) ?? [];
    answers.push(player.display_name);
    answersByCell.set(row.puzzle_cell_id, answers);
  }
  return answersByCell;
}

function groupBy<T, K>(items: T[], getKey: (item: T) => K) {
  const grouped = new Map<K, T[]>();
  for (const item of items) {
    const key = getKey(item);
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }
  return grouped;
}
