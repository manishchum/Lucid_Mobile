/**
 * Sanitization & PII Masking Utilities for Lucid Mobile
 *
 * Provides safe masking helpers for emails, phone numbers, tokens, URLs,
 * and names to prevent leaking sensitive information into logs, telemetry,
 * or Metro terminal consoles.
 */

const BEARER_RE = /Bearer\s+[A-Za-z0-9_\-\.=/+]+/gi;
const JWT_RE = /eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-\.]+/g;
const SECRET_PARAM_RE = /(token|key|secret|password|auth|api_key|apikey|access_token)=[^&\s"'`]+/gi;
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const PHONE_RE = /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
const USER_PATH_RE = /([/\\](?:Users|home|data[/\\]user[/\\]0)[/\\])([^/\\\s]+)/gi;

/**
 * Mask an email address (e.g., "john.doe@example.com" -> "j***e@e***.com").
 */
export function maskEmail(email: string | null | undefined): string | null {
  if (!email || typeof email !== "string") return null;
  const trimmed = email.trim();
  if (!trimmed.includes("@")) return "[ANONYMIZED_USER]";
  try {
    const [user, domain] = trimmed.split("@");
    const maskedUser =
      user.length <= 2
        ? user[0] + "***"
        : user[0] + "***" + user[user.length - 1];
    let maskedDomain = "***";
    if (domain && domain.includes(".")) {
      const parts = domain.split(".");
      const domName = parts[0] || "";
      const domExt = parts.slice(1).join(".");
      maskedDomain = (domName[0] || "") + "***." + domExt;
    }
    return `${maskedUser}@${maskedDomain}`;
  } catch {
    return "[MASKED_EMAIL]";
  }
}

/**
 * Mask a phone number (e.g., "+91 9876543210" -> "+91 ******3210", "+14155552671" -> "+14******2671").
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone || typeof phone !== "string") return "";
  const trimmed = phone.trim();
  if (trimmed.length <= 4) return "****";
  const last4 = trimmed.slice(-4);
  const plusIdx = trimmed.indexOf("+");
  let prefix = "";
  if (plusIdx !== -1) {
    const spaceIdx = trimmed.indexOf(" ");
    if (spaceIdx !== -1 && spaceIdx <= 6) {
      prefix = trimmed.slice(0, spaceIdx + 1);
    } else {
      prefix = trimmed.slice(0, 3);
    }
  }
  return `${prefix}******${last4}`;
}

/**
 * Mask a human name (e.g., "John Doe" -> "J*** D***").
 */
export function maskName(name: string | null | undefined): string {
  if (!name || typeof name !== "string") return "";
  const trimmed = name.trim();
  if (!trimmed) return "";
  const parts = trimmed.split(/\s+/);
  return parts
    .map((part) => (part.length <= 1 ? part : `${part[0]}***`))
    .join(" ");
}

/**
 * Mask a token, secret credential, or device registration token (e.g., FCM push token).
 */
export function maskToken(token: string | null | undefined): string {
  if (!token || typeof token !== "string") return "";
  const trimmed = token.trim();
  if (trimmed.length <= 10) return "[REDACTED]";
  return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
}

/**
 * Mask sensitive query parameters and URL paths (e.g. ?token=..., /by-email/..., /by-phone/...).
 */
export function maskUrl(url: string | null | undefined): string {
  if (!url || typeof url !== "string") return "";
  let sanitized = url.replace(SECRET_PARAM_RE, "$1=[REDACTED]");
  sanitized = sanitized.replace(
    /(\/users\/by-email\/)([^/?\s]+)/gi,
    (_match, p1, p2) => {
      try {
        const decoded = decodeURIComponent(p2);
        return `${p1}${encodeURIComponent(maskEmail(decoded) || "[MASKED_EMAIL]")}`;
      } catch {
        return `${p1}[MASKED_EMAIL]`;
      }
    },
  );
  sanitized = sanitized.replace(
    /(\/users\/by-phone\/)([^/?\s]+)/gi,
    (_match, p1, p2) => {
      try {
        const decoded = decodeURIComponent(p2);
        return `${p1}${encodeURIComponent(maskPhone(decoded))}`;
      } catch {
        return `${p1}[MASKED_PHONE]`;
      }
    },
  );
  return sanitized;
}

/**
 * Scrub tokens, JWTs, Bearer credentials, secret params, and sensitive file paths from text.
 */
export function sanitizeText(text: string | null | undefined): string | null {
  if (!text || typeof text !== "string") return null;
  let clean = text;
  clean = clean.replace(BEARER_RE, "Bearer [REDACTED]");
  clean = clean.replace(JWT_RE, "[JWT_REDACTED]");
  clean = clean.replace(SECRET_PARAM_RE, "$1=[REDACTED]");
  clean = clean.replace(EMAIL_RE, "[EMAIL_REDACTED]");
  clean = clean.replace(PHONE_RE, "[PHONE_REDACTED]");
  clean = clean.replace(USER_PATH_RE, "$1[REDACTED_USER]");
  return clean;
}
