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
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { GC } from "./drills/GamificationColors";
import { useSubmitDrillProgress } from "../../../api/gamification/Hooks";
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
  const { drill, sprintId, isCompleted, earnedXp } =
    route.params as DrillPlayerParams;

  const { submit, isSubmitting } = useSubmitDrillProgress();

  // Card flip animation
  const flipAnim = useRef(new Animated.Value(0)).current;
  const [flipDone, setFlipDone] = useState(false);

  // XP celebration
  const [celebVisible, setCelebVisible] = useState(false);
  const [finalXp, setFinalXp] = useState(0);
  const [newBadges, setNewBadges] = useState<any[]>([]);
  const xpCountAnim = useRef(new Animated.Value(0)).current;
  const celebScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Trigger card flip on mount
    setTimeout(() => {
      Animated.timing(flipAnim, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }).start(() => setFlipDone(true));
    }, 100);
  }, []);

  const frontRotate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "90deg"],
  });
  const backRotate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["-90deg", "0deg"],
  });

  const handleDrillComplete = async (wrong_attempts: number, completion_time_seconds: number) => {
    const res = await submit({
      sprint_id: sprintId,
      drill_id: drill.drill_id,
      completed: true,
      wrong_attempts,
      completion_time_seconds,
    });

    if (res) {
      setFinalXp(res.earned_xp);
      setNewBadges(res.new_badges || []);
      eventBus.emit("drill_completed", { drillId: drill.drill_id, result: res });
      showCelebration(res.earned_xp);
    }
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
          <MaterialCommunityIcons name="arrow-left" size={22} color={GC.textPrimary} />
        </TouchableOpacity>
        <View style={styles.drillMeta}>
          <View style={[styles.drillTypeChip, { borderColor: drillMeta.color }]}>
            <MaterialCommunityIcons
              name={drillMeta.icon as any}
              size={12}
              color={drillMeta.color}
            />
            <Text style={[styles.drillTypeLabel, { color: drillMeta.color }]}>
              {drillMeta.label}
            </Text>
          </View>
        </View>
        <View style={styles.xpPill}>
          <MaterialCommunityIcons name="star-four-points" size={12} color={GC.gold} />
          <Text style={styles.xpPillText}>
            {isCompleted ? (earnedXp || 0) : drill.base_xp} XP
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Drill title */}
        <Text style={styles.drillTitle}>{drill.title}</Text>

        {/* Card flip reveal */}
        {!flipDone ? (
          <>
            {/* Front face (loading card) */}
            <Animated.View
              style={[
                styles.flipCard,
                { transform: [{ rotateY: frontRotate }] },
              ]}
            >
              <MaterialCommunityIcons
                name={drillMeta.icon as any}
                size={48}
                color={drillMeta.color}
              />
              <Text style={styles.flipCardLabel}>{drillMeta.label}</Text>
            </Animated.View>
          </>
        ) : (
          <Animated.View
            style={[
              styles.drillContainer,
              { transform: [{ rotateY: backRotate }] },
              flipDone && { transform: [] },
            ]}
          >
            {renderDrill()}
          </Animated.View>
        )}

        {isCompleted && (
          <View style={styles.completedBanner}>
            <MaterialCommunityIcons name="check-circle" size={18} color={GC.success} />
            <Text style={styles.completedBannerText}>
              Already completed! Earned {earnedXp || 0} XP
            </Text>
          </View>
        )}
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
            <Text style={styles.celebEmoji}>?</Text>
            <Text style={styles.celebTitle}>DRILL COMPLETE!</Text>
            <Animated.Text style={styles.celebXp}>
              +{finalXp} XP
            </Animated.Text>

            {newBadges.length > 0 && (
              <View style={styles.newBadgesSection}>
                <Text style={styles.newBadgesLabel}>?? NEW BADGE{newBadges.length > 1 ? "S" : ""} UNLOCKED!</Text>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: GC.border,
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: GC.card,
    borderWidth: 1,
    borderColor: GC.border,
    justifyContent: "center",
    alignItems: "center",
  },
  drillMeta: { flex: 1 },
  drillTypeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
    backgroundColor: GC.card,
  },
  drillTypeLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  xpPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#1C1200",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: GC.gold,
  },
  xpPillText: { color: GC.gold, fontSize: 12, fontWeight: "900" },
  scrollContent: { padding: 20, gap: 20 },
  drillTitle: {
    color: GC.textPrimary,
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 28,
  },
  flipCard: {
    height: 200,
    backgroundColor: GC.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: GC.primaryBorder,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    backfaceVisibility: "hidden",
  },
  flipCardLabel: {
    color: GC.textSecondary,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 1,
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
