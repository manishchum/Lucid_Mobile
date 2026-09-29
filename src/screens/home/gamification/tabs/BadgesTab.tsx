import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Animated,
  Modal,
  TouchableOpacity,
  useWindowDimensions,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Svg, {
  Polygon,
  Path,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import {
  GamificationProfile,
  UnlockedBadge,
} from "../../../../api/gamification/Request";

interface CoreBadge {
  id: string;
  title: string;
  category: string;
  desc: string;
  icon: string;
  color: string;
}

const CORE_BADGES: CoreBadge[] = [
  {
    id: "badge_1",
    title: "Main Character",
    category: "DRILL MILESTONE",
    desc: "Complete your 1st drill",
    icon: "book-open-variant",
    color: "#8B5CF6",
  },
  {
    id: "badge_2",
    title: "Locked In",
    category: "DRILL MILESTONE",
    desc: "Complete 10 drills",
    icon: "shield-check",
    color: "#3B82F6",
  },
  {
    id: "badge_3",
    title: "G.O.A.T. Certified",
    category: "DRILL MILESTONE",
    desc: "Complete 25 drills",
    icon: "trophy",
    color: "#F59E0B",
  },
  {
    id: "badge_4",
    title: "On Fire",
    category: "STREAK MILESTONE",
    desc: "Maintain a 7-day streak",
    icon: "fire",
    color: "#EF4444",
  },
  {
    id: "badge_5",
    title: "Unstoppable",
    category: "STREAK MILESTONE",
    desc: "Maintain a 14-day streak",
    icon: "lightning-bolt",
    color: "#A855F7",
  },
  {
    id: "badge_6",
    title: "XP Billionaire",
    category: "XP MILESTONE",
    desc: "Reach 5,000+ total XP",
    icon: "star-four-points",
    color: "#10B981",
  },
];

type BadgeShapeType = "hexagon" | "flame" | "octagon";

interface BadgeDesignMeta {
  metricNumber: string;
  metricLabel: string;
  shape: BadgeShapeType;
  numberFontSize: number;
  labelFontSize: number;
  numberY: number;
  labelY: number;
}

const BADGE_DESIGNS: Record<string, BadgeDesignMeta> = {
  // All Drill Milestones share the exact same HEXAGON silhouette, with progressive colors
  badge_1: {
    metricNumber: "1",
    metricLabel: "DRILL",
    shape: "hexagon",
    numberFontSize: 30,
    labelFontSize: 8.5,
    numberY: 48,
    labelY: 65,
  },
  badge_2: {
    metricNumber: "10",
    metricLabel: "DRILLS",
    shape: "hexagon",
    numberFontSize: 25,
    labelFontSize: 7.5,
    numberY: 48,
    labelY: 64,
  },
  badge_3: {
    metricNumber: "25",
    metricLabel: "DRILLS",
    shape: "hexagon",
    numberFontSize: 25,
    labelFontSize: 7.5,
    numberY: 48,
    labelY: 64,
  },
  // All Streak Milestones share the FLAME shape with calibrated margins to prevent overflow
  badge_4: {
    metricNumber: "7d",
    metricLabel: "STREAK",
    shape: "flame",
    numberFontSize: 20,
    labelFontSize: 7,
    numberY: 57,
    labelY: 70,
  },
  badge_5: {
    metricNumber: "14d",
    metricLabel: "STREAK",
    shape: "flame",
    numberFontSize: 18,
    labelFontSize: 7,
    numberY: 57,
    labelY: 70,
  },
  // XP Milestone has the brilliant-cut OCTAGON shape
  badge_6: {
    metricNumber: "5K",
    metricLabel: "XP",
    shape: "octagon",
    numberFontSize: 24,
    labelFontSize: 8.5,
    numberY: 48,
    labelY: 64,
  },
};

const getBadgeDesign = (id: string): BadgeDesignMeta => {
  if (BADGE_DESIGNS[id]) return BADGE_DESIGNS[id];
  return {
    metricNumber: "★",
    metricLabel: "BADGE",
    shape: "hexagon",
    numberFontSize: 24,
    labelFontSize: 8,
    numberY: 48,
    labelY: 64,
  };
};

const getDarkenedColor = (color: string) => {
  switch (color) {
    case "#8B5CF6":
      return "#4C1D95";
    case "#3B82F6":
      return "#1E3A8A";
    case "#F59E0B":
      return "#78350F";
    case "#EF4444":
      return "#7F1D1D";
    case "#A855F7":
      return "#581C87";
    case "#10B981":
      return "#064E3B";
    default:
      return "#1A1A24";
  }
};

interface MetallicMedallionProps {
  badge: CoreBadge;
  isUnlocked: boolean;
  size?: number;
}

const MetallicMedallion = ({
  badge,
  isUnlocked,
  size = 96,
}: MetallicMedallionProps) => {
  const design = getBadgeDesign(badge.id);
  const gradId = `${badge.id}_${size}_${isUnlocked ? "unlocked" : "locked"}`;

  return (
    <View
      style={[
        { width: size, height: size, position: "relative" },
        isUnlocked && styles.glowEffect,
      ]}
    >
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          {/* Polished Gold Metallic Bezel */}
          <SvgLinearGradient
            id={`goldOuter_${gradId}`}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <Stop offset="0%" stopColor="#FFF7C2" />
            <Stop offset="25%" stopColor="#F5D061" />
            <Stop offset="50%" stopColor="#9C6B16" />
            <Stop offset="75%" stopColor="#FDE68A" />
            <Stop offset="100%" stopColor="#C99424" />
          </SvgLinearGradient>

          {/* 3D Bevel Inner Ridge */}
          <SvgLinearGradient
            id={`goldRidge_${gradId}`}
            x1="0%"
            y1="0%"
            x2="0%"
            y2="100%"
          >
            <Stop offset="0%" stopColor="#784B08" />
            <Stop offset="100%" stopColor="#FFEAA7" />
          </SvgLinearGradient>

          {/* Locked Gunmetal Outer Rim */}
          <SvgLinearGradient
            id={`lockedOuter_${gradId}`}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <Stop offset="0%" stopColor="#4A4A5A" />
            <Stop offset="50%" stopColor="#2A2A34" />
            <Stop offset="100%" stopColor="#3E3E4C" />
          </SvgLinearGradient>

          {/* Locked Inset Ridge */}
          <SvgLinearGradient
            id={`lockedRidge_${gradId}`}
            x1="0%"
            y1="0%"
            x2="0%"
            y2="100%"
          >
            <Stop offset="0%" stopColor="#1E1E26" />
            <Stop offset="100%" stopColor="#383846" />
          </SvgLinearGradient>

          {/* Unlocked Enamel Face */}
          <SvgLinearGradient
            id={`enamel_${gradId}`}
            x1="0%"
            y1="0%"
            x2="0%"
            y2="100%"
          >
            <Stop offset="0%" stopColor={badge.color} />
            <Stop offset="100%" stopColor={getDarkenedColor(badge.color)} />
          </SvgLinearGradient>

          {/* Locked Enamel Face */}
          <SvgLinearGradient
            id={`lockedEnamel_${gradId}`}
            x1="0%"
            y1="0%"
            x2="0%"
            y2="100%"
          >
            <Stop offset="0%" stopColor="#242430" />
            <Stop offset="100%" stopColor="#171720" />
          </SvgLinearGradient>

          {/* Engraved Metallic Text Gradient */}
          <SvgLinearGradient
            id={`engravedGold_${gradId}`}
            x1="0%"
            y1="0%"
            x2="0%"
            y2="100%"
          >
            <Stop offset="0%" stopColor="#FFFDF0" />
            <Stop offset="60%" stopColor="#FDE68A" />
            <Stop offset="100%" stopColor="#E5B942" />
          </SvgLinearGradient>
        </Defs>

        {/* 1. Hexagon (Consistent across all Drill Milestones) */}
        {design.shape === "hexagon" && (
          <>
            <Polygon
              points="50,4 92,26 92,74 50,96 8,74 8,26"
              fill={`url(#${isUnlocked ? `goldOuter_${gradId}` : `lockedOuter_${gradId}`})`}
            />
            <Polygon
              points="50,9 87,28 87,72 50,91 13,72 13,28"
              fill={`url(#${isUnlocked ? `goldRidge_${gradId}` : `lockedRidge_${gradId}`})`}
            />
            <Polygon
              points="50,14 83,31 83,69 50,86 17,69 17,31"
              fill={`url(#${isUnlocked ? `enamel_${gradId}` : `lockedEnamel_${gradId}`})`}
            />
            {isUnlocked && (
              <Polygon
                points="50,14 83,31 75,34 50,20 25,34 17,31"
                fill="rgba(255,255,255,0.25)"
              />
            )}
          </>
        )}

        {/* 2. Flame Teardrop (Consistent across all Streak Milestones - Wide Belly) */}
        {design.shape === "flame" && (
          <>
            <Path
              d="M 50,3 C 68,22 93,46 93,68 C 93,87 74,97 50,97 C 26,97 7,87 7,68 C 7,46 32,22 50,3 Z"
              fill={`url(#${isUnlocked ? `goldOuter_${gradId}` : `lockedOuter_${gradId}`})`}
            />
            <Path
              d="M 50,8 C 64,25 88,47 88,68 C 88,83 71,92 50,92 C 29,92 12,83 12,68 C 12,47 36,25 50,8 Z"
              fill={`url(#${isUnlocked ? `goldRidge_${gradId}` : `lockedRidge_${gradId}`})`}
            />
            <Path
              d="M 50,13 C 60,28 83,49 83,68 C 83,80 68,87 50,87 C 32,87 17,80 17,68 C 17,49 40,28 50,13 Z"
              fill={`url(#${isUnlocked ? `enamel_${gradId}` : `lockedEnamel_${gradId}`})`}
            />
            {isUnlocked && (
              <Path
                d="M 50,13 C 58,25 72,36 74,45 C 67,34 57,26 50,20 Z"
                fill="rgba(255,255,255,0.28)"
              />
            )}
          </>
        )}

        {/* 3. Brilliant Cut Octagon (XP Milestones) */}
        {design.shape === "octagon" && (
          <>
            <Polygon
              points="28,4 72,4 96,28 96,72 72,96 28,96 4,72 4,28"
              fill={`url(#${isUnlocked ? `goldOuter_${gradId}` : `lockedOuter_${gradId}`})`}
            />
            <Polygon
              points="30,9 70,9 91,30 91,70 70,91 30,91 9,70 9,30"
              fill={`url(#${isUnlocked ? `goldRidge_${gradId}` : `lockedRidge_${gradId}`})`}
            />
            <Polygon
              points="32,14 68,14 86,32 86,68 68,86 32,86 14,68 14,32"
              fill={`url(#${isUnlocked ? `enamel_${gradId}` : `lockedEnamel_${gradId}`})`}
            />
            {isUnlocked && (
              <Polygon
                points="32,14 68,14 62,22 38,22"
                fill="rgba(255,255,255,0.28)"
              />
            )}
          </>
        )}

        {/* EMBEDDED / DEBOSSED TEXT EFFECT */}

        {/* 1. Top Recess Shadow (Sunken Cavity) */}
        <SvgText
          x="49.5"
          y={design.numberY - 1}
          textAnchor="middle"
          fill={isUnlocked ? "rgba(0, 0, 0, 0.6)" : "rgba(0, 0, 0, 0.75)"}
          fontSize={design.numberFontSize}
          fontWeight="900"
        >
          {design.metricNumber}
        </SvgText>

        {/* 2. Bottom Chiseled Bevel Highlight (Catches overhead light) */}
        <SvgText
          x="50"
          y={design.numberY + 1.2}
          textAnchor="middle"
          fill={isUnlocked ? "rgba(255, 248, 214, 0.55)" : "rgba(255, 255, 255, 0.15)"}
          fontSize={design.numberFontSize}
          fontWeight="900"
        >
          {design.metricNumber}
        </SvgText>

        {/* 3. Core Engraved Text Face */}
        <SvgText
          x="50"
          y={design.numberY}
          textAnchor="middle"
          fill={isUnlocked ? `url(#engravedGold_${gradId})` : "#64748B"}
          fontSize={design.numberFontSize}
          fontWeight="900"
        >
          {design.metricNumber}
        </SvgText>

        {/* Embedded Sub-Label */}
        {design.metricLabel && (
          <>
            {/* Label Shadow */}
            <SvgText
              x="49.5"
              y={design.labelY - 0.8}
              textAnchor="middle"
              fill={isUnlocked ? "rgba(0, 0, 0, 0.5)" : "rgba(0, 0, 0, 0.7)"}
              fontSize={design.labelFontSize}
              fontWeight="900"
              letterSpacing="1"
            >
              {design.metricLabel}
            </SvgText>

            {/* Label Bottom Highlight */}
            <SvgText
              x="50"
              y={design.labelY + 0.8}
              textAnchor="middle"
              fill={isUnlocked ? "rgba(255, 248, 214, 0.4)" : "rgba(255, 255, 255, 0.12)"}
              fontSize={design.labelFontSize}
              fontWeight="900"
              letterSpacing="1"
            >
              {design.metricLabel}
            </SvgText>

            {/* Label Core */}
            <SvgText
              x="50"
              y={design.labelY}
              textAnchor="middle"
              fill={isUnlocked ? "#FDE68A" : "#475569"}
              fontSize={design.labelFontSize}
              fontWeight="900"
              letterSpacing="1"
            >
              {design.metricLabel}
            </SvgText>
          </>
        )}
      </Svg>

      {/* Locked Overlay Badge */}
      {!isUnlocked && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={styles.lockedCenterBadge}>
            <View style={styles.lockIconCircle}>
              <MaterialCommunityIcons name="lock" size={16} color="#CBD5E1" />
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

interface BadgeItemProps {
  badge: CoreBadge;
  isUnlocked: boolean;
  colWidth: number;
  badgeSize: number;
  onPress: () => void;
}

const BadgeItem = ({
  badge,
  isUnlocked,
  colWidth,
  badgeSize,
  onPress,
}: BadgeItemProps) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.92,
      useNativeDriver: true,
      speed: 20,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 4,
    }).start();
  };

  const cleanTitle = badge.title
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "")
    .trim();

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.badgeItemContainer, { width: colWidth }]}
    >
      <Animated.View
        style={[
          styles.badgeItemInner,
          { transform: [{ scale: scaleAnim }] },
          !isUnlocked && styles.badgeLockedWrapper,
        ]}
      >
        <MetallicMedallion
          badge={badge}
          isUnlocked={isUnlocked}
          size={badgeSize}
        />
        <Text
          style={[styles.badgeName, !isUnlocked && styles.badgeNameLocked]}
          numberOfLines={2}
        >
          {cleanTitle}
        </Text>
      </Animated.View>
    </Pressable>
  );
};

