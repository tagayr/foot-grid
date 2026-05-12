import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type DbPuzzleMode = Database["public"]["Enums"]["puzzle_mode"];

type SubmittedAnswer = {
  colPosition: number;
  playerName: string;
  rowPosition: number;
};

const MODE_MULTIPLIERS: Record<DbPuzzleMode, number> = {
  club_club: 1.5,
  club_nationality: 1,
  club_year: 2
};

export async function verifyPuzzleAnswers(
  supabase: SupabaseClient<Database>,
  puzzleId: string,
  mode: DbPuzzleMode,
  submittedAnswers: SubmittedAnswer[]
) {
  const { data: cells, error: cellsError } = await supabase
    .from("puzzle_cells")
    .select("id, row_position, col_position, answer_count")
    .eq("puzzle_id", puzzleId);
  throwIfError(cellsError, "load puzzle cells");

  const cellIds = (cells ?? []).map((cell) => cell.id);
  const { data: acceptedAnswers, error: answersError } = cellIds.length
    ? await supabase
        .from("accepted_answers")
        .select("puzzle_cell_id, player_id, players(display_name)")
        .in("puzzle_cell_id", cellIds)
    : { data: [], error: null };
  throwIfError(answersError, "load accepted answers");

  const cellByPosition = new Map((cells ?? []).map((cell) => [`${cell.row_position}:${cell.col_position}`, cell]));
  const acceptedByCell = new Map<number, Array<{ playerId: number; playerName: string }>>();

  for (const row of (acceptedAnswers ?? []) as Array<{
    player_id: number;
    puzzle_cell_id: number;
    players: { display_name: string } | { display_name: string }[] | null;
  }>) {
    const player = Array.isArray(row.players) ? row.players[0] : row.players;
    if (!player?.display_name) continue;
    const current = acceptedByCell.get(row.puzzle_cell_id) ?? [];
    current.push({ playerId: row.player_id, playerName: player.display_name });
    acceptedByCell.set(row.puzzle_cell_id, current);
  }

  let errorCount = 0;
  const correctCellIds = new Set<number>();
  const answerRowsByCell = new Map<
    number,
    {
      is_correct: boolean;
      player_id: number | null;
      puzzle_cell_id: number;
      submitted_name: string;
    }
  >();

  for (const answer of submittedAnswers) {
    const cell = cellByPosition.get(`${answer.rowPosition}:${answer.colPosition}`);
    if (!cell || correctCellIds.has(cell.id)) continue;

    const accepted = acceptedByCell.get(cell.id) ?? [];
    const matched = accepted.find((candidate) => normalize(candidate.playerName) === normalize(answer.playerName));
    const isCorrect = Boolean(matched);

    if (isCorrect) {
      correctCellIds.add(cell.id);
    } else {
      errorCount += 1;
    }

    answerRowsByCell.set(cell.id, {
      is_correct: isCorrect,
      player_id: matched?.playerId ?? null,
      puzzle_cell_id: cell.id,
      submitted_name: answer.playerName
    });
  }

  const foundCount = correctCellIds.size;
  const baseScore = (cells ?? []).reduce((score, cell) => {
    if (!correctCellIds.has(cell.id)) return score;
    return score + (cell.answer_count <= 2 ? 100 : 50);
  }, 0);
  const score = Math.max(0, Math.round(baseScore * MODE_MULTIPLIERS[mode]) - Math.min(errorCount, 4) * 20);

  return {
    answerRows: [...answerRowsByCell.values()],
    errorCount: Math.min(errorCount, 4),
    foundCount,
    score
  };
}

export function sanitizeSubmittedAnswers(
  answers: Array<{ colPosition?: number; playerName?: string; rowPosition?: number }> | undefined
) {
  if (!Array.isArray(answers)) return [];
  return answers
    .map((answer) => ({
      colPosition: Number(answer.colPosition),
      playerName: String(answer.playerName ?? "").trim(),
      rowPosition: Number(answer.rowPosition)
    }))
    .filter(
      (answer) =>
        Number.isInteger(answer.rowPosition) &&
        Number.isInteger(answer.colPosition) &&
        answer.rowPosition >= 0 &&
        answer.rowPosition <= 2 &&
        answer.colPosition >= 0 &&
        answer.colPosition <= 2 &&
        answer.playerName.length > 0
    )
    .slice(0, 20);
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function throwIfError(error: { message: string } | null, action: string) {
  if (error) throw new Error(`Failed to ${action}: ${error.message}`);
}
