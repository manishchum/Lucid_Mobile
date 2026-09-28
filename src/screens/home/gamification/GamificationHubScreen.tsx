import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  StatusBar,
  Dimensions,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { GC } from "./drills/GamificationColors";
import {
  useGamificationSprints,
  useGamificationProfile,
  useGamificationLeaderboard,
  useActivityCalendar,
} from "../../../api/gamification/Hooks";
import SprintsTab from "./tabs/SprintsTab";
import LeaderboardTab from "./tabs/LeaderboardTab";
import BadgesTab from "./tabs/BadgesTab";
import ProfileTab from "./tabs/ProfileTab";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

type Tab = "sprints" | "leaderboard" | "badges" | "profile";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "sprints", label: "Sprints", icon: "run-fast" },
  { key: "leaderboard", label: "Ranks", icon: "trophy" },
  { key: "badges", label: "Badges", icon: "shield-star" },
  { key: "profile", label: "Profile", icon: "account-circle" },
];

export default function GamificationHubScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [activeTab, setActiveTab] = useState<Tab>("sprints");

  // --- Entry animation ---
  const entryOpacity = useRef(new Animated.Value(0)).current;
  const entryScale = useRef(new Animated.Value(0.88)).current;
  const glowPulse = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    // Stagger: bg fills, then glow, then content
    Animated.sequence([
      Animated.delay(50),
      Animated.parallel([
        Animated.timing(entryOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(entryScale, {
          toValue: 1,
          useNativeDriver: true,
          damping: 18,
          stiffness: 200,
        }),
      ]),
    ]).start(() => {
      // Continuous glow loop on header
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowPulse, { toValue: 1, duration: 2000, useNativeDriver: true }),
          Animated.timing(glowPulse, { toValue: 0.6, duration: 2000, useNativeDriver: true }),
        ])
      ).start();
    });
  }, []);

  // --- Data ---
  const {
    data: sprints,
    isLoading: sprintsLoading,
    fetch: fetchSprints,
    setData: setSprints,
  } = useGamificationSprints();

  const {
    data: profile,
    isLoading: profileLoading,
    fetch: fetchProfile,
    setData: setProfile,
  } = useGamificationProfile();

  const {
    data: leaderboard,
    isLoading: leaderboardLoading,
    fetch: fetchLeaderboard,
  } = useGamificationLeaderboard();

  const {
    data: activeDates,
    fetch: fetchCalendar,
  } = useActivityCalendar();

  useFocusEffect(
    useCallback(() => {
      fetchSprints();
      fetchProfile();
      fetchLeaderboard();
      fetchCalendar();
    }, [])
  );

  const handleDrillComplete = useCallback(
    (drillId: string, result: any) => {
      // Optimistically update completed drills in profile
      if (profile) {
        const updatedProfile = {
          ...profile,
          total_xp: profile.total_xp + (result?.earned_xp || 0),
          drills_completed_count: profile.drills_completed_count + 1,
          completed_drills: [...(profile.completed_drills || []), drillId],
        };
        setProfile(updatedProfile);
      }
      // Refresh full data
      setTimeout(() => {
        fetchSprints(true);
        fetchProfile(true);
      }, 1000);
    },
    [profile]
  );

  const handleRefreshAll = useCallback(async () => {
    await Promise.all([
      fetchSprints(true),
      fetchProfile(true),
      fetchLeaderboard(true),
      fetchCalendar(true),
    ]);
  }, []);

  const xp = profile?.total_xp || 0;
  const streak = profile?.current_streak_days || 0;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={GC.bg} />

      {/* Animated entry wrapper */}
      <Animated.View
        style={[
          styles.contentWrapper,
          {
            opacity: entryOpacity,
            transform: [{ scale: entryScale }],
          },
        ]}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          {/* Back */}
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="arrow-left" size={22} color={GC.textPrimary} />
          </TouchableOpacity>

          {/* Center branding */}
          <View style={styles.headerCenter}>
            <MaterialCommunityIcons name="gamepad-variant" size={24} color={GC.primaryLight} />
            <Text style={styles.headerTitle}>ARENA</Text>
          </View>

          {/* Right: XP + Streak pills */}
          <View style={styles.headerRight}>
            {streak > 0 && (
              <View style={styles.streakPill}>
                <Text style={styles.streakPillText}>🔥{streak}</Text>
              </View>
            )}
            <View style={styles.xpPill}>
              <MaterialCommunityIcons name="star-four-points" size={10} color={GC.gold} />
              <Text style={styles.xpPillText}>{xp.toLocaleString()}</Text>
            </View>
          </View>
        </View>

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {activeTab === "sprints" && (
            <SprintsTab
              sprints={sprints || []}
              profile={profile}
              isLoading={sprintsLoading}
              onRefresh={handleRefreshAll}
              onDrillComplete={handleDrillComplete}
            />
          )}
          {activeTab === "leaderboard" && (
            <LeaderboardTab
              data={leaderboard || []}
              isLoading={leaderboardLoading}
              onRefresh={() => fetchLeaderboard(true)}
            />
          )}
          {activeTab === "badges" && (
            <BadgesTab
              profile={profile}
              isLoading={profileLoading}
            />
          )}
          {activeTab === "profile" && (
            <ProfileTab
              profile={profile}
              isLoading={profileLoading}
              activeDates={activeDates || []}
            />
          )}
        </View>

        {/* Bottom Navigation */}
        <View style={[styles.bottomNav, { paddingBottom: insets.bottom + 6 }]}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={styles.bottomNavItem}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.8}
              >
                <View style={[styles.tabIconWrap, isActive && styles.tabIconWrapActive]}>
                  <MaterialCommunityIcons
                    name={tab.icon as any}
                    size={22}
                    color={isActive ? GC.primaryLight : GC.textMuted}
                  />
                  {isActive && <View style={styles.tabActiveDot} />}
                </View>
                <Text
                  style={[
                    styles.tabLabel,
                    isActive && styles.tabLabelActive,
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: GC.bg,
  },
  contentWrapper: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: GC.border,
    gap: 12,
    position: "relative",
  },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    position: "relative",
  },
  // headerGlow: {
  //   position: "absolute",
  //   width: 120,
  //   height: 30,
  //   backgroundColor: GC.primary,
  //   borderRadius: 60,
  //   opacity: 0.15,
  //   top: -6,
  // },
  headerTitle: {
    color: GC.textPrimary,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 3,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: GC.card,
    borderWidth: 1,
    borderColor: GC.border,
    justifyContent: "center",
    alignItems: "center",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  streakPill: {
    backgroundColor: "#180A00",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "#3D1500",
  },
  streakPillText: {
    color: GC.textPrimary,
    fontSize: 12,
    fontWeight: "900",
  },
  xpPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#1C1200",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: GC.gold + "55",
  },
  xpPillText: {
    color: GC.gold,
    fontSize: 12,
    fontWeight: "900",
  },
  tabContent: { flex: 1 },
  bottomNav: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: GC.border,
    backgroundColor: GC.surface,
    paddingTop: 6,
  },
  bottomNavItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingVertical: 4,
  },
  tabIconWrap: {
    width: 44,
    height: 36,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  tabIconWrapActive: {
    backgroundColor: GC.primary + "22",
  },
  tabActiveDot: {
    position: "absolute",
    bottom: 3,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: GC.primaryLight,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: GC.textMuted,
    letterSpacing: 0.3,
  },
  tabLabelActive: {
    color: GC.primaryLight,
    fontWeight: "800",
  },
});
