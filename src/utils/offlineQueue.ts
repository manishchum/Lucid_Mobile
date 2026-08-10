/**
 * Offline Action Queue
 *
 * When a network request fails with a NETWORK_ERROR (device offline), the
 * action is serialized and saved to AsyncStorage. When the device reconnects
 * (detected via NetInfo), all queued actions are replayed silently.
 *
 * Only actions explicitly enqueued are retried — not all API calls.
 * Callers wrap their submit/complete actions like this:
 *
 *   try {
 *     await submitQuizForGrading(...);
 *   } catch (err) {
 *     if (err instanceof ApiError && err.code === "NETWORK_ERROR") {
 *       await offlineQueue.enqueue({ url, method: "POST", body, headers });
 *     }
 *   }
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { logger } from "./UnifiedLogger";

const QUEUE_STORAGE_KEY = "@offline_queue";
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
 */
export async function enqueue(
  action: Omit<QueuedAction, "id" | "timestamp" | "retryCount">,
): Promise<void> {
  const queue = await loadQueue();
  const entry: QueuedAction = {
    ...action,
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
    retryCount: 0,
  };
  queue.push(entry);
  await saveQueue(queue);
  logger.info(
    `[OfflineQueue] Queued action: ${entry.label ?? entry.url} (total: ${queue.length})`,
  );
}

/**
 * Replay all queued actions. Called automatically on reconnect.
 * Successful actions are removed; permanently-failed ones (4xx) are discarded.
 * Network failures increment retryCount up to MAX_RETRY_COUNT.
 */
async function replayQueue(): Promise<void> {
  const queue = await loadQueue();
  if (queue.length === 0) return;

  logger.info(`[OfflineQueue] Replaying ${queue.length} queued action(s)...`);

  const remaining: QueuedAction[] = [];

  for (const action of queue) {
    try {
      const response = await fetch(action.url, {
        method: action.method,
        headers: action.headers,
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
      const updated = { ...action, retryCount: action.retryCount + 1 };
      if (updated.retryCount < MAX_RETRY_COUNT) {
        remaining.push(updated);
      } else {
        logger.warn(
          `[OfflineQueue] Max retries reached, discarding: ${action.label ?? action.url}`,
        );
      }
    } catch {
      // Network still not available for this action
      const updated = { ...action, retryCount: action.retryCount + 1 };
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

export const offlineQueue = { enqueue, replayQueue };
