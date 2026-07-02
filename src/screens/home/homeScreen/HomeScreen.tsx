import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../../../contex/AuthContext";
import { useGetUserByPhone, useGetDashboardSummary } from "../../../api/users";
import createStyles from "./style";
import { useScreenProtection } from "../../../hooks/security/useScreenProtection";
import ScreenRecordingGuard from "../../../components/security/ScreenRecordingGuard";
import { APP_ROUTES, STACK_ROUTES } from "../../../navigations/Routes";
import { useNotifications } from "../../../contex/NotificationContext";

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

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch(true);
    } catch (err) {
      console.error("[HomeScreen] Refresh error:", err);
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  useFocusEffect(
    React.useCallback(() => {
      refetch(false); // Silent background update on screen focus
    }, [refetch])
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
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
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

        {/* ── YOUR PROGRESS CARD ──────────────────────────────────────────── */}
        <View style={styles.sectionWrapper}>
          <View style={styles.progressCard}>
            <View style={styles.progressLeft}>
              <View style={styles.progressIconBox}>
                <MaterialCommunityIcons
                  name={progressPercentage >= 100 ? "trophy" : "lightning-bolt"}
                  size={22}
                  color="#2563EB"
                />
              </View>
              <View style={styles.progressTextBlock}>
                <Text style={styles.progressCardTitle}>Your Progress</Text>
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

        {/* ── QUICK STATS ─────────────────────────────────────────────────── */}
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
                resolvedPlanCards.filter((p) => p.status === "IN_PROGRESS")
                  .length,
              )}
              label="In Progress"
            />
          </View>
        </View>

        {/* ── ASSIGNED SPRINTS ────────────────────────────────────────────── */}
        <View style={styles.sectionWrapper}>
          <Text style={styles.sectionTitle}>Assigned Sprints</Text>

          {resolvedPlanCards.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons
                name="book-open-outline"
                size={40}
                color="#CBD5E1"
              />
              <Text style={styles.emptyStateText}>No sprints assigned yet</Text>
            </View>
          ) : (
            resolvedPlanCards.map((plan) => {
              const isCompleted = plan.status === "COMPLETED";
              const isInProgress = plan.status === "IN_PROGRESS";

              return (
                <View key={plan.planKey} style={styles.planCard}>
                  <View style={styles.planHeaderRow}>
                    <View
                      style={[
                        styles.statusBadge,
                        isCompleted
                          ? styles.statusBadgeCompleted
                          : isInProgress
                            ? styles.statusBadgeInProgress
                            : styles.statusBadgeNotStarted,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          isCompleted
                            ? styles.statusTextCompleted
                            : isInProgress
                              ? styles.statusTextInProgress
                              : styles.statusTextNotStarted,
                        ]}
                      >
                        {isCompleted
                          ? "Completed"
                          : isInProgress
                            ? "In Progress"
                            : "Not Started"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.planContentRow}>
                    <View style={styles.planIconCircle}>
                      <MaterialCommunityIcons
                        name="school-outline"
                        size={24}
                        color="#64748B"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.planTitleText}>{plan.title}</Text>
                      <Text style={styles.planSubText} numberOfLines={2}>
                        {plan.totalModules} module
                        {plan.totalModules !== 1 ? "s" : ""}
                        {plan.tips ? ` · ${plan.tips.substring(0, 55)}…` : ""}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.sprintButton,
                      isCompleted
                        ? styles.sprintButtonReview
                        : isInProgress
                          ? styles.sprintButtonContinue
                          : styles.sprintButtonStart,
                    ]}
                    activeOpacity={0.8}
                    onPress={() =>
                      navigation.navigate(APP_ROUTES.SPRINT, {
                        moduleId: plan.moduleId,
                        planId: plan.planKey,
                        planTitle: plan.title,
                        modules: plan.modules,
                        tips: plan.tips,
                        processedModuleIds: plan.processedModuleIds,
                      })
                    }
                  >
                    <Text
                      style={[
                        styles.sprintButtonText,
                        isCompleted
                          ? styles.sprintButtonTextReview
                          : isInProgress
                            ? styles.sprintButtonTextContinue
                            : styles.sprintButtonTextStart,
                      ]}
                    >
                      {isCompleted
                        ? "Review Sprint"
                        : isInProgress
                          ? "Continue"
                          : "Start your sprint"}
                    </Text>
                    <MaterialCommunityIcons
                      name="arrow-right"
                      size={16}
                      color={
                        isCompleted
                          ? "#475569"
                          : isInProgress
                            ? "#2563EB"
                            : "#fff"
                      }
                    />
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
      {/* iOS screen-recording overlay — invisible on Android */}
      <ScreenRecordingGuard isRecording={isRecording} />
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