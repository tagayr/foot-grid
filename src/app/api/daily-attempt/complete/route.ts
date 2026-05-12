import { NextResponse } from "next/server";
import { getAdminClient, getAuthenticatedUser } from "@/lib/api/auth";

type CompleteBody = {
  attemptId?: string;
  errorCount?: number;
  foundCount?: number;
  puzzleId?: string;
  score?: number;
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

  const score = clampInteger(body.score, 0, 100000);
  const foundCount = clampInteger(body.foundCount, 0, 9);
  const errorCount = clampInteger(body.errorCount, 0, 4);
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
    .select("id, puzzle_date")
    .eq("id", body.puzzleId)
    .eq("kind", "daily")
    .eq("status", "published")
    .single();
  if (puzzleError) {
    return NextResponse.json({ error: puzzleError.message }, { status: 400 });
  }

  const completedAt = new Date();
  const startedAt = new Date(attempt.started_at);
  const durationMs = Math.max(0, completedAt.getTime() - startedAt.getTime());

  const { data: updatedAttempt, error: updateError } = await supabase
    .from("daily_attempts")
    .update({
      completed_at: completedAt.toISOString(),
      duration_ms: durationMs,
      error_count: errorCount,
      found_count: foundCount,
      score,
      status: "completed"
    })
    .eq("id", attempt.id)
    .select("*")
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (puzzle.puzzle_date) {
    await updateStreak(supabase, user.id, puzzle.puzzle_date);
  }

  return NextResponse.json({ attempt: updatedAttempt });
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

function clampInteger(value: unknown, min: number, max: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return min;
  }
  return Math.min(max, Math.max(min, Math.round(number)));
}
