// Bridge between Request.ts and AuthContext.
// Emits auth-invalid events so AuthContext can force logout.
// Backend reasons:
//   - SESSION_TERMINATED    → logged in on another device
//   - ACCOUNT_DEACTIVATED   → user removed/deactivated
//   - COMPANY_DEACTIVATED   → company suspended
export type SessionInvalidReason =
  | "SESSION_TERMINATED"
  | "ACCOUNT_DEACTIVATED"
  | "COMPANY_DEACTIVATED"
  | "UNKNOWN";

type Listener = (reason: SessionInvalidReason) => void;

const listeners = new Set<Listener>();

export function onSessionInvalid(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitSessionInvalid(reason: SessionInvalidReason): void {
  listeners.forEach((listener) => {
    try {
      listener(reason);
    } catch (err) {
      console.error("[sessionEvents] listener threw:", err);
    }
  });
}
