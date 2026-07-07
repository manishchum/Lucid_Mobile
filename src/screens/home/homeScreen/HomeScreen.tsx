import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../../../contex/AuthContext";
import { useGetUserByPhone, useGetDashboardSummary, useGetLeaderboardHighlight, LeaderboardHighlightData, LeaderboardUser } from "../../../api/users";
import createStyles from "./style";
import { useScreenProtection } from "../../../hooks/security/useScreenProtection";
import ScreenRecordingGuard from "../../../components/security/ScreenRecordingGuard";
import { APP_ROUTES, STACK_ROUTES } from "../../../navigations/Routes";
import { useNotifications } from "../../../contex/NotificationContext";
import AssignedSection from "../components/AssignedSection";

const styles = createStyles();

// ── Progress circle ────────────────────────────────────────────────────────────
const ProgressCircle = ({ percentage }: { percentage: number }) => {
  const size = 88;
  const strokeWidth = 7;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const clamped = Math.min(Math.max(percentage, 0), 100);
  const strokeDashoffset = circumference - (clamped / 100) * circumference;
  const isComplete = clamped >= 100;

  return (
    <View style={styles.progressCircleContainer}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={isComplete ? "#DCFCE7" : "#EFF6FF"}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={isComplete ? "#16A34A" : "#2563EB"}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="none"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.progressCircleInner}>
        <Text
          style={[
            styles.progressCirclePercent,
            isComplete && { color: "#16A34A" },
          ]}
        >
          {clamped.toFixed(1)}%
        </Text>
      </View>
    </View>
  );
};

