import React, { useRef, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform,
  Keyboard,
  Animated,
  Easing,
  Alert,
  Text,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import ChatMessage from "./ChatMessage";
import { postModuleChat, ModuleChatMessage, getFirebaseToken } from "../../api/users/Request";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";

// --- Exported so AIAssistantSection can own the state ------------------------
export interface Message {
  id: string;
  text: string;
  isUser: boolean;
  isVoice?: boolean;
}

interface ChatInterfaceProps {
  processedModuleId: string;
  moduleTitle: string;
  userId: string;
  companyId: string;
  messages: Message[];
  onMessagesChange: (updater: (prev: Message[]) => Message[]) => void;
  lang: string;
  onInputFocus?: () => void;
}

// --- Voice state type --------------------------------------------------------
type VoiceState = "idle" | "listening" | "processing" | "speaking";

// --- Typing dots --------------------------------------------------------------
function TypingIndicator() {
  const dot0 = useRef(new Animated.Value(0)).current;
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const bounce = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: -6, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay(600 - delay),
        ]),
      );
    const a0 = bounce(dot0, 0);
    const a1 = bounce(dot1, 150);
    const a2 = bounce(dot2, 300);
    a0.start(); a1.start(); a2.start();
    return () => { a0.stop(); a1.stop(); a2.stop(); };
  }, []);

  return (
    <View style={ti.wrapper}>
      <View style={ti.bubble}>
        {[dot0, dot1, dot2].map((dot, i) => (
          <Animated.View key={i} style={[ti.dot, { transform: [{ translateY: dot }] }]} />
        ))}
      </View>
    </View>
  );
}

const ti = StyleSheet.create({
  wrapper: { alignItems: "flex-start", paddingHorizontal: 12, marginBottom: 8 },
  bubble: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#f3f4f6", borderRadius: 18, borderBottomLeftRadius: 4,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: "#4F46E5" },
});

// --- Greeting placeholder -----------------------------------------------------
function EmptyGreeting({ moduleTitle }: { moduleTitle: string }) {
  return (
    <View style={eg.wrapper}>
      <ChatMessage
        message={`Hello! I'm ready to help you understand the ${moduleTitle} module. Ask me anything covered in this module.`}
        isUserMessage={false}
      />
    </View>
  );
}

const eg = StyleSheet.create({
  wrapper: { paddingHorizontal: 8, paddingTop: 16 },
});

// --- Voice Mode Status Display ------------------------------------------------
function VoiceModeDisplay({
  voiceState,
  pulseAnim,
  onToggleOff,
}: {
  voiceState: VoiceState;
  pulseAnim: Animated.Value;
  onToggleOff: () => void;
}) {
  const label =
    voiceState === "listening" ? "Listening..." :
    voiceState === "processing" ? "Thinking..." :
    voiceState === "speaking" ? "Speaking..." :
    "Tap mic to start";

  const iconName: React.ComponentProps<typeof MaterialCommunityIcons>["name"] =
    voiceState === "listening" ? "microphone" :
    voiceState === "processing" ? "brain" :
    voiceState === "speaking" ? "volume-high" :
    "microphone-outline";

  const iconColor =
    voiceState === "listening" ? "#EF4444" :
    voiceState === "processing" ? "#F59E0B" :
    voiceState === "speaking" ? "#10B981" :
    "#4F46E5";

  const scale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });
  const opacity = pulseAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.4, 0.15, 0.0] });

  return (
    <View style={vm.container}>
      <View style={vm.micWrapper}>
        <Animated.View
          style={[
            vm.pulseRing,
            {
              transform: [{ scale }],
              opacity,
              backgroundColor:
                voiceState === "listening" ? "#FEE2E2" :
                voiceState === "speaking" ? "#D1FAE5" : "#E0E7FF",
            },
          ]}
        />
        <View
          style={[
            vm.micCircle,
            voiceState === "listening" && vm.micCircleListening,
            voiceState === "speaking" && vm.micCircleSpeaking,
            voiceState === "processing" && vm.micCircleProcessing,
          ]}
        >
          <MaterialCommunityIcons name={iconName} size={30} color={iconColor} />
        </View>
      </View>
      <Text style={vm.label}>{label}</Text>
      <TouchableOpacity style={vm.exitBtn} onPress={onToggleOff} activeOpacity={0.8}>
        <MaterialCommunityIcons name="keyboard-outline" size={15} color="#6B7280" />
        <Text style={vm.exitBtnText}>Switch to text</Text>
      </TouchableOpacity>
    </View>
  );
}

