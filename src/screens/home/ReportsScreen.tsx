import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  BackHandler,
  Modal,
  FlatList,
  LayoutAnimation,
  Platform,
  UIManager,
  RefreshControl,
  Dimensions,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { useAuth } from "../../contex/AuthContext";
import { useTenant } from "../../contex/TenantContext";
import {
  getEmployeeAssessments,
  getAssessmentsBatch,
  getProcessedModulesBatch,
  getLearningStyle,
} from "../../api/users/Request";
import { eventBus } from "../../utils/EventBus";

const { width } = Dimensions.get("window");

// Global in-memory cache for reports to prevent skeleton on revisit
let reportsCache: {
  groupedHistory: GroupedModule[];
  learningStyleData: any;
  userId: string | null;
} | null = null;

// Clean cache on global refresh events
eventBus.on("refresh_reports", () => {
  reportsCache = null;
});

// Enable LayoutAnimation for Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Interface types
interface AssessmentAttempt {
  employee_assessment_id: string;
  assessment_id: string;
  score: number;
  max_score: number;
  feedback: string | null;
  question_feedback: string | null;
  created_at: string;
  completed_at?: string;
  updated_at: string;
  answers?: any;
  parsedFeedback?: any[];
  parsedQuestions?: any[];
  assessments?: {
    original_module_id?: string;
    processed_module_id?: string;
    parent_module_title?: string;
    module_title?: string;
    title?: string;
    type?: "baseline" | "module";
    questions?: any;
  };
}

interface GroupedModule {
  moduleId: string;
  moduleTitle: string;
  attempts: AssessmentAttempt[];
}

interface FeedbackSection {
  title: string;
  content: string;
  type: "success" | "warning" | "info" | "neutral";
  iconName: string;
}

interface ParsedAnswer {
  status: "Correct" | "Incorrect" | "Unknown";
  explanation?: string;
}

// Robust parsing for learning style report (Gregorc model)
const extractReportFromJson = (analysis: string): string => {
  if (!analysis) return "";
  try {
    const jsonMatch =
      analysis.match(/```json\s*([\s\S]*?)```/) ||
      analysis.match(/\{[\s\S]*?"report"[\s\S]*?\}/);
    if (jsonMatch) {
      const jsonStr = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(jsonStr);
      if (parsed.report) return parsed.report.replace(/\\n/g, "\n");
    }
  } catch (e) {}

  const reportStart = analysis.indexOf(
    "Here is your personalized learning style report:",
  );
  if (reportStart !== -1) {
    const reportText = analysis.substring(
      reportStart +
        "Here is your personalized learning style report:".length,
    );
    const jsonStart = reportText.indexOf("```json");
    if (jsonStart !== -1) return reportText.substring(0, jsonStart).trim();
    return reportText.trim();
  }

  return analysis;
};

const parseReportIntoTabs = (reportText: string) => {
  const tabs: any[] = [];
  if (!reportText) return tabs;

  reportText = reportText.replace(
    /^Title:\s*Your Personal Learning Style Insights\s*\n\n/i,
    "",
  );
  reportText = reportText.replace(
    /^Here is your personalized learning style report:\s*\n\n/i,
    "",
  );

  const lines = reportText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.match(/^[-=-·]+$/));
  let currentTab: any = null;
  let currentSub: any = null;

  for (const line of lines) {
    const mainHeader = line.match(/^(\d+)\.\s*(.+?):\s*$/);
    if (mainHeader) {
      if (currentTab) tabs.push(currentTab);
      const title = mainHeader[2];
      let id = "natural";
      if (title.toLowerCase().includes("thrive")) id = "thrive";
      else if (title.toLowerCase().includes("tip")) id = "tips";
      currentTab = { id, title, content: "", bullets: [], subsections: [] };
      currentSub = null;
      continue;
    }

    const subHeader = line.match(/^(?![-*\-·])(\w.+?):\s*$/);
    if (subHeader && currentTab && !line.match(/^\d+\./)) {
      const subtitle = subHeader[1].trim();
      if (subtitle && subtitle.length < 100) {
        currentSub = { subtitle, items: [] };
        currentTab.subsections.push(currentSub);
        continue;
      }
    }

    const bullet = line.match(/^[-*\-·]\s*(.+)$/);
    if (bullet) {
      const rawItem = bullet[1].trim();
      const item = rawItem.length ? rawItem : bullet[1];
      if (item && item.length > 0) {
        if (currentSub) currentSub.items.push(item);
        else if (currentTab) currentTab.bullets.push(item);
      }
      continue;
    }

    if (line && currentTab && !line.match(/^\d+\./) && !line.includes(":")) {
      currentTab.content += (currentTab.content ? "\n" : "") + line;
    }
  }
  if (currentTab) tabs.push(currentTab);
  return tabs;
};

const getLearningStyleInfo = (styleCode: string) => {
  const styleMap: Record<string, { label: string; description: string }> = {
    CS: {
      label: "The Planner",
      description:
        "Prefers structure, clear steps, and hands-on practice. Learning emphasizes checklists, examples, and measurable milestones.",
    },
    AS: {
      label: "The Analyst",
      description:
        "Thinks analytically and values logic. Learning focuses on theory, frameworks, and evidence-based decision making.",
    },
    AR: {
      label: "The Connector",
      description:
        "Learns through connections and stories. Learning highlights collaboration, reflection, and real-world context.",
    },
    CR: {
      label: "The Explorer",
      description:
        "Enjoys experimentation and rapid iteration. Learning leans into challenges, scenarios, and creative problem solving.",
    },
  };
  return (
    styleMap[styleCode] || {
      label: styleCode,
      description: "Your personalized learning profile",
    }
  );
};

