import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  ActivityIndicator,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { GC } from "../drills/GamificationColors";
import { GamificationProfile } from "../../../../api/gamification/Request";

interface Props {
  profile: GamificationProfile | null;
  isLoading: boolean;
  activeDates: string[];
}

function XpCounter({ value }: { value: number }) {
  const animVal = useRef(new Animated.Value(0)).current;
  const displayVal = useRef(0);

  useEffect(() => {
    Animated.timing(animVal, {
      toValue: value,
      duration: 1400,
      useNativeDriver: false,
    }).start();
    animVal.addListener(({ value: v }) => {
      displayVal.current = Math.floor(v);
    });
    return () => animVal.removeAllListeners();
  }, [value]);

  return (
    <Animated.Text style={styles.xpValue}>
      {value.toLocaleString()}
    </Animated.Text>
  );
}

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getLast7Days(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split("T")[0]);
  }
  return days;
}

export default function ProfileTab({ profile, isLoading, activeDates }: Props) {
  const last7Days = getLast7Days();
  const activeSet = new Set(activeDates || []);

  const xp = profile?.total_xp || 0;
  const streak = profile?.current_streak_days || 0;
  const bestStreak = profile?.best_streak_days || 0;
  const drillsCompleted = profile?.drills_completed_count || 0;

  // XP level calculation
  const level = Math.floor(xp / 500) + 1;
  const xpInLevel = xp % 500;
  const xpPct = (xpInLevel / 500) * 100;

  const streakAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (streak > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(streakAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
          Animated.timing(streakAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [streak]);

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
      {/* XP Hero Card */}
      <View style={styles.xpHeroCard}>
        <View style={styles.xpHeroTop}>
          <View>
            <Text style={styles.xpLabel}>TOTAL XP</Text>
            <Text style={styles.xpValue}>{xp.toLocaleString()}</Text>
          </View>
          <View style={styles.levelBadge}>
            <Text style={styles.levelBadgeLabel}>LVL</Text>
            <Text style={styles.levelBadgeValue}>{level}</Text>
          </View>
        </View>
        <View style={styles.xpProgressRow}>
          <Text style={styles.xpProgressLabel}>
            {xpInLevel} / 500 XP to Level {level + 1}
          </Text>
          <Text style={styles.xpProgressPct}>{Math.round(xpPct)}%</Text>
        </View>
        <View style={styles.xpProgressBar}>
          <Animated.View style={[styles.xpProgressFill, { width: `${xpPct}%` }]} />
        </View>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        {/* Streak */}
        <View style={[styles.statCard, styles.streakCard]}>
          <Animated.View style={{ transform: [{ scale: streakAnim }] }}>
            <Text style={styles.streakFlame}>🔥</Text>
          </Animated.View>
          <Text style={styles.statBigValue}>{streak}</Text>
          <Text style={styles.statLabel}>Day Streak</Text>
        </View>

        {/* Best Streak */}
        <View style={styles.statCard}>
          <MaterialCommunityIcons name="trophy" size={24} color={GC.gold} />
          <Text style={styles.statBigValue}>{bestStreak}</Text>
          <Text style={styles.statLabel}>Best Streak</Text>
        </View>

        {/* Drills */}
        <View style={styles.statCard}>
          <MaterialCommunityIcons name="lightning-bolt" size={24} color={GC.primary} />
          <Text style={styles.statBigValue}>{drillsCompleted}</Text>
          <Text style={styles.statLabel}>Drills Done</Text>
        </View>
      </View>

      {/* 7-Day Activity Calendar */}
      <View style={styles.calendarCard}>
        <Text style={styles.calendarTitle}>7-DAY ACTIVITY</Text>
        <View style={styles.calendarRow}>
          {last7Days.map((dateStr, i) => {
            const isActive = activeSet.has(dateStr);
            const day = new Date(dateStr);
            const dayLabel = DAYS_OF_WEEK[day.getDay() === 0 ? 6 : day.getDay() - 1];
            const isToday = dateStr === new Date().toISOString().split("T")[0];
            return (
              <View key={dateStr} style={styles.calendarDay}>
                <Text style={[styles.calendarDayLabel, isToday && styles.calendarDayToday]}>
                  {dayLabel}
                </Text>
                <View
                  style={[
                    styles.calendarDot,
                    isActive && styles.calendarDotActive,
                    isToday && styles.calendarDotToday,
                  ]}
                >
                  {isActive && (
                    <MaterialCommunityIcons
                      name="check"
                      size={10}
                      color={GC.bg}
                    />
                  )}
                </View>
              </View>
            );
          })}
        </View>
        <Text style={styles.calendarSubtext}>
          {activeSet.size} of 7 days active this week
        </Text>
      </View>

      {/* Badges count */}
      <View style={styles.badgesSummaryCard}>
        <MaterialCommunityIcons name="shield-star" size={24} color={GC.primaryLight} />
        <View style={styles.badgesSummaryInfo}>
          <Text style={styles.badgesSummaryValue}>
            {profile?.unlocked_badges?.length || 0} Badges
          </Text>
          <Text style={styles.badgesSummaryLabel}>Achievement badges unlocked</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={18} color={GC.textMuted} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 14, paddingBottom: 80 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  xpHeroCard: {
    backgroundColor: GC.card,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: GC.primaryBorder,
    padding: 20,
    gap: 12,
    shadowColor: GC.primary,
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  xpHeroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  xpLabel: {
    color: GC.primaryLight,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 4,
  },
  xpValue: {
    color: GC.textPrimary,
    fontSize: 36,
    fontWeight: "900",
  },
  levelBadge: {
    backgroundColor: GC.primary,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: "center",
  },
  levelBadgeLabel: {
    color: GC.textPrimary,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 2,
    opacity: 0.8,
  },
  levelBadgeValue: {
    color: GC.textPrimary,
    fontSize: 24,
    fontWeight: "900",
  },
  xpProgressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  xpProgressLabel: {
    color: GC.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },
  xpProgressPct: {
    color: GC.primaryLight,
    fontSize: 11,
    fontWeight: "800",
  },
  xpProgressBar: {
    height: 6,
    backgroundColor: GC.border,
    borderRadius: 6,
    overflow: "hidden",
  },
  xpProgressFill: {
    height: "100%",
    backgroundColor: GC.primary,
    borderRadius: 6,
  },
  statsRow: { flexDirection: "row", gap: 10 },
  statCard: {
    flex: 1,
    backgroundColor: GC.card,
    borderRadius: 18,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: GC.border,
    gap: 6,
  },
  streakCard: {
    borderColor: "#3D1500",
    backgroundColor: "#180A00",
  },
  streakFlame: { fontSize: 22 },
  statBigValue: {
    color: GC.textPrimary,
    fontSize: 22,
    fontWeight: "900",
  },
  statLabel: {
    color: GC.textMuted,
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  calendarCard: {
    backgroundColor: GC.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: GC.border,
    padding: 18,
    gap: 14,
  },
  calendarTitle: {
    color: GC.textMuted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
  },
  calendarRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  calendarDay: { alignItems: "center", gap: 6 },
  calendarDayLabel: {
    color: GC.textMuted,
    fontSize: 10,
    fontWeight: "700",
  },
  calendarDayToday: { color: GC.primaryLight },
  calendarDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: GC.cardAlt,
    borderWidth: 1,
    borderColor: GC.border,
    justifyContent: "center",
    alignItems: "center",
  },
  calendarDotActive: {
    backgroundColor: GC.success,
    borderColor: GC.success,
  },
  calendarDotToday: {
    borderColor: GC.primaryLight,
    borderWidth: 2,
  },
  calendarSubtext: {
    color: GC.textMuted,
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },
  badgesSummaryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: GC.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: GC.primaryBorder,
  },
  badgesSummaryInfo: { flex: 1 },
  badgesSummaryValue: {
    color: GC.textPrimary,
    fontSize: 16,
    fontWeight: "800",
  },
  badgesSummaryLabel: {
    color: GC.textMuted,
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },
});
