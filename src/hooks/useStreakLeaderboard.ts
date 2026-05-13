"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";

export type StreakLeaderboardRow = {
  best_rank: number | null;
  best_streak: number | null;
  current_rank: number | null;
  current_streak: number | null;
  display_name: string | null;
  last_completed_date: string | null;
  user_id: string | null;
  username: string | null;
};

export function useStreakLeaderboard() {
  const { session, user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [myRow, setMyRow] = useState<StreakLeaderboardRow | null>(null);
  const [rows, setRows] = useState<StreakLeaderboardRow[]>([]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetch("/api/streak-leaderboard", {
      headers: {
        ...(session?.access_token ? { authorization: `Bearer ${session.access_token}` } : {})
      }
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load streak leaderboard.");
        }
        if (active) {
          setMyRow(payload.myRow ?? null);
          setRows(payload.rows ?? []);
        }
      })
      .catch((caughtError) => {
        console.warn("Unable to load streak leaderboard.", caughtError);
        if (active) {
          setError(caughtError instanceof Error ? caughtError.message : "Unable to load streak leaderboard.");
          setMyRow(null);
          setRows([]);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [session?.access_token]);

  return { currentUserId: user?.id ?? null, error, loading, myRow, rows };
}
