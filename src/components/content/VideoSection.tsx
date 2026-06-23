import React, { useRef, useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  StatusBar,
  Platform,
  Modal,
} from "react-native";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ScreenOrientation from "expo-screen-orientation";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface Props {
  isExpanded: boolean;
  onToggle: () => void;
  videoUrl: string | null;
}

export default function VideoSection({
  isExpanded,
  onToggle,
  videoUrl,
}: Props) {
  const videoRef = useRef<Video>(null);
  const fsVideoRef = useRef<Video>(null);
  const [status, setStatus] = useState<AVPlaybackStatus | null>(null);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [screenDims, setScreenDims] = useState(Dimensions.get("window"));
  const [showControls, setShowControls] = useState(true);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  const isLoaded = status?.isLoaded ?? false;
  const isPlaying = isLoaded && (status as any).isPlaying;
  const durationMs = isLoaded ? ((status as any).durationMillis ?? 0) : 0;
  const positionMs = isLoaded ? ((status as any).positionMillis ?? 0) : 0;
  const progress = durationMs > 0 ? positionMs / durationMs : 0;

  // Track screen size changes (orientation flips)
  useEffect(() => {
    const sub = Dimensions.addEventListener("change", ({ window }) => {
      setScreenDims(window);
    });
    return () => sub.remove();
  }, []);

  // Auto-hide controls after 3s in fullscreen
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  }, [isPlaying]);

  useEffect(() => {
    if (!isFullscreen) {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
      setShowControls(true);
    }
  }, [isFullscreen]);

  // Restore portrait on unmount if still fullscreen
  useEffect(() => {
    return () => {
      if (isFullscreen) {
        ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.PORTRAIT_UP,
        ).catch(() => {});
        StatusBar.setHidden(false, "fade");
      }
    };
  }, [isFullscreen]);

  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleStatus = useCallback((s: AVPlaybackStatus) => {
    setStatus(s);
    if (s.isLoaded) setIsBuffering(s.isBuffering ?? false);
  }, []);

  const togglePlay = async (ref?: React.RefObject<Video>) => {
    const target = ref?.current ?? videoRef.current;
    if (!target || !isLoaded) return;
    if (isPlaying) {
      await target.pauseAsync();
    } else {
      if (isLoaded && (status as any).didJustFinish) {
        await target.replayAsync();
      } else {
        await target.playAsync();
      }
    }
    resetControlsTimer();
  };

  const seekBy = async (seconds: number, ref?: React.RefObject<Video>) => {
    const target = ref?.current ?? videoRef.current;
    if (!target || !isLoaded) return;
    const newPos = Math.max(
      0,
      Math.min(positionMs + seconds * 1000, durationMs),
    );
    await target.setPositionAsync(newPos);
    resetControlsTimer();
  };

  const handleToggle = async () => {
    if (isExpanded && isPlaying) await videoRef.current?.pauseAsync();
    onToggle();
  };

  const enterFullscreen = async () => {
    // Sync position to fullscreen player before opening
    const currentPos = positionMs;
    const wasPlaying = isPlaying;
    await videoRef.current?.pauseAsync();
    setIsFullscreen(true);
    StatusBar.setHidden(true, "fade");
    // Unlock to let device orientation follow physical tilt
    await ScreenOrientation.unlockAsync();
    // Small delay then seek fullscreen player to current position
    setTimeout(async () => {
      if (fsVideoRef.current) {
        await fsVideoRef.current.setPositionAsync(currentPos);
        if (wasPlaying) await fsVideoRef.current.playAsync();
      }
    }, 300);
    resetControlsTimer();
  };

  const exitFullscreen = async () => {
    // Sync position back to inline player
    const currentPos = positionMs;
    const wasPlaying = isPlaying;
    await fsVideoRef.current?.pauseAsync();
    setIsFullscreen(false);
    StatusBar.setHidden(false, "fade");
    await ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.PORTRAIT_UP,
    );
    setTimeout(async () => {
      if (videoRef.current) {
        await videoRef.current.setPositionAsync(currentPos);
        if (wasPlaying) await videoRef.current.playAsync();
      }
    }, 200);
  };

  const handleFsTap = () => {
    if (showControls) {
      setShowControls(false);
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    } else {
      resetControlsTimer();
    }
  };

  // ── Inline player dims ────────────────────────────────────────────────────
  const SCREEN_W = Dimensions.get("window").width;
  const PLAYER_W = SCREEN_W - 64; // card padding
  const PLAYER_H = Math.round(PLAYER_W * (9 / 16));

  // ── Fullscreen dims — always fill the screen ──────────────────────────────
  const fsW = screenDims.width;
  const fsH = screenDims.height;

  return (
    <>
      {/* ── FULLSCREEN MODAL (renders above everything incl. nav bar) ── */}
      <Modal
        visible={isFullscreen}
        transparent={false}
        animationType="fade"
        statusBarTranslucent
        supportedOrientations={[
          "portrait",
          "landscape",
          "landscape-left",
          "landscape-right",
        ]}
        onRequestClose={exitFullscreen}
      >
        <View style={[fsStyles.container, { width: fsW, height: fsH }]}>
          {/* Video fills entire modal */}
          <Video
            ref={fsVideoRef}
            source={{ uri: videoUrl ?? "" }}
            style={StyleSheet.absoluteFill}
            resizeMode={ResizeMode.CONTAIN}
            onPlaybackStatusUpdate={handleStatus}
            useNativeControls={false}
            shouldPlay={false}
          />

          {/* Buffering spinner */}
          {isBuffering && (
            <View style={fsStyles.bufferOverlay}>
              <ActivityIndicator size="large" color="white" />
            </View>
          )}

          {/* Tap zone — toggles controls visibility */}
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={handleFsTap}
            activeOpacity={1}
          />

          {/* Controls — fade in/out */}
          {showControls && !isBuffering && (
            <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
              {/* Top bar */}
              <View
                style={[
                  fsStyles.topBar,
                  { paddingTop: Math.max(insets.top, 12) },
                ]}
              >
                <TouchableOpacity
                  onPress={exitFullscreen}
                  style={fsStyles.iconBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <MaterialCommunityIcons
                    name="arrow-left"
                    size={26}
                    color="white"
                  />
                </TouchableOpacity>
                <View style={{ flex: 1 }} />
                <TouchableOpacity
                  style={fsStyles.iconBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <MaterialCommunityIcons
                    name="dots-vertical"
                    size={24}
                    color="white"
                  />
                </TouchableOpacity>
              </View>

              {/* Centre play/pause */}
              <View style={fsStyles.centreArea} pointerEvents="box-none">
                <View style={fsStyles.centreControls} pointerEvents="box-none">
                  <TouchableOpacity
                    style={fsStyles.ctrlBtn}
                    onPress={() => seekBy(-10, fsVideoRef)}
                    disabled={!isLoaded}
                  >
                    <MaterialCommunityIcons
                      name="rewind-10"
                      size={34}
                      color={isLoaded ? "white" : "rgba(255,255,255,0.3)"}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={fsStyles.playBtn}
                    onPress={() => togglePlay(fsVideoRef)}
                    disabled={!isLoaded || isBuffering}
                  >
                    <MaterialCommunityIcons
                      name={isPlaying ? "pause" : "play"}
                      size={36}
                      color="white"
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={fsStyles.ctrlBtn}
                    onPress={() => seekBy(10, fsVideoRef)}
                    disabled={!isLoaded}
                  >
                    <MaterialCommunityIcons
                      name="fast-forward-10"
                      size={34}
                      color={isLoaded ? "white" : "rgba(255,255,255,0.3)"}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Bottom bar */}
              <View
                style={[
                  fsStyles.bottomBar,
                  { paddingBottom: Math.max(insets.bottom, 12) },
                ]}
              >
                {/* Scrub bar */}
                <View style={fsStyles.progressTrack}>
                  <View
                    style={[
                      fsStyles.progressFill,
                      { width: `${progress * 100}%` as any },
                    ]}
                  />
                  {/* Thumb */}
                  <View
                    style={[
                      fsStyles.progressThumb,
                      { left: `${progress * 100}%` as any },
                    ]}
                  />
                </View>

                <View style={fsStyles.timeRow}>
                  <Text style={fsStyles.timeText}>
                    {formatTime(positionMs)}
                  </Text>
                  <Text style={fsStyles.timeSep}> / </Text>
                  <Text style={fsStyles.timeText}>
                    {formatTime(durationMs)}
                  </Text>
                  <View style={{ flex: 1 }} />
                  <TouchableOpacity
                    onPress={exitFullscreen}
                    style={fsStyles.iconBtn}
                  >
                    <MaterialCommunityIcons
                      name="fullscreen-exit"
                      size={22}
                      color="white"
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>
      </Modal>

      {/* ── INLINE CARD ─────────────────────────────────────────────────── */}
      <View style={styles.card}>
        <TouchableOpacity onPress={handleToggle} style={styles.header}>
          <View style={[styles.iconBox, { backgroundColor: "#FDF2F8" }]}>
            <MaterialCommunityIcons
              name="play-circle"
              size={22}
              color="#DB2777"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Explainer Video</Text>
            {durationMs > 0 && (
              <Text style={styles.duration}>{formatTime(durationMs)}</Text>
            )}
          </View>
          <MaterialCommunityIcons
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={22}
            color="#94A3B8"
          />
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.body}>
            {!videoUrl ? (
              <View style={styles.unavailable}>
                <MaterialCommunityIcons
                  name="video-off-outline"
                  size={36}
                  color="#CBD5E1"
                />
                <Text style={styles.unavailableText}>Video not available</Text>
              </View>
            ) : (
              <>
                {/* Inline player */}
                <View style={[styles.playerContainer, { height: PLAYER_H }]}>
                  <Video
                    ref={videoRef}
                    source={{ uri: videoUrl }}
                    style={StyleSheet.absoluteFill}
                    resizeMode={ResizeMode.CONTAIN}
                    onPlaybackStatusUpdate={handleStatus}
                    useNativeControls={false}
                    shouldPlay={false}
                  />

                  {isBuffering && (
                    <View style={styles.overlay}>
                      <ActivityIndicator size="large" color="white" />
                    </View>
                  )}

                  {!isBuffering && (
                    <TouchableOpacity
                      style={styles.overlay}
                      onPress={() => togglePlay(videoRef)}
                      activeOpacity={1}
                    >
                      {!isPlaying && (
                        <View style={styles.playIconCircle}>
                          <MaterialCommunityIcons
                            name="play"
                            size={36}
                            color="white"
                          />
                        </View>
                      )}
                    </TouchableOpacity>
                  )}

                  {/* Fullscreen button */}
                  <TouchableOpacity
                    style={styles.fsCornerBtn}
                    onPress={enterFullscreen}
                  >
                    <MaterialCommunityIcons
                      name="fullscreen"
                      size={20}
                      color="white"
                    />
                  </TouchableOpacity>
                </View>

                {/* Progress bar */}
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${progress * 100}%` },
                    ]}
                  />
                </View>

                {/* Controls row */}
                <View style={styles.controlsRow}>
                  <Text style={styles.timeText}>{formatTime(positionMs)}</Text>

                  <View style={styles.centerControls}>
                    <TouchableOpacity
                      style={styles.ctrlBtn}
                      onPress={() => seekBy(-10)}
                      disabled={!isLoaded}
                    >
                      <MaterialCommunityIcons
                        name="rewind-10"
                        size={26}
                        color={isLoaded ? "#1E293B" : "#CBD5E1"}
                      />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.playBtn}
                      onPress={() => togglePlay(videoRef)}
                      disabled={!isLoaded || isBuffering}
                    >
                      {isBuffering ? (
                        <ActivityIndicator size="small" color="white" />
                      ) : (
                        <MaterialCommunityIcons
                          name={isPlaying ? "pause" : "play"}
                          size={28}
                          color="white"
                        />
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.ctrlBtn}
                      onPress={() => seekBy(10)}
                      disabled={!isLoaded}
                    >
                      <MaterialCommunityIcons
                        name="fast-forward-10"
                        size={26}
                        color={isLoaded ? "#1E293B" : "#CBD5E1"}
                      />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.timeText}>{formatTime(durationMs)}</Text>
                </View>
              </>
            )}
          </View>
        )}
      </View>
    </>
  );
}

// ─── Inline styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  card: {
    backgroundColor: "white",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  header: { flexDirection: "row", alignItems: "center", padding: 16, gap: 12 },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 16, fontWeight: "700", color: "#1E293B" },
  duration: { fontSize: 12, color: "#94A3B8", fontWeight: "500", marginTop: 2 },

  body: { paddingHorizontal: 16, paddingBottom: 20 },

  unavailable: { alignItems: "center", paddingVertical: 40, gap: 10 },
  unavailableText: { fontSize: 14, color: "#94A3B8" },

  playerContainer: {
    width: "100%",
    backgroundColor: "#0F172A",
    borderRadius: 14,
    overflow: "hidden",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  playIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
  },
  fsCornerBtn: {
    position: "absolute",
    bottom: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 6,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
  },

  progressTrack: {
    height: 3,
    backgroundColor: "#E2E8F0",
    borderRadius: 2,
    marginTop: 10,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: "#DB2777", borderRadius: 2 },

  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
  timeText: { fontSize: 12, fontWeight: "600", color: "#64748B", width: 40 },
  centerControls: { flexDirection: "row", alignItems: "center", gap: 16 },
  ctrlBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  playBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#DB2777",
    justifyContent: "center",
    alignItems: "center",
    elevation: 3,
    shadowColor: "#DB2777",
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
});

// ─── Fullscreen (Modal) styles ────────────────────────────────────────────────
const fsStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  bufferOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  // Gradient-style top bar
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  iconBtn: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  centreArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  centreControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 32,
  },
  ctrlBtn: {
    width: 52,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: 26,
  },
  playBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.8)",
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  progressTrack: {
    height: 4,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 2,
    marginBottom: 10,
    overflow: "visible",
    position: "relative",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#DB2777",
    borderRadius: 2,
  },
  progressThumb: {
    position: "absolute",
    top: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#DB2777",
    marginLeft: -6,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 2,
  },
  timeText: { fontSize: 13, fontWeight: "600", color: "rgba(255,255,255,0.9)" },
  timeSep: {
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
    marginHorizontal: 2,
  },
});
