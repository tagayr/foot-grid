import { NextResponse } from "next/server";
import { getAdminClient, getAuthenticatedUser } from "@/lib/api/auth";

type StartBody = {
  puzzleId?: string;
};

export async function POST(request: Request) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  const body = (await request.json()) as StartBody;
  if (!body.puzzleId) {
    return NextResponse.json({ error: "Missing puzzleId." }, { status: 400 });
  }

  const supabase = getAdminClient();
  const { data: puzzle, error: puzzleError } = await supabase
    .from("puzzles")
    .select("id, kind, status, puzzle_date")
    .eq("id", body.puzzleId)
    .eq("kind", "daily")
    .eq("status", "published")
    .maybeSingle();

  if (puzzleError) {
    return NextResponse.json({ error: puzzleError.message }, { status: 500 });
  }
  if (!puzzle) {
    return NextResponse.json({ error: "Puzzle is not a published daily puzzle." }, { status: 400 });
  }

  const { data: attempt, error: attemptError } = await supabase
    .from("daily_attempts")
    .upsert(
      {
        puzzle_id: puzzle.id,
        status: "in_progress",
        user_id: user.id
      },
      { ignoreDuplicates: true, onConflict: "user_id,puzzle_id" }
    )
    .select("*")
    .single();

  if (attemptError) {
    const { data: existingAttempt, error: existingError } = await supabase
      .from("daily_attempts")
      .select("*")
      .eq("user_id", user.id)
      .eq("puzzle_id", puzzle.id)
      .single();

    if (existingError) {
      return NextResponse.json({ error: attemptError.message }, { status: 500 });
    }
    return NextResponse.json({ attempt: existingAttempt });
  }

  return NextResponse.json({ attempt });
}
