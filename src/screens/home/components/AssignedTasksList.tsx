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
}

const isOverdue = (dueDate: string | null): boolean => {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date(new Date().toDateString());
};

export default function AssignedTasksList({
  tasks,
  isLoading,
  error,
  onRetry,
  userId,
  onTaskSubmitted,
}: AssignedTasksListProps) {
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
        <Text style={styles.errorSubtitle}>{error.message}</Text>
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

  // ── Empty ───────────────────────────────────────────────────────────
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  if (safeTasks.length === 0) {
    return (
      <View style={styles.centerState}>
        <MaterialCommunityIcons
          name="clipboard-check-outline"
          size={44}
          color="#CBD5E1"
        />
        <Text style={styles.emptyTitle}>All caught up!</Text>
        <Text style={styles.emptySubtitle}>No tasks assigned right now.</Text>
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

      <Text style={styles.hintText}>Tap a task to expand &amp; submit</Text>

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
