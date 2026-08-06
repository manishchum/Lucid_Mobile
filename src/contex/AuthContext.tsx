import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { AppState, AppStateStatus } from "react-native";
import {
  getUserByPhone,
  recordUserLogin,
  getCompanyActiveStatus,
  sendOtpApi,
  verifyOtpApi,
  JWT_TOKEN_KEY,
} from "../api/users/Request";
import { onSessionInvalid, SessionInvalidReason } from "../api/sessionEvents";
import { logger } from "../utils/UnifiedLogger";
import auth from "@react-native-firebase/auth";

export interface CachedUser {
  userId: string;
  firebaseUid: string; // firebase_uid from users table
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
  // Ref mirror of forcedLogoutReason — readable synchronously before React flushes state.
  const forcedLogoutReasonRef = useRef<typeof forcedLogoutReason>(null);

  useEffect(() => {
    // 1. Restore cached data from AsyncStorage
    const restoreCachedData = async () => {
      try {
        const storedUserJson = await AsyncStorage.getItem(CACHED_USER_KEY);
        const storedPhone = await AsyncStorage.getItem(PHONE_NUMBER_KEY);

        if (storedPhone) {
          setPhoneNumber(storedPhone);
        }

        if (storedUserJson) {
          try {
            const user: CachedUser = JSON.parse(storedUserJson);
            setCachedUser(user);
            console.log("[Auth] Restored cachedUser from AsyncStorage:", user.userId);
          } catch (e) {
            console.error("[Auth] Error parsing cachedUser:", e);
          }
        }
      } catch (err) {
        console.error("[Auth] Error restoring cached auth data:", err);
      }
    };
    restoreCachedData();

    // 2. Listen to Firebase native authentication state
    const unsubscribe = auth().onAuthStateChanged((user) => {
      if (user) {
        setIsLoggedIn(true);
        console.log("[Auth] Native Firebase session is active:", user.uid);
      } else {
        setIsLoggedIn(false);
        console.log("[Auth] Native Firebase session is inactive");
      }
      setIsInitializing(false);
    });

    return unsubscribe;
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
      const phone = toE164(phoneNumber);
      console.log("[Auth] Sending OTP via backend API to:", phone);
      const res = await sendOtpApi(phone);
      if (res.success) {
        setOtpStep(true);
        return true;
      }
      return false;
    } catch (error: any) {
      console.error("[Auth] OTP Send Error:", error);
      return false;
    }
  };

  const verifyOTP = async (otp: string): Promise<boolean> => {
    try {
      const phone = toE164(phoneNumber);
      console.log("[Auth] Verifying OTP via backend API...");
      const res = await verifyOtpApi(phone, otp);
      if (res.success && res.custom_token) {
        // Exchange custom token for a Firebase session on the device
        console.log("[Auth] Signing in with Firebase custom token...");
        await auth().signInWithCustomToken(res.custom_token);

        if (phoneNumber) {
          await AsyncStorage.setItem(PHONE_NUMBER_KEY, phoneNumber);
        }

        if (res.user) {
          const user: CachedUser = {
            userId: res.user.user_id,
            firebaseUid: res.user.firebase_uid ?? "",
            name: res.user.name,
            email: res.user.email,
            phone: res.user.phone,
            companyId: res.user.company_id,
            departmentId: res.user.department_id,
            managerId: res.user.manager_id,
            isActive: res.user.is_active,
          };
          setCachedUser(user);
          await AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(user));
        }

        setOtpStep(false);
        return true;
      }
      return false;
    } catch (error: any) {
      console.error("[Auth] OTP Verification Error:", error);
      return false;
    }
  };

  const logout = async () => {
    try {
      console.log("[Auth] Logging out from Firebase...");
      await auth().signOut();
      
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
        // JWT lives in SecureStore — delete it if present
        await SecureStore.deleteItemAsync(JWT_TOKEN_KEY).catch(() => {});
        console.log(
          `[Auth] Cleared ${keysToRemove.length} AsyncStorage key(s) + SecureStore JWT on logout:`,
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
        forcedLogoutReasonRef.current = "user_deactivated";
        setForcedLogoutReason("user_deactivated");
        await logout();
        return;
      }
      if (!userResponse.user.is_active) {
        console.warn("[Auth] verifyAccountStatus — user is now inactive");
        forcedLogoutReasonRef.current = "user_deactivated";
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
        forcedLogoutReasonRef.current = "company_deactivated";
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
