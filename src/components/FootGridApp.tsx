"use client";

import { useState } from "react";
import playersData from "@/data/players.generated.json";
import puzzlesData from "@/data/puzzles.generated.json";
import AuthPanel from "./auth/AuthPanel";
import { useAuth } from "./auth/AuthProvider";
import type { Player, PuzzlesByMode } from "@/game/types";
import { useGame } from "@/hooks/useGame";
import { usePublishedPuzzles } from "@/hooks/usePublishedPuzzles";
import { useSupabasePlayers } from "@/hooks/useSupabasePlayers";
import EndScreen from "./game/EndScreen";
import ErrorsRow from "./game/ErrorsRow";
import GameGrid from "./game/GameGrid";
import Header from "./game/Header";
import ModePicker from "./game/ModePicker";
import RulesPanel from "./game/RulesPanel";
import SearchModal from "./game/SearchModal";

const players = playersData as Player[];
const puzzles = puzzlesData as PuzzlesByMode;

export default function FootGridApp() {
  const publishedPuzzles = usePublishedPuzzles(puzzles);
  const supabasePlayers = useSupabasePlayers(publishedPuzzles.source === "supabase");
  const activePlayers = publishedPuzzles.source === "supabase" && supabasePlayers.players.length ? supabasePlayers.players : players;
  const game = useGame({ players: activePlayers, puzzles: publishedPuzzles.puzzles });
  const { loading, user } = useAuth();
  const [showAccount, setShowAccount] = useState(false);
  const inGame = Boolean(game.mode && game.puzzle && game.state);

  return (
    <main className="wrap">
      <Header score={game.score} found={game.state?.trouves ?? 0} inGame={inGame} />
      <div className="account-bar">
        <span>{loading ? "Session..." : user ? `Connecté${user.email ? ` · ${user.email}` : ""}` : "Joue en invité"}</span>
        <span className="puzzle-source">{publishedPuzzles.loading ? "Grilles..." : publishedPuzzles.source}</span>
        <button className="account-btn" onClick={() => setShowAccount((value) => !value)}>
          {user ? "Mon espace" : "Connexion"}
        </button>
      </div>
      {showAccount ? <AuthPanel onClose={() => setShowAccount(false)} /> : null}
      {!game.mode || !game.puzzle || !game.state ? (
        <ModePicker onStart={game.startGame} />
      ) : (
        <section>
          <button className="back-btn" onClick={game.backToMenu}>
            ← Changer de mode
          </button>
          <RulesPanel mode={game.mode} />
          <ErrorsRow errors={game.state.erreurs} />
          <GameGrid puzzle={game.puzzle} state={game.state} onCell={game.setActiveCell} />
          {game.state.termine ? (
            <EndScreen
              mode={game.mode}
              found={game.state.trouves}
              score={game.score}
              errors={game.state.erreurs}
              shareText={game.shareText}
              onShare={game.shareResult}
              onBackToMenu={game.backToMenu}
            />
          ) : null}
        </section>
      )}
      {game.activeCell ? (
        <SearchModal
          activeCell={game.activeCell}
          loading={publishedPuzzles.source === "supabase" && supabasePlayers.loading}
          players={activePlayers}
          onClose={game.closeModal}
          onSelect={game.selectPlayer}
        />
      ) : null}
      {game.toast ? <div className="toast show">{game.toast}</div> : null}
    </main>
  );
}
