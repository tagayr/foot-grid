"use client";

import { useEffect, useMemo, useState } from "react";
import { loadPublishedPuzzlesForDate } from "@/lib/puzzles/loadPublishedPuzzles";
import { useAuth } from "@/components/auth/AuthProvider";
import type { PuzzlesByMode } from "@/game/types";

type UsePublishedPuzzlesResult = {
  publishedModes: Array<keyof PuzzlesByMode>;
  loading: boolean;
  puzzles: PuzzlesByMode;
  source: "local" | "supabase";
};

export function usePublishedPuzzles(fallbackPuzzles: PuzzlesByMode, date = todayIsoDate()): UsePublishedPuzzlesResult {
  const { supabase } = useAuth();
  const [remotePuzzles, setRemotePuzzles] = useState<Partial<PuzzlesByMode>>({});
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<"local" | "supabase">("local");

  useEffect(() => {
    let active = true;

    loadPublishedPuzzlesForDate(supabase, date)
      .then((publishedPuzzles) => {
        if (!active) {
          return;
        }
        setRemotePuzzles(publishedPuzzles);
        setSource(Object.keys(publishedPuzzles).length ? "supabase" : "local");
      })
      .catch((error) => {
        console.warn("Unable to load published puzzles from Supabase; falling back to local puzzles.", error);
        if (active) {
          setRemotePuzzles({});
          setSource("local");
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
  }, [date, supabase]);

  const puzzles = useMemo(
    () => ({
      ...fallbackPuzzles,
      ...remotePuzzles
    }),
    [fallbackPuzzles, remotePuzzles]
  );

  return { loading, publishedModes: Object.keys(remotePuzzles) as Array<keyof PuzzlesByMode>, puzzles, source };
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}
