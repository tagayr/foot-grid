"use client";

import { useEffect, useMemo, useState } from "react";
import playersData from "@/data/players.generated.json";
import puzzlesData from "@/data/puzzles.generated.json";
import AuthPanel from "./auth/AuthPanel";
import { useAuth } from "./auth/AuthProvider";
import type { Mode, Player, PuzzlesByMode } from "@/game/types";
import { cellKey } from "@/game/keys";
import { loadRandomPracticePuzzle } from "@/lib/puzzles/loadPublishedPuzzles";
import DailyLeaderboard from "@/components/leaderboard/DailyLeaderboard";
import { useDailyAttempt } from "@/hooks/useDailyAttempt";
import { useDailyLeaderboard } from "@/hooks/useDailyLeaderboard";
import { useGame } from "@/hooks/useGame";
import { usePublishedPuzzles } from "@/hooks/usePublishedPuzzles";
import { useSupabasePlayers } from "@/hooks/useSupabasePlayers";
import EndScreen from "./game/EndScreen";
import ErrorsRow from "./game/ErrorsRow";
import GameGrid from "./game/GameGrid";
import Header from "./game/Header";
import HomeMenu from "./game/HomeMenu";
import ModePicker from "./game/ModePicker";
import RulesPanel from "./game/RulesPanel";
import SearchModal from "./game/SearchModal";

const players = playersData as Player[];
const puzzles = puzzlesData as PuzzlesByMode;

export default function FootGridApp() {
  const publishedPuzzles = usePublishedPuzzles(puzzles);
  const supabasePlayers = useSupabasePlayers(publishedPuzzles.source === "supabase");
  const activePlayers = publishedPuzzles.source === "supabase" && supabasePlayers.players.length ? supabasePlayers.players : players;
  const [screen, setScreen] = useState<"home" | "practice">("home");
  const [playKind, setPlayKind] = useState<"daily" | "practice" | null>(null);
  const [practicePuzzles, setPracticePuzzles] = useState<Partial<PuzzlesByMode>>({});
  const [practiceLoadingMode, setPracticeLoadingMode] = useState<Mode | null>(null);
  const [pendingPracticeMode, setPendingPracticeMode] = useState<Mode | null>(null);
  const [leaderboardRefreshKey, setLeaderboardRefreshKey] = useState(0);
  const activePuzzles = useMemo(
    () => ({ ...publishedPuzzles.puzzles, ...practicePuzzles }),
    [practicePuzzles, publishedPuzzles.puzzles]
  );
  const game = useGame({ players: activePlayers, puzzles: activePuzzles });
  const dailyAttempt = useDailyAttempt();
  const { loading, supabase, user } = useAuth();
  const [showAccount, setShowAccount] = useState(false);
  const inGame = Boolean(game.mode && game.puzzle && game.state);
  const dailyMode = publishedPuzzles.publishedModes[0] ?? null;
  const dailyPuzzleId = dailyMode ? publishedPuzzles.puzzles[dailyMode]?.id : undefined;
  const leaderboard = useDailyLeaderboard(dailyPuzzleId, leaderboardRefreshKey);

  useEffect(() => {
    if (!pendingPracticeMode || !practicePuzzles[pendingPracticeMode]) {
      return;
    }
    game.startGame(pendingPracticeMode);
    setPendingPracticeMode(null);
    setScreen("home");
  }, [game, pendingPracticeMode, practicePuzzles]);

  useEffect(() => {
    if (playKind !== "daily" || !game.puzzle?.id || !game.state?.termine) {
      return;
    }

    void dailyAttempt
      .completeAttempt({
        answers: game.state.submissions
          .map((submission) => {
            const key = submission.key;
            const rowPosition = game.puzzle?.rows.findIndex((row) =>
              game.puzzle?.cols.some((col) => cellKey(row, col) === key)
            ) ?? -1;
            const colPosition = game.puzzle?.cols.findIndex((col) =>
              game.puzzle?.rows.some((row) => cellKey(row, col) === key)
            ) ?? -1;
            return {
              colPosition,
              playerName: submission.playerName,
              rowPosition
            };
          })
          .filter((answer) => answer.rowPosition >= 0 && answer.colPosition >= 0),
        gaveUp: game.state.trouves < 9 && game.state.erreurs < 4,
        puzzleId: game.puzzle.id,
      })
      .then((attempt) => {
        if (attempt) {
          setLeaderboardRefreshKey((value) => value + 1);
        }
      })
      .catch((error) => console.warn("Unable to submit ranked daily attempt.", error));
  }, [dailyAttempt, game.puzzle?.id, game.score, game.state?.erreurs, game.state?.termine, game.state?.trouves, playKind]);

  async function startDaily() {
    if (!dailyMode || !dailyPuzzleId) {
      return;
    }

    if (user) {
      await dailyAttempt.startAttempt(dailyPuzzleId);
    }

    setPlayKind("daily");
    game.startGame(dailyMode);
  }

  async function startPractice(mode: Mode) {
    setPracticeLoadingMode(mode);
    try {
      const practicePuzzle = await loadRandomPracticePuzzle(supabase, mode);
      if (!practicePuzzle) {
        return;
      }
      setPracticePuzzles((current) => ({ ...current, [mode]: practicePuzzle }));
      setPendingPracticeMode(mode);
      setPlayKind("practice");
    } catch (error) {
      console.warn("Unable to load practice puzzle from Supabase.", error);
    } finally {
      setPracticeLoadingMode(null);
    }
  }

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
      {!game.mode || !game.puzzle || !game.state ? screen === "practice" ? (
        <>
          <button className="back-btn" onClick={() => setScreen("home")}>
            ← Retour
          </button>
          <ModePicker loadingMode={practiceLoadingMode} onStart={startPractice} title="Entraînement" />
        </>
      ) : (
        <HomeMenu
          dailyMode={dailyMode}
          loadingDaily={publishedPuzzles.loading || dailyAttempt.loading}
          onDaily={startDaily}
          onPractice={() => setScreen("practice")}
        />
      ) : (
        <section>
          <button className="back-btn" onClick={game.backToMenu}>
            ← Changer de mode
          </button>
          <RulesPanel mode={game.mode} />
          <ErrorsRow errors={game.state.erreurs} />
          <GameGrid puzzle={game.puzzle} state={game.state} onCell={game.setActiveCell} />
          {!game.state.termine ? (
            <button className="give-up-btn" onClick={game.giveUp}>
              J’abandonne · voir mon score
            </button>
          ) : null}
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
          {playKind === "daily" ? <DailyLeaderboard loading={leaderboard.loading} rows={leaderboard.rows} /> : null}
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
