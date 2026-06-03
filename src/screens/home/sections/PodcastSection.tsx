import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  PanResponder,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Audio, AVPlaybackStatus } from 'expo-av';

// ─── Types ────────────────────────────────────────────────────────────────────

type Language = 'en' | 'hi';

interface TranscriptEntry {
  speaker: string;
  text: string;
  startSec: number;
  endSec: number;
}

/**
 * PodcastSection
 *
 * All data comes from the API via props — no hardcoded values.
 *   audioUrl                → processedModule.audio_url
 *   audioUrlHinglish        → processedModule.audio_url_hinglish
 *   podcastTimeline         → processedModule.podcast_timeline (JSON string)
 *   podcastTimelineHinglish → processedModule.podcast_timeline_hinglish (JSON string)
 *   transcript              → processedModule.podcast_transcript (raw text)
 *
 * Language toggle only renders when audioUrlHinglish is present.
 */
interface PodcastSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
  audioUrl?: string | null;
  audioUrlHinglish?: string | null;
  podcastTimeline?: string | null;
  podcastTimelineHinglish?: string | null;
  transcript?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(millis: number): string {
  if (!millis || isNaN(millis)) return '0:00';
  const totalSec = Math.floor(millis / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

function parseTimeline(raw: string | null | undefined): TranscriptEntry[] {
  if (!raw) return [];
  try { return JSON.parse(raw); }
  catch { return []; }
}

const SPEAKER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  sarah: { bg: '#F0F9FF', text: '#0369A1', border: '#BAE6FD' },
  mark:  { bg: '#F0FDF4', text: '#166534', border: '#BBF7D0' },
  pooja: { bg: '#FDF4FF', text: '#7E22CE', border: '#E9D5FF' },
  rahul: { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA' },
};

function speakerColors(speaker: string) {
  return SPEAKER_COLORS[speaker.toLowerCase()] ?? { bg: '#F8FAFC', text: '#475569', border: '#E2E8F0' };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PodcastSection({
  isExpanded,
  onToggle,
  audioUrl,
  audioUrlHinglish,
  podcastTimeline,
  podcastTimelineHinglish,
  transcript,
}: PodcastSectionProps) {

  const [language,       setLanguage]       = useState<Language>('en');
  const [isPlaying,      setIsPlaying]      = useState(false);
  const [isLoading,      setIsLoading]      = useState(false);
  const [positionMillis, setPositionMillis] = useState(0);
  const [durationMillis, setDurationMillis] = useState(0);
  const [showTranscript, setShowTranscript] = useState(false);
  const [activeIndex,    setActiveIndex]    = useState(-1);

  const soundRef            = useRef<Audio.Sound | null>(null);
  const progressBarWidth    = useRef(0);
  const transcriptScrollRef = useRef<ScrollView>(null);
  const itemHeights         = useRef<Record<number, number>>({});
  const itemOffsets         = useRef<Record<number, number>>({});

  const activeUrl      = language === 'en' ? audioUrl      : audioUrlHinglish;
  const activeTimeline = language === 'en' ? podcastTimeline : podcastTimelineHinglish;
  const entries        = parseTimeline(activeTimeline);
  const positionSec    = positionMillis / 1000;
  const hasHinglish    = !!audioUrlHinglish;

  // ── Sync active transcript line ──────────────────────────────────────────
  useEffect(() => {
    if (!isPlaying || entries.length === 0) return;
    const idx = entries.findIndex(e => positionSec >= e.startSec && positionSec < e.endSec);
    if (idx !== -1 && idx !== activeIndex) setActiveIndex(idx);
  }, [positionSec, isPlaying, entries]);

  // ── Auto-scroll transcript to active line ────────────────────────────────
  useEffect(() => {
    if (!showTranscript || activeIndex < 0) return;
    const offset = itemOffsets.current[activeIndex];
    if (offset !== undefined) {
      transcriptScrollRef.current?.scrollTo({ y: Math.max(0, offset - 60), animated: true });
    }
  }, [activeIndex, showTranscript]);

  // ── Reset on language switch ─────────────────────────────────────────────
  useEffect(() => {
    const reset = async () => {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      setIsPlaying(false);
      setPositionMillis(0);
      setDurationMillis(0);
      setActiveIndex(-1);
    };
    reset();
  }, [language]);

  // ── Pause when section collapses ─────────────────────────────────────────
  useEffect(() => {
    if (!isExpanded) soundRef.current?.pauseAsync();
  }, [isExpanded]);

  // ── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => () => { soundRef.current?.unloadAsync(); }, []);

  // ── Load & play ──────────────────────────────────────────────────────────
  const loadAndPlay = useCallback(async () => {
    if (!activeUrl) return;
    setIsLoading(true);
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(
        { uri: activeUrl },
        { shouldPlay: true },
        (status: AVPlaybackStatus) => {
          if (status.isLoaded) {
            setPositionMillis(status.positionMillis ?? 0);
            setDurationMillis(status.durationMillis ?? 0);
            setIsPlaying(status.isPlaying);
            if (status.didJustFinish) {
              setIsPlaying(false);
              setPositionMillis(0);
              setActiveIndex(-1);
            }
          }
        }
      );
      soundRef.current = sound;
    } catch (e) {
      console.error('Audio error:', e);
    } finally {
      setIsLoading(false);
    }
  }, [activeUrl]);

  const handlePlayPause = async () => {
    if (!soundRef.current) { await loadAndPlay(); return; }
    isPlaying ? await soundRef.current.pauseAsync() : await soundRef.current.playAsync();
  };

  const handleSeek = async (ratio: number) => {
    const clamped = Math.max(0, Math.min(1, ratio));
    if (soundRef.current && durationMillis > 0) {
      await soundRef.current.setPositionAsync(clamped * durationMillis);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: (evt) => handleSeek(evt.nativeEvent.locationX / progressBarWidth.current),
      onPanResponderMove:  (evt) => handleSeek(evt.nativeEvent.locationX / progressBarWidth.current),
    })
  ).current;

  const handleTranscriptTap = async (entry: TranscriptEntry, idx: number) => {
    setActiveIndex(idx);
    if (!soundRef.current) { await loadAndPlay(); return; }
    await soundRef.current.setPositionAsync(entry.startSec * 1000);
    if (!isPlaying) await soundRef.current.playAsync();
  };

  const progressRatio   = durationMillis > 0 ? positionMillis / durationMillis : 0;
  const remainingMillis = Math.max(0, durationMillis - positionMillis);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={styles.card}>

      {/* Header */}
      <TouchableOpacity onPress={onToggle} style={styles.header} activeOpacity={0.7}>
        <View style={styles.iconBox}>
          <MaterialCommunityIcons name="headphones" size={22} color="#F59E0B" />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.title}>Podcast</Text>
          <Text style={styles.subtitle}>
            {durationMillis > 0 ? `${formatTime(durationMillis)} · Listen on the go` : 'Listen on the go'}
          </Text>
        </View>
        <MaterialCommunityIcons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={24} color="#94A3B8"
        />
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.body}>

          {/* Language toggle — only shown when Hinglish audio exists in API response */}
          {hasHinglish && (
            <View style={styles.langRow}>
              {(['en', 'hi'] as Language[]).map((lang) => {
                const active = language === lang;
                return (
                  <TouchableOpacity
                    key={lang}
                    style={[styles.langBtn, active && styles.langBtnActive]}
                    onPress={() => setLanguage(lang)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.langText, active && styles.langTextActive]}>
                      {lang === 'en' ? '🇬🇧  English' : '🇮🇳  हिंदी'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {!activeUrl ? (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="music-off" size={32} color="#CBD5E1" />
              <Text style={styles.emptyText}>No audio available</Text>
            </View>
          ) : (
            <>
              {/* Player card */}
              <View style={styles.playerCard}>
                <View
                  style={styles.progressHitSlop}
                  {...panResponder.panHandlers}
                  onLayout={(e) => { progressBarWidth.current = e.nativeEvent.layout.width; }}
                >
                  <View style={styles.track}>
                    <View style={[styles.fill, { width: `${progressRatio * 100}%` as any }]} />
                  </View>
                  <View style={[styles.thumb, { left: `${progressRatio * 100}%` as any }]} />
                </View>

                <View style={styles.timeRow}>
                  <Text style={styles.timeText}>{formatTime(positionMillis)}</Text>
                  <Text style={styles.timeText}>−{formatTime(remainingMillis)}</Text>
                </View>

                <View style={styles.controls}>
                  <TouchableOpacity
                    style={styles.skipBtn}
                    onPress={() => soundRef.current?.setPositionAsync(Math.max(0, positionMillis - 15000))}
                  >
                    <MaterialCommunityIcons name="rewind-15" size={26} color="#64748B" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.playBtn}
                    onPress={handlePlayPause}
                    disabled={isLoading}
                    activeOpacity={0.85}
                  >
                    {isLoading
                      ? <ActivityIndicator color="white" size="small" />
                      : <MaterialCommunityIcons name={isPlaying ? 'pause' : 'play'} size={30} color="white" />
                    }
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.skipBtn}
                    onPress={() =>
                      soundRef.current?.setPositionAsync(Math.min(durationMillis, positionMillis + 15000))
                    }
                  >
                    <MaterialCommunityIcons name="fast-forward-15" size={26} color="#64748B" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Live Transcript toggle — shown when timeline data exists in API response */}
              {entries.length > 0 && (
                <TouchableOpacity
                  style={styles.transcriptToggle}
                  onPress={() => setShowTranscript(v => !v)}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="text-box-outline" size={18} color="#4338CA" />
                  <Text style={styles.transcriptToggleLabel}>Live Transcript</Text>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{showTranscript ? 'Hide' : 'Show'}</Text>
                  </View>
                  <MaterialCommunityIcons
                    name={showTranscript ? 'chevron-up' : 'chevron-down'}
                    size={18} color="#4338CA"
                  />
                </TouchableOpacity>
              )}

              {/* Live transcript pane — highlights current line in sync with audio */}
              {showTranscript && entries.length > 0 && (
                <View style={styles.transcriptPane}>
                  <ScrollView
                    ref={transcriptScrollRef}
                    style={styles.transcriptScroll}
                    showsVerticalScrollIndicator={false}
                    nestedScrollEnabled
                  >
                    {entries.map((entry, idx) => {
                      const isActive = idx === activeIndex;
                      const isPast   = positionSec > entry.endSec && !isActive;
                      const isFuture = positionSec < entry.startSec && !isActive;
                      const colors   = speakerColors(entry.speaker);
                      const showSpeakerLabel =
                        idx === 0 || entries[idx - 1].speaker !== entry.speaker;

                      return (
                        <TouchableOpacity
                          key={idx}
                          activeOpacity={0.75}
                          onPress={() => handleTranscriptTap(entry, idx)}
                          onLayout={(e) => {
                            const h = e.nativeEvent.layout.height;
                            itemHeights.current[idx] = h;
                            let offset = 0;
                            for (let i = 0; i < idx; i++) offset += (itemHeights.current[i] ?? 0);
                            itemOffsets.current[idx] = offset;
                          }}
                          style={[
                            styles.transcriptItem,
                            isActive && {
                              backgroundColor: colors.bg,
                              borderColor: colors.border,
                              borderWidth: 1.5,
                            },
                            isPast && styles.transcriptItemPast,
                          ]}
                        >
                          {showSpeakerLabel && (
                            <Text style={[styles.speakerLabel, { color: colors.text }]}>
                              {entry.speaker.charAt(0).toUpperCase() + entry.speaker.slice(1)}
                            </Text>
                          )}
                          <Text
                            style={[
                              styles.transcriptText,
                              isActive  && [styles.transcriptTextActive, { color: colors.text }],
                              isFuture  && styles.transcriptTextFuture,
                              isPast    && styles.transcriptTextPast,
                            ]}
                          >
                            {entry.text}
                          </Text>
                          {isActive && (
                            <View style={[styles.activeDot, { backgroundColor: colors.text }]} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                    <View style={{ height: 24 }} />
                  </ScrollView>
                </View>
              )}
            </>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white', borderRadius: 16,
    borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden',
  },

  header: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  iconBox: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#FFF7ED',
    alignItems: 'center', justifyContent: 'center',
  },
  title:    { fontSize: 17, fontWeight: '700', color: '#1E293B' },
  subtitle: { fontSize: 13, color: '#64748B', marginTop: 2 },

  body: { paddingHorizontal: 16, paddingBottom: 16 },

  langRow: {
    flexDirection: 'row', backgroundColor: '#F1F5F9',
    borderRadius: 12, padding: 4, gap: 4, marginBottom: 14,
  },
  langBtn: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center' },
  langBtnActive: {
    backgroundColor: 'white',
    shadowColor: '#000', shadowOpacity: 0.08,
    shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  langText:       { fontSize: 14, fontWeight: '600', color: '#94A3B8' },
  langTextActive: { color: '#1E293B' },

  empty: { alignItems: 'center', paddingVertical: 32, gap: 10 },
  emptyText: { fontSize: 14, color: '#94A3B8' },

  playerCard: {
    backgroundColor: '#F8FAFC', borderRadius: 14,
    padding: 16, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 12,
  },
  progressHitSlop: { paddingVertical: 12, justifyContent: 'center', marginHorizontal: 2 },
  track: { height: 5, backgroundColor: '#E2E8F0', borderRadius: 3, overflow: 'hidden' },
  fill:  { height: '100%', backgroundColor: '#F59E0B', borderRadius: 3 },
  thumb: {
    position: 'absolute',
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#F59E0B',
    top: '50%', marginTop: -7, marginLeft: -7,
    shadowColor: '#F59E0B', shadowOpacity: 0.45,
    shadowRadius: 5, shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  timeRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: 2, marginBottom: 18,
  },
  timeText: { fontSize: 12, color: '#94A3B8', fontWeight: '500' },
  controls: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 28,
  },
  skipBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  playBtn: {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: '#F59E0B',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#F59E0B', shadowOpacity: 0.4,
    shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },

  transcriptToggle: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#EEF2FF', borderRadius: 12,
    paddingVertical: 11, paddingHorizontal: 14,
    gap: 8, marginBottom: 10,
    borderWidth: 1, borderColor: '#C7D2FE',
  },
  transcriptToggleLabel: { flex: 1, fontSize: 14, fontWeight: '700', color: '#4338CA' },
  badge: {
    backgroundColor: '#6366F1', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: 'white', letterSpacing: 0.3 },

  transcriptPane: {
    borderRadius: 14, borderWidth: 1,
    borderColor: '#E2E8F0', overflow: 'hidden',
    backgroundColor: '#FAFBFC',
  },
  transcriptScroll: { maxHeight: 340, paddingHorizontal: 10, paddingTop: 8 },

  transcriptItem: {
    paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: 10, marginBottom: 3,
    borderWidth: 1, borderColor: 'transparent',
    position: 'relative',
  },
  transcriptItemPast: { opacity: 0.4 },

  speakerLabel: {
    fontSize: 10, fontWeight: '800',
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 3,
  },
  transcriptText: {
    fontSize: 14, lineHeight: 21, color: '#475569', fontWeight: '400',
  },
  transcriptTextActive:  { fontWeight: '600', fontSize: 14.5 },
  transcriptTextFuture:  { color: '#94A3B8' },
  transcriptTextPast:    { color: '#94A3B8' },

  activeDot: {
    position: 'absolute', top: 14, right: 12,
    width: 7, height: 7, borderRadius: 4,
  },
});