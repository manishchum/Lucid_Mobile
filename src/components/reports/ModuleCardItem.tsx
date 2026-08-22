import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export interface AssessmentAttempt {
  employee_assessment_id: string;
  user_id: string;
  assessment_id: string;
  score: number;
  max_score: number;
  created_at: string;
  completed_at?: string;
  ai_feedback?: string;
  user_answers?: string;
  assessments?: {
    module_title?: string;
    type?: string;
  };
}

export interface GroupedModule {
  moduleId: string;
  moduleTitle: string;
  attempts: any[];
  latestAttemptDate?: Date;
}

interface ModuleCardItemProps {
  item: GroupedModule;
  isExpanded: boolean;
  onToggle: () => void;
  onSelectAttempt: (attempt: any) => void;
}

export const ModuleCardItem = React.memo<ModuleCardItemProps>(
  ({ item, isExpanded, onToggle, onSelectAttempt }) => {
    return (
      <View style={styles.moduleCard}>
        {/* Module Title Summary */}
        <TouchableOpacity
          style={styles.moduleHeader}
          onPress={onToggle}
          activeOpacity={0.8}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.moduleTitle} numberOfLines={2}>
              {item.moduleTitle}
            </Text>
            <Text style={styles.moduleSubtitle}>
              {item.attempts.length}{" "}
              {item.attempts.length === 1 ? "attempt" : "attempts"}
            </Text>
          </View>
          <MaterialCommunityIcons
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={24}
            color="#64748B"
          />
        </TouchableOpacity>

        {/* Collapsible Timeline of Attempts */}
        {isExpanded && (
          <View style={styles.moduleDetails}>
            {item.attempts.map((attempt, index) => {
              const percentage = Math.round(
                (attempt.score / (attempt.max_score || 1)) * 100,
              );
              const isBaseline = attempt.assessments?.type === "baseline";
              const attemptName = isBaseline
                ? `Baseline: ${attempt.assessments?.module_title || "Evaluation"}`
                : `${attempt.assessments?.module_title || "Module Quiz"}`;

              const pillBg =
                percentage >= 80
                  ? "#ECFDF5"
                  : percentage >= 60
                    ? "#EFF6FF"
                    : "#F1F5F9";
              const pillText =
                percentage >= 80
                  ? "#10B981"
                  : percentage >= 60
                    ? "#3B82F6"
                    : "#64748B";

              return (
                <TouchableOpacity
                  key={attempt.employee_assessment_id}
                  style={[
                    styles.attemptRow,
                    index === item.attempts.length - 1 && {
                      borderBottomWidth: 0,
                    },
                  ]}
                  activeOpacity={0.7}
                  onPress={() => onSelectAttempt(attempt)}
                >
                  <View style={styles.attemptDetails}>
                    <Text style={styles.attemptTitle}>{attemptName}</Text>
                    <Text style={styles.attemptDate}>
                      {new Date(
                        attempt.completed_at || attempt.created_at,
                      ).toLocaleDateString("en-IN", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </Text>
                  </View>
                  <View style={styles.attemptRight}>
                    <View style={[styles.attemptPill, { backgroundColor: pillBg }]}>
                      <Text style={[styles.attemptPillText, { color: pillText }]}>
                        {percentage}%
                      </Text>
                    </View>
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={18}
                      color="#94A3B8"
                    />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  moduleCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#64748B",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  moduleHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  moduleTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 4,
  },
  moduleSubtitle: {
    fontSize: 12,
    color: "#94A3B8",
    fontWeight: "600",
  },
  moduleDetails: {
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    backgroundColor: "#FAFAFA",
    paddingHorizontal: 16,
  },
  attemptRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  attemptDetails: {
    flex: 1,
  },
  attemptTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 2,
  },
  attemptDate: {
    fontSize: 12,
    color: "#94A3B8",
  },
  attemptRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  attemptPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  attemptPillText: {
    fontSize: 12,
    fontWeight: "700",
  },
});
