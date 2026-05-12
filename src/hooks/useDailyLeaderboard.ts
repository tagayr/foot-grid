"use client";

import { useEffect, useState } from "react";

export type LeaderboardRow = {
  completed_at: string | null;
  display_name: string | null;
  duration_ms: number | null;
  error_count: number | null;
  found_count: number | null;
  rank: number | null;
  score: number | null;
  user_id: string | null;
  username: string | null;
};

export function useDailyLeaderboard(puzzleId: string | undefined, refreshKey = 0) {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    if (!puzzleId) {
      setRows([]);
      return;
    }

    setLoading(true);
    fetch(`/api/daily-leaderboard?puzzleId=${encodeURIComponent(puzzleId)}`)
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load leaderboard.");
        }
        if (active) {
          setRows(payload.rows ?? []);
        }
      })
      .catch((error) => {
        console.warn("Unable to load daily leaderboard.", error);
        if (active) {
          setRows([]);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [puzzleId, refreshKey]);

  return { loading, rows };
}
