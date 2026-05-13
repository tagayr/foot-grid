type DailyResultPanelProps = {
  durationMs: number | null;
  errors: number;
  found: number;
  onClose: () => void;
  rank: number | null;
  score: number;
};

export default function DailyResultPanel({ durationMs, errors, found, onClose, rank, score }: DailyResultPanelProps) {
  return (
    <section className="daily-result">
      <div>
        <div className="daily-result-kicker">Défi du jour terminé</div>
        <h2>Ton score est enregistré</h2>
      </div>
      <div className="daily-result-grid">
        <ResultStat label="Score" value={`${score} pts`} />
        <ResultStat label="Bonnes réponses" value={`${found}/9`} />
        <ResultStat label="Erreurs" value={errors} />
        <ResultStat label="Temps" value={formatDuration(durationMs)} />
        <ResultStat label="Rang" value={rank ? `#${rank}` : "-"} />
      </div>
      <button className="secondary-btn" onClick={onClose}>
        Retour
      </button>
    </section>
  );
}

function ResultStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="daily-result-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatDuration(durationMs: number | null) {
  if (durationMs == null) {
    return "-";
  }
  const seconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}
