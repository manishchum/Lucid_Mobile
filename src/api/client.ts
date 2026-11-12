import { getAuth, getIdToken } from "@react-native-firebase/auth";
import { logger } from "../utils/UnifiedLogger";
import { emitSessionInvalid, SessionInvalidReason } from "./sessionEvents";
import { getMobileDeviceId, getMobileDeviceIdSync } from "../utils/deviceId";

export const EXPO_API_URL =
  process.env.EXPO_PUBLIC_API_URL || "https://api.workfloww.ai";
export const API_BASE_URL = `${EXPO_API_URL}/api`;
export const WS_BASE_URL = EXPO_API_URL.startsWith("https")
  ? EXPO_API_URL.replace(/^https/, "wss") + "/api"
  : EXPO_API_URL.replace(/^http/, "ws") + "/api";

export const JWT_TOKEN_KEY = "auth_jwt_token";

export const DEFAULT_FETCH_TIMEOUT_MS = 20_000;
export const DEFAULT_RETRY_DELAY_MS = 800;

let inFlightTokenRefresh: Promise<string | null> | null = null;

export const getFirebaseToken = async (): Promise<string | null> => {
  try {
    const authInstance = getAuth();
    const currentUser = authInstance.currentUser;
    if (currentUser) {
      const token = await getIdToken(currentUser);
      return token;
    }
  } catch (e) {
    logger.error("[Request] Error reading Firebase token:", e);
  }
  return null;
};

/**
 * Single-flight forced Firebase ID token refresh (`getIdToken(currentUser, true)`).
 * Prevents concurrent 401 storms from triggering multiple redundant Firebase refreshes.
 */
export const refreshFirebaseToken = async (): Promise<string | null> => {
  if (inFlightTokenRefresh) {
    return inFlightTokenRefresh;
  }

  inFlightTokenRefresh = (async () => {
    try {
      const authInstance = getAuth();
      const currentUser = authInstance.currentUser;
      if (!currentUser) return null;
      const freshToken = await getIdToken(currentUser, true);
      return freshToken || null;
    } catch (e) {
      logger.warn("[Request] Forced Firebase token refresh failed:", e);
      return null;
    } finally {
      inFlightTokenRefresh = null;
    }
  })();

  return inFlightTokenRefresh;
};

export const getHeaders = async (
  userId?: string,
  options?: { noCache?: boolean; companyId?: string; forceRefreshToken?: boolean },
): Promise<Record<string, string>> => {
  const deviceId = await getMobileDeviceId();
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Device-ID": deviceId,
    "X-Platform": "mobile",
  };
  if (options?.noCache) {
    headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
    headers["Pragma"] = "no-cache";
    headers["Expires"] = "0";
  }
  if (userId) headers["X-User-ID"] = userId;
  if (options?.companyId) headers["X-Company-ID"] = options.companyId;

  const token = options?.forceRefreshToken
    ? await refreshFirebaseToken()
    : await getFirebaseToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  return headers;
};

export const getPublicHeaders = (
  userId?: string,
  companyId?: string,
): Record<string, string> => {
  const deviceId = getMobileDeviceIdSync();
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Device-ID": deviceId,
    "X-Platform": "mobile",
  };
  if (userId) headers["X-User-ID"] = userId;
  if (companyId) headers["X-Company-ID"] = companyId;
  return headers;
};

export class ApiError extends Error {
  status: number;
  code?: string;
  retryAfter?: number;
  data?: any;

  constructor(
    message: string,
    status: number,
    code?: string,
    extra?: { retryAfter?: number; data?: any },
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.retryAfter = extra?.retryAfter;
    this.data = extra?.data;
  }
}

export interface ApiFetchOptions extends RequestInit {
  userId?: string;
  companyId?: string;
  noCache?: boolean;
  /** Skip auth headers entirely */
  public?: boolean;
  /** Do not broadcast sessionEvents (useful during explicit auth bootstrap error handling) */
  suppressSessionInvalidEvent?: boolean;
  /** Internal flag — prevents infinite retry loops */
  _isRetry?: boolean;
  /** Internal flag — prevents infinite 401 Firebase token refresh loops */
  _hasRefreshedToken?: boolean;
  /** Timeout in milliseconds before aborting (default: 20_000ms) */
  timeoutMs?: number;
  /**
   * Number of retries on network error, timeout, or 502/503/504 status.
   * Default: 1 for idempotent methods (GET, HEAD, OPTIONS), 0 for mutations.
   */
  retries?: number;
  /** Base delay between retries in milliseconds (default: 800ms) */
  retryDelayMs?: number;
}

