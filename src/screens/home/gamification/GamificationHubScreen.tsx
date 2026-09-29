import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  StatusBar,
  Dimensions,
  Modal,
  BackHandler,
  Platform,
  ToastAndroid,
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
import { eventBus } from "../../../utils/EventBus";

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
  const [showExitModal, setShowExitModal] = useState(false);

  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const showExitModalRef = useRef(showExitModal);
  showExitModalRef.current = showExitModal;

  const lastBackPressedRef = useRef<number>(0);

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

      // Intercept Android hardware back button:
      // - If exit modal is open, dismiss it
      // - If on another tab (ranks/badges/profile), return to sprints tab
      // - If on sprints tab: double-press back to exit the Arena!
      const onHardwareBackPress = () => {
        if (showExitModalRef.current) {
          setShowExitModal(false);
          return true;
        }

        if (activeTabRef.current !== "sprints") {
          setActiveTab("sprints");
          return true;
        }

        // On sprints tab: check if pressed twice within 2 seconds
        const now = Date.now();
        if (now - lastBackPressedRef.current < 2000) {
          // Double press confirmed -> exit arena!
          navigation.goBack();
          return true;
        }

        lastBackPressedRef.current = now;
        if (Platform.OS === "android") {
          ToastAndroid.show("Press back again to exit Arena", ToastAndroid.SHORT);
        }
        return true;
      };

      const subscription = BackHandler.addEventListener("hardwareBackPress", onHardwareBackPress);
      return () => {
        subscription.remove();
      };
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
          completed_drills: [...(profile.completed_drills || []), { drill_id: drillId, earned_xp: result.earned_xp }],
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

  useEffect(() => {
    const unsub = eventBus.on("drill_completed", ({ drillId, result }: any) => {
      handleDrillComplete(drillId, result);
    });
    return () => {
      unsub();
    };
  }, [handleDrillComplete]);

  const handleRefreshAll = useCallback(async () => {
    await Promise.all([
      fetchSprints(true),
      fetchProfile(true),
      fetchLeaderboard(true),
      fetchCalendar(true),
    ]);
  }, []);

  const handleExitArena = useCallback(() => {
    setShowExitModal(true);
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
          {/* Left: ARENA Branding */}
          <View style={styles.headerLeft}>
            <View style={styles.arenaIconBadge}>
              <MaterialCommunityIcons name="gamepad-variant" size={18} color="#A855F7" />
            </View>
            <Text style={styles.headerTitle}>ARENA</Text>
          </View>

          {/* Right: Streak + XP pills + Exit button */}
          <View style={styles.headerRight}>
            <View style={styles.streakPill}>
              <MaterialCommunityIcons
                name="fire"
                size={14}
                color={streak > 0 ? "#F97316" : "#64748B"}
              />
              <Text style={[styles.streakPillText, streak === 0 && styles.pillTextZero]}>
                {streak}
              </Text>
            </View>

            <View style={styles.xpPill}>
              <MaterialCommunityIcons name="star-four-points" size={13} color="#A855F7" />
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
              onExitPress={() => setShowExitModal(true)}
            />
          )}
        </View>

        {/* Bottom Navigation */}
        <View style={[styles.bottomNav, { paddingBottom: insets.bottom + 8 }]}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={styles.bottomNavItem}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.7}
              >
                <View style={[styles.tabIconWrap, isActive && styles.tabIconWrapActive]}>
                  <MaterialCommunityIcons
                    name={tab.icon as any}
                    size={21}
                    color={isActive ? "#A855F7" : "#64748B"}
                  />
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

      {/* Custom Exit Confirmation Modal */}
      <Modal
        visible={showExitModal}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setShowExitModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowExitModal(false)}
          />
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <MaterialCommunityIcons name="door-open" size={28} color="#EF4444" />
            </View>

            <Text style={styles.modalTitle}>Exit Arena?</Text>
            <Text style={styles.modalDesc}>
              Your streak, XP, and drill progress are safely saved. You can jump back in anytime!
            </Text>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalStayBtn}
                onPress={() => setShowExitModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalStayText}>Stay</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalConfirmExitBtn}
                onPress={() => {
                  setShowExitModal(false);
                  navigation.goBack();
                }}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="logout-variant" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.modalConfirmExitText}>Exit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#1A1A24",
  },
  contentWrapper: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "#1A1A24",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  arenaIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: "rgba(168, 85, 247, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.28)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 2.5,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  streakPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#2C2C35",
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  streakPillText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  pillTextZero: {
    color: "#94A3B8",
  },
  xpPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#2C2C35",
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  xpPillText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  tabContent: { flex: 1 },
  bottomNav: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "#1A1A24",
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  bottomNavItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 2,
  },
  tabIconWrap: {
    width: 48,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  tabIconWrapActive: {
    backgroundColor: "rgba(168, 85, 247, 0.16)",
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    color: "#A855F7",
    fontWeight: "800",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(10, 10, 16, 0.78)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#22222E",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.6,
    shadowRadius: 28,
    elevation: 24,
  },
  modalIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.25)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0.4,
    textAlign: "center",
  },
  modalDesc: {
    color: "#94A3B8",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  modalActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    width: "100%",
  },
  modalStayBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#2C2C35",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalStayText: {
    color: "#CBD5E1",
    fontSize: 14,
    fontWeight: "700",
  },
  modalConfirmExitBtn: {
    flex: 1.1,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#EF4444",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  modalConfirmExitText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
});
