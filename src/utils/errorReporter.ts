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

// Fire-and-forget POST
function send(payload: Record<string, any>) {
  try {
    const body = JSON.stringify(payload);
    fetch(LOG_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    }).catch(() => {
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
  send({
    email_id: safeEmail(),
    error: String(error).slice(0, MAX_MSG_LEN),
    stack_trace: stack ? String(stack).slice(0, MAX_STACK_LEN) : null,
    error_type: errorType,
    browser,
    os,
    device,
    action: action || screen,
    page_url: screen,
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
  const globalAny = global as any;
  try {
    globalAny.addEventListener?.('unhandledrejection', (ev: any) => {
      const reason = ev?.reason ?? ev;
      report(reason?.message || String(reason), 'UnhandledRejection', reason?.stack);
    });
  } catch {
  }

  // 3) Wrap fetch so failed API calls (network errors, 4xx/5xx) get logged
  //    too — mirrors clientErrorReporter.ts's fetch wrapper on web.
  const originalFetch = global.fetch;
  global.fetch = async (...args: Parameters<typeof fetch>) => {
    try {
      const res = await originalFetch(...args);
      if (!res.ok && res.status >= 400) {
        report(`Fetch failed ${res.status} ${res.statusText}`, 'FetchError', null, String(args[0]));
      }
      return res;
    } catch (err: any) {
      report(err?.message || String(err), 'FetchException', err?.stack, String(args[0]));
      throw err;
    }
  };
}

export function reportBoundaryError(error: Error, componentStack?: string) {
  report(error?.message || String(error), 'ErrorBoundary', error?.stack || componentStack, null);
}