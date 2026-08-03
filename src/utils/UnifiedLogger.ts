// Simplified version of the app's UnifiedLogger — same public API
// (info/warn/error/debug/trace/fatal, logError, logUserAction,
// measureOperation, setUserId, setCustomAttribute) so callers written
// against this file are a drop-in match if/when the full Sentry+Firebase
// UnifiedLogger gets wired into this part of the codebase.
//
// What this version does NOT do (on purpose, to stay dependency-free here):
//   - report to Sentry or Firebase Crashlytics/Analytics directly
// Instead it exposes `setCrashReporter()` so the app's real crash-reporting
// setup (wherever it already lives) can be plugged in with one call at
// startup, without touching any of the call sites below.
type LogLevel = "info" | "error" | "warn" | "debug" | "trace" | "fatal";

export type CrashReporter = {
  captureException?: (
    error: Error,
    extra?: { level?: LogLevel; meta?: unknown; context?: string },
  ) => void;
  addBreadcrumb?: (data: {
    category: string;
    level: string;
    message: string;
    data?: unknown;
  }) => void;
  setUserId?: (userId: string) => void;
  setCustomAttribute?: (key: string, value: string | number | boolean) => void;
};

function isDev(): boolean {
  // Explicit override takes priority — lets you turn logs on/off
  // independent of build type (e.g. a release build you still want to
  // debug on a device, or a staging build that should stay quiet).
  // Falls back to __DEV__ (which Metro sets automatically: true for
  // `expo start`, false for release/production builds) when the env
  // var isn't set.
  const envOverride = process.env.EXPO_PUBLIC_ENVIRONMENT?.trim().toLowerCase();
  if (envOverride === "development" || envOverride === "dev") return true;
  if (envOverride === "production" || envOverride === "prod") return false;

  return typeof __DEV__ !== "undefined"
    ? __DEV__
    : process.env.NODE_ENV !== "production";
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function normalizeArgs(args: unknown[]): { message: string; meta?: unknown } {
  if (!args || args.length === 0) return { message: "" };
  const [first, ...rest] = args;

  if (rest.length === 0 && first instanceof Error) {
    return { message: first.message || first.name || "Error", meta: first };
  }
  const message = typeof first === "string" ? first : safeStringify(first);
  if (rest.length === 0) return { message };
  return { message, meta: rest.length === 1 ? rest[0] : rest };
}

class SimpleLogger {
  private static instance: SimpleLogger | null = null;
  private enableConsole = isDev();
  private crashReporter: CrashReporter | null = null;

  static getInstance(): SimpleLogger {
    if (!SimpleLogger.instance) SimpleLogger.instance = new SimpleLogger();
    return SimpleLogger.instance;
  }

  /** Plug in real Sentry/Firebase reporting once available, without touching call sites. */
  setCrashReporter(reporter: CrashReporter) {
    this.crashReporter = reporter;
  }

  /** Allow explicitly forcing console output on/off (e.g. QA builds). */
  setShowOnDev(show: boolean) {
    this.enableConsole = show;
  }

  private consoleMethodFor(level: LogLevel) {
    switch (level) {
      case "error":
      case "fatal":
        return console.error;
      case "warn":
        return console.warn;
      case "debug":
        return console.debug ?? console.log;
      case "trace":
        return console.trace ?? console.log;
      default:
        return console.log;
    }
  }

  private log(level: LogLevel, ...args: unknown[]) {
    const { message, meta } = normalizeArgs(args);

    if (this.enableConsole) {
      const fn = this.consoleMethodFor(level);
      meta === undefined
        ? fn(`[${level}] ${message}`)
        : fn(`[${level}] ${message}`, meta);
    }

    if (level === "error" || level === "fatal") {
      const err = meta instanceof Error ? meta : new Error(message);
      this.crashReporter?.captureException?.(err, { level, meta });
    } else if (level === "warn" && !isDev()) {
      this.crashReporter?.addBreadcrumb?.({
        category: "logger",
        level: "warning",
        message: message.slice(0, 200),
        data: meta,
      });
    }
  }

  info(...args: unknown[]) {
    this.log("info", ...args);
  }
  error(...args: unknown[]) {
    this.log("error", ...args);
  }
  warn(...args: unknown[]) {
    this.log("warn", ...args);
  }
  debug(...args: unknown[]) {
    this.log("debug", ...args);
  }
  trace(...args: unknown[]) {
    this.log("trace", ...args);
  }
  fatal(...args: unknown[]) {
    this.log("fatal", ...args);
  }

  logError(
    error: Error,
    context?: string,
    additionalData?: Record<string, any>,
  ) {
    if (this.enableConsole) {
      console.error(`Error: ${error.name} - ${error.message}`, {
        context,
        additionalData,
        stack: error.stack,
      });
    }
    this.crashReporter?.captureException?.(error, {
      level: "error",
      meta: additionalData,
      context,
    });
  }

  logUserAction(
    action: string,
    screen?: string,
    additionalData?: Record<string, any>,
  ) {
    if (this.enableConsole) {
      console.info(`User Action: ${action}`, { screen, additionalData });
    }
    this.crashReporter?.addBreadcrumb?.({
      category: "user-action",
      level: "info",
      message: `User Action: ${action}`,
      data: { screen, additionalData },
    });
  }

  async measureOperation<T>(
    operationName: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await operation();
      if (this.enableConsole) {
        console.info(
          `Operation ${operationName} completed in ${Date.now() - start}ms`,
        );
      }
      return result;
    } catch (err) {
      if (this.enableConsole) {
        console.info(
          `Operation ${operationName} failed after ${Date.now() - start}ms`,
        );
      }
      throw err;
    }
  }

  setUserId(userId: string) {
    if (this.enableConsole) console.info(`User ID set: ${userId}`);
    this.crashReporter?.setUserId?.(userId);
  }

  setCustomAttribute(key: string, value: string | number | boolean) {
    if (this.enableConsole) console.info(`Custom attribute: ${key} = ${value}`);
    this.crashReporter?.setCustomAttribute?.(key, value);
  }
}

export const logger = SimpleLogger.getInstance();
export type { LogLevel };
