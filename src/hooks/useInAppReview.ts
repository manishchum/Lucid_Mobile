import { useCallback } from "react";
import * as StoreReview from "expo-store-review";
import AsyncStorage from "@react-native-async-storage/async-storage";

const REVIEW_LAST_PROMPTED_KEY = "@review_last_prompted";
const MIN_DAYS_BETWEEN_PROMPTS = 90;

/**
 * A hook that requests a native in-app review prompt (Google Play / App Store).
 * Throttled to once per 90 days via AsyncStorage. The OS may still suppress the
 * prompt based on its own internal quota rules.
 */
export function useInAppReview() {
  const requestReview = useCallback(async () => {
    try {
      // Check if the API is available on this device
      const isAvailable = await StoreReview.isAvailableAsync();
      if (!isAvailable) return;

      // Throttle: don't prompt more than once every 90 days
      const lastPromptedStr = await AsyncStorage.getItem(
        REVIEW_LAST_PROMPTED_KEY
      );
      if (lastPromptedStr) {
        const lastPrompted = new Date(lastPromptedStr).getTime();
        const daysSince =
          (Date.now() - lastPrompted) / (1000 * 60 * 60 * 24);
        if (daysSince < MIN_DAYS_BETWEEN_PROMPTS) return;
      }

      // Record this prompt attempt before showing (to avoid race conditions)
      await AsyncStorage.setItem(
        REVIEW_LAST_PROMPTED_KEY,
        new Date().toISOString()
      );

      // Request the native review prompt — OS decides whether to actually show it
      await StoreReview.requestReview();
    } catch (err) {
      // Silently swallow — never interrupt the user flow for a rating prompt
      console.warn("[useInAppReview] Failed to request review:", err);
    }
  }, []);

  return { requestReview };
}
