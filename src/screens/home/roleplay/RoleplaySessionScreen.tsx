import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StatusBar,
  Animated,
  BackHandler,
  ToastAndroid,
  Platform,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";

import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";

import {
  Scenario,
  createRoleplaySession,
  finishRoleplaySession,
} from "../../../api/roleplay";
import { getFirebaseToken } from "../../../api/users/Request";
import { STACK_ROUTES } from "../../../navigations/Routes";
import { useAuth } from "../../../contex/AuthContext";
import { logger } from "../../../utils/UnifiedLogger";

const EXPO_API_URL =
  process.env.EXPO_PUBLIC_API_URL || "https://api.workfloww.ai";

export default function RoleplaySessionScreen({
  route,
  navigation,
}: {
  route: any;
  navigation: any;
}) {
  const scenario: Scenario = route.params?.scenario;
  const { cachedUser } = useAuth();
  const employeeId = cachedUser?.userId || "user";

  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraOn, setIsCameraOn] = useState(false);

  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isBotSpeaking, setIsBotSpeaking] = useState(false);
  const [isGeneratingAssessment, setIsGeneratingAssessment] = useState(false);

  const [transcript, setTranscript] = useState<Array<{ role: string; text: string }>>([
    {
      role: "assistant",
      text: scenario?.initialPrompt || "Hello! Ready when you are to begin the roleplay.",
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const timerRef = useRef<any>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const userPulseAnim = useRef(new Animated.Value(1)).current;
  const lastBackPressTimeRef = useRef<number>(0);
  const isEndingSessionRef = useRef<boolean>(false);

  const soundRef = useRef<AudioPlayer | null>(null);

  // Play agent audio response via TTS / Audio Player
  const playAgentAudio = useCallback(
    async (text: string) => {
      if (!text || !text.trim()) return;
      try {
        setIsBotSpeaking(true);

        // Pause speech recognition while agent speaks to prevent audio self-feedback & Code 5 crashes
        try {
          ExpoSpeechRecognitionModule.stop();
        } catch {}

        const ttsUrl = `${EXPO_API_URL}/api/tts/chat`;
        const token = await getFirebaseToken().catch(() => null);

        const response = await fetch(ttsUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            text,
            voiceGender: "female",
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
              if (status.playing === false && status.currentTime >= status.duration && status.duration > 0) {
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
    [scenario]
  );

  // --- Speech Recognition Events ---
  useSpeechRecognitionEvent("start", () => {
    if (isMicOn && !isBotSpeaking) {
      setIsUserSpeaking(true);
    }
  });

  useSpeechRecognitionEvent("end", () => {
    setIsUserSpeaking(false);
  });

  useSpeechRecognitionEvent("error", (e: any) => {
    if (e.code === 5 || e.error === "client") {
      // Android Code 5: client side error / recognizer busy. Ignore safely.
      setIsUserSpeaking(false);
      return;
    }
    logger.error("[RoleplaySession] Speech recognition error:", e);
    setIsUserSpeaking(false);
  });

  useSpeechRecognitionEvent("result", (ev) => {
    if (ev.results && ev.results[0]?.transcript && isMicOn && !isBotSpeaking) {
      const text = ev.results[0].transcript.trim();
      if (text) {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "user_message", text }));
        }
        setTranscript((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === "user" && last.text === text) return prev;
          return [...prev, { role: "user", text }];
        });
      }
    }
  });

  // --- Speech Recognition Control Effect ---
  useEffect(() => {
    let active = true;

    async function startRecording() {
      try {
        if (isBotSpeaking) return;

        const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        if (!perm.granted) return;

        await setAudioModeAsync({
          playsInSilentMode: true,
        });

        // Ensure previous instance is stopped before starting new session to avoid Code 5
        try {
          ExpoSpeechRecognitionModule.stop();
        } catch {}

        if (isMicOn && !isConnecting && active && !isBotSpeaking) {
          ExpoSpeechRecognitionModule.start({
            lang: "en-US",
            interimResults: true,
            continuous: true,
          });
        }
      } catch (err) {
        logger.warn("[RoleplaySession] Speech recognition start error:", err);
      }
    }

    if (isMicOn && !isConnecting && !isBotSpeaking) {
      startRecording();
    } else {
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch {}
      setIsUserSpeaking(false);
    }

    return () => {
      active = false;
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch {}
    };
  }, [isMicOn, isConnecting, isBotSpeaking]);

  // Trigger double press exit logic
  const triggerDoublePressExit = useCallback(() => {
    if (isGeneratingAssessment || isEndingSessionRef.current) return;

    const now = Date.now();
    if (now - lastBackPressTimeRef.current < 2000) {
      handleEndSession();
    } else {
      lastBackPressTimeRef.current = now;
      if (Platform.OS === "android") {
        ToastAndroid.show("Press back again to exit session", ToastAndroid.SHORT);
      } else {
        Alert.alert("Exit Session?", "Press back again within 2 seconds to exit this session.");
      }
    }
  }, [isGeneratingAssessment]);

  // BackHandler & React Navigation beforeRemove listeners
  useEffect(() => {
    const onHardwareBack = () => {
      triggerDoublePressExit();
      return true;
    };

    const backHandler = BackHandler.addEventListener("hardwareBackPress", onHardwareBack);

    const unsubscribeBeforeRemove = navigation.addListener("beforeRemove", (e: any) => {
      if (isEndingSessionRef.current) {
        return;
      }
      e.preventDefault();
      triggerDoublePressExit();
    });

    return () => {
      backHandler.remove();
      unsubscribeBeforeRemove();
    };
  }, [navigation, triggerDoublePressExit]);

  // Initialize Roleplay session and WebSocket
  useEffect(() => {
    let isMounted = true;

    async function initSession() {
      try {
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
        if (isMounted) setSessionId(createdSessionId);

        // 2. Obtain token and connect WebSocket
        const token = await getFirebaseToken();
        const wsProtocol = EXPO_API_URL.startsWith("https") ? "wss:" : "ws:";
        const host = EXPO_API_URL.replace(/^https?:\/\//, "").replace(/\/$/, "");
        const wsUrl = `${wsProtocol}//${host}/api/roleplay/realtime?token=${token}`;

        logger.info("[RoleplaySession] Connecting WS:", wsUrl);
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isMounted) return;
          logger.info("[RoleplaySession] WS connection opened");
          setIsConnecting(false);

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
            })
          );

          if (scenario?.initialPrompt) {
            playAgentAudio(scenario.initialPrompt);
          }
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            switch (data.type) {
              case "speech_started":
                if (isMounted) {
                  setIsUserSpeaking(true);
                  setIsBotSpeaking(false);
                }
                break;

              case "audio":
                if (isMounted) {
                  setIsBotSpeaking(true);
                  setIsUserSpeaking(false);
                }
                break;

              case "transcript_chunk":
                if (isMounted) {
                  setIsBotSpeaking(true);
                  setIsUserSpeaking(false);
                  if (data.text) {
                    setTranscript((prev) => {
                      const last = prev[prev.length - 1];
                      if (last && last.role === "assistant_chunk") {
                        return [...prev.slice(0, -1), { role: "assistant_chunk", text: last.text + data.text }];
                      }
                      return [...prev, { role: "assistant_chunk", text: data.text }];
                    });
                  }
                }
                break;

              case "bot_transcription":
                if (isMounted) {
                  if (data.text) {
                    setTranscript((prev) => {
                      const filtered = prev.filter((m) => m.role !== "assistant_chunk");
                      return [...filtered, { role: "assistant", text: data.text }];
                    });
                    playAgentAudio(data.text);
                  } else {
                    setIsBotSpeaking(false);
                  }
                }
                break;

              case "user_transcription":
                if (isMounted && data.text) {
                  setTranscript((prev) => {
                    const last = prev[prev.length - 1];
                    if (last && last.role === "user" && last.text === data.text) return prev;
                    return [...prev, { role: "user", text: data.text }];
                  });
                }
                break;

              case "transcript":
                if (isMounted && (data.text || data.transcript)) {
                  const botText = data.transcript || data.text;
                  setTranscript((prev) => [...prev, { role: "assistant", text: botText }]);
                  playAgentAudio(botText);
                }
                break;

              case "audio_start":
                if (isMounted) {
                  setIsBotSpeaking(true);
                  setIsUserSpeaking(false);
                }
                break;

              case "audio_end":
                if (isMounted) setIsBotSpeaking(false);
                break;

              case "session_ended":
                if (isMounted && data.transcript && Array.isArray(data.transcript)) {
                  setTranscript(data.transcript);
                }
                break;

              default:
                if (data.text && isMounted) {
                  setTranscript((prev) => [...prev, { role: "assistant", text: data.text }]);
                }
                break;
            }
          } catch (e) {
            if (event.data && isMounted) {
              setTranscript((prev) => [...prev, { role: "assistant", text: String(event.data) }]);
            }
          }
        };

        ws.onerror = (e) => {
          logger.error("[RoleplaySession] WS Error:", e);
          if (isMounted) setIsConnecting(false);
        };

        ws.onclose = () => {
          logger.info("[RoleplaySession] WS Closed");
          if (isMounted) setIsConnecting(false);
        };
      } catch (err) {
        logger.error("[RoleplaySession] Setup Error:", err);
        if (isMounted) setIsConnecting(false);
      }
    }

    initSession();

    // Start turn timer
    timerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => {
      isMounted = false;
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {}
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [scenario]);

  // Speaking Animation effect
  useEffect(() => {
    if (isBotSpeaking) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.25, duration: 400, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isBotSpeaking]);

  useEffect(() => {
    if (isUserSpeaking) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(userPulseAnim, { toValue: 1.3, duration: 350, useNativeDriver: true }),
          Animated.timing(userPulseAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
        ])
      ).start();
    } else {
      userPulseAnim.setValue(1);
    }
  }, [isUserSpeaking]);

  // Toggle Camera View
  const handleToggleCamera = async () => {
    if (!isCameraOn) {
      if (!permission?.granted) {
        const res = await requestPermission();
        if (!res.granted) {
          Alert.alert("Permission Required", "Camera access is needed for self video preview.");
          return;
        }
      }
      setIsCameraOn(true);
    } else {
      setIsCameraOn(false);
    }
  };

  // Send User Message in Text Fallback / Audio Mode
  const handleSendMessage = () => {
    if (!inputText.trim()) return;
    const userMsg = inputText.trim();
    setInputText("");

    // Append to transcript
    setTranscript((prev) => [...prev, { role: "user", text: userMsg }]);

    // Send over WS
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "user_message",
          text: userMsg,
        })
      );
    }
  };

  // End Roleplay Session and navigate to Assessment Report
  const handleEndSession = async () => {
    Alert.alert(
      "End Roleplay Session?",
      "Are you ready to submit your conversation for AI evaluation?",
      [
        { text: "Continue Practice", style: "cancel" },
        {
          text: "End & Evaluate",
          style: "destructive",
          onPress: async () => {
            isEndingSessionRef.current = true;
            setIsGeneratingAssessment(true);
            try {
              if (wsRef.current) {
                try {
                  wsRef.current.send(JSON.stringify({ type: "end_session" }));
                  wsRef.current.close();
                } catch {}
              }

              if (sessionId) {
                const result = await finishRoleplaySession(
                  sessionId,
                  transcript,
                  elapsedSeconds
                );

                setIsGeneratingAssessment(false);

                // Navigate directly to RoleplayReportScreen
                navigation.replace(STACK_ROUTES.ROLEPLAY_REPORT as never, {
                  session: result?.session || {
                    id: sessionId,
                    scenario_title: scenario?.title,
                    scenario_role: scenario?.role,
                    conversation_transcript: transcript,
                  },
                  assessment: result?.assessment,
                });
              } else {
                isEndingSessionRef.current = true;
                navigation.goBack();
              }
            } catch (err) {
              logger.error("[RoleplaySession] End session error:", err);
              setIsGeneratingAssessment(false);
              isEndingSessionRef.current = true;
              navigation.goBack();
            }
          },
        },
      ]
    );
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={triggerDoublePressExit} style={styles.iconBtn}>
          <MaterialCommunityIcons name="close" size={24} color="#0F172A" />
        </TouchableOpacity>

        <View style={styles.titleBox}>
          <Text style={styles.scenarioTitle} numberOfLines={1}>
            {scenario?.title || "Roleplay Session"}
          </Text>
          <Text style={styles.roleSubtext}>
            Role: {scenario?.role || "AI Evaluator"}
          </Text>
        </View>

        <View style={styles.timerBadge}>
          <MaterialCommunityIcons name="timer-outline" size={16} color="#6366F1" />
          <Text style={styles.timerText}>{formatTimer(elapsedSeconds)}</Text>
        </View>
      </View>

      {/* Main Avatar & Self Camera Workspace */}
      <View style={styles.avatarSection}>
        <Animated.View
          style={[
            styles.avatarCircle,
            { transform: [{ scale: isUserSpeaking ? userPulseAnim : pulseAnim }] },
            isBotSpeaking && styles.avatarSpeakingBorder,
            isUserSpeaking && styles.avatarUserSpeakingBorder,
          ]}
        >
          <MaterialCommunityIcons
            name={isUserSpeaking ? "microphone" : isBotSpeaking ? "account-voice" : "account"}
            size={44}
            color={isUserSpeaking ? "#EF4444" : isBotSpeaking ? "#6366F1" : "#475569"}
          />
        </Animated.View>

        <Text
          style={[
            styles.botStatusText,
            isUserSpeaking && { color: "#EF4444" },
            isBotSpeaking && { color: "#4F46E5" },
          ]}
        >
          {isConnecting
            ? "Connecting to AI..."
            : isBotSpeaking
            ? "AI Persona Speaking..."
            : isUserSpeaking
            ? "User Speaking..."
            : isMicOn
            ? "Listening for your response..."
            : "Microphone Muted"}
        </Text>

        {/* Self-Camera Preview Window */}
        {isCameraOn && (
          <View style={styles.cameraContainer}>
            <CameraView style={styles.cameraView} facing="front" />
            <TouchableOpacity
              onPress={() => setIsCameraOn(false)}
              style={styles.closeCamBtn}
            >
              <MaterialCommunityIcons name="camera-off" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Conversation Log Transcript */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.transcriptScroll}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {transcript.map((msg, idx) => {
          const isUser = msg.role === "user";
          return (
            <View
              key={idx}
              style={[
                styles.bubble,
                isUser ? styles.userBubble : styles.assistantBubble,
              ]}
            >
              <Text style={[styles.bubbleText, isUser && { color: "#FFFFFF" }]}>
                {msg.text}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      {/* Text Input Row */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.textInput}
          placeholder="Type your response..."
          placeholderTextColor="#94A3B8"
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={handleSendMessage}
        />
        <TouchableOpacity
          onPress={handleSendMessage}
          style={[styles.sendBtn, !inputText.trim() && styles.disabledSendBtn]}
          disabled={!inputText.trim()}
        >
          <MaterialCommunityIcons name="send" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Bottom Controls Bar */}
      <View style={styles.controlsBar}>
        {/* Mute Mic */}
        <TouchableOpacity
          onPress={() => setIsMicOn(!isMicOn)}
          style={[styles.controlBtn, !isMicOn && styles.mutedBtn]}
        >
          <MaterialCommunityIcons
            name={isMicOn ? "microphone" : "microphone-off"}
            size={24}
            color={isMicOn ? "#0F172A" : "#EF4444"}
          />
        </TouchableOpacity>

        {/* Self Camera Toggle */}
        <TouchableOpacity
          onPress={handleToggleCamera}
          style={[styles.controlBtn, isCameraOn && styles.activeCamBtn]}
        >
          <MaterialCommunityIcons
            name={isCameraOn ? "camera" : "camera-off"}
            size={24}
            color={isCameraOn ? "#6366F1" : "#0F172A"}
          />
        </TouchableOpacity>

        {/* End Session Button */}
        <TouchableOpacity
          onPress={handleEndSession}
          style={styles.endSessionBtn}
          disabled={isGeneratingAssessment}
        >
          {isGeneratingAssessment ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <MaterialCommunityIcons name="phone-hangup" size={20} color="#FFFFFF" />
              <Text style={styles.endSessionText}>End Session</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    paddingTop: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  iconBtn: {
    padding: 6,
  },
  titleBox: {
    flex: 1,
    alignItems: "center",
    marginHorizontal: 12,
  },
  scenarioTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  roleSubtext: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  timerBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  timerText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#4F46E5",
    marginLeft: 4,
  },
  avatarSection: {
    alignItems: "center",
    paddingVertical: 20,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  avatarCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
    borderWidth: 3,
    borderColor: "#CBD5E1",
  },
  avatarSpeakingBorder: {
    borderColor: "#6366F1",
    backgroundColor: "#EEF2FF",
  },
  avatarUserSpeakingBorder: {
    borderColor: "#EF4444",
    backgroundColor: "#FEF2F2",
  },
  botStatusText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
  cameraContainer: {
    position: "absolute",
    right: 16,
    top: 16,
    width: 90,
    height: 120,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#6366F1",
    elevation: 4,
  },
  cameraView: {
    flex: 1,
  },
  closeCamBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 4,
    borderRadius: 10,
  },
  transcriptScroll: {
    flex: 1,
    paddingTop: 12,
  },
  bubble: {
    maxWidth: "82%",
    padding: 12,
    borderRadius: 16,
    marginBottom: 10,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#6366F1",
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 14,
    color: "#0F172A",
    lineHeight: 20,
  },
  inputRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    alignItems: "center",
  },
  textInput: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0F172A",
    marginRight: 10,
  },
  sendBtn: {
    backgroundColor: "#6366F1",
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  disabledSendBtn: {
    backgroundColor: "#CBD5E1",
  },
  controlsBar: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  controlBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  mutedBtn: {
    backgroundColor: "#FEF2F2",
  },
  activeCamBtn: {
    backgroundColor: "#EEF2FF",
  },
  endSessionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EF4444",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 25,
  },
  endSessionText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
    marginLeft: 6,
  },
});
