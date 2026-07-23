import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  StatusBar,
  BackHandler,
  Keyboard,
  Platform,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";

import { useAuth } from "../../contex/AuthContext";
import { useGetProcessedModuleById } from "../../api/users";
import { useActiveSprint } from "../../contex/ActiveSprintContext";
import { APP_ROUTES, STACK_ROUTES } from "../../navigations/Routes";
import CoreContentSection from "./sections/CoreContentSection";
import PodcastSection from "./sections/PodcastSection";
import FlashcardsSection from "../../components/content/FlashcardsSection";
import RefreshSpinner from "../../components/pullToRefresh/RefreshSpinner";

// ─── Phase 2: Mind Map ────────────────────────────────────────────────────────
// MindmapSection will be implemented in Phase 2 using a proper graph/SVG renderer.
// The mindmap_data (nodes + edges) is already available from the API response at
// processedModule.mindmap_data — wire it in when Phase 2 begins.
// import MindmapSection from '../../components/content/MindmapSection';
// ─────────────────────────────────────────────────────────────────────────────

import VideoSection from "../../components/content/VideoSection";
import AIAssistantSection from "../../components/content/AIAssistantSection";
import { useFeatureGating, FEATURES } from "../../hooks/useFeatureGating";
import { useModuleTranslation } from "../../hooks/useModuleTranslation";
import ModuleLanguageSelector from "../../components/content/ModuleLanguageSelector";

/**
 * StudioScreen
 *
 * ─── Data Flow ───────────────────────────────────────────────────────────────
 * Receives `processedModuleId` from SprintScreen's "View Content" tap.
 * Calls GET /api/processed-modules/{processedModuleId} to load the full module.
 *
 * Each module in a sprint has its own processed_module_id from processed_module_ids[].
 * The API response shape is: { data: { ...processedModule } }
 *
 * Fields used by each section:
 *   CoreContent  → data.content        (HTML string with <section> tags)
 *   Flashcards   → data.flashcard_data (array of { heading, points[] })
 *   Podcast      → data.audio_url, data.audio_url_hinglish,
 *                  data.podcast_timeline, data.podcast_timeline_hinglish,
 *                  data.podcast_transcript
 *   Video        → data.video_url
 *   AI Assistant → no module data needed (uses conversation context)
 *   Mind Map     → data.mindmap_data   (Phase 2: { nodes, edges })
 * ─────────────────────────────────────────────────────────────────────────────
 */
