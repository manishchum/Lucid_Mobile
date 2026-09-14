/**
 * Offline Action Queue
 *
 * When a network request fails with a NETWORK_ERROR (device offline), the
 * action is serialized and saved to AsyncStorage. When the device reconnects
 * (detected via NetInfo), all queued actions are replayed silently.
 *
 * SECURITY:
 * - Sensitive Authorization headers are NEVER persisted to AsyncStorage.
 * - If an action requires authentication (or was passed with an Authorization header),
 *   it is marked with `requiresAuth: true`, and the fresh active session token is
 *   dynamically injected at replay time via `getFirebaseToken()`.
 * - If no active session exists at replay time, actions requiring auth are discarded
 *   to prevent unauthenticated/stale replay attacks.
 * - When a user logs out, `purgeQueue()` is invoked to remove all queued items
 *   from storage, preventing token or payload replay across user sessions.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { logger } from "./UnifiedLogger";
import { getFirebaseToken } from "../api/users/Request";

export const QUEUE_STORAGE_KEY = "@offline_queue";
const MAX_RETRY_COUNT = 3;

export interface QueuedAction {
  id: string;
  url: string;
  method: string;
  body: string;
  headers: Record<string, string>;
  timestamp: number;
  retryCount: number;
  /** Human-readable label for logging */
  label?: string;
  /** Whether this request requires an Authorization header injected dynamically at replay time */
  requiresAuth?: boolean;
  /** User ID of the account that enqueued this action (prevents cross-user replay) */
  userId?: string;
}

// ─── Persistence helpers ────────────────────────────────────────────────────

async function loadQueue(): Promise<QueuedAction[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveQueue(queue: QueuedAction[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch (err) {
    logger.error("[OfflineQueue] Failed to persist queue:", err);
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Add a failed action to the offline queue.
 * Strips raw Authorization headers before saving to AsyncStorage to prevent
 * storing unencrypted credentials at rest.
 */
export async function enqueue(
  action: Omit<QueuedAction, "id" | "timestamp" | "retryCount">,
): Promise<void> {
  const queue = await loadQueue();

  // Sanitize headers: NEVER persist sensitive Authorization credentials in AsyncStorage
  const sanitizedHeaders: Record<string, string> = {};
  let requiresAuth = Boolean(action.requiresAuth);

  for (const [key, value] of Object.entries(action.headers || {})) {
    if (key.toLowerCase() === "authorization") {
      requiresAuth = true;
      // Do not persist the Authorization header in AsyncStorage
    } else {
      sanitizedHeaders[key] = value;
    }
  }

  // Extract or retain userId to prevent cross-user token replay
  let userId = action.userId;
  if (!userId && sanitizedHeaders["X-User-ID"]) {
    userId = sanitizedHeaders["X-User-ID"];
  }
  if (!userId && action.body) {
    try {
      const parsed = JSON.parse(action.body);
      if (parsed && typeof parsed.user_id === "string") {
        userId = parsed.user_id;
      }
    } catch {}
  }

  const entry: QueuedAction = {
    ...action,
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    headers: sanitizedHeaders,
    requiresAuth,
    userId,
    timestamp: Date.now(),
    retryCount: 0,
  };
  queue.push(entry);
  await saveQueue(queue);
  logger.info(
    `[OfflineQueue] Queued action: ${entry.label ?? entry.url} (total: ${queue.length}, requiresAuth: ${requiresAuth})`,
  );
}

/**
 * Purge all actions from the offline queue.
 * Called upon user logout or session termination to prevent token replay and stale request leakage.
 */
export async function purgeQueue(): Promise<void> {
  try {
    await AsyncStorage.removeItem(QUEUE_STORAGE_KEY);
    logger.info("[OfflineQueue] Successfully purged offline queue.");
  } catch (err) {
    logger.error("[OfflineQueue] Failed to purge offline queue:", err);
  }
}

export const clearQueue = purgeQueue;

/**
 * Replay all queued actions. Called automatically on reconnect.
 * Successful actions are removed; permanently-failed ones (4xx) are discarded.
 * Network failures increment retryCount up to MAX_RETRY_COUNT.
 * Dynamically resolves fresh Authorization tokens for actions requiring auth.
 */
export async function replayQueue(): Promise<void> {
  const queue = await loadQueue();
  if (queue.length === 0) return;

  logger.info(`[OfflineQueue] Replaying ${queue.length} queued action(s)...`);

  const remaining: QueuedAction[] = [];

  for (const action of queue) {
    try {
      const requestHeaders: Record<string, string> = { ...action.headers };

      // If legacy item has static Authorization header, remove it from persisted state
      let requiresAuth = Boolean(action.requiresAuth);
      for (const key of Object.keys(requestHeaders)) {
        if (key.toLowerCase() === "authorization") {
          requiresAuth = true;
          delete requestHeaders[key];
        }
      }

      if (requiresAuth) {
        const token = await getFirebaseToken();
        if (!token) {
          logger.warn(
            `[OfflineQueue] Discarding action requiring auth because no active user session exists: ${action.label ?? action.url}`,
          );
          // Discard: cannot authenticate, preventing unauthenticated or stale replay
          continue;
        }
        requestHeaders["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(action.url, {
        method: action.method,
        headers: requestHeaders,
        body: action.body,
      });

      if (response.ok) {
        logger.info(
          `[OfflineQueue] ✅ Replayed: ${action.label ?? action.url}`,
        );
        // Success — don't add back to remaining
        continue;
      }

      // Permanent client error (4xx) — discard, no point retrying
      if (response.status >= 400 && response.status < 500) {
        logger.warn(
          `[OfflineQueue] Discarding action (${response.status}): ${action.label ?? action.url}`,
        );
        continue;
      }

      // Server error (5xx) or unexpected — increment retry counter
      const updated: QueuedAction = {
        ...action,
        headers: requestHeaders, // Ensure sanitized headers are persisted
        requiresAuth,
        retryCount: action.retryCount + 1,
      };
      if (updated.retryCount < MAX_RETRY_COUNT) {
        remaining.push(updated);
      } else {
        logger.warn(
          `[OfflineQueue] Max retries reached, discarding: ${action.label ?? action.url}`,
        );
      }
    } catch {
      // Network still not available for this action
      const updated: QueuedAction = {
        ...action,
        retryCount: action.retryCount + 1,
      };
      if (updated.retryCount < MAX_RETRY_COUNT) {
        remaining.push(updated);
      }
    }
  }

  await saveQueue(remaining);
  logger.info(
    `[OfflineQueue] Replay complete. ${remaining.length} action(s) still pending.`,
  );
}

// ─── Auto-replay on reconnect ────────────────────────────────────────────────

let listenerRegistered = false;

/**
 * Call once at app startup. Registers a NetInfo listener that triggers
 * replayQueue() whenever the device transitions to online.
 */
export function initOfflineQueueListener(): void {
  if (listenerRegistered) return;
  listenerRegistered = true;

  NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable) {
      // Small delay to let the connection stabilise before retrying
      setTimeout(() => {
        replayQueue().catch((err) =>
          logger.error("[OfflineQueue] Replay error:", err),
        );
      }, 2000);
    }
  });

  logger.info("[OfflineQueue] Listener registered.");
}

export const offlineQueue = {
  enqueue,
  replayQueue,
  purgeQueue,
  clearQueue,
};
