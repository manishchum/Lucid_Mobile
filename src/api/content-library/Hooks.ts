import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getContentCategories, getContentItems } from "./Request";
import { ContentCategory, ContentItem } from "./Dto";

export const useContentCategories = (companyId?: string | null) => {
  const [data, setData] = useState<ContentCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCategories = useCallback(async (showSpinner: boolean = true) => {
    try {
      if (showSpinner) setIsLoading(true);
      const response = await getContentCategories(companyId);
      const categories = response.data || [];
      setData(categories);

      const cacheKey = `@content_categories_${companyId || "default"}`;
      await AsyncStorage.setItem(cacheKey, JSON.stringify(categories));
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

      // 1. Try to load from cache first
      try {
        const cacheKey = `@content_categories_${companyId || "default"}`;
        const cachedJson = await AsyncStorage.getItem(cacheKey);
        if (cachedJson && isMounted) {
          const cachedData = JSON.parse(cachedJson) as ContentCategory[];
          setData(cachedData);
          console.log("[ContentLibraryHook] ✅ Loaded content categories from cache");
          hasCache = true;
          setIsLoading(false); // Stop spinner early
        }
      } catch (err) {
        console.warn("[ContentLibraryHook] Failed to load cached categories:", err);
      }

      // 2. Fetch fresh data from network
      try {
        await fetchCategories(!hasCache);
      } catch (err) {
        if (!hasCache && isMounted) {
          setError(err instanceof Error ? err : new Error("Failed to fetch categories"));
        }
      }
    };

    loadAndFetch();

    return () => {
      isMounted = false;
    };
  }, [companyId, fetchCategories]);

  return { data, isLoading, error, refetch: () => fetchCategories(true) };
};

export const useContentItems = (categoryId?: string, companyId?: string | null) => {
  const [data, setData] = useState<ContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchItems = useCallback(async (showSpinner: boolean = true) => {
    try {
      if (showSpinner) setIsLoading(true);
      const response = await getContentItems(categoryId, companyId);
      const items = response.data || [];
      setData(items);

      const cacheKey = `@content_items_${categoryId || "all"}_${companyId || "default"}`;
      await AsyncStorage.setItem(cacheKey, JSON.stringify(items));
    } catch (err: any) {
      setError(err);
    } finally {
      if (showSpinner) setIsLoading(false);
    }
  }, [categoryId, companyId]);

  useEffect(() => {
    let isMounted = true;
    const loadAndFetch = async () => {
      setIsLoading(true);
      setError(null);

      let hasCache = false;

      // 1. Try to load from cache first
      try {
        const cacheKey = `@content_items_${categoryId || "all"}_${companyId || "default"}`;
        const cachedJson = await AsyncStorage.getItem(cacheKey);
        if (cachedJson && isMounted) {
          const cachedData = JSON.parse(cachedJson) as ContentItem[];
          setData(cachedData);
          console.log("[ContentLibraryHook] ✅ Loaded content items from cache");
          hasCache = true;
          setIsLoading(false); // Stop spinner early
        }
      } catch (err) {
        console.warn("[ContentLibraryHook] Failed to load cached items:", err);
      }

      // 2. Fetch fresh data from network
      try {
        await fetchItems(!hasCache);
      } catch (err) {
        if (!hasCache && isMounted) {
          setError(err instanceof Error ? err : new Error("Failed to fetch items"));
        }
      }
    };

    loadAndFetch();

    return () => {
      isMounted = false;
    };
  }, [categoryId, companyId, fetchItems]);

  return { data, isLoading, error, refetch: () => fetchItems(true) };
};
