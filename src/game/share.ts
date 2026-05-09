import { MODE_INFO } from "./constants";
import { cellKey } from "./keys";
import { calculateScore } from "./scoring";
import type { GameState, Mode, Puzzle } from "./types";

const GRADES = ["🎖️ Capitaine", "🏅 Titulaire", "🔄 Joueur de rotation", "🧤 3ème gardien", "🛋️ Joueur du loft"];

export function buildShareText(mode: Mode, puzzle: Puzzle, state: GameState, date = new Date()) {
  const formattedDate = date.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
  const modeInfo = MODE_INFO[mode];
  const grade = GRADES[Math.min(state.erreurs, GRADES.length - 1)];
  const score = calculateScore(mode, puzzle, state);
  const errLabel = state.erreurs !== 1 ? "erreurs" : "erreur";
  let grid = "";

  puzzle.rows.forEach((row) => {
    puzzle.cols.forEach((col) => {
      grid += state.cellules[cellKey(row, col)]?.remplie ? "🟢" : "⬛";
    });
    grid += "\n";
  });

  return `${modeInfo.emoji} Foot Grid L1 25/26 — ${formattedDate}
${modeInfo.label}

${grid}
${grade}
✅ ${state.trouves}/9 trouvés · ❌ ${state.erreurs} ${errLabel} · 🏆 ${score} pts

👉 footgrid.fr`;
}
