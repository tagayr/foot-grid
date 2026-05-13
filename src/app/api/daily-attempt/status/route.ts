import { NextResponse } from "next/server";
import { getAdminClient, getAuthenticatedUser } from "@/lib/api/auth";

export async function GET(request: Request) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  const url = new URL(request.url);
  const puzzleId = url.searchParams.get("puzzleId");
  if (!puzzleId) {
    return NextResponse.json({ error: "Missing puzzleId." }, { status: 400 });
  }

  const supabase = getAdminClient();
  const { data: puzzle, error: puzzleError } = await supabase
    .from("puzzles")
    .select("id")
    .eq("id", puzzleId)
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
    .select("*")
    .eq("user_id", user.id)
    .eq("puzzle_id", puzzleId)
    .maybeSingle();

  if (attemptError) {
    return NextResponse.json({ error: attemptError.message }, { status: 500 });
  }

  let rank = null;
  if (attempt?.status === "completed") {
    try {
      rank = await loadRank(supabase, puzzleId, user.id);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Unable to load daily rank." },
        { status: 500 }
      );
    }
  }
  return NextResponse.json({ attempt, rank });
}

async function loadRank(supabase: ReturnType<typeof getAdminClient>, puzzleId: string, userId: string) {
  const { data, error } = await supabase
    .from("daily_leaderboard")
    .select("rank")
    .eq("puzzle_id", puzzleId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.rank ?? null;
}
