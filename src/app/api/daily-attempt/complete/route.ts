import { NextResponse } from "next/server";
import { getAdminClient, getAuthenticatedUser } from "@/lib/api/auth";

type CompleteBody = {
  answers?: Array<{
    colPosition?: number;
    playerName?: string;
    rowPosition?: number;
  }>;
  attemptId?: string;
  gaveUp?: boolean;
  puzzleId?: string;
};

const MODE_MULTIPLIERS = {
  club_club: 1.5,
  club_nationality: 1,
  club_year: 2
} as const;

export async function POST(request: Request) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  const body = (await request.json()) as CompleteBody;
  if (!body.attemptId || !body.puzzleId) {
    return NextResponse.json({ error: "Missing attemptId or puzzleId." }, { status: 400 });
  }

  const submittedAnswers = sanitizeAnswers(body.answers);
  const supabase = getAdminClient();

  const { data: attempt, error: attemptError } = await supabase
    .from("daily_attempts")
    .select("id, user_id, puzzle_id, status, started_at")
    .eq("id", body.attemptId)
    .eq("user_id", user.id)
    .eq("puzzle_id", body.puzzleId)
    .single();

  if (attemptError) {
    return NextResponse.json({ error: attemptError.message }, { status: 404 });
  }
  if (attempt.status === "completed") {
    const { data: completedAttempt } = await supabase.from("daily_attempts").select("*").eq("id", attempt.id).single();
    return NextResponse.json({ attempt: completedAttempt });
  }

  const { data: puzzle, error: puzzleError } = await supabase
    .from("puzzles")
    .select("id, mode, puzzle_date")
    .eq("id", body.puzzleId)
    .eq("kind", "daily")
    .eq("status", "published")
    .single();
  if (puzzleError) {
    return NextResponse.json({ error: puzzleError.message }, { status: 400 });
  }

  const verification = await verifySubmittedAnswers(supabase, puzzle.id, puzzle.mode, submittedAnswers);

  const completedAt = new Date();
  const startedAt = new Date(attempt.started_at);
  const durationMs = Math.max(0, completedAt.getTime() - startedAt.getTime());

  const { data: updatedAttempt, error: updateError } = await supabase
    .from("daily_attempts")
    .update({
      completed_at: completedAt.toISOString(),
      duration_ms: durationMs,
      error_count: verification.errorCount,
      found_count: verification.foundCount,
      score: verification.score,
      status: "completed"
    })
    .eq("id", attempt.id)
    .select("*")
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await replaceAttemptAnswers(supabase, attempt.id, verification.answerRows);

  if (puzzle.puzzle_date) {
    await updateStreak(supabase, user.id, puzzle.puzzle_date);
  }

  return NextResponse.json({ attempt: updatedAttempt });
}

async function verifySubmittedAnswers(
  supabase: ReturnType<typeof getAdminClient>,
  puzzleId: string,
  mode: keyof typeof MODE_MULTIPLIERS,
  submittedAnswers: Array<{ colPosition: number; playerName: string; rowPosition: number }>
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

  const cellByPosition = new Map(
    (cells ?? []).map((cell) => [`${cell.row_position}:${cell.col_position}`, cell])
  );
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
  const answerRowsByCell = new Map<number, {
    is_correct: boolean;
    player_id: number | null;
    puzzle_cell_id: number;
    submitted_name: string;
  }>();

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

async function replaceAttemptAnswers(
  supabase: ReturnType<typeof getAdminClient>,
  attemptId: string,
  answerRows: Array<{
    is_correct: boolean;
    player_id: number | null;
    puzzle_cell_id: number;
    submitted_name: string;
  }>
) {
  await supabase.from("daily_attempt_answers").delete().eq("attempt_id", attemptId);
  if (!answerRows.length) return;

  const { error } = await supabase.from("daily_attempt_answers").insert(
    answerRows.map((row) => ({
      ...row,
      attempt_id: attemptId
    }))
  );
  throwIfError(error, "insert daily attempt answers");
}

async function updateStreak(supabase: ReturnType<typeof getAdminClient>, userId: string, puzzleDate: string) {
  const { data: streak } = await supabase.from("user_streaks").select("*").eq("user_id", userId).maybeSingle();
  const previousDate = streak?.last_completed_date;
  const nextCurrent =
    previousDate === previousDay(puzzleDate)
      ? (streak?.current_streak ?? 0) + 1
      : previousDate === puzzleDate
        ? (streak?.current_streak ?? 1)
        : 1;
  const nextBest = Math.max(streak?.best_streak ?? 0, nextCurrent);

  await supabase.from("user_streaks").upsert({
    best_streak: nextBest,
    current_streak: nextCurrent,
    last_completed_date: puzzleDate,
    updated_at: new Date().toISOString(),
    user_id: userId
  });
}

function previousDay(date: string) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

function sanitizeAnswers(answers: CompleteBody["answers"]) {
  if (!Array.isArray(answers)) return [];
  return answers
    .map((answer) => ({
      colPosition: Number(answer.colPosition),
      playerName: String(answer.playerName ?? "").trim(),
      rowPosition: Number(answer.rowPosition)
    }))
    .filter((answer) =>
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
  if (error) {
    throw new Error(`Failed to ${action}: ${error.message}`);
  }
}
