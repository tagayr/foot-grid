"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthProvider";
import type { Database } from "@/lib/supabase/database.types";

type AuthPanelProps = {
  onClose: () => void;
};

export default function AuthPanel({ onClose }: AuthPanelProps) {
  const { profile, refreshProfile, supabase, user } = useAuth();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [profileDisplayName, setProfileDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const accountStats = useAccountStats(Boolean(user));

  useEffect(() => {
    setProfileDisplayName(profile?.display_name ?? "");
    setUsername(profile?.username ?? "");
  }, [profile?.display_name, profile?.username]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");

    const response =
      mode === "sign-in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                display_name: displayName || email
              }
            }
          });

    setSubmitting(false);

    if (response.error) {
      setMessage(response.error.message);
      return;
    }

    await refreshProfile();
    setMessage(mode === "sign-in" ? "Connexion réussie." : "Compte créé. Vérifie tes emails si Supabase demande confirmation.");
  }

  async function signOut() {
    await supabase.auth.signOut();
    onClose();
  }

  async function updateProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;

    setSubmitting(true);
    setMessage("");

    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: profileDisplayName.trim() || null,
        username: username.trim() || null
      })
      .eq("id", user.id);

    setSubmitting(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    await refreshProfile();
    setMessage("Profil mis à jour.");
  }

  return (
    <div className="account-panel">
      <div className="account-panel-header">
        <div>
          <div className="account-eyebrow">Espace joueur</div>
          <h2>{user ? "Mon espace" : mode === "sign-in" ? "Connexion" : "Créer un compte"}</h2>
        </div>
        <button className="icon-text-btn" onClick={onClose}>
          Fermer
        </button>
      </div>

      {user ? (
        <div className="account-content">
          <div className="account-row">
            <span>Email</span>
            <strong>{user.email}</strong>
          </div>
          <form className="auth-form" onSubmit={updateProfile}>
            <label>
              Nom affiché
              <input value={profileDisplayName} onChange={(event) => setProfileDisplayName(event.target.value)} />
            </label>
            <label>
              Username
              <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="tarik" />
            </label>
            <button className="primary-btn" disabled={submitting}>
              {submitting ? "..." : "Mettre à jour"}
            </button>
          </form>
          <AccountStatsView stats={accountStats} />
          {message ? <p className="auth-message">{message}</p> : null}
          <button className="secondary-btn" onClick={signOut}>
            Se déconnecter
          </button>
        </div>
      ) : (
        <form className="auth-form" onSubmit={submit}>
          {mode === "sign-up" ? (
            <label>
              Nom affiché
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Tarik" />
            </label>
          ) : null}
          <label>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            Mot de passe
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={6}
              required
            />
          </label>
          <button className="primary-btn" disabled={submitting}>
            {submitting ? "..." : mode === "sign-in" ? "Se connecter" : "Créer le compte"}
          </button>
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              setMode(mode === "sign-in" ? "sign-up" : "sign-in");
              setMessage("");
            }}
          >
            {mode === "sign-in" ? "Créer un compte" : "J'ai déjà un compte"}
          </button>
          {message ? <p className="auth-message">{message}</p> : null}
        </form>
      )}
    </div>
  );
}

type DailyAttempt = Database["public"]["Tables"]["daily_attempts"]["Row"];
type PracticeAttempt = Database["public"]["Tables"]["random_attempts"]["Row"];
type PuzzleMode = Database["public"]["Enums"]["puzzle_mode"];
type PracticeModeStats = {
  averageDurationMs: number | null;
  averageFound: number | null;
  bestScore: number;
  mode: PuzzleMode;
  played: number;
};

type AccountStats = {
  averageDurationMs: number | null;
  averageFound: number | null;
  averageScore: number | null;
  bestScore: number;
  currentStreak: number;
  loading: boolean;
  maxDurationMs: number | null;
  minDurationMs: number | null;
  bestStreak: number;
  played: number;
  practiceAverageDurationMs: number | null;
  practiceAverageFound: number | null;
  practiceBestScore: number;
  practiceByMode: PracticeModeStats[];
  practicePlayed: number;
  recent: Array<DailyAttempt & { mode?: PuzzleMode | null; puzzleDate?: string | null }>;
  todayRank: number | null;
};

