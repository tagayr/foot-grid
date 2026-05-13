import { NextResponse } from "next/server";
import { getAdminClient, getAuthenticatedUser } from "@/lib/api/auth";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const hasBearer = authHeader?.startsWith("Bearer ");
  const auth = hasBearer ? await getAuthenticatedUser(request) : { error: null, user: null };
  if (hasBearer && !auth.user) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("streak_leaderboard")
    .select("user_id, display_name, username, current_streak, best_streak, last_completed_date, current_rank, best_rank")
    .order("current_rank", { ascending: true })
    .limit(10);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let myRow = null;
  if (auth.user) {
    const { data: userRow, error: userRowError } = await supabase
      .from("streak_leaderboard")
      .select("user_id, display_name, username, current_streak, best_streak, last_completed_date, current_rank, best_rank")
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (userRowError) {
      return NextResponse.json({ error: userRowError.message }, { status: 500 });
    }
    myRow = userRow;
  }

  return NextResponse.json({ myRow, rows: data ?? [] });
}
