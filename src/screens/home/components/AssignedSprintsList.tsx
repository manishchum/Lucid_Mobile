import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, Modal, Platform } from "react-native";
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

export default function AssignedSprintsList({
  planCards,
  navigation,
  userName,
  emptyMessage,
}: AssignedSprintsListProps) {
  const { setActiveSprint, setActiveModule } = useActiveSprint();
  const [activeCertPlan, setActiveCertPlan] = useState<PlanCard | null>(null);

  const handleCertificateDownload = async (plan: PlanCard) => {
    try {
      const recipient = userName || "Lucid Learner";
      const sprintTitle = plan.title || "Lucid Sprint";
      
      // Format current date nicely
      const dateString = new Date().toLocaleDateString("en-US", {
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

      // Share/Download the PDF using native share sheet
      const slugifiedSprint = sprintTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const filename = `lucid-certificate-${slugifiedSprint}.pdf`;
      
      // Move to a filename-specific URI for better sharing UX
      const newUri = `${FileSystem.cacheDirectory}${filename}`;
      await FileSystem.copyAsync({
        from: uri,
        to: newUri
      });

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

  if (planCards.length === 0) {
    return (
      <View style={styles.emptyState}>
        <MaterialCommunityIcons
          name="book-open-outline"
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
      {planCards.map((plan) => {
        const isCompleted = plan.status === "COMPLETED";
        const isInProgress = plan.status === "IN_PROGRESS";
        const progressPercentage = getSprintProgress(plan);
        const completedCount = Math.min(plan.completedModulesCount ?? 0, plan.totalModules);
        const totalModules = plan.totalModules;

        const handleCardPress = () => {
          setActiveSprint({
            moduleId: plan.moduleId,
            planId: plan.planKey,
            planTitle: plan.title,
            modules: plan.modules,
            tips: plan.tips,
            processedModuleIds: plan.processedModuleIds ?? [],
          });
          setActiveModule(null); // Unmount old module
          navigation.navigate("AppTabs", { screen: STACK_ROUTES.SPRINT });
        };

        return (
          <TouchableOpacity
            key={plan.planKey}
            style={styles.planCard}
            onPress={handleCardPress}
            activeOpacity={0.8}
          >
            {/* Top row: Status badge */}
            <View style={styles.planHeaderRow}>
              <View
                style={[
                  styles.statusBadge,
                  isCompleted
                    ? styles.statusBadgeCompleted
                    : isInProgress
                      ? styles.statusBadgeInProgress
                      : styles.statusBadgeNotStarted,
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    isCompleted
                      ? styles.statusTextCompleted
                      : isInProgress
                        ? styles.statusTextInProgress
                        : styles.statusTextNotStarted,
                  ]}
                >
                  {isCompleted
                    ? "Completed"
                    : isInProgress
                      ? "In Progress"
                      : "Not Started"}
                </Text>
              </View>
            </View>

            {/* Content layout matching the uploaded image */}
            <View style={styles.planContentRow}>
              {/* Soft blue circle with icon */}
              <View style={styles.planIconCircle}>
                <MaterialCommunityIcons
                  name="layers"
                  size={22}
                  color="#2563EB"
                />
              </View>

              {/* Title & Progress details */}
              <View style={{ flex: 1 }}>
                <Text style={styles.planTitleText}>{plan.title}</Text>
                
                {/* Horizontal Progress Bar */}
                <View style={styles.progressBarTrack}>
                  <View style={[styles.progressBarFill, { width: `${progressPercentage}%` }]} />
                </View>

                {/* Progress helper text */}
                <Text style={styles.progressDetailText}>
                  {completedCount}/{totalModules} modules completed
                </Text>
              </View>

              {/* Chevron right */}
              <MaterialCommunityIcons
                name="chevron-right"
                size={22}
                color="#CBD5E1"
              />
            </View>

            {/* If completed, we show a certificate button */}
            {isCompleted && (
              <View style={styles.certificateRow}>
                <TouchableOpacity
                  style={styles.certificateLinkBtn}
                  activeOpacity={0.7}
                  onPress={(e) => {
                    e.stopPropagation(); // Stop card click from triggering navigation
                    setActiveCertPlan(plan);
                  }}
                >
                  <MaterialCommunityIcons
                    name="certificate-outline"
                    size={16}
                    color="#D97706"
                  />
                  <Text style={styles.certificateLinkText}>
                    Download Certificate
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </TouchableOpacity>
        );
      })}

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
                <View style={styles.certInnerBorder}>
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
                        {new Date().toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric"
                        })}
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

  planCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 3,
  },
  planHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  planContentRow: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
  },
  planIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    flexShrink: 0,
  },
  planTitleText: { fontSize: 16, fontWeight: "700", color: "#1E293B" },
  progressBarTrack: {
    height: 6,
    backgroundColor: "#F1F5F9",
    borderRadius: 3,
    marginTop: 8,
    marginBottom: 6,
    width: "100%",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#2563EB",
    borderRadius: 3,
  },
  progressDetailText: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
  },
  certificateRow: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 10,
    alignItems: "flex-start",
  },
  certificateLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  certificateLinkText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#D97706",
  },
  statusBadge: {
    alignSelf: "flex-start",
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  statusBadgeNotStarted: { backgroundColor: "#F1F5F9" },
  statusBadgeInProgress: { backgroundColor: "#EFF6FF" },
  statusBadgeCompleted: { backgroundColor: "#DCFCE7" },
  statusBadgeText: { fontSize: 11, fontWeight: "700" },
  statusTextNotStarted: { color: "#64748B" },
  statusTextInProgress: { color: "#2563EB" },
  statusTextCompleted: { color: "#16A34A" },
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
    elevation: 3,
  },
  certInnerBorder: {
    borderWidth: 1.5,
    borderColor: "#D8E5F5",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
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
    elevation: 6,
  },
  downloadBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
});
