import { useState, useCallback, useRef } from "react";
import {
  fetchGamificationSprints,
  fetchGamificationProfile,
  fetchGamificationLeaderboard,
  fetchActivityCalendar,
  submitDrillProgress,
  GamificationSprint,
  GamificationProfile,
  LeaderboardUser,
  DrillProgressPayload,
  DrillProgressResult,
} from "./Request";

function useFetch<T>(fetcher: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const didFetch = useRef(false);

  const fetch = useCallback(
    async (force = false) => {
      if (didFetch.current && !force) return;
      didFetch.current = true;
      setIsLoading(true);
      setError(null);
      try {
        const result = await fetcher();
        setData(result);
      } catch (e: any) {
        setError(e.message || "Unknown error");
      } finally {
        setIsLoading(false);
      }
    },
    [fetcher]
  );

  return { data, isLoading, error, fetch, setData };
}

export function useGamificationSprints() {
  return useFetch<GamificationSprint[]>(fetchGamificationSprints);
}

export function useGamificationProfile() {
  return useFetch<GamificationProfile>(fetchGamificationProfile);
}

export function useGamificationLeaderboard() {
  return useFetch<LeaderboardUser[]>(fetchGamificationLeaderboard);
}

export function useActivityCalendar() {
  return useFetch<string[]>(fetchActivityCalendar);
}

export function useSubmitDrillProgress() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<DrillProgressResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async (payload: DrillProgressPayload) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await submitDrillProgress(payload);
      setResult(res);
      return res;
    } catch (e: any) {
      setError(e.message || "Failed to submit");
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  return { submit, isSubmitting, result, error };
}
