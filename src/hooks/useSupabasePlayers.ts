"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import type { Player } from "@/game/types";

type UseSupabasePlayersResult = {
  loading: boolean;
  players: Player[];
};

export function useSupabasePlayers(enabled: boolean): UseSupabasePlayersResult {
  const { supabase } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    if (!enabled) {
      setPlayers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    loadAllSupabasePlayers()
      .then((nextPlayers) => {
        if (active) {
          setPlayers(nextPlayers);
        }
      })
      .catch((error) => {
        console.warn("Unable to load Supabase players; falling back to local search data.", error);
        if (active) {
          setPlayers([]);
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

    async function loadAllSupabasePlayers() {
      const rows: Array<{ display_name: string }> = [];
      const pageSize = 1000;

      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
          .from("players")
          .select("display_name")
          .order("display_name", { ascending: true })
          .range(from, from + pageSize - 1);

        if (error) {
          throw error;
        }

        rows.push(...(data ?? []));
        if (!data || data.length < pageSize) {
          break;
        }
      }

      return rows.map((row) => ({
        nom: row.display_name,
        clubs: [],
        sels: [],
        carriere: [],
      }));
    }
  }, [enabled, supabase]);

  return { loading, players };
}
