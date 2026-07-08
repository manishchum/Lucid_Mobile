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
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: "#6366f1" },
});

// ─── Greeting placeholder — shown only when no messages yet ──────────────────
function EmptyGreeting({ moduleTitle }: { moduleTitle: string }) {
  return (
    <View style={eg.wrapper}>
      <View style={eg.iconRing}>
        <MaterialCommunityIcons name="robot-outline" size={28} color="#6366f1" />
      </View>
      <View style={eg.bubble}>
        <ChatMessage
          message={`Hello! I'm ready to help you understand the ${moduleTitle} module. Ask me anything covered in this module.`}
          isUserMessage={false}
        />
      </View>
    </View>
  );
}

const eg = StyleSheet.create({
  wrapper: { flex: 1, justifyContent: "center", paddingHorizontal: 4, paddingBottom: 16 },
  iconRing: {
    alignSelf: "flex-start",
    marginLeft: 12,
    marginBottom: 4,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#eef2ff",
    justifyContent: "center",
    alignItems: "center",
  },
  bubble: { alignSelf: "stretch" },
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

  // Clean up sound and recording on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
      }
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
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

  // ── Start Audio Recording ──
  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Permission Denied", "Microphone access is required to record voice.");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      recordingStartRef.current = Date.now();
      setIsRecording(true);
      setRecordingDuration(0);
    } catch (err) {
      console.error("Failed to start recording:", err);
      Alert.alert("Error", "Could not start microphone recording.");
    }
  };

  // ── Stop Audio Recording ──
  const stopRecording = async () => {
    if (!recordingRef.current) return;
    setIsRecording(false);
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      if (uri) {
        await transcribeAudio(uri);
      }
    } catch (err) {
      console.error("Failed to stop recording:", err);
    }
  };

  // ── Upload Audio and Transcribe ──
  const transcribeAudio = async (uri: string) => {
    setIsProcessingVoice(true);
    try {
      const token = await getFirebaseToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const uploadUrl = `${EXPO_API_URL}/api/speech-to-text`;
      console.log("[STT] Uploading audio file to:", uploadUrl);

      const uploadResult = await FileSystem.uploadAsync(uploadUrl, uri, {
        fieldName: "audio",
        httpMethod: "POST",
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        headers,
      });

      if (uploadResult.status < 200 || uploadResult.status >= 300) {
        throw new Error(`Upload failed with status ${uploadResult.status}: ${uploadResult.body}`);
      }

      const data = JSON.parse(uploadResult.body);
      const text = data.text?.trim();
      if (text) {
        console.log("[STT] Transcription success:", text);
        await sendTranscribedText(text);
      } else {
        Alert.alert("Speech Recognition", "Could not understand any speech. Please try again.");
      }
    } catch (err: any) {
      console.error("[STT] Error transcribing audio:", err);
      Alert.alert("Transcription Failed", err.message || "Failed to transcribe audio.");
    } finally {
      setIsProcessingVoice(false);
    }
  };

  // ── Send Voice Message ──
  const sendTranscribedText = async (text: string) => {
    setInputText("");
    const userMsg: Message = { id: `u-${Date.now()}`, text, isUser: true, isVoice: true };
    onMessagesChange((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const allMessages = [...messages, userMsg];
      const chat_history: ModuleChatMessage[] = allMessages.map((m) => ({
        role: m.isUser ? "user" : "assistant",
        content: m.text,
        isVoice: m.isVoice || false,
      }));

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

      // If speechMode is enabled, play the reply automatically!
      if (speechMode) {
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
        body: JSON.stringify({ text }),
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

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isLoading) return;

    setInputText("");

    const userMsg: Message = { id: `u-${Date.now()}`, text, isUser: true, isVoice: false };
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
      {/* Speech Mode Toggle Bar */}
      <View style={styles.controlHeader}>
        <Text style={styles.controlHeaderText}>Speech Mode</Text>
        <TouchableOpacity
          onPress={() => setSpeechMode(!speechMode)}
          style={[styles.toggleBtn, speechMode && styles.toggleBtnActive]}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons
            name={speechMode ? "volume-high" : "volume-mute"}
            size={16}
            color={speechMode ? "#6366f1" : "#9ca3af"}
          />
          <Text style={[styles.toggleBtnText, speechMode && styles.toggleBtnTextActive]}>
            {speechMode ? "Auto-Play ON" : "Auto-Play OFF"}
          </Text>
        </TouchableOpacity>
      </View>

      {hasConversation ? (
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true}
        >
          {messages.map((msg) => (
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
                    color="#6366f1"
                  />
                </TouchableOpacity>
              )}
            </View>
          ))}
          {isLoading && <TypingIndicator />}
        </ScrollView>
      ) : (
        // FIX 2 — greeting shown only while no messages; hidden once chat starts
        <EmptyGreeting moduleTitle={moduleTitle} />
      )}

      <View style={styles.inputBar}>
        {isProcessingVoice && (
          <View style={styles.processingVoiceRow}>
            <Text style={styles.processingVoiceText}>Transcribing your voice...</Text>
          </View>
        )}
        <View style={styles.inputRow}>
          {/* Microphone Button */}
          <TouchableOpacity
            style={[
              styles.micBtn,
              isRecording && styles.micBtnRecording,
              isProcessingVoice && styles.micBtnDisabled,
            ]}
            onPress={isRecording ? stopRecording : startRecording}
            disabled={isProcessingVoice}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name={isRecording ? "stop" : "microphone"}
              size={20}
              color="#fff"
            />
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            placeholder={
              isRecording
                ? `Recording... ${formatDuration(recordingDuration)}`
                : "Ask anything about this module..."
            }
            placeholderTextColor={isRecording ? "#ef4444" : "#9ca3af"}
            value={isRecording ? "" : inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1000}
            editable={!isLoading && !isRecording && !isProcessingVoice}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!canSend || isRecording || isProcessingVoice}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#fff" },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 12, paddingBottom: 8 },
  controlHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    backgroundColor: "#f9fafb",
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
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: "#f3f4f6",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingLeft: 8,
    paddingRight: 6,
    paddingVertical: 6,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: "#1f2937",
    maxHeight: 100,
    paddingVertical: 4,
    lineHeight: 20,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#6366f1",
    justifyContent: "center",
    alignItems: "center",
  },
  sendBtnDisabled: { backgroundColor: "#d1d5db" },
  micBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#6366f1",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "flex-end",
  },
  micBtnRecording: {
    backgroundColor: "#ef4444",
  },
  micBtnDisabled: {
    backgroundColor: "#d1d5db",
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