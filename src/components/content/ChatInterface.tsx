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
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import ChatMessage from "./ChatMessage";
import { postModuleChat, ModuleChatMessage } from "../../api/users/Request";

// ─── Exported so AIAssistantSection can own the state ────────────────────────
export interface Message {
  id: string;
  text: string;
  isUser: boolean;
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

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isLoading) return;

    setInputText("");

    const userMsg: Message = { id: `u-${Date.now()}`, text, isUser: true };
    onMessagesChange((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const allMessages = [...messages, userMsg];
      const chat_history: ModuleChatMessage[] = allMessages.map((m) => ({
        role: m.isUser ? "user" : "assistant",
        content: m.text,
        isVoice: false,
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

      onMessagesChange((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, text: res.message, isUser: false },
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

  const canSend = inputText.trim().length > 0 && !isLoading;

  return (
    // FIX 3 — nestedScrollEnabled lets this ScrollView scroll independently
    // inside the parent screen ScrollView on Android. On iOS it works by default.
    <View style={[styles.flex, { paddingBottom: keyboardHeight }]}>
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
            <ChatMessage key={msg.id} message={msg.text} isUserMessage={msg.isUser} />
          ))}
          {isLoading && <TypingIndicator />}
        </ScrollView>
      ) : (
        // FIX 2 — greeting shown only while no messages; hidden once chat starts
        <EmptyGreeting moduleTitle={moduleTitle} />
      )}

      <View style={styles.inputBar}>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Ask anything about this module..."
            placeholderTextColor="#9ca3af"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1000}
            editable={!isLoading}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!canSend}
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
    paddingLeft: 14,
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
});