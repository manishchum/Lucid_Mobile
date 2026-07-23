import { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Keyboard, Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useGetProcessedModules } from '../../api/users';
import { useAuth } from '../../contex/AuthContext';
import CoreContentSection from './sections/CoreContentSection';
import PodcastSection from './sections/PodcastSection';
import FlashcardsSection from '../../components/content/FlashcardsSection';
import MindmapSection from '../../components/content/MindmapSection';
import VideoSection from '../../components/content/VideoSection';
import AIAssistantSection from '../../components/content/AIAssistantSection';
import { useModuleTranslation } from '../../hooks/useModuleTranslation';
import ModuleLanguageSelector from '../../components/content/ModuleLanguageSelector';

export default function ContentDetailScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const mainScrollRef = useRef<ScrollView>(null);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [expanded, setExpanded] = useState<string | null>('core');
  const [lang, setLang] = useState<string>('en');

  // Keyboard offset listener
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardOffset(e.endCoordinates.height);
        setTimeout(() => {
          mainScrollRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardOffset(0)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Get the authenticated user directly — no email lookup needed
  const { cachedUser } = useAuth();
  const userId = cachedUser?.userId ?? null;

  const originalModuleId: string = route?.params?.originalModuleId ?? '';
  const moduleTitle: string = route?.params?.moduleTitle ?? 'Module Content';

  const { modules, isLoading, error } = useGetProcessedModules(
    originalModuleId || null,
    userId,
  );

  const primaryModule = modules?.[0] ?? null;

  const { isTranslating, translatedSections, translatedFlashcards } = useModuleTranslation(
    originalModuleId || null,
    primaryModule?.content ?? null,
    primaryModule?.flashcard_data ?? null,
    lang,
  );



  const toggle = (key: string) =>
    setExpanded((prev) => (prev === key ? null : key));

  return (
    <View style={[styles.main, { paddingTop: insets.top }]}>
      {/* Nav */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="chevron-left" size={28} color="#4F46E5" />
          <Text style={styles.backLabel}>Back</Text>
        </TouchableOpacity>

        <ModuleLanguageSelector selectedLang={lang} onSelectLang={setLang} />
      </View>

      {isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loaderText}>Loading content...</Text>
        </View>
      ) : error ? (
        <View style={styles.loader}>
          <MaterialCommunityIcons name="alert-circle-outline" size={40} color="#EF4444" />
          <Text style={styles.errorText}>Failed to load content</Text>
          <Text style={styles.errorSub}>{error.message}</Text>
        </View>
      ) : (
        <ScrollView
          ref={mainScrollRef}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 + keyboardOffset }}
        >
          {/* Hero */}
          <View style={styles.hero}>
            <Text style={styles.heroTitle}>
              {primaryModule?.title ?? moduleTitle}
            </Text>
            <Text style={styles.heroSubtitle}>
              {primaryModule?.learning_style
                ? `Learning style: ${primaryModule.learning_style}`
                : 'Deep dive into professional learning content.'}
            </Text>
            {primaryModule && (
              <View style={styles.metaRow}>
                <View style={styles.metaBadge}>
                  <MaterialCommunityIcons name="book-open-variant" size={14} color="#4F46E5" />
                  <Text style={styles.metaText}>Core Content</Text>
                </View>
                {primaryModule.audio_url && (
                  <View style={styles.metaBadge}>
                    <MaterialCommunityIcons name="headphones" size={14} color="#4F46E5" />
                    <Text style={styles.metaText}>Podcast</Text>
                  </View>
                )}
                {primaryModule.video_url && (
                  <View style={styles.metaBadge}>
                    <MaterialCommunityIcons name="play-circle-outline" size={14} color="#4F46E5" />
                    <Text style={styles.metaText}>Video</Text>
                  </View>
                )}
                {primaryModule.flashcard_data && primaryModule.flashcard_data.length > 0 && (
                  <View style={styles.metaBadge}>
                    <MaterialCommunityIcons name="cards-outline" size={14} color="#4F46E5" />
                    <Text style={styles.metaText}>Flashcards</Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Accordion Sections */}
          <View style={styles.accordionList}>
            <CoreContentSection
              isExpanded={expanded === 'core'}
              onToggle={() => toggle('core')}
              htmlContent={primaryModule?.content ?? null}
              moduleId={originalModuleId}
              lang={lang}
              onLangChange={setLang}
              sections={translatedSections}
              isTranslating={isTranslating}
            />

            <FlashcardsSection
              isExpanded={expanded === 'flashcards'}
              onToggle={() => toggle('flashcards')}
              flashcardData={translatedFlashcards}
              moduleId={originalModuleId}
              lang={lang}
              isTranslating={isTranslating}
            />

            <MindmapSection
              isExpanded={expanded === 'mindmap'}
              onToggle={() => toggle('mindmap')}
              mindmapData={primaryModule?.mindmap_data ?? null}
            />

            <PodcastSection
              isExpanded={expanded === 'podcast'}
              onToggle={() => toggle('podcast')}
              lang={lang}
              audioUrl={primaryModule?.audio_url ?? null}
              audioUrlHinglish={primaryModule?.audio_url_hinglish ?? null}
              podcastTimeline={primaryModule?.podcast_timeline ?? null}
              podcastTimelineHinglish={primaryModule?.podcast_timeline_hinglish ?? null}
              transcript={primaryModule?.podcast_transcript ?? null}
            />

            <VideoSection
              isExpanded={expanded === 'video'}
              onToggle={() => toggle('video')}
              lang={lang}
              videoUrl={primaryModule?.video_url ?? null}
            />

            <AIAssistantSection
              isExpanded={expanded === 'ai'}
              onToggle={() => toggle('ai')}
              processedModuleId={primaryModule?.processed_module_id ?? ""}
              moduleTitle={primaryModule?.title ?? moduleTitle}
              userId={userId ?? ""}
              companyId={cachedUser?.companyId ?? ""}
              lang={lang}
              onInputFocus={() => {
                setTimeout(() => {
                  mainScrollRef.current?.scrollToEnd({ animated: true });
                }, 150);
              }}
            />
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1, backgroundColor: '#F8FAFC' },
  navBar: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  backLabel: { fontSize: 16, fontWeight: '600', color: '#4F46E5' },

  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loaderText: { fontSize: 14, color: '#64748B' },
  errorText: { fontSize: 16, fontWeight: '700', color: '#EF4444' },
  errorSub: { fontSize: 13, color: '#94A3B8' },

  hero: { padding: 24, paddingBottom: 16 },
  heroTitle: { fontSize: 24, fontWeight: '800', color: '#1E293B', lineHeight: 32 },
  heroSubtitle: { fontSize: 14, color: '#64748B', marginTop: 6 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  metaBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#EEF2FF', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20,
  },
  metaText: { fontSize: 12, fontWeight: '600', color: '#4F46E5' },

  accordionList: { paddingHorizontal: 16, gap: 12 },
});