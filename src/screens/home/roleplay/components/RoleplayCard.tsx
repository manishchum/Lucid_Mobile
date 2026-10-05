import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Scenario } from "../../../../api/roleplay";

interface RoleplayCardProps {
  scenario: Scenario;
  remainingAttempts?: number;
  onPressStart: (scenario: Scenario) => void;
}

export default function RoleplayCard({
  scenario,
  remainingAttempts,
  onPressStart,
}: RoleplayCardProps) {
  const getDifficultyColor = (diff?: string) => {
    const lower = (diff || "").toLowerCase();
    if (lower === "easy") return { bg: "#ECFDF5", text: "#059669", border: "#A7F3D0" };
    if (lower === "hard") return { bg: "#FEF2F2", text: "#DC2626", border: "#FECACA" };
    return { bg: "#EFF6FF", text: "#2563EB", border: "#BFDBFE" }; // Medium
  };

  const diffStyle = getDifficultyColor(scenario.difficulty);
  const isOutOfAttempts = remainingAttempts !== undefined && remainingAttempts <= 0;

  return (
    <View style={styles.cardContainer}>
      {/* Header Badges */}
      {/* <View style={styles.headerRow}>
        <View style={styles.roleTag}>
          <MaterialCommunityIcons name="account-tie" size={14} color="#6366F1" />
          <Text style={styles.roleTagText} numberOfLines={1}>
            {scenario.role || "Roleplay"}
          </Text>
        </View>

        <View style={[styles.diffBadge, { backgroundColor: diffStyle.bg, borderColor: diffStyle.border }]}>
          <Text style={[styles.diffBadgeText, { color: diffStyle.text }]}>
            {scenario.difficulty || "Medium"}
          </Text>
        </View>
      </View> */}

      {/* Scenario Title */}
      <Text style={styles.titleText}>{scenario.title}</Text>

      {/* Learner Brief Preview */}
      {/* <Text style={styles.briefText} numberOfLines={2}>
        {scenario.learnerBrief || scenario.description || "Interactive sales & communication scenario."}
      </Text> */}

      {/* Meta Specs (Duration, Cutoff Score, Attempts) */}
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <MaterialCommunityIcons name="clock-outline" size={14} color="#64748B" />
          <Text style={styles.metaText}>{scenario.maxDuration || 15} mins   |</Text>
        </View>

        {/* <View style={styles.metaItem}>
          <MaterialCommunityIcons name="target" size={14} color="#64748B" />
          <Text style={styles.metaText}>Cutoff: {scenario.cutoffScore || scenario.passingScore || 60}%</Text>
        </View> */}

          <Text style={[styles.diffBadgeText, { color: diffStyle.text }]}>
            {scenario.difficulty}
          </Text>

        {remainingAttempts !== undefined && (
          <View style={styles.metaItem}>
            <MaterialCommunityIcons name="cached" size={14} color={isOutOfAttempts ? "#EF4444" : "#10B981"} />
            <Text style={[styles.metaText, isOutOfAttempts && { color: "#EF4444", fontWeight: "700" }]}>
              {remainingAttempts} retries left
            </Text>
          </View>
        )}
      </View>

      {/* Action Button */}
      <TouchableOpacity
        style={[styles.startButton, isOutOfAttempts && styles.disabledButton]}
        activeOpacity={0.8}
        disabled={isOutOfAttempts}
        onPress={() => onPressStart(scenario)}
      >
        <Text style={styles.startButtonText}>
          {isOutOfAttempts ? "No Attempts Remaining" : "Start Roleplay Practice"}
        </Text>
        {!isOutOfAttempts && (
          <MaterialCommunityIcons name="arrow-right" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  roleTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    maxWidth: "70%",
  },
  roleTagText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4F46E5",
    marginLeft: 4,
  },
  diffBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  diffBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  titleText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 6,
  },
  briefText: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 18,
    marginBottom: 14,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    marginBottom: 14,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  metaText: {
    fontSize: 12,
    color: "#64748B",
    marginLeft: 4,
    fontWeight: "500",
  },
  startButton: {
    backgroundColor: "#6366F1",
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  disabledButton: {
    backgroundColor: "#CBD5E1",
  },
  startButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
