import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Platform,
  UIManager,
  LayoutAnimation,
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

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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
  VIBE_CHECK: "#A855F7",
  RISK_RIZZ: "#F43F5E",
  FILL_BLANKS: "#38BDF8",
  FLOW_MASTER: "#10B981",
  CODE_BREAKER: "#F59E0B",
  AUDIT_SPOTTER: "#EF4444",
  SPEED_RUN: "#EAB308",
};

const DRILL_SHORT_NAMES: Record<string, string> = {
  VIBE_CHECK: "Vibe",
  RISK_RIZZ: "Risk",
  FILL_BLANKS: "Blanks",
  FLOW_MASTER: "Flow",
  CODE_BREAKER: "Code",
  AUDIT_SPOTTER: "Audit",
  SPEED_RUN: "Speed",
};

interface Props {
  sprints: GamificationSprint[];
  profile: GamificationProfile | null;
  isLoading: boolean;
  onRefresh: () => void;
}

interface SprintCardProps {
  sprint: GamificationSprint;
  sprintIdx: number;
  isLocked: boolean;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  completedDrills: Set<string>;
  onOpenDrill: (drill: GamificationDrill, sprint: GamificationSprint) => void;
}

function SprintCard({
  sprint,
  sprintIdx,
  isLocked,
  isExpanded,
  onToggle,
  completedDrills,
  onOpenDrill,
}: SprintCardProps) {
  const drills = (sprint.gamification_drills || []).slice().sort((a, b) => a.order_index - b.order_index);
  const completedCount = drills.filter((d) => completedDrills.has(d.drill_id)).length;
  const isCompleted = drills.length > 0 && completedCount === drills.length;
  const totalXp = drills.reduce((sum, d) => sum + (d.base_xp || 0), 0);
  const earnedXp = drills
    .filter((d) => completedDrills.has(d.drill_id))
    .reduce((sum, d) => sum + (d.base_xp || 0), 0);
  const pct = drills.length > 0 ? (completedCount / drills.length) * 100 : 0;

  // Next drill to play
  const nextDrill = drills.find((d) => !completedDrills.has(d.drill_id)) || drills[0];

  // Animations
  const rotateAnim = useRef(new Animated.Value(isExpanded ? 1 : 0)).current;
  const ctaScaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(rotateAnim, {
      toValue: isExpanded ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [isExpanded]);

  // Pulsing animation for the active stage orb
  useEffect(() => {
    if (!isLocked && !isCompleted) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [isLocked, isCompleted]);

  const chevronRotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  const handleToggle = () => {
    if (isLocked) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onToggle(sprint.sprint_id);
  };

  const handleCtaPressIn = () => {
    Animated.spring(ctaScaleAnim, { toValue: 0.96, useNativeDriver: true }).start();
  };

  const handleCtaPressOut = () => {
    Animated.spring(ctaScaleAnim, { toValue: 1, friction: 4, useNativeDriver: true }).start();
  };

  const handleCtaPress = () => {
    if (isLocked) return;
    if (nextDrill) {
      onOpenDrill(nextDrill, sprint);
    } else if (drills.length > 0) {
      onOpenDrill(drills[0], sprint);
    }
  };

  return (
    <View
      style={[
        styles.sprintCard,
        isCompleted && styles.sprintCardCompleted,
        !isLocked && !isCompleted && styles.sprintCardActive,
        isLocked && styles.sprintCardLocked,
      ]}
    >
      {/* Huge Background Watermark Chapter Number */}
      <View style={styles.hugeWatermarkWrap} pointerEvents="none">
        <Text style={styles.hugeWatermarkText}>
          {String(sprintIdx + 1).padStart(2, "0")}
        </Text>
      </View>

      <View style={styles.cardContent}>
        {/* Top Meta Header */}
        <View style={styles.topMetaRow}>
          {/* Chapter / Quest Status Chip */}
          {isLocked ? (
            <View style={styles.chipLocked}>
              <MaterialCommunityIcons name="lock" size={12} color="#94A3B8" />
              <Text style={styles.chipLockedText}>
                CHAPTER {String(sprintIdx + 1).padStart(2, "0")} • LOCKED
              </Text>
            </View>
          ) : isCompleted ? (
            <View style={styles.chipCompleted}>
              <MaterialCommunityIcons name="check-circle" size={13} color="#10B981" />
              <Text style={styles.chipCompletedText}>
                CHAPTER {String(sprintIdx + 1).padStart(2, "0")} • CLEARED
              </Text>
            </View>
          ) : (
            <View style={styles.chipActive}>
              <MaterialCommunityIcons name="lightning-bolt" size={13} color="#A855F7" />
              <Text style={styles.chipActiveText}>
                CHAPTER {String(sprintIdx + 1).padStart(2, "0")} • ACTIVE
              </Text>
            </View>
          )}

          {/* XP Reward Pill */}
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
                styles.xpPillText,
                isCompleted && styles.xpPillTextCompleted,
                isLocked && styles.xpPillTextLocked,
              ]}
            >
              {isCompleted
                ? `${earnedXp} XP`
                : earnedXp > 0
                ? `${earnedXp}/${totalXp} XP`
                : `+${totalXp} XP`}
            </Text>
          </View>
        </View>

        {/* Sprint Title */}
        <Text style={[styles.sprintTitle, isLocked && styles.textMuted]}>
          {sprint.title}
        </Text>

        {/* Mission Briefing Box (Description) */}
        {!!sprint.description && (
          <View
            style={[
              styles.briefingBox,
              isCompleted && styles.briefingBoxCompleted,
              isLocked && styles.briefingBoxLocked,
            ]}
          >
            <View style={styles.briefingHeader}>
              <MaterialCommunityIcons
                name="crosshairs-gps"
                size={12}
                color={isCompleted ? "#10B981" : isLocked ? "#64748B" : "#A855F7"}
              />
              <Text
                style={[
                  styles.briefingLabel,
                  isCompleted && { color: "#10B981" },
                  isLocked && { color: "#64748B" },
                ]}
              >
                MISSION BRIEFING
              </Text>
            </View>
            <Text style={[styles.briefingText, isLocked && styles.textMuted]}>
              {sprint.description}
            </Text>
          </View>
        )}

        {/* Interactive Horizontal Stage Roadmap Track */}
        {drills.length > 0 && (
          <View style={styles.roadmapSection}>
            <View style={styles.roadmapTrackRow}>
              {drills.map((drill, dIdx) => {
                const isDrillDone = completedDrills.has(drill.drill_id);
                const isCurrentActive = !isLocked && !isDrillDone && drill.drill_id === nextDrill?.drill_id;
                const drillColor = DRILL_COLORS[drill.format_type] || "#A855F7";
                const drillIcon = DRILL_ICONS[drill.format_type] || "gamepad-variant";

                return (
                  <React.Fragment key={drill.drill_id}>
                    {/* Connector line before (except first) */}
                    {dIdx > 0 && (
                      <View
                        style={[
                          styles.roadmapConnector,
                          isDrillDone
                            ? styles.roadmapConnectorDone
                            : isCurrentActive
                            ? styles.roadmapConnectorActive
                            : styles.roadmapConnectorLocked,
                        ]}
                      />
                    )}

                    {/* Stage Orb */}
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => !isLocked && onOpenDrill(drill, sprint)}
                      style={styles.stageOrbTouchable}
                    >
                      {isCurrentActive ? (
                        <Animated.View
                          style={[
                            styles.stageOrb,
                            styles.stageOrbCurrent,
                            { transform: [{ scale: pulseAnim }] },
                          ]}
                        >
                          <MaterialCommunityIcons name="play" size={16} color="#FFFFFF" />
                        </Animated.View>
                      ) : (
                        <View
                          style={[
                            styles.stageOrb,
                            isDrillDone
                              ? styles.stageOrbDone
                              : isLocked
                              ? styles.stageOrbLocked
                              : { borderColor: drillColor + "66", backgroundColor: drillColor + "15" },
                          ]}
                        >
                          <MaterialCommunityIcons
                            name={isDrillDone ? "check" : isLocked ? "lock" : (drillIcon as any)}
                            size={isDrillDone ? 16 : 14}
                            color={isDrillDone ? "#FFFFFF" : isLocked ? "#64748B" : drillColor}
                          />
                        </View>
                      )}
                      <Text
                        style={[
                          styles.stageOrbLabel,
                          isDrillDone && styles.stageOrbLabelDone,
                          isCurrentActive && styles.stageOrbLabelCurrent,
                          isLocked && styles.stageOrbLabelLocked,
                        ]}
                        numberOfLines={1}
                      >
                        {DRILL_SHORT_NAMES[drill.format_type] || `S${dIdx + 1}`}
                      </Text>
                    </TouchableOpacity>
                  </React.Fragment>
                );
              })}
            </View>
          </View>
        )}

        {/* Progress Bar & Stats */}
        {!isLocked && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBarTrack}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${pct}%` },
                  isCompleted && styles.progressBarFillCompleted,
                ]}
              />
            </View>
            <View style={styles.progressStatsRow}>
              <Text style={styles.progressStatsText}>
                {completedCount} of {drills.length} stages completed
              </Text>
              <Text
                style={[
                  styles.progressPctText,
                  isCompleted && styles.progressPctTextCompleted,
                ]}
              >
                {Math.round(pct)}%
              </Text>
            </View>
          </View>
        )}

        {/* 3D Gaming CTA Button */}
        {!isLocked && (
          <Animated.View style={{ transform: [{ scale: ctaScaleAnim }] }}>
            <TouchableOpacity
              onPress={handleCtaPress}
              onPressIn={handleCtaPressIn}
              onPressOut={handleCtaPressOut}
              activeOpacity={0.9}
              style={[styles.ctaButton, isCompleted && styles.ctaButtonCompleted]}
            >
              <MaterialCommunityIcons
                name={isCompleted ? "replay" : "play"}
                size={18}
                color="#FFFFFF"
              />
              <Text style={styles.ctaButtonText}>
                {isCompleted
                  ? "REPLAY CHAPTER DRILLS"
                  : completedCount > 0
                  ? `CONTINUE: ${nextDrill?.title?.toUpperCase() || "NEXT DRILL"}`
                  : `START: ${nextDrill?.title?.toUpperCase() || "MISSION"}`}
              </Text>
              {!isCompleted && nextDrill?.base_xp && (
                <View style={styles.ctaXpTag}>
                  <Text style={styles.ctaXpTagText}>+{nextDrill.base_xp} XP</Text>
                </View>
              )}
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Locked Banner if Locked */}
        {isLocked && (
          <View style={styles.lockedBanner}>
            <MaterialCommunityIcons name="lock-clock" size={16} color="#64748B" />
            <Text style={styles.lockedBannerText}>
              Complete Chapter {sprintIdx} to unlock this arena quest
            </Text>
          </View>
        )}

        {/* Accordion Toggle Bar */}
        {!isLocked && drills.length > 0 && (
          <TouchableOpacity
            onPress={handleToggle}
            activeOpacity={0.7}
            style={styles.toggleBar}
          >
            <Text style={[styles.toggleBarText, isExpanded && styles.toggleBarTextActive]}>
              {isExpanded ? "Hide All Stages" : `View All ${drills.length} Stages`}
            </Text>
            <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
              <MaterialCommunityIcons
                name="chevron-down"
                size={18}
                color={isExpanded ? "#A855F7" : "#94A3B8"}
              />
            </Animated.View>
          </TouchableOpacity>
        )}
      </View>

      {/* Expanded Drills Breakdown List */}
      {isExpanded && !isLocked && (
        <View style={styles.expandedDrillsList}>
          {drills.map((drill, idx) => {
            const isDrillCompleted = completedDrills.has(drill.drill_id);
            const isTargetDrill = drill.drill_id === nextDrill?.drill_id && !isDrillCompleted;
            const drillColor = DRILL_COLORS[drill.format_type] || "#A855F7";
            const drillIcon = DRILL_ICONS[drill.format_type] || "gamepad-variant";

            return (
              <TouchableOpacity
                key={drill.drill_id}
                style={[
                  styles.drillRowCard,
                  isDrillCompleted && styles.drillRowCardCompleted,
                  isTargetDrill && styles.drillRowCardTarget,
                ]}
                onPress={() => onOpenDrill(drill, sprint)}
                activeOpacity={0.75}
              >
                {/* Left Badge Node */}
                <View
                  style={[
                    styles.drillRowNode,
                    isDrillCompleted
                      ? styles.drillRowNodeCompleted
                      : isTargetDrill
                      ? styles.drillRowNodeTarget
                      : { borderColor: drillColor + "55", backgroundColor: drillColor + "15" },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={isDrillCompleted ? "check" : (drillIcon as any)}
                    size={17}
                    color={isDrillCompleted || isTargetDrill ? "#FFFFFF" : drillColor}
                  />
                </View>

                {/* Drill Text Info */}
                <View style={styles.drillRowInfo}>
                  <View style={styles.drillRowMeta}>
                    <View
                      style={[
                        styles.formatMiniDot,
                        { backgroundColor: isDrillCompleted ? "#10B981" : drillColor },
                      ]}
                    />
                    <Text
                      style={[
                        styles.drillRowType,
                        { color: isDrillCompleted ? "#10B981" : drillColor },
                      ]}
                    >
                      {drill.format_type.replace(/_/g, " ")}
                    </Text>
                    <Text style={styles.drillRowStageIndex}>• Stage {idx + 1}</Text>
                  </View>
                  <Text style={styles.drillRowTitle} numberOfLines={2}>
                    {drill.title}
                  </Text>
                </View>

                {/* Right XP & Action Arrow */}
                <View style={styles.drillRowRight}>
                  <View
                    style={[
                      styles.drillRowXpBadge,
                      isDrillCompleted && styles.drillRowXpBadgeCompleted,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="star-four-points"
                      size={10}
                      color={isDrillCompleted ? "#10B981" : "#A855F7"}
                    />
                    <Text
                      style={[
                        styles.drillRowXpText,
                        isDrillCompleted && styles.drillRowXpTextCompleted,
                      ]}
                    >
                      {isDrillCompleted ? "Earned" : `+${drill.base_xp}`}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.drillRowArrow,
                      isTargetDrill && styles.drillRowArrowTarget,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={isDrillCompleted ? "replay" : isTargetDrill ? "play" : "chevron-right"}
                      size={14}
                      color={isTargetDrill ? "#FFFFFF" : isDrillCompleted ? "#10B981" : "#94A3B8"}
                    />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
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

  const completedDrills = new Set((profile?.completed_drills || []).map((d) => d.drill_id));

  // Automatically expand the current active sprint on load
  useEffect(() => {
    if (sprints.length > 0 && expandedSprints.size === 0) {
      const firstActive =
        sprints.find((s) => {
          const drills = s.gamification_drills || [];
          const count = drills.filter((d) => completedDrills.has(d.drill_id)).length;
          return count < drills.length;
        }) || sprints[0];

      if (firstActive) {
        setExpandedSprints(new Set([firstActive.sprint_id]));
      }
    }
  }, [sprints]);

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
        <Text style={styles.loadingText}>Loading arena campaign...</Text>
      </View>
    );
  }

  if (sprints.length === 0) {
    return (
      <View style={styles.center}>
        <View style={styles.emptyIconCircle}>
          <MaterialCommunityIcons name="sword-cross" size={40} color="#A855F7" />
        </View>
        <Text style={styles.emptyTitle}>No Campaigns Active</Text>
        <Text style={styles.emptySubtitle}>
          Complete your assigned training modules to unlock new Arena quests and earn XP!
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
        const isExpanded = expandedSprints.has(sprint.sprint_id);
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
          <SprintCard
            key={sprint.sprint_id}
            sprint={sprint}
            sprintIdx={sprintIdx}
            isLocked={isLocked}
            isExpanded={isExpanded}
            onToggle={toggleSprint}
            completedDrills={completedDrills}
            onOpenDrill={openDrill}
          />
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 18,
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
    width: 80,
    height: 80,
    borderRadius: 40,
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

  // --- Sprint Card ---
  sprintCard: {
    backgroundColor: "#2C2C35",
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.08)",
    overflow: "hidden",
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  sprintCardActive: {
    borderColor: "rgba(168, 85, 247, 0.45)",
    backgroundColor: "#2B293A",
  },
  sprintCardCompleted: {
    borderColor: "rgba(16, 185, 129, 0.4)",
    backgroundColor: "#262C2F",
  },
  sprintCardLocked: {
    opacity: 0.6,
    backgroundColor: "#22222B",
  },

  // Watermark
  hugeWatermarkWrap: {
    position: "absolute",
    right: 12,
    top: 6,
    zIndex: 0,
  },
  hugeWatermarkText: {
    fontSize: 84,
    fontWeight: "900",
    color: "rgba(255, 255, 255, 0.04)",
  },

  cardContent: {
    padding: 18,
    zIndex: 1,
  },

  // Top Meta Row
  topMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  chipActive: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9,
    backgroundColor: "rgba(168, 85, 247, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.35)",
  },
  chipActiveText: {
    color: "#C084FC",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  chipCompleted: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9,
    backgroundColor: "rgba(16, 185, 129, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.35)",
  },
  chipCompletedText: {
    color: "#10B981",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  chipLocked: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  chipLockedText: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
  },

  // XP Pill
  xpPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
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
  xpPillText: {
    color: "#A855F7",
    fontSize: 11,
    fontWeight: "900",
  },
  xpPillTextCompleted: {
    color: "#10B981",
  },
  xpPillTextLocked: {
    color: "#64748B",
  },

  // Sprint Title
  sprintTitle: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "900",
    lineHeight: 25,
    letterSpacing: 0.2,
    marginBottom: 4,
  },
  textMuted: {
    color: "#64748B",
  },

  // Mission Briefing Box
  briefingBox: {
    backgroundColor: "rgba(0, 0, 0, 0.24)",
    borderRadius: 14,
    padding: 12,
    borderLeftWidth: 3.5,
    borderLeftColor: "#A855F7",
    marginTop: 8,
    marginBottom: 14,
  },
  briefingBoxCompleted: {
    borderLeftColor: "#10B981",
  },
  briefingBoxLocked: {
    borderLeftColor: "#475569",
  },
  briefingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 5,
  },
  briefingLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#A855F7",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  briefingText: {
    fontSize: 13,
    color: "#CBD5E1",
    lineHeight: 19,
    fontWeight: "500",
  },

  // Roadmap Section
  roadmapSection: {
    marginVertical: 10,
    paddingVertical: 6,
  },
  roadmapTrackRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  roadmapConnector: {
    flex: 1,
    height: 3,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 1.5,
    marginHorizontal: 4,
    marginBottom: 18,
  },
  roadmapConnectorDone: {
    backgroundColor: "#10B981",
  },
  roadmapConnectorActive: {
    backgroundColor: "#A855F7",
  },
  roadmapConnectorLocked: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  stageOrbTouchable: {
    alignItems: "center",
    gap: 4,
  },
  stageOrb: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    backgroundColor: "#202029",
  },
  stageOrbDone: {
    backgroundColor: "#10B981",
    borderColor: "#10B981",
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 3,
  },
  stageOrbCurrent: {
    backgroundColor: "#7C3AED",
    borderColor: "#C084FC",
    borderWidth: 2.5,
    shadowColor: "#A855F7",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
  },
  stageOrbLocked: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderColor: "rgba(255, 255, 255, 0.07)",
  },
  stageOrbLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#94A3B8",
    maxWidth: 52,
    textAlign: "center",
  },
  stageOrbLabelDone: {
    color: "#10B981",
    fontWeight: "800",
  },
  stageOrbLabelCurrent: {
    color: "#C084FC",
    fontWeight: "800",
  },
  stageOrbLabelLocked: {
    color: "#475569",
  },

  // Progress Bar
  progressContainer: {
    gap: 7,
    marginTop: 4,
    marginBottom: 12,
  },
  progressBarTrack: {
    height: 7,
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    borderRadius: 6,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#A855F7",
    borderRadius: 6,
  },
  progressBarFillCompleted: {
    backgroundColor: "#10B981",
  },
  progressStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressStatsText: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "600",
  },
  progressPctText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  progressPctTextCompleted: {
    color: "#10B981",
  },

  // 3D Gaming CTA Button
  ctaButton: {
    height: 48,
    borderRadius: 14,
    backgroundColor: "#7C3AED",
    borderBottomWidth: 3.5,
    borderBottomColor: "#4C1D95",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  ctaButtonCompleted: {
    backgroundColor: "#059669",
    borderBottomColor: "#064E3B",
    shadowColor: "#059669",
  },
  ctaButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  ctaXpTag: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  ctaXpTagText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
  },

  // Locked Banner
  lockedBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    borderRadius: 12,
    marginTop: 8,
  },
  lockedBannerText: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "700",
  },

  // Toggle Bar
  toggleBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingTop: 14,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
  },
  toggleBarText: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  toggleBarTextActive: {
    color: "#C084FC",
    fontWeight: "800",
  },

  // Expanded Drills List
  expandedDrillsList: {
    backgroundColor: "#1E1E28",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.07)",
    padding: 14,
    gap: 10,
  },
  drillRowCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#282833",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    gap: 12,
  },
  drillRowCardCompleted: {
    borderColor: "rgba(16, 185, 129, 0.25)",
    backgroundColor: "#1D2626",
  },
  drillRowCardTarget: {
    borderColor: "rgba(168, 85, 247, 0.4)",
    backgroundColor: "#2B2638",
  },
  drillRowNode: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
  },
  drillRowNodeCompleted: {
    backgroundColor: "#10B981",
    borderColor: "#10B981",
  },
  drillRowNodeTarget: {
    backgroundColor: "#7C3AED",
    borderColor: "#C084FC",
  },
  drillRowInfo: {
    flex: 1,
    gap: 3,
  },
  drillRowMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  formatMiniDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  drillRowType: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  drillRowStageIndex: {
    color: "#64748B",
    fontSize: 10,
    fontWeight: "600",
  },
  drillRowTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  drillRowRight: {
    alignItems: "flex-end",
    gap: 6,
  },
  drillRowXpBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: "rgba(168, 85, 247, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.25)",
  },
  drillRowXpBadgeCompleted: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  drillRowXpText: {
    color: "#A855F7",
    fontSize: 11,
    fontWeight: "900",
  },
  drillRowXpTextCompleted: {
    color: "#10B981",
  },
  drillRowArrow: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    justifyContent: "center",
    alignItems: "center",
  },
  drillRowArrowTarget: {
    backgroundColor: "#7C3AED",
  },
});