function useAccountStats(enabled: boolean): AccountStats {
  const { supabase, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState<DailyAttempt[]>([]);
  const [practiceAttempts, setPracticeAttempts] = useState<PracticeAttempt[]>([]);
  const [puzzleMeta, setPuzzleMeta] = useState<Map<string, { mode: PuzzleMode | null; puzzleDate: string | null }>>(new Map());
  const [streak, setStreak] = useState<{ best_streak: number; current_streak: number } | null>(null);
  const [todayRank, setTodayRank] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    if (!enabled || !user) {
      setAttempts([]);
      setPracticeAttempts([]);
      setPuzzleMeta(new Map());
      setStreak(null);
      setTodayRank(null);
      return;
    }
    const userId = user.id;

    setLoading(true);
    loadAccountStats()
      .catch((error) => {
        console.warn("Unable to load account stats.", error);
        if (active) {
          setAttempts([]);
          setPracticeAttempts([]);
          setPuzzleMeta(new Map());
          setStreak(null);
          setTodayRank(null);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };

    async function loadAccountStats() {
      const { data: attemptRows, error: attemptsError } = await supabase
        .from("daily_attempts")
        .select("*")
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(50);
      if (attemptsError) throw attemptsError;
      if (!active) return;

      const completedAttempts = attemptRows ?? [];
      setAttempts(completedAttempts);

      const { data: practiceRows, error: practiceError } = await supabase
        .from("random_attempts")
        .select("*")
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false })
        .limit(100);
      if (practiceError) throw practiceError;
      if (!active) return;

      const completedPracticeAttempts = practiceRows ?? [];
      setPracticeAttempts(completedPracticeAttempts);

      const puzzleIds = [
        ...new Set([
          ...completedAttempts.map((attempt) => attempt.puzzle_id),
          ...completedPracticeAttempts.map((attempt) => attempt.puzzle_id)
        ])
      ];
      if (puzzleIds.length) {
        const { data: puzzles, error: puzzlesError } = await supabase
          .from("puzzles")
          .select("id, mode, puzzle_date")
          .in("id", puzzleIds);
        if (puzzlesError) throw puzzlesError;
        if (active) {
          setPuzzleMeta(new Map((puzzles ?? []).map((puzzle) => [puzzle.id, { mode: puzzle.mode, puzzleDate: puzzle.puzzle_date }])));
        }
      } else if (active) {
        setPuzzleMeta(new Map());
      }

      const { data: streakRow, error: streakError } = await supabase.from("user_streaks").select("current_streak, best_streak").maybeSingle();
      if (streakError) throw streakError;
      if (active) setStreak(streakRow);

      const { data: todayPuzzle } = await supabase
        .from("puzzles")
        .select("id")
        .eq("kind", "daily")
        .eq("status", "published")
        .eq("puzzle_date", todayIsoDate())
        .maybeSingle();

      if (todayPuzzle) {
        const { data: rankRow } = await supabase
          .from("daily_leaderboard")
          .select("rank")
          .eq("puzzle_id", todayPuzzle.id)
          .eq("user_id", userId)
          .maybeSingle();
        if (active) setTodayRank(rankRow?.rank ?? null);
      }
    }
  }, [enabled, supabase, user]);

  return useMemo(() => {
    const played = attempts.length;
    const scores = attempts.map((attempt) => attempt.score);
    const foundCounts = attempts.map((attempt) => attempt.found_count);
    const durations = attempts.map((attempt) => attempt.duration_ms).filter((value): value is number => value != null);
    const practiceScores = practiceAttempts.map((attempt) => attempt.score);
    const practiceFoundCounts = practiceAttempts.map((attempt) => attempt.found_count);
    const practiceDurations = practiceAttempts.map((attempt) => attempt.duration_ms).filter((value): value is number => value != null);
    const practiceByMode = (["club_club", "club_year", "club_nationality"] as PuzzleMode[]).map((mode) => {
      const rows = practiceAttempts.filter((attempt) => puzzleMeta.get(attempt.puzzle_id)?.mode === mode);
      const modeDurations = rows.map((attempt) => attempt.duration_ms).filter((value): value is number => value != null);
      return {
        averageDurationMs: average(modeDurations),
        averageFound: average(rows.map((attempt) => attempt.found_count)),
        bestScore: rows.length ? Math.max(...rows.map((attempt) => attempt.score)) : 0,
        mode,
        played: rows.length
      };
    });

    return {
      averageDurationMs: average(durations),
      averageFound: average(foundCounts),
      averageScore: average(scores),
      bestScore: scores.length ? Math.max(...scores) : 0,
      bestStreak: streak?.best_streak ?? 0,
      currentStreak: streak?.current_streak ?? 0,
      loading,
      maxDurationMs: durations.length ? Math.max(...durations) : null,
      minDurationMs: durations.length ? Math.min(...durations) : null,
      played,
      practiceAverageDurationMs: average(practiceDurations),
      practiceAverageFound: average(practiceFoundCounts),
      practiceBestScore: practiceScores.length ? Math.max(...practiceScores) : 0,
      practiceByMode,
      practicePlayed: practiceAttempts.length,
      recent: attempts.slice(0, 5).map((attempt) => ({
        ...attempt,
        mode: puzzleMeta.get(attempt.puzzle_id)?.mode,
        puzzleDate: puzzleMeta.get(attempt.puzzle_id)?.puzzleDate
      })),
      todayRank
    };
  }, [attempts, loading, practiceAttempts, puzzleMeta, streak?.best_streak, streak?.current_streak, todayRank]);
}

