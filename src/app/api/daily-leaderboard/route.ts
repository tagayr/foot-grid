import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/api/auth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const puzzleId = searchParams.get("puzzleId");
  if (!puzzleId) {
    return NextResponse.json({ error: "Missing puzzleId." }, { status: 400 });
  }

  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("daily_leaderboard")
    .select("rank, user_id, display_name, username, score, found_count, error_count, duration_ms, completed_at")
    .eq("puzzle_id", puzzleId)
    .order("rank", { ascending: true })
    .limit(25);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ rows: data ?? [] });
}
