import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * ChatMessage Component
 * 
 * Displays individual chat messages with different styling for user vs AI messages.
 * User messages appear right-aligned in blue, AI messages left-aligned in gray.
 */
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
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  userContainer: {
    alignItems: 'flex-end',
  },
  aiContainer: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '85%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  userBubble: {
    backgroundColor: '#6366f1',
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: '#f3f4f6',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  userText: {
    color: '#fff',
  },
  aiText: {
    color: '#1f2937',
  },
});
