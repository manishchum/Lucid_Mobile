import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
  Animated,
  Easing,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LeaderboardHighlightData, LeaderboardUser } from "../../api/users";
import RefreshSpinner from "../pullToRefresh/RefreshSpinner";

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  leaderboardData: LeaderboardHighlightData | null;
  isLoading: boolean;
  error: Error | null;
  currentUser: any;
  currentProgressPercentage: number;
  onRefresh: () => void;
}

// ── 1. Silky Smooth Animated Progress Bar Fill ─────────────────────────────────
const AnimatedProgressBar = ({
  percentage,
  color = "#2563EB",
}: {
  percentage: number;
  color?: string;
}) => {
  const fillAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fillAnim.setValue(0);
    Animated.timing(fillAnim, {
      toValue: Math.min(Math.max(percentage, 0), 100),
      duration: 750,
      easing: Easing.bezier(0.25, 1, 0.5, 1), // Ultra-fluid Apple ease-out curve
      useNativeDriver: false,
    }).start();
  }, [percentage, fillAnim]);

  const widthStyle = fillAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={styles.rowProgressBarTrack}>
      <Animated.View
        style={[
          styles.rowProgressBarFill,
          { width: widthStyle, backgroundColor: color },
        ]}
      />
    </View>
  );
};

// ── 2. Silky Smooth Live Number Count-Up Animation ─────────────────────────────
const AnimatedStatValue = ({
  value,
  prefix = "",
  suffix = "",
}: {
  value: number;
  prefix?: string;
  suffix?: string;
}) => {
  const countAnim = useRef(new Animated.Value(0)).current;
  const [displayVal, setDisplayVal] = useState(0);

  useEffect(() => {
    countAnim.setValue(0);
    const anim = Animated.timing(countAnim, {
      toValue: value || 0,
      duration: 800,
      easing: Easing.bezier(0.16, 1, 0.3, 1), // Apple-like smooth deceleration
      useNativeDriver: false,
    });

    const listenerId = countAnim.addListener(({ value: v }) => {
      setDisplayVal(Math.round(v));
    });

    anim.start();

    return () => {
      countAnim.removeListener(listenerId);
    };
  }, [value, countAnim]);

  return (
    <Text style={styles.userRankStatValue}>
      {prefix}
      {displayVal}
      {suffix}
    </Text>
  );
};

// ── 3. Staggered Row Waterfall Entrance Component ─────────────────────────────
const AnimatedLeaderboardRow = ({
  children,
  index,
  isMe,
}: {
  children: React.ReactNode;
  index: number;
  isMe?: boolean;
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(14)).current;
  const scaleAnim = useRef(new Animated.Value(isMe ? 0.97 : 1)).current;

  useEffect(() => {
    fadeAnim.setValue(0);
    translateYAnim.setValue(14);

    // Wait 150ms for native modal slide transition to settle before cascading rows
    const delay = 150 + Math.min(index * 35, 350);
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(translateYAnim, {
          toValue: 0,
          friction: 8,
          tension: 42,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 42,
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);

    return () => clearTimeout(timer);
  }, [index, isMe, fadeAnim, translateYAnim, scaleAnim]);

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: translateYAnim }, { scale: scaleAnim }],
      }}
    >
      {children}
    </Animated.View>
  );
};

