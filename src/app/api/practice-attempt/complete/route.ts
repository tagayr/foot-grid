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

  const supabase = getAdminClient();
  const submittedAnswers = sanitizeSubmittedAnswers(body.answers);

  const { data: attempt, error: attemptError } = await supabase
    .from("random_attempts")
    .select("id, user_id, puzzle_id, started_at, completed_at")
    .eq("id", body.attemptId)
    .eq("user_id", user.id)
    .eq("puzzle_id", body.puzzleId)
    .single();

  if (attemptError) {
    return NextResponse.json({ error: attemptError.message }, { status: 404 });
  }
  if (attempt.completed_at) {
    const { data: completedAttempt } = await supabase.from("random_attempts").select("*").eq("id", attempt.id).single();
    return NextResponse.json({ attempt: completedAttempt });
  }

  const { data: puzzle, error: puzzleError } = await supabase
    .from("puzzles")
    .select("id, mode")
    .eq("id", body.puzzleId)
    .eq("kind", "practice")
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
    .from("random_attempts")
    .update({
      completed_at: completedAt.toISOString(),
      duration_ms: durationMs,
      error_count: verification.errorCount,
      found_count: verification.foundCount,
      score: verification.score
    })
    .eq("id", attempt.id)
    .select("*")
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ attempt: updatedAttempt });
}
