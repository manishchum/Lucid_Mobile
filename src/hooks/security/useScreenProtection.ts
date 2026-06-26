import { useState, useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as ScreenCapture from "expo-screen-capture";

interface UseScreenProtectionOptions {
  tag?: string;
  /** Called whenever iOS screen-recording status changes. */
  onRecordingChange?: (isRecording: boolean) => void;
}

interface UseScreenProtectionReturn {
  /** true while iOS screen recording is active (always false on Android). */
  isRecording: boolean;
}

export function useScreenProtection(
  options: UseScreenProtectionOptions = {},
): UseScreenProtectionReturn {
  const { tag = "default", onRecordingChange } = options;

  const [isRecording, setIsRecording] = useState(false);

  // Keep a stable ref to the callback so the effect doesn't re-run when the
  // caller passes an inline arrow function.
  const onRecordingChangeRef = useRef(onRecordingChange);
  useEffect(() => {
    onRecordingChangeRef.current = onRecordingChange;
  });

  useEffect(() => {
    let subscription: ReturnType<typeof ScreenCapture.addScreenRecordingListener> | null =
      null;

    const activate = async () => {
      try {
        await ScreenCapture.preventScreenCaptureAsync(tag);
      } catch (e) {
        // Device/simulator may not support it — fail silently in dev.
        if (__DEV__) console.warn("[ScreenProtection] preventScreenCaptureAsync failed:", e);
      }

      // iOS-only: listen for screen-recording status changes.
      if (Platform.OS === "ios") {
        subscription = ScreenCapture.addScreenRecordingListener((event) => {
          const recording = event.isRecording ?? false;
          setIsRecording(recording);
          onRecordingChangeRef.current?.(recording);
        });
      }
    };

    activate();

    return () => {
      // Lift protection when the screen unmounts / loses focus.
      ScreenCapture.allowScreenCaptureAsync(tag).catch(() => {});
      subscription?.remove();
      // Reset recording state on unmount.
      setIsRecording(false);
    };
  }, [tag]);

  return { isRecording };
}