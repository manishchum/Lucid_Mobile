import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { AppState, AppStateStatus } from "react-native";
import {
  ApiError,
  AuthMeResponse,
  WS_BASE_URL,
  getAuthMe,
  getFirebaseToken,
  refreshFirebaseToken,
  sendOtpApi,
  verifyOtpApi,
} from "../api/users/Request";
import { onSessionInvalid, SessionInvalidReason } from "../api/sessionEvents";
import {
  CountryItem,
  DEFAULT_COUNTRY,
  getCountryByCode,
  parseE164Phone,
  sanitizeLocalPhoneInput,
  toE164Phone,
} from "../utils/countries";
import { getMobileDeviceId } from "../utils/deviceId";
import { logger } from "../utils/UnifiedLogger";
import { offlineQueue } from "../utils/offlineQueue";
import { appStorage } from "../utils/appStorage";
import { purgeAllMobileLocalCache } from "../utils/cacheManager";
import { homePerfMeter } from "../utils/homePerformanceMeter";
import {
  getAuth,
  onAuthStateChanged,
  signInWithCustomToken,
  signOut,
} from "@react-native-firebase/auth";

export interface CachedUser {
  userId: string;
  firebaseUid: string; // firebase_uid from users table (optional on /auth/me payload)
  name: string;
  email: string;
  phone: string;
  companyId: string;
  function_id: string | null;
  sub_function_id: string | null;
  managerId: string | null;
  isActive: boolean;
}

export interface VerifyOtpResult {
  success: boolean;
  message?: string;
  remainingAttempts?: number;
  isInvalidated?: boolean;
}

export interface SendOtpResult {
  success: boolean;
  status?: number;
  message?: string;
  retryAfter?: number;
  details?: string;
}

export type ForcedLogoutReason =
  | "user_deactivated"
  | "company_deactivated"
  | "session_terminated"
  | "session_expired"
  | null;

export type SessionStatus = "unknown" | "verified" | "offline_grace";

