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
    .select("id")
    .eq("id", body.puzzleId)
    .eq("kind", "practice")
    .eq("status", "published")
    .maybeSingle();

  if (puzzleError) {
    return NextResponse.json({ error: puzzleError.message }, { status: 500 });
  }
  if (!puzzle) {
    return NextResponse.json({ error: "Puzzle is not a published practice puzzle." }, { status: 400 });
  }

  const { data: attempt, error: attemptError } = await supabase
    .from("random_attempts")
    .insert({
      puzzle_id: puzzle.id,
      user_id: user.id
    })
    .select("*")
    .single();

  if (attemptError) {
    return NextResponse.json({ error: attemptError.message }, { status: 500 });
  }

  return NextResponse.json({ attempt });
}
