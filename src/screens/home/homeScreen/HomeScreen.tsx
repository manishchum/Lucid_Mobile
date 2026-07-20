import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import Svg, { Circle } from "react-native-svg";
import { useAuth } from "../../../contex/AuthContext";
import { useGetUserByPhone, useGetDashboardSummary } from "../../../api/users";
import createStyles from "./style";
import { useScreenProtection } from "../../../hooks/security/useScreenProtection";
import ScreenRecordingGuard from "../../../components/security/ScreenRecordingGuard";
import AssignedSection from "../components/AssignedSection";
import RefreshSpinner from "../../../components/pullToRefresh/RefreshSpinner";

const ProgressRing = ({ percentage }: { percentage: number }) => {
  const size = 72;
  const strokeWidth = 7;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (circumference * Math.min(Math.max(percentage, 0), 100)) / 100;

  return (
    <View style={{ width: size, height: size, justifyContent: "center", alignItems: "center" }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#F1F5F9"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#10B981"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="none"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={{ position: "absolute", justifyContent: "center", alignItems: "center" }}>
        <Text style={{ fontSize: 13, fontWeight: "800", color: "#0F172A" }}>
          {Math.round(percentage)}%
        </Text>
      </View>
    </View>
  );
};

const styles = createStyles();

// ── Main screen ────────────────────────────────────────────────────────────────
export default function HomeScreen({ navigation }: { navigation: any }) {
  const { cachedUser, phoneNumber } = useAuth();

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

  const userId = user?.user_id ?? resolvedUserId;
  const companyId = user?.company_id ?? cachedUser?.companyId ?? null;

  const {
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
    }, [refetch]),
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

  const { completedCount, totalAssigned, progressPercentage } = stats;

  return (
    <View style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={
            RefreshSpinner(refreshing, onRefresh)
          }
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
        >
          {/* ── CONSOLIDATED HERO ──────────────────────────────────────────── */}
          <View style={styles.welcomeContainer}>
            <View style={styles.welcomeHeaderRow}>
              <View style={styles.welcomeTextColumn}>
                <Text style={styles.welcomeSub}>Welcome back,</Text>
                <Text style={styles.welcomeName}>
                  {(user?.name || "Learner").split(" ")[0]}!
                </Text>
                <Text style={styles.welcomeTagline}>Keep learning, keep growing.</Text>
              </View>
              <View style={styles.ringWrapper}>
                <ProgressRing percentage={progressPercentage} />
              </View>
            </View>
          </View>

          {/* ── QUICK STATS ─────────────────────────────────────────── */}
          <View style={styles.sectionWrapper}>
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
                icon="clock-time-eight-outline"
                color="#FFF7ED"
                iconColor="#F59E0B"
                val={String(
                  resolvedPlanCards.filter((p) => p.status === "IN_PROGRESS").length,
                )}
                label="In Progress"
              />
            </View>
          </View>

          {/* ── ASSIGNED SECTION (sprints + tasks tabbed) ───────────────── */}
          <AssignedSection
            planCards={resolvedPlanCards}
            navigation={navigation}
            userId={userId ?? null}
            companyId={companyId ?? null}
            userName={user?.name ?? null}
          />
        </ScrollView>
      </KeyboardAvoidingView>
      {/* iOS screen-recording overlay — invisible on Android */}
      <ScreenRecordingGuard isRecording={isRecording} />
    </View>
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
