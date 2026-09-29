import { useState, useCallback, useRef, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
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

const CACHE_KEY_PROFILE = "@gamification_profile_cache";
let _globalProfile: GamificationProfile | null = null;
const _profileListeners = new Set<(p: GamificationProfile) => void>();

// Load profile from AsyncStorage once at startup for instant access
AsyncStorage.getItem(CACHE_KEY_PROFILE)
  .then((raw) => {
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (!_globalProfile) {
          _globalProfile = parsed;
          _profileListeners.forEach((l) => l(parsed));
        }
      } catch {}
    }
  })
  .catch(() => {});

export function updateGlobalProfile(profile: GamificationProfile) {
  _globalProfile = profile;
  _profileListeners.forEach((l) => l(profile));
  AsyncStorage.setItem(CACHE_KEY_PROFILE, JSON.stringify(profile)).catch(() => {});
}

export function getGlobalProfile(): GamificationProfile | null {
  return _globalProfile;
}

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
  const [data, setData] = useState<GamificationProfile | null>(_globalProfile);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const listener = (p: GamificationProfile) => {
      setData(p);
    };
    _profileListeners.add(listener);
    if (_globalProfile && data !== _globalProfile) {
      setData(_globalProfile);
    }
    return () => {
      _profileListeners.delete(listener);
    };
  }, []);

  const fetch = useCallback(async (force = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchGamificationProfile();
      setData(result);
      updateGlobalProfile(result);
    } catch (e: any) {
      setError(e.message || "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setProfile = useCallback((newProfile: GamificationProfile) => {
    setData(newProfile);
    updateGlobalProfile(newProfile);
  }, []);

  return { data, isLoading, error, fetch, setData: setProfile };
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