// ── Main screen ────────────────────────────────────────────────────────────────
export default function HomeScreen({ navigation }: { navigation: any }) {
  const { logout, cachedUser, phoneNumber } = useAuth();
  const { unreadCount } = useNotifications();

  // ── Screen capture protection (blocks screenshots + recording) ──────────────
  const { isRecording } = useScreenProtection({ tag: "HomeScreen" });

  const resolvedUserId = cachedUser?.userId ?? null;
  const resolvedPhone = cachedUser?.phone ?? phoneNumber ?? null;

  const { user: fetchedUser, isLoading: userLoading } = useGetUserByPhone(
    resolvedUserId ? null : resolvedPhone,
  );

  const user = cachedUser
    ? {
        user_id: cachedUser.userId,
        name: cachedUser.name,
        email: cachedUser.email,
        phone: cachedUser.phone,
        company_id: cachedUser.companyId,
        department_id: cachedUser.departmentId,
        manager_id: cachedUser.managerId,
        is_active: cachedUser.isActive,
        position: null,
      }
    : fetchedUser;

  const position = fetchedUser?.position ?? null;
  const userId = user?.user_id ?? resolvedUserId;
  const companyId = user?.company_id ?? cachedUser?.companyId ?? null;

  // ✅ resolvedPlanCards comes pre-built from the hook with correctly aligned
  //    processedModuleIds — no further mapping needed here.
  const {
    dashboardData,
    resolvedPlanCards,
    stats,
    isLoading: dashboardLoading,
    error: dashboardError,
    refetch,
  } = useGetDashboardSummary(userId ?? null, companyId ?? null);

  const [isLeaderboardOpen, setIsLeaderboardOpen] = React.useState(false);

  const {
    leaderboardData,
    isLoading: leaderboardLoading,
    error: leaderboardError,
    refetch: refetchLeaderboard,
  } = useGetLeaderboardHighlight(companyId, userId, 10);

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetch(true),
        refetchLeaderboard(true).catch((err) => console.warn("[HomeScreen] Leaderboard refresh error:", err))
      ]);
    } catch (err) {
      console.error("[HomeScreen] Refresh error:", err);
    } finally {
      setRefreshing(false);
    }
  }, [refetch, refetchLeaderboard]);

  useFocusEffect(
    React.useCallback(() => {
      refetch(false); // Silent background update on screen focus
      refetchLeaderboard(false).catch(() => {});
    }, [refetch, refetchLeaderboard]),
  );

  const isLoading = (userLoading && !cachedUser) || dashboardLoading;

  if (isLoading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={{ marginTop: 12, color: "#64748B", fontSize: 14 }}>
          Loading your dashboard…
        </Text>
      </View>
    );
  }

  if (dashboardError) {
    return (
      <View style={styles.loader}>
        <MaterialCommunityIcons
          name="alert-circle-outline"
          size={48}
          color="#EF4444"
        />
        <Text
          style={{
            marginTop: 12,
            fontSize: 16,
            fontWeight: "600",
            color: "#1E293B",
          }}
        >
          Failed to load dashboard
        </Text>
        <Text
          style={{
            marginTop: 8,
            fontSize: 14,
            color: "#64748B",
            textAlign: "center",
            paddingHorizontal: 20,
          }}
        >
          {dashboardError.message}
        </Text>
      </View>
    );
  }

  const { completedCount, totalAssigned, progressPercentage, nudgeMessage } =
    stats;
  const firstName = user?.name?.split(" ")[0] || "";

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
        >
          {/* ── HEADER ──────────────────────────────────────────────────────── */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greetingText}>
                Welcome, {firstName || "there"}
              </Text>
              <Text style={styles.emailText}>
                {position || user?.email || ""}
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <TouchableOpacity
                style={styles.leaderboardBtn}
                onPress={() => setIsLeaderboardOpen(true)}
              >
                <MaterialCommunityIcons name="trophy-outline" size={22} color="#475569" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.notificationBtn}
                onPress={() => navigation.navigate(STACK_ROUTES.NOTIFICATIONS)}
              >
                <MaterialCommunityIcons name="bell" size={22} color="#475569" />
                {unreadCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* ── YOUR PROGRESS CARD ──────────────────────────────────────────── */}
          {
            <>
              <View style={styles.sectionWrapper}>
                <View style={styles.progressCard}>
                  <View style={styles.progressLeft}>
                    <View style={styles.progressIconBox}>
                      <MaterialCommunityIcons
                        name={
                          progressPercentage >= 100
                            ? "trophy"
                            : "lightning-bolt"
                        }
                        size={22}
                        color="#2563EB"
                      />
                    </View>
                    <View style={styles.progressTextBlock}>
                      <Text style={styles.progressCardTitle}>
                        Your Progress
                      </Text>
                      <Text style={styles.progressNudge}>{nudgeMessage}</Text>
                      <View style={styles.completedBadge}>
                        <Text style={styles.completedBadgeText}>
                          {completedCount} COMPLETED
                        </Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.progressRight}>
                    <ProgressCircle percentage={progressPercentage} />
                    <Text style={styles.progressOfText}>
                      {completedCount} of {totalAssigned}
                    </Text>
                  </View>
                </View>
              </View>

              {/* ── QUICK STATS ─────────────────────────────────────────── */}
              <View style={styles.sectionWrapper}>
                <Text style={styles.sectionTitle}>Overview</Text>
                <View style={styles.statsGrid}>
                  <StatCard
                    icon="book-multiple"
                    color="#EEF2FF"
                    iconColor="#4F46E5"
                    val={String(resolvedPlanCards.length)}
                    label="Sprints"
                  />
                  <StatCard
                    icon="check-decagram"
                    color="#ECFDF5"
                    iconColor="#10B981"
                    val={String(completedCount)}
                    label="Completed"
                  />
                  <StatCard
                    icon="lightning-bolt"
                    color="#FFF7ED"
                    iconColor="#F59E0B"
                    val={String(
                      resolvedPlanCards.filter(
                        (p) => p.status === "IN_PROGRESS",
                      ).length,
                    )}
                    label="In Progress"
                  />
                </View>
              </View>
            </>
          }

          {/* ── ASSIGNED SECTION (sprints + tasks tabbed) ───────────────── */}
          <AssignedSection
            planCards={resolvedPlanCards}
            navigation={navigation}
            userId={userId ?? null}
            companyId={companyId ?? null}
          />
        </ScrollView>
      </KeyboardAvoidingView>
      {/* iOS screen-recording overlay — invisible on Android */}
      <ScreenRecordingGuard isRecording={isRecording} />

      {/* Leaderboard Modal */}
      <LeaderboardModal
        isOpen={isLeaderboardOpen}
        onClose={() => setIsLeaderboardOpen(false)}
        leaderboardData={leaderboardData}
        isLoading={leaderboardLoading}
        error={leaderboardError}
        currentUser={user}
        currentProgressPercentage={progressPercentage}
        onRefresh={() => refetchLeaderboard(true)}
      />
    </SafeAreaView>
  );
}

const StatCard = ({ icon, color, iconColor, val, label }: any) => (
  <View style={styles.statCard}>
    <View style={[styles.statIconBox, { backgroundColor: color }]}>
      <MaterialCommunityIcons name={icon} size={20} color={iconColor} />
    </View>
    <Text style={styles.statVal}>{val}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

// ── Leaderboard Modal Component ──────────────────────────────────────────────────

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

const LeaderboardModal = ({
  isOpen,
  onClose,
  leaderboardData,
  isLoading,
  error,
  currentUser,
  currentProgressPercentage,
  onRefresh,
}: LeaderboardModalProps) => {
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
    ? topPerformers.find((u: LeaderboardUser) => u.user_id === currentUser?.user_id || u.user_id === currentUser?.userId)?.rank ?? null
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

              {/* Scrollable list of ranks */}
              <ScrollView
                style={styles.leaderboardList}
                contentContainerStyle={{ paddingBottom: 10 }}
                showsVerticalScrollIndicator={false}
              >
                {topPerformers.map((entry: LeaderboardUser) => {
                  const isMe = entry.user_id === currentUser?.user_id || entry.user_id === currentUser?.userId;
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
};
