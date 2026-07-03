import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useGetTasks } from "../../../api/users";
import AssignedSprintsList, { PlanCard } from "./AssignedSprintsList";
import AssignedTasksList from "./AssignedTasksList";
import { useFeatureGating, FEATURES } from "../../../hooks/useFeatureGating";

type TabId = "sprints" | "tasks";

interface AssignedSectionProps {
  planCards: PlanCard[];
  navigation: any;
  userId: string | null;
  companyId: string | null;
}

export default function AssignedSection({
  planCards,
  navigation,
  userId,
  companyId,
}: AssignedSectionProps) {
  const [activeTab, setActiveTab] = useState<TabId>("sprints");

  // ── Fetch tasks from API ─────────────────────────────────────────────
  const { tasks, total, isLoading, error, refetch } = useGetTasks(
    userId,
    companyId,
  );

  // Sprints are non-negotiable and always render
  const { hasFeature } = useFeatureGating();
  const showTaskManagement = hasFeature(FEATURES.TASK_MANAGEMENT);

  const sprintCount = planCards.length;
  const taskCount = total > 0 ? total : tasks.length;

  const effectiveTab: TabId =
    activeTab === "tasks" && !showTaskManagement ? "sprints" : activeTab;

  const visibleTabs: TabId[] = showTaskManagement
    ? ["sprints", "tasks"]
    : ["sprints"];

  const switchTab = (tab: TabId) => setActiveTab(tab);

  return (
    <View style={styles.container}>
      {/* ── Section heading ───────────────────────────────────────── */}
      <View style={styles.headingRow}>
        <Text style={styles.heading}>My Work</Text>
        <View style={styles.totalBadge}>
          <Text style={styles.totalBadgeText}>
            {effectiveTab === "sprints" ? sprintCount : taskCount}
          </Text>
        </View>
      </View>

      {/* ── Tab bar — Sprints always shown; Tasks only if addon is on ── */}
      {visibleTabs.length > 1 && (
        <View style={styles.tabBar}>
          {visibleTabs.map((tab) => {
            const isActive = effectiveTab === tab;
            const count = tab === "sprints" ? sprintCount : taskCount;
            const icon =
              tab === "sprints" ? "lightning-bolt" : "clipboard-list-outline";
            const label = tab === "sprints" ? "Sprints" : "Tasks";

            return (
              <TouchableOpacity
                key={tab}
                style={[styles.tabBtn, isActive && styles.tabBtnActive]}
                onPress={() => switchTab(tab)}
                activeOpacity={0.75}
              >
                <MaterialCommunityIcons
                  name={icon as any}
                  size={15}
                  color={isActive ? "#2563EB" : "#94A3B8"}
                />
                <Text
                  style={[styles.tabLabel, isActive && styles.tabLabelActive]}
                >
                  {label}
                </Text>
                {count > 0 && (
                  <View
                    style={[styles.tabCount, isActive && styles.tabCountActive]}
                  >
                    <Text
                      style={[
                        styles.tabCountText,
                        isActive && styles.tabCountTextActive,
                      ]}
                    >
                      {count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* ── Content ───────────────────────────────────────────────── */}
      {effectiveTab === "sprints" ? (
        <AssignedSprintsList planCards={planCards} navigation={navigation} />
      ) : (
        <AssignedTasksList
          tasks={tasks}
          isLoading={isLoading}
          error={error}
          onRetry={refetch}
          userId={userId}
          onTaskSubmitted={() => {
            refetch();
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
    paddingHorizontal: 20,
  },

  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  heading: { fontSize: 18, fontWeight: "800", color: "#1E293B" },
  totalBadge: {
    backgroundColor: "#EFF6FF",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  totalBadgeText: { fontSize: 12, fontWeight: "800", color: "#2563EB" },

  // Tab bar
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 16,
    padding: 4,
    marginBottom: 16,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: 13,
  },
  tabBtnActive: {
    backgroundColor: "#fff",
    shadowColor: "#64748B",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  tabLabel: { fontSize: 12, fontWeight: "600", color: "#94A3B8" },
  tabLabelActive: { color: "#2563EB", fontWeight: "700" },
  tabCount: {
    backgroundColor: "#E2E8F0",
    borderRadius: 6,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  tabCountActive: { backgroundColor: "#EFF6FF" },
  tabCountText: { fontSize: 10, fontWeight: "800", color: "#94A3B8" },
  tabCountTextActive: { color: "#2563EB" },
});
