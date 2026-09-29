import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  Modal,
  Dimensions,
  StatusBar,
  Platform,
  Easing,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { GC } from "./drills/GamificationColors";
import { useSubmitDrillProgress, useGamificationProfile } from "../../../api/gamification/Hooks";
import { GamificationDrill, GamificationProfile } from "../../../api/gamification/Request";
import VibeCheckDrill from "./drills/VibeCheckDrill";
import RiskRizzDrill from "./drills/RiskRizzDrill";
import FillBlanksDrill from "./drills/FillBlanksDrill";
import FlowMasterDrill from "./drills/FlowMasterDrill";
import CodeBreakerDrill from "./drills/CodeBreakerDrill";
import AuditSpotterDrill from "./drills/AuditSpotterDrill";
import SpeedRunDrill from "./drills/SpeedRunDrill";
import { eventBus } from "../../../utils/EventBus";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const DRILL_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  VIBE_CHECK: { label: "Vibe Check", icon: "head-heart-outline", color: "#8B5CF6" },
  RISK_RIZZ: { label: "Risk Rizz", icon: "card-multiple", color: "#EF4444" },
  FILL_BLANKS: { label: "Fill Blanks", icon: "text-box-edit-outline", color: "#3B82F6" },
  FLOW_MASTER: { label: "Flow Master", icon: "sitemap", color: "#10B981" },
  CODE_BREAKER: { label: "Code Breaker", icon: "lock-open-variant-outline", color: "#F59E0B" },
  AUDIT_SPOTTER: { label: "Audit Spotter", icon: "file-find-outline", color: "#EF4444" },
  SPEED_RUN: { label: "Speed Run", icon: "lightning-bolt", color: "#F59E0B" },
};

export interface DrillPlayerParams {
  drill: GamificationDrill;
  sprintId: string;
  isCompleted: boolean;
  earnedXp?: number;
  profile?: GamificationProfile | null;
}

