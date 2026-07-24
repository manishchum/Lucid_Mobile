import { useMemo, useState } from "react";
import { friendlyError } from "../../../utils/friendlyError";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Task } from "../../../api/users";
import TaskAccordionItem from "./TaskAccordionItem";

interface AssignedTasksListProps {
  tasks: Task[];
  isLoading: boolean;
  error: Error | null;
  onRetry?: () => void;
  userId?: string | null;
  onTaskSubmitted?: (task: Task) => void;
  isFiltered?: boolean;
}

const isOverdue = (dueDate: string | null): boolean => {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date(new Date().toDateString());
};

const isTaskCompleted = (task: Task): boolean =>
  task.submitted === true || task.status === "completed";

type StatusFilter = "active" | "completed" | "all";

const STATUS_TABS: { id: StatusFilter; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "completed", label: "Completed" },
  { id: "all", label: "All" },
];

export default function AssignedTasksList({
  tasks,
  isLoading,
  error,
  onRetry,
  userId,
  onTaskSubmitted,
  isFiltered,
}: AssignedTasksListProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");

  const statusFilteredTasks = useMemo(() => {
    const safe = Array.isArray(tasks) ? tasks : [];
    if (statusFilter === "all") return safe;
    return safe.filter((t) =>
      statusFilter === "completed" ? isTaskCompleted(t) : !isTaskCompleted(t),
    );
  }, [tasks, statusFilter]);

  // ── Loading ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.centerText}>Loading tasks…</Text>
      </View>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────
  if (error) {
    return (
      <View style={styles.centerState}>
        <MaterialCommunityIcons
          name="alert-circle-outline"
          size={40}
          color="#EF4444"
        />
        <Text style={styles.errorTitle}>Couldn't load tasks</Text>
        <Text style={styles.errorSubtitle}>{friendlyError(error)}</Text>
        {onRetry && (
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={onRetry}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="refresh" size={14} color="#2563EB" />
            <Text style={styles.retryBtnText}>Try again</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // ── Status tabs (Active / Completed / All) ───────────────────────────
  const allTasks = Array.isArray(tasks) ? tasks : [];
  const statusTabBar = allTasks.length > 0 && (
    <View style={styles.statusTabBar}>
      {STATUS_TABS.map((tab) => {
        const count =
          tab.id === "all"
            ? allTasks.length
            : allTasks.filter((t) =>
                tab.id === "completed"
                  ? isTaskCompleted(t)
                  : !isTaskCompleted(t),
              ).length;
        const isActive = statusFilter === tab.id;
        return (
          <TouchableOpacity
            key={tab.id}
            style={[styles.statusTab, isActive && styles.statusTabActive]}
            onPress={() => setStatusFilter(tab.id)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.statusTabText,
                isActive && styles.statusTabTextActive,
              ]}
            >
              {tab.label} ({count})
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // ── Empty ───────────────────────────────────────────────────────────
  const safeTasks = statusFilteredTasks;
  if (safeTasks.length === 0) {
    return (
      <View>
        {statusTabBar}
        <View style={styles.centerState}>
          <MaterialCommunityIcons
            name={isFiltered ? "magnify-close" : "clipboard-check-outline"}
            size={44}
            color="#CBD5E1"
          />
          <Text style={styles.emptyTitle}>
            {isFiltered
              ? "No matching tasks"
              : statusFilter === "completed"
                ? "Nothing completed yet"
                : "All caught up!"}
          </Text>
          <Text style={styles.emptySubtitle}>
            {isFiltered
              ? "Try a different search term."
              : statusFilter === "completed"
                ? "Completed tasks will show up here."
                : "No tasks assigned right now."}
          </Text>
        </View>
      </View>
    );
  }

  // ── Summary chips ───────────────────────────────────────────────────
  const overdueCount = safeTasks.filter((t) =>
    isOverdue(t.due_date ?? null),
  ).length;
  const activeCount = safeTasks.length - overdueCount;

  return (
    <View>
      {statusTabBar}

      <View style={styles.summaryRow}>
        <View style={styles.summaryChip}>
          <View style={[styles.dot, { backgroundColor: "#2563EB" }]} />
          <Text style={styles.summaryText}>{activeCount} Active</Text>
        </View>
        {overdueCount > 0 && (
          <View style={styles.summaryChip}>
            <View style={[styles.dot, { backgroundColor: "#EF4444" }]} />
            <Text style={[styles.summaryText, { color: "#EF4444" }]}>
              {overdueCount} Overdue
            </Text>
          </View>
        )}
        <Text style={styles.totalText}>{safeTasks.length} total</Text>
      </View>

      {safeTasks.map((task) => (
        <TaskAccordionItem
          key={task.task_id}
          task={task}
          userId={userId}
          onSubmit={(t, payload) => {
            console.log("Submit task:", t.task_id, payload);
          }}
          onSubmitted={onTaskSubmitted}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  centerState: {
    alignItems: "center",
    paddingVertical: 48,
    gap: 8,
  },
  centerText: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 8,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
    marginTop: 4,
  },
  errorSubtitle: {
    fontSize: 13,
    color: "#94A3B8",
    textAlign: "center",
    paddingHorizontal: 20,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 8,
    backgroundColor: "#EFF6FF",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  retryBtnText: { fontSize: 13, fontWeight: "700", color: "#2563EB" },

  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
    marginTop: 4,
  },
  emptySubtitle: { fontSize: 13, color: "#94A3B8", fontWeight: "500" },

  statusTabBar: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  statusTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
  },
  statusTabActive: { backgroundColor: "#2563EB" },
  statusTabText: { fontSize: 12, fontWeight: "700", color: "#64748B" },
  statusTabTextActive: { color: "#fff" },

  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  summaryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  summaryText: { fontSize: 12, fontWeight: "700", color: "#475569" },
  totalText: {
    marginLeft: "auto",
    fontSize: 12,
    color: "#94A3B8",
    fontWeight: "600",
  },

  hintText: {
    fontSize: 11,
    color: "#CBD5E1",
    fontWeight: "500",
    marginBottom: 12,
    marginTop: 2,
  },
});
