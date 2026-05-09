"use client";

import { useEffect, useMemo, useState } from "react";
import { MAX_ERRORS } from "@/game/constants";
import { calculateScore } from "@/game/scoring";
import { buildShareText } from "@/game/share";
import { createInitialState } from "@/game/state";
import type { GameState, Mode, Player, PuzzlesByMode } from "@/game/types";
import { validateAnswer } from "@/game/validation";
import type { ActiveCell } from "@/components/game/types";

type UseGameInput = {
  players: Player[];
  puzzles: PuzzlesByMode;
};

type FootGridHistoryState =
  | {
      footGrid: "home";
    }
  | {
      footGrid: "game";
      mode: Mode;
    };

export function useGame({ players, puzzles }: UseGameInput) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null);
  const [toast, setToast] = useState("");
  const [shareText, setShareText] = useState("");

  const puzzle = mode ? puzzles[mode] : null;
  const score = useMemo(() => {
    if (!mode || !puzzle || !state) {
      return 0;
    }
    return calculateScore(mode, puzzle, state);
  }, [mode, puzzle, state]);

  useEffect(() => {
    const initialMode = getModeFromUrl();
    if (initialMode && puzzles[initialMode]) {
      window.history.replaceState({ footGrid: "game", mode: initialMode } satisfies FootGridHistoryState, "", window.location.href);
      startGameState(initialMode);
    } else {
      window.history.replaceState({ footGrid: "home" } satisfies FootGridHistoryState, "", window.location.pathname);
    }

    function handlePopState(event: PopStateEvent) {
      const historyState = event.state as FootGridHistoryState | null;
      if (historyState?.footGrid === "game" && puzzles[historyState.mode]) {
        startGameState(historyState.mode);
        return;
      }
      resetToMenu();
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [puzzles]);

  function startGameState(nextMode: Mode) {
    setMode(nextMode);
    setState(createInitialState(puzzles[nextMode]));
    setActiveCell(null);
    setShareText("");
  }

  function startGame(nextMode: Mode) {
    startGameState(nextMode);
    window.history.pushState(
      { footGrid: "game", mode: nextMode } satisfies FootGridHistoryState,
      "",
      buildModeUrl(nextMode)
    );
  }

  function resetToMenu() {
    setMode(null);
    setState(null);
    setActiveCell(null);
    setShareText("");
  }

  function backToMenu() {
    resetToMenu();
    window.history.replaceState({ footGrid: "home" } satisfies FootGridHistoryState, "", window.location.pathname);
  }

  function closeModal() {
    setActiveCell(null);
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2000);
  }

  function selectPlayer(playerName: string) {
    if (!mode || !puzzle || !state || !activeCell) {
      return;
    }

    setActiveCell(null);
    const ok = validateAnswer({ puzzle, players, playerName, ...activeCell });
    const nextState: GameState = structuredClone(state);

    if (ok) {
      nextState.cellules[activeCell.key] = { remplie: true, joueur: playerName };
      nextState.trouves += 1;
      nextState.termine = nextState.trouves === 9;
      showToast("✅ Correct !");
    } else {
      nextState.erreurs += 1;
      nextState.termine = nextState.erreurs >= MAX_ERRORS;
      showToast("❌ Joueur invalide pour cette case");
    }

    setState(nextState);
    if (nextState.termine) {
      setShareText(buildShareText(mode, puzzle, nextState));
    }
  }

  async function shareResult() {
    if (!mode || !puzzle || !state) {
      return;
    }

    const text = buildShareText(mode, puzzle, state);
    setShareText(text);

    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch (_) {}
    }

    await navigator.clipboard?.writeText(text);
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  return {
    activeCell,
    backToMenu,
    closeModal,
    mode,
    puzzle,
    score,
    selectPlayer,
    setActiveCell,
    shareResult,
    shareText,
    startGame,
    state,
    toast
  };
}

function buildModeUrl(mode: Mode) {
  const url = new URL(window.location.href);
  url.searchParams.set("mode", mode);
  return `${url.pathname}${url.search}`;
}

function getModeFromUrl(): Mode | null {
  const mode = new URL(window.location.href).searchParams.get("mode");
  return isMode(mode) ? mode : null;
}

function isMode(mode: string | null): mode is Mode {
  return mode === "cc" || mode === "ca" || mode === "cs";
}
