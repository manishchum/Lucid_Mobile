import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface SectionContent {
  title: string;
  content: React.ReactNode;
}

interface ExpandableSectionProps {
  icon: string;
  title: string;
  subtitle: string;
  isExpanded: boolean;
  onToggle: () => void;
  sections: SectionContent[];
}

export default function ExpandableSection({
  icon,
  title,
  subtitle,
  isExpanded,
  onToggle,
  sections,
}: ExpandableSectionProps) {
  return (
    <View style={styles.container}>
      {/* Section Header */}
      <TouchableOpacity
        onPress={onToggle}
        style={styles.header}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons
              name={icon as any}
              size={20}
              color="#6366f1"
            />
          </View>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
        </View>
        <MaterialCommunityIcons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={24}
          color="#6b7280"
        />
      </TouchableOpacity>

      {/* Expanded Content */}
      {isExpanded && (
        <View style={styles.content}>
          {sections.map((section, index) => (
            <View key={index} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <View style={styles.sectionContent}>{section.content}</View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#f9fafb',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f0f4ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: '#9ca3af',
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    gap: 12,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1f2937',
    marginTop: 4,
  },
  sectionContent: {
    gap: 0,
  },
});
