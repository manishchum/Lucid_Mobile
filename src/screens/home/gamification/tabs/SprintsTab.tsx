import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { GC } from "../drills/GamificationColors";
import { STACK_ROUTES } from "../../../../navigations/Routes";
import {
  GamificationSprint,
  GamificationDrill,
  GamificationProfile,
} from "../../../../api/gamification/Request";

const DRILL_ICONS: Record<string, string> = {
  VIBE_CHECK: "head-heart-outline",
  RISK_RIZZ: "card-multiple",
  FILL_BLANKS: "text-box-edit-outline",
  FLOW_MASTER: "sitemap",
  CODE_BREAKER: "lock-open-variant-outline",
  AUDIT_SPOTTER: "file-find-outline",
  SPEED_RUN: "lightning-bolt",
};

const DRILL_COLORS: Record<string, string> = {
  VIBE_CHECK: "#8B5CF6",
  RISK_RIZZ: "#EF4444",
  FILL_BLANKS: "#3B82F6",
  FLOW_MASTER: "#10B981",
  CODE_BREAKER: "#F59E0B",
  AUDIT_SPOTTER: "#EF4444",
  SPEED_RUN: "#F59E0B",
};

interface Props {
  sprints: GamificationSprint[];
  profile: GamificationProfile | null;
  isLoading: boolean;
  onRefresh: () => void;
}