interface AuthContextType {
  user: any;
  isInitializing: boolean;
  isLoggedIn: boolean;
  phoneNumber: string;
  selectedCountry: CountryItem;
  setSelectedCountry: (country: CountryItem) => void;
  otpStep: boolean;
  setOtpStep: (step: boolean) => void;
  cachedUser: CachedUser | null;
  authMeData: AuthMeResponse | null;
  sessionStatus: SessionStatus;
  forcedLogoutReason: ForcedLogoutReason;
  clearForcedLogoutReason: () => void;
  setPhoneNumber: (phone: string) => void;
  sendOTP: (
    phoneOverride?: string,
    countryOverride?: CountryItem,
  ) => Promise<SendOtpResult>;
  verifyOTP: (
    otp: string,
    phoneOverride?: string,
    countryOverride?: CountryItem,
  ) => Promise<VerifyOtpResult>;
  revalidateSession: (options?: {
    force?: boolean;
    isColdStart?: boolean;
  }) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const CACHED_USER_KEY = "@auth_cached_user";
const PHONE_NUMBER_KEY = "@auth_phone_number";
const COUNTRY_CODE_KEY = "@auth_country_code";

function mapEmployeeDataToCachedUser(
  emp: any,
  fallbackFirebaseUid: string = "",
): CachedUser {
  return {
    userId: String(emp.user_id || ""),
    firebaseUid: String(emp.firebase_uid || fallbackFirebaseUid || ""),
    name: String(emp.name || ""),
    email: String(emp.email || ""),
    phone: String(emp.phone || ""),
    companyId: String(emp.company_id || ""),
    function_id: emp.function_id ?? null,
    sub_function_id: emp.sub_function_id ?? null,
    managerId: emp.manager_id ?? null,
    isActive: emp.is_active !== false,
  };
}

function isConnectivityError(err: unknown): boolean {
  if (err instanceof ApiError) {
    return (
      err.code === "NETWORK_ERROR" ||
      err.code === "TIMEOUT" ||
      err.status === 0 ||
      err.status === 408 ||
      err.status >= 500
    );
  }
  return true;
}

function mapApiErrorToForcedReason(
  err: ApiError,
): Exclude<ForcedLogoutReason, null> | null {
  if (err.code === "SESSION_TERMINATED") return "session_terminated";
  if (err.code === "SESSION_EXPIRED") return "session_expired";
  if (err.code === "COMPANY_DEACTIVATED") return "company_deactivated";
  if (err.code === "ACCOUNT_DEACTIVATED" || err.status === 404) {
    return "user_deactivated";
  }

  if (err.status === 401) {
    const msg = err.message.toLowerCase();
    if (msg.includes("session_replaced") || msg.includes("another device")) {
      return "session_terminated";
    }
    return "session_expired";
  }

  if (err.status === 403) {
    const msg = err.message.toLowerCase();
    if (msg.includes("company") || msg.includes("organization")) {
      return "company_deactivated";
    }
    return "user_deactivated";
  }

  return null;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const initialCountry = getCountryByCode(
    appStorage.getString(COUNTRY_CODE_KEY),
  );
  const [selectedCountry, setSelectedCountryState] =
    useState<CountryItem>(initialCountry);
  const [user, setUser] = useState<any>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [phoneNumber, setPhoneNumberState] = useState<string>(() => {
    const raw = appStorage.getString(PHONE_NUMBER_KEY) || "";
    return sanitizeLocalPhoneInput(raw, initialCountry);
  });
  const [otpStep, setOtpStep] = useState(false);
  const [cachedUser, setCachedUserState] = useState<CachedUser | null>(() =>
    appStorage.getObject<CachedUser>(CACHED_USER_KEY),
  );
  const [authMeData, setAuthMeData] = useState<AuthMeResponse | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("unknown");
  const [forcedLogoutReason, setForcedLogoutReason] =
    useState<ForcedLogoutReason>(null);

  const ACCOUNT_STATUS_CHECK_INTERVAL_MS = 15 * 60 * 1000;
  const lastCheckedAtRef = useRef<number>(0);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const selectedCountryRef = useRef<CountryItem>(initialCountry);
  const cachedUserRef = useRef<CachedUser | null>(cachedUser);
  const isLoggedInRef = useRef<boolean>(false);
  const sessionStatusRef = useRef<SessionStatus>("unknown");
  const isSigningInRef = useRef<boolean>(false);
  const isHandlingForcedLogoutRef = useRef<boolean>(false);
  const revalidateInFlightRef = useRef<Promise<boolean> | null>(null);
  const forcedLogoutReasonRef = useRef<ForcedLogoutReason>(null);
  const authWsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    selectedCountryRef.current = selectedCountry;
  }, [selectedCountry]);

  useEffect(() => {
    cachedUserRef.current = cachedUser;
  }, [cachedUser]);

  useEffect(() => {
    isLoggedInRef.current = isLoggedIn;
  }, [isLoggedIn]);

  useEffect(() => {
    sessionStatusRef.current = sessionStatus;
  }, [sessionStatus]);

  const setSelectedCountry = useCallback((country: CountryItem) => {
    selectedCountryRef.current = country;
    setSelectedCountryState(country);
    appStorage.setString(COUNTRY_CODE_KEY, country.code);
    AsyncStorage.setItem(COUNTRY_CODE_KEY, country.code).catch(() => {});

    setPhoneNumberState((prev) => {
      const clean = sanitizeLocalPhoneInput(prev, country);
      appStorage.setString(PHONE_NUMBER_KEY, clean);
      AsyncStorage.setItem(PHONE_NUMBER_KEY, clean).catch(() => {});
      return clean;
    });
  }, []);

  const setPhoneNumber = useCallback((phone: string) => {
    const clean = sanitizeLocalPhoneInput(phone, selectedCountryRef.current);
    setPhoneNumberState(clean);
    appStorage.setString(PHONE_NUMBER_KEY, clean);
  }, []);

  const persistCachedUser = useCallback(
    async (nextUser: CachedUser, countryOverride?: CountryItem) => {
      cachedUserRef.current = nextUser;
      setCachedUserState(nextUser);
      appStorage.setObject(CACHED_USER_KEY, nextUser);

      if (nextUser.phone) {
        const parsed = parseE164Phone(
          nextUser.phone,
          countryOverride ?? selectedCountryRef.current,
        );
        if (parsed.localNumber) {
          setPhoneNumberState(parsed.localNumber);
          appStorage.setString(PHONE_NUMBER_KEY, parsed.localNumber);
          AsyncStorage.setItem(PHONE_NUMBER_KEY, parsed.localNumber).catch(
            () => {},
          );
        }
        if (parsed.country) {
          selectedCountryRef.current = parsed.country;
          setSelectedCountryState(parsed.country);
          appStorage.setString(COUNTRY_CODE_KEY, parsed.country.code);
          AsyncStorage.setItem(COUNTRY_CODE_KEY, parsed.country.code).catch(
            () => {},
          );
        }
      }

      try {
        await AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(nextUser));
      } catch (storageError) {
        logger.error(
          "[Auth] Error saving cachedUser to AsyncStorage:",
          storageError,
        );
      }
    },
    [],
  );

  const performLogoutInternal = useCallback(async () => {
    if (authWsRef.current) {
      try {
        authWsRef.current.close();
      } catch {}
      authWsRef.current = null;
    }

    try {
      await signOut(getAuth()).catch((err) => {
        logger.warn("[Auth] Firebase signOut warning:", err);
      });
    } catch {}

    cachedUserRef.current = null;
    isLoggedInRef.current = false;
    sessionStatusRef.current = "unknown";
    setCachedUserState(null);
    setAuthMeData(null);
    setSessionStatus("unknown");
    setIsLoggedIn(false);
    setPhoneNumberState("");
    setOtpStep(false);

    await purgeAllMobileLocalCache();
  }, []);

  const logout = useCallback(async () => {
    try {
      logger.info("[Auth] Logging out from Firebase and purging local caches...");
      await performLogoutInternal();
      logger.info("[Auth] All mobile local caches purged successfully on sign out.");
    } catch (error) {
      logger.error("[Auth] Logout Error:", error);
    }
  }, [performLogoutInternal]);

  const handleForcedInvalidation = useCallback(
    async (reason: Exclude<ForcedLogoutReason, null>) => {
      if (isHandlingForcedLogoutRef.current) return;
      isHandlingForcedLogoutRef.current = true;
      try {
        logger.warn(`[Auth] Forced session invalidation: ${reason}`);
        forcedLogoutReasonRef.current = reason;
        setForcedLogoutReason(reason);
        await performLogoutInternal();
      } finally {
        isHandlingForcedLogoutRef.current = false;
      }
    },
    [performLogoutInternal],
  );

  const clearForcedLogoutReason = useCallback(() => {
    forcedLogoutReasonRef.current = null;
    setForcedLogoutReason(null);
  }, []);

  const hydrateFromAuthMe = useCallback(
    async (me: AuthMeResponse, firebaseUid?: string) => {
      setAuthMeData(me);
      if (me.employeeData) {
        const mappedUser = mapEmployeeDataToCachedUser(
          me.employeeData,
          firebaseUid,
        );
        await persistCachedUser(mappedUser);
      }
      const activeComp = me.tenant?.activeCompany;
      if (activeComp?.company_id) {
        const existingComp =
          appStorage.getObject<any>(`@company_${activeComp.company_id}`) || {};
        appStorage.setObject(`@company_${activeComp.company_id}`, {
          ...existingComp,
          ...activeComp,
          learning_style:
            activeComp.learning_style_enabled ??
            (activeComp as any).learning_style ??
            existingComp.learning_style ??
            null,
        });
      }
      sessionStatusRef.current = "verified";
      setSessionStatus("verified");
      isLoggedInRef.current = true;
      setIsLoggedIn(true);
    },
    [persistCachedUser],
  );

  const revalidateSession = useCallback(
    async (options?: { force?: boolean; isColdStart?: boolean }): Promise<boolean> => {
      const force = Boolean(options?.force);
      const isColdStart = Boolean(options?.isColdStart);

      if (revalidateInFlightRef.current) {
        return revalidateInFlightRef.current;
      }

      const now = Date.now();
      if (
        !force &&
        !isColdStart &&
        sessionStatusRef.current === "verified" &&
        now - lastCheckedAtRef.current < ACCOUNT_STATUS_CHECK_INTERVAL_MS
      ) {
        return true;
      }

      const runValidation = async (): Promise<boolean> => {
        const currentFbUser = getAuth().currentUser;
        if (!currentFbUser) {
          return false;
        }

        await getMobileDeviceId();
        lastCheckedAtRef.current = Date.now();

        try {
          const me = await getAuthMe({
            timeoutMs: isColdStart ? 10_000 : 12_000,
            retries: 0,
            suppressSessionInvalidEvent: true,
          });
          await hydrateFromAuthMe(me, currentFbUser.uid);
          return true;
        } catch (err: any) {
          if (err instanceof ApiError) {
            const terminalReason = mapApiErrorToForcedReason(err);
            if (terminalReason) {
              await handleForcedInvalidation(terminalReason);
              return false;
            }
          }

          if (isConnectivityError(err)) {
            if (isColdStart) {
              if (cachedUserRef.current && cachedUserRef.current.isActive !== false) {
                logger.warn(
                  "[Auth] Cold start offline/unreachable with cachedUser — entering offline_grace.",
                );
                sessionStatusRef.current = "offline_grace";
                setSessionStatus("offline_grace");
                isLoggedInRef.current = true;
                setIsLoggedIn(true);
                return false;
              }

              logger.warn(
                "[Auth] Cold start offline with no cached user — showing login screen.",
              );
              sessionStatusRef.current = "unknown";
              setSessionStatus("unknown");
              isLoggedInRef.current = false;
              setIsLoggedIn(false);
              return false;
            }

            logger.warn(
              "[Auth] Session revalidation unreachable — holding in offline_grace until reconnect.",
            );
            sessionStatusRef.current = "offline_grace";
            setSessionStatus("offline_grace");
            return false;
          }

          logger.warn("[Auth] Unexpected revalidation error:", err);
          return false;
        }
      };

      const promise = runValidation().finally(() => {
        if (revalidateInFlightRef.current === promise) {
          revalidateInFlightRef.current = null;
        }
      });
      revalidateInFlightRef.current = promise;
      return promise;
    },
    [hydrateFromAuthMe, handleForcedInvalidation],
  );

  // Register mandatory pre-replay validation on reconnect before offlineQueue replays
  useEffect(() => {
    offlineQueue.setPreReplayValidator(async () => {
      if (!getAuth().currentUser) return false;
      return revalidateSession({ force: true });
    });
    return () => {
      offlineQueue.setPreReplayValidator(null);
    };
  }, [revalidateSession]);

  // Boot: restore AsyncStorage fallback cache + subscribe to Firebase Auth state
  useEffect(() => {
    homePerfMeter.markAuthStart();
    let mounted = true;

    const restoreCachedData = async () => {
      try {
        const [storedUserJson, storedPhone, storedCountryCode] =
          await Promise.all([
            AsyncStorage.getItem(CACHED_USER_KEY),
            AsyncStorage.getItem(PHONE_NUMBER_KEY),
            AsyncStorage.getItem(COUNTRY_CODE_KEY),
          ]);

        if (!mounted) return;

        let resolvedCountry = getCountryByCode(
          storedCountryCode || appStorage.getString(COUNTRY_CODE_KEY),
        );

        if (storedUserJson) {
          try {
            const parsedUser: CachedUser = JSON.parse(storedUserJson);
            cachedUserRef.current = parsedUser;
            setCachedUserState(parsedUser);
            appStorage.setObject(CACHED_USER_KEY, parsedUser);
            if (parsedUser.phone) {
              const parsedPhone = parseE164Phone(
                parsedUser.phone,
                resolvedCountry,
              );
              resolvedCountry = parsedPhone.country;
            }
            logger.info(
              "[Auth] Restored cachedUser from AsyncStorage:",
              parsedUser.userId,
            );
          } catch (e) {
            logger.error("[Auth] Error parsing cachedUser:", e);
          }
        }

        selectedCountryRef.current = resolvedCountry;
        setSelectedCountryState(resolvedCountry);
        appStorage.setString(COUNTRY_CODE_KEY, resolvedCountry.code);

        if (storedPhone) {
          const cleanStored = sanitizeLocalPhoneInput(
            storedPhone,
            resolvedCountry,
          );
          if (cleanStored) {
            setPhoneNumberState(cleanStored);
            appStorage.setString(PHONE_NUMBER_KEY, cleanStored);
          }
        }
      } catch (err) {
        logger.error("[Auth] Error restoring cached auth data:", err);
      }
    };

    const restorePromise = restoreCachedData();
    const deviceIdPromise = getMobileDeviceId();

    const unsubscribe = onAuthStateChanged(getAuth(), async (fbUser) => {
      await Promise.all([restorePromise, deviceIdPromise]);
      if (!mounted) return;

      setUser(fbUser);

      if (!fbUser) {
        sessionStatusRef.current = "unknown";
        setSessionStatus("unknown");
        isLoggedInRef.current = false;
        setIsLoggedIn(false);
        setAuthMeData(null);
        setIsInitializing(false);
        homePerfMeter.markAuthReady();
        logger.info("[Auth] Native Firebase session is inactive");
        return;
      }

      if (isSigningInRef.current) {
        logger.debug(
          "[Auth] Firebase auth change during active OTP sign-in — awaiting verifyOTP bootstrap.",
        );
        return;
      }

      logger.info(
        "[Auth] Cold-start Firebase session detected — validating via /api/auth/me:",
        fbUser.uid,
      );
      await revalidateSession({ force: true, isColdStart: true });
      if (!mounted) return;

      setIsInitializing(false);
      homePerfMeter.markAuthReady();
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [revalidateSession]);

  const sendOTP = async (
    phoneOverride?: string,
    countryOverride?: CountryItem,
  ): Promise<SendOtpResult> => {
    try {
      const activeCountry = countryOverride ?? selectedCountryRef.current;
      const raw =
        phoneOverride && typeof phoneOverride === "string" && phoneOverride.trim()
          ? phoneOverride.trim()
          : phoneNumber;

      const cleanLocal = raw.startsWith("+")
        ? parseE164Phone(raw, activeCountry).localNumber
        : sanitizeLocalPhoneInput(raw, activeCountry);

      if (cleanLocal) {
        setPhoneNumberState(cleanLocal);
        appStorage.setString(PHONE_NUMBER_KEY, cleanLocal);
        AsyncStorage.setItem(PHONE_NUMBER_KEY, cleanLocal).catch(() => {});
      }

      const phone = raw.startsWith("+")
        ? toE164Phone(raw, activeCountry)
        : toE164Phone(cleanLocal || raw, activeCountry);

      logger.info("[Auth] Sending OTP via backend API to:", phone);
      const res = await sendOtpApi(phone);
      if (res.success) {
        setOtpStep(true);
        return { success: true, retryAfter: res.retry_after };
      }
      return { success: false, message: res.message || "Failed to send OTP." };
    } catch (error: any) {
      logger.error("[Auth] OTP Send Error:", error);
      const detailInfo = [
        error?.name ? `Type: ${error.name}` : null,
        error?.cause ? `Cause: ${JSON.stringify(error.cause)}` : null,
        `Target: ${process.env.EXPO_PUBLIC_API_URL || "https://api.workfloww.ai"}/api/auth/send-otp`,
      ]
        .filter(Boolean)
        .join(" | ");

      return {
        success: false,
        status: error?.status,
        retryAfter: error?.retryAfter,
        message: error?.message || "Failed to send OTP.",
        details: detailInfo,
      };
    }
  };

  const verifyOTP = async (
    otp: string,
    phoneOverride?: string,
    countryOverride?: CountryItem,
  ): Promise<VerifyOtpResult> => {
    try {
      const activeCountry = countryOverride ?? selectedCountryRef.current;
      const raw =
        phoneOverride && typeof phoneOverride === "string" && phoneOverride.trim()
          ? phoneOverride.trim()
          : phoneNumber || appStorage.getString(PHONE_NUMBER_KEY) || "";

      const cleanLocal = raw.startsWith("+")
        ? parseE164Phone(raw, activeCountry).localNumber
        : sanitizeLocalPhoneInput(raw, activeCountry);
      const phone = raw.startsWith("+")
        ? toE164Phone(raw, activeCountry)
        : toE164Phone(cleanLocal || raw, activeCountry);

      logger.info("[Auth] Verifying OTP via backend API for:", phone);
      const res = await verifyOtpApi(phone, otp);
      if (res.success && res.token) {
        isSigningInRef.current = true;
        try {
          logger.info("[Auth] Signing in with Firebase custom token...");
          const credential = await signInWithCustomToken(getAuth(), res.token);
          setUser(credential.user);

          if (cleanLocal) {
            setPhoneNumberState(cleanLocal);
            appStorage.setString(PHONE_NUMBER_KEY, cleanLocal);
            await AsyncStorage.setItem(PHONE_NUMBER_KEY, cleanLocal);
          }

          clearForcedLogoutReason();

          // Single authoritative bootstrap via GET /api/auth/me
          try {
            const me = await getAuthMe({
              timeoutMs: 12_000,
              retries: 0,
              suppressSessionInvalidEvent: true,
            });
            await hydrateFromAuthMe(me, credential.user.uid);
          } catch (meErr: any) {
            if (meErr instanceof ApiError) {
              const terminalReason = mapApiErrorToForcedReason(meErr);
              if (terminalReason) {
                await performLogoutInternal();
                return {
                  success: false,
                  message:
                    meErr.message ||
                    "Your account or session is no longer valid.",
                };
              }
            }

            // Transient network hiccup immediately after verify-otp: fall back to verify-otp payload
            if (res.user) {
              const fallbackUser = mapEmployeeDataToCachedUser(
                res.user,
                credential.user.uid,
              );
              await persistCachedUser(fallbackUser, activeCountry);
              if (res.company && res.user?.company_id) {
                appStorage.setObject(
                  `@company_${res.user.company_id}`,
                  res.company,
                );
              }
              sessionStatusRef.current = "offline_grace";
              setSessionStatus("offline_grace");
              isLoggedInRef.current = true;
              setIsLoggedIn(true);
            } else {
              throw meErr;
            }
          }

          setOtpStep(false);
          setIsInitializing(false);
          homePerfMeter.markAuthReady();
          return { success: true };
        } finally {
          isSigningInRef.current = false;
        }
      }
      return { success: false, message: "Invalid OTP code. Please try again." };
    } catch (error: any) {
      logger.error("[Auth] OTP Verification Error:", error);
      const msg: string = error?.message || "Invalid OTP code.";
      const isInvalidated =
        msg.includes("invalidated") ||
        msg.includes("Too many failed") ||
        msg.includes("EXPIRED");
      let remainingAttempts: number | undefined;
      const match = msg.match(/(\d+)\s*attempts?\s*remaining/i);
      if (match) {
        remainingAttempts = parseInt(match[1], 10);
      } else if (isInvalidated) {
        remainingAttempts = 0;
      }
      return {
        success: false,
        message: msg,
        remainingAttempts,
        isInvalidated,
      };
    }
  };

  // Global 401/403/WS session invalidation bus listener
  useEffect(() => {
    const unsubscribe = onSessionInvalid((reason: SessionInvalidReason) => {
      logger.warn("[Auth] sessionEvents — received invalid session:", reason);
      const mapped: Exclude<ForcedLogoutReason, null> =
        reason === "COMPANY_DEACTIVATED"
          ? "company_deactivated"
          : reason === "SESSION_TERMINATED"
            ? "session_terminated"
            : reason === "SESSION_EXPIRED"
              ? "session_expired"
              : "user_deactivated";
      handleForcedInvalidation(mapped);
    });
    return unsubscribe;
  }, [handleForcedInvalidation]);

  // Foreground resume validation (immediate on background/inactive -> active),
  // offline-grace reconnect validation, and 15-min foreground health check (no inactivity timeout)
  useEffect(() => {
    if (!isLoggedIn || !cachedUser?.userId) return;

    const handleAppStateChange = (nextState: AppStateStatus) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;

      if (prevState !== "active" && nextState === "active") {
        logger.info(
          "[Auth] App returned to foreground — validating session via /api/auth/me",
        );
        revalidateSession({ force: true }).catch(() => {});
      }
    };

    const appStateSub = AppState.addEventListener("change", handleAppStateChange);

    const netInfoUnsub = NetInfo.addEventListener((state) => {
      if (
        state.isConnected &&
        state.isInternetReachable &&
        sessionStatusRef.current === "offline_grace"
      ) {
        logger.info(
          "[Auth] Network reconnected while in offline_grace — validating session via /api/auth/me",
        );
        revalidateSession({ force: true })
          .then((valid) => {
            if (valid) {
              offlineQueue.replayQueue().catch(() => {});
            }
          })
          .catch(() => {});
      }
    });

    const interval = setInterval(() => {
      if (AppState.currentState === "active") {
        revalidateSession({ force: false }).catch(() => {});
      }
    }, ACCOUNT_STATUS_CHECK_INTERVAL_MS);

    return () => {
      appStateSub.remove();
      netInfoUnsub();
      clearInterval(interval);
    };
  }, [isLoggedIn, cachedUser?.userId, revalidateSession]);

  // Dedicated foreground Auth WebSocket (`WS /api/auth/ws`) for instant active displacement
  useEffect(() => {
    if (!isLoggedIn || !cachedUser?.userId) {
      if (authWsRef.current) {
        try {
          authWsRef.current.close();
        } catch {}
        authWsRef.current = null;
      }
      return;
    }

    let active = true;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pingInterval: ReturnType<typeof setInterval> | null = null;
    let retryDelay = 1500;
    let isForeground = AppState.currentState === "active";

    const cleanupTimers = () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
      }
    };

    const closeSocket = () => {
      cleanupTimers();
      if (authWsRef.current) {
        try {
          authWsRef.current.close();
        } catch {}
        authWsRef.current = null;
      }
    };

    const connectAuthWS = async (forceRefreshToken = false) => {
      if (!active || !isForeground) return;
      try {
        const [deviceId, token] = await Promise.all([
          getMobileDeviceId(),
          forceRefreshToken ? refreshFirebaseToken() : getFirebaseToken(),
        ]);
        if (!active || !isForeground || !deviceId || !token) return;

        closeSocket();

        const wsUrl = `${WS_BASE_URL}/auth/ws?token=${encodeURIComponent(token)}&device_id=${encodeURIComponent(deviceId)}&platform=mobile`;
        logger.info("[AuthWS] Connecting to dedicated auth WebSocket...");
        const ws = new WebSocket(wsUrl);
        authWsRef.current = ws;

        ws.onopen = () => {
          logger.info("[AuthWS] Connected");
          retryDelay = 1500;
          pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              try {
                ws.send(JSON.stringify({ type: "ping" }));
              } catch {}
            }
          }, 25_000);
        };

        ws.onmessage = async (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (payload?.type === "pong") return;

            if (
              payload?.type === "force_logout" ||
              payload?.reason === "session_replaced"
            ) {
              const targetPlatform = String(payload?.platform || "").toLowerCase();
              const keepDeviceId = payload?.keep_device_id;
              const currentDeviceId = await getMobileDeviceId();
              if (
                targetPlatform === "mobile" &&
                Boolean(keepDeviceId) &&
                Boolean(currentDeviceId) &&
                keepDeviceId !== currentDeviceId
              ) {
                logger.warn(
                  "[AuthWS] Displaced by another mobile login — forcing logout",
                );
                closeSocket();
                handleForcedInvalidation("session_terminated");
              }
            }
          } catch {}
        };

        ws.onclose = (event) => {
          cleanupTimers();
          if (authWsRef.current === ws) {
            authWsRef.current = null;
          }
          if (!active) return;

          if (event?.code === 4001) {
            logger.warn("[AuthWS] Closed with 4001 (session displaced)");
            handleForcedInvalidation("session_terminated");
            return;
          }

          if (isForeground) {
            const shouldRefreshNext = event?.code === 1008;
            reconnectTimer = setTimeout(() => {
              retryDelay = Math.min(retryDelay * 2, 30_000);
              connectAuthWS(shouldRefreshNext);
            }, retryDelay);
          }
        };

        ws.onerror = () => {
          // Handled safely via onclose retry loop
        };
      } catch (err) {
        logger.warn("[AuthWS] Connection setup warning:", err);
      }
    };

    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        isForeground = true;
        if (!authWsRef.current || authWsRef.current.readyState !== WebSocket.OPEN) {
          connectAuthWS(false);
        }
      } else if (nextState === "background" || nextState === "inactive") {
        isForeground = false;
        closeSocket();
      }
    });

    if (isForeground) {
      connectAuthWS(false);
    }

    return () => {
      active = false;
      sub.remove();
      closeSocket();
    };
  }, [isLoggedIn, cachedUser?.userId, handleForcedInvalidation]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isInitializing,
        isLoggedIn,
        phoneNumber,
        selectedCountry,
        setSelectedCountry,
        otpStep,
        setOtpStep,
        cachedUser,
        authMeData,
        sessionStatus,
        forcedLogoutReason,
        clearForcedLogoutReason,
        setPhoneNumber,
        sendOTP,
        verifyOTP,
        revalidateSession,
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
