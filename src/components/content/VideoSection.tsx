import React, { useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Dimensions,
} from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const SCREEN_WIDTH = Dimensions.get('window').width;
// 16:9 player height based on card width (card has 16px horizontal padding on each side)
const PLAYER_WIDTH = SCREEN_WIDTH - 32 - 32; // screen - screen padding - card padding
const PLAYER_HEIGHT = Math.round(PLAYER_WIDTH * (9 / 16));

interface Props {
  isExpanded: boolean;
  onToggle: () => void;
  videoUrl: string | null;
}

export default function VideoSection({ isExpanded, onToggle, videoUrl }: Props) {
  const videoRef = useRef<Video>(null);
  const [status, setStatus] = useState<AVPlaybackStatus | null>(null);
  const [isBuffering, setIsBuffering] = useState(false);

  const isLoaded = status?.isLoaded ?? false;
  const isPlaying = isLoaded && (status as any).isPlaying;
  const durationMs = isLoaded ? (status as any).durationMillis ?? 0 : 0;
  const positionMs = isLoaded ? (status as any).positionMillis ?? 0 : 0;
  const progress = durationMs > 0 ? positionMs / durationMs : 0;

  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleStatus = useCallback((s: AVPlaybackStatus) => {
    setStatus(s);
    if (s.isLoaded) {
      setIsBuffering(s.isBuffering ?? false);
    }
  }, []);

  const togglePlay = async () => {
    if (!videoRef.current || !isLoaded) return;
    if (isPlaying) {
      await videoRef.current.pauseAsync();
    } else {
      // If finished, replay from start
      if (isLoaded && (status as any).didJustFinish) {
        await videoRef.current.replayAsync();
      } else {
        await videoRef.current.playAsync();
      }
    }
  };

  const seekBy = async (seconds: number) => {
    if (!videoRef.current || !isLoaded) return;
    const newPos = Math.max(0, Math.min(positionMs + seconds * 1000, durationMs));
    await videoRef.current.setPositionAsync(newPos);
  };

  // Pause video when section collapses
  const handleToggle = async () => {
    if (isExpanded && isPlaying) {
      await videoRef.current?.pauseAsync();
    }
    onToggle();
  };

  return (
    <View style={styles.card}>
      <TouchableOpacity onPress={handleToggle} style={styles.header}>
        <View style={[styles.iconBox, { backgroundColor: '#FDF2F8' }]}>
          <MaterialCommunityIcons name="play-circle" size={22} color="#DB2777" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Explainer Video</Text>
          {durationMs > 0 && (
            <Text style={styles.duration}>{formatTime(durationMs)}</Text>
          )}
        </View>
        <MaterialCommunityIcons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={22} color="#94A3B8"
        />
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.body}>
          {!videoUrl ? (
            <View style={styles.unavailable}>
              <MaterialCommunityIcons name="video-off-outline" size={36} color="#CBD5E1" />
              <Text style={styles.unavailableText}>Video not available</Text>
            </View>
          ) : (
            <>
              {/* Player */}
              <View style={styles.playerContainer}>
                <Video
                  ref={videoRef}
                  source={{ uri: videoUrl }}
                  style={styles.player}
                  resizeMode={ResizeMode.CONTAIN}
                  onPlaybackStatusUpdate={handleStatus}
                  useNativeControls={false}
                  shouldPlay={false}
                />

                {/* Buffering overlay */}
                {isBuffering && (
                  <View style={styles.overlay}>
                    <ActivityIndicator size="large" color="white" />
                  </View>
                )}

                {/* Tap to play/pause overlay (only when not buffering) */}
                {!isBuffering && (
                  <TouchableOpacity
                    style={styles.overlay}
                    onPress={togglePlay}
                    activeOpacity={1}
                  >
                    {!isPlaying && (
                      <View style={styles.playIconCircle}>
                        <MaterialCommunityIcons name="play" size={36} color="white" />
                      </View>
                    )}
                  </TouchableOpacity>
                )}
              </View>

              {/* Progress bar */}
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
              </View>

              {/* Time + controls row */}
              <View style={styles.controlsRow}>
                <Text style={styles.timeText}>
                  {formatTime(positionMs)}
                </Text>

                <View style={styles.centerControls}>
                  {/* Rewind 10s */}
                  <TouchableOpacity
                    style={styles.ctrlBtn}
                    onPress={() => seekBy(-10)}
                    disabled={!isLoaded}
                  >
                    <MaterialCommunityIcons
                      name="rewind-10" size={26}
                      color={isLoaded ? '#1E293B' : '#CBD5E1'}
                    />
                  </TouchableOpacity>

                  {/* Play / Pause */}
                  <TouchableOpacity
                    style={styles.playBtn}
                    onPress={togglePlay}
                    disabled={!isLoaded || isBuffering}
                  >
                    {isBuffering ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <MaterialCommunityIcons
                        name={isPlaying ? 'pause' : 'play'}
                        size={28} color="white"
                      />
                    )}
                  </TouchableOpacity>

                  {/* Forward 10s */}
                  <TouchableOpacity
                    style={styles.ctrlBtn}
                    onPress={() => seekBy(10)}
                    disabled={!isLoaded}
                  >
                    <MaterialCommunityIcons
                      name="fast-forward-10" size={26}
                      color={isLoaded ? '#1E293B' : '#CBD5E1'}
                    />
                  </TouchableOpacity>
                </View>

                <Text style={styles.timeText}>
                  {formatTime(durationMs)}
                </Text>
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white', borderRadius: 20,
    borderWidth: 1, borderColor: '#F1F5F9',
  },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  iconBox: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  duration: { fontSize: 12, color: '#94A3B8', fontWeight: '500', marginTop: 2 },

  body: { paddingHorizontal: 16, paddingBottom: 20 },

  unavailable: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  unavailableText: { fontSize: 14, color: '#94A3B8' },

  playerContainer: {
    width: '100%',
    height: PLAYER_HEIGHT,
    backgroundColor: '#0F172A',
    borderRadius: 14,
    overflow: 'hidden',
  },
  player: { width: '100%', height: '100%' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIconCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center',
  },

  progressTrack: {
    height: 4, backgroundColor: '#E2E8F0',
    borderRadius: 2, marginTop: 12, overflow: 'hidden',
  },
  progressFill: {
    height: '100%', backgroundColor: '#DB2777', borderRadius: 2,
  },

  controlsRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginTop: 12,
  },
  timeText: { fontSize: 12, fontWeight: '600', color: '#64748B', width: 40 },
  centerControls: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
  },
  ctrlBtn: {
    width: 40, height: 40, justifyContent: 'center', alignItems: 'center',
  },
  playBtn: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#DB2777',
    justifyContent: 'center', alignItems: 'center',
    elevation: 3,
    shadowColor: '#DB2777', shadowOpacity: 0.4,
    shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
  },
});