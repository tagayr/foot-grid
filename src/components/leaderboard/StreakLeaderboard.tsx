import type { StreakLeaderboardRow } from "@/hooks/useStreakLeaderboard";

type StreakLeaderboardProps = {
  currentUserId?: string | null;
  error?: string | null;
  loading: boolean;
  myRow?: StreakLeaderboardRow | null;
  rows: StreakLeaderboardRow[];
};

export default function StreakLeaderboard({ currentUserId = null, error = null, loading, myRow = null, rows }: StreakLeaderboardProps) {
  const showMyRow = Boolean(myRow && !rows.some((row) => row.user_id === myRow.user_id));

  return (
    <section className="leaderboard">
      <div className="leaderboard-title">Séries</div>
      {error ? <div className="leaderboard-empty error">Classement des séries indisponible.</div> : null}
      {loading ? <div className="leaderboard-empty">Chargement...</div> : null}
      {!loading && !error && !rows.length ? <div className="leaderboard-empty">Aucune série classée pour l’instant.</div> : null}
      {!loading && rows.length ? (
        <div className="leaderboard-list">
          {rows.map((row) => (
            <StreakRow currentUserId={currentUserId} key={`${row.current_rank}-${row.user_id}`} row={row} />
          ))}
          {showMyRow ? (
            <>
              <div className="leaderboard-separator">Ta série</div>
              <StreakRow currentUserId={currentUserId} row={myRow!} />
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function StreakRow({ currentUserId, row }: { currentUserId: string | null; row: StreakLeaderboardRow }) {
  const isMe = Boolean(currentUserId && row.user_id === currentUserId);

  return (
    <div className={`leaderboard-row streak-row ${isMe ? "is-me" : ""}`}>
      <span className="leaderboard-rank">#{row.current_rank}</span>
      <span className="leaderboard-name">{row.username || row.display_name || "Joueur"}{isMe ? " · toi" : ""}</span>
      <span className="leaderboard-score">{row.current_streak ?? 0} j</span>
      <span className="leaderboard-time">max {row.best_streak ?? 0}</span>
    </div>
  );
}