const vm = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 16,
    backgroundColor: "#FAFBFF",
    borderTopWidth: 1,
    borderTopColor: "#E8EEFF",
  },
  micWrapper: {
    width: 90, height: 90,
    alignItems: "center", justifyContent: "center",
    marginBottom: 14,
  },
  pulseRing: {
    position: "absolute",
    width: 90, height: 90, borderRadius: 45,
  },
  micCircle: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: "#EEF2FF",
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#C7D2FE",
  },
  micCircleListening: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  micCircleSpeaking: { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" },
  micCircleProcessing: { backgroundColor: "#FFFBEB", borderColor: "#FDE68A" },
  label: {
    fontSize: 15, fontWeight: "600", color: "#374151",
    marginBottom: 14, letterSpacing: 0.2,
  },
  exitBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, backgroundColor: "#F3F4F6",
    borderWidth: 1, borderColor: "#E5E7EB",
  },
  exitBtnText: { fontSize: 13, color: "#6B7280", fontWeight: "500" },
});

// --- Main Component -----------------------------------------------------------
const EXPO_API_URL = process.env.EXPO_PUBLIC_API_URL || "https://api.workfloww.ai";

export default function ChatInterface({
  processedModuleId,
  moduleTitle,
  userId,
  companyId,
  messages,
  onMessagesChange,
  lang,
  onInputFocus,
}: ChatInterfaceProps) {
  const [inputText, setInputText] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const hasConversation = messages.length > 0;

  // -- Speech-to-Speech Mode --
  const [speechMode, setSpeechMode] = React.useState(false);
  const [voiceState, setVoiceState] = React.useState<VoiceState>("idle");
  const [currentlyPlayingId, setCurrentlyPlayingId] = React.useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  // Pulse animation for voice mode mic circle
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  // -- STT state --
  const [isRecording, setIsRecording] = React.useState(false);
  const [recordingDuration, setRecordingDuration] = React.useState(0);
  const recordingStartRef = useRef<number>(0);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // -- Speech Recognition Events --
  useSpeechRecognitionEvent("start", () => console.log("[Speech] recognition started"));
  useSpeechRecognitionEvent("end", () => console.log("[Speech] recognition ended"));
  useSpeechRecognitionEvent("error", (e) => {
    console.error("[Speech] recognition error:", e);
    setIsRecording(false);
    if (speechMode) setVoiceState("idle");
  });
  useSpeechRecognitionEvent("result", (ev) => {
    if (ev.results && ev.results[0]?.transcript) {
      setInputText(ev.results[0].transcript);
    }
  });

  // -- Pulse animation --
  useEffect(() => {
    const shouldPulse = speechMode && (voiceState === "listening" || voiceState === "speaking");
    if (shouldPulse) {
      pulseLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1, duration: 900,
            easing: Easing.out(Easing.ease), useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
        ]),
      );
      pulseLoopRef.current.start();
    } else {
      pulseLoopRef.current?.stop();
      pulseAnim.setValue(0);
    }
    return () => { pulseLoopRef.current?.stop(); };
  }, [speechMode, voiceState]);

  // -- Cleanup on unmount --
  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    };
  }, []);

  // -- Recording duration timer --
  useEffect(() => {
    if (!isRecording) {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      return;
    }
    recordingStartRef.current = Date.now();
    recordingIntervalRef.current = setInterval(() => {
      setRecordingDuration(Date.now() - recordingStartRef.current);
    }, 100);
    return () => { if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current); };
  }, [isRecording]);

  // -- Keyboard listeners --
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => {
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
      },
    );
    return () => { showSub.remove(); };
  }, []);

  // -- Auto-scroll --
  useEffect(() => {
    if (messages.length === 0) return;
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [messages, isLoading]);

  const mapLangToLocale = (code: string): string => {
    switch (code?.toLowerCase()) {
      case "hi":
      case "hindi":
      case "hinglish":
        return "hi-IN";
      case "ta":
        return "ta-IN";
      case "te":
        return "te-IN";
      case "mr":
        return "mr-IN";
      case "bn":
        return "bn-IN";
      default:
        return "en-IN";
    }
  };

  // -- Toggle Voice Mode --
  const toggleSpeechMode = async () => {
    if (speechMode) {
      if (isRecording) {
        try { await ExpoSpeechRecognitionModule.stop(); } catch {}
        setIsRecording(false);
      }
      if (soundRef.current) {
        await soundRef.current.stopAsync().catch(() => {});
        await soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
      setCurrentlyPlayingId(null);
      setVoiceState("idle");
      setSpeechMode(false);
    } else {
      setSpeechMode(true);
      setTimeout(() => startRecording(), 200);
    }
  };

  // -- Start Recording --
  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Permission Denied", "Microphone access is required to speak.");
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      setInputText("");
      setIsRecording(true);
      setRecordingDuration(0);
      setVoiceState("listening");
      const locale = mapLangToLocale(lang);
      console.log("[Speech] Starting recognition with auto language detection for locale:", locale);
      await ExpoSpeechRecognitionModule.start({
        lang: locale,
        interimResults: true,
        androidIntentOptions: {
          EXTRA_ENABLE_LANGUAGE_DETECTION: true,
          EXTRA_ENABLE_LANGUAGE_SWITCH: "balanced",
          EXTRA_LANGUAGE_DETECTION_ALLOWED_LANGUAGES: ["en-IN", "hi-IN", "en-US"],
          EXTRA_LANGUAGE_SWITCH_ALLOWED_LANGUAGES: ["en-IN", "hi-IN", "en-US"],
        },
      });
      recordingStartRef.current = Date.now();
    } catch (err) {
      console.error("[Speech] Failed to start recognition:", err);
      Alert.alert("Error", "Could not start voice recognition.");
      setIsRecording(false);
      setVoiceState("idle");
    }
  };

  // -- Stop Recording --
  const stopRecording = async () => {
    try {
      await ExpoSpeechRecognitionModule.stop();
    } catch (err) {
      console.error("[Speech] Stop error:", err);
    } finally {
      setIsRecording(false);
      setVoiceState("processing");
      setTimeout(() => handleSend(true), 500);
    }
  };

  // -- Play/Stop TTS --
  const playSpeech = async (text: string, messageId: string) => {
    try {
      if (currentlyPlayingId === messageId) {
        if (soundRef.current) {
          await soundRef.current.stopAsync().catch(() => {});
          await soundRef.current.unloadAsync().catch(() => {});
          soundRef.current = null;
        }
        setCurrentlyPlayingId(null);
        if (speechMode) setVoiceState("idle");
        return;
      }
      if (soundRef.current) {
        await soundRef.current.stopAsync().catch(() => {});
        await soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }

      setCurrentlyPlayingId(messageId);
      if (speechMode) setVoiceState("speaking");

      const ttsUrl = `${EXPO_API_URL}/api/tts`;
      console.log("[TTS] Requesting speech from:", ttsUrl);

      const token = await getFirebaseToken().catch(() => null);

      const response = await fetch(ttsUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text, voiceGender: "female" }),
      });

      if (!response.ok) throw new Error(`TTS failed with status ${response.status}`);

      const data = await response.json();
      const audioBase64 = data.audio;
      if (!audioBase64) throw new Error("No audio returned from TTS");

      const tempFileUri = `${FileSystem.cacheDirectory}tts_audio_${Date.now()}.mp3`;
      await FileSystem.writeAsStringAsync(tempFileUri, audioBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });

      const { sound } = await Audio.Sound.createAsync({ uri: tempFileUri }, { shouldPlay: true });
      soundRef.current = sound;

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setCurrentlyPlayingId(null);
          soundRef.current = null;
          if (speechMode) {
            setVoiceState("idle");
            setTimeout(() => startRecording(), 400);
          }
        }
      });
    } catch (err) {
      console.error("[TTS] Failed:", err);
      setCurrentlyPlayingId(null);
      if (speechMode) {
        setVoiceState("idle");
        setTimeout(() => startRecording(), 800);
      }
    }
  };

  // -- Send Message --
  const handleSend = async (isVoiceInput = false) => {
    const text = inputText.trim();
    if (!text || isLoading) return;

    setInputText("");
    const userMsg: Message = { id: `u-${Date.now()}`, text, isUser: true, isVoice: isVoiceInput };
    onMessagesChange((prev) => [...prev, userMsg]);
    setIsLoading(true);
    if (isVoiceInput && speechMode) setVoiceState("processing");

    try {
      const allMessages = [...messages, userMsg];
      const chat_history: ModuleChatMessage[] = allMessages.map((m) => ({
        role: m.isUser ? "user" : "assistant",
        content: m.text,
        isVoice: m.isVoice || false,
      }));

      console.log("[ChatInterface] Sending:", {
        processed_module_id: processedModuleId,
        user_message: text,
        user_id: userId,
        company_id: companyId,
        chat_history_length: chat_history.length,
      });

      const res = await postModuleChat({
        processed_module_id: processedModuleId,
        user_message: text,
        chat_history,
        user_id: userId,
        company_id: companyId,
      });

      if (!res.success) throw new Error(res.message || "API returned failure");

      const assistantMsgId = `a-${Date.now()}`;
      onMessagesChange((prev) => [
        ...prev,
        { id: assistantMsgId, text: res.message, isUser: false },
      ]);

      if (isVoiceInput || speechMode) {
        await playSpeech(res.message, assistantMsgId);
      }
    } catch (err) {
      const errText = err instanceof Error ? err.message : "Failed to get a response. Please try again.";
      console.error("[ChatInterface] error:", err);
      onMessagesChange((prev) => [
        ...prev,
        { id: `e-${Date.now()}`, text: `?? ${errText}`, isUser: false },
      ]);
      if (speechMode) {
        setVoiceState("idle");
        setTimeout(() => startRecording(), 800);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const formatDuration = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  };

  const canSend = inputText.trim().length > 0 && !isLoading;

  return (
    <View style={styles.flex}>
      {/* -- Messages -- */}
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
      >
        {!hasConversation ? (
          <EmptyGreeting moduleTitle={moduleTitle} />
        ) : (
          messages.map((msg) => (
            <View key={msg.id} style={msg.isUser ? null : styles.aiMessageRow}>
              <View style={msg.isUser ? null : styles.aiMessageContent}>
                <ChatMessage message={msg.text} isUserMessage={msg.isUser} />
              </View>
              {!msg.isUser && (
                <TouchableOpacity
                  style={styles.speakerBtn}
                  onPress={() => playSpeech(msg.text, msg.id)}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons
                    name={currentlyPlayingId === msg.id ? "volume-high" : "volume-mute"}
                    size={18}
                    color="#4F46E5"
                  />
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
        {isLoading && <TypingIndicator />}
      </ScrollView>

      {/* -- Input Area -- */}
      {speechMode ? (
        <VoiceModeDisplay
          voiceState={voiceState}
          pulseAnim={pulseAnim}
          onToggleOff={toggleSpeechMode}
        />
      ) : (
        <View style={styles.inputBar}>
          <View style={styles.inputRow}>
            <TouchableOpacity
              style={[styles.micBtn, isRecording && styles.micBtnRecording]}
              onPress={isRecording ? stopRecording : startRecording}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name={isRecording ? "stop" : "microphone"}
                size={20}
                color={isRecording ? "#EF4444" : "#4F46E5"}
              />
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              placeholder={
                isRecording
                  ? `Recording... ${formatDuration(recordingDuration)}`
                  : "Ask a follow-up question..."
              }
              placeholderTextColor={isRecording ? "#ef4444" : "#94A3B8"}
              value={isRecording ? "" : inputText}
              onChangeText={setInputText}
              onFocus={onInputFocus}
              multiline
              maxLength={1000}
              editable={!isLoading && !isRecording}
              blurOnSubmit={false}
            />

            <TouchableOpacity
              style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
              onPress={() => handleSend(false)}
              disabled={!canSend || isRecording}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name="send"
                size={18}
                color={canSend ? "#fff" : "#94A3B8"}
              />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#ffffff" },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 16, paddingBottom: 8 },
  aiMessageRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingRight: 40,
  },
  aiMessageContent: { flexShrink: 1 },
  speakerBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "#f0f2fe",
    marginLeft: 2,
    alignSelf: "center",
    marginBottom: 12,
  },
  inputBar: {
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FAFAFA",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingLeft: 4,
    paddingRight: 6,
    paddingVertical: 6,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: "#1e293b",
    maxHeight: 100,
    paddingVertical: 8,
    paddingHorizontal: 8,
    lineHeight: 18,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#4F46E5",
    justifyContent: "center",
    alignItems: "center",
  },
  sendBtnDisabled: { backgroundColor: "#E2E8F0" },
  micBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },
  micBtnRecording: { backgroundColor: "#FEE2E2" },
});
