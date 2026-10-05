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
import { useIsFocused, StackActions } from "@react-navigation/native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { LinearGradient } from "expo-linear-gradient";

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
import { STACK_ROUTES, APP_ROUTES } from "../../../navigations/Routes";
import { useAuth } from "../../../contex/AuthContext";
import { useFeatureGating, FEATURES } from "../../../hooks/useFeatureGating";
import { logger } from "../../../utils/UnifiedLogger";

const EXPO_API_URL =
  process.env.EXPO_PUBLIC_API_URL || "https://api.workfloww.ai";

// ── Dynamic 4-Bar Audio Waveform Visualizer ─────────────────────────────────
const AnimatedWaveBars = ({
  color = "#FFFFFF",
  isAnimating = false,
}: {
  color?: string;
  isAnimating?: boolean;
}) => {
  const bar1 = useRef(new Animated.Value(4)).current;
  const bar2 = useRef(new Animated.Value(6)).current;
  const bar3 = useRef(new Animated.Value(4)).current;
  const bar4 = useRef(new Animated.Value(5)).current;

  useEffect(() => {
    if (!isAnimating) {
      Animated.parallel([
        Animated.timing(bar1, { toValue: 4, duration: 180, useNativeDriver: false }),
        Animated.timing(bar2, { toValue: 6, duration: 180, useNativeDriver: false }),
        Animated.timing(bar3, { toValue: 4, duration: 180, useNativeDriver: false }),
        Animated.timing(bar4, { toValue: 5, duration: 180, useNativeDriver: false }),
      ]).start();
      return;
    }

    const createAnim = (val: Animated.Value, min: number, max: number, duration: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(val, { toValue: max, duration, useNativeDriver: false }),
          Animated.timing(val, { toValue: min, duration, useNativeDriver: false }),
        ])
      );
    };

    const a1 = createAnim(bar1, 4, 16, 260);
    const a2 = createAnim(bar2, 6, 20, 340);
    const a3 = createAnim(bar3, 4, 18, 300);
    const a4 = createAnim(bar4, 5, 15, 380);

    a1.start();
    a2.start();
    a3.start();
    a4.start();

    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
      a4.stop();
    };
  }, [isAnimating]);

  return (
    <View style={waveStyles.container}>
      <Animated.View style={[waveStyles.bar, { height: bar1, backgroundColor: color }]} />
      <Animated.View style={[waveStyles.bar, { height: bar2, backgroundColor: color }]} />
      <Animated.View style={[waveStyles.bar, { height: bar3, backgroundColor: color }]} />
      <Animated.View style={[waveStyles.bar, { height: bar4, backgroundColor: color }]} />
    </View>
  );
};

// ── Multi-Layer Pulsing Ripple Rings for Avatar ──────────────────────────────
const AvatarRippleRings = ({
  isSpeaking,
  isListening,
  color,
  children,
}: {
  isSpeaking: boolean;
  isListening: boolean;
  color: string;
  children: React.ReactNode;
}) => {
  const pulse1 = useRef(new Animated.Value(0)).current;
  const pulse2 = useRef(new Animated.Value(0)).current;
  const pulse3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isSpeaking && !isListening) {
      pulse1.setValue(0);
      pulse2.setValue(0);
      pulse3.setValue(0);
      return;
    }

    const duration = isSpeaking ? 1200 : 1800;

    const createPulseLoop = (val: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, {
            toValue: 1,
            duration,
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const a1 = createPulseLoop(pulse1, 0);
    const a2 = createPulseLoop(pulse2, duration * 0.33);
    const a3 = createPulseLoop(pulse3, duration * 0.66);

    a1.start();
    a2.start();
    a3.start();

    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [isSpeaking, isListening]);

  const ringStyle = (anim: Animated.Value, maxScale: number) => ({
    transform: [
      {
        scale: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [1, maxScale],
        }),
      },
    ],
    opacity: anim.interpolate({
      inputRange: [0, 0.4, 1],
      outputRange: [0.65, 0.35, 0],
    }),
  });

  return (
    <View style={rippleStyles.wrapper}>
      {/* Outer Pulse Ring 3 */}
      <Animated.View
        style={[
          rippleStyles.ring,
          { borderColor: color, backgroundColor: color },
          ringStyle(pulse3, 1.45),
        ]}
      />
      {/* Mid Pulse Ring 2 */}
      <Animated.View
        style={[
          rippleStyles.ring,
          { borderColor: color, backgroundColor: color },
          ringStyle(pulse2, 1.3),
        ]}
      />
      {/* Inner Pulse Ring 1 */}
      <Animated.View
        style={[
          rippleStyles.ring,
          { borderColor: color, backgroundColor: color },
          ringStyle(pulse1, 1.15),
        ]}
      />
      {children}
    </View>
  );
};

const waveStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginRight: 7,
    height: 20,
  },
  bar: {
    width: 3,
    borderRadius: 2,
  },
});

const rippleStyles = StyleSheet.create({
  wrapper: {
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  ring: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1.5,
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

  const { hasFeature, addonsKnown } = useFeatureGating();
  useEffect(() => {
    if (addonsKnown && !hasFeature(FEATURES.ROLE_PLAY)) {
      navigation.navigate(APP_ROUTES.HOME);
    }
  }, [addonsKnown, hasFeature, navigation]);

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
  const userSpeakingTimerRef = useRef<any>(null);

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
        } else if (rms >= 0.012 && !isBotSpeakingRef.current && isMicOnRef.current) {
          setIsUserSpeaking(true);
          if (userSpeakingTimerRef.current) clearTimeout(userSpeakingTimerRef.current);
          userSpeakingTimerRef.current = setTimeout(() => {
            setIsUserSpeaking(false);
          }, 1200);
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

  // ── Clean Up All Session Resources ─────────────────────────────────────────
  const cleanupSessionResources = useCallback(() => {
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
    if (userSpeakingTimerRef.current) {
      clearTimeout(userSpeakingTimerRef.current);
      userSpeakingTimerRef.current = null;
    }
    setIsUserSpeaking(false);
  }, [stream]);

  // ── Navigate Safely Back to Roleplay Screen ─────────────────────────────────
  const navigateBackToRoleplay = useCallback(() => {
    cleanupSessionResources();
    setIsReadyPromptVisible(false);

    const routes = navigation.getState?.()?.routes || [];
    const hasRoleplay = routes.some((r: any) => r.name === STACK_ROUTES.ROLEPLAY);

    if (hasRoleplay) {
      navigation.dispatch(StackActions.popTo(STACK_ROUTES.ROLEPLAY));
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate(STACK_ROUTES.ROLEPLAY as never);
    }
  }, [navigation, cleanupSessionResources]);

  // ── Cancel Modal / Exit Before Starting ────────────────────────────────────
  const handleCancelPrompt = useCallback(() => {
    navigateBackToRoleplay();
  }, [navigateBackToRoleplay]);

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
        cleanupSessionResources();
        return;
      }
      e.preventDefault();
      triggerDoublePressExit();
    });

    return () => {
      backHandler.remove();
      unsubscribeBeforeRemove();
    };
  }, [navigation, triggerDoublePressExit, isReadyPromptVisible, handleCancelPrompt, cleanupSessionResources]);

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
        navigateBackToRoleplay();
      }
    } catch (err) {
      logger.error("[RoleplaySession] End session error:", err);
      setIsGeneratingAssessment(false);
      setIsEndModalVisible(false);
      navigateBackToRoleplay();
    }
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  // Determine avatar initial letter
  const avatarLetter = (scenario?.role || "Vendor").trim().charAt(0).toUpperCase() || "L";

  // ── Dynamic State Configuration for Immersive Agent Atmosphere ──────────────
  const getAgentCardConfig = () => {
    if (isBotSpeaking) {
      return {
        gradient: ["#3B1873", "#6D28D9", "#4338CA"] as const,
        borderColor: "rgba(196, 181, 253, 0.5)",
        accentColor: "#C4B5FD",
        rippleColor: "rgba(167, 139, 250, 0.35)",
        pillBg: "rgba(30, 15, 60, 0.7)",
        pillBorder: "rgba(196, 181, 253, 0.4)",
        pillText: "#EDE9FE",
        avatarLetterColor: "#6D28D9",
        statusLabel: "AI Speaking...",
        statusBadgeText: "AI Talking",
        statusBadgeIcon: "volume-high" as const,
        isSpeaking: true,
        isListening: false,
        isAudioDetected: true,
      };
    }

    if (isUserSpeaking) {
      return {
        gradient: ["#064E3B", "#047857", "#0D9488"] as const,
        borderColor: "rgba(110, 231, 183, 0.55)",
        accentColor: "#6EE7B7",
        rippleColor: "rgba(52, 211, 153, 0.35)",
        pillBg: "rgba(6, 40, 30, 0.7)",
        pillBorder: "rgba(110, 231, 183, 0.45)",
        pillText: "#D1FAE5",
        avatarLetterColor: "#059669",
        statusLabel: "Listening to you...",
        statusBadgeText: "AI Listening",
        statusBadgeIcon: "microphone" as const,
        isSpeaking: false,
        isListening: true,
        isAudioDetected: true,
      };
    }

    if (isSessionActive && !isConnecting && !isReadyPromptVisible) {
      return {
        gradient: ["#0F172A", "#134E4A", "#064E3B"] as const,
        borderColor: "rgba(45, 212, 191, 0.35)",
        accentColor: "#2DD4BF",
        rippleColor: "rgba(45, 212, 191, 0.2)",
        pillBg: "rgba(15, 23, 42, 0.7)",
        pillBorder: "rgba(45, 212, 191, 0.35)",
        pillText: "#CCFBF1",
        avatarLetterColor: "#0F766E",
        statusLabel: "Your turn • Listening",
        statusBadgeText: "AI Listening",
        statusBadgeIcon: "ear-hearing" as const,
        isSpeaking: false,
        isListening: true,
        isAudioDetected: false,
      };
    }

    if (isConnecting) {
      return {
        gradient: ["#1E1B4B", "#312E81", "#1E293B"] as const,
        borderColor: "rgba(165, 180, 252, 0.3)",
        accentColor: "#818CF8",
        rippleColor: "rgba(129, 140, 248, 0.15)",
        pillBg: "rgba(17, 24, 39, 0.7)",
        pillBorder: "rgba(165, 180, 252, 0.25)",
        pillText: "#E0E7FF",
        avatarLetterColor: "#4F46E5",
        statusLabel: "Connecting...",
        statusBadgeText: "Connecting",
        statusBadgeIcon: "robot-outline" as const,
        isSpeaking: false,
        isListening: false,
        isAudioDetected: false,
      };
    }

    // Standby / Waiting to start
    return {
      gradient: ["#0F172A", "#1E293B", "#111827"] as const,
      borderColor: "rgba(255, 255, 255, 0.12)",
      accentColor: "#94A3B8",
      rippleColor: "transparent",
      pillBg: "rgba(15, 23, 42, 0.7)",
      pillBorder: "rgba(255, 255, 255, 0.15)",
      pillText: "#94A3B8",
      avatarLetterColor: "#475569",
      statusLabel: "Waiting to start",
      statusBadgeText: "AI Counterpart",
      statusBadgeIcon: "robot-outline" as const,
      isSpeaking: false,
      isListening: false,
      isAudioDetected: false,
    };
  };

  const agentConfig = getAgentCardConfig();

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
                  ? "#8B5CF6"
                  : isUserSpeaking
                  ? "#10B981"
                  : isConnecting
                  ? "#3B82F6"
                  : "#64748B",
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
        {/* Top Card: AI / Bot side with Dynamic Adaptive Atmosphere */}
        <LinearGradient
          colors={agentConfig.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.botCard, { borderColor: agentConfig.borderColor }]}
        >
          {/* Floating Call Duration Badge in Top Right Corner */}
          <View style={styles.botCardTimerBadge}>
            <MaterialCommunityIcons name="timer-outline" size={13} color="#E0E7FF" />
            <Text style={styles.botCardTimerText}>{formatTimer(elapsedSeconds)}</Text>
          </View>

          {/* Floating Live AI Persona / State Badge in Top Left Corner */}
          <View style={styles.botCardRoleBadge}>
            <MaterialCommunityIcons
              name={agentConfig.statusBadgeIcon}
              size={13}
              color={agentConfig.accentColor}
            />
            <Text style={[styles.botCardRoleBadgeText, { color: agentConfig.accentColor }]}>
              {agentConfig.statusBadgeText}
            </Text>
          </View>

          {/* Central AI Avatar with Multi-Layer Ripple Rings */}
          <View style={styles.botContent}>
            <AvatarRippleRings
              isSpeaking={isBotSpeaking}
              isListening={isUserSpeaking}
              color={agentConfig.rippleColor}
            >
              <View
                style={[
                  styles.avatarContainer,
                  { borderColor: agentConfig.accentColor },
                ]}
              >
                <View style={styles.avatarInner}>
                  <Text style={[styles.avatarLetter, { color: agentConfig.avatarLetterColor }]}>
                    {avatarLetter}
                  </Text>
                </View>
              </View>
            </AvatarRippleRings>

            <Text style={styles.botRoleName} numberOfLines={2}>
              {scenario?.role || "AI Evaluator"}
            </Text>

            {/* Elevated Dynamic Status Pill */}
            <View
              style={[
                styles.speakingStatusPill,
                {
                  backgroundColor: agentConfig.pillBg,
                  borderColor: agentConfig.pillBorder,
                },
              ]}
            >
              {agentConfig.isSpeaking ? (
                <>
                  <AnimatedWaveBars
                    color="#FFFFFF"
                    isAnimating={agentConfig.isAudioDetected}
                  />
                  <Text style={[styles.speakingStatusText, { color: agentConfig.pillText }]}>
                    {agentConfig.statusLabel}
                  </Text>
                </>
              ) : agentConfig.isListening ? (
                <>
                  <AnimatedWaveBars
                    color={agentConfig.accentColor}
                    isAnimating={agentConfig.isAudioDetected}
                  />
                  <Text style={[styles.speakingStatusText, { color: agentConfig.pillText }]}>
                    {agentConfig.statusLabel}
                  </Text>
                </>
              ) : isConnecting ? (
                <>
                  <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={[styles.speakingStatusText, { color: agentConfig.pillText }]}>
                    {agentConfig.statusLabel}
                  </Text>
                </>
              ) : (
                <>
                  <View style={[styles.standbyDot, { backgroundColor: agentConfig.accentColor }]} />
                  <Text style={[styles.speakingStatusText, { color: agentConfig.pillText }]}>
                    {agentConfig.statusLabel}
                  </Text>
                </>
              )}
            </View>

            <Text style={styles.botMetaText}>
              {scenario?.difficulty || "Medium"} Difficulty • {scenario?.tone || "Professional"} Tone
            </Text>
          </View>
        </LinearGradient>

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

      {/* ── Ready to Start? Prompt Modal ───────────────── */}
      <Modal
        visible={isReadyPromptVisible && !isGeneratingAssessment}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={handleCancelPrompt}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.promptCard}>

            {/* Glowing Hero Icon Badge */}
            <View style={styles.promptIconOuterRing}>
              <View style={styles.promptIconCircle}>
                <MaterialCommunityIcons name="account-voice" size={30} color="#FFFFFF" />
              </View>
            </View>

            {/* Status Pill */}
            <View style={styles.promptStatusPill}>
              <View style={styles.promptStatusDot} />
              <Text style={styles.promptStatusText}>AI Audio Ready</Text>
            </View>

            {/* Title */}
            <Text style={styles.promptTitle}>Ready to Practice?</Text>

            {/* Scenario Subtitle */}
            <Text style={styles.promptScenarioTitle} numberOfLines={1}>
              {scenario?.title || "Sales & Communication Roleplay"}
            </Text>

            {/* Flow Description */}
            <Text style={styles.promptBody}>
              The AI will greet you first. Once they finish speaking, respond naturally just like a real phone or video call.
            </Text>

            {/* Pre-Flight Environment Checklist */}
            <View style={styles.promptChecklistCard}>
              <View style={styles.checkItem}>
                <View style={styles.checkIconBox}>
                  <MaterialCommunityIcons name="wifi-check" size={16} color="#4F46E5" />
                </View>
                <View style={styles.checkTextBox}>
                  <Text style={styles.checkTitle}>High-Speed Internet Zone</Text>
                  <Text style={styles.checkSub}>Fast, stable network for zero speech lag</Text>
                </View>
              </View>

              <View style={styles.checkDivider} />

              <View style={styles.checkItem}>
                <View style={styles.checkIconBox}>
                  <MaterialCommunityIcons name="volume-off" size={16} color="#4F46E5" />
                </View>
                <View style={styles.checkTextBox}>
                  <Text style={styles.checkTitle}>Quiet & Closed Space</Text>
                  <Text style={styles.checkSub}>Low ambient noise so the AI captures your voice</Text>
                </View>
              </View>
            </View>

            {/* Start Button */}
            <TouchableOpacity
              style={[styles.promptActionBtn, isStartingSession && styles.promptActionBtnDisabled]}
              onPress={handleStartSession}
              activeOpacity={0.85}
              disabled={isStartingSession}
            >
              {isStartingSession ? (
                <View style={styles.startingRow}>
                  <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.promptActionBtnText}>Connecting to AI...</Text>
                </View>
              ) : (
                <View style={styles.startingRow}>
                  <MaterialCommunityIcons name="play-circle" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.promptActionBtnText}>Start Conversation</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Subtle Cancel / Go Back */}
            <TouchableOpacity
              style={styles.promptSecondaryBtn}
              onPress={handleCancelPrompt}
              activeOpacity={0.7}
              disabled={isStartingSession}
            >
              <Text style={styles.promptSecondaryBtnText}>Not now, go back</Text>
            </TouchableOpacity>
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

  // Top Card: Bot side with Dynamic Adaptive Atmosphere
  botCard: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1.5,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
    position: "relative",
  },
  botCardRoleBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    gap: 5,
    zIndex: 10,
  },
  botCardRoleBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  botContent: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  avatarContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(255, 255, 255, 0.22)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
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
    fontSize: 40,
    fontWeight: "800",
  },
  botRoleName: {
    fontSize: 19,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 6,
    textAlign: "center",
    maxWidth: "88%",
    letterSpacing: -0.2,
  },
  speakingStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 8,
    marginTop: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  speakingStatusText: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  standbyDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 6,
  },
  botMetaText: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.75)",
    fontWeight: "500",
    marginTop: 2,
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

  // ── Ready to Start? Prompt Modal ───────────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.72)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  promptCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 14,
    alignItems: "center",
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  promptCloseBtn: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  promptIconOuterRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  promptIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#4F46E5",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  promptStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    gap: 6,
    marginBottom: 8,
  },
  promptStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },
  promptStatusText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#059669",
  },
  promptTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
    marginBottom: 2,
  },
  promptScenarioTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4F46E5",
    textAlign: "center",
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  promptBody: {
    fontSize: 12.5,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  promptChecklistCard: {
    width: "100%",
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  checkItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  checkTextBox: {
    flex: 1,
  },
  checkTitle: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#1E293B",
  },
  checkSub: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
  },
  checkDivider: {
    height: 1,
    backgroundColor: "#EDF2F7",
  },
  promptActionBtn: {
    width: "100%",
    height: 48,
    backgroundColor: "#4F46E5",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 4,
  },
  promptActionBtnDisabled: {
    opacity: 0.75,
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
  promptSecondaryBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  promptSecondaryBtnText: {
    color: "#64748B",
    fontSize: 12.5,
    fontWeight: "600",
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
