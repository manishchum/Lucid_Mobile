import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ExpandableSection from './ExpandableSection';

interface VisualGuideSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
}

export default function VisualGuideSection({
  isExpanded,
  onToggle,
}: VisualGuideSectionProps) {
  // Dummy visual guide sections
  const guideSections = [
    {
      id: '1',
      title: 'LLM Architecture Overview',
      description: 'Understanding the transformer model',
      icon: 'cube-outline',
    },
    {
      id: '2',
      title: 'Prompt Engineering Flow',
      description: 'Step-by-step workflow diagram',
      icon: 'flow-tree',
    },
    {
      id: '3',
      title: 'PICF Framework Visual',
      description: 'Components of effective prompts',
      icon: 'palette',
    },
    {
      id: '4',
      title: 'Temperature vs Creativity',
      description: 'Understanding model parameters',
      icon: 'thermometer',
    },
  ];

  const sections = [
    {
      title: 'Visual Guide',
      content: (
        <View style={styles.guideContainer}>
          <ScrollView
            style={styles.guidesScroll}
            showsVerticalScrollIndicator={false}
          >
            {guideSections.map((section) => (
              <GuideCard key={section.id} section={section} />
            ))}
          </ScrollView>
        </View>
      ),
    },
  ];

  return (
    <ExpandableSection
      icon="image"
      title="Visual Guide"
      subtitle="Structured overview with diagrams."
      isExpanded={isExpanded}
      onToggle={onToggle}
      sections={sections}
    />
  );
}

function GuideCard({
  section,
}: {
  section: {
    id: string;
    title: string;
    description: string;
    icon: string;
  };
}) {
  return (
    <TouchableOpacity style={styles.guideCard} activeOpacity={0.7}>
      <View style={styles.guideCardContent}>
        <View style={styles.guideIconContainer}>
          <MaterialCommunityIcons
            name={section.icon as any}
            size={28}
            color="#6366f1"
          />
        </View>
        <View style={styles.guideInfo}>
          <Text style={styles.guideTitle}>{section.title}</Text>
          <Text style={styles.guideDescription}>{section.description}</Text>
        </View>
        <MaterialCommunityIcons
          name="chevron-right"
          size={20}
          color="#d1d5db"
        />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  guideContainer: {
    maxHeight: 300,
  },
  guidesScroll: {
    gap: 8,
  },
  guideCard: {
    marginBottom: 8,
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  guideCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 12,
  },
  guideIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#f0f4ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  guideInfo: {
    flex: 1,
  },
  guideTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
  },
  guideDescription: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
});
