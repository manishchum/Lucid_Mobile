import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Audio, AVPlaybackStatus } from "expo-av";
import { useAudioRecorder } from "../../hooks/useAudioRecorder";

interface AudioRecorderProps {
  onCapture: (uri: string | null, mimeType: string | null) => void;
}

const formatDuration = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  const mm = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const ss = (totalSeconds % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
};

export default function AudioRecorder({ onCapture }: AudioRecorderProps) {
  const {
    isRecording,
    isPreparing,
    recordedUri,
    durationMs,
    startRecording,
    stopRecording,
    reset,
  } = useAudioRecorder();

  const handleStart = async () => {
    await startRecording();
  };

  const handleStop = async () => {
    const result = await stopRecording();
    if (result.success) {
      onCapture(result.uri, result.mimeType);
    }
  };

  const handleReset = () => {
    reset();
    stopPlayback();
    onCapture(null, null);
  };

  // ── Playback (review before submit) ─────────────────────────────
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingPlayback, setIsLoadingPlayback] = useState(false);

  const stopPlayback = async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.unloadAsync();
      } catch {}
      soundRef.current = null;
    }
    setIsPlaying(false);
  };

  useEffect(() => {
    // Reset playback state whenever the recording changes/clears
    stopPlayback();
  }, [recordedUri]);

  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, []);

  const handlePlayPause = async () => {
    if (!recordedUri) return;

    if (isPlaying && soundRef.current) {
      await soundRef.current.pauseAsync();
      setIsPlaying(false);
      return;
    }

    if (soundRef.current) {
      await soundRef.current.playAsync();
      setIsPlaying(true);
      return;
    }

    setIsLoadingPlayback(true);
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(
        { uri: recordedUri },
        { shouldPlay: true },
      );
      soundRef.current = sound;
      setIsPlaying(true);
      sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlaying(false);
        }
      });
    } finally {
      setIsLoadingPlayback(false);
    }
  };

  if (recordedUri) {
    return (
      <View style={styles.previewWrapper}>
        <TouchableOpacity
          onPress={handlePlayPause}
          activeOpacity={0.8}
          style={styles.playBtn}
        >
          {isLoadingPlayback ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <MaterialCommunityIcons
              name={isPlaying ? "pause" : "play"}
              size={20}
              color="#fff"
            />
          )}
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.previewTitle}>
            {isPlaying ? "Playing…" : "Tap to preview"}
          </Text>
          <Text style={styles.previewSubtitle}>
            {formatDuration(durationMs)} captured
          </Text>
        </View>
        <TouchableOpacity onPress={handleReset} activeOpacity={0.8}>
          <MaterialCommunityIcons
            name="delete-outline"
            size={20}
            color="#94A3B8"
          />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.launchBox}>
      {isPreparing ? (
        <ActivityIndicator size="small" color="#0891B2" />
      ) : isRecording ? (
        <>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingLabel}>Recording…</Text>
          <TouchableOpacity
            style={styles.stopBtn}
            onPress={handleStop}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="stop" size={16} color="#fff" />
            <Text style={styles.stopBtnText}>Stop</Text>
          </TouchableOpacity>
        </>
      ) : (
        <TouchableOpacity
          style={styles.recordBtn}
          onPress={handleStart}
          activeOpacity={0.75}
        >
          <View style={styles.launchIconCircle}>
            <MaterialCommunityIcons
              name="microphone-outline"
              size={26}
              color="#0891B2"
            />
          </View>
          <Text style={styles.launchLabel}>Record Voice Note</Text>
          <Text style={styles.launchSubLabel}>Tap to start recording</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  launchBox: {
    borderWidth: 1.5,
    borderColor: "#A5F3FC",
    borderStyle: "dashed",
    borderRadius: 16,
    paddingVertical: 22,
    alignItems: "center",
    backgroundColor: "#ECFEFF",
    gap: 8,
  },
  recordBtn: { alignItems: "center", gap: 6 },
  launchIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: "#CFFAFE",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  launchLabel: { fontSize: 14, fontWeight: "700", color: "#0891B2" },
  launchSubLabel: { fontSize: 11, color: "#94A3B8" },

  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#EF4444",
  },
  recordingLabel: { fontSize: 13, fontWeight: "700", color: "#0891B2" },
  stopBtn: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#0891B2",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  stopBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  previewWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  previewTitle: { fontSize: 13, fontWeight: "700", color: "#1E293B" },
  previewSubtitle: { fontSize: 11, color: "#64748B", marginTop: 1 },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#0891B2",
    justifyContent: "center",
    alignItems: "center",
  },
});
