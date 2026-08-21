import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import Slider from "@react-native-community/slider";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Audio, AVPlaybackStatus } from "expo-av";
import { safeHaptics } from "../../utils/haptics";

interface AudioContentViewerProps {
  audioUrl: string;
  title: string;
  category?: string;
}

function formatTime(millis: number): string {
  if (!millis || isNaN(millis)) return "0:00";
  const totalSec = Math.floor(millis / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

const PLAYBACK_SPEEDS = [1.0, 1.25, 1.5, 2.0];

export default function AudioContentViewer({
  audioUrl,
  title,
  category = "Audio Content",
}: AudioContentViewerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [positionMillis, setPositionMillis] = useState(0);
  const [durationMillis, setDurationMillis] = useState(0);
  const [speedIndex, setSpeedIndex] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubPosition, setScrubPosition] = useState(0);

  const soundRef = useRef<Audio.Sound | null>(null);
  const isScrubbingRef = useRef(false);

  const playbackSpeed = PLAYBACK_SPEEDS[speedIndex];

  // Cleanup sound on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
      }
    };
  }, []);

  // Stop & unload if audioUrl changes
  useEffect(() => {
    const resetAudio = async () => {
      if (soundRef.current) {
        await soundRef.current.stopAsync().catch(() => {});
        await soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
      setIsPlaying(false);
      setPositionMillis(0);
      setDurationMillis(0);
    };
    resetAudio();
  }, [audioUrl]);

  const loadAndPlay = useCallback(async () => {
    if (!audioUrl) return;
    setIsLoading(true);
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true, rate: playbackSpeed, shouldCorrectPitch: true },
        (status: AVPlaybackStatus) => {
          if (status.isLoaded) {
            if (!isScrubbingRef.current) {
              setPositionMillis(status.positionMillis ?? 0);
            }
            setDurationMillis(status.durationMillis ?? 0);
            setIsPlaying(status.isPlaying);
            if (status.didJustFinish) {
              setIsPlaying(false);
              setPositionMillis(0);
            }
          }
        }
      );
      soundRef.current = sound;
    } catch (error) {
      console.error("[AudioContentViewer] Failed to load audio:", error);
    } finally {
      setIsLoading(false);
    }
  }, [audioUrl, playbackSpeed]);

  const handlePlayPause = async () => {
    safeHaptics.lightImpact();
    if (!soundRef.current) {
      await loadAndPlay();
      return;
    }
    if (isPlaying) {
      await soundRef.current.pauseAsync();
    } else {
      await soundRef.current.playAsync();
    }
  };

  const handleSeek = async (millis: number) => {
    const clamped = Math.max(0, Math.min(durationMillis, millis));
    if (soundRef.current && durationMillis > 0) {
      await soundRef.current.setPositionAsync(clamped);
    }
  };

  const handleSkip = async (seconds: number) => {
    safeHaptics.lightImpact();
    if (soundRef.current && durationMillis > 0) {
      const targetPos = Math.max(
        0,
        Math.min(durationMillis, positionMillis + seconds * 1000)
      );
      await soundRef.current.setPositionAsync(targetPos);
    }
  };

  const handleCycleSpeed = async () => {
    safeHaptics.lightImpact();
    const nextIdx = (speedIndex + 1) % PLAYBACK_SPEEDS.length;
    setSpeedIndex(nextIdx);
    const nextSpeed = PLAYBACK_SPEEDS[nextIdx];
    if (soundRef.current) {
      await soundRef.current.setRateAsync(nextSpeed, true);
    }
  };

  const displayPosition = isScrubbing ? scrubPosition : positionMillis;
  const remainingMillis = Math.max(0, durationMillis - displayPosition);

  return (
    <View style={styles.container}>
      {/* Visual Artwork Card */}
      <View style={styles.artworkCard}>
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name="headphones" size={54} color="#7C3AED" />
        </View>
        <View style={styles.badgeContainer}>
          <Text style={styles.categoryBadge}>{category.toUpperCase()}</Text>
        </View>
        <Text style={styles.titleText} numberOfLines={3}>
          {title}
        </Text>
      </View>

      {/* Player Card */}
      <View style={styles.playerCard}>
        {/* Timeline Slider for forward and backward audio scrubbing */}
        <View style={styles.sliderContainer}>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={durationMillis > 0 ? durationMillis : 1}
            value={displayPosition}
            minimumTrackTintColor="#7C3AED"
            maximumTrackTintColor="#E2E8F0"
            thumbTintColor="#7C3AED"
            disabled={durationMillis === 0}
            onSlidingStart={() => {
              isScrubbingRef.current = true;
              setIsScrubbing(true);
              setScrubPosition(positionMillis);
            }}
            onValueChange={(val) => {
              setScrubPosition(val);
            }}
            onSlidingComplete={async (val) => {
              isScrubbingRef.current = false;
              setIsScrubbing(false);
              setPositionMillis(val);
              if (soundRef.current) {
                await soundRef.current.setPositionAsync(val);
              }
            }}
          />
        </View>

        {/* Time display */}
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatTime(displayPosition)}</Text>
          <Text style={styles.timeText}>−{formatTime(remainingMillis)}</Text>
        </View>

        {/* Controls Row */}
        <View style={styles.controlsRow}>
          {/* Speed Toggle Chip */}
          <TouchableOpacity
            style={styles.speedChip}
            onPress={handleCycleSpeed}
            activeOpacity={0.7}
          >
            <Text style={styles.speedChipText}>{playbackSpeed}x</Text>
          </TouchableOpacity>

          {/* Rewind 15s */}
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={() => handleSkip(-15)}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="rewind-15" size={28} color="#475569" />
          </TouchableOpacity>

          {/* Main Play / Pause CTA */}
          <TouchableOpacity
            style={styles.playBtn}
            onPress={handlePlayPause}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <MaterialCommunityIcons
                name={isPlaying ? "pause" : "play"}
                size={34}
                color="#FFFFFF"
                style={{ marginLeft: isPlaying ? 0 : 3 }}
              />
            )}
          </TouchableOpacity>

          {/* Fast Forward 15s */}
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={() => handleSkip(15)}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="fast-forward-15" size={28} color="#475569" />
          </TouchableOpacity>

          {/* Replay / Restart */}
          <TouchableOpacity
            style={styles.speedChip}
            onPress={() => handleSeek(0)}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="replay" size={20} color="#64748B" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  artworkCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    // shadowColor: "#7C3AED",
    // shadowOpacity: 0.08,
    // shadowRadius: 20,
    // shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#F3E8FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#DDD6FE",
  },
  badgeContainer: {
    backgroundColor: "#F3E8FF",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 10,
  },
  categoryBadge: {
    fontSize: 11,
    fontWeight: "800",
    color: "#7C3AED",
    letterSpacing: 0.8,
  },
  titleText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
    lineHeight: 25,
  },
  playerCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  sliderContainer: {
    paddingVertical: 6,
    justifyContent: "center",
  },
  slider: {
    width: "100%",
    height: 20,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
    marginBottom: 16,
  },
  timeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  speedChip: {
    width: 42,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  speedChipText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#475569",
  },
  skipBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  playBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#7C3AED",
    alignItems: "center",
    justifyContent: "center",
    // shadowColor: "#7C3AED",
    // shadowOpacity: 0.35,
    // shadowRadius: 12,
    // shadowOffset: { width: 0, height: 6 },
    // elevation: 6,
  },
});
