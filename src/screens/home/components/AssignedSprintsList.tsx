import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, Modal, Platform, ScrollView } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { STACK_ROUTES, APP_ROUTES } from "../../../navigations/Routes";
import { useActiveSprint } from "../../../contex/ActiveSprintContext";

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
  completedAt?: string | null;
  hasBaseline?: boolean;
  baselineCompleted?: boolean;
}

interface AssignedSprintsListProps {
  planCards: PlanCard[];
  navigation: any;
  userName?: string | null;
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

const DropdownSectionHeader = ({
  title,
  count,
  isExpanded,
  onToggle,
}: {
  title: string;
  count: number;
  isExpanded: boolean;
  onToggle: () => void;
}) => {
  return (
    <TouchableOpacity
      style={styles.dropdownHeaderBtn}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <View style={styles.dropdownHeaderLeft}>
        <Text style={styles.dropdownHeaderTitle}>{title}</Text>
        {count > 0 && (
          <View style={styles.dropdownHeaderBadge}>
            <Text style={styles.dropdownHeaderBadgeText}>{count}</Text>
          </View>
        )}
      </View>
      <MaterialCommunityIcons
        name={isExpanded ? "chevron-up" : "chevron-down"}
        size={20}
        color="#64748B"
      />
    </TouchableOpacity>
  );
};

export default function AssignedSprintsList({
  planCards,
  navigation,
  userName,
  emptyMessage,
}: AssignedSprintsListProps) {
  const { setActiveSprint, setActiveModule } = useActiveSprint();
  const [activeCertPlan, setActiveCertPlan] = useState<PlanCard | null>(null);
  const [inProgressExpanded, setInProgressExpanded] = useState(true);
  const [recommendationsExpanded, setRecommendationsExpanded] = useState(true);
  const [completedExpanded, setCompletedExpanded] = useState(false);

  const handleCertificateDownload = async (plan: PlanCard) => {
    try {
      const recipient = userName || "Lucid Learner";
      const sprintTitle = plan.title || "Lucid Sprint";
      
      // Format completed date nicely, fallback to current date if missing
      const dateToFormat = plan.completedAt ? new Date(plan.completedAt) : new Date();
      const dateString = dateToFormat.toLocaleDateString("en-IN", {
        month: "long",
        day: "numeric",
        year: "numeric"
      });

      const certificateHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Certificate of Completion</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            background-color: #ffffff;
            color: #1e293b;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
          }
          .certificate-container {
            position: relative;
            width: 800px;
            height: 560px;
            padding: 40px;
            border: 4px solid #e0f2fe;
            border-radius: 16px;
            background: linear-gradient(135deg, #ffffff 0%, #f0f9ff 50%, #e0f2fe 100%);
            box-sizing: border-box;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
          }
          .inner-border {
            position: absolute;
            top: 20px;
            bottom: 20px;
            left: 20px;
            right: 20px;
            border: 2px solid #d0e7ff;
            border-radius: 12px;
            pointer-events: none;
            box-sizing: border-box;
          }
          .logo-area {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 30px;
          }
          .logo-text {
            font-size: 24px;
            font-weight: 900;
            color: #1e293b;
            letter-spacing: -0.5px;
          }
          .logo-icon {
            width: 36px;
            height: 36px;
            background-color: #6366f1;
            border-radius: 8px;
          }
          .content {
            text-align: center;
          }
          .title {
            font-size: 28px;
            font-weight: 900;
            color: #0f172a;
            letter-spacing: 1px;
            margin: 0 0 35px 0;
            text-transform: uppercase;
          }
          .award-to {
            font-size: 16px;
            color: #475569;
            font-weight: 500;
            margin: 0;
          }
          .name {
            font-size: 36px;
            font-weight: 900;
            color: #2563eb;
            margin: 15px 0;
            letter-spacing: 0.5px;
          }
          .reason {
            font-size: 16px;
            color: #475569;
            line-height: 1.6;
            max-width: 600px;
            margin: 0 auto;
          }
          .sprint-name {
            font-size: 22px;
            font-weight: 700;
            color: #0f172a;
            margin: 12px 0;
          }
          .footer {
            position: absolute;
            bottom: 50px;
            left: 60px;
            right: 60px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            border-top: 1px solid #e2e8f0;
            padding-top: 20px;
          }
          .footer-item {
            text-align: left;
          }
          .footer-item.right {
            text-align: right;
          }
          .label {
            font-size: 11px;
            font-weight: 700;
            color: #94a3b8;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            margin-bottom: 4px;
          }
          .value {
            font-size: 16px;
            font-weight: 800;
            color: #1e293b;
          }
          .value.blue {
            color: #2563eb;
          }
        </style>
      </head>
      <body>
        <div class="certificate-container">
          <div class="inner-border"></div>
          <div class="logo-area">
            <span class="logo-text">Lucid</span>
            <div style="display: flex; align-items: center; gap: 8px;">
              <svg width="32" height="32" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="24" y="8" width="24" height="24" fill="#5B2DE1" />
                <rect x="8" y="24" width="24" height="24" fill="#5B2DE1" />
                <rect x="24" y="24" width="8" height="8" fill="#FFFFFF" />
                <rect x="34" y="48" width="12" height="12" fill="#8FAAE6" />
              </svg>
            </div>
          </div>
          
          <div class="content">
            <h1 class="title">Certificate of Sprint Completion</h1>
            <p class="award-to">This Certificate is Proudly Awarded to</p>
            <h2 class="name">${recipient}</h2>
            <p class="reason">In Recognition of Successfully Completing the</p>
            <p class="sprint-name">"${sprintTitle}"</p>
            <p class="reason" style="font-size: 14px; color: #64748b; font-style: italic;">
              Demonstrating Readiness, Focus and Commitment to Doing The Job Better Every Day.
            </p>
          </div>
          
          <div class="footer">
            <div class="footer-item">
              <div class="label">Date</div>
              <div class="value">${dateString}</div>
            </div>
            <div class="footer-item right">
              <div class="label">Awarded by</div>
              <div class="value blue">Lucid</div>
            </div>
          </div>
        </div>
      </body>
      </html>
      `;

      // Generate the PDF file
      const { uri } = await Print.printToFileAsync({
        html: certificateHtml,
        width: 800,
        height: 560
      });

      const slugifiedSprint = sprintTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const filename = `lucid-certificate-${slugifiedSprint}.pdf`;
      
      // Move to a filename-specific URI for better sharing UX
      const newUri = `${FileSystem.cacheDirectory}${filename}`;
      await FileSystem.copyAsync({
        from: uri,
        to: newUri
      });

      // Android: Save file directly to chosen directory using StorageAccessFramework
      if (Platform.OS === "android") {
        try {
          const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
          if (permissions.granted) {
            const directoryUri = permissions.directoryUri;
            const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
              directoryUri,
              filename,
              "application/pdf"
            );
            const base64 = await FileSystem.readAsStringAsync(newUri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            await FileSystem.writeAsStringAsync(fileUri, base64, {
              encoding: FileSystem.EncodingType.Base64,
            });
            Alert.alert("Success", "Certificate downloaded successfully.");
            return;
          }
        } catch (androidErr) {
          console.warn("[Certificate] SAF download failed, falling back to share sheet:", androidErr);
        }
      }

      // iOS / Fallback: Use Sharing.shareAsync to allow the user to save/share the certificate
      await Sharing.shareAsync(newUri, {
        mimeType: "application/pdf",
        dialogTitle: `Download ${sprintTitle} Certificate`,
        UTI: "com.adobe.pdf"
      });

    } catch (err) {
      console.error("[Certificate] Failed to generate/share PDF:", err);
      Alert.alert("Error", "Failed to generate or download your completion certificate.");
    }
  };

  const inProgressSprints = planCards.filter((p) => p.status === "IN_PROGRESS");
  const notStartedSprints = planCards.filter((p) => p.status === "NOT_STARTED");
  const completedSprints = planCards.filter((p) => p.status === "COMPLETED");

  if (planCards.length === 0) {
    return (
      <View style={styles.emptyState}>
        <MaterialCommunityIcons
          name="book-multiple"
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
      {/* ── 1. ACTIVE SPRINTS (IN PROGRESS DROPDOWN) ───────────────────── */}
      {inProgressSprints.length > 0 && (
        <View style={styles.sectionContainer}>
          <DropdownSectionHeader
            title="In Progress"
            count={inProgressSprints.length}
            isExpanded={inProgressExpanded}
            onToggle={() => setInProgressExpanded(!inProgressExpanded)}
          />
          {inProgressExpanded && (
            <View style={styles.dropdownContentContainer}>
              {inProgressSprints.map((plan) => {
                const progressPercentage = getSprintProgress(plan);
                const completedCount = Math.min(plan.completedModulesCount ?? 0, plan.totalModules);
                const totalModules = plan.totalModules;
                const isBaselinePending = plan.hasBaseline && !plan.baselineCompleted;

                const handleCardPress = () => {
                  if (isBaselinePending) {
                    Alert.alert(
                      "Baseline Required",
                      "Please complete the baseline evaluation to unlock the modules for this sprint.",
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Take Baseline",
                          onPress: handleTakeBaseline,
                        },
                      ]
                    );
                    return;
                  }
                  setActiveSprint({
                    moduleId: plan.moduleId,
                    planId: plan.planKey,
                    planTitle: plan.title,
                    modules: plan.modules,
                    tips: plan.tips,
                    processedModuleIds: plan.processedModuleIds ?? [],
                  });
                  setActiveModule(null);
                  navigation.navigate("AppTabs", { screen: STACK_ROUTES.SPRINT });
                };

                const handleTakeBaseline = () => {
                  navigation.navigate(STACK_ROUTES.MODULE_QUIZ, {
                    moduleId: plan.moduleId,
                    title: `${plan.title} - Baseline Evaluation`,
                    assessmentType: "baseline",
                    isBaseline: true,
                  });
                };

                return (
                  <View key={plan.planKey} style={styles.cardWrapper}>
                    <TouchableOpacity
                      style={styles.unifiedCard}
                      onPress={handleCardPress}
                      activeOpacity={0.8}
                    >
                      {/* Slot A: Left Icon */}
                      <View style={styles.slotLeft}>
                        <View style={[styles.planIconCircle, styles.iconCircleInProgress]}>
                          <MaterialCommunityIcons name="clock-time-eight-outline" size={20} color="#F59E0B" />
                        </View>
                      </View>

                      {/* Slot B: Center Title & Progress Bar */}
                      <View style={styles.slotCenter}>
                        <Text numberOfLines={2} style={styles.planTitleText}>
                          {plan.title}
                        </Text>
                        <View style={styles.listProgressContainer}>
                          <View style={styles.progressBarTrack}>
                            <View style={[styles.progressBarFill, { width: `${progressPercentage}%` }]} />
                          </View>
                          <Text style={styles.progressDetailText}>
                            {completedCount}/{totalModules} modules
                          </Text>
                        </View>
                      </View>

                      {/* Slot C: Right Status dot & Chevron */}
                      <View style={styles.slotRight}>
                        <View style={[styles.statusDot, styles.dotInProgress]} />
                        <MaterialCommunityIcons name="chevron-right" size={18} color="#CBD5E1" />
                      </View>
                    </TouchableOpacity>

                    {/* Baseline Bar */}
                    {plan.hasBaseline && (
                      <View style={styles.baselineRow}>
                        {isBaselinePending ? (
                          <>
                            <View style={styles.baselineBadgeAmber}>
                              <MaterialCommunityIcons name="alert-circle-outline" size={13} color="#D97706" />
                              <Text style={styles.baselineBadgeTextAmber}>Baseline Required</Text>
                            </View>
                            <TouchableOpacity
                              style={styles.takeBaselineBtn}
                              onPress={handleTakeBaseline}
                              activeOpacity={0.85}
                            >
                              <MaterialCommunityIcons name="clipboard-text-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                              <Text style={styles.takeBaselineBtnText}>Take Baseline</Text>
                            </TouchableOpacity>
                          </>
                        ) : (
                          <View style={styles.baselineBadgeGreen}>
                            <MaterialCommunityIcons name="check-circle-outline" size={13} color="#059669" />
                            <Text style={styles.baselineBadgeTextGreen}>Baseline Completed</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* ── 2. New Sprints (NOT STARTED DROPDOWN) ──────────────── */}
      {notStartedSprints.length > 0 && (
        <View style={styles.sectionContainer}>
          <DropdownSectionHeader
            title="New Sprints"
            count={notStartedSprints.length}
            isExpanded={recommendationsExpanded}
            onToggle={() => setRecommendationsExpanded(!recommendationsExpanded)}
          />
          {recommendationsExpanded && (
            <View style={styles.dropdownContentContainer}>
              {notStartedSprints.map((plan) => {
                const isBaselinePending = plan.hasBaseline && !plan.baselineCompleted;

                const handleCardPress = () => {
                  if (isBaselinePending) {
                    Alert.alert(
                      "Baseline Required",
                      "Please complete the baseline evaluation to unlock the modules for this sprint.",
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Take Baseline",
                          onPress: handleTakeBaseline,
                        },
                      ]
                    );
                    return;
                  }
                  setActiveSprint({
                    moduleId: plan.moduleId,
                    planId: plan.planKey,
                    planTitle: plan.title,
                    modules: plan.modules,
                    tips: plan.tips,
                    processedModuleIds: plan.processedModuleIds ?? [],
                  });
                  setActiveModule(null);
                  navigation.navigate("AppTabs", { screen: STACK_ROUTES.SPRINT });
                };

                const handleTakeBaseline = () => {
                  navigation.navigate(STACK_ROUTES.MODULE_QUIZ, {
                    moduleId: plan.moduleId,
                    title: `${plan.title} - Baseline Evaluation`,
                    assessmentType: "baseline",
                    isBaseline: true,
                  });
                };

                return (
                  <View key={plan.planKey} style={styles.cardWrapper}>
                    <TouchableOpacity
                      style={styles.unifiedCard}
                      onPress={handleCardPress}
                      activeOpacity={0.8}
                    >
                      {/* Slot A: Left Icon */}
                      <View style={styles.slotLeft}>
                        <View style={[styles.planIconCircle, styles.iconCircleRecommendations]}>
                          <MaterialCommunityIcons name="book-multiple" size={20} color="#4F46E5" />
                        </View>
                      </View>

                      {/* Slot B: Center Title & Subtext */}
                      <View style={styles.slotCenter}>
                        <Text numberOfLines={2} style={styles.planTitleText}>
                          {plan.title}
                        </Text>
                        <Text style={styles.progressDetailText}>
                          {plan.totalModules} Modules
                        </Text>
                      </View>

                      {/* Slot C: Right Status dot & Chevron */}
                      <View style={styles.slotRight}>
                        <View style={[styles.statusDot, styles.dotNotStarted]} />
                        <MaterialCommunityIcons name="chevron-right" size={18} color="#CBD5E1" />
                      </View>
                    </TouchableOpacity>

                    {/* Baseline Bar */}
                    {plan.hasBaseline && (
                      <View style={styles.baselineRow}>
                        {isBaselinePending ? (
                          <>
                            <View style={styles.baselineBadgeAmber}>
                              <MaterialCommunityIcons name="alert-circle-outline" size={13} color="#D97706" />
                              <Text style={styles.baselineBadgeTextAmber}>Baseline Required</Text>
                            </View>
                            <TouchableOpacity
                              style={styles.takeBaselineBtn}
                              onPress={handleTakeBaseline}
                              activeOpacity={0.85}
                            >
                              <MaterialCommunityIcons name="clipboard-text-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                              <Text style={styles.takeBaselineBtnText}>Take Baseline</Text>
                            </TouchableOpacity>
                          </>
                        ) : (
                          <View style={styles.baselineBadgeGreen}>
                            <MaterialCommunityIcons name="check-circle-outline" size={13} color="#059669" />
                            <Text style={styles.baselineBadgeTextGreen}>Baseline Completed</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* ── 3. COMPLETED SPRINTS (COMPLETED DROPDOWN) ──────────────────── */}
      {completedSprints.length > 0 && (
        <View style={styles.sectionContainer}>
          <DropdownSectionHeader
            title="Completed"
            count={completedSprints.length}
            isExpanded={completedExpanded}
            onToggle={() => setCompletedExpanded(!completedExpanded)}
          />
          {completedExpanded && (
            <View style={styles.dropdownContentContainer}>
              {completedSprints.map((plan) => {
                const handleCardPress = () => {
                  setActiveSprint({
                    moduleId: plan.moduleId,
                    planId: plan.planKey,
                    planTitle: plan.title,
                    modules: plan.modules,
                    tips: plan.tips,
                    processedModuleIds: plan.processedModuleIds ?? [],
                  });
                  setActiveModule(null);
                  navigation.navigate("AppTabs", { screen: STACK_ROUTES.SPRINT });
                };

                return (
                  <TouchableOpacity
                    key={plan.planKey}
                    style={styles.unifiedCard}
                    onPress={handleCardPress}
                    activeOpacity={0.8}
                  >
                    {/* Slot A: Left Icon */}
                    <View style={styles.slotLeft}>
                      <View style={[styles.planIconCircle, styles.iconCircleCompleted]}>
                        <MaterialCommunityIcons name="check-decagram" size={20} color="#10B981" />
                      </View>
                    </View>

                    {/* Slot B: Center Title & Subtext */}
                    <View style={styles.slotCenter}>
                      <Text numberOfLines={2} style={styles.planTitleText}>
                        {plan.title}
                      </Text>
                      <Text style={styles.progressDetailText}>
                        Completed
                      </Text>
                    </View>

                    {/* Slot C: Right Status dot & Certificate Download button */}
                    <View style={styles.slotRight}>
                      <View style={[styles.statusDot, styles.dotCompleted]} />
                      <TouchableOpacity
                        style={styles.certificateIconBtn}
                        activeOpacity={0.7}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        onPress={(e) => {
                          e.stopPropagation();
                          setActiveCertPlan(plan);
                        }}
                      >
                        <MaterialCommunityIcons name="certificate" size={20} color="#D97706" />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      )}
      {/* Certificate Preview Modal */}
      {activeCertPlan && (
        <Modal
          visible={activeCertPlan !== null}
          transparent
          animationType="slide"
          onRequestClose={() => setActiveCertPlan(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Certificate Preview</Text>
                <TouchableOpacity
                  onPress={() => setActiveCertPlan(null)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <MaterialCommunityIcons name="close" size={24} color="#64748B" />
                </TouchableOpacity>
              </View>

              {/* Certificate Card */}
              <View style={styles.certCard}>
                <View>
                  <View style={styles.certHeaderRow}>
                    <Text style={styles.certLogoText}>Lucid</Text>
                    <MaterialCommunityIcons name="seal-variant" size={24} color="#6366f1" />
                  </View>

                  <Text style={styles.certMainTitle}>CERTIFICATE OF COMPLETION</Text>
                  <Text style={styles.certAwardText}>This Certificate is Proudly Awarded to</Text>
                  <Text style={styles.certRecipientName}>{userName || "Lucid Learner"}</Text>
                  <Text style={styles.certDescription}>for successfully completing the sprint</Text>
                  <Text style={styles.certSprintName}>"{activeCertPlan.title}"</Text>
                  <Text style={styles.certMotto}>
                    Demonstrating Readiness, Focus and Commitment to Doing The Job Better Every Day.
                  </Text>

                  <View style={styles.certFooter}>
                    <View>
                      <Text style={styles.certFooterLabel}>Date</Text>
                      <Text style={styles.certFooterValue}>
                        {(() => {
                          const dateToFormat = activeCertPlan.completedAt ? new Date(activeCertPlan.completedAt) : new Date();
                          return dateToFormat.toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric"
                          });
                        })()}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={styles.certFooterLabel}>Awarded by</Text>
                      <Text style={[styles.certFooterValue, { color: "#2563EB" }]}>Lucid</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Actions */}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.downloadBtn}
                  onPress={async () => {
                    await handleCertificateDownload(activeCertPlan);
                    setActiveCertPlan(null);
                  }}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="download" size={20} color="#fff" />
                  <Text style={styles.downloadBtnText}>Download PDF</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
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

  // Redesign: Sections
  sectionContainer: {
    marginBottom: 16,
  },

  // Collapsible Dropdown Headers
  dropdownHeaderBtn: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    // marginBottom: 8,
  },
  dropdownHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  dropdownHeaderTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  dropdownHeaderBadge: {
    backgroundColor: "#EFF6FF",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
    // borderWidth: 1,
    borderColor: "#DBEAFE",
    justifyContent: "center",
    alignItems: "center",
  },
  dropdownHeaderBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2563EB",
    lineHeight: 14,
  },
  dropdownContentContainer: {
    marginTop: 4,
  },

  // List card progress bar track & fill
  listProgressContainer: {
    marginTop: 4,
    width: "100%",
  },
  progressBarTrack: {
    height: 4,
    backgroundColor: "#F1F5F9",
    borderRadius: 2,
    width: "100%",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#F59E0B",
    borderRadius: 2,
  },

  cardWrapper: {
    marginBottom: 12,
  },
  baselineRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: -4,
    marginBottom: 4,
  },
  baselineBadgeAmber: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  baselineBadgeTextAmber: {
    fontSize: 11,
    fontWeight: "700",
    color: "#D97706",
  },
  baselineBadgeGreen: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  baselineBadgeTextGreen: {
    fontSize: 11,
    fontWeight: "700",
    color: "#059669",
  },
  takeBaselineBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F59E0B",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  takeBaselineBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // Unified Card Container (Fixed Slot Architecture for List Items)
  unifiedCard: {
    height: 96,
    backgroundColor: "#fff",
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    // elevation: 1,
    position: "relative",
  },

  // Slot A: Left
  slotLeft: {
    flexShrink: 0,
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  planIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  iconCircleInProgress: {
    backgroundColor: "#FFF7ED",
    borderColor: "#FFEDD5",
  },
  iconCircleRecommendations: {
    backgroundColor: "#EEF2FF",
    borderColor: "#E0E7FF",
  },
  iconCircleCompleted: {
    backgroundColor: "#ECFDF5",
    borderColor: "#D1FAE5",
  },

  // Slot B: Center Text
  slotCenter: {
    flex: 1,
    justifyContent: "center",
  },
  planTitleText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E293B",
    lineHeight: 18,
    height: 36, // Fixed height for exactly 2 lines
  },
  progressDetailText: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
    marginTop: 3,
  },

  // Slot C: Right
  slotRight: {
    flexShrink: 0,
    width: 44,
    height: "100%",
    paddingVertical: 12,
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  certificateIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#FEF3C7",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 6,
  },

  // Status Badge / Dot
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotNotStarted: { backgroundColor: "#94A3B8" },
  dotInProgress: { backgroundColor: "#F59E0B" },
  dotCompleted: { backgroundColor: "#10B981" },

  buttonRow: {
    flexDirection: "row",
    gap: 10,
  },
  sprintButtonCertificate: {
    backgroundColor: "#F59E0B",
  },
  sprintButtonTextCertificate: {
    color: "#fff",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1E293B",
  },
  certCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    // elevation: 1,
  },
  // certInnerBorder: {
  //   borderWidth: 1.5,
  //   borderColor: "#D8E5F5",
  //   borderRadius: 12,
  //   padding: 16,
  //   alignItems: "center",
  // },
  certHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginBottom: 16,
  },
  certLogoText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#1E293B",
  },
  certMainTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: 1,
    textAlign: "center",
    marginBottom: 20,
  },
  certAwardText: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "600",
    marginBottom: 6,
  },
  certRecipientName: {
    fontSize: 22,
    fontWeight: "900",
    color: "#2563EB",
    textAlign: "center",
    marginBottom: 16,
  },
  certDescription: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "600",
    marginBottom: 4,
  },
  certSprintName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1E293B",
    textAlign: "center",
    marginBottom: 14,
  },
  certMotto: {
    fontSize: 10,
    color: "#94A3B8",
    fontStyle: "italic",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 14,
  },
  certFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingTop: 12,
  },
  certFooterLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  certFooterValue: {
    fontSize: 12,
    fontWeight: "800",
    color: "#334155",
  },
  modalActions: {
    marginTop: 20,
  },
  downloadBtn: {
    backgroundColor: "#6366F1",
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    // elevation: 6,
  },
  downloadBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
});
