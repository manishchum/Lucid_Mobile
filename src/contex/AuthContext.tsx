import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, AppStateStatus } from "react-native";
import {
  getAuth,
  signInWithPhoneNumber,
  onAuthStateChanged,
  signOut,
  FirebaseAuthTypes,
} from "@react-native-firebase/auth";
import {
  getUserByPhone,
  recordUserLogin,
  getCompanyActiveStatus,
} from "../api/users/Request";
import { onSessionInvalid, SessionInvalidReason } from "../api/sessionEvents";
import { logger } from "../utils/UnifiedLogger";

export interface CachedUser {
  userId: string;
  firebaseUid: string; // firebase_uid from users table — needed for endpoints that validate against Firebase JWT
  name: string;
  email: string;
  phone: string;
  companyId: string;
  departmentId: string | null;
  managerId: string | null;
  isActive: boolean;
}

export interface CheckUserResult {
  status: "active" | "inactive" | "not_registered" | "company_invalid";
  user?: CachedUser;
}

interface AuthContextType {
  isLoggedIn: boolean;
  isInitializing: boolean;
  phoneNumber: string;
  otpStep: boolean;
  confirmation: any;
  cachedUser: CachedUser | null;
  forcedLogoutReason:
    | "user_deactivated"
    | "company_deactivated"
    | "session_terminated"
    | null;
  clearForcedLogoutReason: () => void;
  setPhoneNumber: (phone: string) => void;
  checkUserExists: (phone: string) => Promise<CheckUserResult>;
  sendOTP: () => Promise<boolean>;
  verifyOTP: (otp: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const CACHED_USER_KEY = "@auth_cached_user";
const PHONE_NUMBER_KEY = "@auth_phone_number";

function toE164(rawPhone: string): string {
  // Strip everything except digits and a leading +
  let digits = rawPhone.replace(/[^\d+]/g, "");

  // Already correctly formatted
  if (digits.startsWith("+91") && digits.length === 13) {
    return digits;
  }

  // Strip any leading + before further processing
  digits = digits.replace(/^\+/, "");

  // 91xxxxxxxxxx (12 digits, country code, no +)
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+${digits}`;
  }

  // 0xxxxxxxxxxx (11 digits, leading 0 — old local format)
  if (digits.length === 11 && digits.startsWith("0")) {
    return `+91${digits.slice(1)}`;
  }

  // xxxxxxxxxx (bare 10-digit number — the expected normal case)
  if (digits.length === 10) {
    return `+91${digits}`;
  }

  // Fallback — couldn't confidently normalize, return best-effort
  console.warn("[Auth] toE164 — unexpected phone format:", rawPhone);
  return digits.startsWith("91") ? `+${digits}` : `+91${digits}`;
}

// ─── DEV ONLY ────────────────────────────────────────────────────────────────
// Set to true when testing on emulator or device without Play Integrity.
// MUST be false (or removed) before production build.
const DISABLE_APP_VERIFICATION_FOR_TESTING = __DEV__;
// ─────────────────────────────────────────────────────────────────────────────

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpStep, setOtpStep] = useState(false);
  const [confirmation, setConfirmation] = useState<any>(null);
  const [cachedUser, setCachedUser] = useState<CachedUser | null>(null);
  const [forcedLogoutReason, setForcedLogoutReason] = useState<
    "user_deactivated" | "company_deactivated" | "session_terminated" | null
  >(null);

  const ACCOUNT_STATUS_CHECK_INTERVAL_MS = 15 * 60 * 1000;
  const lastCheckedAtRef = useRef<number>(0);
  const isCheckingRef = useRef(false);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    const initAuth = async () => {
      try {
        const storedUserJson = await AsyncStorage.getItem(CACHED_USER_KEY);
        if (storedUserJson) {
          try {
            const user: CachedUser = JSON.parse(storedUserJson);
            setCachedUser(user);
            console.log(
              "[Auth] Restored cachedUser from AsyncStorage:",
              user.userId,
            );
          } catch (e) {
            console.error("[Auth] Error parsing cachedUser:", e);
          }
        }

        const auth = getAuth();

        // Bypass Play Integrity / reCAPTCHA during development
        if (DISABLE_APP_VERIFICATION_FOR_TESTING) {
          auth.settings.appVerificationDisabledForTesting = true;
          console.log(
            "[Auth] ⚠️  appVerificationDisabledForTesting = true (DEV only)",
          );
        }

        unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          try {
            console.log(
              "[Auth] Firebase auth state changed:",
              firebaseUser?.uid ?? "null",
            );
            if (firebaseUser) {
              setIsLoggedIn(true);
              if (firebaseUser.phoneNumber && !phoneNumber) {
                // firebaseUser.phoneNumber is always E.164 e.g. +919811006045
                // phoneNumber state must stay as the raw 10-digit number (used by UI + sendOTP)
                const raw = firebaseUser.phoneNumber.replace(/^\+91/, "");
                setPhoneNumber(raw);
                await AsyncStorage.setItem(PHONE_NUMBER_KEY, raw);
              }
            } else {
              setIsLoggedIn(false);
              setCachedUser(null);
              setPhoneNumber("");
              await AsyncStorage.removeItem(CACHED_USER_KEY);
              await AsyncStorage.removeItem(PHONE_NUMBER_KEY);
            }
          } finally {
            setIsInitializing(false);
          }
        });
      } catch (err) {
        console.error("[Auth] initAuth error:", err);
        setIsInitializing(false);
      }
    };
    initAuth();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const checkUserExists = async (phone: string): Promise<CheckUserResult> => {
    try {
      const normalizedPhone = toE164(phone);
      const response = await getUserByPhone(normalizedPhone);
      if (!response?.user) {
        console.log(
          "[Auth] checkUserExists — no user found for phone:",
          normalizedPhone,
        );
        return { status: "not_registered" };
      }
      if (!response.user.is_active) {
        console.log(
          "[Auth] checkUserExists — user is inactive:",
          response.user.user_id,
        );
        return { status: "inactive" };
      }
      if (
        !response.user.company_id ||
        (response.user as any).company_name === null ||
        (response.user as any).company_name === ""
      ) {
        console.log(
          "[Auth] checkUserExists — company is invalid/not found for user:",
          response.user.user_id,
        );
        return { status: "company_invalid" };
      }

      const user: CachedUser = {
        userId: response.user.user_id,
        firebaseUid: response.user.firebase_uid ?? "",
        name: response.user.name,
        email: response.user.email,
        phone: response.user.phone,
        companyId: response.user.company_id,
        departmentId: response.user.department_id,
        managerId: response.user.manager_id,
        isActive: response.user.is_active,
      };
      setCachedUser(user);

      try {
        await AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(user));
        console.log("[Auth] ✅ Saved cachedUser to AsyncStorage:", user.userId);
      } catch (storageError) {
        console.error(
          "[Auth] Error saving cachedUser to AsyncStorage:",
          storageError,
        );
      }

      console.log("[Auth] checkUserExists ✅ cached user:", user.userId);
      recordUserLogin(user.userId).catch((e) =>
        console.warn("[Auth] recordUserLogin warning:", e),
      );
      return { status: "active", user };
    } catch (error) {
      console.error("[Auth] checkUserExists error:", error);
      return { status: "not_registered" };
    }
  };

  const sendOTP = async (): Promise<boolean> => {
    try {
      const phone = `+91${phoneNumber}`;
      console.log("[Auth] Sending OTP to:", phone);
      const confirmationResult = await signInWithPhoneNumber(getAuth(), phone);
      setConfirmation(
        confirmationResult as FirebaseAuthTypes.ConfirmationResult,
      );
      setOtpStep(true);
      return true;
    } catch (error: any) {
      console.error("[Auth] OTP Send Error:", error);
      return false;
    }
  };

  const verifyOTP = async (otp: string): Promise<boolean> => {
    try {
      if (!confirmation) throw new Error("No confirmation result available");
      console.log("[Auth] Verifying OTP...");
      await confirmation.confirm(otp);
      setOtpStep(false);
      setConfirmation(null);

      if (phoneNumber) {
        try {
          await AsyncStorage.setItem(PHONE_NUMBER_KEY, phoneNumber);
        } catch (storageErr) {
          console.error("[Auth] Error saving phone number:", storageErr);
        }
      }

      return true;
    } catch (error: any) {
      console.error("[Auth] OTP Verification Error:", error);
      return false;
    }
  };

  const logout = async () => {
    try {
      console.log("[Auth] Logging out...");
      await signOut(getAuth());
      setIsLoggedIn(false);
      setCachedUser(null);
      setPhoneNumber("");
      setOtpStep(false);
      setConfirmation(null);

      // Clear persistent storage on logout — both auth keys AND every app-data cache
      try {
        const allKeys = await AsyncStorage.getAllKeys();
        const appDataKeyPrefixes = [
          "@dashboard_data_",
          "@module_progress_",
          "@processed_module_",
          "@company_data_",
          "@auth_modules_",
          "@leaderboard_highlight_",
          "@content_categories_",
          "@content_items_",
          "@career_journeys_",
          "lucid_module_unified_trans_v3_",
        ];
        const keysToRemove = allKeys.filter(
          (key) =>
            key === CACHED_USER_KEY ||
            key === PHONE_NUMBER_KEY ||
            appDataKeyPrefixes.some((prefix) => key.startsWith(prefix)),
        );
        if (keysToRemove.length > 0) {
          await AsyncStorage.multiRemove(keysToRemove);
        }
        console.log(
          `[Auth] Cleared ${keysToRemove.length} AsyncStorage key(s) on logout:`,
          keysToRemove,
        );
      } catch (error) {
        console.error("[Auth] Error clearing AsyncStorage on logout:", error);
      }
    } catch (error) {
      console.error("[Auth] Logout Error:", error);
    }
  };

  // ==================== PERIODIC ACCOUNT-STATUS VERIFICATION ====================
  const verifyAccountStatus = async (force = false) => {
    if (!cachedUser) return;
    if (isCheckingRef.current) return;

    const now = Date.now();
    if (
      !force &&
      now - lastCheckedAtRef.current < ACCOUNT_STATUS_CHECK_INTERVAL_MS
    ) {
      return;
    }

    isCheckingRef.current = true;
    lastCheckedAtRef.current = now;

    try {
      // 1. Re-check the user's own active status (reuses the existing by-phone lookup).
      const userResponse = await getUserByPhone(cachedUser.phone);
      if (!userResponse?.user) {
        // User record vanished entirely — treat like deactivation.
        console.warn("[Auth] verifyAccountStatus — user no longer found");
        setForcedLogoutReason("user_deactivated");
        await logout();
        return;
      }
      if (!userResponse.user.is_active) {
        console.warn("[Auth] verifyAccountStatus — user is now inactive");
        setForcedLogoutReason("user_deactivated");
        await logout();
        return;
      }

      // 2. Check the company's active status.
      const companyActive = await getCompanyActiveStatus(
        cachedUser.companyId,
        cachedUser.userId,
      );
      if (companyActive === false) {
        console.warn("[Auth] verifyAccountStatus — company is now inactive");
        setForcedLogoutReason("company_deactivated");
        await logout();
        return;
      }
    } catch (err) {
      // Network/API failure — fail open, don't punish the user for a
      // flaky connection. Just try again on the next check.
      console.warn(
        "[Auth] verifyAccountStatus check failed, will retry later:",
        err,
      );
    } finally {
      isCheckingRef.current = false;
    }
  };

  const clearForcedLogoutReason = () => setForcedLogoutReason(null);

  useEffect(() => {
    const unsubscribe = onSessionInvalid((reason: SessionInvalidReason) => {
      logger.warn("[Auth] sessionEvents — received invalid session:", reason);
      const mapped =
        reason === "COMPANY_DEACTIVATED"
          ? "company_deactivated"
          : reason === "SESSION_TERMINATED"
            ? "session_terminated"
            : "user_deactivated"; // covers ACCOUNT_DEACTIVATED + UNKNOWN
      setForcedLogoutReason(mapped);
      logout();
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!cachedUser) return;

    // Check once shortly after login/restore.
    verifyAccountStatus(true);

    // Re-check whenever the app comes back to the foreground.
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === "active") {
        verifyAccountStatus();
      }
    };
    const appStateSub = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

    // Also re-check periodically while the app stays open in the foreground.
    const interval = setInterval(() => {
      if (AppState.currentState === "active") {
        verifyAccountStatus();
      }
    }, ACCOUNT_STATUS_CHECK_INTERVAL_MS);

    return () => {
      appStateSub.remove();
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cachedUser?.userId]);

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn,
        isInitializing,
        phoneNumber,
        otpStep,
        confirmation,
        cachedUser,
        forcedLogoutReason,
        clearForcedLogoutReason,
        setPhoneNumber,
        checkUserExists,
        sendOTP,
        verifyOTP,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