export default function StudioScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const mainScrollRef = useRef<ScrollView>(null);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [expanded, setExpanded] = useState<string | null>("core");
  const { cachedUser } = useAuth();
  const { hasFeature } = useFeatureGating();
  const showTextual = true;
  const showFlashcards = hasFeature(FEATURES.FLASHCARD);
  const showPodcast = hasFeature(FEATURES.PODCAST);
  const showVideo = hasFeature(FEATURES.VIDEO);
  const showAiAssistant = hasFeature(FEATURES.CHAT_IN_STUDIO);
  const userId = cachedUser?.userId ?? null;
  const companyId = cachedUser?.companyId ?? "";

  // Intercept physical back press to redirect to Sprint tab
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        navigation.navigate("AppTabs", { screen: STACK_ROUTES.SPRINT });
        return true;
      };

      const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);

      return () => subscription.remove();
    }, [navigation])
  );

  const { activeModule } = useActiveSprint();

  // Params from ActiveSprintContext — each module tap passes its own processedModuleId
  const processedModuleId: string = activeModule?.processedModuleId ?? "";
  const moduleTitle: string = activeModule?.moduleTitle ?? "";
  const sprintTitle: string = activeModule?.sprintTitle ?? "";

  const [lang, setLang] = useState<string>('en');

  // ── Keyboard height listener ──
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => {
        setKeyboardOffset(e.endCoordinates.height);
        setTimeout(() => {
          mainScrollRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboardOffset(0)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // ─── Debug logging: Validate incoming params ──────────────────────────────
  useEffect(() => {
    console.log("[v0] [StudioScreen] Mounted with params:", {
      processedModuleId: processedModuleId || "⚠️ MISSING",
      moduleTitle,
      sprintTitle,
      userId: userId ? "✓" : "⚠️ MISSING",
    });

    if (!processedModuleId) {
      console.warn(
        "[v0] [StudioScreen] ⚠️ No processedModuleId received. This screen should only be opened from SprintScreen.",
      );
    }
    if (!userId) {
      console.warn(
        "[v0] [StudioScreen] ⚠️ No userId available. Auth may not be initialized.",
      );
    }
  }, [processedModuleId, moduleTitle, sprintTitle, userId]);

  const [refreshing, setRefreshing] = useState(false);

  // Fetch processed module by ID — endpoint: GET /processed-modules/{processedModuleId}
  // This is the single source of truth for all Studio sections below.
  const {
    module: processedModule,
    isLoading,
    error,
    refetch,
  } = useGetProcessedModuleById(processedModuleId || null, userId);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } catch (err) {
      console.error("[StudioScreen] Refresh error:", err);
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const { isTranslating, translatedSections, translatedFlashcards } = useModuleTranslation(
    processedModuleId || null,
    processedModule?.content ?? null,
    processedModule?.flashcard_data ?? null,
    lang,
  );

  // ─── Debug logging: Track module data loading ─────────────────────────────
  useEffect(() => {
    if (isLoading) {
      console.log("[v0] [StudioScreen] Loading module data...");
    }
  }, [isLoading]);

  useEffect(() => {
    if (error) {
      console.error(
        "[v0] [StudioScreen] ❌ Error loading module:",
        error.message,
      );
    }
  }, [error]);

  useEffect(() => {
    if (processedModule) {
      console.log("[v0] [StudioScreen] ✅ Module data loaded:", {
        title: processedModule.title,
        hasContent: !!processedModule.content,
        hasAudio: !!processedModule.audio_url,
        hasVideo: !!processedModule.video_url,
        hasFlashcards: !!processedModule.flashcard_data,
        flashcardCount: processedModule.flashcard_data?.length || 0,
        hasMindmap: !!processedModule.mindmap_data,
      });
    } else if (!isLoading && !error) {
      console.warn("[v0] [StudioScreen] ⚠️ Module loaded but data is empty");
    }
  }, [processedModule, isLoading, error]);

  const toggle = (key: string) =>
    setExpanded((prev) => (prev === key ? null : key));

  // ── Empty state: tab opened directly without a module selected ──
  if (!processedModuleId) {
    return (
      <View style={[styles.emptyContainer, { paddingTop: 20 }]}>
        <View style={styles.emptyIconWrap}>
          <MaterialCommunityIcons name="brush" size={44} color="#A5B4FC" />
        </View>
        <Text style={styles.emptyTitle}>Studio Empty</Text>
        <Text style={styles.emptySubtitle}>
          Tap <Text style={styles.emptyHighlight}>View Content</Text> on any
          Sprint module to explore core content, podcasts, flashcards, videos
          and AI assistance here.
        </Text>
        <TouchableOpacity
          style={styles.emptyBtn}
          onPress={() => navigation.navigate(APP_ROUTES.HOME)}
          activeOpacity={0.8}
        >
          <Text style={styles.emptyBtnText}>Go to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Loading ──
  if (isLoading) {
    return (
      <View style={[styles.loader, { paddingTop: 20 }]}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={styles.loaderText}>Loading content…</Text>
      </View>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <View style={[styles.loader, { paddingTop: 20 }]}>
        <MaterialCommunityIcons
          name="alert-circle-outline"
          size={40}
          color="#EF4444"
        />
        <Text style={styles.errorText}>Failed to load content</Text>
        <Text style={styles.errorSub}>{error.message}</Text>
      </View>
    );
  }

  // ── Full content view ──
  return (
    <View style={styles.main}>
      <ScrollView
        ref={mainScrollRef}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 + keyboardOffset }}
        refreshControl={
          RefreshSpinner(refreshing, onRefresh)
        }
      >
        {/* ── Hero ── */}
        <View style={styles.hero}>
          <View style={styles.topHeaderBar}>
            <TouchableOpacity
              style={styles.backBtnRow}
              onPress={() => navigation.navigate("AppTabs", { screen: STACK_ROUTES.SPRINT })}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="chevron-left" size={24} color="#6366F1" />
              <Text style={styles.backBtnText}>Back to Sprint</Text>
            </TouchableOpacity>

            <ModuleLanguageSelector selectedLang={lang} onSelectLang={setLang} />
          </View>

          {/* <View style={styles.studioBadge}>
            <MaterialCommunityIcons name="brush" size={14} color="#4F46E5" />
            <Text style={styles.studioBadgeText}>Studio</Text>
          </View> */}
          {/* {sprintTitle ? (
            <Text style={styles.sprintLabel}>{sprintTitle}</Text>
          ) : null} */}
          <Text style={styles.heroTitle}>
            {processedModule?.title ?? moduleTitle}
          </Text>
          <Text style={styles.heroSubtitle}>
            {processedModule?.sprint_name
              ? processedModule.sprint_name
              : "Deep dive into professional learning content."}
          </Text>

          {/* Feature badge pills — shown based on what the API returned
          {processedModule && (
            <View style={styles.metaRow}>
              {processedModule.content && (
                <View style={styles.metaBadge}>
                  <MaterialCommunityIcons name="book-open-variant" size={13} color="#4F46E5" />
                  <Text style={styles.metaText}>Core Content</Text>
                </View>
              )}
              {processedModule.audio_url && (
                <View style={styles.metaBadge}>
                  <MaterialCommunityIcons name="headphones" size={13} color="#4F46E5" />
                  <Text style={styles.metaText}>Podcast</Text>
                </View>
              )}
              {processedModule.video_url && (
                <View style={styles.metaBadge}>
                  <MaterialCommunityIcons name="play-circle-outline" size={13} color="#4F46E5" />
                  <Text style={styles.metaText}>Video</Text>
                </View>
              )}
              {processedModule.flashcard_data && processedModule.flashcard_data.length > 0 && (
                <View style={styles.metaBadge}>
                  <MaterialCommunityIcons name="cards-outline" size={13} color="#4F46E5" />
                  <Text style={styles.metaText}>
                    {processedModule.flashcard_data.length} Flashcards
                  </Text>
                </View>
              )}
              {processedModule.audio_url_hinglish && (
                <View style={[styles.metaBadge, styles.metaBadgeHi]}>
                  <Text style={styles.metaTextHi}>🇮🇳 हिंदी</Text>
                </View>
              )}
            </View>
          )} */}
        </View>

        {/* ── Accordion Sections ── */}
        <View style={styles.accordionList}>
          {/* Core Content — parses processedModule.content (HTML) into sections */}
          {showTextual && (
            <CoreContentSection
              isExpanded={expanded === "core"}
              onToggle={() => toggle("core")}
              htmlContent={processedModule?.content ?? null}
              moduleId={processedModuleId}
              lang={lang}
              onLangChange={setLang}
              sections={translatedSections}
              isTranslating={isTranslating}
            />
          )}

          {/* Flashcards — from processedModule.flashcard_data array */}
          {showFlashcards && (
            <FlashcardsSection
              isExpanded={expanded === "flashcards"}
              onToggle={() => toggle("flashcards")}
              flashcardData={translatedFlashcards}
              moduleId={processedModuleId}
              lang={lang}
              isTranslating={isTranslating}
            />
          )}

          {/* ── Phase 2: Mind Map ──────────────────────────────────────────────
            Will be implemented in Phase 2.
            processedModule.mindmap_data contains { nodes: [...], edges: [...] }
            Gate behind hasFeature(FEATURES.MINDMAP) once wired in.
            <MindmapSection
              isExpanded={expanded === 'mindmap'}
              onToggle={() => toggle('mindmap')}
              mindmapData={processedModule?.mindmap_data ?? null}
            />
          ──────────────────────────────────────────────────────────────────── */}

          {/* Podcast — audio URLs and timelines all from API response */}
          {showPodcast && (
            <PodcastSection
              isExpanded={expanded === "podcast"}
              onToggle={() => toggle("podcast")}
              lang={lang}
              audioUrl={processedModule?.audio_url ?? null}
              audioUrlHinglish={processedModule?.audio_url_hinglish ?? null}
              podcastTimeline={processedModule?.podcast_timeline ?? null}
              podcastTimelineHinglish={
                processedModule?.podcast_timeline_hinglish ?? null
              }
              transcript={processedModule?.podcast_transcript ?? null}
            />
          )}

          {/* Video — from processedModule.video_url + regional variants */}
          {showVideo && (
            <VideoSection
              isExpanded={expanded === "video"}
              onToggle={() => toggle("video")}
              lang={lang}
              videoUrl={processedModule?.video_url ?? null}
              videoUrlHinglish={
                processedModule?.video_url_hinglish ||
                (processedModule?.audio_url_hinglish ? processedModule?.video_url : null)
              }
              videoUrlBengali={
                processedModule?.video_url_bengali ||
                (processedModule?.audio_url_bengali ? processedModule?.video_url : null)
              }
              videoUrlTamil={
                processedModule?.video_url_tamil ||
                (processedModule?.audio_url_tamil ? processedModule?.video_url : null)
              }
              videoUrlTelugu={
                processedModule?.video_url_telugu ||
                (processedModule?.audio_url_telugu ? processedModule?.video_url : null)
              }
              videoUrlMarathi={
                processedModule?.video_url_marathi ||
                (processedModule?.audio_url_marathi ? processedModule?.video_url : null)
              }
            />
          )}

          {/* AI Assistant — gated behind the chat_in_studio add-on */}
          {showAiAssistant && (
            <AIAssistantSection
              isExpanded={expanded === "ai"}
              onToggle={() => toggle("ai")}
              processedModuleId={processedModuleId}
              moduleTitle={moduleTitle}
              userId={userId ?? ""}
              companyId={companyId}
              lang={lang}
              onInputFocus={() => {
                setTimeout(() => {
                  mainScrollRef.current?.scrollToEnd({ animated: true });
                }, 150);
              }}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1, backgroundColor: "#FFF" },

  // ── Empty state ──
  emptyContainer: {
    flex: 1,
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 36,
  },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#1E293B",
    marginBottom: 12,
  },
  emptySubtitle: {
    fontSize: 15,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 24,
  },
  emptyHighlight: { color: "#4F46E5", fontWeight: "700" },

  // ── Loading / error ──
  loader: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loaderText: { fontSize: 14, color: "#64748B" },
  errorText: { fontSize: 16, fontWeight: "700", color: "#EF4444" },
  errorSub: { fontSize: 13, color: "#94A3B8" },

  // ── Hero ──
  hero: { paddingHorizontal: 24, paddingVertical: 16 },
  studioBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#EEF2FF",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 8,
  },
  studioBadgeText: { fontSize: 12, fontWeight: "700", color: "#4F46E5" },
  sprintLabel: { fontSize: 12, color: "#94A3B8", marginBottom: 4 },
  heroTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1E293B",
    lineHeight: 32,
  },
  heroSubtitle: { fontSize: 14, color: "#64748B", marginTop: 6 },

  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  metaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  metaBadgeHi: { backgroundColor: "#FFF7ED" },
  metaText: { fontSize: 12, fontWeight: "600", color: "#4F46E5" },
  metaTextHi: { fontSize: 12, fontWeight: "600", color: "#C2410C" },

  accordionList: { paddingHorizontal: 16, gap: 12 },
  topHeaderBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  backBtnRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6366F1",
    marginLeft: 2,
  },
  backBtn: {
    marginBottom: 12,
    alignSelf: "flex-start",
    padding: 4,
  },
  backBtnAbsolute: {
    position: "absolute",
    left: 20,
    top: 20,
    padding: 4,
    zIndex: 10,
  },
  emptyBtn: {
    backgroundColor: "#6366F1",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 16,
  },
  emptyBtnText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
});
