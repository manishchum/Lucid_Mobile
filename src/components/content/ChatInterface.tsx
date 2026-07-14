import React, { useRef, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform,
  Keyboard,
  KeyboardEvent,
  Animated,
  useWindowDimensions,
  Alert,
  Text,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import ChatMessage from "./ChatMessage";
import { postModuleChat, ModuleChatMessage, getFirebaseToken } from "../../api/users/Request";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";

// ─── Exported so AIAssistantSection can own the state ────────────────────────
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
  // Lifted state — history lives in AIAssistantSection, survives collapse
  messages: Message[];
  onMessagesChange: (updater: (prev: Message[]) => Message[]) => void;
  lang: string;
}

// ─── Typing dots ──────────────────────────────────────────────────────────────
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
          Animated.timing(dot, { toValue: 0,  duration: 300, useNativeDriver: true }),
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

// ─── Greeting placeholder — shown only when no messages yet ──────────────────
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
  wrapper: {
    paddingHorizontal: 8,
    paddingTop: 16,
  },
});

// ─── Main ─────────────────────────────────────────────────────────────────────
const EXPO_API_URL = process.env.EXPO_PUBLIC_API_URL || "https://api.workfloww.ai";

export default function ChatInterface({
  processedModuleId,
  moduleTitle,
  userId,
  companyId,
  messages,
  onMessagesChange,
  lang,
}: ChatInterfaceProps) {
  const [inputText, setInputText] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [keyboardHeight, setKeyboardHeight] = React.useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const hasConversation = messages.length > 0;

  // ── Speech-to-Speech Mode & Playback states ──
  const [speechMode, setSpeechMode] = React.useState(false); // Controls auto-play on bot responses
  const [currentlyPlayingId, setCurrentlyPlayingId] = React.useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  // ── Audio Recording (STT) states ──
  const [isRecording, setIsRecording] = React.useState(false);
  const [recordingDuration, setRecordingDuration] = React.useState(0);
  const [isProcessingVoice, setIsProcessingVoice] = React.useState(false);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingStartRef = useRef<number>(0);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Speech Recognition Events using expo-speech-recognition hooks
  useSpeechRecognitionEvent("start", () => {
    console.log("[Speech] recognition started");
  });

  useSpeechRecognitionEvent("end", () => {
    console.log("[Speech] recognition ended");
  });

  useSpeechRecognitionEvent("error", (e) => {
    console.error("[Speech] recognition error:", e);
    setIsRecording(false);
  });

  useSpeechRecognitionEvent("result", (ev) => {
    if (ev.results && ev.results[0]?.transcript) {
      console.log("[Speech] result:", ev.results[0].transcript);
      setInputText(ev.results[0].transcript);
    }
  });

  // Clean up sound on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
      }
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, []);

  // Timer logic for recording duration
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

    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, [isRecording]);

  // ── Keyboard listeners ──
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e: KeyboardEvent) => {
        setKeyboardHeight(e.endCoordinates.height);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
      },
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboardHeight(0),
    );
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  // ── Auto-scroll on new messages ──
  useEffect(() => {
    if (messages.length === 0) return;
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [messages, isLoading]);

  const mapLangToLocale = (code: string): string => {
    switch (code) {
      case "hi": return "hi-IN";
      case "ta": return "ta-IN";
      case "te": return "te-IN";
      case "mr": return "mr-IN";
      case "bn": return "bn-IN";
      default: return "en-IN";
    }
  };

  // ── Start Audio Recording ──
  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Permission Denied", "Microphone access is required to speak.");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      setInputText("");
      setIsRecording(true);
      setRecordingDuration(0);

      const locale = mapLangToLocale(lang);
      console.log("[Speech] Starting speech recognition for locale:", locale);
      await ExpoSpeechRecognitionModule.start({
        lang: locale,
        interimResults: true,
      });
      recordingStartRef.current = Date.now();
    } catch (err) {
      console.error("[Speech] Failed to start recognition:", err);
      Alert.alert("Error", "Could not start voice recognition.");
      setIsRecording(false);
    }
  };

  // ── Stop Audio Recording ──
  const stopRecording = async () => {
    try {
      await ExpoSpeechRecognitionModule.stop();
    } catch (err) {
      console.error("[Speech] Stop error:", err);
    } finally {
      setIsRecording(false);
      // Wait a short moment for final transcription to settle, then automatically send
      setTimeout(() => {
        handleSend(true);
      }, 500);
    }
  };

  // ── Play/Stop Speech ──
  const playSpeech = async (text: string, messageId: string) => {
    try {
      // If already playing this message, stop it
      if (currentlyPlayingId === messageId) {
        if (soundRef.current) {
          await soundRef.current.stopAsync().catch(() => {});
          await soundRef.current.unloadAsync().catch(() => {});
          soundRef.current = null;
        }
        setCurrentlyPlayingId(null);
        return;
      }

      // If playing another message, stop it first
      if (soundRef.current) {
        await soundRef.current.stopAsync().catch(() => {});
        await soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }

      setCurrentlyPlayingId(messageId);

      const frontendBaseUrl = EXPO_API_URL.replace(":8000", ":3000");
      const ttsUrl = `${frontendBaseUrl}/api/text-to-speech`;
      console.log("[TTS] Requesting speech from:", ttsUrl);

      const response = await fetch(ttsUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text, voiceGender: "female" }),
      });

      if (!response.ok) {
        throw new Error(`TTS failed with status ${response.status}`);
      }

      const data = await response.json();
      const audioBase64 = data.audio;

      if (!audioBase64) {
        throw new Error("No audio returned from TTS");
      }

      const tempFileUri = `${FileSystem.cacheDirectory}tts_audio_${Date.now()}.mp3`;
      await FileSystem.writeAsStringAsync(tempFileUri, audioBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: tempFileUri },
        { shouldPlay: true }
      );
      soundRef.current = sound;

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setCurrentlyPlayingId(null);
          soundRef.current = null;
        }
      });
    } catch (err) {
      console.error("[TTS] Failed to synthesize or play speech:", err);
      setCurrentlyPlayingId(null);
    }
  };

  const handleSend = async (isVoiceInput = false) => {
    // Read input text from latest state.
    const text = inputText.trim();
    if (!text || isLoading) return;

    setInputText("");

    const userMsg: Message = { id: `u-${Date.now()}`, text, isUser: true, isVoice: isVoiceInput };
    onMessagesChange((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const allMessages = [...messages, userMsg];
      const chat_history: ModuleChatMessage[] = allMessages.map((m) => ({
        role: m.isUser ? "user" : "assistant",
        content: m.text,
        isVoice: m.isVoice || false,
      }));

      console.log("[ChatInterface] Sending payload:", {
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

      // If response is result of a voice message, speak it automatically
      if (isVoiceInput) {
        await playSpeech(res.message, assistantMsgId);
      }
    } catch (err) {
      const errText = err instanceof Error ? err.message : "Failed to get a response. Please try again.";
      console.error("[ChatInterface] error:", err);
      onMessagesChange((prev) => [
        ...prev,
        { id: `e-${Date.now()}`, text: `⚠️ ${errText}`, isUser: false },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDuration = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  };

  const canSend = inputText.trim().length > 0 && !isLoading;

  return (
    // FIX 3 — nestedScrollEnabled lets this ScrollView scroll independently
    // inside the parent screen ScrollView on Android. On iOS it works by default.
    <View style={[styles.flex, { paddingBottom: keyboardHeight }]}>
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

      <View style={styles.inputBar}>
        <View style={styles.inputRow}>
          {/* Microphone Button */}
          <TouchableOpacity
            style={[
              styles.micBtn,
              isRecording && styles.micBtnRecording,
            ]}
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
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#ffffff" },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 16, paddingBottom: 8 },
  controlHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    backgroundColor: "#fff",
  },
  controlHeaderText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  toggleBtnActive: {
    borderColor: "#c7d2fe",
    backgroundColor: "#eef2ff",
  },
  toggleBtnText: {
    fontSize: 10,
    color: "#6b7280",
    fontWeight: "600",
  },
  toggleBtnTextActive: {
    color: "#6366f1",
  },
  aiMessageRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingRight: 40,
  },
  aiMessageContent: {
    flexShrink: 1,
  },
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
  micBtnRecording: {
    backgroundColor: "#FEE2E2",
  },
  micBtnDisabled: {
    opacity: 0.5,
  },
  processingVoiceRow: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 6,
    backgroundColor: "#eff6ff",
    borderRadius: 8,
    alignItems: "center",
  },
  processingVoiceText: {
    fontSize: 12,
    color: "#1d4ed8",
    fontWeight: "500",
  },
});