interface Props {
  profile: GamificationProfile | null;
  isLoading: boolean;
}

export default function BadgesTab({ profile, isLoading }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const [selectedBadge, setSelectedBadge] = useState<CoreBadge | null>(null);

  const unlockedKeys = new Set(
    (profile?.unlocked_badges || []).map((b: UnlockedBadge) => b.badge_key)
  );

  // Merge any backend custom badges
  const allBadges: CoreBadge[] = [...CORE_BADGES];
  (profile?.unlocked_badges || []).forEach((ub: UnlockedBadge) => {
    if (!allBadges.some((b) => b.id === ub.badge_key)) {
      allBadges.push({
        id: ub.badge_key,
        title: ub.badge_title || "Special Badge",
        category: "SPECIAL MILESTONE",
        desc: ub.badge_description || "Special achievement earned",
        icon: "seal-variant",
        color: "#F59E0B",
      });
    }
  });

  // Calculate 3-column spacing with generous badge sizing
  const colWidth = (screenWidth - 32 - 16) / 3;
  const badgeSize = Math.min(Math.floor(colWidth), 96);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#A855F7" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.screenWrapper}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Header (Clean Laurel & Unlocked Count) */}
        <View style={styles.header}>
          <View style={styles.wreathRow}>
            <MaterialCommunityIcons name="trophy-award" size={32} color="#F5D061" />
            <Text style={styles.headerTitle}>Badges</Text>
            <Text style={styles.headerCount}>{unlockedKeys.size}</Text>
          </View>
          <Text style={styles.headerSubtitle}>
            {unlockedKeys.size} of {allBadges.length} Unlocked
          </Text>
        </View>

        {/* 3-Column Medallion Grid */}
        <View style={styles.grid}>
          {allBadges.map((badge) => {
            const isUnlocked = unlockedKeys.has(badge.id);
            return (
              <BadgeItem
                key={badge.id}
                badge={badge}
                isUnlocked={isUnlocked}
                colWidth={colWidth}
                badgeSize={badgeSize}
                onPress={() => setSelectedBadge(badge)}
              />
            );
          })}
        </View>
      </ScrollView>

      {/* Redesigned Luxury Detail Modal */}
      <Modal
        visible={!!selectedBadge}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedBadge(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setSelectedBadge(null)}
        >
          <Pressable
            style={[
              styles.modalCard,
              selectedBadge && unlockedKeys.has(selectedBadge.id)
                ? styles.modalCardUnlocked
                : styles.modalCardLocked,
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Top Close Button */}
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setSelectedBadge(null)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialCommunityIcons name="close" size={20} color="#94A3B8" />
            </TouchableOpacity>

            {selectedBadge && (
              <>
                {/* Ambient Halo & Medallion */}
                <View style={styles.modalMedallionWrapper}>
                  <View
                    style={[
                      styles.modalHalo,
                      unlockedKeys.has(selectedBadge.id)
                        ? styles.modalHaloUnlocked
                        : styles.modalHaloLocked,
                    ]}
                  />
                  <MetallicMedallion
                    badge={selectedBadge}
                    isUnlocked={unlockedKeys.has(selectedBadge.id)}
                    size={136}
                  />
                </View>

                {/* Badge Category Tag */}
                <View
                  style={[
                    styles.categoryBadge,
                    {
                      backgroundColor: selectedBadge.color + "20",
                      borderColor: selectedBadge.color + "50",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryText,
                      { color: selectedBadge.color },
                    ]}
                  >
                    {selectedBadge.category}
                  </Text>
                </View>

                {/* Badge Title */}
                <Text style={styles.modalTitle}>{selectedBadge.title}</Text>

                {/* Objective Card */}
                <View style={styles.objectiveCard}>
                  <View style={styles.objectiveHeaderRow}>
                    <MaterialCommunityIcons
                      name="bullseye-arrow"
                      size={15}
                      color="#F5D061"
                    />
                    <Text style={styles.objectiveHeaderTitle}>OBJECTIVE</Text>
                  </View>
                  <Text style={styles.modalDesc}>{selectedBadge.desc}</Text>
                </View>

                {/* Status Card Banner */}
                {unlockedKeys.has(selectedBadge.id) ? (
                  <View style={styles.unlockedStatusBanner}>
                    <View style={styles.unlockedIconCircle}>
                      <MaterialCommunityIcons
                        name="check-decagram"
                        size={20}
                        color="#10B981"
                      />
                    </View>
                    <View style={styles.statusBannerTextCol}>
                      <Text style={styles.unlockedBannerTitle}>
                        Medallion Forged
                      </Text>
                      <Text style={styles.unlockedBannerSub}>
                        Unlocked and displayed on your profile
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.lockedStatusBanner}>
                    <View style={styles.lockedIconCircle}>
                      <MaterialCommunityIcons
                        name="lock"
                        size={18}
                        color="#94A3B8"
                      />
                    </View>
                    <View style={styles.statusBannerTextCol}>
                      <Text style={styles.lockedBannerTitle}>
                        Locked Milestone
                      </Text>
                      <Text style={styles.lockedBannerSub}>
                        Complete the objective to forge this medal
                      </Text>
                    </View>
                  </View>
                )}

                {/* Done Action Button */}
                <TouchableOpacity
                  style={styles.modalDoneBtn}
                  onPress={() => setSelectedBadge(null)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalDoneBtnText}>Got it</Text>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
    backgroundColor: "#1A1A24",
  },
  container: {
    backgroundColor: "#1A1A24",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1A1A24",
  },
  header: {
    alignItems: "center",
    paddingTop: 6,
    paddingBottom: 22,
  },
  wreathRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  headerCount: {
    color: "#F5D061",
    fontSize: 28,
    fontWeight: "900",
    marginLeft: 4,
  },
  headerSubtitle: {
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "600",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 24,
  },
  badgeItemContainer: {
    alignItems: "center",
  },
  badgeItemInner: {
    alignItems: "center",
  },
  badgeLockedWrapper: {
    opacity: 0.45,
  },
  badgeName: {
    color: "#E2E8F0",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 10,
    lineHeight: 16,
    paddingHorizontal: 2,
  },
  badgeNameLocked: {
    color: "#64748B",
  },
  lockedCenterBadge: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  lockIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(26, 26, 36, 0.85)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  glowEffect: {
    shadowColor: "#F5D061",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(10, 10, 16, 0.88)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 336,
    backgroundColor: "#20202C",
    borderRadius: 28,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 12,
  },
  modalCardUnlocked: {
    borderColor: "rgba(245, 208, 97, 0.35)",
  },
  modalCardLocked: {
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  modalCloseBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  modalMedallionWrapper: {
    marginVertical: 12,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  modalHalo: {
    position: "absolute",
    width: 156,
    height: 156,
    borderRadius: 78,
  },
  modalHaloUnlocked: {
    backgroundColor: "rgba(245, 208, 97, 0.14)",
  },
  modalHaloLocked: {
    backgroundColor: "rgba(100, 116, 139, 0.08)",
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  modalTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 16,
  },
  objectiveCard: {
    width: "100%",
    backgroundColor: "#171722",
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  objectiveHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  objectiveHeaderTitle: {
    color: "#94A3B8",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  modalDesc: {
    color: "#E2E8F0",
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
  },
  unlockedStatusBanner: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.25)",
    marginBottom: 18,
  },
  unlockedIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  lockedStatusBanner: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    marginBottom: 18,
  },
  lockedIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    justifyContent: "center",
    alignItems: "center",
  },
  statusBannerTextCol: {
    flex: 1,
  },
  unlockedBannerTitle: {
    color: "#10B981",
    fontSize: 13,
    fontWeight: "800",
  },
  unlockedBannerSub: {
    color: "#6EE7B7",
    fontSize: 11,
    fontWeight: "500",
    marginTop: 1,
  },
  lockedBannerTitle: {
    color: "#E2E8F0",
    fontSize: 13,
    fontWeight: "800",
  },
  lockedBannerSub: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "500",
    marginTop: 1,
  },
  modalDoneBtn: {
    width: "100%",
    backgroundColor: "#2C2C38",
    borderRadius: 16,
    paddingVertical: 13,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  modalDoneBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
});
