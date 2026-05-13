import { NextResponse } from "next/server";
import { getAdminClient, getAuthenticatedUser } from "@/lib/api/auth";
import type { Mode } from "@/game/types";
import { appModeToDbMode } from "@/lib/puzzles/modes";
import { loadPuzzlesByIds } from "@/lib/puzzles/loadPublishedPuzzles";

type RandomPracticeBody = {
  mode?: Mode;
};

export async function POST(request: Request) {
  const body = (await request.json()) as RandomPracticeBody;
  if (!isMode(body.mode)) {
    return NextResponse.json({ error: "Invalid practice mode." }, { status: 400 });
  }

  const authHeader = request.headers.get("authorization");
  const hasBearer = authHeader?.startsWith("Bearer ");
  const auth = hasBearer ? await getAuthenticatedUser(request) : { error: null, user: null };
  if (hasBearer && !auth.user) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const supabase = getAdminClient();
  const { data: puzzleRows, error: puzzleError } = await supabase
    .from("puzzles")
    .select("id")
    .eq("kind", "practice")
    .eq("status", "published")
    .is("puzzle_date", null)
    .eq("mode", appModeToDbMode(body.mode));

  if (puzzleError) {
    return NextResponse.json({ error: puzzleError.message }, { status: 500 });
  }

  const publishedPuzzleIds = (puzzleRows ?? []).map((puzzle) => puzzle.id);
  if (!publishedPuzzleIds.length) {
    return NextResponse.json({ exhaustedFreshPuzzles: false, puzzle: null });
  }

  let completedPuzzleIds = new Set<string>();
  if (auth.user) {
    try {
      completedPuzzleIds = await loadCompletedPracticePuzzleIds(supabase, auth.user.id, publishedPuzzleIds);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Unable to load completed practice puzzles." },
        { status: 500 }
      );
    }
  }
  const freshPuzzleIds = publishedPuzzleIds.filter((puzzleId) => !completedPuzzleIds.has(puzzleId));
  const exhaustedFreshPuzzles = Boolean(auth.user && freshPuzzleIds.length === 0);
  const selectablePuzzleIds = freshPuzzleIds.length ? freshPuzzleIds : publishedPuzzleIds;
  const selectedPuzzleId = selectablePuzzleIds[Math.floor(Math.random() * selectablePuzzleIds.length)];
  const puzzles = await loadPuzzlesByIds(supabase, [selectedPuzzleId]);

  return NextResponse.json({
    exhaustedFreshPuzzles,
    puzzle: puzzles.get(selectedPuzzleId) ?? null
  });
}

async function loadCompletedPracticePuzzleIds(
  supabase: ReturnType<typeof getAdminClient>,
  userId: string,
  puzzleIds: string[]
) {
  const { data, error } = await supabase
    .from("random_attempts")
    .select("puzzle_id")
    .eq("user_id", userId)
    .not("completed_at", "is", null)
    .in("puzzle_id", puzzleIds);

  if (error) {
    throw error;
  }

  return new Set((data ?? []).map((attempt) => attempt.puzzle_id));
}

function isMode(mode: unknown): mode is Mode {
  return mode === "cc" || mode === "ca" || mode === "cs";
}
