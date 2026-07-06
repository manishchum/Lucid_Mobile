import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { APP_ROUTES } from "../../../navigations/Routes";

export interface PlanCard {
  planKey: string;
  title: string;
  moduleId: string;
  modules: any[];
  totalModules: number;
  tips?: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  processedModuleIds?: string[];
  completedModulesCount?: number;
}

interface AssignedSprintsListProps {
  planCards: PlanCard[];
  navigation: any;
  emptyMessage?: string;
}

export const getSprintProgress = (plan: PlanCard): number => {
  if (!plan.totalModules) return 0;
  const completed = Math.min(
    Math.max(plan.completedModulesCount ?? 0, 0),
    plan.totalModules,
  );
  return Math.round((completed / plan.totalModules) * 100);
};

export default function AssignedSprintsList({
  planCards,
  navigation,
  emptyMessage,
}: AssignedSprintsListProps) {
  if (planCards.length === 0) {
    return (
      <View style={styles.emptyState}>
        <MaterialCommunityIcons
          name="book-open-outline"
          size={40}
          color="#CBD5E1"
        />
        <Text style={styles.emptyStateText}>
          {emptyMessage ?? "No sprints assigned yet"}
        </Text>
      </View>
    );
  }

  return (
    <>
      {planCards.map((plan) => {
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
                  {Math.min(plan.completedModulesCount ?? 0, plan.totalModules)}
                  {" / "}
                  {plan.totalModules} module
                  {plan.totalModules !== 1 ? "s" : ""}
                  {plan.tips ? ` · ${plan.tips.substring(0, 55)}…` : ""}
                </Text>
              </View>
              <Text style={styles.planProgressText}>
                {getSprintProgress(plan)}%
              </Text>
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
                  isCompleted ? "#475569" : isInProgress ? "#2563EB" : "#fff"
                }
              />
            </TouchableOpacity>
          </View>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  emptyState: { alignItems: "center", paddingVertical: 40 },
  emptyStateText: {
    marginTop: 12,
    fontSize: 15,
    color: "#94A3B8",
    fontWeight: "500",
  },

  planCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  planHeaderRow: { flexDirection: "row", marginBottom: 14 },
  planContentRow: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 16,
    alignItems: "flex-start",
  },
  planIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 13,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F1F5F9",
    flexShrink: 0,
  },
  planTitleText: { fontSize: 16, fontWeight: "700", color: "#1E293B" },
  planProgressText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#2563EB",
    marginLeft: 6,
    alignSelf: "flex-start",
  },
  planSubText: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 4,
    lineHeight: 18,
  },

  statusBadge: {
    alignSelf: "flex-start",
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  statusBadgeNotStarted: { backgroundColor: "#F1F5F9" },
  statusBadgeInProgress: { backgroundColor: "#EFF6FF" },
  statusBadgeCompleted: { backgroundColor: "#DCFCE7" },
  statusBadgeText: { fontSize: 11, fontWeight: "700" },
  statusTextNotStarted: { color: "#64748B" },
  statusTextInProgress: { color: "#2563EB" },
  statusTextCompleted: { color: "#16A34A" },

  sprintButton: {
    borderRadius: 14,
    paddingVertical: 13,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  sprintButtonStart: { backgroundColor: "#2563EB" },
  sprintButtonContinue: {
    borderWidth: 1.5,
    borderColor: "#2563EB",
    backgroundColor: "#fff",
  },
  sprintButtonReview: { backgroundColor: "#F1F5F9" },
  sprintButtonText: { fontWeight: "700", fontSize: 14 },
  sprintButtonTextStart: { color: "#fff" },
  sprintButtonTextContinue: { color: "#2563EB" },
  sprintButtonTextReview: { color: "#475569" },
});
