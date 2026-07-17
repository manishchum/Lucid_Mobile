import { useState, useCallback, useRef } from "react";
import { Audio } from "expo-av";
import { Alert, Platform } from "react-native";

export type AudioResult =
  | { success: true; uri: string; mimeType: string; durationMs?: number }
  | {
      success: false;
      reason: "cancelled" | "permission_denied" | "error";
      error?: string;
    };

interface UseAudioRecorderReturn {
  isRecording: boolean;
  isPreparing: boolean;
  recordedUri: string | null;
  durationMs: number;
  startRecording: () => Promise<boolean>;
  stopRecording: () => Promise<AudioResult>;
  reset: () => void;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);

  const requestPermission = async (): Promise<boolean> => {
    if (Platform.OS === "web") return false;
    const { status, canAskAgain } = await Audio.requestPermissionsAsync();
    if (status === "granted") return true;
    if (!canAskAgain) {
      Alert.alert(
        "Microphone permission needed",
        "Please enable microphone access in your device Settings to record audio.",
        [{ text: "OK" }],
      );
    } else {
      Alert.alert(
        "Microphone access denied",
        "Microphone permission is required to record audio for task submission.",
        [{ text: "OK" }],
      );
    }
    return false;
  };

  const startRecording = useCallback(async (): Promise<boolean> => {
    setIsPreparing(true);
    try {
      const granted = await requestPermission();
      if (!granted) return false;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recordingRef.current = recording;
      setRecordedUri(null);
      setDurationMs(0);
      setIsRecording(true);
      return true;
    } catch (err: any) {
      Alert.alert(
        "Recording error",
        err?.message ?? "Could not start recording.",
      );
      return false;
    } finally {
      setIsPreparing(false);
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<AudioResult> => {
    const recording = recordingRef.current;
    if (!recording) {
      return { success: false, reason: "error", error: "No active recording." };
    }
    try {
      await recording.stopAndUnloadAsync();
      const status = await recording.getStatusAsync();
      const uri = recording.getURI();
      recordingRef.current = null;
      setIsRecording(false);

      if (!uri) {
        return {
          success: false,
          reason: "error",
          error: "Recording produced no file.",
        };
      }

      setRecordedUri(uri);
      setDurationMs(status.durationMillis ?? 0);

      return {
        success: true,
        uri,
        mimeType: Platform.OS === "ios" ? "audio/m4a" : "audio/3gp",
        durationMs: status.durationMillis,
      };
    } catch (err: any) {
      setIsRecording(false);
      const message = err?.message ?? "Unknown recording error";
      Alert.alert("Recording error", message);
      return { success: false, reason: "error", error: message };
    }
  }, []);

  const reset = useCallback(() => {
    setRecordedUri(null);
    setDurationMs(0);
  }, []);

  return {
    isRecording,
    isPreparing,
    recordedUri,
    durationMs,
    startRecording,
    stopRecording,
    reset,
  };
}
