import React, { useState, useEffect, useRef } from "react";
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
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";

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
        const sessionRes = await createRoleplaySession(employeeId, scenario.scenario_id);
        const createdSessionId = sessionRes?.id || `sess_${Date.now()}`;
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
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "transcript" || data.text) {
              const botText = data.transcript || data.text;
              if (botText && isMounted) {
                setTranscript((prev) => [...prev, { role: "assistant", text: botText }]);
              }
            }
            if (data.type === "audio_start") {
              if (isMounted) setIsBotSpeaking(true);
            }
            if (data.type === "audio_end") {
              if (isMounted) setIsBotSpeaking(false);
            }
          } catch (e) {
            // Raw text fallback
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
                navigation.goBack();
              }
            } catch (err) {
              logger.error("[RoleplaySession] End session error:", err);
              setIsGeneratingAssessment(false);
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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
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
            { transform: [{ scale: pulseAnim }] },
            isBotSpeaking && styles.avatarSpeakingBorder,
          ]}
        >
          <MaterialCommunityIcons
            name="account-voice"
            size={44}
            color={isBotSpeaking ? "#6366F1" : "#475569"}
          />
        </Animated.View>

        <Text style={styles.botStatusText}>
          {isConnecting
            ? "Connecting to AI..."
            : isBotSpeaking
            ? "AI Persona Speaking..."
            : "Listening for your response..."}
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
