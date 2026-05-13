import type { LeaderboardRow } from "@/hooks/useDailyLeaderboard";

type DailyLeaderboardProps = {
  currentUserId?: string | null;
  error?: string | null;
  loading: boolean;
  myRow?: LeaderboardRow | null;
  rows: LeaderboardRow[];
};

export default function DailyLeaderboard({ currentUserId = null, error = null, loading, myRow = null, rows }: DailyLeaderboardProps) {
  const showMyRow = Boolean(myRow && !rows.some((row) => row.user_id === myRow.user_id));

  return (
    <section className="leaderboard">
      <div className="leaderboard-title">Classement du jour</div>
      {error ? <div className="leaderboard-empty error">Classement indisponible.</div> : null}
      {loading ? <div className="leaderboard-empty">Chargement...</div> : null}
      {!loading && !error && !rows.length ? <div className="leaderboard-empty">Aucun score classé pour l’instant.</div> : null}
      {!loading && rows.length ? (
        <div className="leaderboard-list">
          {rows.map((row) => (
            <DailyLeaderboardRow currentUserId={currentUserId} key={`${row.rank}-${row.user_id}`} row={row} />
          ))}
          {showMyRow ? (
            <>
              <div className="leaderboard-separator">Ton rang</div>
              <DailyLeaderboardRow currentUserId={currentUserId} row={myRow!} />
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function DailyLeaderboardRow({ currentUserId, row }: { currentUserId: string | null; row: LeaderboardRow }) {
  const isMe = Boolean(currentUserId && row.user_id === currentUserId);

  return (
    <div className={`leaderboard-row ${isMe ? "is-me" : ""}`}>
      <span className="leaderboard-rank">#{row.rank}</span>
      <span className="leaderboard-name">{row.username || row.display_name || "Joueur"}{isMe ? " · toi" : ""}</span>
      <span className="leaderboard-score">{row.score ?? 0}</span>
      <span className="leaderboard-time">{formatDuration(row.duration_ms)}</span>
    </div>
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
