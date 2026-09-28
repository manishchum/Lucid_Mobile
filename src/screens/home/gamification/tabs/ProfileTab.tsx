import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  ActivityIndicator,
  ImageBackground,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { GC } from "../drills/GamificationColors";
import { GamificationProfile } from "../../../../api/gamification/Request";
import { useAuth } from "../../../../contex/AuthContext";
import { LinearGradient } from "expo-linear-gradient";

interface Props {
  profile: GamificationProfile | null;
  isLoading: boolean;
  activeDates: string[];
}

export default function ProfileTab({ profile, isLoading, activeDates }: Props) {
  const { cachedUser } = useAuth();
  const xp = profile?.total_xp || 0;
  const streak = profile?.current_streak_days || 0;
  const bestStreak = profile?.best_streak_days || 0;
  const drillsCompleted = profile?.drills_completed_count || 0;
  const badgesCount = profile?.unlocked_badges?.length || 0;

  // XP level calculation
  const level = Math.floor(xp / 500) + 1;

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#A855F7" size="large" />
      </View>
    );
  }

  const getInitials = (name: string) => {
    const parts = name.split(" ");
    if (parts.length > 1) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      {/* Top Banner (Theme of Image 2: Deep Purples) */}
      <View style={styles.headerBanner}>
        <LinearGradient
          colors={["#35155D", "#1A0B2E"]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        {/* Curved cutout effect for the avatar */}
        <View style={styles.headerCurve} />
      </View>

      <View style={styles.profileSection}>
        {/* Avatar */}
        <View style={styles.avatarWrapper}>
          <LinearGradient
            colors={["#A855F7", "#3B82F6"]}
            style={styles.avatarBorder}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.avatarInner}>
              <Text style={styles.avatarInitials}>
                {cachedUser?.name ? getInitials(cachedUser.name) : "US"}
              </Text>
            </View>
          </LinearGradient>
        </View>

        {/* Name and Username */}
        <Text style={styles.nameText}>{cachedUser?.name || "Player"}</Text>
        <Text style={styles.usernameText}>
          {cachedUser?.email || "No Email Provided"}
        </Text>

        {/* XP / Coins Row (Like Image 1) */}
        <View style={styles.xpRow}>
          <LinearGradient
            colors={["#4F46E5", "#3B82F6"]}
            style={styles.xpPill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <MaterialCommunityIcons name="star-shooting" size={18} color="#FFF" />
            <Text style={styles.xpPillText}>{xp.toLocaleString()} XP</Text>
          </LinearGradient>
          <Text style={styles.xpSubText}>How to earn XP?</Text>
        </View>

        {/* Stats Grid 2x2 (Theme of Image 2 cards) */}
        <View style={styles.statsGrid}>
          {/* Level */}
          <View style={styles.statCard}>
            <View style={[styles.iconCircle, { backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
              <MaterialCommunityIcons name="trophy" size={24} color="#10B981" />
            </View>
            <View>
              <Text style={styles.statLabel}>Level</Text>
              <Text style={styles.statValue}>{level}</Text>
            </View>
          </View>

          {/* Time/Streak */}
          <View style={styles.statCard}>
            <View style={[styles.iconCircle, { backgroundColor: "rgba(59, 130, 246, 0.15)" }]}>
              <MaterialCommunityIcons name="fire" size={24} color="#3B82F6" />
            </View>
            <View>
              <Text style={styles.statLabel}>Streak</Text>
              <Text style={styles.statValue}>{streak} Days</Text>
            </View>
          </View>

          {/* Badges/Skills */}
          <View style={styles.statCard}>
            <View style={[styles.iconCircle, { backgroundColor: "rgba(239, 68, 68, 0.15)" }]}>
              <MaterialCommunityIcons name="shield-star" size={24} color="#EF4444" />
            </View>
            <View>
              <Text style={styles.statLabel}>Badges</Text>
              <Text style={styles.statValue}>{badgesCount}</Text>
            </View>
          </View>

          {/* Games/Drills */}
          <View style={styles.statCard}>
            <View style={[styles.iconCircle, { backgroundColor: "rgba(245, 158, 11, 0.15)" }]}>
              <MaterialCommunityIcons name="controller-classic" size={24} color="#F59E0B" />
            </View>
            <View>
              <Text style={styles.statLabel}>Drills</Text>
              <Text style={styles.statValue}>{drillsCompleted}</Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0A0F1E" },
  container: {
    backgroundColor: "#0A0F1E", // Gamification global bg
    paddingBottom: 80,
    minHeight: "100%",
  },
  headerBanner: {
    height: 160,
    width: "100%",
    position: "relative",
  },
  headerCurve: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    backgroundColor: "#0A0F1E",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  profileSection: {
    paddingHorizontal: 20,
    alignItems: "center",
    marginTop: -60, // overlap the avatar onto the banner
  },
  avatarWrapper: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: "#0A0F1E",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    zIndex: 10,
  },
  avatarBorder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInner: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#1A0B2E",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#0A0F1E",
  },
  avatarInitials: {
    color: "#FFF",
    fontSize: 32,
    fontWeight: "900",
  },
  nameText: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  usernameText: {
    color: "#94A3B8",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 24,
  },
  xpRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#141D2E",
    borderRadius: 30,
    paddingRight: 20,
    paddingVertical: 6,
    paddingLeft: 6,
    borderWidth: 1,
    borderColor: "#1E2D4A",
    marginBottom: 32,
  },
  xpPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 8,
  },
  xpPillText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "800",
  },
  xpSubText: {
    color: "#94A3B8",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 16,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    width: "100%",
    gap: 16,
  },
  statCard: {
    width: "47%", // slightly less than 50% for gap
    backgroundColor: "#1A1A24", // Like image 2 card color
    borderRadius: 20,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  statLabel: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 2,
  },
  statValue: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
});
