import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Scenario } from "../../../api/roleplay";
import { STACK_ROUTES } from "../../../navigations/Routes";

export interface RoleplayConfig {
  difficulty: string;
  tone: string;
  voiceGender: "female" | "male";
  cameraEnabled: boolean;
  micEnabled: boolean;
}

const DIFFICULTY_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  Easy:   { bg: "#DCFCE7", text: "#16A34A", border: "#86EFAC" },
  Medium: { bg: "#FEF9C3", text: "#CA8A04", border: "#FDE047" },
  Hard:   { bg: "#FEE2E2", text: "#DC2626", border: "#FCA5A5" },
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
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1E1B4B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Start Your Roleplay Session</Text>
        <View style={styles.headerRightSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Scenario Overview Card */}
        <View style={styles.scenarioCard}>
          <Text style={styles.scenarioTitle}>{scenario?.title}</Text>

          {/* Role badges + Difficulty in one row */}
          <View style={styles.metaRow}>
            <View style={styles.roleBadge}>
              <MaterialCommunityIcons name="account-outline" size={13}  />
              <Text style={styles.roleBadgeText}>You: {scenario?.userRole || "Learner"}</Text>
            </View>
            <View style={[styles.roleBadge, ]}>
              <MaterialCommunityIcons name="robot-outline" size={13}/>
              <Text style={[styles.roleBadgeText]}>
                AI: {scenario?.role || "Evaluator"}
              </Text>
            </View>
            {/* Pre-defined difficulty badge — read-only */}
            <View style={[styles.diffBadge, { backgroundColor: diffStyle.bg, borderColor: diffStyle.border }]}>
              <Text style={[styles.diffBadgeText, { color: diffStyle.text }]}>{difficulty}</Text>
              <MaterialCommunityIcons name="chart-bar" size={13} color={diffStyle.text} />
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

        {/* Media Settings */}
        {/* <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="cog-outline" size={18} color="#6366F1" />
            <Text style={styles.sectionTitle}>Media Settings</Text>
          </View>

          <View style={styles.toggleCard}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleLeft}>
                <MaterialCommunityIcons
                  name={config.cameraEnabled ? "camera" : "camera-off"}
                  size={20}
                  color={config.cameraEnabled ? "#6366F1" : "#94A3B8"}
                />
                <View style={{ marginLeft: 12 }}>
                  <Text style={styles.toggleLabel}>Camera</Text>
                  <Text style={styles.toggleSub}>
                    {config.cameraEnabled ? "Camera will be on" : "Camera will be off"}
                  </Text>
                </View>
              </View>
              <Switch
                value={config.cameraEnabled}
                onValueChange={(v) => setConfig((prev) => ({ ...prev, cameraEnabled: v }))}
                trackColor={{ false: "#E2E8F0", true: "#C7D2FE" }}
                thumbColor={config.cameraEnabled ? "#6366F1" : "#94A3B8"}
              />
            </View>

            <View style={styles.toggleDivider}>
              <View style={styles.toggleRow}>
                <View style={styles.toggleLeft}>
                  <MaterialCommunityIcons
                    name={config.micEnabled ? "microphone" : "microphone-off"}
                    size={20}
                    color={config.micEnabled ? "#6366F1" : "#94A3B8"}
                  />
                  <View style={{ marginLeft: 12 }}>
                    <Text style={styles.toggleLabel}>Microphone</Text>
                    <Text style={styles.toggleSub}>
                      {config.micEnabled ? "Mic will be on" : "Mic will be off"}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={config.micEnabled}
                  onValueChange={(v) => setConfig((prev) => ({ ...prev, micEnabled: v }))}
                  trackColor={{ false: "#E2E8F0", true: "#C7D2FE" }}
                  thumbColor={config.micEnabled ? "#6366F1" : "#94A3B8"}
                />
              </View>
            </View>
          </View>
        </View> */}

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
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E1B4B",
    textAlign: "center",
  },
  headerRightSpacer: {
    width: 32,
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
    backgroundColor: "#EEF2FF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#C7D2FE",
  },
  scenarioTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E1B4B",
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#059669",
  },
  diffBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  diffBadgeText: {
    fontSize: 12,
    fontWeight: "700",
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
});
