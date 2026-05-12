import type { Mode } from "@/game/types";

type HomeMenuProps = {
  dailyMode: Mode | null;
  loadingDaily: boolean;
  onDaily: () => void;
  onPractice: () => void;
};

export default function HomeMenu({ dailyMode, loadingDaily, onDaily, onPractice }: HomeMenuProps) {
  return (
    <div>
      <div className="mode-title">Jouer</div>
      <div className="mode-cards">
        <button className="mode-card daily" disabled={!dailyMode || loadingDaily} onClick={onDaily}>
          <span className="mode-header">
            <span className="mode-name">Défi du jour</span>
            <span className="mode-tag">{dailyMode ? modeLabel(dailyMode) : "Bientôt"}</span>
          </span>
          <span className="mode-desc">La grille classée du jour.</span>
        </button>
        <button className="mode-card practice" onClick={onPractice}>
          <span className="mode-header">
            <span className="mode-name">Entraînement</span>
            <span className="mode-tag">Libre</span>
          </span>
          <span className="mode-desc">Choisis un format et joue une grille aléatoire.</span>
        </button>
      </div>
    </div>
  );
}

function modeLabel(mode: Mode) {
  if (mode === "cc") return "Club x Club";
  if (mode === "ca") return "Club x Année";
  return "Club x Sélection";
}
