import * as SecureStore from "expo-secure-store";
import { appStorage } from "./appStorage";
import { logger } from "./UnifiedLogger";

export const DEVICE_ID_KEY = "lucid_mobile_device_id";

function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch {
      // Fall through to fallback
    }
  }

  // RFC4122 version 4 compliant UUID fallback
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

let inMemoryDeviceId: string | null = null;
let inFlightDeviceIdPromise: Promise<string> | null = null;

/**
 * Restore cached device ID into memory & MMKV (used after storage purges on logout).
 */
export function setCachedDeviceId(deviceId: string): void {
  if (!deviceId) return;
  inMemoryDeviceId = deviceId;
  appStorage.setString(DEVICE_ID_KEY, deviceId);
}

/**
 * Synchronous device ID lookup.
 * Returns cached in-memory/MMKV ID immediately. If MMKV is empty on early boot,
 * checks SecureStore asynchronously before persisting so we never clobber an existing
 * SecureStore hardware identity.
 */
export function getMobileDeviceIdSync(): string {
  if (inMemoryDeviceId) {
    return inMemoryDeviceId;
  }

  const stored = appStorage.getString(DEVICE_ID_KEY);
  if (stored) {
    inMemoryDeviceId = stored;
    return stored;
  }

  const fallbackId = generateUUID();
  inMemoryDeviceId = fallbackId;
  appStorage.setString(DEVICE_ID_KEY, fallbackId);

  // Reconcile against SecureStore without blindly overwriting an existing SecureStore UUID
  SecureStore.getItemAsync(DEVICE_ID_KEY)
    .then((existingSecureId) => {
      if (existingSecureId) {
        inMemoryDeviceId = existingSecureId;
        appStorage.setString(DEVICE_ID_KEY, existingSecureId);
      } else {
        return SecureStore.setItemAsync(DEVICE_ID_KEY, fallbackId);
      }
    })
    .catch((err) => {
      logger.warn("[deviceId] Failed to reconcile device ID with SecureStore:", err);
    });

  return fallbackId;
}

/**
 * Asynchronous device ID getter (single-flight).
 * Checks memory, MMKV, and native SecureStore before creating a new ID.
 */
export async function getMobileDeviceId(): Promise<string> {
  if (inMemoryDeviceId) {
    const stored = appStorage.getString(DEVICE_ID_KEY);
    if (!stored) {
      appStorage.setString(DEVICE_ID_KEY, inMemoryDeviceId);
    }
    return inMemoryDeviceId;
  }

  // 1. Check synchronous fast cache (MMKV)
  const cached = appStorage.getString(DEVICE_ID_KEY);
  if (cached) {
    inMemoryDeviceId = cached;
    return cached;
  }

  if (inFlightDeviceIdPromise) {
    return inFlightDeviceIdPromise;
  }

  inFlightDeviceIdPromise = (async () => {
    try {
      // 2. Check SecureStore
      try {
        const secureId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
        if (secureId) {
          inMemoryDeviceId = secureId;
          appStorage.setString(DEVICE_ID_KEY, secureId);
          return secureId;
        }
      } catch (err) {
        logger.warn("[deviceId] Failed to read device ID from SecureStore:", err);
      }

      // 3. Generate and persist new ID
      const newId = generateUUID();
      inMemoryDeviceId = newId;
      appStorage.setString(DEVICE_ID_KEY, newId);

      try {
        await SecureStore.setItemAsync(DEVICE_ID_KEY, newId);
      } catch (err) {
        logger.warn("[deviceId] Failed to write device ID to SecureStore:", err);
      }

      return newId;
    } finally {
      inFlightDeviceIdPromise = null;
    }
  })();

  return inFlightDeviceIdPromise;
}
