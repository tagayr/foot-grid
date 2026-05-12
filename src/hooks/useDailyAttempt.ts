"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";

type DailyAttempt = {
  completed_at: string | null;
  duration_ms: number | null;
  error_count: number;
  found_count: number;
  id: string;
  puzzle_id: string;
  score: number;
  status: "in_progress" | "completed" | "failed" | "abandoned";
};

type SubmittedAnswer = {
  colPosition: number;
  playerName: string;
  rowPosition: number;
};

export function useDailyAttempt() {
  const { session, user } = useAuth();
  const [attempt, setAttempt] = useState<DailyAttempt | null>(null);
  const [loading, setLoading] = useState(false);
  const [submittedAttemptId, setSubmittedAttemptId] = useState<string | null>(null);

  useEffect(() => {
    setAttempt(null);
    setSubmittedAttemptId(null);
  }, [user?.id]);

  const startAttempt = useCallback(
    async (puzzleId: string) => {
      if (!session?.access_token) {
        return null;
      }

      setLoading(true);
      try {
        const response = await fetch("/api/daily-attempt/start", {
          body: JSON.stringify({ puzzleId }),
          headers: {
            authorization: `Bearer ${session.access_token}`,
            "content-type": "application/json"
          },
          method: "POST"
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to start daily attempt.");
        }
        setAttempt(payload.attempt);
        setSubmittedAttemptId(payload.attempt?.status === "completed" ? payload.attempt.id : null);
        return payload.attempt as DailyAttempt;
      } finally {
        setLoading(false);
      }
    },
    [session?.access_token]
  );

  const completeAttempt = useCallback(
    async ({
      answers,
      puzzleId,
      gaveUp
    }: {
      answers: SubmittedAnswer[];
      gaveUp: boolean;
      puzzleId: string;
    }) => {
      if (!attempt || !session?.access_token || attempt.status === "completed" || submittedAttemptId === attempt.id) {
        return null;
      }

      setSubmittedAttemptId(attempt.id);
      const response = await fetch("/api/daily-attempt/complete", {
        body: JSON.stringify({
          answers,
          attemptId: attempt.id,
          gaveUp,
          puzzleId
        }),
        headers: {
          authorization: `Bearer ${session.access_token}`,
          "content-type": "application/json"
        },
        method: "POST"
      });
      const payload = await response.json();
      if (!response.ok) {
        setSubmittedAttemptId(null);
        throw new Error(payload.error ?? "Unable to complete daily attempt.");
      }
      setAttempt(payload.attempt);
      return payload.attempt as DailyAttempt;
    },
    [attempt, session?.access_token, submittedAttemptId]
  );

  return {
    attempt,
    completeAttempt,
    loading,
    ranked: Boolean(user),
    startAttempt
  };
}
