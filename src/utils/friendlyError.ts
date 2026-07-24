/**
 * friendlyError.ts
 *
 * Converts raw Error objects (which may contain HTTP status codes, stack
 * traces, or internal API detail strings) into short, human-readable
 * messages suitable for display in the UI.
 *
 * Coverage:
 *  Network / connectivity  →  offline / unreachable server messages
 *  Auth & session          →  401, 403, JWT, token errors
 *  Validation              →  400, malformed input
 *  Not found               →  404
 *  Rate limiting           →  429
 *  Server errors           →  5xx
 *  Storage                 →  quota exceeded, disk full
 *  File / media            →  upload / download / parse errors
 *  Quiz / submission       →  already submitted, quiz not found
 *  Content                 →  module/content not available
 *  Permission              →  camera, microphone, notification denied
 *  Parsing                 →  JSON, data format errors
 *  Anything else           →  generic fallback
 *
 * The raw technical message is intentionally NOT shown to users.
 */

const HTTP_STATUS_RE = /\b(\d{3})\b/;

export function friendlyError(err: unknown): string {
  if (!err) return "Something went wrong. Please try again later.";

  const msg =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "";

  const lower = msg.toLowerCase();

  // ── Network / offline ────────────────────────────────────────────────────
  if (
    lower.includes("network request failed") ||
    lower.includes("networkerror") ||
    lower.includes("failed to fetch") ||
    lower.includes("econnrefused") ||
    lower.includes("enotfound") ||
    lower.includes("no internet") ||
    lower.includes("offline") ||
    lower.includes("connection refused") ||
    lower.includes("connection reset") ||
    lower.includes("connection closed") ||
    lower.includes("socket hang up") ||
    lower.includes("enetunreach") ||
    lower.includes("ehostunreach") ||
    lower.includes("dns")
  ) {
    return "Check your internet connection and try again.";
  }

  // ── Timeout ───────────────────────────────────────────────────────────────
  if (
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("etimedout") ||
    lower.includes("request aborted")
  ) {
    return "The request took too long. Please check your connection and try again.";
  }

  // ── HTTP status codes ─────────────────────────────────────────────────────
  const match = HTTP_STATUS_RE.exec(msg);
  if (match) {
    const code = parseInt(match[1], 10);

    if (code === 400)
      return "Invalid request. Please check your input and try again.";
    if (code === 401)
      return "Your session has expired. Please log in again.";
    if (code === 403)
      return "You don't have permission to do this. Contact your admin if this is unexpected.";
    if (code === 404)
      return "The requested content could not be found.";
    if (code === 405)
      return "This action is not supported. Please update the app.";
    if (code === 408)
      return "The request timed out. Please try again.";
    if (code === 409)
      return "There was a conflict with your request. Please refresh and try again.";
    if (code === 410)
      return "This content is no longer available.";
    if (code === 413)
      return "The file you're trying to upload is too large. Please use a smaller file.";
    if (code === 415)
      return "This file type isn't supported. Please use a different format.";
    if (code === 422)
      return "Some information is missing or invalid. Please review your input.";
    if (code === 429)
      return "You're doing that too fast. Please wait a moment and try again.";
    if (code === 500)
      return "Our servers encountered an error. Please try again shortly.";
    if (code === 502)
      return "We're having trouble reaching our servers. Please try again.";
    if (code === 503)
      return "The service is temporarily unavailable. Please try again in a few minutes.";
    if (code === 504)
      return "The server took too long to respond. Please try again.";
    if (code >= 500 && code < 600)
      return "Our servers are having trouble right now. Please try again shortly.";
  }

  // ── Auth / session keywords ───────────────────────────────────────────────
  if (
    lower.includes("unauthori") ||
    lower.includes("not authenticated") ||
    lower.includes("invalid token") ||
    lower.includes("token expired") ||
    lower.includes("token invalid") ||
    lower.includes("jwt") ||
    lower.includes("session expired") ||
    lower.includes("login required") ||
    lower.includes("not logged in")
  ) {
    return "Your session has expired. Please log in again.";
  }

  if (
    lower.includes("forbidden") ||
    lower.includes("access denied") ||
    lower.includes("not allowed") ||
    lower.includes("insufficient permission") ||
    lower.includes("insufficient privilege")
  ) {
    return "You don't have permission to do this. Contact your admin if this is unexpected.";
  }

  // ── Validation / input ────────────────────────────────────────────────────
  if (
    lower.includes("validation") ||
    lower.includes("invalid input") ||
    lower.includes("required field") ||
    lower.includes("missing field") ||
    lower.includes("bad request")
  ) {
    return "Some information is missing or invalid. Please review and try again.";
  }

  // ── Already submitted / duplicate ────────────────────────────────────────
  if (
    lower.includes("already submitted") ||
    lower.includes("already completed") ||
    lower.includes("duplicate") ||
    lower.includes("already exists")
  ) {
    return "This has already been submitted. Refresh to see the latest status.";
  }

  // ── Quiz / module specific ────────────────────────────────────────────────
  if (lower.includes("quiz") && lower.includes("not found")) {
    return "This quiz is no longer available. Please go back and try again.";
  }

  if (
    lower.includes("module not found") ||
    lower.includes("content not found") ||
    lower.includes("not found")
  ) {
    return "The requested content could not be found.";
  }

  if (lower.includes("quiz") || lower.includes("submission")) {
    return "Couldn't submit your response. Please try again.";
  }

  // ── File / upload / download ──────────────────────────────────────────────
  if (
    lower.includes("upload") ||
    lower.includes("file too large") ||
    lower.includes("max size") ||
    lower.includes("size limit")
  ) {
    return "The file is too large to upload. Please use a smaller file.";
  }

  if (lower.includes("download") || lower.includes("fetch failed")) {
    return "Couldn't download the content. Please check your connection and try again.";
  }

  if (
    lower.includes("unsupported format") ||
    lower.includes("unsupported file") ||
    lower.includes("invalid file type")
  ) {
    return "This file format isn't supported.";
  }

  // ── Storage ───────────────────────────────────────────────────────────────
  if (
    lower.includes("quota") ||
    lower.includes("storage full") ||
    lower.includes("disk full") ||
    lower.includes("out of space") ||
    lower.includes("insufficient storage")
  ) {
    return "Your device storage is full. Please free up some space and try again.";
  }

  // ── Permissions (device) ──────────────────────────────────────────────────
  if (
    lower.includes("camera") ||
    lower.includes("microphone") ||
    lower.includes("permission denied") ||
    lower.includes("not granted") ||
    lower.includes("media permission")
  ) {
    return "Permission was denied. Please allow access in your device settings.";
  }

  if (lower.includes("notification") && lower.includes("permission")) {
    return "Notification permission was denied. Enable it in your device settings to stay updated.";
  }

  // ── JSON / parsing ────────────────────────────────────────────────────────
  if (
    lower.includes("json") ||
    lower.includes("parse error") ||
    lower.includes("unexpected token") ||
    lower.includes("syntaxerror") ||
    lower.includes("invalid response")
  ) {
    return "Received an unexpected response from the server. Please try again.";
  }

  // ── Empty / no data ───────────────────────────────────────────────────────
  if (
    lower.includes("empty data") ||
    lower.includes("no data") ||
    lower.includes("empty response")
  ) {
    return "No data was returned. Please try again or contact support.";
  }

  // ── Rate / throttle (keyword fallback) ───────────────────────────────────
  if (
    lower.includes("rate limit") ||
    lower.includes("too many request") ||
    lower.includes("throttle")
  ) {
    return "You're doing that too fast. Please wait a moment and try again.";
  }

  // ── Default ───────────────────────────────────────────────────────────────
  return "Something went wrong. Please try again later.";
}
