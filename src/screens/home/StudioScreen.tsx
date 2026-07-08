import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../../contex/AuthContext";
import { useGetProcessedModuleById } from "../../api/users";
import CoreContentSection from "./sections/CoreContentSection";
import PodcastSection from "./sections/PodcastSection";
import FlashcardsSection from "../../components/content/FlashcardsSection";

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
export default function StudioScreen({ route }: any) {
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState<string | null>("core");
  const { cachedUser } = useAuth();
  const { hasFeature } = useFeatureGating();
  const showTextual = true;
  const showFlashcards = hasFeature(FEATURES.FLASHCARD);
  const showPodcast = hasFeature(FEATURES.PODCAST);
  const showVideo = hasFeature(FEATURES.VIDEO);
  const showAiAssistant = hasFeature(FEATURES.CHAT_IN_STUDIO);

  // Params from SprintScreen "View Content" — each module tap passes its own processedModuleId
  const processedModuleId: string = route?.params?.processedModuleId ?? "";
  const moduleTitle: string = route?.params?.moduleTitle ?? "";
  const sprintTitle: string = route?.params?.sprintTitle ?? "";

  const userId = cachedUser?.userId ?? null;
  const companyId = cachedUser?.companyId ?? "";

  const [lang, setLang] = useState<'en' | 'hi' | 'bn' | 'ta' | 'te' | 'mr' | 'gu' | 'kn'>('en');

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

  // Fetch processed module by ID — endpoint: GET /processed-modules/{processedModuleId}
  // This is the single source of truth for all Studio sections below.
  const {
    module: processedModule,
    isLoading,
    error,
  } = useGetProcessedModuleById(processedModuleId || null, userId);

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
      <View style={[styles.emptyContainer, { paddingTop: insets.top }]}>
        <View style={styles.emptyIconWrap}>
          <MaterialCommunityIcons name="brush" size={44} color="#A5B4FC" />
        </View>
        <Text style={styles.emptyTitle}>Studio</Text>
        <Text style={styles.emptySubtitle}>
          Tap <Text style={styles.emptyHighlight}>View Content</Text> on any
          Sprint module to explore core content, podcasts, flashcards, videos
          and AI assistance here.
        </Text>
      </View>
    );
  }

  // ── Loading ──
  if (isLoading) {
    return (
      <View style={[styles.loader, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={styles.loaderText}>Loading content…</Text>
      </View>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <View style={[styles.loader, { paddingTop: insets.top }]}>
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
    <View style={[styles.main, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      >
        {/* ── Hero ── */}
        <View style={styles.hero}>
          <View style={styles.studioBadge}>
            <MaterialCommunityIcons name="brush" size={14} color="#4F46E5" />
            <Text style={styles.studioBadgeText}>Studio</Text>
          </View>
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
              videoUrl={processedModule?.video_url ?? null}
              videoUrlHinglish={processedModule?.video_url_hinglish ?? null}
              videoUrlBengali={processedModule?.video_url_bengali ?? null}
              videoUrlTamil={processedModule?.video_url_tamil ?? null}
              videoUrlTelugu={processedModule?.video_url_telugu ?? null}
              videoUrlMarathi={processedModule?.video_url_marathi ?? null}
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
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1, backgroundColor: "#F8FAFC" },

  // ── Empty state ──
  emptyContainer: {
    flex: 1,
    backgroundColor: "#F8FAFC",
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
  hero: { padding: 24, paddingBottom: 16 },
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
});
