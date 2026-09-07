import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { navigationRef } from '../navigations/NavigationService';
import { logger, type CrashReporter, type LogLevel } from './UnifiedLogger';

const EXPO_API_URL =
  process.env.EXPO_PUBLIC_API_URL || 'https://api.workfloww.ai';
const LOG_ENDPOINT = `${EXPO_API_URL}/api/logs`;

const MAX_MSG_LEN = 3000;
const MAX_STACK_LEN = 10000;

const DEDUPE_WINDOW_MS = 30_000;
const MAX_REPEAT = 6;
const dedupeMap = new Map<string, { ts: number; count: number }>();

function shouldSend(key: string): boolean {
  const now = Date.now();
  const entry = dedupeMap.get(key);
  if (!entry) {
    dedupeMap.set(key, { ts: now, count: 1 });
    return true;
  }
  if (now - entry.ts < DEDUPE_WINDOW_MS) {
    entry.count += 1;
    dedupeMap.set(key, entry);
    return entry.count <= MAX_REPEAT;
  }
  dedupeMap.set(key, { ts: now, count: 1 });
  return true;
}

const BEARER_RE = /Bearer\s+[A-Za-z0-9_\-\.=/+]+/gi;
const JWT_RE = /eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-\.]+/g;
const SECRET_PARAM_RE = /(token|key|secret|password|auth|api_key|apikey|access_token)=[^&\s'"`]+/gi;
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const PHONE_RE = /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
const USER_PATH_RE = /([/\\](?:Users|home|data[/\\]user[/\\]0)[/\\])([^/\\\s]+)/gi;

export function maskEmail(email: string | null | undefined): string | null {
  if (!email || typeof email !== 'string') return null;
  const trimmed = email.trim();
  if (!trimmed.includes('@')) return '[ANONYMIZED_USER]';
  try {
    const [user, domain] = trimmed.split('@');
    const maskedUser =
      user.length <= 2
        ? user[0] + '***'
        : user[0] + '***' + user[user.length - 1];
    let maskedDomain = '***';
    if (domain && domain.includes('.')) {
      const parts = domain.split('.');
      const domName = parts[0] || '';
      const domExt = parts.slice(1).join('.');
      maskedDomain = (domName[0] || '') + '***.' + domExt;
    }
    return `${maskedUser}@${maskedDomain}`;
  } catch {
    return '[MASKED_EMAIL]';
  }
}

export function sanitizeText(text: string | null | undefined): string | null {
  if (!text || typeof text !== 'string') return null;
  let clean = text;
  clean = clean.replace(BEARER_RE, 'Bearer [REDACTED]');
  clean = clean.replace(JWT_RE, '[JWT_REDACTED]');
  clean = clean.replace(SECRET_PARAM_RE, '$1=[REDACTED]');
  clean = clean.replace(EMAIL_RE, '[EMAIL_REDACTED]');
  clean = clean.replace(PHONE_RE, '[PHONE_REDACTED]');
  clean = clean.replace(USER_PATH_RE, '$1[REDACTED_USER]');
  return clean;
}

let emailGetter: () => string | null = () => null;

function safeEmail(): string | null {
  try {
    return emailGetter() || null;
  } catch {
    return null;
  }
}

function currentScreen(): string {
  try {
    return navigationRef.isReady()
      ? navigationRef.getCurrentRoute()?.name || 'unknown_screen'
      : 'not_ready';
  } catch {
    return 'unknown_screen';
  }
}

function deviceMeta() {
  return {
    browser: `RN/${Constants?.expoConfig?.version || 'unknown'}`,
    os: `${Platform.OS} ${Platform.Version}`,
    device: `mobile:${Platform.OS}`,
  };
}

let rateLimitBackoffUntil = 0;

// Fire-and-forget POST with backoff on 429
function send(payload: Record<string, any>) {
  if (Date.now() < rateLimitBackoffUntil) {
    return;
  }
  try {
    const body = JSON.stringify(payload);
    fetch(LOG_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
      .then((res) => {
        if (res.status === 429) {
          // Pause telemetry reporting for 60s when rate-limited
          rateLimitBackoffUntil = Date.now() + 60_000;
        }
      })
      .catch(() => {
        // swallow — logging must never itself throw
      });
  } catch {
    // swallow
  }
}

function report(
  error: string,
  errorType: string,
  stack?: string | null,
  action?: string | null,
) {
  const key = `${errorType}|${error}`;
  if (!shouldSend(key)) return;
  const { browser, os, device } = deviceMeta();
  const screen = currentScreen();

  const sanitizedError = sanitizeText(String(error).slice(0, MAX_MSG_LEN)) || 'Unknown error';
  const sanitizedStack = stack ? sanitizeText(String(stack).slice(0, MAX_STACK_LEN)) : null;
  const sanitizedAction = action ? sanitizeText(action) : screen;
  const sanitizedPageUrl = sanitizeText(screen);
  const maskedUserEmail = maskEmail(safeEmail());

  send({
    email_id: maskedUserEmail,
    error: sanitizedError,
    stack_trace: sanitizedStack,
    error_type: errorType,
    browser,
    os,
    device,
    action: sanitizedAction,
    page_url: sanitizedPageUrl,
  });
}

const mobileCrashReporter: CrashReporter = {
  captureException(error: Error, extra?: { level?: LogLevel; meta?: unknown; context?: string }) {
    report(
      error?.message || String(error),
      extra?.level === 'fatal' ? 'Fatal' : 'HandledError',
      error?.stack,
      extra?.context || null,
    );
  },
  addBreadcrumb() {
  },
  setUserId(userId: string) {
    emailGetter = () => userId;
  },
  setCustomAttribute() {
    // No column for this yet server-side.
  },
};

let installed = false;

export function initMobileErrorReporting(getEmail: () => string | null) {
  if (installed) return; 
  installed = true;

  emailGetter = getEmail;
  logger.setCrashReporter(mobileCrashReporter);

  // 1) Uncaught JS errors / fatals that would otherwise just crash the app
  //    silently in production, with no record anywhere.
  const previousHandler = ErrorUtils.getGlobalHandler?.();
  ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    report(error?.message || String(error), isFatal ? 'Fatal' : 'JSError', error?.stack);
    // Preserve whatever default/dev-mode behavior (red box, etc.) already
    // existed — this only adds reporting, doesn't replace it.
    previousHandler?.(error, isFatal);
  });

  // 2) Unhandled promise rejections.
  const globalAny = globalThis as any;
  try {
    globalAny.addEventListener?.('unhandledrejection', (ev: any) => {
      const reason = ev?.reason ?? ev;
      report(reason?.message || String(reason), 'UnhandledRejection', reason?.stack);
    });
  } catch {
  }

  // 3) Wrap fetch so failed API calls (network errors, 4xx/5xx) get logged
  //    too — mirrors clientErrorReporter.ts's fetch wrapper on web.
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (...args: any[]) => {
    try {
      const res = await (originalFetch as any)(...args);
      if (!res.ok && res.status >= 400) {
        report(`Fetch failed ${res.status} ${res.statusText}`, 'FetchError', null, String(args[0]));
      }
      return res;
    } catch (err: any) {
      report(err?.message || String(err), 'FetchException', err?.stack, String(args[0]));
      throw err;
    }
  }) as any;
}

export function reportBoundaryError(error: Error, componentStack?: string) {
  report(error?.message || String(error), 'ErrorBoundary', error?.stack || componentStack, null);
}