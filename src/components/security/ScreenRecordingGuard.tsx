/**
 * ScreenRecordingGuard
 *
 * Renders a full-screen opaque overlay when iOS screen-recording is active.
 * On Android this component renders nothing — FLAG_SECURE already handles
 * everything at the OS level and no UI fallback is needed.
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   // 1. Call the hook in your screen component:
 *   const { isRecording } = useScreenProtection({ tag: "HomeScreen" });
 *
 *   // 2. Render the guard anywhere inside your screen's root view
 *   //    (it uses StyleSheet.absoluteFill so position in the tree doesn't matter):
 *   return (
 *     <View style={styles.container}>
 *       <YourContent />
 *       <ScreenRecordingGuard isRecording={isRecording} />
 *     </View>
 *   );
 *
 * The overlay uses an Animated fade so the transition isn't jarring.
 */

import React, { useEffect, useRef } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  View,
  Platform,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface ScreenRecordingGuardProps {
  /** Pass the `isRecording` boolean from useScreenProtection(). */
  isRecording: boolean;
}

export default function ScreenRecordingGuard({
  isRecording,
}: ScreenRecordingGuardProps) {
  // Android: FLAG_SECURE handles everything — render nothing.
  if (Platform.OS === "android") return null;

  return <IOSRecordingOverlay isRecording={isRecording} />;
}

/**
 * Separate component so the Animated.Value is only created on iOS.
 */
function IOSRecordingOverlay({ isRecording }: { isRecording: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: isRecording ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [isRecording, opacity]);

  // When fully transparent (recording off) we make it non-interactive so
  // touches pass through to the content below.
  return (
    <Animated.View
      style={[styles.overlay, { opacity }]}
      pointerEvents={isRecording ? "auto" : "none"}
    >
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons
            name="shield-lock-outline"
            size={48}
            color="#6366F1"
          />
        </View>
        <Text style={styles.title}>Screen Recording Detected</Text>
        <Text style={styles.subtitle}>
          This content is protected.{"\n"}
          Please stop the recording to continue.
        </Text>
        <View style={styles.pill}>
          <MaterialCommunityIcons
            name="record-circle-outline"
            size={14}
            color="#EF4444"
          />
          <Text style={styles.pillText}>Recording in progress</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0F172A",
    zIndex: 9999,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  content: {
    alignItems: "center",
    gap: 16,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#1E1B4B",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: "#4338CA",
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#F8FAFC",
    textAlign: "center",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 15,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 24,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1C0A0A",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#7F1D1D",
    marginTop: 8,
  },
  pillText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FCA5A5",
  },
});