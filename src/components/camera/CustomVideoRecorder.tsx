import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
} from "expo-camera";

const MAX_DURATION_SECONDS = 60;

export interface CustomVideoRecorderResult {
  uri: string;
  mimeType: string;
}

interface CustomVideoRecorderProps {
  visible: boolean;
  onClose: () => void;
  onRecorded: (result: CustomVideoRecorderResult) => void;
}

/**
 * Full-screen in-app camera used ONLY for video capture

 * Why not the system camera app (ImagePicker.launchCameraAsync)? Because the
 * OS camera app remembers whatever zoom/lens (e.g. 2x/2.5x on multi-lens
 * phones) was last used system-wide, and neither expo-image-picker nor any
 * public API lets us reset that from inside our app. Using expo-camera's
 * <CameraView> instead means WE own the camera session, so we can force
 * zoom={0} (true 1x) every single time the recorder opens.
 */
export default function CustomVideoRecorder({
  visible,
  onClose,
  onRecorded,
}: CustomVideoRecorderProps) {
  const cameraRef = useRef<CameraView | null>(null);
  const [camPerm, requestCamPerm] = useCameraPermissions();
  const [micPerm, requestMicPerm] = useMicrophonePermissions();
  const [isReady, setIsReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!visible) return;
    (async () => {
      setIsReady(false);
      setSeconds(0);
      if (!camPerm?.granted) await requestCamPerm();
      if (!micPerm?.granted) await requestMicPerm();
      setIsReady(true);
    })();
  }, [visible]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startTimer = () => {
    setSeconds(0);
    timerRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_DURATION_SECONDS) {
          handleStop();
        }
        return s + 1;
      });
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleStart = async () => {
    if (!cameraRef.current || isRecording) return;
    try {
      setIsRecording(true);
      startTimer();
      const video = await cameraRef.current.recordAsync({
        maxDuration: MAX_DURATION_SECONDS,
      });
      stopTimer();
      setIsRecording(false);
      setIsFinishing(false);
      if (video?.uri) {
        const ext = video.uri.split(".").pop()?.toLowerCase() ?? "mp4";
        const mimeType = ext === "mov" ? "video/quicktime" : "video/mp4";
        onRecorded({ uri: video.uri, mimeType });
      } else {
        onClose();
      }
    } catch (err) {
      stopTimer();
      setIsRecording(false);
      setIsFinishing(false);
      onClose();
    }
  };

  const handleStop = () => {
    if (!cameraRef.current || !isRecording) return;
    setIsFinishing(true);
    cameraRef.current.stopRecording();
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
      .toString()
      .padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  const permissionDenied = camPerm && !camPerm.granted && !camPerm.canAskAgain;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        {!isReady || !camPerm?.granted || !micPerm?.granted ? (
          <View style={styles.centerState}>
            {permissionDenied ? (
              <>
                <MaterialCommunityIcons
                  name="camera-off-outline"
                  size={40}
                  color="#F9A8D4"
                />
                <Text style={styles.permText}>
                  Camera & microphone access is required to record video. Please
                  enable it in your device Settings.
                </Text>
                <TouchableOpacity style={styles.closeLink} onPress={onClose}>
                  <Text style={styles.closeLinkText}>Close</Text>
                </TouchableOpacity>
              </>
            ) : (
              <ActivityIndicator size="large" color="#fff" />
            )}
          </View>
        ) : (
          <>
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing="back"
              mode="video"
              zoom={0}
              videoQuality="720p"
              onCameraReady={() => {}}
            />

            {/* Top bar */}
            <View style={styles.topBar}>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={onClose}
                disabled={isRecording}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={22}
                  color={isRecording ? "rgba(255,255,255,0.4)" : "#fff"}
                />
              </TouchableOpacity>
              {isRecording && (
                <View style={styles.timerPill}>
                  <View style={styles.recDot} />
                  <Text style={styles.timerText}>{formatTime(seconds)}</Text>
                </View>
              )}
              <View style={{ width: 22 }} />
            </View>

            {/* Bottom controls */}
            <View style={styles.bottomBar}>
              <Text style={styles.hintText}>
                {isRecording
                  ? isFinishing
                    ? "Finishing…"
                    : "Tap to stop"
                  : "Tap to record"}
              </Text>
              <TouchableOpacity
                activeOpacity={0.8}
                disabled={isFinishing}
                onPress={isRecording ? handleStop : handleStart}
                style={styles.recordBtnOuter}
              >
                <View
                  style={[
                    styles.recordBtnInner,
                    isRecording && styles.recordBtnInnerActive,
                  ]}
                />
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingHorizontal: 32,
  },
  permText: {
    color: "#fff",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  closeLink: {
    marginTop: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#DB2777",
    borderRadius: 10,
  },
  closeLinkText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  topBar: {
    position: "absolute",
    top: Platform.OS === "ios" ? 54 : 24,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  timerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
  },
  timerText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  bottomBar: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 46 : 30,
    left: 0,
    right: 0,
    alignItems: "center",
    gap: 14,
  },
  hintText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontWeight: "600",
  },
  recordBtnOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  recordBtnInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#EF4444",
  },
  recordBtnInnerActive: {
    width: 28,
    height: 28,
    borderRadius: 6,
  },
});
