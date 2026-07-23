import { useCallback } from "react";
import * as StoreReview from "expo-store-review";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Linking } from "react-native";

const REVIEW_LAST_PROMPTED_KEY = "@review_last_prompted";
const MIN_DAYS_BETWEEN_PROMPTS = 14;

/**
 * A hook that requests a native in-app review prompt (Google Play / App Store).
 * Throttled to once per 14 days via AsyncStorage. The OS may still suppress the
 * prompt based on its own internal quota rules.
 */
export function useInAppReview() {
  const requestReview = useCallback(async (force = false) => {
    try {
      // 1. Throttle: don't prompt more than once every 14 days unless forced
      if (!force) {
        const lastPromptedStr = await AsyncStorage.getItem(
          REVIEW_LAST_PROMPTED_KEY
        );
        if (lastPromptedStr) {
          const lastPrompted = new Date(lastPromptedStr).getTime();
          const daysSince =
            (Date.now() - lastPrompted) / (1000 * 60 * 60 * 24);
          if (daysSince < MIN_DAYS_BETWEEN_PROMPTS) {
            console.log(
              `[useInAppReview] Skipped: Last prompted ${daysSince.toFixed(1)} days ago.`
            );
            return;
          }
        }
      }

      // 2. Check if native store review is available on device
      const isAvailable = await StoreReview.isAvailableAsync();
      console.log("[useInAppReview] StoreReview.isAvailableAsync():", isAvailable);

      if (isAvailable) {
        // Record this prompt attempt timestamp
        await AsyncStorage.setItem(
          REVIEW_LAST_PROMPTED_KEY,
          new Date().toISOString()
        );
        // Request native prompt — OS determines whether to show
        await StoreReview.requestReview();
      } else {
        console.warn("[useInAppReview] Native store review unavailable on this device.");
      }
    } catch (err) {
      console.warn("[useInAppReview] Failed to request review:", err);
    }
  }, []);

  const openStorePage = useCallback(async () => {
    try {
      const url = StoreReview.storeUrl();
      if (url) {
        await Linking.openURL(url);
      }
    } catch (err) {
      console.warn("[useInAppReview] Failed to open store URL:", err);
    }
  }, []);

  return { requestReview, openStorePage };
}
