import React, { useRef, useState, useEffect, memo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePodcastPlayer } from "../../contex/PodcastPlayerContext";

function formatTime(millis: number): string {
  if (!millis || isNaN(millis)) return "0:00";
  const totalSec = Math.floor(millis / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

const MarqueeTitle: React.FC<{ text: string }> = memo(({ text }) => {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const [textWidth, setTextWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    if (textWidth > containerWidth && containerWidth > 0) {
      const scrollDistance = textWidth - containerWidth + 20;
      const duration = Math.max(3500, textWidth * 35);

      const animation = Animated.loop(
        Animated.sequence([
          Animated.delay(1200),
          Animated.timing(animatedValue, {
            toValue: -scrollDistance,
            duration: duration,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.delay(1200),
          Animated.timing(animatedValue, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      );
      animation.start();
      return () => animation.stop();
    } else {
      animatedValue.setValue(0);
    }
  }, [textWidth, containerWidth, text]);

  return (
    <View
      style={styles.marqueeContainer}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      <Animated.Text
        numberOfLines={1}
        onLayout={(e) => setTextWidth(e.nativeEvent.layout.width)}
        style={[styles.titleText, { transform: [{ translateX: animatedValue }] }]}
      >
        {text}
      </Animated.Text>
    </View>
  );
});

export const PodcastMiniPlayer: React.FC = memo(() => {
  const insets = useSafeAreaInsets();
  const {
    activeTrackInfo,
    isPlaying,
    positionMillis,
    durationMillis,
    progressRatio,
    togglePlayPauseFromMiniPlayer,
    seekTo,
    dismissMiniPlayer,
    isMiniPlayerVisible,
  } = usePodcastPlayer();

  if (!isMiniPlayerVisible || !activeTrackInfo) {
    return null;
  }

  const clampedRatio = Math.min(Math.max(progressRatio || 0, 0), 1);
  const bottomOffset = 60 + (insets.bottom || 0);

  const handleRewind15 = () => {
    seekTo(Math.max(0, (positionMillis - 15000) / 1000));
  };

  const handleForward15 = () => {
    seekTo(Math.min((durationMillis || 0) / 1000, (positionMillis + 15000) / 1000));
  };

  return (
    <View style={styles.outerContainer}>
      <View style={styles.miniPlayerCard}>
        {/* Progress Bar Line along top edge */}
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.round(clampedRatio * 100)}%` },
            ]}
          />
        </View>

        <View style={styles.innerContent}>
          {/* Slot 1: Podcast Icon */}
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons
              name="headphones"
              size={20}
              color="#F59E0B"
            />
          </View>

          {/* Slot 2: Module Title & Time Info */}
          <View style={styles.textContainer}>
            <MarqueeTitle text={activeTrackInfo.title || "Podcast Playing"} />
            <Text style={styles.subtext}>
              {isPlaying ? "Playing" : "Paused"} · {formatTime(positionMillis)} / {formatTime(durationMillis)}
            </Text>
          </View>

          {/* Slot 3: Controls (Rewind 15s, Play/Pause, Forward 15s, Close) */}
          <View style={styles.controlsRow}>
            <TouchableOpacity
              style={styles.skipBtn}
              onPress={handleRewind15}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            >
              <MaterialCommunityIcons
                name="rewind-15"
                size={22}
                color="#64748B"
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.playPauseBtn}
              onPress={togglePlayPauseFromMiniPlayer}
              activeOpacity={0.8}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            >
              <MaterialCommunityIcons
                name={isPlaying ? "pause" : "play"}
                size={22}
                color="#FFFFFF"
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.skipBtn}
              onPress={handleForward15}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            >
              <MaterialCommunityIcons
                name="fast-forward-15"
                size={22}
                color="#64748B"
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={dismissMiniPlayer}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            >
              <MaterialCommunityIcons name="close" size={18} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  outerContainer: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    zIndex: 999,
  },
  miniPlayerCard: {
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  progressTrack: {
    height: 3,
    backgroundColor: "#E2E8F0",
    width: "100%",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#F59E0B",
  },
  innerContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#FEF3C7",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  textContainer: {
    flex: 1,
    marginRight: 6,
    overflow: "hidden",
  },
  marqueeContainer: {
    width: "100%",
    overflow: "hidden",
  },
  titleText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  subtext: {
    fontSize: 11,
    fontWeight: "500",
    color: "#64748B",
    marginTop: 2,
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  skipBtn: {
    padding: 2,
  },
  playPauseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F59E0B",
    justifyContent: "center",
    alignItems: "center",
  },
  closeBtn: {
    padding: 4,
    marginLeft: 2,
  },
});
