import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Modal,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Scenario } from "../../../api/roleplay";
import { STACK_ROUTES, APP_ROUTES } from "../../../navigations/Routes";
import { useFeatureGating, FEATURES } from "../../../hooks/useFeatureGating";

export interface RoleplayConfig {
  difficulty: string;
  tone: string;
  voiceGender: "female" | "male";
  cameraEnabled: boolean;
  micEnabled: boolean;
}

const DIFFICULTY_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  Easy:   { bg: "#ECFDF5", text: "#059669", border: "#A7F3D0" },
  Medium: { bg: "#FFFBEB", text: "#D97706", border: "#FDE68A" },
  Hard:   { bg: "#FEF2F2", text: "#DC2626", border: "#FECACA" },
};

export default function RoleplayConfigScreen({
  route,
  navigation,
}: {
  route: any;
  navigation: any;
}) {
  const scenario: Scenario = route.params?.scenario;
  const difficulty = scenario?.difficulty || "Medium";
  const diffStyle = DIFFICULTY_STYLE[difficulty] ?? DIFFICULTY_STYLE.Medium;

  const { hasFeature, addonsKnown } = useFeatureGating();
  useEffect(() => {
    if (addonsKnown && !hasFeature(FEATURES.ROLE_PLAY)) {
      navigation.navigate(APP_ROUTES.HOME);
    }
  }, [addonsKnown, hasFeature, navigation]);

  const [isInfoModalVisible, setIsInfoModalVisible] = useState(false);
  const [config, setConfig] = useState<RoleplayConfig>({
    difficulty,
    tone: scenario?.tone || "Neutral",
    voiceGender: "female",
    cameraEnabled: true,
    micEnabled: true,
  });

  const handleStart = () => {
    navigation.replace(STACK_ROUTES.ROLEPLAY_SESSION as never, {
      scenario,
      config,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.gradientHeader}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1E1B4B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Start Your Roleplay Session</Text>
        <TouchableOpacity
          onPress={() => setIsInfoModalVisible(true)}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Roleplay guidelines"
        >
          <MaterialCommunityIcons name="information-outline" size={21} color="#4F46E5" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Scenario Overview Card */}
        <View style={styles.scenarioCard}>
          <Text style={styles.scenarioTitle}>{scenario?.title}</Text>

          {/* Pre-defined Difficulty Badge */}
          <View style={styles.diffRow}>
            <View style={[styles.diffBadge, { backgroundColor: diffStyle.bg, borderColor: diffStyle.border }]}>
              <MaterialCommunityIcons name="chart-bar" size={13} color={diffStyle.text} />
              <Text style={[styles.diffBadgeText, { color: diffStyle.text }]}>{difficulty}</Text>
            </View>
          </View>

          {/* Role Badges */}
          <View style={styles.rolesContainer}>
            {/* You Role Badge */}
            <View style={styles.roleBadge}>
              <MaterialCommunityIcons
                name="account-outline"
                size={16}
                color="#475569"
                style={styles.roleBadgeIcon}
              />
              <Text style={styles.roleBadgeText}>
                <Text style={styles.roleBadgePrefix}>You: </Text>
                {scenario?.userRole || "Learner"}
              </Text>
            </View>

            {/* AI Role Badge */}
            <View style={styles.roleBadge}>
              <MaterialCommunityIcons
                name="robot-outline"
                size={16}
                color="#475569"
                style={styles.roleBadgeIcon}
              />
              <Text style={styles.roleBadgeText}>
                <Text style={styles.roleBadgePrefix}>AI: </Text>
                {scenario?.role || "Evaluator"}
              </Text>
            </View>
          </View>
        </View>

        {/* AI Voice */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="microphone-outline" size={18} color="#6366F1" />
            <Text style={styles.sectionTitle}>AI Voice</Text>
          </View>
          <View style={styles.voiceRow}>
            {(["female", "male"] as const).map((g) => {
              const isActive = config.voiceGender === g;
              return (
                <TouchableOpacity
                  key={g}
                  style={[styles.voiceBtn, isActive && styles.voiceBtnActive]}
                  onPress={() => setConfig((prev) => ({ ...prev, voiceGender: g }))}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons
                    name={g === "female" ? "gender-female" : "gender-male"}
                    size={20}
                    color={isActive ? "#FFFFFF" : "#6366F1"}
                  />
                  <Text style={[styles.voiceBtnText, { color: isActive ? "#FFFFFF" : "#4F46E5" }]}>
                    {g === "female" ? "Female" : "Male"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Instructions For You */}
        {(scenario?.learnerBrief || scenario?.description) ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="book-open-outline" size={18} color="#6366F1" />
              <Text style={styles.sectionTitle}>Instructions for You</Text>
            </View>
            <View style={styles.instructionsCard}>
              <Text style={styles.instructionsText}>
                {scenario?.learnerBrief || scenario?.description}
              </Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Start Button */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.startBtn} onPress={handleStart} activeOpacity={0.85}>
          <MaterialCommunityIcons name="play-circle" size={22} color="#FFFFFF" />
          <Text style={styles.startBtnText}>Start Role-Play</Text>
        </TouchableOpacity>
      </View>

      {/* ── Best Experience Info Modal (Bottom Sheet Style) ── */}
      <Modal
        visible={isInfoModalVisible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setIsInfoModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setIsInfoModalVisible(false)}
        >
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            {/* Sheet Handle */}
            <View style={styles.sheetHandle} />

            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <View style={styles.modalIconBadge}>
                  <MaterialCommunityIcons name="lightbulb-on-outline" size={20} color="#4F46E5" />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Roleplay Guidelines</Text>
                  <Text style={styles.modalSubtitle}>For the best session experience</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setIsInfoModalVisible(false)}
                style={styles.modalCloseBtn}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialCommunityIcons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Guidelines List */}
            <View style={styles.tipsList}>
              {/* Tip 1: High-Speed Internet */}
              <View style={styles.tipItem}>
                <View style={styles.tipIconCircle}>
                  <MaterialCommunityIcons name="wifi-check" size={20} color="#4F46E5" />
                </View>
                <View style={styles.tipContent}>
                  <Text style={styles.tipHeading}>High-Speed Internet Zone</Text>
                  <Text style={styles.tipBody}>
                    Stay in a strong Wi-Fi or 4G/5G zone to enable instant real-time speech without lag or interruptions.
                  </Text>
                </View>
              </View>

              {/* Tip 2: Quiet & Closed Environment */}
              <View style={styles.tipItem}>
                <View style={styles.tipIconCircle}>
                  <MaterialCommunityIcons name="volume-off" size={20} color="#4F46E5" />
                </View>
                <View style={styles.tipContent}>
                  <Text style={styles.tipHeading}>Quiet & Closed Environment</Text>
                  <Text style={styles.tipBody}>
                    Practice in a quiet, enclosed room so background chatter does not disrupt speech transcription or evaluation.
                  </Text>
                </View>
              </View>

              {/* Tip 3: Clear Speaking & Audio */}
              <View style={styles.tipItem}>
                <View style={styles.tipIconCircle}>
                  <MaterialCommunityIcons name="microphone-outline" size={20} color="#4F46E5" />
                </View>
                <View style={styles.tipContent}>
                  <Text style={styles.tipHeading}>Clear Natural Speech</Text>
                  <Text style={styles.tipBody}>
                    Speak clearly at your normal conversational volume and pace. Earphones or headsets provide optimal microphone capture.
                  </Text>
                </View>
              </View>
            </View>

            {/* Action Button */}
            <TouchableOpacity
              style={styles.modalActionBtn}
              onPress={() => setIsInfoModalVisible(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.modalActionBtnText}>Got It, Let's Practice</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  gradientHeader: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomColor: "#E2E8F0",
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E1B4B",
    textAlign: "center",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },

  // ── Scenario Card ──────────────────────────────────────────────────────────
  scenarioCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
  },
  scenarioTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    lineHeight: 23,
    marginBottom: 10,
  },
  diffRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  diffBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  diffBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  rolesContainer: {
    gap: 8,
    width: "100%",
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    width: "100%",
    maxWidth: "100%",
  },
  roleBadgeIcon: {
    marginTop: 2,
  },
  roleBadgeText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#1E293B",
    lineHeight: 19,
  },
  roleBadgePrefix: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
  },

  // ── Sections ───────────────────────────────────────────────────────────────
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },

  // ── Instructions ───────────────────────────────────────────────────────────
  instructionsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  instructionsText: {
    fontSize: 14,
    color: "#334155",
    lineHeight: 22,
  },

  // ── AI Voice ───────────────────────────────────────────────────────────────
  voiceRow: {
    flexDirection: "row",
    gap: 10,
  },
  voiceBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#EEF2FF",
    borderWidth: 1.5,
    borderColor: "#C7D2FE",
  },
  voiceBtnActive: {
    backgroundColor: "#6366F1",
    borderColor: "#6366F1",
  },
  voiceBtnText: {
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },

  // ── Media Toggles ──────────────────────────────────────────────────────────
  toggleCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  toggleDivider: {
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 14,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 0,
  },
  toggleLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
  },
  toggleSub: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 2,
  },

  // ── Footer ─────────────────────────────────────────────────────────────────
  footer: {
    padding: 16,
    paddingBottom: 24,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  startBtn: {
    backgroundColor: "#4F46E5",
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  startBtnText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },

  // ── Info Modal / Bottom Sheet ───────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CBD5E1",
    alignSelf: "center",
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  modalTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  modalIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0F172A",
  },
  modalSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  tipsList: {
    gap: 14,
    marginBottom: 24,
  },
  tipItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 12,
  },
  tipIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  tipContent: {
    flex: 1,
  },
  tipHeading: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E1B4B",
    marginBottom: 3,
  },
  tipBody: {
    fontSize: 12.5,
    color: "#475569",
    lineHeight: 18,
  },
  modalActionBtn: {
    backgroundColor: "#4F46E5",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  modalActionBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});
