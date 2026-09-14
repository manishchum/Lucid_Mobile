import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { appStorage } from "./appStorage";
import { logger } from "./UnifiedLogger";
import { offlineQueue } from "./offlineQueue";
import { clearInFlightRequests, JWT_TOKEN_KEY } from "../api/users/Request";
import { clearHooksMemoryCaches } from "../api/users/Hooks";

/**
 * Purges and invalidates ALL mobile local caches when a user signs out:
 * 1. Cancels/clears pending in-flight HTTP request deduplication promises
 * 2. Clears in-memory module metadata and auth module caches
 * 3. Purges offline mutation queue to prevent request/token replay
 * 4. Deletes secure auth JWT from SecureStore
 * 5. Clears all MMKV key-value stores, memory fallback maps, and AsyncStorage completely
 */
export async function purgeAllMobileLocalCache(): Promise<void> {
  logger.info("[CacheManager] 🧹 Starting comprehensive local cache purge on sign out...");

  // 1. Invalidate pending in-flight request deduplication promises
  try {
    clearInFlightRequests();
  } catch (err) {
    logger.warn("[CacheManager] Error clearing in-flight requests:", err);
  }

  // 2. Clear in-memory hook caches
  try {
    clearHooksMemoryCaches();
  } catch (err) {
    logger.warn("[CacheManager] Error clearing hook memory caches:", err);
  }

  // 3. Purge offline mutation queue to prevent token replay
  try {
    await offlineQueue.purgeQueue();
  } catch (err) {
    logger.warn("[CacheManager] Error purging offline queue:", err);
  }

  // 4. Purge SecureStore JWT token
  try {
    await SecureStore.deleteItemAsync(JWT_TOKEN_KEY).catch(() => {});
    logger.debug("[CacheManager] SecureStore JWT purged.");
  } catch (err) {
    logger.warn("[CacheManager] Error deleting JWT from SecureStore:", err);
  }

  // 5. Purge persistent storage (MMKV + memory map + AsyncStorage completely)
  try {
    await appStorage.clearAll();
    logger.info("[CacheManager] ✅ appStorage (MMKV + Memory) and AsyncStorage completely purged.");
  } catch (err) {
    logger.error("[CacheManager] Error purging persistent appStorage:", err);
    // Fallback: try raw AsyncStorage.clear()
    try {
      await AsyncStorage.clear();
    } catch (fallbackErr) {
      logger.error("[CacheManager] Fallback AsyncStorage.clear() also failed:", fallbackErr);
    }
  }

  logger.info("[CacheManager] 🎉 Complete mobile local cache purge completed successfully.");
}
