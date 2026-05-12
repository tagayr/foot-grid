import { NextResponse } from "next/server";
import { getAdminClient, getAuthenticatedUser } from "@/lib/api/auth";
import { sanitizeSubmittedAnswers, verifyPuzzleAnswers } from "@/lib/api/verifyPuzzleAnswers";

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

export async function POST(request: Request) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  const body = (await request.json()) as CompleteBody;
  if (!body.attemptId || !body.puzzleId) {
    return NextResponse.json({ error: "Missing attemptId or puzzleId." }, { status: 400 });
  }

  const submittedAnswers = sanitizeSubmittedAnswers(body.answers);
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

  const verification = await verifyPuzzleAnswers(supabase, puzzle.id, puzzle.mode, submittedAnswers);

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

function throwIfError(error: { message: string } | null, action: string) {
  if (error) {
    throw new Error(`Failed to ${action}: ${error.message}`);
  }
}
