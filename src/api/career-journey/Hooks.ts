import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getCareerJourneys } from "./Request";

export interface SkillNode {
  id: string;
  title: string;
  description: string;
  level: "beginner" | "intermediate" | "advanced";
  moduleId?: string;
  estimatedHours?: number;
  timeUnit?: "hours" | "days" | "weeks" | "months";
  resources?: string[];
}

export interface SkillConnection {
  from: string;
  to: string;
  type: "prerequisite" | "recommended";
}

export interface CareerJourney {
  id: string;
  title: string;
  description: string;
  skills: SkillNode[];
  connections: SkillConnection[];
  thumbnail?: string;
  category?: string;
  tags?: string[];
  status?: string;
}

export const useCareerJourneys = (companyId?: string | null) => {
  const [data, setData] = useState<CareerJourney[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchJourneys = useCallback(async (showSpinner: boolean = true) => {
    try {
      if (showSpinner) setIsLoading(true);
      const response = await getCareerJourneys(companyId);
      const journeys = response.data || [];
      setData(journeys);

      const cacheKey = `@career_journeys_${companyId || "default"}`;
      await AsyncStorage.setItem(cacheKey, JSON.stringify(journeys));
    } catch (err: any) {
      setError(err);
    } finally {
      if (showSpinner) setIsLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    let isMounted = true;
    const loadAndFetch = async () => {
      setIsLoading(true);
      setError(null);
      let hasCache = false;

      // 1. Try to load from cache
      try {
        const cacheKey = `@career_journeys_${companyId || "default"}`;
        const cachedJson = await AsyncStorage.getItem(cacheKey);
        if (cachedJson && isMounted) {
          const cachedData = JSON.parse(cachedJson) as CareerJourney[];
          setData(cachedData);
          console.log("[CareerJourneyHook] Loaded from cache");
          hasCache = true;
          setIsLoading(false);
        }
      } catch (err) {
        console.warn("[CareerJourneyHook] Failed to load cached journeys:", err);
      }

      // 2. Fetch fresh from network
      try {
        await fetchJourneys(!hasCache);
      } catch (err) {
        if (!hasCache && isMounted) {
          setError(err instanceof Error ? err : new Error("Failed to fetch journeys"));
        }
      }
    };

    if (companyId) {
      loadAndFetch();
    }

    return () => {
      isMounted = false;
    };
  }, [companyId, fetchJourneys]);

  const refetch = useCallback(
    async (showSpinner = true) => {
      await fetchJourneys(showSpinner);
    },
    [fetchJourneys],
  );

  return {
    data,
    isLoading,
    error,
    refetch,
  };
};
