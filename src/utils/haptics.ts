import { Vibration, Platform } from "react-native";

/**
 * Native Haptics using React Native's built-in Vibration API.
 * 
 * Works out-of-the-box on all Android & iOS devices without requiring extra
 * native packages or recompiling the APK binary!
 */
export const safeHaptics = {
  selection: () => {
    try {
      if (Platform.OS === "android") {
        Vibration.vibrate(8);
      } else {
        Vibration.vibrate(5);
      }
    } catch {}
  },
  lightImpact: () => {
    try {
      if (Platform.OS === "android") {
        Vibration.vibrate(15);
      } else {
        Vibration.vibrate(10);
      }
    } catch {}
  },
  successNotification: () => {
    try {
      // Pattern: [pause, vibrate, pause, vibrate]
      Vibration.vibrate([0, 20, 50, 30]);
    } catch {}
  },
  errorNotification: () => {
    try {
      // Pattern: double pulse for error
      Vibration.vibrate([0, 40, 60, 40]);
    } catch {}
  },
};