function AccountStatsView({ stats }: { stats: AccountStats }) {
  if (stats.loading) {
    return <p className="account-muted">Chargement des stats...</p>;
  }

  return (
    <>
      <div className="account-section-title">Défi du jour</div>
      <div className="stats-grid">
        <StatTile label="Joués" value={stats.played} />
        <StatTile label="Meilleur" value={stats.bestScore} />
        <StatTile label="Moy. score" value={formatNumber(stats.averageScore)} />
        <StatTile label="Moy. bonnes" value={formatNumber(stats.averageFound)} />
        <StatTile label="Série" value={stats.currentStreak} />
        <StatTile label="Record série" value={stats.bestStreak} />
        <StatTile label="Moy. temps" value={formatDuration(stats.averageDurationMs)} />
        <StatTile label="Rang jour" value={stats.todayRank ? `#${stats.todayRank}` : "-"} />
      </div>
      <div className="account-section-title">Résultats récents</div>
      {stats.recent.length ? (
        <div className="recent-results">
          {stats.recent.map((attempt) => (
            <div className="recent-result" key={attempt.id}>
              <span>{attempt.puzzleDate ?? "Daily"} · {modeLabel(attempt.mode)}</span>
              <strong>{attempt.score} pts · {attempt.found_count}/9 · {formatDuration(attempt.duration_ms)}</strong>
            </div>
          ))}
        </div>
      ) : (
        <p className="account-muted">Aucun défi quotidien terminé pour l’instant.</p>
      )}
      <div className="account-section-title">Entraînement</div>
      <div className="stats-grid">
        <StatTile label="Joués" value={stats.practicePlayed} />
        <StatTile label="Meilleur" value={stats.practiceBestScore} />
        <StatTile label="Moy. bonnes" value={formatNumber(stats.practiceAverageFound)} />
        <StatTile label="Moy. temps" value={formatDuration(stats.practiceAverageDurationMs)} />
      </div>
      {stats.practiceByMode.some((row) => row.played > 0) ? (
        <div className="recent-results">
          {stats.practiceByMode.filter((row) => row.played > 0).map((row) => (
            <div className="recent-result" key={row.mode}>
              <span>{modeLabel(row.mode)}</span>
              <strong>
                {row.played} joués · {formatNumber(row.averageFound)}/9 · {formatDuration(row.averageDurationMs)}
              </strong>
            </div>
          ))}
        </div>
      ) : (
        <p className="account-muted">Aucune grille d’entraînement terminée pour l’instant.</p>
      )}
    </>
  );
}

function StatTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="stat-tile">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatNumber(value: number | null) {
  return value == null ? "-" : value.toFixed(1);
}

function formatDuration(value: number | null) {
  if (value == null) return "-";
  const seconds = Math.round(value / 1000);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function modeLabel(mode?: PuzzleMode | null) {
  if (mode === "club_club") return "Club x Club";
  if (mode === "club_year") return "Club x Année";
  if (mode === "club_nationality") return "Club x Sélection";
  return "Daily";
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}
