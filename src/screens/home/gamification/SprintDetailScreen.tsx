import React, { useEffect, useCallback, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { STACK_ROUTES } from "../../../navigations/Routes";
import {
  GamificationSprint,
  GamificationDrill,
} from "../../../api/gamification/Request";
import { useGamificationProfile } from "../../../api/gamification/Hooks";
import { eventBus } from "../../../utils/EventBus";

const DRILL_ICONS: Record<string, string> = {
  VIBE_CHECK: "head-heart-outline",
  RISK_RIZZ: "card-multiple",
  FILL_BLANKS: "text-box-edit-outline",
  FLOW_MASTER: "sitemap",
  CODE_BREAKER: "lock-open-variant-outline",
  AUDIT_SPOTTER: "file-find-outline",
  SPEED_RUN: "lightning-bolt",
};

const DRILL_FORMAT_LABELS: Record<string, string> = {
  VIBE_CHECK: "Vibe Check",
  RISK_RIZZ: "Risk Rizz",
  FILL_BLANKS: "Fill In Blanks",
  FLOW_MASTER: "Flow Master",
  CODE_BREAKER: "Code Breaker",
  AUDIT_SPOTTER: "Audit Spotter",
  SPEED_RUN: "Speed Run",
};

const DRILL_SUBTITLES: Record<string, string> = {
  VIBE_CHECK: "Intuition & Scenario Decision",
  RISK_RIZZ: "Risk Assessment & Prioritization",
  FILL_BLANKS: "Key Concept Recall",
  FLOW_MASTER: "Process Flow & Logic Decision",
  CODE_BREAKER: "Spot Security Gaps & Fix",
  AUDIT_SPOTTER: "Spot Issues in Real Documents",
  SPEED_RUN: "Fast-Paced Knowledge Sprint",
};

export default function SprintDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [refreshing, setRefreshing] = useState(false);

  const {
    sprint,
    sprintIdx,
    isLocked: initialIsLocked,
    initialCompletedDrillIds,
  } = route.params as {
    sprint: GamificationSprint;
    sprintIdx: number;
    isLocked?: boolean;
    initialCompletedDrillIds?: string[];
  };

  const isLocked = Boolean(initialIsLocked);

  const { data: profile, fetch: fetchProfile } = useGamificationProfile();

  // Instant local set seeded by route params and in-memory profile cache
  const [completedDrillIds, setCompletedDrillIds] = useState<Set<string>>(() => {
    const set = new Set<string>(initialCompletedDrillIds || []);
    if (profile?.completed_drills) {
      profile.completed_drills.forEach((d) => set.add(d.drill_id));
    }
    return set;
  });

  // Keep synced with profile whenever fresh data arrives
  useEffect(() => {
    if (profile?.completed_drills) {
      setCompletedDrillIds((prev) => {
        let changed = false;
        const next = new Set(prev);
        profile.completed_drills.forEach((d) => {
          if (!next.has(d.drill_id)) {
            next.add(d.drill_id);
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }
  }, [profile]);

  const [localEarnedXpMap, setLocalEarnedXpMap] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchProfile(true);
    const unsub = eventBus.on("drill_completed", ({ drillId, result }: any) => {
      if (drillId) {
        setCompletedDrillIds((prev) => new Set(prev).add(drillId));
        if (result?.earned_xp !== undefined) {
          setLocalEarnedXpMap((prev) => ({ ...prev, [drillId]: result.earned_xp }));
        }
      }
      fetchProfile(true);
    });
    return () => {
      unsub();
    };
  }, [fetchProfile]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchProfile(true);
    setRefreshing(false);
  }, [fetchProfile]);

  const drills = (sprint?.gamification_drills || [])
    .slice()
    .sort((a, b) => a.order_index - b.order_index);

  // Map of completed drillId -> actual earned_xp
  const completedDrillsXpMap = useMemo(() => {
    const map = new Map<string, number>();
    if (profile?.completed_drills) {
      profile.completed_drills.forEach((d) => {
        map.set(d.drill_id, d.earned_xp ?? 0);
      });
    }
    Object.entries(localEarnedXpMap).forEach(([dId, xp]) => {
      map.set(dId, xp);
    });
    return map;
  }, [profile?.completed_drills, localEarnedXpMap]);

  const completedCount = drills.filter((d) =>
    completedDrillIds.has(d.drill_id)
  ).length;
  const isCompleted = drills.length > 0 && completedCount === drills.length;
  const totalXp = drills.reduce((sum, d) => sum + (d.base_xp || 0), 0);
  const earnedXp = drills
    .filter((d) => completedDrillIds.has(d.drill_id))
    .reduce((sum, d) => sum + (completedDrillsXpMap.get(d.drill_id) ?? d.base_xp ?? 0), 0);
  const pct = drills.length > 0 ? (completedCount / drills.length) * 100 : 0;

  // The first uncompleted drill in sequence
  const nextDrill = drills.find((d) => !completedDrillIds.has(d.drill_id));
  const nextDrillIndex = nextDrill
    ? drills.findIndex((d) => d.drill_id === nextDrill.drill_id)
    : -1;

  const openDrill = useCallback(
    (drill: GamificationDrill) => {
      if (isLocked) return;
      const isDrillDone = completedDrillIds.has(drill.drill_id);
      const actualEarned = completedDrillsXpMap.get(drill.drill_id);
      navigation.navigate(STACK_ROUTES.GAMIFICATION_DRILL as never, {
        drill,
        sprintId: sprint.sprint_id,
        isCompleted: isDrillDone,
        earnedXp: isDrillDone ? (actualEarned ?? drill.base_xp) : undefined,
        profile,
      } as never);
    },
    [completedDrillIds, completedDrillsXpMap, isLocked, navigation, sprint, profile]
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="arrow-left" size={20} color="#0F172A" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>
            SPRINT {sprintIdx !== undefined ? sprintIdx + 1 : ""}
          </Text>
        </View>

        {/* Right placeholder to balance backBtn and dead-center the title */}
        <View style={styles.headerRightSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 36 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#A855F7"
            colors={["#A855F7"]}
          />
        }
      >
        {/* Unified Hero Card (Preserves sleek dark background, no overwhelming green) */}
        <View
          style={[
            styles.heroCard,
            isLocked && styles.heroCardLocked,
          ]}
        >
          {/* Top Row: Status Chip + XP Pill */}
          <View style={styles.heroTopRow}>
            {isLocked ? (
              <View style={styles.statusChipLocked}>
                <MaterialCommunityIcons
                  name="lock"
                  size={12}
                  color="#64748B"
                />
                <Text style={styles.statusChipTextLocked}>LOCKED</Text>
              </View>
            ) : isCompleted ? (
              <View style={styles.statusChipCompleted}>
                <MaterialCommunityIcons
                  name="check-circle"
                  size={13}
                  color="#10B981"
                />
                <Text style={styles.statusChipTextCompleted}>COMPLETED</Text>
              </View>
            ) : (
              <View style={styles.statusChipActive}>
                <MaterialCommunityIcons
                  name="lightning-bolt"
                  size={13}
                  color="#7C3AED"
                />
                <Text style={styles.statusChipTextActive}>IN PROGRESS</Text>
              </View>
            )}

            <View
              style={[
                styles.heroXpPill,
                isLocked && styles.heroXpPillLocked,
              ]}
            >
              <MaterialCommunityIcons
                name="star-four-points"
                size={12}
                color={isLocked ? "#94A3B8" : isCompleted ? "#10B981" : "#D97706"}
              />
              <Text
                style={[
                  styles.heroXpText,
                  isLocked && styles.heroXpTextLocked,
                ]}
              >
                {isLocked
                  ? `${totalXp} XP Available`
                  : `${earnedXp} / ${totalXp} XP`}
              </Text>
            </View>
          </View>

          {/* Sprint Title with optional completion checkmark */}
          <View style={styles.titleRow}>
            <Text style={styles.heroTitle}>{sprint.title}</Text>
            {isCompleted && (
              <MaterialCommunityIcons
                name="check-circle"
                size={20}
                color="#10B981"
                style={styles.titleCheckmark}
              />
            )}
          </View>

          {/* Description */}
          {!!sprint.description && (
            <Text style={styles.heroDesc}>{sprint.description}</Text>
          )}

          {/* Progress Bar (when unlocked) */}
          {!isLocked ? (
            <View style={styles.heroProgressWrap}>
              <View style={styles.heroProgressHeader}>
                <Text style={styles.heroProgressLabel}>
                  {completedCount} of {drills.length} Drills Completed
                </Text>
                <Text style={styles.heroProgressPct}>
                  {Math.round(pct)}%
                </Text>
              </View>
              <View style={styles.heroProgressBarTrack}>
                <View
                  style={[
                    styles.heroProgressBarFill,
                    { width: `${pct}%` },
                    isCompleted && styles.heroProgressBarFillCompleted,
                  ]}
                />
              </View>
            </View>
          ) : (
            <View style={styles.heroLockedBanner}>
              <MaterialCommunityIcons
                name="lock-clock"
                size={16}
                color="#94A3B8"
              />
              <Text style={styles.heroLockedText}>
                Complete Sprint {sprintIdx} to unlock and start these drills.
              </Text>
            </View>
          )}
        </View>

        {/* Quick Action CTA Banner (When sprint is in progress) */}
        {!isLocked && !isCompleted && nextDrill && (
          <TouchableOpacity
            style={styles.quickPlayBtn}
            onPress={() => openDrill(nextDrill)}
            activeOpacity={0.88}
          >
            <View style={styles.quickPlayLeft}>
              <View style={styles.quickPlayIconCircle}>
                <MaterialCommunityIcons name="play" size={18} color="#FFFFFF" />
              </View>
              <View style={styles.quickPlayTextWrap}>
                <Text style={styles.quickPlayTag}>
                  {completedCount === 0 ? "START QUEST" : "CONTINUE SPRINT"}
                </Text>
                <Text style={styles.quickPlayTitle} numberOfLines={1}>
                  Drill {nextDrillIndex + 1}: {DRILL_FORMAT_LABELS[nextDrill.format_type] || nextDrill.title}
                </Text>
              </View>
            </View>
            <View style={styles.quickPlayXpBadge}>
              <MaterialCommunityIcons
                name="star-four-points"
                size={11}
                color="#FCD34D"
              />
              <Text style={styles.quickPlayXpText}>+{nextDrill.base_xp} XP</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Drills Section Header */}
        <View style={styles.drillsSectionHeader}>
          <View style={styles.drillsSectionHeaderLeft}>
            <Text style={styles.drillsSectionTitle}>
              {isLocked ? "UPCOMING DRILLS" : "DRILL ROADMAP"}
            </Text>
            <View style={styles.drillCountPill}>
              <Text style={styles.drillCountText}>
                {completedCount}/{drills.length}
              </Text>
            </View>
          </View>

          <Text style={styles.drillsSectionSubtitle}>
            {isLocked
              ? `Locked until Sprint ${sprintIdx}`
              : isCompleted
              ? "All Completed"
              : `${drills.length - completedCount} Remaining`}
          </Text>
        </View>

        {/* Drills Timeline List */}
        <View style={styles.timelineList}>
          {drills.map((drill, idx) => {
            const isDrillDone =
              !isLocked && completedDrillIds.has(drill.drill_id);
            const isCurrent =
              !isLocked && !isDrillDone && drill.drill_id === nextDrill?.drill_id;
            const drillIcon =
              DRILL_ICONS[drill.format_type] || "gamepad-variant";

            return (
              <View key={drill.drill_id} style={styles.timelineRow}>
                {/* Timeline Left: Connector + Node */}
                <View style={styles.timelineLeftCol}>
                  {/* Line Above */}
                  <View
                    style={[
                      styles.timelineLine,
                      idx === 0 && styles.timelineLineInvisible,
                      (isDrillDone || isCurrent) && styles.timelineLineActive,
                      isDrillDone && styles.timelineLineCompleted,
                    ]}
                  />

                  {/* Center Node Circle */}
                  <View
                    style={[
                      styles.timelineNode,
                      isDrillDone && styles.timelineNodeCompleted,
                      isCurrent && styles.timelineNodeCurrent,
                      isLocked && styles.timelineNodeLocked,
                    ]}
                  >
                    {isDrillDone ? (
                      <MaterialCommunityIcons
                        name="check"
                        size={14}
                        color="#FFFFFF"
                      />
                    ) : isCurrent ? (
                      <MaterialCommunityIcons
                        name="play"
                        size={13}
                        color="#FFFFFF"
                      />
                    ) : isLocked ? (
                      <MaterialCommunityIcons
                        name="lock"
                        size={12}
                        color="#94A3B8"
                      />
                    ) : (
                      <Text style={styles.timelineNodeNumber}>{idx + 1}</Text>
                    )}
                  </View>

                  {/* Line Below */}
                  <View
                    style={[
                      styles.timelineLine,
                      idx === drills.length - 1 && styles.timelineLineInvisible,
                      isDrillDone && styles.timelineLineActive,
                      isDrillDone && styles.timelineLineCompleted,
                    ]}
                  />
                </View>

                {/* Timeline Right: Drill Card */}
                <TouchableOpacity
                  style={[
                    styles.drillCard,
                    isCurrent && styles.drillCardCurrent,
                    isLocked && styles.drillCardLocked,
                  ]}
                  onPress={() => !isLocked && openDrill(drill)}
                  activeOpacity={isLocked ? 1 : 0.75}
                >
                  {/* Top Card Header: Format Chip + XP */}
                  <View style={styles.drillCardHeader}>
                    <View style={styles.drillFormatChip}>
                      <MaterialCommunityIcons
                        name={drillIcon as any}
                        size={12}
                        color={isCurrent ? "#7C3AED" : isLocked ? "#94A3B8" : "#475569"}
                      />
                      <Text
                        style={[
                          styles.drillFormatText,
                          isCurrent && styles.drillFormatTextCurrent,
                          isLocked && styles.drillFormatTextLocked,
                        ]}
                      >
                        {DRILL_FORMAT_LABELS[drill.format_type] ||
                          drill.format_type.replace(/_/g, " ")}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.drillXpChip,
                        isDrillDone && styles.drillXpChipCompleted,
                        isLocked && styles.drillXpChipLocked,
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={isDrillDone ? "check-decagram" : "star-four-points"}
                        size={11}
                        color={isLocked ? "#94A3B8" : isDrillDone ? "#10B981" : "#D97706"}
                      />
                      <Text
                        style={[
                          styles.drillXpText,
                          isDrillDone && styles.drillXpTextCompleted,
                          isLocked && styles.drillXpTextLocked,
                        ]}
                      >
                        +{isDrillDone ? (completedDrillsXpMap.get(drill.drill_id) ?? drill.base_xp) : drill.base_xp} XP
                      </Text>
                    </View>
                  </View>

                  {/* Drill Title */}
                  <Text
                    style={[
                      styles.drillTitle,
                      isLocked && styles.drillTitleLocked,
                    ]}
                    numberOfLines={2}
                  >
                    {drill.title}
                  </Text>

                  {/* Subtitle / Objective */}
                  <Text style={styles.drillSubtitle} numberOfLines={1}>
                    {DRILL_SUBTITLES[drill.format_type] ||
                      "Interactive Challenge Drill"}
                  </Text>

                  {/* Bottom Footer: Step Counter + Checkmark or Action */}
                  <View style={styles.drillCardFooter}>
                    <Text style={styles.drillStepText}>
                      Drill {idx + 1} of {drills.length}
                    </Text>

                    {/* Just a clean green check mark to validate that the drill is completed */}
                    {isDrillDone ? (
                      <View style={styles.drillCheckWrap}>
                        <MaterialCommunityIcons
                          name="check-circle"
                          size={18}
                          color="#10B981"
                        />
                      </View>
                    ) : isCurrent ? (
                      <View style={styles.drillActionBtnCurrent}>
                        <Text style={styles.drillActionTextCurrent}>START</Text>
                        <MaterialCommunityIcons
                          name="arrow-right"
                          size={13}
                          color="#FFFFFF"
                        />
                      </View>
                    ) : isLocked ? (
                      <View style={styles.drillActionBtnLocked}>
                        <MaterialCommunityIcons
                          name="lock"
                          size={12}
                          color="#94A3B8"
                        />
                        <Text style={styles.drillActionTextLocked}>Locked</Text>
                      </View>
                    ) : (
                      <View style={styles.drillActionBtnUpcoming}>
                        <Text style={styles.drillActionTextUpcoming}>Start</Text>
                        <MaterialCommunityIcons
                          name="chevron-right"
                          size={14}
                          color="#64748B"
                        />
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    justifyContent: "center",
    alignItems: "center",
  },
  headerCenter: {
    alignItems: "center",
  },
  headerTitle: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 2.5,
  },
  headerRightSpacer: {
    width: 38,
    height: 38,
  },

  scrollContent: {
    padding: 16,
    gap: 16,
  },

  // Hero Card (Clean light surface)
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 12,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  heroCardLocked: {
    opacity: 0.9,
    backgroundColor: "#F8FAFC",
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  // Status Chips
  statusChipActive: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 8,
    backgroundColor: "#FAF5FF",
    borderWidth: 1,
    borderColor: "#E9D5FF",
  },
  statusChipTextActive: {
    color: "#7C3AED",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  statusChipCompleted: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 8,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  statusChipTextCompleted: {
    color: "#059669",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  statusChipLocked: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  statusChipTextLocked: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
  },

  // Hero XP Pill
  heroXpPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FFFBEB",
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  heroXpPillLocked: {
    backgroundColor: "#F1F5F9",
    borderColor: "#E2E8F0",
  },
  heroXpText: {
    color: "#B45309",
    fontSize: 12,
    fontWeight: "800",
  },
  heroXpTextLocked: {
    color: "#94A3B8",
  },

  // Title Row with optional checkmark
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  heroTitle: {
    color: "#0F172A",
    fontSize: 21,
    fontWeight: "900",
    lineHeight: 27,
    letterSpacing: 0.2,
    flex: 1,
  },
  titleCheckmark: {
    marginTop: 2,
  },
  heroDesc: {
    color: "#475569",
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "400",
  },

  // Hero Progress
  heroProgressWrap: {
    gap: 8,
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  heroProgressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroProgressLabel: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "600",
  },
  heroProgressPct: {
    color: "#0F172A",
    fontSize: 13,
    fontWeight: "800",
  },
  heroProgressBarTrack: {
    height: 6,
    backgroundColor: "#E2E8F0",
    borderRadius: 3,
    overflow: "hidden",
  },
  heroProgressBarFill: {
    height: "100%",
    backgroundColor: "#7C3AED",
    borderRadius: 3,
  },
  heroProgressBarFillCompleted: {
    backgroundColor: "#10B981",
  },

  // Hero Locked Banner
  heroLockedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  heroLockedText: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "500",
    flex: 1,
    lineHeight: 17,
  },

  // Quick Play Button (CTA)
  quickPlayBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#7C3AED",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#6D28D9",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  quickPlayLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  quickPlayIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  quickPlayTextWrap: {
    flex: 1,
    gap: 2,
  },
  quickPlayTag: {
    color: "#E9D5FF",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  quickPlayTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  quickPlayXpBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0, 0, 0, 0.25)",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
  },
  quickPlayXpText: {
    color: "#FCD34D",
    fontSize: 12,
    fontWeight: "900",
  },

  // Drills Section Header
  drillsSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
    marginTop: 2,
  },
  drillsSectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  drillsSectionTitle: {
    color: "#0F172A",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  drillCountPill: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  drillCountText: {
    color: "#475569",
    fontSize: 11,
    fontWeight: "900",
  },
  drillsSectionSubtitle: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "600",
  },

  // Timeline List
  timelineList: {
    gap: 0,
  },
  timelineRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 12,
    minHeight: 106,
  },
  timelineLeftCol: {
    width: 28,
    alignItems: "center",
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: "#E2E8F0",
  },
  timelineLineInvisible: {
    backgroundColor: "transparent",
  },
  timelineLineActive: {
    backgroundColor: "#DDD6FE",
  },
  timelineLineCompleted: {
    backgroundColor: "#10B981",
  },
  timelineNode: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 4,
  },
  timelineNodeCurrent: {
    backgroundColor: "#7C3AED",
    borderColor: "#A78BFA",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  timelineNodeCompleted: {
    backgroundColor: "#10B981",
    borderColor: "#10B981",
  },
  timelineNodeLocked: {
    backgroundColor: "#F1F5F9",
    borderColor: "#E2E8F0",
  },
  timelineNodeNumber: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "900",
  },

  // Drill Card (Clean Light Card Theme)
  drillCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 8,
    marginBottom: 12,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  drillCardCurrent: {
    borderColor: "#7C3AED",
    backgroundColor: "#FAF5FF",
  },
  drillCardLocked: {
    opacity: 0.75,
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8F0",
  },

  // Drill Card Header
  drillCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  drillFormatChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    backgroundColor: "#F1F5F9",
    borderColor: "#E2E8F0",
  },
  drillFormatText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "#475569",
  },
  drillFormatTextCurrent: {
    color: "#7C3AED",
  },
  drillFormatTextLocked: {
    color: "#94A3B8",
  },

  // XP Chip
  drillXpChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  drillXpChipCompleted: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  drillXpChipLocked: {
    backgroundColor: "#F1F5F9",
    borderColor: "#E2E8F0",
  },
  drillXpText: {
    color: "#D97706",
    fontSize: 11,
    fontWeight: "900",
  },
  drillXpTextCompleted: {
    color: "#059669",
  },
  drillXpTextLocked: {
    color: "#94A3B8",
  },

  // Drill Title & Subtitle
  drillTitle: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 19,
  },
  drillTitleLocked: {
    color: "#94A3B8",
  },
  drillSubtitle: {
    color: "#475569",
    fontSize: 11,
    fontWeight: "500",
  },

  // Drill Card Footer
  drillCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  drillStepText: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "600",
  },

  // Just a Green Checkmark for Completed Drills
  drillCheckWrap: {
    justifyContent: "center",
    alignItems: "center",
  },

  // Active / Current Action Button
  drillActionBtnCurrent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#7C3AED",
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 8,
  },
  drillActionTextCurrent: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  // Upcoming Action Button
  drillActionBtnUpcoming: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  drillActionTextUpcoming: {
    color: "#334155",
    fontSize: 11,
    fontWeight: "700",
  },

  // Locked Action
  drillActionBtnLocked: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  drillActionTextLocked: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "600",
  },
});

