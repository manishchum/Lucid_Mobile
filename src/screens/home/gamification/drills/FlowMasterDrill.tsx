import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface DrillProps {
  drillData: any;
  isCompleted: boolean;
  earnedXp?: number;
  onComplete: (wrong_attempts: number, completion_time_seconds: number) => void;
}

interface StepItem {
  id: number;
  text: string;
}

export default function FlowMasterDrill({
  drillData,
  isCompleted,
  earnedXp,
  onComplete,
}: DrillProps) {
  const [startTime] = useState(Date.now());
  const [wrongAttempts, setWrongAttempts] = useState(0);

  // Extract process flow steps robustly
  const rawSteps = Array.isArray(drillData?.steps)
    ? drillData.steps
    : Array.isArray(drillData?.sequence)
    ? drillData.sequence
    : Array.isArray(drillData?.process)
    ? drillData.process
    : [];

  const initialSteps: StepItem[] = rawSteps.map((s: any, idx: number) => ({
    id: idx,
    text:
      typeof s === "string"
        ? s
        : s?.text || s?.step || s?.description || s?.title || `Step ${idx + 1}`,
  }));

  const [availableSteps, setAvailableSteps] = useState<StepItem[]>(() => {
    if (isCompleted) return [];
    return [...initialSteps].sort(() => Math.random() - 0.5);
  });

  const [flow, setFlow] = useState<StepItem[]>(() => {
    if (isCompleted) return [...initialSteps];
    return [];
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Sync completion state
  useEffect(() => {
    if (isCompleted) {
      setFlow([...initialSteps]);
      setAvailableSteps([]);
    }
  }, [isCompleted, initialSteps.length]);

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 7, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -7, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 5, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -5, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();
  };

  const handleSelect = (step: StepItem) => {
    if (isCompleted) return;
    setErrorMessage(null);
    setAvailableSteps((prev) => prev.filter((s) => s.id !== step.id));
    setFlow((prev) => [...prev, step]);
  };

  const handleRemove = (step: StepItem) => {
    if (isCompleted) return;
    setErrorMessage(null);
    setFlow((prev) => prev.filter((s) => s.id !== step.id));
    setAvailableSteps((prev) => [...prev, step]);
  };

  const handleReset = () => {
    if (isCompleted) return;
    setErrorMessage(null);
    setAvailableSteps([...initialSteps].sort(() => Math.random() - 0.5));
    setFlow([]);
  };

  const handleSubmit = () => {
    if (isCompleted) return;
    if (flow.length < initialSteps.length) {
      setErrorMessage("Please complete the entire flowchart before submitting.");
      triggerShake();
      return;
    }

    let isCorrect = true;
    for (let i = 0; i < initialSteps.length; i++) {
      if (flow[i]?.id !== initialSteps[i]?.id) {
        isCorrect = false;
        break;
      }
    }

    if (isCorrect) {
      const elapsed = Math.max(1, Math.floor((Date.now() - startTime) / 1000));
      onComplete(wrongAttempts, elapsed);
    } else {
      setWrongAttempts((p) => p + 1);
      setErrorMessage("Process flow is out of order. Tap any step to remove and reorder!");
      triggerShake();
      setTimeout(() => setErrorMessage(null), 3500);
    }
  };

  if (initialSteps.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <MaterialCommunityIcons name="alert-circle-outline" size={24} color="#F59E0B" />
        <Text style={styles.emptyCardText}>No process steps available for this drill.</Text>
      </View>
    );
  }

  const placedCount = flow.length;
  const totalCount = initialSteps.length;
  const isAllPlaced = placedCount === totalCount;

  return (
    <View style={styles.container}>
      {/* Top Header & Progress Card */}
      <View style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <View style={styles.progressTitleGroup}>
            <MaterialCommunityIcons
              name="sitemap"
              size={16}
              color={isCompleted ? "#10B981" : "#06B6D4"}
            />
            <Text style={styles.progressLabel} numberOfLines={1}>
              {isCompleted ? "Flow Verified" : "Build Process Flow"}
            </Text>
          </View>

          <View style={styles.progressRightRow}>
            {!isCompleted && placedCount > 0 && (
              <TouchableOpacity
                onPress={handleReset}
                style={styles.resetBtn}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="restart" size={13} color="#CBD5E1" />
                <Text style={styles.resetBtnText}>Reset</Text>
              </TouchableOpacity>
            )}

            <View
              style={[
                styles.progressCounterPill,
                isAllPlaced && styles.progressCounterPillCompleted,
              ]}
            >
              <MaterialCommunityIcons
                name={isAllPlaced ? "check-circle" : "source-branch"}
                size={13}
                color={isAllPlaced ? "#10B981" : "#06B6D4"}
              />
              <Text
                style={[
                  styles.progressCounterText,
                  isAllPlaced && styles.progressCounterTextCompleted,
                ]}
              >
                {placedCount}/{totalCount}
              </Text>
            </View>
          </View>
        </View>

        {/* Dynamic Instructional Guidance */}
        <Text style={[styles.hintText, errorMessage ? styles.hintTextError : null]}>
          {errorMessage ||
            (isCompleted
              ? "All process flow nodes assembled accurately!"
              : isAllPlaced
              ? "Flow complete! Tap 'Verify Flow' to test your pipeline."
              : "Tap available steps below in chronological sequence.")}
        </Text>
      </View>

      {/* Target Flowchart Pipeline Card with Shake on Error */}
      <Animated.View
        style={[
          styles.flowCard,
          errorMessage ? styles.flowCardError : null,
          { transform: [{ translateX: shakeAnim }] },
        ]}
      >
        <View style={styles.flowHeaderRow}>
          <MaterialCommunityIcons
            name="transit-connection-variant"
            size={16}
            color={isCompleted ? "#10B981" : "#06B6D4"}
          />
          <Text style={styles.flowHeaderLabel}>PROCESS PIPELINE</Text>
        </View>

        {flow.length === 0 ? (
          <View style={styles.placeholderBox}>
            <MaterialCommunityIcons
              name="sitemap-outline"
              size={28}
              color="rgba(6, 182, 212, 0.4)"
            />
            <Text style={styles.placeholderTitle}>Pipeline is empty</Text>
            <Text style={styles.placeholderSubtitle}>
              Tap steps from the pool below to assemble the flowchart
            </Text>
          </View>
        ) : (
          <View style={styles.flowList}>
            {flow.map((step, idx) => {
              const isLast = idx === flow.length - 1;

              return (
                <View key={`flow-node-${step.id}`} style={styles.flowNodeWrap}>
                  {/* Node Card */}
                  <TouchableOpacity
                    style={[
                      styles.flowNode,
                      isCompleted && styles.flowNodeCompleted,
                    ]}
                    disabled={isCompleted}
                    onPress={() => handleRemove(step)}
                    activeOpacity={0.78}
                  >
                    {/* Step Number Circle */}
                    <View
                      style={[
                        styles.nodeBadge,
                        isCompleted && styles.nodeBadgeCompleted,
                      ]}
                    >
                      <Text style={styles.nodeBadgeNumber}>{idx + 1}</Text>
                    </View>

                    {/* Step Text (No Truncation) */}
                    <Text
                      style={[
                        styles.flowText,
                        isCompleted && styles.flowTextCompleted,
                      ]}
                    >
                      {step.text}
                    </Text>

                    {/* Action Icon */}
                    {!isCompleted && (
                      <View style={styles.removeCircle}>
                        <MaterialCommunityIcons
                          name="close"
                          size={13}
                          color="#94A3B8"
                        />
                      </View>
                    )}
                    {isCompleted && (
                      <MaterialCommunityIcons
                        name="check-circle"
                        size={16}
                        color="#10B981"
                      />
                    )}
                  </TouchableOpacity>

                  {/* Flow Connector Arrow */}
                  {!isLast && (
                    <View style={styles.connectorWrap}>
                      <View style={styles.connectorLine} />
                      <View
                        style={[
                          styles.connectorArrowCircle,
                          isCompleted && styles.connectorArrowCircleCompleted,
                        ]}
                      >
                        <MaterialCommunityIcons
                          name="chevron-down"
                          size={15}
                          color={isCompleted ? "#10B981" : "#06B6D4"}
                        />
                      </View>
                      <View style={styles.connectorLine} />
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </Animated.View>

      {/* Available Steps Pool */}
      {!isCompleted && availableSteps.length > 0 && (
        <View style={styles.availableSection}>
          <View style={styles.availableHeaderRow}>
            <MaterialCommunityIcons name="layers-outline" size={14} color="#06B6D4" />
            <Text style={styles.availableHeaderLabel}>
              AVAILABLE STEPS • TAP TO ADD ({availableSteps.length})
            </Text>
          </View>

          <View style={styles.availableList}>
            {availableSteps.map((step) => (
              <TouchableOpacity
                key={`av-${step.id}`}
                style={styles.availableCard}
                onPress={() => handleSelect(step)}
                activeOpacity={0.75}
              >
                <View style={styles.availableCardInner}>
                  <View style={styles.addIconCircle}>
                    <MaterialCommunityIcons name="plus" size={14} color="#06B6D4" />
                  </View>
                  <Text style={styles.availableText}>{step.text}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Submit / Completed Action */}
      {isCompleted ? (
        <View style={styles.completedNotice}>
          <MaterialCommunityIcons name="check-circle" size={18} color="#10B981" />
          <Text style={styles.completedNoticeText}>
            Drill Completed • {initialSteps.length}-step flowchart verified (+{earnedXp || 0} XP)
          </Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[
            styles.submitBtn,
            !isAllPlaced && styles.submitBtnDisabled,
          ]}
          disabled={!isAllPlaced}
          onPress={handleSubmit}
          activeOpacity={0.82}
        >
          <MaterialCommunityIcons
            name={isAllPlaced ? "check-network-outline" : "lock-clock"}
            size={18}
            color={isAllPlaced ? "#FFFFFF" : "#64748B"}
          />
          <Text
            style={[
              styles.submitBtnText,
              !isAllPlaced && styles.submitBtnTextDisabled,
            ]}
          >
            {isAllPlaced
              ? "Verify Flow"
              : `Complete Flowchart (${placedCount}/${totalCount})`}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 24,
    gap: 16,
  },

  // Empty Card
  emptyCard: {
    backgroundColor: "#252532",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  emptyCardText: {
    color: "#94A3B8",
    fontSize: 14,
    textAlign: "center",
  },

  // Progress Card
  progressCard: {
    backgroundColor: "#242430",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    gap: 10,
  },
  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    flexShrink: 1,
    marginRight: 8,
  },
  progressLabel: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  progressRightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  resetBtnText: {
    color: "#CBD5E1",
    fontSize: 11,
    fontWeight: "700",
  },
  progressCounterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(6, 182, 212, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(6, 182, 212, 0.28)",
  },
  progressCounterPillCompleted: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  progressCounterText: {
    color: "#06B6D4",
    fontSize: 12,
    fontWeight: "900",
  },
  progressCounterTextCompleted: {
    color: "#10B981",
  },
  hintText: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 16,
  },
  hintTextError: {
    color: "#F87171",
  },

  // Flowchart Pipeline Card
  flowCard: {
    backgroundColor: "#242430",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.08)",
    gap: 12,
    minHeight: 140,
  },
  flowCardError: {
    borderColor: "#EF4444",
    backgroundColor: "rgba(239, 68, 68, 0.08)",
  },
  flowHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  flowHeaderLabel: {
    color: "#94A3B8",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
  },

  // Empty State Placeholder
  placeholderBox: {
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderStyle: "dashed",
    borderRadius: 12,
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  placeholderTitle: {
    color: "#CBD5E1",
    fontSize: 13,
    fontWeight: "700",
  },
  placeholderSubtitle: {
    color: "#64748B",
    fontSize: 11.5,
    textAlign: "center",
  },

  // Flow List & Nodes
  flowList: {
    gap: 0,
  },
  flowNodeWrap: {
    alignItems: "center",
  },
  flowNode: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#16333D",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: "rgba(6, 182, 212, 0.35)",
    gap: 10,
  },
  flowNodeCompleted: {
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  nodeBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#06B6D4",
    alignItems: "center",
    justifyContent: "center",
  },
  nodeBadgeCompleted: {
    backgroundColor: "#10B981",
  },
  nodeBadgeNumber: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
  },
  flowText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
    flex: 1,
  },
  flowTextCompleted: {
    color: "#E2E8F0",
  },
  removeCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Connector Arrows
  connectorWrap: {
    alignItems: "center",
    marginVertical: 4,
    gap: 2,
  },
  connectorLine: {
    width: 2,
    height: 6,
    backgroundColor: "rgba(6, 182, 212, 0.3)",
  },
  connectorArrowCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(6, 182, 212, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(6, 182, 212, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  connectorArrowCircleCompleted: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderColor: "rgba(16, 185, 129, 0.3)",
  },

  // Available Section
  availableSection: {
    gap: 10,
  },
  availableHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 2,
  },
  availableHeaderLabel: {
    color: "#94A3B8",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  availableList: {
    gap: 8,
  },
  availableCard: {
    backgroundColor: "#242430",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  availableCardInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  addIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(6, 182, 212, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(6, 182, 212, 0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  availableText: {
    color: "#E2E8F0",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
    flex: 1,
  },

  // Submit Button
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#0891B2",
    borderRadius: 14,
    paddingVertical: 15,
    shadowColor: "#0891B2",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  submitBtnDisabled: {
    backgroundColor: "#242430",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  submitBtnTextDisabled: {
    color: "#64748B",
  },

  // Completed Banner
  completedNotice: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.25)",
  },
  completedNoticeText: {
    color: "#10B981",
    fontSize: 13,
    fontWeight: "700",
  },
});
