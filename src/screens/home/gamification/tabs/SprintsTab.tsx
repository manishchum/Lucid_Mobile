import React, { useCallback, useState } from "react";
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
  GamificationProfile,
} from "../../../../api/gamification/Request";

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
  const [refreshing, setRefreshing] = useState(false);

  const completedDrills = new Set(
    (profile?.completed_drills || []).map((d) => d.drill_id)
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  }, [onRefresh]);

  const handleSelectSprint = (
    sprint: GamificationSprint,
    sprintIdx: number,
    isLocked: boolean
  ) => {
    navigation.navigate(STACK_ROUTES.GAMIFICATION_SPRINT_DETAIL as never, {
      sprint,
      sprintIdx,
      isLocked,
      initialCompletedDrillIds: Array.from(completedDrills),
    } as never);
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={GC.primary} size="large" />
        <Text style={styles.loadingText}>Loading arena sprints...</Text>
      </View>
    );
  }

  if (sprints.length === 0) {
    return (
      <View style={styles.center}>
        <View style={styles.emptyIconCircle}>
          <MaterialCommunityIcons name="sword-cross" size={38} color="#A855F7" />
        </View>
        <Text style={styles.emptyTitle}>No Sprints Available</Text>
        <Text style={styles.emptySubtitle}>
          Complete assigned training modules to unlock your Arena sprints!
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
          tintColor="#A855F7"
          colors={["#A855F7"]}
        />
      }
    >
      {sprints.map((sprint, sprintIdx) => {
        const drills = sprint.gamification_drills || [];
        const completedCount = drills.filter((d) =>
          completedDrills.has(d.drill_id)
        ).length;
        const isCompleted = drills.length > 0 && completedCount === drills.length;
        const earnedXp = drills
          .filter((d) => completedDrills.has(d.drill_id))
          .reduce((sum, d) => sum + (d.base_xp || 0), 0);

        let isLocked = sprint.is_locked;
        if (sprintIdx > 0) {
          const prevSprint = sprints[sprintIdx - 1];
          const prevDrills = prevSprint.gamification_drills || [];
          const prevCompletedCount = prevDrills.filter((d) =>
            completedDrills.has(d.drill_id)
          ).length;
          isLocked = prevDrills.length === 0 || prevCompletedCount < prevDrills.length;
        } else {
          isLocked = false;
        }

        return (
          <TouchableOpacity
            key={sprint.sprint_id}
            style={[
              styles.sprintCard,
              isLocked && styles.sprintCardLocked,
            ]}
            onPress={() => handleSelectSprint(sprint, sprintIdx, isLocked)}
            activeOpacity={0.75}
          >
            {/* Top Row: Sprint Number + Gained XP & Checkmark */}
            <View style={styles.cardTopRow}>
              {/* Sprint Number Pill with optional Green Checkmark */}
              <View style={styles.sprintBadgeGroup}>
                <View
                  style={[
                    styles.sprintNumberPill,
                    isCompleted && styles.sprintNumberPillCompleted,
                  ]}
                >
                  <Text
                    style={[
                      styles.sprintNumberText,
                      isCompleted && styles.sprintNumberTextCompleted,
                    ]}
                  >
                    SPRINT {sprintIdx + 1}
                  </Text>
                </View>

                {/* Green check mark when user completed the whole sprint */}
                {isCompleted && (
                  <View style={styles.completedCheckWrap}>
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={18}
                      color="#10B981"
                    />
                  </View>
                )}
              </View>

              {/* Gained XP */}
              <View
                style={[
                  styles.xpPill,
                  isCompleted && styles.xpPillCompleted,
                  isLocked && styles.xpPillLocked,
                ]}
              >
                <MaterialCommunityIcons
                  name="star-four-points"
                  size={12}
                  color={isCompleted ? "#10B981" : isLocked ? "#64748B" : "#A855F7"}
                />
                <Text
                  style={[
                    styles.xpText,
                    isCompleted && styles.xpTextCompleted,
                    isLocked && styles.xpTextLocked,
                  ]}
                >
                  {earnedXp} XP
                </Text>
              </View>
            </View>

            {/* Bottom Row: Title & Action Chevron / Lock */}
            <View style={styles.cardBottomRow}>
              <Text
                style={[
                  styles.sprintTitle,
                  isLocked && styles.textLocked,
                ]}
                numberOfLines={2}
              >
                {sprint.title}
              </Text>

              <View style={styles.actionIconWrap}>
                <MaterialCommunityIcons
                  name={isLocked ? "lock" : "chevron-right"}
                  size={20}
                  color={isLocked ? "#64748B" : "#94A3B8"}
                />
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
    paddingBottom: 30,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 14,
    backgroundColor: "#1A1A24",
  },
  loadingText: {
    color: "#94A3B8",
    fontSize: 14,
    fontWeight: "600",
  },
  emptyIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(168, 85, 247, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 4,
  },
  emptySubtitle: {
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 280,
  },

  // Sprint Card
  sprintCard: {
    backgroundColor: "#2C2C35",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  sprintCardLocked: {
    opacity: 0.55,
    backgroundColor: "#24242E",
  },

  // Top Row
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sprintBadgeGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sprintNumberPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "rgba(168, 85, 247, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.25)",
  },
  sprintNumberPillCompleted: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderColor: "rgba(16, 185, 129, 0.25)",
  },
  sprintNumberText: {
    color: "#A855F7",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },
  sprintNumberTextCompleted: {
    color: "#10B981",
  },
  completedCheckWrap: {
    justifyContent: "center",
    alignItems: "center",
  },

  // XP Pill
  xpPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: "rgba(168, 85, 247, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.25)",
  },
  xpPillCompleted: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderColor: "rgba(16, 185, 129, 0.25)",
  },
  xpPillLocked: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  xpText: {
    color: "#A855F7",
    fontSize: 12,
    fontWeight: "800",
  },
  xpTextCompleted: {
    color: "#10B981",
  },
  xpTextLocked: {
    color: "#64748B",
  },

  // Bottom Row
  cardBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sprintTitle: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 22,
  },
  textLocked: {
    color: "#64748B",
  },
  actionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    justifyContent: "center",
    alignItems: "center",
  },
});
