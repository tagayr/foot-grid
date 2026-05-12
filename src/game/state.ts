import { cellKey } from "./keys";
import type { GameState, Puzzle } from "./types";

export function createInitialState(puzzle: Puzzle): GameState {
  const cellules: GameState["cellules"] = {};

  puzzle.rows.forEach((row) => {
    puzzle.cols.forEach((col) => {
      cellules[cellKey(row, col)] = { remplie: false, joueur: null };
    });
  });

  return {
    erreurs: 0,
    trouves: 0,
    cellules,
    submissions: [],
    termine: false
  };
}
