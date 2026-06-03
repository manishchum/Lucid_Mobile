import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getAuth,
  onAuthStateChanged,
  signInWithPhoneNumber,
} from '@react-native-firebase/auth';
import { getUserByPhone } from '../api'; 

export interface CachedUser {
  userId: string;
  firebaseUid: string;  // firebase_uid from users table — needed for endpoints that validate against Firebase JWT
  name: string;
  email: string;
  phone: string;
  companyId: string;
  departmentId: string | null;
  managerId: string | null;
  isActive: boolean;
}

interface AuthContextType {
  isLoggedIn: boolean;
  isInitializing: boolean;
  phoneNumber: string;
  otpStep: boolean;
  confirmation: any;
  cachedUser: CachedUser | null;
  setPhoneNumber: (phone: string) => void;
  checkUserExists: (phone: string) => Promise<CachedUser | null>;
  sendOTP: () => Promise<boolean>;
  verifyOTP: (otp: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const CACHED_USER_KEY = '@auth_cached_user';
const PHONE_NUMBER_KEY = '@auth_phone_number';

// ─── DEV ONLY ────────────────────────────────────────────────────────────────
// Set to true when testing on emulator or device without Play Integrity.
// MUST be false (or removed) before production build.
const DISABLE_APP_VERIFICATION_FOR_TESTING = __DEV__;
// ─────────────────────────────────────────────────────────────────────────────

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpStep, setOtpStep] = useState(false);
  const [confirmation, setConfirmation] = useState<any>(null);
  const [cachedUser, setCachedUser] = useState<CachedUser | null>(null);

  // ─── PERSISTENT STORAGE RESTORATION ──────────────────────────────────────
  // On app startup, restore cachedUser from AsyncStorage if Firebase session exists
  useEffect(() => {
    const initializeAuth = async () => {
      const auth = getAuth();

      // Bypass Play Integrity / reCAPTCHA during development.
      if (DISABLE_APP_VERIFICATION_FOR_TESTING) {
        auth.settings.appVerificationDisabledForTesting = true;
        console.log('[Auth] ⚠️  appVerificationDisabledForTesting = true (DEV only)');
      }

      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        try {
          if (firebaseUser) {
            setIsLoggedIn(true);
            if (firebaseUser.phoneNumber && !phoneNumber) {
              const raw = firebaseUser.phoneNumber.replace(/^\+91/, '');
              setPhoneNumber(raw);
              await AsyncStorage.setItem(PHONE_NUMBER_KEY, raw);
            }

            // ✅ KEY FIX: Restore cachedUser from AsyncStorage on app startup
            // This ensures userId is available even after refresh
            try {
              const storedUserJson = await AsyncStorage.getItem(CACHED_USER_KEY);
              if (storedUserJson) {
                const storedUser = JSON.parse(storedUserJson) as CachedUser;
                setCachedUser(storedUser);
                console.log('[Auth] ✅ Restored cachedUser from AsyncStorage:', storedUser.userId);
              } else {
                console.log('[Auth] ⚠️  No cachedUser in AsyncStorage. Will fetch on next login.');
              }
            } catch (error) {
              console.error('[Auth] Error restoring cachedUser from AsyncStorage:', error);
            }
          } else {
            setIsLoggedIn(false);
            setCachedUser(null);
            setPhoneNumber('');
            // Clear persistent storage on logout
            await AsyncStorage.removeItem(CACHED_USER_KEY);
            await AsyncStorage.removeItem(PHONE_NUMBER_KEY);
          }
        } finally {
          setIsInitializing(false);
        }
      });

      return unsubscribe;
    };

    let unsubscribe: (() => void) | null = null;
    initializeAuth().then((unsub) => {
      unsubscribe = unsub;
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const checkUserExists = async (phone: string): Promise<CachedUser | null> => {
    try {
      const response = await getUserByPhone(phone);
      if (!response?.user) {
        console.log('[Auth] checkUserExists — no user found for phone:', phone);
        return null;
      }
      if (!response.user.is_active) {
        console.log('[Auth] checkUserExists — user is inactive:', response.user.user_id);
        return null;
      }
      const user: CachedUser = {
        userId: response.user.user_id,
        firebaseUid: response.user.firebase_uid ?? '',  // store for training-plan and other endpoints
        name: response.user.name,
        email: response.user.email,
        phone: response.user.phone,
        companyId: response.user.company_id,
        departmentId: response.user.department_id,
        managerId: response.user.manager_id,
        isActive: response.user.is_active,
      };
      setCachedUser(user);

      // ✅ KEY FIX: Persist cachedUser to AsyncStorage immediately after fetching
      // This ensures it survives app refresh/restart
      try {
        await AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(user));
        console.log('[Auth] ✅ Saved cachedUser to AsyncStorage:', user.userId);
      } catch (storageError) {
        console.error('[Auth] Error saving cachedUser to AsyncStorage:', storageError);
      }

      console.log('[Auth] checkUserExists ✅ cached user:', user.userId);
      return user;
    } catch (error) {
      console.error('[Auth] checkUserExists error:', error);
      return null;
    }
  };

  const sendOTP = async (): Promise<boolean> => {
    try {
      const phone = `+91${phoneNumber}`;
      console.log('[Auth] Sending OTP to:', phone);
      const confirmationResult = await signInWithPhoneNumber(getAuth(), phone);
      setConfirmation(confirmationResult);
      setOtpStep(true);
      return true;
    } catch (error: any) {
      console.error('[Auth] OTP Send Error:', error);
      return false;
    }
  };

  const verifyOTP = async (otp: string): Promise<boolean> => {
    try {
      if (!confirmation) return false;
      await confirmation.confirm(otp);
      console.log('[Auth] OTP Verified — session persisted by Firebase');
      setOtpStep(false);
      return true;
    } catch (error) {
      console.error('[Auth] OTP Verify Error:', error);
      return false;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await getAuth().signOut();
      console.log('[Auth] User signed out');
    } catch (error) {
      console.error('[Auth] Sign-out error:', error);
    } finally {
      setIsLoggedIn(false);
      setPhoneNumber('');
      setOtpStep(false);
      setConfirmation(null);
      setCachedUser(null);
      // Clear persistent storage on logout
      try {
        await AsyncStorage.removeItem(CACHED_USER_KEY);
        await AsyncStorage.removeItem(PHONE_NUMBER_KEY);
        console.log('[Auth] Cleared AsyncStorage on logout');
      } catch (error) {
        console.error('[Auth] Error clearing AsyncStorage:', error);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn,
        isInitializing,
        phoneNumber,
        otpStep,
        confirmation,
        cachedUser,
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
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};