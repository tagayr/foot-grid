"use client";

import { useEffect, useMemo, useState } from "react";
import playersData from "@/data/players.generated.json";
import puzzlesData from "@/data/puzzles.generated.json";
import AuthPanel from "./auth/AuthPanel";
import { useAuth } from "./auth/AuthProvider";
import type { Mode, Player, Puzzle, PuzzlesByMode } from "@/game/types";
import { cellKey } from "@/game/keys";
import DailyLeaderboard from "@/components/leaderboard/DailyLeaderboard";
import { useDailyAttempt } from "@/hooks/useDailyAttempt";
import { useDailyLeaderboard } from "@/hooks/useDailyLeaderboard";
import { useGame } from "@/hooks/useGame";
import { usePracticeAttempt } from "@/hooks/usePracticeAttempt";
import { usePublishedPuzzles } from "@/hooks/usePublishedPuzzles";
import { useSupabasePlayers } from "@/hooks/useSupabasePlayers";
import DailyResultPanel from "./game/DailyResultPanel";
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
  const [practiceNotice, setPracticeNotice] = useState<string | null>(null);
  const [showDailyResult, setShowDailyResult] = useState(false);
  const [leaderboardRefreshKey, setLeaderboardRefreshKey] = useState(0);
  const activePuzzles = useMemo(
    () => ({ ...publishedPuzzles.puzzles, ...practicePuzzles }),
    [practicePuzzles, publishedPuzzles.puzzles]
  );
  const game = useGame({ players: activePlayers, puzzles: activePuzzles });
  const dailyAttempt = useDailyAttempt();
  const practiceAttempt = usePracticeAttempt();
  const { loading, session, user } = useAuth();
  const [showAccount, setShowAccount] = useState(false);
  const inGame = Boolean(game.mode && game.puzzle && game.state);
  const dailyMode = publishedPuzzles.publishedModes[0] ?? null;
  const dailyPuzzleId = dailyMode ? publishedPuzzles.puzzles[dailyMode]?.id : undefined;
  const leaderboard = useDailyLeaderboard(dailyPuzzleId, leaderboardRefreshKey);

  useEffect(() => {
    let active = true;
    if (!user || !dailyPuzzleId) {
      setShowDailyResult(false);
      return;
    }

    dailyAttempt
      .loadStatus(dailyPuzzleId)
      .then((attempt) => {
        if (active && attempt?.status === "completed") {
          setShowDailyResult(true);
        }
      })
      .catch((error) => console.warn("Unable to load daily attempt status.", error));

    return () => {
      active = false;
    };
  }, [dailyAttempt.loadStatus, dailyPuzzleId, user?.id]);

  useEffect(() => {
    if (!pendingPracticeMode || !practicePuzzles[pendingPracticeMode]) {
      return;
    }
    game.startGame(pendingPracticeMode);
    setPendingPracticeMode(null);
    setScreen("home");
  }, [game, pendingPracticeMode, practicePuzzles]);

  useEffect(() => {
    if (!user || !game.puzzle?.id || !game.state?.termine) {
      return;
    }

    const completion = {
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
      puzzleId: game.puzzle.id
    };

    if (playKind === "daily") {
      void dailyAttempt
        .completeAttempt(completion)
        .then((attempt) => {
          if (attempt) {
            setLeaderboardRefreshKey((value) => value + 1);
            setShowDailyResult(true);
            if (game.puzzle?.id) {
              void dailyAttempt.loadStatus(game.puzzle.id);
            }
          }
        })
        .catch((error) => console.warn("Unable to submit ranked daily attempt.", error));
      return;
    }

    if (playKind === "practice") {
      void practiceAttempt
        .completeAttempt(completion)
        .catch((error) => console.warn("Unable to submit practice attempt.", error));
    }
  }, [dailyAttempt, game.puzzle, game.state, playKind, practiceAttempt, user]);

  async function startDaily() {
    if (!dailyMode || !dailyPuzzleId) {
      return;
    }

    if (user) {
      if (dailyAttempt.attempt?.status === "completed") {
        setShowDailyResult(true);
        return;
      }

      const attempt = await dailyAttempt.startAttempt(dailyPuzzleId);
      if (attempt?.status === "completed") {
        void dailyAttempt.loadStatus(dailyPuzzleId);
        setShowDailyResult(true);
        return;
      }
    }

    setShowDailyResult(false);
    setPlayKind("daily");
    game.startGame(dailyMode);
  }

  async function startPractice(mode: Mode) {
    setPracticeLoadingMode(mode);
    setPracticeNotice(null);
    try {
      const practicePuzzleResponse = await loadPracticePuzzle(mode, session?.access_token);
      const practicePuzzle = practicePuzzleResponse.puzzle;
      if (!practicePuzzle) {
        setPracticeNotice("Aucune grille d'entraînement disponible pour ce mode.");
        return;
      }
      if (practicePuzzleResponse.exhaustedFreshPuzzles) {
        setPracticeNotice("Tu as terminé toutes les grilles de ce mode. On te sert une grille déjà jouée.");
      }
      if (user && practicePuzzle.id) {
        await practiceAttempt.startAttempt(practicePuzzle.id);
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
          {practiceNotice ? <div className="practice-notice">{practiceNotice}</div> : null}
          <ModePicker loadingMode={practiceLoadingMode} onStart={startPractice} title="Entraînement" />
        </>
      ) : (
        <>
          {showDailyResult && dailyAttempt.attempt?.status === "completed" ? (
            <>
              <DailyResultPanel
                durationMs={dailyAttempt.attempt.duration_ms}
                errors={dailyAttempt.attempt.error_count}
                found={dailyAttempt.attempt.found_count}
                onClose={() => setShowDailyResult(false)}
                rank={dailyAttempt.rank}
                score={dailyAttempt.attempt.score}
              />
              <DailyLeaderboard loading={leaderboard.loading} rows={leaderboard.rows} />
            </>
          ) : null}
          <HomeMenu
            dailyDescription={dailyDescription(Boolean(user), dailyAttempt.attempt?.status)}
            dailyLabel={dailyLabel(Boolean(user), dailyAttempt.attempt?.status)}
            dailyMode={dailyMode}
            loadingDaily={publishedPuzzles.loading || dailyAttempt.loading}
            onDaily={startDaily}
            onPractice={() => setScreen("practice")}
          />
        </>
      ) : (
        <section>
          <button className="back-btn" onClick={game.backToMenu}>
            ← Changer de mode
          </button>
          {playKind === "practice" && practiceNotice ? <div className="practice-notice">{practiceNotice}</div> : null}
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

function dailyLabel(isLoggedIn: boolean, status?: "in_progress" | "completed" | "failed" | "abandoned") {
  if (isLoggedIn && status === "completed") {
    return "Voir mon score";
  }
  if (isLoggedIn && status === "in_progress") {
    return "Continuer le défi";
  }
  return "Défi du jour";
}

function dailyDescription(isLoggedIn: boolean, status?: "in_progress" | "completed" | "failed" | "abandoned") {
  if (!isLoggedIn) {
    return "Joue en local. Connecte-toi pour entrer au classement.";
  }
  if (status === "completed") {
    return "Ton score est déjà enregistré pour aujourd'hui.";
  }
  if (status === "in_progress") {
    return "Reprends ton essai classé du jour.";
  }
  return "La grille classée du jour.";
}

async function loadPracticePuzzle(mode: Mode, accessToken?: string) {
  const response = await fetch("/api/practice-puzzle/random", {
    body: JSON.stringify({ mode }),
    headers: {
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      "content-type": "application/json"
    },
    method: "POST"
  });
  const payload = (await response.json()) as {
    error?: string;
    exhaustedFreshPuzzles?: boolean;
    puzzle?: Puzzle | null;
  };

  if (!response.ok) {
    throw new Error(payload.error ?? "Unable to load practice puzzle.");
  }

  return {
    exhaustedFreshPuzzles: Boolean(payload.exhaustedFreshPuzzles),
    puzzle: payload.puzzle ?? null
  };
}