export default function DrillPlayerScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { drill, sprintId, isCompleted, earnedXp, profile: passedProfile } =
    route.params as DrillPlayerParams;

  const { data: profileData, fetch: fetchProfile } = useGamificationProfile();
  const activeProfile = profileData || passedProfile;
  const [sessionEarnedXp, setSessionEarnedXp] = useState<number | null>(null);

  const profileCompletedDrill = activeProfile?.completed_drills?.find(
    (d) => d.drill_id === drill.drill_id
  );
  const isDrillCompleted = isCompleted || sessionEarnedXp !== null || !!profileCompletedDrill;

  const actualDrillXp =
    sessionEarnedXp ??
    earnedXp ??
    profileCompletedDrill?.earned_xp ??
    drill.base_xp;

  const totalUserXp = activeProfile?.total_xp ?? 0;

  const { submit, isSubmitting } = useSubmitDrillProgress();

  // Fluid entrance animation (clean fade + spring slide, zero jitter)
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(18)).current;

  // XP celebration
  const [celebVisible, setCelebVisible] = useState(false);
  const [finalXp, setFinalXp] = useState(0);
  const [newBadges, setNewBadges] = useState<any[]>([]);
  const xpCountAnim = useRef(new Animated.Value(0)).current;
  const celebScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchProfile(true);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 65,
        friction: 9,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fetchProfile]);

  const handleDrillComplete = (wrong_attempts: number, completion_time_seconds: number) => {
    // Exact XP logic matching Backend GamificationService:
    // streak multiplier = min(1.0 + (streak_days // 3) * 0.1, 1.5)
    // penalty = wrong_attempts * 25
    // earned_xp = int(max(base_xp - penalty, 50) * multiplier)
    const streakDays = activeProfile?.current_streak_days ?? 0;
    const streakMultiplier = Math.min(1.0 + Math.floor(streakDays / 3) * 0.1, 1.5);
    const penalty = wrong_attempts * 25;
    const baseXp = drill.base_xp || 50;
    const expectedXp = Math.floor(Math.max(baseXp - penalty, 50) * streakMultiplier);

    setSessionEarnedXp(expectedXp);
    setFinalXp(expectedXp);
    showCelebration(expectedXp);

    // Emit completion event immediately
    eventBus.emit("drill_completed", {
      drillId: drill.drill_id,
      result: { earned_xp: expectedXp },
    });

    // Run backend submission concurrently in the background
    submit({
      sprint_id: sprintId,
      drill_id: drill.drill_id,
      completed: true,
      wrong_attempts,
      completion_time_seconds,
    })
      .then((res) => {
        if (res) {
          const serverXp = res.earned_xp !== undefined ? res.earned_xp : expectedXp;
          setSessionEarnedXp(serverXp);
          if (res.earned_xp !== undefined && res.earned_xp !== expectedXp) {
            setFinalXp(res.earned_xp);
          }
          if (res.new_badges && res.new_badges.length > 0) {
            setNewBadges(res.new_badges);
          }
          eventBus.emit("drill_completed", { drillId: drill.drill_id, result: res });
          fetchProfile(true);
        }
      })
      .catch(() => {});
  };

  const showCelebration = (xp: number) => {
    setCelebVisible(true);
    Animated.parallel([
      Animated.spring(celebScale, {
        toValue: 1,
        useNativeDriver: true,
        damping: 12,
        stiffness: 180,
      }),
      Animated.timing(xpCountAnim, {
        toValue: xp,
        duration: 1200,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const drillMeta = DRILL_LABELS[drill.format_type] || DRILL_LABELS.VIBE_CHECK;

  const renderDrill = () => {
    const commonProps = {
      drillData: drill.content_payload,
      isCompleted: isCompleted,
      earnedXp: earnedXp,
      onComplete: handleDrillComplete,
    };
    switch (drill.format_type) {
      case "VIBE_CHECK": return <VibeCheckDrill {...commonProps} />;
      case "RISK_RIZZ": return <RiskRizzDrill {...commonProps} />;
      case "FILL_BLANKS": return <FillBlanksDrill {...commonProps} />;
      case "FLOW_MASTER": return <FlowMasterDrill {...commonProps} />;
      case "CODE_BREAKER": return <CodeBreakerDrill {...commonProps} />;
      case "AUDIT_SPOTTER": return <AuditSpotterDrill {...commonProps} />;
      case "SPEED_RUN": return <SpeedRunDrill {...commonProps} />;
      default: return <VibeCheckDrill {...commonProps} />;
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={GC.bg} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="arrow-left" size={20} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Drill Name: Clean, simple text, no badge box, no colors */}
        <View style={styles.headerCenter}>
          <Text style={styles.headerDrillName} numberOfLines={1}>
            {drillMeta.label}
          </Text>
        </View>

        {/* Right side: Total XP + Drill XP */}
        <View style={styles.headerRight}>
          {/* Total user XP */}
          <View style={styles.totalXpPill}>
            <MaterialCommunityIcons name="star-four-points" size={11} color="#C084FC" />
            <Text style={styles.totalXpText}>
              {totalUserXp.toLocaleString()} XP
            </Text>
          </View>

          {/* Drill XP: Actual earned if completed, or base XP */}
          <View
            style={[
              styles.drillXpPill,
              isDrillCompleted && styles.drillXpPillCompleted,
            ]}
          >
            <MaterialCommunityIcons
              name={isDrillCompleted ? "check-decagram" : "star-four-points"}
              size={11}
              color={isDrillCompleted ? "#10B981" : "#FCD34D"}
            />
            <Text
              style={[
                styles.drillXpText,
                isDrillCompleted && styles.drillXpTextCompleted,
              ]}
            >
              +{actualDrillXp} XP
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Drill title */}
        <Text style={styles.drillTitle}>{drill.title}</Text>

        {/* Fluid entrance container (smooth fade + spring glide) */}
        <Animated.View
          style={[
            styles.drillContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {renderDrill()}
        </Animated.View>

        {/* {isCompleted && (
          <View style={styles.completedBanner}>
            <MaterialCommunityIcons name="check-circle" size={18} color={GC.success} />
            <Text style={styles.completedBannerText}>
              Already completed! Earned {earnedXp || 0} XP
            </Text>
          </View>
        )} */}
      </ScrollView>

      {/* XP Celebration Modal */}
      <Modal
        visible={celebVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View style={styles.celebOverlay}>
          <Animated.View
            style={[
              styles.celebCard,
              { transform: [{ scale: celebScale }] },
            ]}
          >
            <Text style={styles.celebEmoji}>🎉</Text>
            <Text style={styles.celebTitle}>DRILL COMPLETE!</Text>
            <Animated.Text style={styles.celebXp}>
              +{finalXp} XP
            </Animated.Text>

            {newBadges.length > 0 && (
              <View style={styles.newBadgesSection}>
                <Text style={styles.newBadgesLabel}>✨ NEW BADGE{newBadges.length > 1 ? "S" : ""} UNLOCKED!</Text>
                {newBadges.map((b, i) => (
                  <Text key={i} style={styles.badgeName}>
                    {b.badge_title || b.badge_key}
                  </Text>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={styles.continueBtn}
              onPress={() => {
                setCelebVisible(false);
                navigation.goBack();
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.continueBtnText}>CONTINUE</Text>
              <MaterialCommunityIcons name="arrow-right" size={18} color={GC.bg} />
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: GC.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: GC.border,
    gap: 8,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: GC.card,
    borderWidth: 1,
    borderColor: GC.border,
    justifyContent: "center",
    alignItems: "center",
  },
  headerCenter: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  headerDrillName: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  totalXpPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(168, 85, 247, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.25)",
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 5,
  },
  totalXpText: {
    color: "#E9D5FF",
    fontSize: 11,
    fontWeight: "800",
  },
  drillXpPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(252, 211, 77, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(252, 211, 77, 0.28)",
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 5,
  },
  drillXpPillCompleted: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderColor: "rgba(16, 185, 129, 0.28)",
  },
  drillXpText: {
    color: "#FCD34D",
    fontSize: 11,
    fontWeight: "800",
  },
  drillXpTextCompleted: {
    color: "#10B981",
  },
  scrollContent: { padding: 20, gap: 20 },
  drillTitle: {
    color: GC.textPrimary,
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 28,
  },
  drillContainer: { gap: 16 },
  completedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#052E16",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: GC.success,
    marginTop: 8,
  },
  completedBannerText: {
    color: GC.success,
    fontSize: 14,
    fontWeight: "700",
  },
  celebOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  celebCard: {
    backgroundColor: GC.surface,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: GC.primary,
    padding: 32,
    alignItems: "center",
    gap: 16,
    width: "100%",
    shadowColor: GC.primaryGlow,
    shadowOpacity: 0.6,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
    elevation: 20,
  },
  celebEmoji: { fontSize: 52 },
  celebTitle: {
    color: GC.textPrimary,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 2,
  },
  celebXp: {
    color: GC.gold,
    fontSize: 40,
    fontWeight: "900",
    letterSpacing: 1,
  },
  newBadgesSection: {
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1C1200",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: GC.gold,
    width: "100%",
  },
  newBadgesLabel: {
    color: GC.gold,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1,
  },
  badgeName: {
    color: GC.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  continueBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: GC.primary,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: "100%",
    marginTop: 8,
  },
  continueBtnText: {
    color: GC.bg,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 2,
  },
});
