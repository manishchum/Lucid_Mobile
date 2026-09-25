import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  StatusBar,
  BackHandler,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import { RoleplayAssessment, RoleplaySession } from "../../../api/roleplay";
import { STACK_ROUTES } from "../../../navigations/Routes";

// ── Clean SVG Circular Score Progress Ring ──────────────────────────────────────
const ScoreRing = ({
  score,
  size = 114,
  strokeWidth = 9,
}: {
  score: number;
  size?: number;
  strokeWidth?: number;
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const validScore = Math.min(Math.max(score || 0, 0), 100);
  const strokeDashoffset = circumference - (circumference * validScore) / 100;

  const ringColor =
    validScore >= 80 ? "#10B981" : validScore >= 60 ? "#4F46E5" : "#EF4444";

  return (
    <View style={{ width: size, height: size, justifyContent: "center", alignItems: "center" }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
        {/* Background Track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#F1F5F9"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Animated Progress Arc */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={ringColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
      <View style={styles.scoreTextWrapper}>
        <Text style={styles.scoreMainText}>{validScore}</Text>
        <Text style={styles.scoreSubText}>OUT OF 100</Text>
      </View>
    </View>
  );
};

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

  // Parse evaluation parameters
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
    if (score >= 80) return "#10B981";
    if (score >= 60) return "#4F46E5";
    return "#EF4444";
  };

  const handleBackToRoleplay = useCallback(() => {
    const routes = navigation.getState?.()?.routes || [];
    const hasRoleplay = routes.some((r: any) => r.name === STACK_ROUTES.ROLEPLAY);

    if (hasRoleplay && typeof (navigation as any).popTo === "function") {
      (navigation as any).popTo(STACK_ROUTES.ROLEPLAY);
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate(STACK_ROUTES.ROLEPLAY as never);
    }
  }, [navigation]);

  // Intercept hardware back button so it doesn't reveal the session or config screen
  useEffect(() => {
    const onBackPress = () => {
      handleBackToRoleplay();
      return true;
    };

    const backSub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => backSub.remove();
  }, [handleBackToRoleplay]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* ── Minimalist Top Navigation Header ───────────────────────────────── */}
      <View style={styles.navBar}>
        <TouchableOpacity
          onPress={handleBackToRoleplay}
          style={styles.navBackBtn}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="arrow-left" size={22} color="#1E1B4B" />
        </TouchableOpacity>

        <Text style={styles.navTitle}>Session Complete</Text>

        <TouchableOpacity
          onPress={() => setShowTranscript(true)}
          style={styles.transcriptPillBtn}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="chat-processing-outline" size={17} color="#4F46E5" />
          <Text style={styles.transcriptPillText}>Transcript</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero Status & Scenario Card ────────────────────────────────────── */}
        <View style={styles.heroCard}>
          <View style={styles.heroCheckBadge}>
            <MaterialCommunityIcons name="check" size={24} color="#4F46E5" />
          </View>
          <Text style={styles.heroTitle}>Performance Assessment</Text>
          {session?.scenario_title ? (
            <View style={styles.scenarioPill}>
              <MaterialCommunityIcons name="bullseye-arrow" size={14} color="#6366F1" />
              <Text style={styles.scenarioPillText} numberOfLines={2}>
                {session.scenario_title}
              </Text>
            </View>
          ) : null}
        </View>

        {/* ── Score & Executive Summary Card ─────────────────────────────────── */}
        <View style={styles.cardContainer}>
          <View style={styles.scoreSection}>
            <ScoreRing score={overallScore} />

            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: isPassed ? "#ECFDF5" : "#FEF2F2",
                  borderColor: isPassed ? "#A7F3D0" : "#FECACA",
                },
              ]}
            >
              <MaterialCommunityIcons
                name={isPassed ? "check-circle" : "alert-circle"}
                size={16}
                color={isPassed ? "#059669" : "#DC2626"}
              />
              <Text
                style={[
                  styles.statusText,
                  { color: isPassed ? "#059669" : "#DC2626" },
                ]}
              >
                {isPassed ? "Scenario Passed" : "Needs More Practice"}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.summaryBox}>
            <View style={styles.cardSubHeaderRow}>
              <MaterialCommunityIcons name="text-box-outline" size={16} color="#4F46E5" />
              <Text style={styles.cardSubHeaderTitle}>Executive Feedback</Text>
            </View>
            <Text style={styles.summaryText}>{summary}</Text>
          </View>
        </View>

        {/* ── Performance Breakdown ─────────────────────────────────────────── */}
        {paramsList.length > 0 && (
          <View style={styles.cardContainer}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.headerIconContainer}>
                <MaterialCommunityIcons name="chart-bar" size={17} color="#4F46E5" />
              </View>
              <Text style={styles.cardHeaderTitle}>Performance Breakdown</Text>
            </View>

            <View style={styles.paramsList}>
              {paramsList.map((param, index) => {
                const pScore = param.score || 0;
                const barColor = getScoreColor(pScore);
                const isLast = index === paramsList.length - 1;

                return (
                  <View
                    key={index}
                    style={[styles.paramItem, !isLast && styles.paramItemBorder]}
                  >
                    <View style={styles.paramTopRow}>
                      <Text style={styles.paramName}>{param.name}</Text>
                      <View style={[styles.paramBadge, { backgroundColor: `${barColor}15` }]}>
                        <Text style={[styles.paramScoreText, { color: barColor }]}>
                          {pScore}%
                        </Text>
                      </View>
                    </View>

                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressBar,
                          {
                            width: `${Math.min(pScore, 100)}%`,
                            backgroundColor: barColor,
                          },
                        ]}
                      />
                    </View>

                    {param.feedback ? (
                      <Text style={styles.paramFeedbackText}>{param.feedback}</Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Key Recommendations ───────────────────────────────────────────── */}
        {recommendations.length > 0 && (
          <View style={styles.cardContainer}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.headerIconContainer, { backgroundColor: "#FEF3C7" }]}>
                <MaterialCommunityIcons name="lightbulb-on-outline" size={17} color="#D97706" />
              </View>
              <Text style={styles.cardHeaderTitle}>Actionable Improvements</Text>
            </View>

            <View style={styles.recList}>
              {recommendations.map((rec, i) => (
                <View key={i} style={styles.recItem}>
                  <View style={styles.recBullet}>
                    <MaterialCommunityIcons name="arrow-right" size={13} color="#4F46E5" />
                  </View>
                  <Text style={styles.recText}>{rec}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Actions ───────────────────────────────────────────────────────── */}
        <View style={styles.actionGroup}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleBackToRoleplay}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="format-list-bulleted" size={20} color="#FFFFFF" />
            <Text style={styles.primaryBtnText}>Back to Roleplay List</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── Conversation Transcript Modal ─────────────────────────────────── */}
      <Modal
        visible={showTranscript}
        animationType="slide"
        onRequestClose={() => setShowTranscript(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <MaterialCommunityIcons name="chat-outline" size={20} color="#4F46E5" />
              <Text style={styles.modalTitle}>Conversation Transcript</Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowTranscript(false)}
              style={styles.modalCloseBtn}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="close" size={20} color="#475569" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalContentContainer}
          >
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
                    <Text style={[styles.roleLabel, { color: isUser ? "#C7D2FE" : "#64748B" }]}>
                      {isUser ? "You" : session.scenario_role || "AI Evaluator"}
                    </Text>
                    <Text style={[styles.transcriptText, { color: isUser ? "#FFFFFF" : "#0F172A" }]}>
                      {msg.text}
                    </Text>
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyTranscript}>
                <MaterialCommunityIcons name="chat-alert-outline" size={44} color="#CBD5E1" />
                <Text style={styles.emptyTranscriptText}>
                  No recorded transcript available for this session.
                </Text>
              </View>
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

  // ── Top Navigation Bar ─────────────────────────────────────────────────────
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  navBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  navTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1E1B4B",
    letterSpacing: -0.2,
  },
  transcriptPillBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E0E7FF",
  },
  transcriptPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#4F46E5",
  },

  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },

  // ── Hero Card ──────────────────────────────────────────────────────────────
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    // shadowColor: "#1E1B4B",
    // shadowOffset: { width: 0, height: 4 },
    // shadowOpacity: 0.04,
    // shadowRadius: 10,
    // elevation: 2,
  },
  heroCheckBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "#C7D2FE",
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1E1B4B",
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  scenarioPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    maxWidth: "92%",
  },
  scenarioPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
    textAlign: "center",
  },

  // ── Card Container ─────────────────────────────────────────────────────────
  cardContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    // shadowColor: "#1E1B4B",
    // shadowOffset: { width: 0, height: 4 },
    // shadowOpacity: 0.04,
    // shadowRadius: 10,
    // elevation: 2,
  },
  scoreSection: {
    alignItems: "center",
    paddingVertical: 6,
  },
  scoreTextWrapper: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  scoreMainText: {
    fontSize: 34,
    fontWeight: "800",
    color: "#1E1B4B",
    letterSpacing: -0.5,
  },
  scoreSubText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 0.5,
    marginTop: -2,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 16,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "700",
  },

  divider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 18,
  },

  summaryBox: {
    gap: 8,
  },
  cardSubHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cardSubHeaderTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E1B4B",
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 22,
    color: "#475569",
  },

  // ── Performance Breakdown ───────────────────────────────────────────────────
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  headerIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  cardHeaderTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E1B4B",
  },
  paramsList: {
    gap: 14,
  },
  paramItem: {
    paddingBottom: 14,
  },
  paramItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  paramTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  paramName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E1B4B",
    flex: 1,
    marginRight: 10,
  },
  paramBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
  },
  paramScoreText: {
    fontSize: 13,
    fontWeight: "800",
  },
  progressTrack: {
    height: 6,
    backgroundColor: "#F1F5F9",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressBar: {
    height: "100%",
    borderRadius: 3,
  },
  paramFeedbackText: {
    fontSize: 12.5,
    lineHeight: 18,
    color: "#64748B",
  },

  // ── Recommendations ─────────────────────────────────────────────────────────
  recList: {
    gap: 12,
  },
  recItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  recBullet: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  recText: {
    fontSize: 13.5,
    lineHeight: 20,
    color: "#334155",
    flex: 1,
  },

  // ── Action Group ────────────────────────────────────────────────────────────
  actionGroup: {
    gap: 10,
    marginTop: 6,
  },
  primaryBtn: {
    backgroundColor: "#4F46E5",
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    // shadowColor: "#4F46E5",
    // shadowOffset: { width: 0, height: 6 },
    // shadowOpacity: 0.28,
    // shadowRadius: 10,
    // elevation: 4,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  secondaryBtn: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748B",
  },

  // ── Transcript Modal ────────────────────────────────────────────────────────
  modalSafeArea: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1E1B4B",
  },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  modalScroll: {
    flex: 1,
  },
  modalContentContainer: {
    padding: 16,
    gap: 12,
  },
  transcriptBubble: {
    padding: 14,
    borderRadius: 16,
    maxWidth: "85%",
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#4F46E5",
    borderBottomRightRadius: 4,
  },
  botBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  roleLabel: {
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  transcriptText: {
    fontSize: 14,
    lineHeight: 20,
  },
  emptyTranscript: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyTranscriptText: {
    fontSize: 14,
    color: "#94A3B8",
    textAlign: "center",
  },
});
