import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface ChatMessageProps {
  message: string;
  isUserMessage: boolean;
}

export default function ChatMessage({ message, isUserMessage }: ChatMessageProps) {
  return (
    <View
      style={[
        styles.container,
        isUserMessage ? styles.userContainer : styles.aiContainer,
      ]}
    >
      {!isUserMessage && (
        <View style={styles.aiAvatarCircle}>
          <MaterialCommunityIcons name="robot" size={20} color="#4F46E5" />
        </View>
      )}
      <View
        style={[
          styles.messageBubble,
          isUserMessage ? styles.userBubble : styles.aiBubble,
        ]}
      >
        <Text
          style={[
            styles.messageText,
            isUserMessage ? styles.userText : styles.aiText,
          ]}
        >
          {message}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    paddingHorizontal: 8,
    flexDirection: "row",
  },
  userContainer: {
    justifyContent: "flex-end",
    alignSelf: "stretch",
  },
  aiContainer: {
    justifyContent: "flex-start",
    alignItems: "flex-end",
    alignSelf: "stretch",
    gap: 8,
  },
  aiAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F5F3FF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EBE9FE",
    marginBottom: 2,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  messageBubble: {
    maxWidth: "80%",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  userBubble: {
    backgroundColor: "#EEF2FF",
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#F1F5F9",
    borderBottomLeftRadius: 4,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
  userText: {
    color: "#312E81",
  },
  aiText: {
    color: "#1E293B",
  },
});