export default function SprintsTab({
  sprints,
  profile,
  isLoading,
  onRefresh,
}: Props) {
  const navigation = useNavigation<any>();
  const [expandedSprints, setExpandedSprints] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  const completedDrills = new Set(profile?.completed_drills || []);

  const toggleSprint = (id: string) => {
    setExpandedSprints((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  }, [onRefresh]);

  const openDrill = (drill: GamificationDrill, sprint: GamificationSprint) => {
    const isCompleted = completedDrills.has(drill.drill_id);
    navigation.navigate(STACK_ROUTES.GAMIFICATION_DRILL as never, {
      drill,
      sprintId: sprint.sprint_id,
      isCompleted,
      earnedXp: isCompleted ? drill.base_xp : undefined,
    } as never);
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={GC.primary} size="large" />
        <Text style={styles.loadingText}>Loading your sprints...</Text>
      </View>
    );
  }

  if (sprints.length === 0) {
    return (
      <View style={styles.center}>
        <MaterialCommunityIcons
          name="run-fast"
          size={48}
          color={GC.textMuted}
        />
        <Text style={styles.emptyTitle}>No Sprints Yet</Text>
        <Text style={styles.emptySubtitle}>
          Sprints are generated from your assigned modules. Complete some learning first!
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={GC.primary}
          colors={[GC.primary]}
        />
      }
    >
      {sprints.map((sprint, sprintIdx) => {
        const isExpanded = expandedSprints.has(sprint.sprint_id);
        const drills = sprint.gamification_drills || [];
        const completedCount = drills.filter((d) =>
          completedDrills.has(d.drill_id)
        ).length;
        const sprintPct =
          drills.length > 0 ? (completedCount / drills.length) * 100 : 0;
        const isLocked = sprint.is_locked;

        return (
          <View
            key={sprint.sprint_id}
            style={[styles.sprintCard, isLocked && styles.sprintCardLocked]}
          >
            <TouchableOpacity
              onPress={() => !isLocked && toggleSprint(sprint.sprint_id)}
              activeOpacity={0.85}
              style={styles.sprintHeader}
            >
              <View style={styles.sprintNumberBadge}>
                {isLocked ? (
                  <MaterialCommunityIcons
                    name="lock"
                    size={16}
                    color={GC.textMuted}
                  />
                ) : (
                  <Text style={styles.sprintNumberText}>{sprintIdx + 1}</Text>
                )}
              </View>
              <View style={styles.sprintInfo}>
                <Text
                  style={[
                    styles.sprintModuleLabel,
                    isLocked && styles.textMuted,
                  ]}
                  numberOfLines={1}
                >
                  {sprint.module_title}
                </Text>
                <Text
                  style={[
                    styles.sprintTitle,
                    isLocked && styles.textMuted,
                  ]}
                  numberOfLines={2}
                >
                  {sprint.sprint_title}
                </Text>
                {!isLocked && (
                  <View style={styles.progressRow}>
                    <View style={styles.progressBarBg}>
                      <View
                        style={[
                          styles.progressBarFill,
                          { width: `${sprintPct}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.progressLabel}>
                      {completedCount}/{drills.length}
                    </Text>
                  </View>
                )}
                {isLocked && (
                  <Text style={styles.lockedLabel}>
                    Complete previous sprint to unlock
                  </Text>
                )}
              </View>
              {!isLocked && (
                <MaterialCommunityIcons
                  name={isExpanded ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={GC.textMuted}
                />
              )}
            </TouchableOpacity>

            {isExpanded && !isLocked && (
              <View style={styles.drillsList}>
                <View style={styles.drillsListDivider} />
                {drills
                  .sort((a, b) => a.order_index - b.order_index)
                  .map((drill) => {
                    const isDrillCompleted = completedDrills.has(drill.drill_id);
                    const drillColor =
                      DRILL_COLORS[drill.format_type] || GC.primary;
                    const drillIcon =
                      DRILL_ICONS[drill.format_type] || "gamepad-variant";

                    return (
                      <TouchableOpacity
                        key={drill.drill_id}
                        style={[
                          styles.drillRow,
                          isDrillCompleted && styles.drillRowCompleted,
                        ]}
                        onPress={() => openDrill(drill, sprint)}
                        activeOpacity={0.85}
                      >
                        <View
                          style={[
                            styles.drillIconCircle,
                            {
                              backgroundColor: isDrillCompleted
                                ? "#052E16"
                                : GC.cardAlt,
                              borderColor: isDrillCompleted
                                ? GC.success
                                : drillColor + "44",
                            },
                          ]}
                        >
                          <MaterialCommunityIcons
                            name={
                              isDrillCompleted ? "check" : (drillIcon as any)
                            }
                            size={16}
                            color={
                              isDrillCompleted ? GC.success : drillColor
                            }
                          />
                        </View>
                        <View style={styles.drillInfo}>
                          <Text style={styles.drillType}>
                            {drill.format_type.replace("_", " ")}
                          </Text>
                          <Text
                            style={styles.drillTitle}
                            numberOfLines={2}
                          >
                            {drill.title}
                          </Text>
                        </View>
                        <View style={styles.drillXpBadge}>
                          <Text style={styles.drillXpText}>
                            {isDrillCompleted ? "✓" : `+${drill.base_xp}`} XP
                          </Text>
                        </View>
                        <MaterialCommunityIcons
                          name="chevron-right"
                          size={18}
                          color={GC.textMuted}
                        />
                      </TouchableOpacity>
                    );
                  })}
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 80 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 16,
  },
  loadingText: {
    color: GC.textMuted,
    fontSize: 14,
    fontWeight: "600",
  },
  emptyTitle: {
    color: GC.textPrimary,
    fontSize: 18,
    fontWeight: "800",
    marginTop: 8,
  },
  emptySubtitle: {
    color: GC.textMuted,
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 20,
  },
  sprintCard: {
    backgroundColor: GC.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: GC.border,
    overflow: "hidden",
  },
  sprintCardLocked: {
    opacity: 0.55,
  },
  sprintHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  sprintNumberBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: GC.primary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: GC.primaryLight + "44",
  },
  sprintNumberText: {
    color: GC.textPrimary,
    fontSize: 14,
    fontWeight: "900",
  },
  sprintInfo: { flex: 1, gap: 4 },
  sprintModuleLabel: {
    color: GC.primaryLight,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  sprintTitle: {
    color: GC.textPrimary,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 20,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  progressBarBg: {
    flex: 1,
    height: 4,
    backgroundColor: GC.border,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: GC.primary,
    borderRadius: 4,
  },
  progressLabel: {
    color: GC.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },
  lockedLabel: {
    color: GC.textMuted,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  textMuted: { color: GC.textMuted },
  drillsList: { paddingHorizontal: 12, paddingBottom: 12, gap: 8 },
  drillsListDivider: {
    height: 1,
    backgroundColor: GC.border,
    marginBottom: 8,
    marginHorizontal: 4,
  },
  drillRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: GC.cardAlt,
    borderRadius: 14,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: GC.border,
  },
  drillRowCompleted: {
    borderColor: GC.success + "44",
    backgroundColor: "#041810",
  },
  drillIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },
  drillInfo: { flex: 1, gap: 2 },
  drillType: {
    color: GC.textMuted,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  drillTitle: {
    color: GC.textPrimary,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  drillXpBadge: {
    backgroundColor: "#1C1200",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: GC.gold + "55",
  },
  drillXpText: {
    color: GC.gold,
    fontSize: 11,
    fontWeight: "900",
  },
});
