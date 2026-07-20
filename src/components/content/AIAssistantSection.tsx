import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ChatInterface, { Message } from './ChatInterface';

interface AIAssistantSectionProps {
  processedModuleId: string;
  moduleTitle: string;
  userId: string;
  companyId: string;
  isExpanded: boolean;
  onToggle: () => void;
  lang: string;
}

export default function AIAssistantSection({
  processedModuleId,
  moduleTitle,
  userId,
  companyId,
  isExpanded,
  onToggle,
  lang,
}: AIAssistantSectionProps) {
  const [messages, setMessages] = useState<Message[]>([]);

  return (
    <View style={styles.container}>
      {/* Header — always visible */}
      <TouchableOpacity
        style={[styles.header, isExpanded && styles.headerExpanded]}
        onPress={onToggle}
        activeOpacity={0.8}
      >
        <View style={styles.headerLeft}>
          <View style={styles.iconBadge}>
            <MaterialCommunityIcons name="creation" size={22} color="#4F46E5" />
          </View>
          <View>
            <Text style={styles.headerTitle}>AI Assistant</Text>
          </View>
        </View>
        <MaterialCommunityIcons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={24}
          color="#94A3B8"
        />
      </TouchableOpacity>

      {/* Chat panel */}
      <View style={[styles.chatPanel, !isExpanded && styles.chatPanelHidden]}>
        <ChatInterface
          processedModuleId={processedModuleId}
          moduleTitle={moduleTitle}
          userId={userId}
          companyId={companyId}
          messages={messages}
          onMessagesChange={setMessages}
          lang={lang}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 20, // Matches the rounded card style in the mockup
    borderColor: '#F1F5F9',
    overflow: 'hidden',
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
  },
  headerExpanded: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F5F3FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  chatPanel: {
    height: 480,
    backgroundColor: '#ffffff',
  },
  chatPanelHidden: {
    height: 0,
    overflow: 'hidden',
  },
});