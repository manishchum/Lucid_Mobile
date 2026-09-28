import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { GC } from "../drills/GamificationColors";
import { GamificationProfile, UnlockedBadge } from "../../../../api/gamification/Request";

interface CoreBadge {
  id: string;
  title: string;
  category: string;
  desc: string;
  icon: string;
  color: string;
}

const CORE_BADGES: CoreBadge[] = [
  { id: "badge_1", title: "Main Character 🎯", category: "DRILL MILESTONE", desc: "Complete your 1st drill", icon: "book-open-variant", color: "#8B5CF6" },
  { id: "badge_2", title: "Locked In 🔒", category: "DRILL MILESTONE", desc: "Complete 10 drills", icon: "shield-check", color: "#3B82F6" },
  { id: "badge_3", title: "G.O.A.T. Certified 🏆", category: "DRILL MILESTONE", desc: "Complete 25 drills", icon: "trophy", color: "#F59E0B" },
  { id: "badge_4", title: "On Fire 🔥", category: "STREAK MILESTONE", desc: "Maintain a 7-day streak", icon: "fire", color: "#EF4444" },
  { id: "badge_5", title: "Unstoppable ⚡", category: "STREAK MILESTONE", desc: "Maintain a 14-day streak", icon: "lightning-bolt", color: "#A855F7" },
  { id: "badge_6", title: "XP Billionaire 🌟", category: "XP MILESTONE", desc: "Reach 5,000+ total XP", icon: "star-four-points", color: "#10B981" },
];

interface Props {
  profile: GamificationProfile | null;
  isLoading: boolean;
}

export default function BadgesTab({ profile, isLoading }: Props) {
  const unlockedKeys = new Set((profile?.unlocked_badges || []).map((b: UnlockedBadge) => b.badge_key));

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={GC.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{unlockedKeys.size}</Text>
          <Text style={styles.statLabel}>Unlocked</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{CORE_BADGES.length - unlockedKeys.size}</Text>
          <Text style={styles.statLabel}>Locked</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{CORE_BADGES.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>ACHIEVEMENT BADGES</Text>

      <View style={styles.badgesGrid}>
        {CORE_BADGES.map((badge) => {
          const unlocked = unlockedKeys.has(badge.id);
          return (
            <View
              key={badge.id}
              style={[
                styles.badgeCard,
                unlocked
                  ? { borderColor: badge.color + "88" }
                  : styles.badgeCardLocked,
              ]}
            >
              <Text style={[styles.badgeCategory, { color: unlocked ? badge.color : GC.textMuted }]}>
                {badge.category}
              </Text>
              <View
                style={[
                  styles.badgeIconBox,
                  unlocked
                    ? { backgroundColor: badge.color + "22", borderColor: badge.color + "55" }
                    : styles.badgeIconBoxLocked,
                ]}
              >
                <MaterialCommunityIcons
                  name={badge.icon as any}
                  size={28}
                  color={unlocked ? badge.color : GC.textMuted}
                />
                {!unlocked && (
                  <View style={styles.lockOverlay}>
                    <MaterialCommunityIcons name="lock" size={12} color={GC.textMuted} />
                  </View>
                )}
              </View>
              <Text style={[styles.badgeTitle, !unlocked && styles.textMuted]}>
                {badge.title}
              </Text>
              <Text style={[styles.badgeDesc, !unlocked && styles.textMutedSmall]}>
                {badge.desc}
              </Text>
              <View
                style={[
                  styles.badgeStatus,
                  unlocked ? styles.badgeStatusUnlocked : styles.badgeStatusLocked,
                ]}
              >
                <MaterialCommunityIcons
                  name={unlocked ? "check-circle" : "lock-outline"}
                  size={12}
                  color={unlocked ? GC.success : GC.textMuted}
                />
                <Text
                  style={[
                    styles.badgeStatusText,
                    { color: unlocked ? GC.success : GC.textMuted },
                  ]}
                >
                  {unlocked ? "UNLOCKED" : "LOCKED"}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16, paddingBottom: 80 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: GC.card,
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: GC.border,
    gap: 4,
  },
  statValue: {
    color: GC.textPrimary,
    fontSize: 24,
    fontWeight: "900",
  },
  statLabel: {
    color: GC.textMuted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  sectionLabel: {
    color: GC.textMuted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
  },
  badgesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  badgeCard: {
    width: "47%",
    backgroundColor: GC.card,
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    alignItems: "center",
    gap: 8,
  },
  badgeCardLocked: {
    borderColor: GC.border,
    opacity: 0.6,
  },
  badgeCategory: {
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  badgeIconBox: {
    width: 60,
    height: 60,
    borderRadius: 16,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  badgeIconBoxLocked: {
    backgroundColor: GC.cardAlt,
    borderColor: GC.border,
  },
  lockOverlay: {
    position: "absolute",
    bottom: -4,
    right: -4,
    backgroundColor: GC.surface,
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: GC.border,
  },
  badgeTitle: {
    color: GC.textPrimary,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 16,
  },
  badgeDesc: {
    color: GC.textSecondary,
    fontSize: 10,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 14,
  },
  badgeStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    marginTop: 2,
  },
  badgeStatusUnlocked: {
    backgroundColor: "#052E16",
    borderWidth: 1,
    borderColor: GC.success + "66",
  },
  badgeStatusLocked: {
    backgroundColor: GC.cardAlt,
    borderWidth: 1,
    borderColor: GC.border,
  },
  badgeStatusText: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
  },
  textMuted: { color: GC.textMuted },
  textMutedSmall: { color: GC.textMuted, opacity: 0.7 },
});
