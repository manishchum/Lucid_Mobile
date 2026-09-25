import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  StatusBar,
  Animated,
  BackHandler,
  ToastAndroid,
  Platform,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { CameraView, useCameraPermissions } from "expo-camera";

import {
  useAudioStream,
  requestRecordingPermissionsAsync,
  createAudioPlayer,
  setAudioModeAsync,
  AudioPlayer,
} from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import {
  uint8ArrayToBase64,
  pcm16ChunksToWavBase64,
} from "../../../utils/audioPcm";

import {
  Scenario,
  RoleplayAssessment,
  RoleplaySession,
  createRoleplaySession,
  finishRoleplaySession,
} from "../../../api/roleplay";
import { getFirebaseToken } from "../../../api/users/Request";
import { STACK_ROUTES } from "../../../navigations/Routes";
import { useAuth } from "../../../contex/AuthContext";
import { logger } from "../../../utils/UnifiedLogger";

const EXPO_API_URL =
  process.env.EXPO_PUBLIC_API_URL || "https://api.workfloww.ai";

// ── Mini Animated Wave Bars Component ──────────────────────────────────────────
const AnimatedWaveBars = () => {
  const bar1 = useRef(new Animated.Value(6)).current;
  const bar2 = useRef(new Animated.Value(14)).current;
  const bar3 = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    const createAnim = (val: Animated.Value, min: number, max: number, duration: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(val, { toValue: max, duration, useNativeDriver: false }),
          Animated.timing(val, { toValue: min, duration, useNativeDriver: false }),
        ])
      );
    };

    const a1 = createAnim(bar1, 4, 18, 300);
    const a2 = createAnim(bar2, 6, 22, 380);
    const a3 = createAnim(bar3, 4, 16, 340);

    a1.start();
    a2.start();
    a3.start();

    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, []);

  return (
    <View style={waveStyles.container}>
      <Animated.View style={[waveStyles.bar, { height: bar1 }]} />
      <Animated.View style={[waveStyles.bar, { height: bar2 }]} />
      <Animated.View style={[waveStyles.bar, { height: bar3 }]} />
    </View>
  );
};

const waveStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginRight: 6,
    height: 22,
  },
  bar: {
    width: 3,
    backgroundColor: "#FFFFFF",
    borderRadius: 2,
  },
});