// Robust parsing for AI feedback summary
const parseAIFeedback = (feedbackText: string): FeedbackSection[] => {
  const sections: FeedbackSection[] = [];
  if (!feedbackText) return sections;

  const sectionPatterns = [
    {
      pattern: /Opening/i,
      title: "Opening Remarks",
      type: "info" as const,
      iconName: "message-text-outline",
    },
    {
      pattern: /Overall\s+Performance\s+Summary/i,
      title: "Overall Performance",
      type: "neutral" as const,
      iconName: "chart-line",
    },
    {
      pattern: /Strengths?\s+Identified/i,
      title: "Key Strengths",
      type: "success" as const,
      iconName: "check-circle-outline",
    },
    {
      pattern: /Areas?\s+for\s+Improvement/i,
      title: "Areas for Improvement",
      type: "warning" as const,
      iconName: "alert-circle-outline",
    },
    {
      pattern: /Actionable\s+Study\s+Recommendations/i,
      title: "Recommendations",
      type: "info" as const,
      iconName: "lightbulb-on-outline",
    },
    {
      pattern: /Closing\s+Remarks?/i,
      title: "Closing Remarks",
      type: "success" as const,
      iconName: "trophy-award",
    },
  ];

  const lines = feedbackText.split("\n");
  let currentSection: {
    title: string;
    content: string[];
    type: "success" | "warning" | "info" | "neutral";
    iconName: string;
  } | null = null;

  const cleanText = (text: string): string => {
    return text
      .replace(/#{1,6}\s*/g, "") // Remove markdown headers
      .replace(/\*\*/g, "") // Remove bold markdown
      .replace(/\*/g, "") // Remove italic markdown
      .replace(/^\s*[-•]\s*/gm, "• ") // Normalize bullet points
      .trim();
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const matchedPattern = sectionPatterns.find((p) => p.pattern.test(line));
    if (matchedPattern) {
      if (currentSection) {
        sections.push({
          title: currentSection.title,
          content: cleanText(currentSection.content.join("\n")),
          type: currentSection.type,
          iconName: currentSection.iconName,
        });
      }
      currentSection = {
        title: matchedPattern.title,
        content: [],
        type: matchedPattern.type,
        iconName: matchedPattern.iconName,
      };
    } else if (currentSection) {
      currentSection.content.push(line);
    }
  }

  if (currentSection) {
    sections.push({
      title: currentSection.title,
      content: cleanText(currentSection.content.join("\n")),
      type: currentSection.type,
      iconName: currentSection.iconName,
    });
  }

  return sections;
};

// Robust parsing for quiz question feedback
const parseQuestionFeedback = (
  feedback: string,
  totalQuestions: number,
): ParsedAnswer[] => {
  if (!feedback) return [];
  const processedFeedback = feedback.replace("[Your Name]", "Lucid").trim();

  // Case 1: JSON array already
  if (
    processedFeedback.startsWith("[") &&
    processedFeedback.includes("Correct")
  ) {
    try {
      const arr = JSON.parse(processedFeedback);
      if (Array.isArray(arr)) {
        return arr.map((raw: string) => {
          if (typeof raw !== "string") return { status: "Incorrect" };
          if (raw.startsWith("Correct")) return { status: "Correct" };
          if (raw.startsWith("Incorrect")) {
            return {
              status: "Incorrect",
              explanation: raw.replace(/^Incorrect\.\s*/, "").trim(),
            };
          }
          return { status: "Incorrect" };
        });
      }
    } catch {}
  }

  // Case 2: Comma-separated quoted tokens or manual split
  const cleanFeedback = processedFeedback
    .replace(/\r/g, "")
    .replace(/\n/g, "")
    .trim();
  const tentative = cleanFeedback.startsWith("[")
    ? cleanFeedback
    : `[${cleanFeedback}]`;
  try {
    const jsonReady = tentative
      .replace(/([^\\])""/g, '$1"')
      .replace(/,\s*$/, "");
    const arr = JSON.parse(jsonReady);
    if (Array.isArray(arr)) {
      return arr.map((token: string) => {
        if (typeof token !== "string") return { status: "Incorrect" };
        const clean = token.trim();
        if (clean.startsWith("Correct")) return { status: "Correct" };
        if (clean.startsWith("Incorrect")) {
          return {
            status: "Incorrect",
            explanation: clean.replace(/^Incorrect\.\s*/, "").trim(),
          };
        }
        return { status: "Incorrect" };
      });
    }
  } catch {
    // Manual split fallback
    const parts = cleanFeedback
      .split(/","/)
      .map((p) => p.replace(/^"|"$/g, "").trim())
      .filter(Boolean);
    if (parts.length) {
      return parts.map((p) => {
        if (p.startsWith("Correct")) return { status: "Correct" };
        if (p.startsWith("Incorrect")) {
          return {
            status: "Incorrect",
            explanation: p.replace(/^Incorrect\.\s*/, "").trim(),
          };
        }
        return { status: "Incorrect" };
      });
    }
  }

  // General fallback: split by newline
  const lines = processedFeedback.split("\n").filter(Boolean);
  if (lines.length > 0) {
    return lines.map((line) => {
      const clean = line.trim();
      if (clean.toLowerCase().startsWith("correct"))
        return { status: "Correct" };
      if (clean.toLowerCase().startsWith("incorrect")) {
        return {
          status: "Incorrect",
          explanation: clean.replace(/^(Incorrect|incorrect)\.?\s*/, "").trim(),
        };
      }
      return { status: "Unknown" };
    });
  }

  return [];
};

const FormattedMarkdownText = ({
  text,
  textColor = "#475569",
}: {
  text: string;
  textColor?: string;
}) => {
  if (!text) return null;

  // Split text by lines
  const lines = text.split("\n");

  return (
    <View style={{ gap: 6 }}>
      {lines.map((line, lineIdx) => {
        const trimmed = line.trim();
        if (!trimmed) return null;

        // Check if it is a list item
        const isBullet =
          trimmed.startsWith("•") ||
          trimmed.startsWith("-") ||
          trimmed.startsWith("*");
        const cleanLine = isBullet ? trimmed.replace(/^[-•*]\s*/, "") : trimmed;

        // Helper to parse bold text
        const renderTextWithBold = (txt: string) => {
          const parts = txt.split(/\*\*([\s\S]*?)\*\*/);
          return parts.map((part, partIdx) => {
            const isBold = partIdx % 2 === 1;
            return (
              <Text
                key={partIdx}
                style={{
                  fontWeight: isBold ? "800" : "500",
                  color: isBold ? "#0F172A" : textColor,
                }}
              >
                {part}
              </Text>
            );
          });
        };

        if (isBullet) {
          return (
            <View key={lineIdx} style={styles.bulletRow}>
              <Text style={[styles.bulletDot, { color: textColor }]}>•</Text>
              <Text style={styles.bulletText}>
                {renderTextWithBold(cleanLine)}
              </Text>
            </View>
          );
        }

        return (
          <Text key={lineIdx} style={styles.paragraphText}>
            {renderTextWithBold(cleanLine)}
          </Text>
        );
      })}
    </View>
  );
};

const ModuleCardItem = React.memo(({
  item,
  isExpanded,
  onToggle,
  onSelectAttempt,
}: {
  item: GroupedModule;
  isExpanded: boolean;
  onToggle: () => void;
  onSelectAttempt: (attempt: AssessmentAttempt) => void;
}) => {
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

            // Color pills based on score
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
                    ).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </Text>
                </View>
                <View style={styles.attemptRight}>
                  <View
                    style={[
                      styles.attemptPill,
                      { backgroundColor: pillBg },
                    ]}
                  >
                    <Text
                      style={[
                        styles.attemptPillText,
                        { color: pillText },
                      ]}
                    >
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
});

