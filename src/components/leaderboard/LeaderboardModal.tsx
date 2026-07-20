import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
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
        return <MaterialCommunityIcons name="crown" size={20} color="#d97706" />;
      case 2:
        return <MaterialCommunityIcons name="medal" size={20} color="#94a3b8" />;
      case 3:
        return <MaterialCommunityIcons name="medal" size={20} color="#b45309" />;
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
              <MaterialCommunityIcons name="trophy" size={24} color="#d97706" />
              <Text style={styles.leaderboardTitle}>Leaderboard</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <MaterialCommunityIcons name="close" size={22} color="#64748b" />
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
              <MaterialCommunityIcons name="trophy-outline" size={40} color="#cbd5e1" />
              <Text style={{ marginTop: 10, color: "#64748B", textAlign: "center" }}>
                No rankings available yet.
              </Text>
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              {/* Current User Stats Highlights at Top */}
              <View style={styles.userRankCard}>
                <Text style={styles.userRankTitle}>Your Standing</Text>
                <View style={styles.userRankStatsRow}>
                  <View style={styles.userRankStatItem}>
                    <Text style={styles.userRankStatValue}>
                      {resolvedRank ? `#${resolvedRank}` : "N/A"}
                    </Text>
                    <Text style={styles.userRankStatLabel}>Rank</Text>
                  </View>
                  <View style={styles.userRankDivider} />
                  <View style={styles.userRankStatItem}>
                    <Text style={styles.userRankStatValue}>
                      {resolvedPercentile !== null ? `${resolvedPercentile}%` : "Top 100%"}
                    </Text>
                    <Text style={styles.userRankStatLabel}>Top Percentile</Text>
                  </View>
                  <View style={styles.userRankDivider} />
                  <View style={styles.userRankStatItem}>
                    <Text style={styles.userRankStatValue}>
                      {currentProgressPercentage.toFixed(0)}%
                    </Text>
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
                {topPerformers.map((entry: LeaderboardUser) => {
                  const isMe =
                    entry.user_id === currentUser?.user_id ||
                    entry.user_id === currentUser?.userId;
                  return (
                    <View
                      key={entry.user_id}
                      style={[
                        styles.leaderboardRow,
                        isMe && styles.leaderboardRowMe,
                      ]}
                    >
                      {/* Medal / Position */}
                      <View style={styles.rankIconContainer}>
                        {getMedalIcon(entry.rank)}
                      </View>

                      {/* Initials / Avatar */}
                      <View style={styles.leaderboardAvatar}>
                        <Text style={styles.leaderboardAvatarText}>
                          {getInitials(entry.name)}
                        </Text>
                      </View>

                      {/* Name & Module Info */}
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text
                            style={[
                              styles.rowUserName,
                              isMe && { fontWeight: "800", color: "#1e1b4b" },
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
                        {/* Progress Bar */}
                        <View style={styles.rowProgressBarTrack}>
                          <View
                            style={[
                              styles.rowProgressBarFill,
                              { width: `${entry.completion_percentage}%` },
                            ]}
                          />
                        </View>
                      </View>

                      {/* Score/Percentage */}
                      <View style={{ alignItems: "flex-end", paddingLeft: 8 }}>
                        <Text style={styles.rowUserPercentage}>
                          {entry.completion_percentage}%
                        </Text>
                        <Text style={styles.rowUserSubText}>Complete</Text>
                      </View>
                    </View>
                  );
                })}

                {/* If user is not in top N, show user rank row at the bottom of the list */}
                {userRankInfo && !isUserInTop && (
                  <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: "#e2e8f0", paddingTop: 12 }}>
                    <Text style={styles.outOfTopLabel}>Your Rank Position</Text>
                    <View style={[styles.leaderboardRow, styles.leaderboardRowMe, { marginTop: 6 }]}>
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
                          <Text style={[styles.rowUserName, { fontWeight: "800", color: "#1e1b4b" }]} numberOfLines={1}>
                            {currentUser?.name || "You"}
                          </Text>
                          <View style={styles.meBadge}>
                            <Text style={styles.meBadgeText}>You</Text>
                          </View>
                        </View>
                        <Text style={styles.rowUserModules}>
                          {userRankInfo.modules_completed} Modules Completed
                        </Text>
                        <View style={styles.rowProgressBarTrack}>
                          <View
                            style={[
                              styles.rowProgressBarFill,
                              { width: `${currentProgressPercentage}%` },
                            ]}
                          />
                        </View>
                      </View>
                      <View style={{ alignItems: "flex-end", paddingLeft: 8 }}>
                        <Text style={styles.rowUserPercentage}>
                          {currentProgressPercentage.toFixed(0)}%
                        </Text>
                        <Text style={styles.rowUserSubText}>Complete</Text>
                      </View>
                    </View>
                  </View>
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
    backgroundColor: "#ffffff",
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
    color: "#1e293b",
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f1f5f9",
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
    color: "#ffffff",
    fontWeight: "600",
  },
  userRankCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 16,
  },
  userRankTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748b",
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
    color: "#1e293b",
  },
  userRankStatLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94a3b8",
    marginTop: 4,
  },
  userRankDivider: {
    width: 1,
    height: 28,
    backgroundColor: "#e2e8f0",
  },
  leaderboardList: {
    flex: 1,
  },
  leaderboardRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  leaderboardRowMe: {
    backgroundColor: "#eff6ff",
    borderRadius: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 0,
    marginVertical: 2,
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
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },
  rankCircleBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
  },
  leaderboardAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 8,
  },
  leaderboardAvatarText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#475569",
  },
  rowUserName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
  },
  meBadge: {
    backgroundColor: "#dbeafe",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  meBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#2563eb",
  },
  rowUserModules: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 4,
  },
  rowProgressBarTrack: {
    height: 4,
    backgroundColor: "#e2e8f0",
    borderRadius: 2,
    marginTop: 6,
  },
  rowProgressBarFill: {
    height: "100%",
    backgroundColor: "#2563eb",
    borderRadius: 2,
  },
  rowUserPercentage: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155",
  },
  rowUserSubText: {
    fontSize: 10,
    color: "#94a3b8",
    marginTop: 2,
  },
  outOfTopLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
    marginBottom: 6,
  },
  leaderboardFooter: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
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
    color: "#1e293b",
  },
  footerStatLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94a3b8",
    marginTop: 4,
  },
});