export default function LeaderboardModal({
  isOpen,
  onClose,
  leaderboardData,
  isLoading,
  error,
  currentUser,
  currentProgressPercentage,
  onRefresh,
}: LeaderboardModalProps) {
  const [refreshing, setRefreshing] = useState(false);

  const onRefreshInternal = useCallback(async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } catch (err) {
      console.error("[LeaderboardModal] Refresh error:", err);
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  const getInitials = (name: string): string => {
    if (!name) return "";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
  };

  const getMedalIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <MaterialCommunityIcons name="crown" size={20} color="#D97706" />;
      case 2:
        return <MaterialCommunityIcons name="medal" size={20} color="#94A3B8" />;
      case 3:
        return <MaterialCommunityIcons name="medal" size={20} color="#B45309" />;
      default:
        return (
          <View style={styles.rankCircleBadge}>
            <Text style={styles.rankCircleBadgeText}>{rank}</Text>
          </View>
        );
    }
  };

  const topPerformers = leaderboardData?.top_performers || [];
  const userRankInfo = leaderboardData?.user_rank_info || null;
  const isUserInTop = leaderboardData?.user_in_top ?? false;

  const resolvedRank = isUserInTop
    ? topPerformers.find(
        (u: LeaderboardUser) =>
          u.user_id === currentUser?.user_id || u.user_id === currentUser?.userId
      )?.rank ?? null
    : userRankInfo?.rank ?? null;

  const resolvedPercentile = userRankInfo?.top_percentile ?? null;

  return (
    <Modal
      visible={isOpen}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.leaderboardContainer}>
          {/* Modal Header */}
          <View style={styles.leaderboardHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <MaterialCommunityIcons name="trophy" size={24} color="#D97706" />
              <Text style={styles.leaderboardTitle}>Leaderboard</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <MaterialCommunityIcons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.leaderboardLoader}>
              <ActivityIndicator size="large" color="#2563EB" />
              <Text style={{ marginTop: 12, color: "#64748B", fontSize: 14 }}>
                Fetching rankings...
              </Text>
            </View>
          ) : error ? (
            <View style={styles.leaderboardLoader}>
              <MaterialCommunityIcons name="alert-circle-outline" size={36} color="#EF4444" />
              <Text style={{ marginTop: 8, color: "#EF4444", fontWeight: "600" }}>
                Failed to load leaderboard
              </Text>
              <TouchableOpacity onPress={onRefresh} style={styles.retryBtn}>
                <Text style={styles.retryBtnText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : topPerformers.length === 0 ? (
            <View style={styles.leaderboardLoader}>
              <MaterialCommunityIcons name="trophy-outline" size={40} color="#CBD5E1" />
              <Text style={{ marginTop: 10, color: "#64748B", textAlign: "center" }}>
                No rankings available yet.
              </Text>
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              {/* Current User Stats Highlights at Top with Ultra-Smooth Count-Up */}
              <View style={styles.userRankCard}>
                <Text style={styles.userRankTitle}>Your Standing</Text>
                <View style={styles.userRankStatsRow}>
                  <View style={styles.userRankStatItem}>
                    {resolvedRank ? (
                      <AnimatedStatValue value={resolvedRank} prefix="#" />
                    ) : (
                      <Text style={styles.userRankStatValue}>N/A</Text>
                    )}
                    <Text style={styles.userRankStatLabel}>Rank</Text>
                  </View>
                  <View style={styles.userRankDivider} />
                  <View style={styles.userRankStatItem}>
                    {resolvedPercentile !== null ? (
                      <AnimatedStatValue value={resolvedPercentile} suffix="%" />
                    ) : (
                      <Text style={styles.userRankStatValue}>Top 100%</Text>
                    )}
                    <Text style={styles.userRankStatLabel}>Top Percentile</Text>
                  </View>
                  <View style={styles.userRankDivider} />
                  <View style={styles.userRankStatItem}>
                    <AnimatedStatValue value={currentProgressPercentage} suffix="%" />
                    <Text style={styles.userRankStatLabel}>Completion</Text>
                  </View>
                </View>
              </View>

              <ScrollView
                style={styles.leaderboardList}
                contentContainerStyle={{ paddingBottom: 10 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                  RefreshSpinner(refreshing, onRefreshInternal)
                }
              >
                {topPerformers.map((entry: LeaderboardUser, idx: number) => {
                  const isMe =
                    entry.user_id === currentUser?.user_id ||
                    entry.user_id === currentUser?.userId;
                  return (
                    <AnimatedLeaderboardRow key={entry.user_id} index={idx} isMe={isMe}>
                      <View
                        style={[
                          styles.leaderboardRow,
                        ]}
                      >
                        {/* Medal / Position */}
                        <View style={styles.rankIconContainer}>
                          {getMedalIcon(entry.rank)}
                        </View>

                        {/* Initials / Avatar */}
                        <View
                          style={[
                            styles.leaderboardAvatar,
                            entry.rank === 1 && styles.avatarGold,
                            entry.rank === 2 && styles.avatarSilver,
                            entry.rank === 3 && styles.avatarBronze,
                          ]}
                        >
                          <Text
                            style={[
                              styles.leaderboardAvatarText,
                              entry.rank <= 3 && styles.avatarTextTopThree,
                            ]}
                          >
                            {getInitials(entry.name)}
                          </Text>
                        </View>

                        {/* Name & Module Info */}
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Text
                              style={[
                                styles.rowUserName,
                                isMe && { fontWeight: "800", color: "#1E1B4B" },
                              ]}
                              numberOfLines={1}
                            >
                              {entry.name}
                            </Text>
                            {isMe && (
                              <View style={styles.meBadge}>
                                <Text style={styles.meBadgeText}>You</Text>
                              </View>
                            )}
                          </View>
                          {/* Modules completed count */}
                          <Text style={styles.rowUserModules}>
                            {entry.modules_completed} / {entry.modules_assigned} Modules
                          </Text>

                          {/* Silky Smooth Animated Progress Bar */}
                          <AnimatedProgressBar
                            percentage={entry.completion_percentage}
                            color={isMe ? "#4F46E5" : entry.rank === 1 ? "#D97706" : "#2563EB"}
                          />
                        </View>

                        {/* Score/Percentage */}
                        <View style={{ alignItems: "flex-end", paddingLeft: 8 }}>
                          <Text style={styles.rowUserPercentage}>
                            {entry.completion_percentage}%
                          </Text>
                          <Text style={styles.rowUserSubText}>Complete</Text>
                        </View>
                      </View>
                    </AnimatedLeaderboardRow>
                  );
                })}

                {/* If user is not in top N, show user rank row at the bottom of the list */}
                {userRankInfo && !isUserInTop && (
                  <AnimatedLeaderboardRow index={topPerformers.length + 1} isMe={true}>
                    <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: "#E2E8F0", paddingTop: 12 }}>
                      <Text style={styles.outOfTopLabel}>Your Rank Position</Text>
                      <View style={[styles.leaderboardRow, { marginTop: 6 }]}>
                        <View style={styles.rankIconContainer}>
                          <Text style={styles.rankCircleBadgeText}>#{userRankInfo.rank}</Text>
                        </View>
                        <View style={styles.leaderboardAvatar}>
                          <Text style={styles.leaderboardAvatarText}>
                            {getInitials(currentUser?.name || "")}
                          </Text>
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Text style={[styles.rowUserName, { fontWeight: "800", color: "#1E1B4B" }]} numberOfLines={1}>
                              {currentUser?.name || "You"}
                            </Text>
                            <View style={styles.meBadge}>
                              <Text style={styles.meBadgeText}>You</Text>
                            </View>
                          </View>
                          <Text style={styles.rowUserModules}>
                            {userRankInfo.modules_completed} Modules Completed
                          </Text>
                          <AnimatedProgressBar percentage={currentProgressPercentage} color="#4F46E5" />
                        </View>
                        <View style={{ alignItems: "flex-end", paddingLeft: 8 }}>
                          <Text style={styles.rowUserPercentage}>
                            {currentProgressPercentage.toFixed(0)}%
                          </Text>
                          <Text style={styles.rowUserSubText}>Complete</Text>
                        </View>
                      </View>
                    </View>
                  </AnimatedLeaderboardRow>
                )}
              </ScrollView>

              {/* Summary Stats Footer */}
              <View style={styles.leaderboardFooter}>
                <View style={styles.footerStatBox}>
                  <Text style={styles.footerStatValue}>
                    {leaderboardData?.total_users || 0}
                  </Text>
                  <Text style={styles.footerStatLabel}>Total Users</Text>
                </View>
                <View style={styles.footerStatBox}>
                  <Text style={[styles.footerStatValue, { color: "#2563EB" }]}>
                    {currentProgressPercentage.toFixed(0)}%
                  </Text>
                  <Text style={styles.footerStatLabel}>Your Completion</Text>
                </View>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "flex-end",
  },
  leaderboardContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    height: "85%",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
  },
  leaderboardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  leaderboardTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1E293B",
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  leaderboardLoader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  retryBtn: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#2563EB",
    borderRadius: 8,
  },
  retryBtnText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  userRankCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 16,
  },
  userRankTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748B",
    marginBottom: 12,
  },
  userRankStatsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  userRankStatItem: {
    flex: 1,
    alignItems: "center",
  },
  userRankStatValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1E293B",
  },
  userRankStatLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94A3B8",
    marginTop: 4,
  },
  userRankDivider: {
    width: 1,
    height: 28,
    backgroundColor: "#E2E8F0",
  },
  leaderboardList: {
    flex: 1,
  },
  leaderboardRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  rankIconContainer: {
    width: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  rankCircleBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  rankCircleBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
  },
  leaderboardAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 8,
  },
  avatarGold: {
    backgroundColor: "#FEF3C7",
    borderWidth: 1.5,
    borderColor: "#F59E0B",
  },
  avatarSilver: {
    backgroundColor: "#F1F5F9",
    borderWidth: 1.5,
    borderColor: "#94A3B8",
  },
  avatarBronze: {
    backgroundColor: "#FFEDD5",
    borderWidth: 1.5,
    borderColor: "#D97706",
  },
  leaderboardAvatarText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#475569",
  },
  avatarTextTopThree: {
    color: "#78350F",
    fontWeight: "800",
  },
  rowUserName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
  },
  meBadge: {
    backgroundColor: "#DBEAFE",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  meBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#2563EB",
  },
  rowUserModules: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 4,
  },
  rowProgressBarTrack: {
    height: 4,
    backgroundColor: "#E2E8F0",
    borderRadius: 2,
    marginTop: 6,
    overflow: "hidden",
  },
  rowProgressBarFill: {
    height: "100%",
    backgroundColor: "#2563EB",
    borderRadius: 2,
  },
  rowUserPercentage: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155",
  },
  rowUserSubText: {
    fontSize: 10,
    color: "#94A3B8",
    marginTop: 2,
  },
  outOfTopLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
    marginBottom: 6,
  },
  leaderboardFooter: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingTop: 16,
    marginTop: 12,
  },
  footerStatBox: {
    flex: 1,
    alignItems: "center",
  },
  footerStatValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1E293B",
  },
  footerStatLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94A3B8",
    marginTop: 4,
  },
});