export default function ReportsScreen() {
  const navigation = useNavigation<any>();
  const { cachedUser } = useAuth();
  const { company } = useTenant();

  const userId = cachedUser?.userId ?? null;
  const companyUsesLearningStyle = Boolean(company?.learning_style);

  // Tab State
  const [activeTab, setActiveTab] = useState<"history" | "style">("history");

  // Expanded card state
  const [expandedModules, setExpandedModules] = useState<
    Record<string, boolean>
  >({});
  const [expandedLSSections, setExpandedLSSections] = useState<
    Record<string, boolean>
  >({});
  const [expandedReportSections, setExpandedReportSections] = useState<
    Record<string, boolean>
  >({});

  // API Data State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [groupedHistory, setGroupedHistory] = useState<GroupedModule[]>([]);
  const [learningStyleData, setLearningStyleData] = useState<any>(null);

  // Detail Modal State
  const [selectedAttempt, setSelectedAttempt] =
    useState<AssessmentAttempt | null>(null);
  const [selectedQuestionIdx, setSelectedQuestionIdx] = useState<number | null>(
    null,
  );

  // Skeleton Breathing Animation State
  const [skeletonOpacity] = useState(new Animated.Value(0.3));

  useEffect(() => {
    let anim: Animated.CompositeAnimation | null = null;
    if (loading) {
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(skeletonOpacity, {
            toValue: 0.8,
            duration: 850,
            useNativeDriver: true,
          }),
          Animated.timing(skeletonOpacity, {
            toValue: 0.3,
            duration: 850,
            useNativeDriver: true,
          }),
        ])
      );
      anim.start();
    }
    return () => {
      if (anim) anim.stop();
    };
  }, [loading, skeletonOpacity]);

  useEffect(() => {
    const onBackPress = () => {
      navigation.goBack();
      return true;
    };
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      onBackPress,
    );
    return () => subscription.remove();
  }, [navigation]);

  const loadData = useCallback(
    async (showLoadingIndicator = true) => {
      if (!userId) return;

      // Leverage global cache for instant load
      if (showLoadingIndicator) {
        if (reportsCache && reportsCache.userId === userId) {
          setGroupedHistory(reportsCache.groupedHistory);
          setLearningStyleData(reportsCache.learningStyleData);
          setLoading(false);
          // Sync silently in background
          loadData(false);
          return;
        }
        setLoading(true);
      }

      try {
        // 1. Fetch raw user employee assessments and learning style report
        const [rawAssessments, styleReport] = await Promise.all([
          getEmployeeAssessments(userId),
          companyUsesLearningStyle ? getLearningStyle(userId) : null,
        ]);

        const assessmentsList: AssessmentAttempt[] =
          rawAssessments?.data?.assessments ??
          rawAssessments?.assessments ??
          (Array.isArray(rawAssessments?.data) ? rawAssessments.data : []) ??
          [];

        setLearningStyleData(styleReport);

        if (assessmentsList.length === 0) {
          setGroupedHistory([]);
          setLoading(false);
          return;
        }

        // 2. Resolve unique assessment IDs and unique processed module IDs in parallel
        const assessmentIds = Array.from(
          new Set(assessmentsList.map((a) => a.assessment_id).filter(Boolean)),
        );

        const processedModuleIds = Array.from(
          new Set(
            assessmentsList
              .map((a) => a.assessments?.processed_module_id)
              .filter(Boolean)
              .map((id) => String(id)),
          ),
        );

        // Fetch details and modules in parallel
        const [batchRes, batchModulesRes] = await Promise.all([
          assessmentIds.length > 0 ? getAssessmentsBatch(userId, assessmentIds) : null,
          processedModuleIds.length > 0 ? getProcessedModulesBatch(userId, processedModuleIds) : null,
        ]);

        let assessmentDetailsMap: Record<string, any> = {};
        if (batchRes) {
          const batchData = batchRes?.data ?? [];
          batchData.forEach((item: any) => {
            const rawAssessment = item?.assessment ?? item;
            if (rawAssessment?.assessment_id) {
              assessmentDetailsMap[String(rawAssessment.assessment_id)] =
                rawAssessment;
            }
          });
        }

        let modulesMap: Record<string, any> = {};
        if (batchModulesRes) {
          const modulesData = batchModulesRes?.data ?? [];
          modulesData.forEach((m: any) => {
            if (m?.processed_module_id) {
              modulesMap[String(m.processed_module_id)] = m;
            }
          });
        }

        // 3. Enrich assessments and group by module
        const enrichedAssessments = assessmentsList.map((ea) => {
          const detail = assessmentDetailsMap[String(ea.assessment_id)];
          const pid = detail?.processed_module_id || ea.assessments?.processed_module_id;
          const moduleInfo = pid ? modulesMap[String(pid)] : null;

          const assessmentsObj = {
            ...ea.assessments,
            ...detail,
            module_title:
              moduleInfo?.title ||
              detail?.module_title ||
              ea.assessments?.module_title ||
              "Performance Module",
            original_module_id:
              moduleInfo?.original_module_id ||
              detail?.original_module_id ||
              ea.assessments?.original_module_id,
            parent_module_title:
              moduleInfo?.parent_module_title ||
              detail?.parent_module_title ||
              ea.assessments?.parent_module_title,
            type: detail?.type || ea.assessments?.type || "module",
          };

          // Pre-parse and cache the feedback sections and question feedback
          const rawFeedback = ea.feedback || detail?.feedback || "";
          const parsedFeedback = rawFeedback ? parseAIFeedback(rawFeedback) : [];
          
          const rawQuestionFeedback = ea.question_feedback || detail?.question_feedback || "";
          const totalQuestions = ea.max_score || detail?.max_score || 5;
          const parsedQuestions = rawQuestionFeedback 
            ? parseQuestionFeedback(rawQuestionFeedback, totalQuestions)
            : [];

          return {
            ...ea,
            assessments: assessmentsObj,
            parsedFeedback,
            parsedQuestions,
          };
        });

        const grouped = enrichedAssessments.reduce(
          (acc: Record<string, GroupedModule>, item) => {
            const moduleId =
              item.assessments?.original_module_id ||
              item.assessments?.processed_module_id ||
              item.assessment_id;

            if (!moduleId) return acc;

            if (!acc[moduleId]) {
              acc[moduleId] = {
                moduleId,
                moduleTitle:
                  item.assessments?.parent_module_title ||
                  item.assessments?.module_title ||
                  "Untitled Module",
                attempts: [],
              };
            }
            acc[moduleId].attempts.push(item);
            return acc;
          },
          {},
        );

        // Sort attempts inside each module: Baseline always first, otherwise order chronologically
        const finalGrouped = Object.values(grouped).map((group) => {
          const sortedAttempts = group.attempts.sort((a, b) => {
            if (a.assessments?.type === "baseline") return -1;
            if (b.assessments?.type === "baseline") return 1;
            const dateA = a.completed_at || a.created_at;
            const dateB = b.completed_at || b.created_at;
            return (
              new Date(dateB).getTime() -
              new Date(dateA).getTime()
            );
          });
          return {
            ...group,
            attempts: sortedAttempts,
          };
        });

        // Store in global in-memory cache
        reportsCache = {
          groupedHistory: finalGrouped,
          learningStyleData: styleReport,
          userId,
        };

        setGroupedHistory(finalGrouped);
      } catch (err) {
        console.error("[ReportsScreen] Error fetching reports:", err);
      } finally {
        setLoading(false);
      }
    },
    [userId, companyUsesLearningStyle],
  );

  useEffect(() => {
    loadData(true);
  }, [loadData]);

  // Listen for global real-time report refresh events
  useEffect(() => {
    const handleRefresh = () => {
      loadData(false);
    };
    eventBus.on("refresh_reports", handleRefresh);
    return () => {
      eventBus.off("refresh_reports", handleRefresh);
    };
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData(false);
    setRefreshing(false);
  }, [loadData]);

  // Collapsible toggle helpers
  const toggleModule = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedModules((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleLSSection = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedLSSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleReportSection = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedReportSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Memoized learning style cards
  const parsedLearningStyleSections = useMemo(() => {
    if (!learningStyleData?.gpt_analysis) return [];
    const cleanText = extractReportFromJson(learningStyleData.gpt_analysis);
    const tabs = parseReportIntoTabs(cleanText);

    const styleCode = learningStyleData.learning_style || "AS";
    const fallbackDescription = getLearningStyleInfo(styleCode).description;

    const sections = [
      {
        id: "natural",
        title: "Your Natural Learning Style",
        iconName: "brain" as const,
        accent: ["#EFF6FF", "#3B82F6", "#DBEAFE"], // bg, text, border
        paragraphs: [] as string[],
        bullets: [] as string[],
        subsections: [] as any[],
      },
      {
        id: "thrive",
        title: "How You Thrive",
        iconName: "lightning-bolt-outline" as const,
        accent: ["#FDF4FF", "#D946EF", "#F5D0FE"],
        paragraphs: [] as string[],
        bullets: [] as string[],
        subsections: [] as any[],
      },
      {
        id: "tips",
        title: "Tips to Make Learning Easier",
        iconName: "lightbulb-on-outline" as const,
        accent: ["#ECFDF5", "#10B981", "#A7F3D0"],
        paragraphs: [] as string[],
        bullets: [] as string[],
        subsections: [] as any[],
      },
    ];

    const pool = [...tabs];
    const takeTab = (keywords: string[], id: string) => {
      const idx = pool.findIndex(
        (t) =>
          keywords.some((k) => t.title.toLowerCase().includes(k)) ||
          t.id === id,
      );
      if (idx >= 0) return pool.splice(idx, 1)[0];
      return pool.shift();
    };

    sections.forEach((section) => {
      const tab = takeTab(
        [section.id, ...section.title.toLowerCase().split(" ")],
        section.id,
      );
      if (tab) {
        if (tab.content) {
          const introLines = tab.content.split("\n").filter(Boolean);
          section.paragraphs =
            introLines.length > 0 ? introLines : [fallbackDescription];
        } else if (!tab.subsections?.length) {
          section.paragraphs = [fallbackDescription];
        }
        if (tab.bullets?.length) {
          section.bullets = tab.bullets;
        }
        if (tab.subsections?.length) {
          section.subsections = tab.subsections;
        }
      }
      if (!section.paragraphs.length) {
        section.paragraphs.push(fallbackDescription);
      }
    });

    return sections;
  }, [learningStyleData]);

  // Memoized detailed quiz report content
  const activeReportDetails = useMemo(() => {
    if (!selectedAttempt) return null;
    return {
      sections: selectedAttempt.parsedFeedback || [],
      questions: selectedAttempt.parsedQuestions || [],
      rawFeedback: selectedAttempt.feedback || "",
    };
  }, [selectedAttempt]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color="#1E293B" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Sprint Reports</Text>
          <View style={{ width: 32 }} />
        </View>

        <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }}>
          {/* Tabs placeholder */}
          {/* <Animated.View style={[styles.skeletonTabsContainer, { opacity: skeletonOpacity }]}>
            <View style={styles.skeletonTab} />
            <View style={styles.skeletonTab} />
          </Animated.View> */}

          {/* Cards placeholder */}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
            {Array.from({ length: 8 }).map((_, idx) => (
              <View key={idx} style={styles.skeletonCard}>
                <View style={{ flex: 1 }}>
                  <Animated.View style={[styles.skeletonLineLong, { opacity: skeletonOpacity }]} />
                  <Animated.View style={[styles.skeletonLineShort, { opacity: skeletonOpacity }]} />
                </View>
                <Animated.View style={[styles.skeletonCircle, { opacity: skeletonOpacity }]} />
              </View>
            ))}
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  }

  const renderEmptyState = () => (
    <ScrollView
      contentContainerStyle={styles.emptyContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.emptyIconCircle}>
        <MaterialCommunityIcons
          name="clipboard-text-outline"
          size={48}
          color="#94A3B8"
        />
      </View>
      <Text style={styles.emptyTitle}>No Reports Available Yet</Text>
      <Text style={styles.emptySubtitle}>
        Once you complete training modules, your detailed
        analysis reports will be published here.
      </Text>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sprint Reports</Text>
        <View style={{ width: 32 }} />
      </View>

      {groupedHistory.length === 0 && !learningStyleData ? (
        renderEmptyState()
      ) : (
        <View style={{ flex: 1 }}>
          {/* TAB BAR */}
          {companyUsesLearningStyle && learningStyleData && (
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[
                  styles.tabButton,
                  activeTab === "history" && styles.tabButtonActive,
                ]}
                onPress={() => {
                  LayoutAnimation.configureNext(
                    LayoutAnimation.Presets.easeInEaseOut,
                  );
                  setActiveTab("history");
                }}
              >
                <MaterialCommunityIcons
                  name="trending-up"
                  size={18}
                  color={activeTab === "history" ? "#FFFFFF" : "#64748B"}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.tabButtonText,
                    activeTab === "history" && styles.tabButtonTextActive,
                  ]}
                >
                  Growth History
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.tabButton,
                  activeTab === "style" && styles.tabButtonActive,
                ]}
                onPress={() => {
                  LayoutAnimation.configureNext(
                    LayoutAnimation.Presets.easeInEaseOut,
                  );
                  setActiveTab("style");
                }}
              >
                <MaterialCommunityIcons
                  name="brain"
                  size={18}
                  color={activeTab === "style" ? "#FFFFFF" : "#64748B"}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.tabButtonText,
                    activeTab === "style" && styles.tabButtonTextActive,
                  ]}
                >
                  Learning Profile
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* CONTENT */}
          {activeTab === "history" ? (
            <FlatList
              data={groupedHistory}
              keyExtractor={(item) => item.moduleId}
              contentContainerStyle={styles.listContent}
              initialNumToRender={5}
              maxToRenderPerBatch={10}
              windowSize={5}
              removeClippedSubviews={Platform.OS === "android"}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
              renderItem={({ item }) => (
                <ModuleCardItem
                  item={item}
                  isExpanded={!!expandedModules[item.moduleId]}
                  onToggle={() => toggleModule(item.moduleId)}
                  onSelectAttempt={setSelectedAttempt}
                />
              )}
            />
          ) : (
            <ScrollView
              contentContainerStyle={styles.styleContent}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
            >
              {/* PRIMARY STYLE HEADER */}
              <View style={styles.styleHeroCard}>
                <View style={styles.styleBadgeCircle}>
                  <MaterialCommunityIcons name="brain" size={32} color="#6366F1" />
                </View>
                <Text style={styles.styleHeroTitle}>Dominant Style</Text>
                <Text style={styles.styleHeroName}>
                  {
                    getLearningStyleInfo(learningStyleData?.learning_style)
                      .label
                  }
                </Text>
                <Text style={styles.styleHeroDesc}>
                  {
                    getLearningStyleInfo(learningStyleData?.learning_style)
                      .description
                  }
                </Text>
              </View>

              {/* DETAIL ACCORDIONS */}
              {parsedLearningStyleSections.map((section) => {
                const isSectionExpanded = !!expandedLSSections[section.id];
                const [bgColor, textColor, borderColor] = section.accent;

                return (
                  <View
                    key={section.id}
                    style={[
                      styles.sectionCard,
                      { borderColor: isSectionExpanded ? borderColor : "#E2E8F0" },
                    ]}
                  >
                    <TouchableOpacity
                      style={[
                        styles.sectionHeader,
                        { backgroundColor: isSectionExpanded ? bgColor : "#FFFFFF" },
                      ]}
                      onPress={() => toggleLSSection(section.id)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.sectionHeaderLeft}>
                        <MaterialCommunityIcons
                          name={section.iconName}
                          size={22}
                          color={textColor}
                          style={{ marginRight: 8 }}
                        />
                        <Text style={[styles.sectionTitleText, { color: "#1E293B" }]}>
                          {section.title}
                        </Text>
                      </View>
                      <MaterialCommunityIcons
                        name={isSectionExpanded ? "chevron-up" : "chevron-down"}
                        size={20}
                        color="#64748B"
                      />
                    </TouchableOpacity>

                    {isSectionExpanded && (
                      <View style={styles.sectionBody}>
                        {/* Paragraphs */}
                        {section.paragraphs.map((p, idx) => (
                          <Text key={idx} style={styles.sectionParagraph}>
                            {p}
                          </Text>
                        ))}

                        {/* Bullets */}
                        {section.bullets.length > 0 && (
                          <View style={styles.bulletsList}>
                            {section.bullets.map((b, idx) => (
                              <View key={idx} style={styles.bulletItem}>
                                <Text style={[styles.bulletPoint, { color: textColor }]}>
                                  •
                                </Text>
                                <Text style={styles.bulletText}>{b}</Text>
                              </View>
                            ))}
                          </View>
                        )}

                        {/* Subsections */}
                        {section.subsections.length > 0 && (
                          <View style={styles.subsectionsList}>
                            {section.subsections.map((sub: any, subIdx: number) => (
                              <View
                                key={subIdx}
                                style={styles.subsectionContainer}
                              >
                                <Text style={styles.subsectionTitle}>
                                  {sub.subtitle}
                                </Text>
                                {sub.items?.map((item: string, itemIdx: number) => (
                                  <View key={itemIdx} style={styles.bulletItem}>
                                    <Text style={[styles.bulletPoint, { color: textColor }]}>
                                      -
                                    </Text>
                                    <Text style={styles.bulletText}>{item}</Text>
                                  </View>
                                ))}
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}

      {/* ATTEMPT DETAILED REPORT MODAL */}
      {selectedAttempt && activeReportDetails && (() => {
        const rawQuestions = selectedAttempt.assessments?.questions;
        let questionsArray: any[] = [];
        if (rawQuestions) {
          try {
            questionsArray = typeof rawQuestions === "string"
              ? JSON.parse(rawQuestions)
              : rawQuestions;
          } catch (e) {
            console.warn("Error parsing questions in ReportsScreen:", e);
          }
        }
        const questionObj =
          selectedQuestionIdx !== null ? questionsArray[selectedQuestionIdx] : null;

        let userAnswersArray: any[] = [];
        if (selectedAttempt.answers) {
          try {
            userAnswersArray = typeof selectedAttempt.answers === "string"
              ? JSON.parse(selectedAttempt.answers)
              : selectedAttempt.answers;
          } catch (e) {
            console.warn("Error parsing answers in ReportsScreen:", e);
          }
        }
        const chosenVal =
          selectedQuestionIdx !== null ? userAnswersArray[selectedQuestionIdx] : null;
        let chosenIndex = -1;
        if (questionObj) {
          if (typeof chosenVal === "number") {
            chosenIndex = chosenVal;
          } else if (typeof chosenVal === "string" && questionObj.options) {
            chosenIndex = questionObj.options.indexOf(chosenVal);
            if (chosenIndex === -1) {
              const letters = ["A", "B", "C", "D"];
              chosenIndex = letters.indexOf(chosenVal.toUpperCase());
            }
          }
        }

        return (
          <Modal
            visible={true}
            animationType="slide"
            onRequestClose={() => {
              setSelectedAttempt(null);
              setSelectedQuestionIdx(null);
            }}
          >
            <SafeAreaView style={styles.modalSafeArea} edges={["top"]}>
              {/* MODAL HEADER */}
              <View style={styles.modalHeader}>
                <TouchableOpacity
                  style={styles.modalBackBtn}
                  onPress={() => {
                    setSelectedAttempt(null);
                    setSelectedQuestionIdx(null);
                  }}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="close" size={24} color="#1E293B" />
                </TouchableOpacity>
                <View style={styles.modalTitleContainer}>
                  <Text style={styles.modalTitle}>
                    {selectedAttempt.assessments?.type === "baseline"
                      ? "Baseline Assessment"
                      : "Module Quiz"}
                  </Text>
                  <Text style={styles.modalSubtitle}>Detailed Report</Text>
                </View>
                <View style={{ width: 40 }} />
              </View>

              <ScrollView
                contentContainerStyle={styles.modalContent}
                showsVerticalScrollIndicator={false}
              >
                {/* SCORE BANNER */}
                <View style={styles.scoreBanner}>
                  <Text style={styles.scoreBannerModuleTitle}>
                    {selectedAttempt.assessments?.module_title || "Performance Module"}
                  </Text>
                  <View style={styles.scorePill}>
                    <Text style={styles.scoreText}>
                      {selectedAttempt.score} /{" "}
                      {selectedAttempt.max_score || 5}
                    </Text>
                    <Text style={styles.scoreLabel}>Correct answers</Text>
                  </View>
                  <View style={styles.dateLabelContainer}>
                    <Text style={styles.attemptDateText}>
                      Attempted on{" "}
                      {new Date(
                        selectedAttempt.completed_at || selectedAttempt.created_at,
                      ).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </Text>
                  </View>
                </View>

                {/* QUESTIONS GRID SECTION */}
                {activeReportDetails.questions.length > 0 && (
                  <View style={styles.cardContainer}>
                    <Text style={styles.cardSectionTitle}>Question Grid</Text>
                    <Text style={styles.cardSectionSubtitle}>
                      Tap questions to review stems, options, selected and correct answers
                    </Text>
                    <View style={styles.questionsGrid}>
                      {activeReportDetails.questions.map((q: any, idx: number) => {
                        const isCorrect = q.status === "Correct";
                        const isSelected = selectedQuestionIdx === idx;
                        const boxColor = isCorrect
                          ? "#10B981" // emerald-500
                          : "#EF4444"; // red-500

                        return (
                          <TouchableOpacity
                            key={idx}
                            style={[
                              styles.questionBox,
                              {
                                backgroundColor: boxColor,
                                borderWidth: isSelected ? 3 : 0,
                                borderColor: "#1E293B",
                              },
                            ]}
                            activeOpacity={0.7}
                            onPress={() => {
                              LayoutAnimation.configureNext(
                                LayoutAnimation.Presets.easeInEaseOut,
                              );
                              if (isSelected) setSelectedQuestionIdx(null);
                              else setSelectedQuestionIdx(idx);
                            }}
                          >
                            <Text style={styles.questionBoxText}>{idx + 1}</Text>
                            <MaterialCommunityIcons
                              name={isCorrect ? "check" : "close"}
                              size={12}
                              color="#FFFFFF"
                              style={styles.questionBoxIcon}
                            />
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* QUESTION DETAIL REVIEW */}
                    {selectedQuestionIdx !== null && (
                      <View style={styles.reviewQuestionCard}>
                        {questionObj ? (
                          <>
                            <View style={styles.reviewQuestionHeader}>
                              <Text style={styles.reviewQNumText}>
                                QUESTION {selectedQuestionIdx + 1}
                              </Text>
                              <View
                                style={[
                                  styles.attemptPill,
                                  {
                                    backgroundColor:
                                      activeReportDetails.questions[selectedQuestionIdx]?.status === "Correct"
                                        ? "#ECFDF5"
                                        : "#FFF5F5",
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.attemptPillText,
                                    {
                                      color:
                                        activeReportDetails.questions[selectedQuestionIdx]?.status === "Correct"
                                          ? "#10B981"
                                          : "#EF4444",
                                    },
                                  ]}
                                >
                                  {activeReportDetails.questions[selectedQuestionIdx]?.status}
                                </Text>
                              </View>
                            </View>

                            <Text style={styles.reviewQuestionText}>
                              {questionObj.question}
                            </Text>

                            <View style={{ gap: 8, marginBottom: 12 }}>
                              {questionObj.options?.map((option: string, optIdx: number) => {
                                const isCorrectOpt = optIdx === questionObj.correctIndex;
                                const isUserSelected = optIdx === chosenIndex;

                                let rowBg = "#FFFFFF";
                                let rowBorderColor = "#E2E8F0";
                                let badgeText = "";
                                let iconName = "";
                                let iconColor = "";

                                if (isCorrectOpt) {
                                  rowBg = "#ECFDF5"; // soft green
                                  rowBorderColor = "#10B981"; // emerald-500
                                  iconName = "check-circle";
                                  iconColor = "#10B981";
                                  if (isUserSelected) {
                                    badgeText = "Correct & Your Answer";
                                  } else {
                                    badgeText = "Correct Answer";
                                  }
                                } else if (isUserSelected && !isCorrectOpt) {
                                  rowBg = "#FFF5F5"; // soft red
                                  rowBorderColor = "#EF4444"; // red-500
                                  iconName = "close-circle";
                                  iconColor = "#EF4444";
                                  badgeText = "Your Answer";
                                }

                                return (
                                  <View
                                    key={optIdx}
                                    style={[
                                      styles.reviewOptionRow,
                                      {
                                        backgroundColor: rowBg,
                                        borderColor: rowBorderColor,
                                      },
                                    ]}
                                  >
                                    <View style={{ flex: 1, paddingRight: 8 }}>
                                      <Text style={{ fontSize: 13, color: "#1E293B", fontWeight: isUserSelected ? "700" : "500" }}>
                                        {String.fromCharCode(65 + optIdx)}. {option}
                                      </Text>
                                      {badgeText !== "" && (
                                        <Text style={{ fontSize: 10, fontWeight: "800", color: iconColor, marginTop: 4 }}>
                                          {badgeText.toUpperCase()}
                                        </Text>
                                      )}
                                    </View>
                                    {iconName !== "" && (
                                      <MaterialCommunityIcons name={iconName as any} size={18} color={iconColor} />
                                    )}
                                  </View>
                                );
                              })}
                            </View>

                            {/* Custom explanation */}
                            {(questionObj.explanation || activeReportDetails.questions[selectedQuestionIdx]?.explanation) && (
                              <View style={styles.explanationCard}>
                                <View style={styles.explanationHeader}>
                                  <MaterialCommunityIcons name="lightbulb-on-outline" size={16} color="#6366F1" />
                                  <Text style={styles.explanationTitle}>COACHING EXPLANATION</Text>
                                </View>
                                <Text style={styles.explanationText}>
                                  {questionObj.explanation || activeReportDetails.questions[selectedQuestionIdx]?.explanation}
                                </Text>
                              </View>
                            )}
                          </>
                        ) : (
                          <View style={styles.explanationCard}>
                            <View style={styles.explanationHeader}>
                              <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#EF4444" />
                              <Text style={styles.explanationTitle}>Coaching Explanation</Text>
                            </View>
                            <Text style={styles.explanationText}>
                              {activeReportDetails.questions[selectedQuestionIdx]?.explanation ||
                                (activeReportDetails.questions[selectedQuestionIdx]?.status === "Correct"
                                  ? "Correct Answer."
                                  : "Incorrect Answer.")}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                )}

                {/* AI DETAILED FEEDBACK SECTION */}
                <View style={{ marginTop: 24, paddingHorizontal: 16 }}>
                  <Text style={styles.cardSectionTitle}>
                    AI Detailed Coaching Feedback
                  </Text>
                  <Text style={styles.cardSectionSubtitle}>
                    Tap sections to read progress details and action items
                  </Text>

                  {activeReportDetails.sections.length === 0 ? (
                    <View style={styles.cardContainerNoMargin}>
                      <FormattedMarkdownText text={activeReportDetails.rawFeedback} />
                    </View>
                  ) : (
                    <View style={{ marginTop: 8, gap: 10 }}>
                      {activeReportDetails.sections.map((section: any, idx: number) => {
                        const isSecExpanded =
                          !!expandedReportSections[`section-${idx}`];

                        let sectionColor = "#3B82F6"; // default blue
                        let sectionBg = "#EFF6FF"; // blue bg
                        let sectionBorder = "#DBEAFE"; // blue border

                        if (section.type === "success") {
                          sectionColor = "#10B981"; // emerald-500
                          sectionBg = "#F0FDF4"; // green bg
                          sectionBorder = "#DCFCE7";
                        } else if (section.type === "warning") {
                          sectionColor = "#EF4444"; // red-500
                          sectionBg = "#FFF5F5"; // red bg
                          sectionBorder = "#FEE2E2";
                        } else if (section.type === "info") {
                          sectionColor = "#6366F1"; // indigo
                          sectionBg = "#F5F3FF"; // purple bg
                          sectionBorder = "#EDE9FE";
                        } else if (section.type === "neutral") {
                          sectionColor = "#475569"; // slate-600
                          sectionBg = "#F8FAFC"; // slate bg
                          sectionBorder = "#E2E8F0";
                        }

                        return (
                          <View
                            key={idx}
                            style={[
                              styles.sectionCard,
                              {
                                borderColor: isSecExpanded
                                  ? sectionBorder
                                  : "#E2E8F0",
                              },
                            ]}
                          >
                            <TouchableOpacity
                              style={[
                                styles.sectionHeader,
                                { backgroundColor: isSecExpanded ? sectionBg : "#FFFFFF" },
                              ]}
                              onPress={() => toggleReportSection(`section-${idx}`)}
                              activeOpacity={0.8}
                            >
                              <View style={styles.sectionHeaderLeft}>
                                <MaterialCommunityIcons
                                  name={section.iconName as any}
                                  size={20}
                                  color={sectionColor}
                                  style={{ marginRight: 8 }}
                                />
                                <Text
                                  style={[
                                    styles.sectionTitleText,
                                    { color: "#1E293B" },
                                  ]}
                                >
                                  {section.title}
                                </Text>
                              </View>
                              <MaterialCommunityIcons
                                name={isSecExpanded ? "chevron-up" : "chevron-down"}
                                size={18}
                                color="#64748B"
                              />
                            </TouchableOpacity>

                            {isSecExpanded && (
                              <View style={styles.sectionBody}>
                                <FormattedMarkdownText
                                  text={section.content}
                                  textColor="#475569"
                                />
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              </ScrollView>
            </SafeAreaView>
          </Modal>
        );
      })()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    // elevation: 2,
    // shadowColor: "#0F172A",
    // shadowOffset: { width: 0, height: 2 },
    // shadowOpacity: 0.05,
    // shadowRadius: 3,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  loaderText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingVertical: 80,
  },
  emptyIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#E2E8F0",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1E293B",
    textAlign: "center",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#64748B",
    textAlign: "center",
    lineHeight: 20,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#E2E8F0",
    padding: 4,
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 16,
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: "#6366F1",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
  },
  tabButtonTextActive: {
    color: "#FFFFFF",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  moduleCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginTop: 12,
    overflow: "hidden",
    // elevation: 1,
    // shadowColor: "#0F172A",
    // shadowOffset: { width: 0, height: 1 },
    // shadowOpacity: 0.03,
    // shadowRadius: 3,
  },
  moduleHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  moduleTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1E293B",
    lineHeight: 22,
  },
  moduleSubtitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94A3B8",
    marginTop: 4,
  },
  moduleDetails: {
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    backgroundColor: "#F8FAFC",
  },
  attemptRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  attemptDetails: {
    flex: 1,
  },
  attemptTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155",
  },
  attemptDate: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 2,
  },
  attemptRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  attemptPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  attemptPillText: {
    fontSize: 12,
    fontWeight: "800",
  },
  styleContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  styleHeroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 20,
    elevation: 2,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  styleBadgeCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  styleHeroTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  styleHeroName: {
    fontSize: 22,
    fontWeight: "900",
    color: "#6366F1",
    marginVertical: 4,
  },
  styleHeroDesc: {
    fontSize: 13,
    fontWeight: "500",
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
    marginTop: 6,
  },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 12,
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  sectionTitleText: {
    fontSize: 14,
    fontWeight: "700",
  },
  sectionBody: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    backgroundColor: "#FFFFFF",
  },
  sectionParagraph: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 19,
    marginBottom: 10,
  },
  bulletsList: {
    marginTop: 4,
  },
  bulletItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  bulletPoint: {
    fontSize: 16,
    marginRight: 8,
    lineHeight: 18,
  },
  bulletText: {
    flex: 1,
    fontSize: 13,
    color: "#475569",
    lineHeight: 18,
  },
  subsectionsList: {
    marginTop: 8,
  },
  subsectionContainer: {
    marginBottom: 16,
  },
  subsectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1E293B",
    marginBottom: 6,
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  modalBackBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  modalTitleContainer: {
    flex: 1,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  modalSubtitle: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94A3B8",
    marginTop: 2,
  },
  modalContent: {
    paddingBottom: 48,
  },
  scoreBanner: {
    backgroundColor: "#EEF2FF",
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  scoreBannerModuleTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1E293B",
    textAlign: "center",
    marginBottom: 16,
    paddingHorizontal: 12,
    lineHeight: 22,
  },
  scorePill: {
    alignItems: "center",
  },
  scoreText: {
    fontSize: 32,
    fontWeight: "900",
    color: "#6366F1",
  },
  scoreLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6366F1",
    marginTop: 2,
  },
  dateLabelContainer: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  attemptDateText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
  },
  cardContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginHorizontal: 16,
    marginTop: 20,
    padding: 16,
    elevation: 1,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
  },
  cardSectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1E293B",
  },
  cardSectionSubtitle: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 2,
    marginBottom: 14,
  },
  questionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "flex-start",
  },
  questionBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  questionBoxText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  questionBoxIcon: {
    position: "absolute",
    bottom: 2,
    right: 2,
  },
  explanationCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    marginTop: 16,
  },
  explanationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  explanationTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1E293B",
  },
  explanationText: {
    fontSize: 12,
    color: "#475569",
    lineHeight: 17,
  },
  fallbackFeedbackText: {
    fontSize: 13,
    color: "#334155",
    lineHeight: 20,
  },
  feedbackSectionBodyText: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 19,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 4,
    paddingLeft: 4,
  },
  bulletDot: {
    fontSize: 14,
    fontWeight: "900",
    marginRight: 8,
    lineHeight: 18,
  },
  paragraphText: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 4,
  },
  visualSectionCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderLeftWidth: 5,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  visualSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  visualSectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  visualSectionTitleText: {
    fontSize: 15,
    fontWeight: "800",
  },
  visualSectionBody: {
    paddingLeft: 4,
  },
  cardContainerNoMargin: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    marginTop: 8,
  },
  reviewQuestionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  reviewQuestionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  reviewQNumText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#94A3B8",
    letterSpacing: 0.8,
  },
  reviewQuestionText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E293B",
    lineHeight: 20,
    marginBottom: 16,
  },
  reviewOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    padding: 12,
    gap: 10,
    marginBottom: 6,
  },
  skeletonTabsContainer: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
    height: 44,
    alignItems: "center",
  },
  skeletonTab: {
    flex: 1,
    height: 36,
    backgroundColor: "#E2E8F0",
    borderRadius: 10,
    marginHorizontal: 2,
  },
  skeletonCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  skeletonLineLong: {
    height: 16,
    backgroundColor: "#E2E8F0",
    borderRadius: 8,
    width: "75%",
    marginBottom: 8,
  },
  skeletonLineShort: {
    height: 12,
    backgroundColor: "#E2E8F0",
    borderRadius: 6,
    width: "40%",
  },
  skeletonCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#E2E8F0",
  },
});
