import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ChatInterface, { Message } from './ChatInterface';

/**
 * AIAssistantSection
 *
 * Collapsible card — header always visible.
 *
 * FIX 1 — History persistence: ChatInterface is always mounted (never
 * conditionally removed), only its panel is shown/hidden via display style.
 * This keeps React state alive across collapse/expand cycles.
 *
 * FIX 3 — Scrolling: The chat panel uses a fixed height so it doesn't
 * conflict with the parent ScrollView. ChatInterface owns its own
 * internal ScrollView scoped to that height.
 */
interface AIAssistantSectionProps {
  processedModuleId: string;
  moduleTitle: string;
  userId: string;
  companyId: string;
  isExpanded: boolean;
  onToggle: () => void;
}

export default function AIAssistantSection({
  processedModuleId,
  moduleTitle,
  userId,
  companyId,
  isExpanded,
  onToggle,
}: AIAssistantSectionProps) {
  // History lives HERE so it survives collapse/expand (ChatInterface remounts
  // if parent ever conditionally renders it, but lifting state up is safer).
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
            <MaterialCommunityIcons name="robot-outline" size={18} color="#6366f1" />
          </View>
          <View>
            <Text style={styles.headerTitle}>AI Assistant</Text>
            {!isExpanded && (
              <Text style={styles.headerSubtitle}>Tap to ask a question</Text>
            )}
          </View>
        </View>
        <MaterialCommunityIcons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={22}
          color="#6b7280"
        />
      </TouchableOpacity>

      {/*
        Chat panel — always mounted so state is preserved, but hidden when
        collapsed via display:none equivalent (height:0 + overflow:hidden).
        Using a wrapper View with conditional style avoids unmounting.
      */}
      <View style={[styles.chatPanel, !isExpanded && styles.chatPanelHidden]}>
        <ChatInterface
          processedModuleId={processedModuleId}
          moduleTitle={moduleTitle}
          userId={userId}
          companyId={companyId}
          messages={messages}
          onMessagesChange={setMessages}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    backgroundColor: '#fafafa',
  },
  headerExpanded: {
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 1,
  },
  chatPanel: {
    height: 480,
    backgroundColor: '#fff',
  },
  // Collapses the panel without unmounting ChatInterface
  chatPanelHidden: {
    height: 0,
    overflow: 'hidden',
  },
});