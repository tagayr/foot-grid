import type { LeaderboardRow } from "@/hooks/useDailyLeaderboard";

type DailyLeaderboardProps = {
  loading: boolean;
  rows: LeaderboardRow[];
};

export default function DailyLeaderboard({ loading, rows }: DailyLeaderboardProps) {
  return (
    <section className="leaderboard">
      <div className="leaderboard-title">Classement du jour</div>
      {loading ? <div className="leaderboard-empty">Chargement...</div> : null}
      {!loading && !rows.length ? <div className="leaderboard-empty">Aucun score classé pour l’instant.</div> : null}
      {!loading && rows.length ? (
        <div className="leaderboard-list">
          {rows.map((row) => (
            <div className="leaderboard-row" key={`${row.rank}-${row.user_id}`}>
              <span className="leaderboard-rank">#{row.rank}</span>
              <span className="leaderboard-name">{row.username || row.display_name || "Joueur"}</span>
              <span className="leaderboard-score">{row.score ?? 0}</span>
              <span className="leaderboard-time">{formatDuration(row.duration_ms)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function formatDuration(durationMs: number | null) {
  if (durationMs == null) {
    return "-";
  }
  const seconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}
