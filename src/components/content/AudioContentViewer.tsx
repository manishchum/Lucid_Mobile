import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from "react-native";
import Slider from "@react-native-community/slider";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { usePodcastPlayer } from "../../contex/PodcastPlayerContext";
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
  const {
    activeTrackInfo,
    isPlaying,
    isLoading,
    positionMillis,
    durationMillis,
    playbackSpeed,
    setPlaybackSpeed,
    playPodcast,
    togglePlayPause,
    seekTo,
  } = usePodcastPlayer();

  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubPosition, setScrubPosition] = useState(0);
  const isScrubbingRef = useRef(false);

  const isThisAudio = activeTrackInfo?.audioUrl === audioUrl;
  const isThisPlaying = isThisAudio && isPlaying;
  const isThisLoading = isThisAudio && isLoading;
  const thisPositionMillis = isThisAudio ? positionMillis : 0;
  const thisDurationMillis = isThisAudio ? durationMillis : 0;

  // Auto-play on mount if this audio isn't already the actively playing track
  useEffect(() => {
    if (audioUrl && (!isThisAudio || !isPlaying)) {
      playPodcast({
        audioUrl,
        title,
        artist: category,
        category,
        mediaType: "content_library",
      });
    }
  }, [audioUrl]);

  const handlePlayPause = async () => {
    safeHaptics.lightImpact();
    if (!isThisAudio) {
      await playPodcast({
        audioUrl,
        title,
        artist: category,
        category,
        mediaType: "content_library",
      });
    } else {
      await togglePlayPause();
    }
  };

  const handleSeek = async (millis: number) => {
    if (isThisAudio && thisDurationMillis > 0) {
      const clamped = Math.max(0, Math.min(thisDurationMillis, millis));
      await seekTo(clamped / 1000);
    }
  };

  const handleSkip = async (seconds: number) => {
    safeHaptics.lightImpact();
    if (isThisAudio && thisDurationMillis > 0) {
      const targetPosSec = Math.max(
        0,
        Math.min(
          thisDurationMillis / 1000,
          thisPositionMillis / 1000 + seconds
        )
      );
      await seekTo(targetPosSec);
    }
  };

  const handleCycleSpeed = async () => {
    safeHaptics.lightImpact();
    const currentIdx = PLAYBACK_SPEEDS.indexOf(playbackSpeed);
    const nextIdx = (currentIdx + 1) % PLAYBACK_SPEEDS.length;
    const nextSpeed = PLAYBACK_SPEEDS[nextIdx >= 0 ? nextIdx : 0];
    await setPlaybackSpeed(nextSpeed);
  };

  const displayPosition = isScrubbing ? scrubPosition : thisPositionMillis;
  const remainingMillis = Math.max(0, thisDurationMillis - displayPosition);

  return (
    <View style={styles.container}>
      {/* Visual Artwork Card */}
      <View style={styles.artworkCard}>
        <View style={styles.coverImageContainer}>
          <Image
            source={require("../../../assets/lucid_audio_cover.jpg")}
            style={styles.coverImage}
          />
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
            maximumValue={thisDurationMillis > 0 ? thisDurationMillis : 1}
            value={displayPosition}
            minimumTrackTintColor="#7C3AED"
            maximumTrackTintColor="#E2E8F0"
            thumbTintColor="#7C3AED"
            disabled={thisDurationMillis === 0}
            onSlidingStart={() => {
              isScrubbingRef.current = true;
              setIsScrubbing(true);
              setScrubPosition(thisPositionMillis);
            }}
            onValueChange={(val) => {
              setScrubPosition(val);
            }}
            onSlidingComplete={async (val) => {
              isScrubbingRef.current = false;
              setIsScrubbing(false);
              await handleSeek(val);
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
            disabled={isThisLoading}
            activeOpacity={0.85}
          >
            {isThisLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <MaterialCommunityIcons
                name={isThisPlaying ? "pause" : "play"}
                size={34}
                color="#FFFFFF"
                style={{ marginLeft: isThisPlaying ? 0 : 3 }}
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

          {/* Empty spacer to balance speed chip */}
          <View style={styles.placeholderChip} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  artworkCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: "#EDE9FE",
  },
  coverImageContainer: {
    width: 140,
    height: 140,
    borderRadius: 22,
    overflow: "hidden",
    marginBottom: 20,
    backgroundColor: "#0F172A",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  coverImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  badgeContainer: {
    backgroundColor: "#EDE9FE",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginBottom: 12,
  },
  categoryBadge: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6D28D9",
    letterSpacing: 0.8,
  },
  titleText: {
    fontSize: 19,
    fontWeight: "700",
    color: "#1E293B",
    textAlign: "center",
    lineHeight: 26,
  },
  playerCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  sliderContainer: {
    width: "100%",
    height: 40,
    justifyContent: "center",
  },
  slider: {
    width: "100%",
    height: 40,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: -4,
    marginBottom: 20,
  },
  timeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
    fontVariant: ["tabular-nums"],
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  speedChip: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    minWidth: 42,
    alignItems: "center",
  },
  speedChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },
  skipBtn: {
    padding: 8,
  },
  playBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#7C3AED",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  placeholderChip: {
    width: 42,
  },
});
