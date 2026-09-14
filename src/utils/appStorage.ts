import AsyncStorage from "@react-native-async-storage/async-storage";
import { logger } from "./UnifiedLogger";

let mmkvInstance: any = null;
let isMMKVAvailable = false;

// In-memory fallback cache to ensure instant synchronous lookups even if MMKV native bindings are missing
const memoryFallback = new Map<string, string>();

try {
  // Dynamically require to avoid breaking when running in non-native / jest environments
  const { MMKV } = require("react-native-mmkv");
  mmkvInstance = new MMKV({ id: "lucid-mobile-storage" });
  isMMKVAvailable = true;
  logger.info("[appStorage] High-performance MMKV initialized successfully.");
} catch (e: any) {
  logger.warn(
    "[appStorage] MMKV native module not available in this runtime, falling back to AsyncStorage + Memory Cache:",
    e?.message || e,
  );
  isMMKVAvailable = false;
}

export const appStorage = {
  isUsingMMKV: (): boolean => isMMKVAvailable,

  /**
   * Synchronously read a string.
   * Runs in microseconds via MMKV JSI or in-memory map.
   */
  getString(key: string): string | null {
    if (isMMKVAvailable && mmkvInstance) {
      try {
        const val = mmkvInstance.getString(key);
        return val ?? null;
      } catch (err) {
        logger.warn(`[appStorage] MMKV read error for key ${key}:`, err);
      }
    }
    return memoryFallback.get(key) ?? null;
  },

  /**
   * Synchronously read and parse a JSON object.
   */
  getObject<T = any>(key: string): T | null {
    const raw = this.getString(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch (err) {
      logger.warn(`[appStorage] JSON parse error for key ${key}:`, err);
      return null;
    }
  },

  /**
   * Synchronously write a string to persistent storage.
   */
  setString(key: string, value: string): void {
    memoryFallback.set(key, value);
    if (isMMKVAvailable && mmkvInstance) {
      try {
        mmkvInstance.set(key, value);
        return;
      } catch (err) {
        logger.warn(`[appStorage] MMKV write error for key ${key}:`, err);
      }
    }
    // Async persist fallback in background without blocking caller
    AsyncStorage.setItem(key, value).catch((err) =>
      logger.error(`[appStorage] AsyncStorage write error for ${key}:`, err),
    );
  },

  /**
   * Synchronously serialize and write an object.
   */
  setObject<T = any>(key: string, value: T): void {
    try {
      this.setString(key, JSON.stringify(value));
    } catch (err) {
      logger.error(`[appStorage] JSON stringify error for key ${key}:`, err);
    }
  },

  /**
   * Remove an item from storage.
   */
  removeItem(key: string): void {
    memoryFallback.delete(key);
    if (isMMKVAvailable && mmkvInstance) {
      try {
        mmkvInstance.delete(key);
        return;
      } catch (err) {
        logger.warn(`[appStorage] MMKV delete error for key ${key}:`, err);
      }
    }
    AsyncStorage.removeItem(key).catch((err) =>
      logger.error(`[appStorage] AsyncStorage delete error for ${key}:`, err),
    );
  },

  /**
   * Pre-warm / seed the memory cache from AsyncStorage on app startup (if MMKV not present).
   */
  async warmMemoryCache(keys: string[]): Promise<void> {
    if (isMMKVAvailable) return; // MMKV is already instant, no warming needed
    try {
      const entries = await AsyncStorage.multiGet(keys);
      for (const [key, value] of entries) {
        if (value !== null) {
          memoryFallback.set(key, value);
        }
      }
    } catch (err) {
      logger.warn("[appStorage] warmMemoryCache failed:", err);
    }
  },

  /**
   * Synchronously clear all items from MMKV and in-memory fallback.
   */
  clearAllSync(): void {
    memoryFallback.clear();
    if (isMMKVAvailable && mmkvInstance) {
      try {
        mmkvInstance.clearAll();
      } catch (err) {
        logger.warn("[appStorage] MMKV clearAll error:", err);
      }
    }
  },

  /**
   * Purge / clear all data from persistent storage (MMKV, memory fallback, and AsyncStorage).
   */
  async clearAll(): Promise<void> {
    this.clearAllSync();
    try {
      await AsyncStorage.clear();
    } catch (err) {
      logger.error("[appStorage] AsyncStorage clear error:", err);
    }
  },

  /**
   * Return all keys currently stored.
   */
  getAllKeys(): string[] {
    if (isMMKVAvailable && mmkvInstance) {
      try {
        return mmkvInstance.getAllKeys();
      } catch (err) {
        logger.warn("[appStorage] MMKV getAllKeys error:", err);
      }
    }
    return Array.from(memoryFallback.keys());
  },
};