export default function RoleplaySessionScreen({
  route,
  navigation,
}: {
  route: any;
  navigation: any;
}) {
  const scenario: Scenario = route.params?.scenario;
  const config = route.params?.config;
  const { cachedUser } = useAuth();
  const employeeId = cachedUser?.userId || "user";

  const isFocused = useIsFocused();
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraOn, setIsCameraOn] = useState(config?.cameraEnabled ?? true);

  // Ready to Start Prompt Modal state (Image 3)
  const [isReadyPromptVisible, setIsReadyPromptVisible] = useState(true);
  const [isStartingSession, setIsStartingSession] = useState(false);

  // Conversation Transcript Modal state (Image 2)
  const [isTranscriptModalVisible, setIsTranscriptModalVisible] = useState(false);

  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMicOn, setIsMicOn] = useState(config?.micEnabled ?? true);
  const [isBotSpeaking, setIsBotSpeaking] = useState(false);
  const [isGeneratingAssessment, setIsGeneratingAssessment] = useState(false);
  const [isEndModalVisible, setIsEndModalVisible] = useState(false);

  const voiceGender: string = config?.voiceGender || "female";

  const [transcript, setTranscript] = useState<Array<{ role: string; text: string }>>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<any>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const lastBackPressTimeRef = useRef<number>(0);
  const isEndingSessionRef = useRef<boolean>(false);
  const spokenTextsRef = useRef<Set<string>>(new Set());
  const soundRef = useRef<AudioPlayer | null>(null);
  const botAudioChunksRef = useRef<string[]>([]);

  // Synchronize state to refs for high-frequency stream callbacks
  const isSessionActiveRef = useRef(false);
  const isMicOnRef = useRef(isMicOn);
  const isBotSpeakingRef = useRef(false);

  useEffect(() => {
    isSessionActiveRef.current = isSessionActive;
  }, [isSessionActive]);

  useEffect(() => {
    isMicOnRef.current = isMicOn;
  }, [isMicOn]);

  useEffect(() => {
    isBotSpeakingRef.current = isBotSpeaking;
  }, [isBotSpeaking]);

  // ── Play Agent Audio Response (TTS Fallback) ────────────────────────────────
  const playAgentAudio = useCallback(
    async (text: string) => {
      if (!text || !text.trim()) return;
      const cleanText = text.trim();

      if (spokenTextsRef.current.has(cleanText)) {
        logger.info("[RoleplaySession] Audio already spoken, skipping duplicate:", cleanText.substring(0, 30));
        return;
      }
      spokenTextsRef.current.add(cleanText);

      try {
        setIsBotSpeaking(true);

        const ttsUrl = `${EXPO_API_URL}/api/tts`;
        const token = await getFirebaseToken().catch(() => null);

        const response = await fetch(ttsUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            text: cleanText,
            voiceGender,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const audioBase64 = data.audio;
          if (audioBase64) {
            const tempFileUri = `${FileSystem.cacheDirectory}roleplay_agent_${Date.now()}.mp3`;
            await FileSystem.writeAsStringAsync(tempFileUri, audioBase64, {
              encoding: FileSystem.EncodingType.Base64,
            });

            await setAudioModeAsync({ playsInSilentMode: true });
            const player = createAudioPlayer({ uri: tempFileUri });
            soundRef.current = player;

            player.addListener("playbackStatusUpdate", (status: any) => {
              if (
                status.playing === false &&
                status.currentTime >= status.duration &&
                status.duration > 0
              ) {
                setIsBotSpeaking(false);
                try {
                  player.remove();
                } catch {}
                soundRef.current = null;
              }
            });
            player.play();
            return;
          }
        }
        setIsBotSpeaking(false);
      } catch (err) {
        logger.error("[RoleplaySession] Audio playback error:", err);
        setIsBotSpeaking(false);
      }
    },
    [voiceGender]
  );

  // ── Play Accumulated Bot Audio Chunks from Realtime WS (PCM16 -> WAV) ───────
  const playBotAudioChunks = useCallback(
    async (fallbackText?: string) => {
      const chunks = [...botAudioChunksRef.current];
      botAudioChunksRef.current = [];

      try {
        setIsBotSpeaking(true);

        if (soundRef.current) {
          try {
            soundRef.current.pause();
            soundRef.current.remove();
          } catch {}
          soundRef.current = null;
        }

        if (chunks.length > 0) {
          const wavBase64 = pcm16ChunksToWavBase64(chunks, 24000, 1);
          if (wavBase64) {
            const tempFileUri = `${FileSystem.cacheDirectory}bot_reply_${Date.now()}.wav`;
            await FileSystem.writeAsStringAsync(tempFileUri, wavBase64, {
              encoding: FileSystem.EncodingType.Base64,
            });

            await setAudioModeAsync({ playsInSilentMode: true });
            const player = createAudioPlayer({ uri: tempFileUri });
            soundRef.current = player;

            player.addListener("playbackStatusUpdate", (status: any) => {
              if (
                status.playing === false &&
                status.currentTime >= status.duration &&
                status.duration > 0
              ) {
                setIsBotSpeaking(false);
                try {
                  player.remove();
                } catch {}
                soundRef.current = null;
              }
            });

            player.play();
            return;
          }
        }

        // Fallback to TTS if no audio chunks were received
        if (fallbackText) {
          await playAgentAudio(fallbackText);
        } else {
          setIsBotSpeaking(false);
        }
      } catch (err) {
        logger.error("[RoleplaySession] Error playing bot audio:", err);
        setIsBotSpeaking(false);
      }
    },
    [playAgentAudio]
  );

  // ── Native 24kHz PCM16 Audio Stream for Realtime WebSocket ────────────────
  const { stream } = useAudioStream({
    sampleRate: 24000,
    channels: 1,
    encoding: "int16",
    onBuffer: (buffer) => {
      if (
        !isSessionActiveRef.current ||
        !isMicOnRef.current ||
        isBotSpeakingRef.current ||
        !wsRef.current ||
        wsRef.current.readyState !== WebSocket.OPEN
      ) {
        return;
      }

      try {
        const pcm16 = new Int16Array(buffer.data);
        if (!pcm16 || pcm16.length === 0) return;

        // Noise gate RMS threshold matching web client
        let sumSq = 0;
        for (let i = 0; i < pcm16.length; i++) {
          const norm = pcm16[i] / 32768.0;
          sumSq += norm * norm;
        }
        const rms = Math.sqrt(sumSq / pcm16.length);
        if (rms < 0.005) {
          pcm16.fill(0);
        }

        const uint8 = new Uint8Array(pcm16.buffer, pcm16.byteOffset, pcm16.byteLength);
        const b64 = uint8ArrayToBase64(uint8);

        wsRef.current.send(
          JSON.stringify({
            type: "audio",
            audio: b64,
          })
        );
      } catch (err) {
        logger.warn("[RoleplaySession] Error sending audio chunk:", err);
      }
    },
  });

  // ── Manage Audio Stream Lifecycle ──────────────────────────────────────────
  useEffect(() => {
    let active = true;

    async function manageStream() {
      if (isSessionActive && isFocused && !isEndingSessionRef.current) {
        try {
          const perm = await requestRecordingPermissionsAsync();
          if (!perm.granted) {
            Alert.alert("Permission Required", "Microphone access is needed for roleplay.");
            return;
          }
          await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
          if (active) {
            await stream.start();
            logger.info("[RoleplaySession] 🎙️ Audio stream started (24kHz PCM16)");
          }
        } catch (err) {
          logger.warn("[RoleplaySession] Error starting audio stream:", err);
        }
      } else {
        try {
          stream.stop();
        } catch {}
      }
    }

    manageStream();

    return () => {
      active = false;
      try {
        stream.stop();
      } catch {}
    };
  }, [isSessionActive, isFocused, stream]);

  // ── Cancel Modal / Exit Before Starting ────────────────────────────────────
  const handleCancelPrompt = useCallback(() => {
    isEndingSessionRef.current = true;
    setIsSessionActive(false);
    setIsCameraOn(false);
    setIsMicOn(false);
    try {
      stream.stop();
    } catch {}
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (soundRef.current) {
      try {
        soundRef.current.remove();
      } catch {}
      soundRef.current = null;
    }
    setIsReadyPromptVisible(false);
    navigation.navigate(STACK_ROUTES.ROLEPLAY as never);
  }, [navigation, stream]);

  // ── Hardware Back & Navigation Listeners ───────────────────────────────────
  const triggerDoublePressExit = useCallback(() => {
    if (isGeneratingAssessment || isEndingSessionRef.current) return;
    setIsEndModalVisible(true);
  }, [isGeneratingAssessment]);

  useEffect(() => {
    const onHardwareBack = () => {
      if (isReadyPromptVisible) {
        handleCancelPrompt();
        return true;
      }
      triggerDoublePressExit();
      return true;
    };

    const backHandler = BackHandler.addEventListener("hardwareBackPress", onHardwareBack);

    const unsubscribeBeforeRemove = navigation.addListener("beforeRemove", (e: any) => {
      if (isEndingSessionRef.current) return;
      if (isReadyPromptVisible) {
        handleCancelPrompt();
        return;
      }
      e.preventDefault();
      triggerDoublePressExit();
    });

    return () => {
      backHandler.remove();
      unsubscribeBeforeRemove();
    };
  }, [navigation, triggerDoublePressExit, isReadyPromptVisible, handleCancelPrompt]);

  // ── Start Session & Initialize WebSocket (triggered by "Ready to Start?" modal) ──
  const handleStartSession = async () => {
    try {
      setIsStartingSession(true);
      setIsConnecting(true);

      if (!scenario?.scenario_id) {
        Alert.alert("Error", "No scenario selected.");
        navigation.goBack();
        return;
      }

      // 1. Create backend session record
      const sessionRes = await createRoleplaySession(employeeId, scenario);
      const createdSessionId = sessionRes?.id;
      if (!createdSessionId) {
        Alert.alert("Session Error", "Could not create roleplay session. Please try again.");
        isEndingSessionRef.current = true;
        navigation.goBack();
        return;
      }
      setSessionId(createdSessionId);

      // Add opening prompt to transcript if available
      if (scenario?.initialPrompt) {
        setTranscript([{ role: "assistant", text: scenario.initialPrompt }]);
      }

      // 2. Obtain token and connect WebSocket
      const token = await getFirebaseToken();
      const wsProtocol = EXPO_API_URL.startsWith("https") ? "wss:" : "ws:";
      const host = EXPO_API_URL.replace(/^https?:\/\//, "").replace(/\/$/, "");
      const wsUrl = `${wsProtocol}//${host}/api/roleplay/realtime?token=${token}`;

      logger.info("[RoleplaySession] Connecting WS:", wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        logger.info("[RoleplaySession] WS connection opened");
        setIsConnecting(false);
        setIsReadyPromptVisible(false);
        setIsStartingSession(false);
        setIsSessionActive(true);

        // Handshake payload
        ws.send(
          JSON.stringify({
            scenarioTitle: scenario.title,
            scenarioRole: scenario.role,
            userRole: scenario.userRole || "Learner",
            initialPrompt: scenario.initialPrompt,
            learnerBrief: scenario.learnerBrief,
            tone: scenario.tone || "Neutral",
            employeeId,
            sessionId: createdSessionId,
            voiceGender,
          })
        );

        // Start turn timer
        timerRef.current = setInterval(() => {
          setElapsedSeconds((prev) => prev + 1);
        }, 1000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case "speech_started":
              setIsUserSpeaking(true);
              setIsBotSpeaking(false);
              // Barge-in: interrupt ongoing bot audio
              if (soundRef.current) {
                try {
                  soundRef.current.pause();
                  soundRef.current.remove();
                } catch {}
                soundRef.current = null;
              }
              botAudioChunksRef.current = [];
              break;

            case "audio":
              if (data.audio) {
                botAudioChunksRef.current.push(data.audio);
              }
              break;

            case "bot_transcription":
              if (data.text) {
                const text = data.text.trim();
                setTranscript((prev) => {
                  const filtered = prev.filter((m) => m.role !== "assistant_chunk");
                  const exists = filtered.some((m) => m.role === "assistant" && m.text.trim() === text);
                  if (exists) return filtered;
                  return [...filtered, { role: "assistant", text }];
                });
                playBotAudioChunks(text);
              } else {
                setIsBotSpeaking(false);
              }
              break;

            case "user_transcription":
              if (data.text) {
                const text = data.text.trim();
                setIsUserSpeaking(false);
                setTranscript((prev) => {
                  const last = prev[prev.length - 1];
                  if (last && last.role === "user" && last.text === text) return prev;
                  return [...prev, { role: "user", text }];
                });
              }
              break;

            case "transcript":
              if (data.text || data.transcript) {
                const botText = (data.transcript || data.text).trim();
                setTranscript((prev) => {
                  const exists = prev.some((m) => m.role === "assistant" && m.text.trim() === botText);
                  if (exists) return prev;
                  return [...prev, { role: "assistant", text: botText }];
                });
                playBotAudioChunks(botText);
              }
              break;

            case "audio_start":
              setIsBotSpeaking(true);
              setIsUserSpeaking(false);
              break;

            case "audio_end":
              setIsBotSpeaking(false);
              break;

            case "session_ended":
              if (data.transcript && Array.isArray(data.transcript)) {
                setTranscript(data.transcript);
              }
              break;

            default:
              break;
          }
        } catch (e) {
          logger.error("[RoleplaySession] Error parsing WS message:", e);
        }
      };

      ws.onerror = (e) => {
        logger.error("[RoleplaySession] WS Error:", e);
        setIsConnecting(false);
        setIsStartingSession(false);
      };

      ws.onclose = () => {
        logger.info("[RoleplaySession] WS Closed");
        setIsConnecting(false);
        setIsStartingSession(false);
      };
    } catch (err) {
      logger.error("[RoleplaySession] Setup Error:", err);
      setIsConnecting(false);
      setIsStartingSession(false);
      Alert.alert("Connection Failed", "Unable to connect to roleplay service. Please try again.");
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isEndingSessionRef.current = true;
      setIsSessionActive(false);
      setIsCameraOn(false);
      setIsMicOn(false);
      try {
        stream.stop();
      } catch {}
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {}
      }
      if (timerRef.current) clearInterval(timerRef.current);
      if (soundRef.current) {
        try {
          soundRef.current.remove();
        } catch {}
      }
    };
  }, [stream]);

  // Speaking Pulse Animation effect
  useEffect(() => {
    if (isBotSpeaking) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 400, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isBotSpeaking]);

  // Toggle Camera View
  const handleToggleCamera = async () => {
    if (!isCameraOn) {
      if (!permission?.granted) {
        const res = await requestPermission();
        if (!res.granted) {
          Alert.alert("Permission Required", "Camera access is needed for video preview.");
          return;
        }
      }
      setIsCameraOn(true);
    } else {
      setIsCameraOn(false);
    }
  };

  // Open Themed End Session Confirmation Modal (Image 2 redesign)
  const handleEndSession = () => {
    setIsEndModalVisible(true);
  };

  // Confirm End Roleplay Session and navigate to Assessment Report
  const confirmEndSession = async () => {
    isEndingSessionRef.current = true;
    setIsSessionActive(false);
    setIsCameraOn(false);
    setIsMicOn(false);
    setIsGeneratingAssessment(true);
    try {
      try {
        stream.stop();
      } catch {}
      if (wsRef.current) {
        try {
          wsRef.current.send(JSON.stringify({ type: "end_session" }));
          wsRef.current.close();
        } catch {}
        wsRef.current = null;
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (soundRef.current) {
        try {
          soundRef.current.remove();
        } catch {}
        soundRef.current = null;
      }

      if (sessionId) {
        const result = await finishRoleplaySession(
          sessionId,
          transcript,
          elapsedSeconds
        );

        setIsGeneratingAssessment(false);
        setIsEndModalVisible(false);

        const rawAssessment = (result as any)?.data || (result as any)?.assessment || result;
        const normalizedAssessment: RoleplayAssessment = {
          id: rawAssessment?.id || `assessment-${sessionId}`,
          overall_score:
            rawAssessment?.overall_score ?? rawAssessment?.overallScore ?? 0,
          summary: rawAssessment?.summary || "Roleplay session completed.",
          parameters: rawAssessment?.parameters || [],
          recommendations: rawAssessment?.recommendations || [],
          created_at: rawAssessment?.created_at || new Date().toISOString(),
        };

        const sessionPayload: RoleplaySession = {
          id: sessionId,
          employee_id: employeeId,
          scenario_id: scenario?.scenario_id || "",
          scenario_title: scenario?.title || "Roleplay Session",
          scenario_role: scenario?.role || "Learner",
          scenario_difficulty: scenario?.difficulty || "Medium",
          conversation_transcript: transcript,
          started_at: new Date(Date.now() - elapsedSeconds * 1000).toISOString(),
          completed_at: new Date().toISOString(),
          duration_seconds: elapsedSeconds,
          message_count: transcript.length,
          roleplay_assessments: [normalizedAssessment],
        };

        // Navigate directly to RoleplayReportScreen
        navigation.replace(STACK_ROUTES.ROLEPLAY_REPORT as never, {
          session: result?.session || sessionPayload,
          assessment: normalizedAssessment,
        });
      } else {
        setIsGeneratingAssessment(false);
        setIsEndModalVisible(false);
        navigation.navigate(STACK_ROUTES.ROLEPLAY as never);
      }
    } catch (err) {
      logger.error("[RoleplaySession] End session error:", err);
      setIsGeneratingAssessment(false);
      setIsEndModalVisible(false);
      navigation.navigate(STACK_ROUTES.ROLEPLAY as never);
    }
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  // Determine avatar initial letter
  const avatarLetter = (scenario?.role || "Vendor").trim().charAt(0).toUpperCase() || "L";

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0F19" />

      {/* ── Top Header ─────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor: isBotSpeaking
                  ? "#F59E0B"
                  : isUserSpeaking
                  ? "#EF4444"
                  : isConnecting
                  ? "#3B82F6"
                  : "#10B981",
              },
            ]}
          />
          <Text style={styles.headerTitle}>
            {scenario?.title || "Roleplay Practice"}
          </Text>
        </View>
      </View>

      {/* ── Main Two-Card Video Call Area (Image 4) ───────────────────────────── */}
      <View style={styles.mainArea}>
        {/* Top Card: AI / Bot side */}
        <View style={styles.botCard}>
          {/* Floating Call Duration Badge in Top Right Corner */}
          <View style={styles.botCardTimerBadge}>
            <MaterialCommunityIcons name="timer-outline" size={13} color="#E0E7FF" />
            <Text style={styles.botCardTimerText}>{formatTimer(elapsedSeconds)}</Text>
          </View>

          {/* Subtle background ambient rings */}
          <View style={styles.botContent}>
            <Animated.View
              style={[
                styles.avatarContainer,
                { transform: [{ scale: pulseAnim }] },
                isBotSpeaking && styles.avatarSpeakingRing,
              ]}
            >
              <View style={styles.avatarInner}>
                <Text style={styles.avatarLetter}>{avatarLetter}</Text>
              </View>
            </Animated.View>

            <Text style={styles.botRoleName}>{scenario?.role || "Vendor"}</Text>

            {/* Speaking / Listening Status Row */}
            <View style={styles.speakingStatusRow}>
              {isBotSpeaking ? (
                <>
                  <AnimatedWaveBars />
                  <Text style={styles.speakingStatusText}>Speaking...</Text>
                </>
              ) : isUserSpeaking ? (
                <>
                  <View style={styles.userSpeakingDot} />
                  <Text style={[styles.speakingStatusText, { color: "#FCA5A5" }]}>Listening...</Text>
                </>
              ) : isConnecting ? (
                <>
                  <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.speakingStatusText}>Connecting...</Text>
                </>
              ) : !isReadyPromptVisible ? (
                <Text style={styles.speakingStatusText}>Ready</Text>
              ) : (
                <Text style={styles.speakingStatusText}>Waiting to start</Text>
              )}
            </View>

            <Text style={styles.botMetaText}>
              {scenario?.difficulty || "Easy"} Difficulty • {scenario?.tone || "Friendly"} Tone
            </Text>
          </View>
        </View>

        {/* Bottom Card: User Camera preview side */}
        <View style={styles.userCard}>
          {isCameraOn && isSessionActive && isFocused ? (
            <CameraView style={StyleSheet.absoluteFill} facing="front" />
          ) : (
            <View style={styles.cameraOffContainer}>
              <MaterialCommunityIcons name="camera-off" size={38} color="#64748B" />
              <Text style={styles.cameraOffText}>Camera is off</Text>
            </View>
          )}

          {/* User badge in corner */}
          <View style={styles.userBadge}>
            <View style={styles.userBadgeDot} />
            <Text style={styles.userBadgeText}>You</Text>
          </View>
        </View>
      </View>

      {/* ── Bottom Controls Bar (Image 1 style) ─────────────────────────────────── */}
      <View style={styles.bottomControlsBar}>
        {/* Transcript Button (before mic) */}
        <TouchableOpacity
          onPress={() => setIsTranscriptModalVisible(true)}
          style={styles.controlBtn}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons
            name="message-text-outline"
            size={22}
            color="#1E1B4B"
          />
        </TouchableOpacity>

        {/* Mic Toggle Button */}
        <TouchableOpacity
          onPress={() => setIsMicOn(!isMicOn)}
          style={[styles.controlBtn, !isMicOn && styles.controlBtnMuted]}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons
            name={isMicOn ? "microphone" : "microphone-off"}
            size={22}
            color={isMicOn ? "#1E1B4B" : "#EF4444"}
          />
        </TouchableOpacity>

        {/* Camera Toggle Button */}
        <TouchableOpacity
          onPress={handleToggleCamera}
          style={[styles.controlBtn, !isCameraOn && styles.controlBtnOff]}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons
            name={isCameraOn ? "camera" : "camera-off"}
            size={22}
            color={isCameraOn ? "#1E1B4B" : "#EF4444"}
          />
        </TouchableOpacity>

        {/* End Session Button */}
        <TouchableOpacity
          onPress={handleEndSession}
          style={styles.endCallBtn}
          activeOpacity={0.85}
          disabled={isGeneratingAssessment}
        >
          {isGeneratingAssessment ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <MaterialCommunityIcons name="phone-hangup" size={18} color="#FFFFFF" />
              <Text style={styles.endCallBtnText}>End Session</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Ready to Start? Prompt Modal (Image 3) ────────────────────────────── */}
      <Modal
        visible={isReadyPromptVisible && !isGeneratingAssessment}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={handleCancelPrompt}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.promptCard}>
            {/* Top Purple Mic Badge */}
            <View style={styles.promptIconCircle}>
              <MaterialCommunityIcons name="microphone" size={32} color="#7C3AED" />
            </View>

            {/* Title */}
            <Text style={styles.promptTitle}>Ready to Start?</Text>

            {/* Subtitle */}
            <Text style={styles.promptBody}>
              Click the button to begin your speech-to-speech role-play. The bot will speak first, then listen to you!
            </Text>

            {/* Button Actions: Cancel & Start */}
            <View style={styles.promptButtonRow}>
              <TouchableOpacity
                style={styles.promptCancelBtn}
                onPress={handleCancelPrompt}
                activeOpacity={0.7}
                disabled={isStartingSession}
              >
                <Text style={styles.promptCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.promptActionBtn}
                onPress={handleStartSession}
                activeOpacity={0.85}
                disabled={isStartingSession}
              >
                {isStartingSession ? (
                  <View style={styles.startingRow}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.promptActionBtnText}>Starting...</Text>
                  </View>
                ) : (
                  <View style={styles.startingRow}>
                    <MaterialCommunityIcons name="microphone" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.promptActionBtnText}>Start</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Conversation Transcript Modal (Image 2) ──────────────────────────── */}
      <Modal
        visible={isTranscriptModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsTranscriptModalVisible(false)}
      >
        <View style={styles.transcriptBackdrop}>
          <View style={styles.transcriptModalContainer}>
            <View style={styles.transcriptModalHeader}>
              <Text style={styles.transcriptModalTitle}>Conversation Transcript</Text>
              <TouchableOpacity
                onPress={() => setIsTranscriptModalVisible(false)}
                style={styles.transcriptModalCloseBtn}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="close" size={22} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.transcriptScrollView}
              contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
              showsVerticalScrollIndicator={false}
            >
              {transcript.length === 0 ? (
                <Text style={styles.emptyTranscriptText}>No conversation yet.</Text>
              ) : (
                transcript.map((msg, idx) => {
                  const isUser = msg.role === "user";
                  return (
                    <View
                      key={idx}
                      style={[
                        styles.transcriptBubble,
                        isUser ? styles.transcriptUserBubble : styles.transcriptBotBubble,
                      ]}
                    >
                      <Text style={[styles.transcriptBubbleRole, isUser && { color: "#C7D2FE" }]}>
                        {isUser ? "You" : scenario?.role || "AI Evaluator"}
                      </Text>
                      <Text style={[styles.transcriptBubbleText, isUser && { color: "#FFFFFF" }]}>
                        {msg.text}
                      </Text>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── End Session Confirmation Modal (Themed replacement for Image 2) ───── */}
      <Modal
        visible={isEndModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {
          if (!isGeneratingAssessment) setIsEndModalVisible(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.endModalCard}>
            <View style={styles.endModalIconCircle}>
              <MaterialCommunityIcons name="phone-hangup" size={28} color="#EF4444" />
            </View>

            <Text style={styles.endModalTitle}>End Roleplay Session?</Text>

            <Text style={styles.endModalBody}>
              Are you ready to submit your conversation for AI evaluation and view your performance score?
            </Text>

            <View style={styles.endModalButtonCol}>
              <TouchableOpacity
                style={styles.endModalConfirmBtn}
                onPress={confirmEndSession}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="check-decagram" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.endModalConfirmBtnText}>End & Evaluate</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.endModalCancelBtn}
                onPress={() => setIsEndModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.endModalCancelBtnText}>Continue Practice</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Assessment Loading Overlay ────────────────────────────────────────── */}
      {isGeneratingAssessment && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Generating evaluation report...</Text>
          <Text style={styles.loadingSubtext}>Please wait while AI analyzes your roleplay session.</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0F19",
  },

  // ── Header Bar ─────────────────────────────────────────────────────────────
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#111827",
    borderBottomWidth: 1,
    borderBottomColor: "#1F2937",
  },
  headerTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#F9FAFB",
    flex: 1,
    flexWrap: "wrap",
  },
  botCardTimerBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    zIndex: 10,
  },
  botCardTimerText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
    marginLeft: 5,
    fontVariant: ["tabular-nums"],
  },

  // ── Main Video Workspace (Image 4) ─────────────────────────────────────────
  mainArea: {
    flex: 1,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 6,
    gap: 10,
  },

  // Top Card: Bot side (Purple Gradient Feel)
  botCard: {
    flex: 1,
    backgroundColor: "#7C3AED",
    borderRadius: 16,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  botContent: {
    alignItems: "center",
    justifyContent: "center",
  },
  avatarContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  avatarSpeakingRing: {
    borderWidth: 4,
    borderColor: "rgba(255, 255, 255, 0.6)",
  },
  avatarInner: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarLetter: {
    fontSize: 42,
    fontWeight: "800",
    color: "#7C3AED",
  },
  botRoleName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  speakingStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
    height: 24,
  },
  speakingStatusText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#F3E8FF",
  },
  userSpeakingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
    marginRight: 6,
  },
  botMetaText: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.8)",
  },

  // Bottom Card: User Camera side
  userCard: {
    flex: 1,
    backgroundColor: "#000000",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#1F2937",
    justifyContent: "center",
    alignItems: "center",
  },
  cameraOffContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  cameraOffText: {
    color: "#94A3B8",
    fontSize: 14,
    fontWeight: "500",
    marginTop: 8,
  },
  userBadge: {
    position: "absolute",
    bottom: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  userBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  userBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
  },

  // ── Bottom Controls Bar (Image 1 style) ───────────────────────────────────
  bottomControlsBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#111827",
    borderTopWidth: 1,
    borderTopColor: "#1F2937",
  },
  controlBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#E2E8F0",
    justifyContent: "center",
    alignItems: "center",
  },
  controlBtnMuted: {
    backgroundColor: "#FEE2E2",
  },
  controlBtnOff: {
    backgroundColor: "#FEE2E2",
  },
  endCallBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EF4444",
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 24,
    gap: 6,
  },
  endCallBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },

  // ── Ready to Start? Prompt Modal (Image 3) ──────────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  promptCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  promptIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#EDE9FE",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  promptTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 10,
    textAlign: "center",
  },
  promptBody: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 24,
  },
  promptButtonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    width: "100%",
  },
  promptCancelBtn: {
    flex: 1,
    height: 50,
    backgroundColor: "#EF4444",
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  promptCancelBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  promptActionBtn: {
    flex: 1.4,
    height: 50,
    backgroundColor: "#4F46E5",
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  promptActionBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  startingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  // ── End Session Confirmation Modal (Themed replacement for Image 2) ────────
  endModalCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#1E293B",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  endModalIconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  endModalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
    textAlign: "center",
  },
  endModalBody: {
    fontSize: 14,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 22,
  },
  endModalButtonCol: {
    width: "100%",
    gap: 10,
  },
  endModalConfirmBtn: {
    width: "100%",
    height: 48,
    backgroundColor: "#EF4444",
    borderRadius: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  endModalConfirmBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  endModalCancelBtn: {
    width: "100%",
    height: 46,
    backgroundColor: "transparent",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#475569",
    justifyContent: "center",
    alignItems: "center",
  },
  endModalCancelBtnText: {
    color: "#E2E8F0",
    fontSize: 14,
    fontWeight: "600",
  },

  // ── Conversation Transcript Modal (Image 2) ────────────────────────────────
  transcriptBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  transcriptModalContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
    minHeight: "50%",
  },
  transcriptModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  transcriptModalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0F172A",
  },
  transcriptModalCloseBtn: {
    padding: 4,
  },
  transcriptScrollView: {
    flex: 1,
  },
  emptyTranscriptText: {
    textAlign: "center",
    color: "#94A3B8",
    marginTop: 30,
    fontSize: 14,
  },
  transcriptBubble: {
    maxWidth: "85%",
    padding: 12,
    borderRadius: 16,
    marginBottom: 10,
  },
  transcriptUserBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#3B82F6",
    borderBottomRightRadius: 4,
  },
  transcriptBotBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#F1F5F9",
    borderBottomLeftRadius: 4,
  },
  transcriptBubbleRole: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
    marginBottom: 4,
  },
  transcriptBubbleText: {
    fontSize: 14,
    color: "#0F172A",
    lineHeight: 20,
  },

  // ── Loading Overlay ────────────────────────────────────────────────────────
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(11, 15, 25, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    zIndex: 100,
  },
  loadingText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    marginTop: 16,
  },
  loadingSubtext: {
    color: "#94A3B8",
    fontSize: 13,
    marginTop: 6,
    textAlign: "center",
  },
});
