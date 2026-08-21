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
  sprintModuleId?: string;
  moduleTitle: string;
  sprintTitle?: string;
  userId: string;
  companyId: string;
  isExpanded: boolean;
  onToggle: () => void;
  lang: string;
  onInputFocus?: () => void;
}

export default function AIAssistantSection({
  processedModuleId,
  sprintModuleId,
  moduleTitle,
  sprintTitle,
  userId,
  companyId,
  isExpanded,
  onToggle,
  lang,
  onInputFocus,
}: AIAssistantSectionProps) {
  const [chatMode, setChatMode] = useState<"module" | "sprint">("module");
  const [moduleMessages, setModuleMessages] = useState<Message[]>([]);
  const [sprintMessages, setSprintMessages] = useState<Message[]>([]);

  const currentMessages = chatMode === "module" ? moduleMessages : sprintMessages;
  const setMessages = chatMode === "module" ? setModuleMessages : setSprintMessages;

  const showModeSwitch = Boolean(sprintModuleId || sprintTitle);

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
          <View style={styles.titleWrap}>
            <Text style={styles.headerTitle}>AI Assistant</Text>
            {/* <Text style={styles.headerSubtitle}>
              {chatMode === "module"
                ? `Module: ${moduleTitle}`
                : `Sprint: ${sprintTitle || "Full Sprint"}`}
            </Text> */}
          </View>
        </View>

        <MaterialCommunityIcons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={24}
          color="#94A3B8"
        />
      </TouchableOpacity>

      {/* Mode Switcher Bar */}
      {isExpanded && showModeSwitch && (
        <View style={styles.modeToggleContainer}>
          <TouchableOpacity
            style={[styles.modeTab, chatMode === "module" && styles.modeTabActive]}
            onPress={() => setChatMode("module")}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name="book-open-outline"
              size={15}
              color={chatMode === "module" ? "#FFFFFF" : "#64748B"}
            />
            <Text
              style={[
                styles.modeTabText,
                chatMode === "module" && styles.modeTabTextActive,
              ]}
            >
              Module Chat
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeTab, chatMode === "sprint" && styles.modeTabActive]}
            onPress={() => setChatMode("sprint")}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name="lightning-bolt-outline"
              size={15}
              color={chatMode === "sprint" ? "#FFFFFF" : "#64748B"}
            />
            <Text
              style={[
                styles.modeTabText,
                chatMode === "sprint" && styles.modeTabTextActive,
              ]}
            >
              Sprint Chat
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Chat panel */}
      <View style={[styles.chatPanel, !isExpanded && styles.chatPanelHidden]}>
        <ChatInterface
          chatMode={chatMode}
          processedModuleId={processedModuleId}
          sprintModuleId={sprintModuleId}
          moduleTitle={moduleTitle}
          sprintTitle={sprintTitle}
          userId={userId}
          companyId={companyId}
          messages={currentMessages}
          onMessagesChange={setMessages}
          lang={lang}
          onInputFocus={onInputFocus}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
  },
  headerExpanded: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F5F3FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 1,
  },
  modeToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 3,
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 2,
    // borderWidth: 0.5,
    // borderColor: '#E2E8F0',
  },
  modeTab: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  modeTabActive: {
    backgroundColor: '#4F46E5',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    // elevation: 1,
  },
  modeTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  modeTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
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