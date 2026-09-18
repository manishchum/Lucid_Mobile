import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import {
  Scenario,
  RoleplaySession,
  getUserRoleplayData,
  getUserRoleplayReports,
} from "../../../api/roleplay";
import RoleplayCard from "./components/RoleplayCard";
import { STACK_ROUTES } from "../../../navigations/Routes";
import { useAuth } from "../../../contex/AuthContext";
import { eventBus } from "../../../utils/EventBus";
import { logger } from "../../../utils/UnifiedLogger";

export default function RoleplayScreen({ navigation }: { navigation: any }) {
  const { cachedUser } = useAuth();
  const userEmail = cachedUser?.email || "";
  const userId = cachedUser?.userId || "";

  const [activeTab, setActiveTab] = useState<"scenarios" | "reports">("scenarios");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [limits, setLimits] = useState<{ roleplayLimit: number; retryLimit: number }>({
    roleplayLimit: 5,
    retryLimit: 3,
  });
  const [remainingAttempts, setRemainingAttempts] = useState<Record<string, number>>({});
  const [pastSessions, setPastSessions] = useState<RoleplaySession[]>([]);

  const loadData = useCallback(async () => {
    if (!userEmail) return;
    try {
      // 1. Load user scenarios & retry limits
      const data = await getUserRoleplayData(userEmail);
      if (data) {
        setScenarios(data.scenarios || []);
        if (data.limits) setLimits(data.limits);
        if (data.remainingAttempts) setRemainingAttempts(data.remainingAttempts);
      }

      // 2. Load past roleplay report sessions
      if (userId) {
        const reports = await getUserRoleplayReports(userId);
        setPastSessions(reports || []);
      }
    } catch (e) {
      logger.error("[RoleplayScreen] Error loading data:", e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [userEmail, userId]);

  useEffect(() => {
    loadData();
    const unsub = eventBus.on("refresh_roleplay", loadData);
    return () => {
      unsub();
    };
  }, [loadData]);

  const onRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  const handleStartRoleplay = (scenario: Scenario) => {
    navigation.navigate(STACK_ROUTES.ROLEPLAY_SESSION as never, { scenario });
  };

  const handleViewReport = (session: RoleplaySession) => {
    navigation.navigate(STACK_ROUTES.ROLEPLAY_REPORT as never, { session });
  };

  const renderReportItem = ({ item }: { item: RoleplaySession }) => {
    const assessment = item.roleplay_assessments?.[0];
    const score = assessment?.overall_score ?? 0;
    const isPassed = score >= 60;

    return (
      <TouchableOpacity
        style={styles.reportCard}
        activeOpacity={0.8}
        onPress={() => handleViewReport(item)}
      >
        <View style={styles.reportHeader}>
          <Text style={styles.reportTitle} numberOfLines={1}>
            {item.scenario_title || "Roleplay Session"}
          </Text>
          <View style={[styles.scoreBadge, { backgroundColor: isPassed ? "#ECFDF5" : "#FEF2F2" }]}>
            <Text style={[styles.scoreBadgeText, { color: isPassed ? "#059669" : "#DC2626" }]}>
              {score}% Score
            </Text>
          </View>
        </View>

        <Text style={styles.reportMetaText}>
          Role: {item.scenario_role || "Learner"} • {new Date(item.started_at).toLocaleDateString()}
        </Text>

        {assessment?.summary && (
          <Text style={styles.reportSummary} numberOfLines={2}>
            {assessment.summary}
          </Text>
        )}

        <View style={styles.reportFooter}>
          <Text style={styles.viewDetailText}>View Evaluation Report</Text>
          <MaterialCommunityIcons name="chevron-right" size={18} color="#6366F1" />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      {/* Navigation Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Roleplay Practice</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Quota Banner */}
      {/* <View style={styles.quotaBanner}>
        <View style={styles.quotaIconWrapper}>
          <MaterialCommunityIcons name="lightning-bolt" size={20} color="#6366F1" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.quotaTitle}>Company Practice Limits</Text>
          <Text style={styles.quotaSubtext}>
            Max {limits.roleplayLimit} Scenarios assigned • Up to {limits.retryLimit} Retries per scenario
          </Text>
        </View>
      </View> */}

      {/* Tab Selector Segmented Controls */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === "scenarios" && styles.activeTabItem]}
          onPress={() => setActiveTab("scenarios")}
        >
          <Text style={[styles.tabText, activeTab === "scenarios" && styles.activeTabText]}>
            Assigned Scenarios ({scenarios.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === "reports" && styles.activeTabItem]}
          onPress={() => setActiveTab("reports")}
        >
          <Text style={[styles.tabText, activeTab === "reports" && styles.activeTabText]}>
            Past Reports ({pastSessions.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Content Area */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Loading Roleplays...</Text>
        </View>
      ) : activeTab === "scenarios" ? (
        <FlatList
          data={scenarios}
          keyExtractor={(item) => item.scenario_id}
          renderItem={({ item }) => (
            <RoleplayCard
              scenario={item}
              remainingAttempts={remainingAttempts[item.scenario_id]}
              onPressStart={handleStartRoleplay}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={["#6366F1"]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="account-voice-off" size={48} color="#94A3B8" />
              <Text style={styles.emptyTitle}>No Roleplays Assigned Yet</Text>
              <Text style={styles.emptySubtext}>
                Scenarios assigned by your administrator will appear here.
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={pastSessions}
          keyExtractor={(item) => item.id}
          renderItem={renderReportItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={["#6366F1"]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="clipboard-text-off-outline" size={48} color="#94A3B8" />
              <Text style={styles.emptyTitle}>No Past Reports Found</Text>
              <Text style={styles.emptySubtext}>
                Complete a roleplay practice session to view your evaluation reports here.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    paddingTop: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
  },
  quotaBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEF2FF",
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#C7D2FE",
  },
  quotaIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  quotaTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#3730A3",
  },
  quotaSubtext: {
    fontSize: 11,
    color: "#4F46E5",
    marginTop: 2,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#E2E8F0",
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 12,
    padding: 3,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 10,
  },
  activeTabItem: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
  activeTabText: {
    color: "#4F46E5",
    fontWeight: "700",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#64748B",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  reportCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  reportHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    flex: 1,
    marginRight: 8,
  },
  scoreBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  scoreBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  reportMetaText: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 8,
  },
  reportSummary: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 18,
    marginBottom: 12,
  },
  reportFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 10,
  },
  viewDetailText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6366F1",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
  },
});
