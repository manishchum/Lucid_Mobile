import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  LayoutAnimation,
  Platform,
  UIManager,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_ROUTES } from '../../navigations/Routes';
import { useGetDashboardSummary } from '../../api/users';
import { useAuth } from '../../contex/AuthContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * normalizeProcessedModuleIds
 * Robustly parses the processedModuleIds param regardless of how React Navigation
 * serialised it (string, JSON string, or array). Returns a clean string[].
 */
function normalizeProcessedModuleIds(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((id) => String(id)).filter(Boolean);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map((id) => String(id)).filter(Boolean);
    } catch {
      return [trimmed];
    }
  }
  return [];
}

export default function SprintScreen({ navigation, route }: { navigation: any; route: any }) {
  const insets = useSafeAreaInsets();
  const { cachedUser } = useAuth();

  // ── Route params ────────────────────────────────────────────────────────────
  const moduleId: string  = route?.params?.moduleId ?? '';
  const planTitle: string = route?.params?.planTitle ?? 'Performance Sprint';
  const tips: string      = route?.params?.tips ?? '';
  const rawModules: any[] = route?.params?.modules ?? [];

  /**
   * processedIds[i] is ALWAYS the correct processedModuleId for rawModules[i].
   *
   * This positional alignment is established by HomeScreen.resolveProcessedModuleIds()
   * which builds both arrays in the same order before passing them via navigation.
   * We re-normalise here as a safety net against React Navigation serialisation edge
   * cases (hot-reload, deep-link restore).
   */
  const processedIds: string[] = useMemo(
    () => normalizeProcessedModuleIds(route?.params?.processedModuleIds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [route?.params?.processedModuleIds],
  );

  const [tipsExpanded, setTipsExpanded] = useState(false);

  const userId    = cachedUser?.userId ?? null;
  const companyId = cachedUser?.companyId ?? null;

  const { stats, isLoading: statsLoading } = useGetDashboardSummary(userId, companyId);
  const totalModules          = rawModules.length;
  const completedModulesCount = Math.min(stats.completedCount, totalModules);

  const modules = useMemo(
    () => rawModules as Array<{ order: number; title: string; recommended_time: number }>,
    [rawModules],
  );

  const handleToggleTips = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTipsExpanded(v => !v);
  };

  // ── Empty / direct-open state ──────────────────────────────────────────────
  if (!moduleId) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top + 20 }]}>
        <MaterialCommunityIcons name="lightning-bolt" size={48} color="#CBD5E1" />
        <Text style={styles.emptyTitle}>No Sprint Selected</Text>
        <Text style={styles.emptySubtitle}>
          Go to Home and tap "Start your sprint" on a learning plan to begin.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
      >
        {/* ── Header ────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Performance Sprint</Text>
          <Text style={styles.headerSub} numberOfLines={1}>{planTitle}</Text>
        </View>

        {/* ── Hero Card ─────────────────────────────────────────────────── */}
        <View style={styles.sprintCard}>
          <View style={styles.cardHeader}>
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons name="lightning-bolt" size={24} color="white" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Your Roadmap to Mastery</Text>
              <Text style={styles.cardMeta}>
                {totalModules} Module{totalModules !== 1 ? 's' : ''}
                {statsLoading
                  ? ' · Loading…'
                  : ` · ${completedModulesCount} / ${totalModules} Completed`}
              </Text>
            </View>
            {statsLoading && (
              <ActivityIndicator size="small" color="rgba(255,255,255,0.7)" />
            )}
          </View>

          {/* Segmented progress bar */}
          <View style={styles.progressRow}>
            {modules.map((_: any, i: number) => (
              <View
                key={i}
                style={[
                  styles.progressSegment,
                  { flex: 1 },
                  i < completedModulesCount && styles.progressSegmentFilled,
                ]}
              />
            ))}
          </View>

          <Text style={styles.progressFraction}>
            {statsLoading
              ? '— / —'
              : `${completedModulesCount} of ${totalModules} modules complete`}
          </Text>

          {tips ? (
            <TouchableOpacity
              onPress={handleToggleTips}
              activeOpacity={0.85}
              style={styles.tipsContainer}
            >
              <View style={styles.tipsRow}>
                <Text style={styles.tipsIcon}>💡</Text>
                <Text
                  style={styles.tipsText}
                  numberOfLines={tipsExpanded ? undefined : 2}
                >
                  {tips}
                </Text>
                <MaterialCommunityIcons
                  name={tipsExpanded ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color="rgba(255,255,255,0.7)"
                  style={{ marginLeft: 6, flexShrink: 0 }}
                />
              </View>
              {!tipsExpanded && (
                <Text style={styles.tapToExpand}>Tap to read more</Text>
              )}
            </TouchableOpacity>
          ) : null}
        </View>

        {/* ── Module List ───────────────────────────────────────────────── */}
        <View style={styles.moduleSection}>
          <Text style={styles.sectionTitle}>Your Modules</Text>

          {modules.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="book-open-outline" size={40} color="#CBD5E1" />
              <Text style={styles.emptyText}>No modules assigned yet</Text>
            </View>
          ) : (
            modules.map((mod, index) => {
              /**
               * ✅ KEY: processedIds[index] is the resolved processedModuleId for
               * this specific module. HomeScreen guarantees the positional alignment
               * between modules[] and processedModuleIds[]. Never share an ID across
               * modules — each index gets its own ID.
               */
              const processedModuleId = processedIds[index] ?? null;
              const isDone = index < completedModulesCount;

              return (
                <View
                  key={`${moduleId}-module-${index}`}  // stable key: parent sprint + index
                  style={[styles.moduleCard, isDone && styles.moduleCardDone]}
                >
                  <View style={styles.cardRow}>
                    <View style={[styles.statusDot, isDone && styles.statusDotDone]}>
                      <MaterialCommunityIcons
                        name={isDone ? 'check' : 'circle-outline'}
                        size={14}
                        color={isDone ? '#fff' : '#94A3B8'}
                      />
                    </View>
                    <View style={styles.moduleInfo}>
                      <Text style={styles.moduleLabel}>
                        MODULE {index + 1} OF {totalModules}
                      </Text>
                      <Text style={styles.moduleTitle}>{mod.title}</Text>
                    </View>
                  </View>

                  {/* ── "View Content" button ─────────────────────────────── */}
                  <TouchableOpacity
                    style={[
                      styles.viewButton,
                      !processedModuleId && styles.viewButtonDisabled,
                    ]}
                    disabled={!processedModuleId}
                    onPress={() => {
                      if (!processedModuleId) {
                        console.error(
                          '[SprintScreen] ❌ No processedModuleId for module',
                          { index, title: mod.title, processedIds },
                        );
                        Alert.alert(
                          'Not ready yet',
                          'Module content is still loading. Please wait a moment and try again.',
                        );
                        return;
                      }

                      console.log(
                        '[SprintScreen] ✅ View Content →',
                        { index, title: mod.title, processedModuleId },
                      );

                      // Each tap passes only THIS module's processedModuleId.
                      // StudioScreen fetches GET /processed-modules/:processedModuleId
                      // with this exact ID — guarantees the correct module loads.
                      navigation.navigate(APP_ROUTES.STUDIO, {
                        processedModuleId,          // ← the single correct ID for this module
                        moduleTitle:  mod.title,
                        sprintTitle:  planTitle,
                      });
                    }}
                  >
                    <Text style={[
                      styles.viewButtonText,
                      !processedModuleId && styles.viewButtonTextDisabled,
                    ]}>
                      {processedModuleId ? 'View Content' : 'Loading…'}
                    </Text>
                    <MaterialCommunityIcons
                      name="arrow-right"
                      size={15}
                      color={processedModuleId ? '#4F46E5' : '#CBD5E1'}
                      style={{ marginLeft: 6 }}
                    />
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  centered: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 32, gap: 12,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#374151', textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22 },

  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 4 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#111827' },
  headerSub: { fontSize: 14, color: '#6B7280', marginTop: 2 },

  sprintCard: {
    marginHorizontal: 20, marginTop: 16, padding: 20,
    backgroundColor: '#4F46E5', borderRadius: 20,
    marginBottom: 24, gap: 14,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { color: 'white', fontSize: 17, fontWeight: '700' },
  cardMeta: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 3 },

  progressRow: { flexDirection: 'row', gap: 4, height: 6 },
  progressSegment: {
    height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  progressSegmentFilled: { backgroundColor: '#A5F3FC' },
  progressFraction: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12, fontWeight: '600',
    marginTop: -6,
  },

  tipsContainer: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10, padding: 12,
  },
  tipsRow: { flexDirection: 'row', alignItems: 'flex-start' },
  tipsIcon: { fontSize: 14, marginRight: 6, marginTop: 1 },
  tipsText: { flex: 1, color: 'rgba(255,255,255,0.92)', fontSize: 13, lineHeight: 19 },
  tapToExpand: {
    marginTop: 6, fontSize: 11,
    color: 'rgba(255,255,255,0.55)', fontWeight: '600', textAlign: 'right',
  },

  moduleSection: { paddingHorizontal: 20 },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 16 },

  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyText: { fontSize: 14, color: '#94A3B8' },

  moduleCard: {
    backgroundColor: 'white', borderRadius: 16, padding: 18,
    marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  moduleCardDone: { borderColor: '#D1FAE5', backgroundColor: '#FAFFFE' },

  cardRow: { flexDirection: 'row', gap: 14, marginBottom: 14, alignItems: 'flex-start' },
  statusDot: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#F1F5F9',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, marginTop: 2,
  },
  statusDotDone: { backgroundColor: '#10B981' },

  moduleInfo: { flex: 1 },
  moduleLabel: {
    fontSize: 10, fontWeight: '700', color: '#A5B4FC',
    letterSpacing: 1, marginBottom: 4,
  },
  moduleTitle: { fontSize: 15, fontWeight: '700', color: '#1F2937', lineHeight: 22 },

  viewButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#4F46E5',
    backgroundColor: 'white',
  },
  viewButtonDisabled: { borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  viewButtonText: { fontSize: 14, fontWeight: '700', color: '#4F46E5' },
  viewButtonTextDisabled: { color: '#CBD5E1' },
});