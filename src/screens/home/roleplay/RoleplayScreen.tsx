import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { Scenario, getUserRoleplayData } from "../../../api/roleplay";
import RoleplayCard from "./components/RoleplayCard";
import { STACK_ROUTES } from "../../../navigations/Routes";
import { useAuth } from "../../../contex/AuthContext";
import { eventBus } from "../../../utils/EventBus";
import { logger } from "../../../utils/UnifiedLogger";

export default function RoleplayScreen({ navigation }: { navigation: any }) {
  const { cachedUser } = useAuth();
  const userEmail = cachedUser?.email || "";

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [limits, setLimits] = useState<{ roleplayLimit: number; retryLimit: number }>({
    roleplayLimit: 5,
    retryLimit: 3,
  });
  const [remainingAttempts, setRemainingAttempts] = useState<Record<string, number>>({});

  const loadData = useCallback(async () => {
    if (!userEmail) return;
    try {
      const data = await getUserRoleplayData(userEmail);
      if (data) {
        setScenarios(data.scenarios || []);
        if (data.limits) setLimits(data.limits);
        if (data.remainingAttempts) setRemainingAttempts(data.remainingAttempts);
      }
    } catch (e) {
      logger.error("[RoleplayScreen] Error loading data:", e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [userEmail]);

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
    navigation.navigate(STACK_ROUTES.ROLEPLAY_CONFIG as never, { scenario });
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

      {/* Scenarios Count Info */}
      {!isLoading && scenarios.length > 0 && (
        <View style={styles.infoBanner}>
          <MaterialCommunityIcons name="account-voice" size={18} color="#6366F1" />
          <Text style={styles.infoBannerText}>
            {scenarios.length} scenario{scenarios.length !== 1 ? "s" : ""} assigned to you
          </Text>
        </View>
      )}

      {/* Main Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Loading Roleplays...</Text>
        </View>
      ) : (
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
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
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
  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEF2FF",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    gap: 8,
  },
  infoBannerText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4338CA",
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
    paddingTop: 12,
    paddingBottom: 24,
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
