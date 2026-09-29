import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  ActivityIndicator,
  ImageBackground,
  useWindowDimensions,
  TouchableOpacity,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop, Circle } from "react-native-svg";
import { GC } from "../drills/GamificationColors";
import { GamificationProfile } from "../../../../api/gamification/Request";
import { useAuth } from "../../../../contex/AuthContext";
import { LinearGradient } from "expo-linear-gradient";

interface Props {
  profile: GamificationProfile | null;
  isLoading: boolean;
  activeDates: string[];
  onExitPress?: () => void;
}

export default function ProfileTab({ profile, isLoading, activeDates, onExitPress }: Props) {
  const navigation = useNavigation<any>();
  const { width: screenWidth } = useWindowDimensions();
  const cx = screenWidth / 2;
  const { cachedUser } = useAuth();
  const xp = profile?.total_xp || 0;
  const streak = profile?.current_streak_days || 0;
  const bestStreak = profile?.best_streak_days || 0;
  const drillsCompleted = profile?.drills_completed_count || 0;
  const badgesCount = profile?.unlocked_badges?.length || 0;

  // XP level calculation
  const level = Math.floor(xp / 500) + 1;

  // Live countdown to midnight (streak reset time)
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      const diff = endOfDay.getTime() - now.getTime();
      if (diff <= 0) {
        setTimeLeft("00:00:00");
        return;
      }
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft(
        `${hours.toString().padStart(2, "0")}h ${minutes.toString().padStart(2, "0")}m ${seconds.toString().padStart(2, "0")}s`
      );
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const isTodayCompleted = (activeDates || []).includes(todayStr);

  const getPastSevenDays = () => {
    const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
    const days = [];

    // Past 7 days ending at today (6 days ago through today)
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const dateStr = `${year}-${month}-${day}`;

      const isToday = i === 0;
      const isPast = i > 0;
      const isCompleted = (activeDates || []).includes(dateStr);

      days.push({
        label: DAY_LETTERS[d.getDay()],
        dateNumber: d.getDate(),
        dateStr,
        isToday,
        isPast,
        isCompleted,
      });
    }
    return days;
  };

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
      {/* Top Banner with Circular Scoop Cutout */}
      <View style={styles.headerBanner}>
        <LinearGradient
          colors={["#35155D", "#1A0B2E"]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        {/* Curved circular notch cutout for the avatar */}
        <Svg width={screenWidth} height={80} style={styles.headerCutoutSvg}>
          <Path
            d={`
              M 0,20
              L ${cx - 65},20
              C ${cx - 52},20 ${cx - 48},32 ${cx - 42},46
              C ${cx - 28},75 ${cx + 28},75 ${cx + 42},46
              C ${cx + 48},32 ${cx + 52},20 ${cx + 65},20
              L ${screenWidth},20
              L ${screenWidth},80
              L 0,80
              Z
            `}
            fill="#1A1A24"
          />
        </Svg>
      </View>

      <View style={styles.profileSection}>
        {/* Avatar with Circular Ring & Gap */}
        <View style={styles.avatarWrapper}>
          <Svg width={96} height={96} style={StyleSheet.absoluteFill}>
            <Defs>
              <SvgLinearGradient id="avatarRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#F59E0B" />
                <Stop offset="100%" stopColor="#EC4899" />
                {/* <Stop offset="100%" stopColor="#06B6D4" /> */}
              </SvgLinearGradient>
            </Defs>
            <Circle
              cx={48}
              cy={48}
              r={45}
              stroke="url(#avatarRingGrad)"
              strokeWidth={3}
              fill="none"
            />
          </Svg>

          {/* Inner Avatar with Gap */}
          <View style={styles.avatarInner}>
            <Text style={styles.avatarInitials}>
              {cachedUser?.name ? getInitials(cachedUser.name) : "US"}
            </Text>
          </View>
        </View>

        {/* Name and Username */}
        <Text style={styles.nameText}>{cachedUser?.name || "Player"}</Text>
        <Text style={styles.usernameText}>
          {cachedUser?.email || "No Email Provided"}
        </Text>

        {/* XP Card */}
        <View style={styles.xpCard}>
          <MaterialCommunityIcons name="star-four-points" size={18} color="#A855F7" />
          <Text style={styles.xpCardText}>{xp.toLocaleString()} XP</Text>
        </View>

        {/* Streak Time & Progress Card */}
        <View style={styles.streakCard}>
          {/* Header Row: Title & Live Countdown Timer */}
          <View style={styles.streakCardHeader}>
            <View style={styles.streakHeaderLeft}>
              <View style={styles.fireIconWrapper}>
                <MaterialCommunityIcons name="fire" size={18} color="#F97316" />
              </View>
              <Text style={styles.streakTitle}>Daily Streak</Text>
            </View>
            <View style={styles.streakTimerPill}>
              <MaterialCommunityIcons name="timer-outline" size={13} color="#F59E0B" />
              <Text style={styles.streakTimerText}>{timeLeft}</Text>
            </View>
          </View>

          {/* Numbers Row */}
          <View style={styles.streakNumbersRow}>
            <View style={styles.streakMainNumber}>
              <Text style={styles.streakNumber}>{streak}</Text>
              <Text style={styles.streakNumberUnit}>
                {streak === 1 ? "day streak" : "days streak"}
              </Text>
            </View>
            {/* <View style={styles.streakBestBadge}>
              <MaterialCommunityIcons name="trophy-outline" size={13} color="#A855F7" />
              <Text style={styles.streakBestText}>Best: {bestStreak}d</Text>
            </View> */}
          </View>

          {/* Callout */}
          <Text style={styles.streakCallout}>
            {isTodayCompleted
              ? "Streak active! Reset occurs at midnight."
              : "Complete a drill today to keep your streak alive!"}
          </Text>

          {/* 7-Day Past Streak Tracker */}
          <View style={styles.weekTrackRow}>
            {getPastSevenDays().map((dayItem, idx) => (
              <View key={idx} style={styles.dayCol}>
                <Text style={[styles.dayLabel, dayItem.isToday && styles.dayLabelToday]}>
                  {dayItem.label}
                </Text>
                <View
                  style={[
                    styles.dayBubble,
                    dayItem.isCompleted && styles.dayBubbleCompleted,
                    dayItem.isToday && !dayItem.isCompleted && styles.dayBubbleToday,
                  ]}
                >
                  {dayItem.isCompleted ? (
                    <MaterialCommunityIcons name="fire" size={16} color="#FFF" />
                  ) : dayItem.isToday ? (
                    <MaterialCommunityIcons name="fire" size={16} color="#F97316" />
                  ) : (
                    <Text
                      style={[
                        styles.dayNumberText,
                        dayItem.isPast && styles.dayNumberPast,
                      ]}
                    >
                      {dayItem.dateNumber}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Stats Grid 2x2 */}
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

          {/* Best Streak */}
          <View style={styles.statCard}>
            <View style={[styles.iconCircle, { backgroundColor: "rgba(249, 115, 22, 0.15)" }]}>
              <MaterialCommunityIcons name="fire" size={24} color="#F97316" />
            </View>
            <View>
              <Text style={styles.statLabel}>Best Streak</Text>
              <Text style={styles.statValue}>{bestStreak} Days</Text>
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

        {/* Exit Arena Card */}
        <TouchableOpacity
          style={styles.exitCard}
          activeOpacity={0.8}
          onPress={onExitPress || (() => navigation.goBack())}
        >
          <View style={styles.exitIconContainer}>
            <MaterialCommunityIcons name="door-open" size={22} color="#EF4444" />
          </View>
          <View style={styles.exitContent}>
            <Text style={styles.exitTitle}>Exit Arena</Text>
            <Text style={styles.exitSubtitle}>Safely return to your workspace</Text>
          </View>
          <View style={styles.exitActionBadge}>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" />
          </View>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#1A1A24" },
  container: {
    backgroundColor: "#1A1A24",
    paddingBottom: 20,
    minHeight: "100%",
  },
  headerBanner: {
    height: 160,
    width: "100%",
    position: "relative",
  },
  headerCutoutSvg: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  profileSection: {
    paddingHorizontal: 20,
    alignItems: "center",
    marginTop: -110, // aligns avatar center with the cradle baseline
  },
  avatarWrapper: {
    width: 96,
    height: 96,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    zIndex: 10,
  },
  avatarInner: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: "#2C2C35",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#3E3E4B",
  },
  avatarInitials: {
    color: "#FFF",
    fontSize: 28,
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
  xpCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2C2C35",
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  xpCardText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  streakCard: {
    width: "100%",
    backgroundColor: "#2C2C35",
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  streakCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  streakHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  fireIconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(249, 115, 22, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  streakTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  streakTimerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.25)",
  },
  streakTimerText: {
    color: "#F59E0B",
    fontSize: 12,
    fontWeight: "700",
  },
  streakNumbersRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  streakMainNumber: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  streakNumber: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "900",
  },
  streakNumberUnit: {
    color: "#94A3B8",
    fontSize: 14,
    fontWeight: "600",
  },
  streakBestBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(168, 85, 247, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  streakBestText: {
    color: "#C084FC",
    fontSize: 12,
    fontWeight: "700",
  },
  streakCallout: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 14,
  },
  weekTrackRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
  },
  dayCol: {
    alignItems: "center",
    gap: 6,
  },
  dayLabel: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "700",
  },
  dayLabelToday: {
    color: "#F97316",
  },
  dayBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  dayBubbleCompleted: {
    backgroundColor: "#EA580C",
    borderColor: "#F97316",
  },
  dayBubbleToday: {
    borderColor: "#F97316",
    borderWidth: 1.5,
    backgroundColor: "rgba(249, 115, 22, 0.1)",
  },
  dayNumberText: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "700",
  },
  dayNumberPast: {
    color: "#475569",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    width: "100%",
    gap: 16,
  },
  statCard: {
    width: "47.5%",
    backgroundColor: "#2C2C35",
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
  exitCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2C2C35",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.25)",
    marginTop: 16,
    width: "100%",
    gap: 14,
  },
  exitIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.25)",
  },
  exitContent: {
    flex: 1,
    gap: 2,
  },
  exitTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  exitSubtitle: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "500",
  },
  exitActionBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    justifyContent: "center",
    alignItems: "center",
  },
});
