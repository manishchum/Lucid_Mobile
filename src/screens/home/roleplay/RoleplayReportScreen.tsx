import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { RoleplayAssessment, RoleplaySession } from "../../../api/roleplay";

export default function RoleplayReportScreen({
  route,
  navigation,
}: {
  route: any;
  navigation: any;
}) {
  const session: RoleplaySession = route.params?.session;
  const assessment: RoleplayAssessment =
    route.params?.assessment || session?.roleplay_assessments?.[0];

  const [showTranscript, setShowTranscript] = useState(false);

  const overallScore = assessment?.overall_score ?? 0;
  const isPassed = overallScore >= 60;
  const summary = assessment?.summary || "No summary feedback available.";
  const recommendations = assessment?.recommendations || [];

  // Parse parameters if object or array
  const rawParams = assessment?.parameters || {};
  const paramsList: Array<{ name: string; score: number; feedback: string }> = [];

  if (Array.isArray(rawParams)) {
    rawParams.forEach((p) => {
      paramsList.push({
        name: p.name || "Parameter",
        score: p.score ?? 0,
        feedback: p.feedback || "",
      });
    });
  } else if (typeof rawParams === "object") {
    Object.keys(rawParams).forEach((key) => {
      const item = rawParams[key];
      paramsList.push({
        name: item.name || key,
        score: item.score ?? 0,
        feedback: item.feedback || "",
      });
    });
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return "#10B981"; // Emerald green
    if (score >= 60) return "#6366F1"; // Indigo
    return "#EF4444"; // Red
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      {/* Header Bar */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Roleplay Assessment
        </Text>
        <TouchableOpacity
          onPress={() => setShowTranscript(true)}
          style={styles.transcriptButton}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="chat-processing-outline" size={22} color="#6366F1" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Score Overview Card */}
        <View style={styles.scoreCard}>
          <View style={styles.scoreGaugeContainer}>
            <View style={[styles.scoreOuterRing, { borderColor: getScoreColor(overallScore) }]}>
              <Text style={styles.scoreNumber}>{overallScore}</Text>
              <Text style={styles.scorePercent}>/ 100</Text>
            </View>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: isPassed ? "#ECFDF5" : "#FEF2F2" }]}>
            <MaterialCommunityIcons
              name={isPassed ? "check-circle" : "alert-circle"}
              size={18}
              color={isPassed ? "#059669" : "#DC2626"}
            />
            <Text style={[styles.statusText, { color: isPassed ? "#059669" : "#DC2626" }]}>
              {isPassed ? "Passed Scenario" : "Needs Practice"}
            </Text>
          </View>

          {session?.scenario_title && (
            <Text style={styles.scenarioTitleText}>{session.scenario_title}</Text>
          )}

          <Text style={styles.summaryText}>{summary}</Text>
        </View>

        {/* Evaluation Parameters Breakdown */}
        {paramsList.length > 0 && (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Evaluation Parameters</Text>
            {paramsList.map((param, index) => {
              const pScore = param.score || 0;
              const barColor = getScoreColor(pScore);
              return (
                <View key={index} style={styles.paramCard}>
                  <View style={styles.paramHeader}>
                    <Text style={styles.paramName}>{param.name}</Text>
                    <Text style={[styles.paramScoreText, { color: barColor }]}>{pScore}%</Text>
                  </View>

                  {/* Progress Track */}
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressBar, { width: `${Math.min(pScore, 100)}%`, backgroundColor: barColor }]} />
                  </View>

                  {param.feedback ? (
                    <Text style={styles.paramFeedback}>{param.feedback}</Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}

        {/* Actionable Recommendations */}
        {recommendations.length > 0 && (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Actionable Recommendations</Text>
            <View style={styles.recContainer}>
              {recommendations.map((rec, i) => (
                <View key={i} style={styles.recRow}>
                  <MaterialCommunityIcons name="lightbulb-on-outline" size={20} color="#F59E0B" />
                  <Text style={styles.recText}>{rec}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Transcript Modal */}
      <Modal visible={showTranscript} animationType="slide" onRequestClose={() => setShowTranscript(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Conversation Transcript</Text>
            <TouchableOpacity onPress={() => setShowTranscript(false)} style={{ padding: 4 }}>
              <MaterialCommunityIcons name="close" size={24} color="#0F172A" />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1, padding: 16 }}>
            {session?.conversation_transcript && session.conversation_transcript.length > 0 ? (
              session.conversation_transcript.map((msg, index) => {
                const isUser = msg.role === "user" || msg.role === "Learner";
                return (
                  <View
                    key={index}
                    style={[
                      styles.transcriptBubble,
                      isUser ? styles.userBubble : styles.botBubble,
                    ]}
                  >
                    <Text style={styles.roleLabel}>{isUser ? "You" : session.scenario_role || "AI Evaluator"}</Text>
                    <Text style={styles.transcriptText}>{msg.text}</Text>
                  </View>
                );
              })
            ) : (
              <Text style={{ color: "#94A3B8", textAlign: "center", marginTop: 40 }}>
                No transcript text recorded for this session.
              </Text>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
    flex: 1,
    textAlign: "center",
    marginHorizontal: 12,
  },
  transcriptButton: {
    padding: 4,
  },
  scrollContent: {
    padding: 16,
  },
  scoreCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  scoreGaugeContainer: {
    marginBottom: 12,
  },
  scoreOuterRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  scoreNumber: {
    fontSize: 32,
    fontWeight: "800",
    color: "#0F172A",
  },
  scorePercent: {
    fontSize: 11,
    color: "#64748B",
    marginTop: -4,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 12,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 6,
  },
  scenarioTitleText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 8,
    textAlign: "center",
  },
  summaryText: {
    fontSize: 14,
    color: "#475569",
    textAlign: "center",
    lineHeight: 20,
  },
  sectionContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 12,
  },
  paramCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  paramHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  paramName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
  },
  paramScoreText: {
    fontSize: 14,
    fontWeight: "800",
  },
  progressTrack: {
    height: 8,
    backgroundColor: "#F1F5F9",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressBar: {
    height: "100%",
    borderRadius: 4,
  },
  paramFeedback: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 18,
  },
  recContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  recRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  recText: {
    fontSize: 14,
    color: "#334155",
    marginLeft: 10,
    flex: 1,
    lineHeight: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
  },
  transcriptBubble: {
    padding: 12,
    borderRadius: 14,
    marginBottom: 10,
    maxWidth: "85%",
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#6366F1",
  },
  botBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#F1F5F9",
  },
  roleLabel: {
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 4,
    color: "#64748B",
  },
  transcriptText: {
    fontSize: 14,
    color: "#0F172A",
    lineHeight: 20,
  },
});
