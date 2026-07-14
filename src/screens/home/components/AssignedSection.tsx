import { useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
  Pressable,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useGetTasks } from "../../../api/users";
import AssignedSprintsList, {
  PlanCard,
  getSprintProgress,
} from "./AssignedSprintsList";
import AssignedTasksList from "./AssignedTasksList";
import { useFeatureGating, FEATURES } from "../../../hooks/useFeatureGating";

type TabId = "sprints" | "tasks";
type SprintSortOption = "title" | "dueDate" | "progress";

const SPRINT_SORT_OPTIONS: {
  id: SprintSortOption;
  label: string;
  icon: string;
}[] = [
  { id: "title", label: "Sort by Title", icon: "sort-alphabetical-ascending" },
  { id: "dueDate", label: "Sort by Due Date", icon: "calendar-clock-outline" },
  { id: "progress", label: "Sort by Progress", icon: "progress-check" },
];

interface AssignedSectionProps {
  planCards: PlanCard[];
  navigation: any;
  userId: string | null;
  companyId: string | null;
  userName?: string | null;
}

export default function AssignedSection({
  planCards,
  navigation,
  userId,
  companyId,
  userName,
}: AssignedSectionProps) {
  const [activeTab, setActiveTab] = useState<TabId>("sprints");

  // ── Search & sort state ───────────────────────────────────────────────
  const [sprintQuery, setSprintQuery] = useState("");
  const [taskQuery, setTaskQuery] = useState("");
  const [sprintSort, setSprintSort] = useState<SprintSortOption>("title");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

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

  // ── Filtered + sorted sprints ─────────────────────────────────────────
  const filteredSprints = useMemo(() => {
    const q = sprintQuery.trim().toLowerCase();
    const filtered = q
      ? planCards.filter((plan) => plan.title.toLowerCase().includes(q))
      : planCards;

    const sorted = [...filtered].sort((a, b) => {
      switch (sprintSort) {
        case "dueDate": {
          const aDue = (a as any).dueDate
            ? new Date((a as any).dueDate).getTime()
            : Infinity;
          const bDue = (b as any).dueDate
            ? new Date((b as any).dueDate).getTime()
            : Infinity;
          return aDue - bDue;
        }
        case "progress":
          return getSprintProgress(b) - getSprintProgress(a);
        case "title":
        default:
          return a.title.localeCompare(b.title);
      }
    });

    return sorted;
  }, [planCards, sprintQuery, sprintSort]);

  // ── Filtered tasks (search only) ──────────────────────────────────────
  const filteredTasks = useMemo(() => {
    const q = taskQuery.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter(
      (task) =>
        task.title?.toLowerCase().includes(q) ||
        task.description?.toLowerCase().includes(q),
    );
  }, [tasks, taskQuery]);

  const activeSortOption = SPRINT_SORT_OPTIONS.find(
    (opt) => opt.id === sprintSort,
  )!;

  return (
    <View style={styles.container}>
      {/* ── Section heading ───────────────────────────────────────── */}
      <View style={styles.headingRow}>
        <Text style={styles.heading}>My Work</Text>
        {/* <View style={styles.totalBadge}>
          <Text style={styles.totalBadgeText}>
            {effectiveTab === "sprints" ? sprintCount : taskCount}
          </Text>
        </View> */}
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

      {/* ── Search + Sort toolbar ─────────────────────────────────── */}
      <View style={styles.toolbarRow}>
        <View style={styles.searchBox}>
          <MaterialCommunityIcons name="magnify" size={18} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder={
              effectiveTab === "sprints" ? "Search sprints…" : "Search tasks…"
            }
            placeholderTextColor="#94A3B8"
            value={effectiveTab === "sprints" ? sprintQuery : taskQuery}
            onChangeText={
              effectiveTab === "sprints" ? setSprintQuery : setTaskQuery
            }
            returnKeyType="search"
          />
          {(effectiveTab === "sprints" ? sprintQuery : taskQuery).length >
            0 && (
            <TouchableOpacity
              onPress={() =>
                effectiveTab === "sprints"
                  ? setSprintQuery("")
                  : setTaskQuery("")
              }
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialCommunityIcons
                name="close-circle"
                size={16}
                color="#CBD5E1"
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Sort dropdown — Sprints tab only */}
        {effectiveTab === "sprints" && (
          <>
            <TouchableOpacity
              style={styles.sortButton}
              onPress={() => setSortMenuOpen(true)}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name={activeSortOption.icon as any}
                size={16}
                color="#2563EB"
              />
              <MaterialCommunityIcons
                name="chevron-down"
                size={16}
                color="#2563EB"
              />
            </TouchableOpacity>

            <Modal
              visible={sortMenuOpen}
              transparent
              animationType="fade"
              onRequestClose={() => setSortMenuOpen(false)}
            >
              <Pressable
                style={styles.modalOverlay}
                onPress={() => setSortMenuOpen(false)}
              >
                <View style={styles.sortMenu}>
                  <Text style={styles.sortMenuTitle}>Sort Sprints By</Text>
                  {SPRINT_SORT_OPTIONS.map((opt) => {
                    const isSelected = opt.id === sprintSort;
                    return (
                      <TouchableOpacity
                        key={opt.id}
                        style={[
                          styles.sortMenuItem,
                          isSelected && styles.sortMenuItemActive,
                        ]}
                        onPress={() => {
                          setSprintSort(opt.id);
                          setSortMenuOpen(false);
                        }}
                        activeOpacity={0.75}
                      >
                        <MaterialCommunityIcons
                          name={opt.icon as any}
                          size={17}
                          color={isSelected ? "#2563EB" : "#64748B"}
                        />
                        <Text
                          style={[
                            styles.sortMenuItemText,
                            isSelected && styles.sortMenuItemTextActive,
                          ]}
                        >
                          {opt.label}
                        </Text>
                        {isSelected && (
                          <MaterialCommunityIcons
                            name="check"
                            size={17}
                            color="#2563EB"
                            style={{ marginLeft: "auto" }}
                          />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </Pressable>
            </Modal>
          </>
        )}
      </View>

      {/* ── Content ───────────────────────────────────────────────── */}
      {effectiveTab === "sprints" ? (
        <AssignedSprintsList
          planCards={filteredSprints}
          navigation={navigation}
          userName={userName}
          emptyMessage={
            sprintQuery
              ? "No sprints match your search"
              : "No sprints assigned yet"
          }
        />
      ) : (
        <AssignedTasksList
          tasks={filteredTasks}
          isLoading={isLoading}
          error={error}
          onRetry={refetch}
          userId={userId}
          isFiltered={taskQuery.trim().length > 0}
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

  // ── Toolbar: search + sort ──────────────────────────────────────
  toolbarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#1E293B",
    fontWeight: "500",
    padding: 0,
  },
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },

  // ── Sort dropdown menu ───────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.25)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingTop: 210,
    paddingRight: 20,
  },
  sortMenu: {
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 6,
    minWidth: 210,
    shadowColor: "#0F172A",
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  sortMenuTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  sortMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 10,
  },
  sortMenuItemActive: { backgroundColor: "#EFF6FF" },
  sortMenuItemText: { fontSize: 14, fontWeight: "600", color: "#475569" },
  sortMenuItemTextActive: { color: "#2563EB", fontWeight: "700" },
});
