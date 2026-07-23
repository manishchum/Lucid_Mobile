import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Video, ResizeMode } from "expo-av";
import { useVideoRecorder } from "../../hooks/useVideoRecorder";
import CustomVideoRecorder from "./CustomVideoRecorder";

interface VideoCaptureProps {
  /** Called every time a new video is captured (or null when reset) */
  onCapture: (uri: string | null, mimeType: string | null) => void;
}

export default function VideoCapture({ onCapture }: VideoCaptureProps) {
  const {
    isCameraOpen,
    capturedUri,
    capturedMimeType,
    openCamera,
    closeCamera,
    handleRecorded,
    reset,
  } = useVideoRecorder();

  const handleRetake = () => {
    reset();
    onCapture(null, null);
  };

  if (capturedUri) {
    return (
      <View style={styles.previewWrapper}>
        <Video
          source={{ uri: capturedUri }}
          style={styles.videoPlayer}
          useNativeControls
          resizeMode={ResizeMode.CONTAIN}
          isLooping={false}
        />

        <View style={styles.successBadge}>
          <MaterialCommunityIcons
            name="check-circle"
            size={15}
            color="#16A34A"
          />
          <Text style={styles.successBadgeText}>Video ready to submit</Text>
        </View>

        <TouchableOpacity
          style={styles.retakeBtn}
          onPress={handleRetake}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons
            name="video-switch-outline"
            size={14}
            color="#DB2777"
          />
          <Text style={styles.retakeBtnText}>Re-record</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <TouchableOpacity
        style={styles.launchBox}
        onPress={openCamera}
        activeOpacity={0.75}
      >
        <View style={styles.launchIconCircle}>
          <MaterialCommunityIcons
            name="video-outline"
            size={28}
            color="#DB2777"
          />
        </View>
        <Text style={styles.launchLabel}>Record Live Video</Text>
        <Text style={styles.launchSubLabel}>Tap to record up to 60s</Text>
      </TouchableOpacity>

      <CustomVideoRecorder
        visible={isCameraOpen}
        onClose={closeCamera}
        onRecorded={(result) => {
          handleRecorded(result);
          onCapture(result.uri, result.mimeType);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  launchBox: {
    borderWidth: 1.5,
    borderColor: "#F9A8D4",
    borderStyle: "dashed",
    borderRadius: 16,
    paddingVertical: 28,
    alignItems: "center",
    backgroundColor: "#FFF8FB",
    gap: 6,
  },
  launchBoxBusy: { opacity: 0.7 },
  launchIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: "#FDF2F8",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  launchLabel: { fontSize: 14, fontWeight: "700", color: "#DB2777" },
  launchSubLabel: { fontSize: 11, color: "#94A3B8" },

  previewWrapper: {
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  videoPlayer: {
    width: "100%",
    height: 200,
    backgroundColor: "#000",
  },
  successBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  successBadgeText: { fontSize: 12, fontWeight: "700", color: "#16A34A" },
  retakeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: "#FDF2F8",
    paddingVertical: 10,
  },
  retakeBtnText: { fontSize: 13, fontWeight: "700", color: "#DB2777" },
});