const inFlightRequests = new Map<string, Promise<any>>();

export const clearInFlightRequests = (): void => {
  logger.debug(
    `[Request] Clearing inFlightRequests map (${inFlightRequests.size} active)`,
  );
  inFlightRequests.clear();
};

export function detectDeactivationReason(
  code: string | undefined,
  detail: unknown,
): SessionInvalidReason | null {
  if (code === "COMPANY_DEACTIVATED") return "COMPANY_DEACTIVATED";
  if (code === "ACCOUNT_DEACTIVATED") return "ACCOUNT_DEACTIVATED";
  if (typeof detail !== "string") return null;

  const lower = detail.toLowerCase();
  if (
    lower.includes("organization account has been deactivated") ||
    lower.includes("company account is not registered or inactive") ||
    lower.includes("company has been deactivated")
  ) {
    return "COMPANY_DEACTIVATED";
  }
  if (
    lower.includes("your account has been deactivated") ||
    lower.includes("user account is deactivated")
  ) {
    return "ACCOUNT_DEACTIVATED";
  }
  return null;
}

export async function apiFetch<T = any>(
  url: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  const shouldDeduplicate =
    method === "GET" &&
    !options.noCache &&
    !options._isRetry &&
    !options._hasRefreshedToken &&
    !options.signal;

  const dedupKey = shouldDeduplicate
    ? `${method}:${url}:${options.userId || ""}:${options.companyId || ""}`
    : null;

  if (dedupKey && inFlightRequests.has(dedupKey)) {
    logger.debug(`[apiFetch] In-flight deduplication hit for ${dedupKey}`);
    return inFlightRequests.get(dedupKey) as Promise<T>;
  }

  const executionPromise = (async (): Promise<T> => {
    const {
      userId,
      companyId,
      noCache,
      public: isPublic,
      suppressSessionInvalidEvent,
      _hasRefreshedToken,
      _isRetry,
      headers: extraHeaders,
      timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
      retries,
      retryDelayMs = DEFAULT_RETRY_DELAY_MS,
      signal: userSignal,
      ...rest
    } = options;

    const isIdempotent =
      method === "GET" || method === "HEAD" || method === "OPTIONS";
    const retryBudget = retries ?? (isIdempotent ? 1 : 0);

    const baseHeaders = isPublic
      ? getPublicHeaders(userId, companyId)
      : await getHeaders(userId, {
          noCache,
          companyId,
          forceRefreshToken: Boolean(_hasRefreshedToken),
        });

    const headers = {
      ...baseHeaders,
      ...(extraHeaders as Record<string, string> | undefined),
    };

    logger.debug(
      `[apiFetch] ${method} → ${url} (timeout: ${timeoutMs}ms, retries: ${retryBudget})`,
    );

    const controller = new AbortController();
    let isTimeout = false;

    const timer = setTimeout(() => {
      isTimeout = true;
      controller.abort();
    }, timeoutMs);

    let onUserAbort: (() => void) | undefined;
    if (userSignal) {
      if (userSignal.aborted) {
        clearTimeout(timer);
        controller.abort(userSignal.reason);
      } else {
        onUserAbort = () => {
          controller.abort(userSignal.reason);
        };
        userSignal.addEventListener("abort", onUserAbort, { once: true });
      }
    }

    let response: Response;
    try {
      try {
        response = await fetch(url, {
          ...rest,
          headers,
          signal: controller.signal,
        });
      } catch (networkErr: any) {
        if (isTimeout) {
          const allowTimeoutRetry =
            typeof options.retries === "number" && retryBudget > 0;
          if (allowTimeoutRetry && !userSignal?.aborted) {
            logger.warn(
              `[apiFetch] ${method} ${url} timed out after ${timeoutMs}ms, retrying (${retryBudget} retries left)...`,
            );
            await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
            return apiFetch<T>(url, {
              ...options,
              retries: retryBudget - 1,
              _isRetry: true,
            });
          }
          logger.error(
            `[apiFetch] ${method} ${url} timed out after ${timeoutMs}ms`,
          );
          throw new ApiError(
            `Request timed out after ${Math.round(timeoutMs / 1000)} seconds. Please check your connection and try again.`,
            408,
            "TIMEOUT",
          );
        }

        if (userSignal?.aborted) {
          throw new ApiError("Request cancelled", 0, "CANCELLED");
        }

        logger.error(`[apiFetch] network error for ${url}:`, networkErr);

        if (retryBudget > 0 && !userSignal?.aborted) {
          logger.warn(
            `[apiFetch] Network error for ${url}, retrying (${retryBudget} retries left)...`,
          );
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
          return apiFetch<T>(url, {
            ...options,
            retries: retryBudget - 1,
            _isRetry: true,
          });
        }

        throw new ApiError("Network request failed", 0, "NETWORK_ERROR");
      }

      let body: any = null;
      try {
        body = await response.json();
      } catch {}

      const isTransientServerError =
        response.status === 502 ||
        response.status === 503 ||
        response.status === 504;
      if (isTransientServerError && retryBudget > 0 && !userSignal?.aborted) {
        logger.warn(
          `[apiFetch] Server returned ${response.status} for ${url}, retrying (${retryBudget} retries left)...`,
        );
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        return apiFetch<T>(url, {
          ...options,
          retries: retryBudget - 1,
          _isRetry: true,
        });
      }

      const code = body?.code as string | undefined;
      const detail = body?.detail;
      const detailStr = typeof detail === "string" ? detail : "";

      if (response.status === 401) {
        if (code === "SESSION_TERMINATED" || detailStr === "Session_Replaced") {
          logger.warn(
            `[apiFetch] session replaced (${detailStr || code}) — emitting SESSION_TERMINATED`,
          );
          if (!suppressSessionInvalidEvent) {
            emitSessionInvalid("SESSION_TERMINATED");
          }
          throw new ApiError(
            detailStr || body?.message || "Session replaced on another device",
            401,
            "SESSION_TERMINATED",
            { data: body },
          );
        }

        if (code === "SESSION_EXPIRED" || detailStr === "Session_Expired") {
          logger.warn(
            `[apiFetch] session expired (${detailStr || code}) — emitting SESSION_EXPIRED`,
          );
          if (!suppressSessionInvalidEvent) {
            emitSessionInvalid("SESSION_EXPIRED");
          }
          throw new ApiError(
            detailStr || body?.message || "Session expired",
            401,
            "SESSION_EXPIRED",
            { data: body },
          );
        }

        const deactivation = detectDeactivationReason(code, detail);
        if (deactivation) {
          logger.warn(
            `[apiFetch] account/company invalid on 401 (${deactivation})`,
          );
          if (!suppressSessionInvalidEvent) {
            emitSessionInvalid(deactivation);
          }
          throw new ApiError(
            detailStr || body?.message || "Account deactivated",
            401,
            deactivation,
            { data: body },
          );
        }

        // Generic 401 (likely an expired 1-hr Firebase ID token):
        // Attempt ONE forced Firebase token refresh + retry before ending the session.
        if (!isPublic && !_hasRefreshedToken) {
          const freshToken = await refreshFirebaseToken();
          if (freshToken) {
            logger.info(
              `[apiFetch] 401 on ${url} — forced Firebase token refresh succeeded, retrying once`,
            );
            return apiFetch<T>(url, {
              ...options,
              _hasRefreshedToken: true,
              _isRetry: true,
            });
          }
        }

        if (!isPublic) {
          logger.error(
            `[apiFetch] 401 on ${url} after refresh check — emitting SESSION_EXPIRED`,
          );
          if (!suppressSessionInvalidEvent) {
            emitSessionInvalid("SESSION_EXPIRED");
          }
          throw new ApiError(
            detailStr || body?.message || "Session expired. Please log in again.",
            401,
            "SESSION_EXPIRED",
            { data: body },
          );
        }
      }

      if (response.status === 403) {
        const deactivation = detectDeactivationReason(code, detail);
        if (deactivation) {
          logger.warn(
            `[apiFetch] 403 deactivation (${deactivation}) on ${url} — emitting sessionEvents`,
          );
          if (!suppressSessionInvalidEvent) {
            emitSessionInvalid(deactivation);
          }
          throw new ApiError(
            detailStr || body?.message || "Access denied",
            403,
            deactivation,
            { data: body },
          );
        }
      }

      if (!response.ok) {
        logger.error(`[apiFetch] ${response.status} for ${url}:`, body);
        throw new ApiError(
          detailStr || body?.message || `HTTP error! status: ${response.status}`,
          response.status,
          code,
          {
            retryAfter:
              typeof body?.retry_after === "number" ? body.retry_after : undefined,
            data: body,
          },
        );
      }

      return body as T;
    } finally {
      clearTimeout(timer);
      if (userSignal && onUserAbort) {
        userSignal.removeEventListener("abort", onUserAbort);
      }
    }
  })();

  if (dedupKey) {
    inFlightRequests.set(dedupKey, executionPromise);
    executionPromise
      .finally(() => {
        inFlightRequests.delete(dedupKey);
      })
      .catch(() => {});
  }

  return executionPromise;
}
