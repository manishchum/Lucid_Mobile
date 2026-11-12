/**
 * Offline Action Queue
 *
 * When a network request fails with a NETWORK_ERROR (device offline), the
 * action is serialized and saved to AsyncStorage. When the device reconnects
 * (detected via NetInfo), all queued actions are replayed silently after
 * validating session integrity via `/api/auth/me`.
 *
 * SECURITY:
 * - Sensitive Authorization headers are NEVER persisted to AsyncStorage.
 * - If an action requires authentication (or was passed with an Authorization header),
 *   it is marked with `requiresAuth: true`, and the fresh active session token is
 *   dynamically injected at replay time via `getFirebaseToken()`.
 * - `X-Device-ID` and `X-Platform: mobile` are injected dynamically on every replay.
 * - Before any replay starts, the registered pre-replay validator confirms the
 *   session is still valid (not displaced/expired/deactivated).
 * - If a replayed request returns 401 `Session_Replaced`/`Session_Expired` or
 *   403 account/company deactivation, replay aborts, purges the queue, and emits
 *   the corresponding session-invalid event.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { logger } from "./UnifiedLogger";
import {
  getFirebaseToken,
  refreshFirebaseToken,
  detectDeactivationReason,
} from "../api/client";
import { emitSessionInvalid } from "../api/sessionEvents";
import { getMobileDeviceId } from "./deviceId";

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

type PreReplayValidator = () => Promise<boolean>;

let preReplayValidator: PreReplayValidator | null = null;
let inFlightReplayPromise: Promise<void> | null = null;

/**
 * Registers a validator invoked before replaying any queued offline mutations.
 * AuthContext registers `/api/auth/me` revalidation here so displaced or
 * expired sessions are signed out cleanly before queued requests replay.
 */
export function setPreReplayValidator(
  validator: PreReplayValidator | null,
): void {
  preReplayValidator = validator;
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

async function parseJsonSafe(response: Response): Promise<any> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function handleTerminalAuthResponse(response: Response): Promise<boolean> {
  if (response.status !== 401 && response.status !== 403) {
    return false;
  }

  const body = await parseJsonSafe(response);
  const code = body?.code as string | undefined;
  const detail = body?.detail;
  const detailStr = typeof detail === "string" ? detail : "";

  if (response.status === 401) {
    if (code === "SESSION_TERMINATED" || detailStr === "Session_Replaced") {
      await purgeQueue();
      emitSessionInvalid("SESSION_TERMINATED");
      return true;
    }
    if (code === "SESSION_EXPIRED" || detailStr === "Session_Expired") {
      await purgeQueue();
      emitSessionInvalid("SESSION_EXPIRED");
      return true;
    }
    const deactivation = detectDeactivationReason(code, detail);
    if (deactivation) {
      await purgeQueue();
      emitSessionInvalid(deactivation);
      return true;
    }
    return false;
  }

  const deactivation = detectDeactivationReason(code, detail);
  if (deactivation) {
    await purgeQueue();
    emitSessionInvalid(deactivation);
    return true;
  }
  return false;
}

async function executeReplay(): Promise<void> {
  const initialQueue = await loadQueue();
  if (initialQueue.length === 0) return;

  if (preReplayValidator) {
    const canReplay = await preReplayValidator().catch((err) => {
      logger.warn("[OfflineQueue] Pre-replay validator threw:", err);
      return false;
    });
    if (!canReplay) {
      logger.warn(
        "[OfflineQueue] Pre-replay validation declined replay — waiting for valid online session.",
      );
      return;
    }
  }

  const queue = await loadQueue();
  if (queue.length === 0) return;

  const deviceId = await getMobileDeviceId();
  logger.info(`[OfflineQueue] Replaying ${queue.length} queued action(s)...`);

  const remaining: QueuedAction[] = [];

  for (const action of queue) {
    try {
      const requestHeaders: Record<string, string> = {
        ...action.headers,
        "X-Device-ID": deviceId,
        "X-Platform": "mobile",
      };

      // Strip any legacy static Authorization header before injecting fresh token
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
          continue;
        }
        requestHeaders["Authorization"] = `Bearer ${token}`;
      }

      let response = await fetch(action.url, {
        method: action.method,
        headers: requestHeaders,
        body: action.body,
      });

      if (response.status === 401 || response.status === 403) {
        const handledTerminal = await handleTerminalAuthResponse(response);
        if (handledTerminal) {
          return;
        }

        if (response.status === 401 && requiresAuth) {
          const freshToken = await refreshFirebaseToken();
          if (freshToken) {
            requestHeaders["Authorization"] = `Bearer ${freshToken}`;
            response = await fetch(action.url, {
              method: action.method,
              headers: requestHeaders,
              body: action.body,
            });
            const handledRetryTerminal = await handleTerminalAuthResponse(response);
            if (handledRetryTerminal) {
              return;
            }
          }

          if (response.status === 401) {
            await purgeQueue();
            emitSessionInvalid("SESSION_EXPIRED");
            return;
          }
        }
      }

      if (response.ok) {
        logger.info(
          `[OfflineQueue] ✅ Replayed: ${action.label ?? action.url}`,
        );
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
        headers: action.headers,
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

/**
 * Replay all queued actions. Called automatically on reconnect and guarded
 * by a single-flight lock + pre-replay `/api/auth/me` session check.
 */
export async function replayQueue(): Promise<void> {
  if (inFlightReplayPromise) {
    return inFlightReplayPromise;
  }

  inFlightReplayPromise = executeReplay().finally(() => {
    inFlightReplayPromise = null;
  });

  return inFlightReplayPromise;
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
  setPreReplayValidator,
};
