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

export default function CodeBreakerDrill({
  drillData,
  isCompleted,
  earnedXp,
  onComplete,
}: DrillProps) {
  const [startTime] = useState(Date.now());
  const [wrongAttempts, setWrongAttempts] = useState(0);

  // Extract sequence items robustly
  const rawSequence = Array.isArray(drillData?.sequence)
    ? drillData.sequence
    : Array.isArray(drillData?.steps)
    ? drillData.steps
    : Array.isArray(drillData?.ordered_steps)
    ? drillData.ordered_steps
    : [];

  const initialSteps: StepItem[] = rawSequence.map((s: any, idx: number) => ({
    id: idx,
    text: typeof s === "string" ? s : s?.step || s?.title || s?.text || `Step ${idx + 1}`,
  }));

  const [availableSteps, setAvailableSteps] = useState<StepItem[]>(() => {
    if (isCompleted) return [];
    return [...initialSteps].sort(() => Math.random() - 0.5);
  });

  const [orderedSteps, setOrderedSteps] = useState<StepItem[]>(() => {
    if (isCompleted) return [...initialSteps];
    return [];
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Sync completion state
  useEffect(() => {
    if (isCompleted) {
      setOrderedSteps([...initialSteps]);
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
    setOrderedSteps((prev) => [...prev, step]);
  };

  const handleRemove = (step: StepItem) => {
    if (isCompleted) return;
    setErrorMessage(null);
    setOrderedSteps((prev) => prev.filter((s) => s.id !== step.id));
    setAvailableSteps((prev) => [...prev, step]);
  };

  const handleReset = () => {
    if (isCompleted) return;
    setErrorMessage(null);
    setAvailableSteps([...initialSteps].sort(() => Math.random() - 0.5));
    setOrderedSteps([]);
  };

  const handleSubmit = () => {
    if (isCompleted) return;
    if (orderedSteps.length < initialSteps.length) {
      setErrorMessage("Please place all steps into the sequence before submitting.");
      triggerShake();
      return;
    }

    let isCorrect = true;
    for (let i = 0; i < initialSteps.length; i++) {
      if (orderedSteps[i]?.id !== initialSteps[i]?.id) {
        isCorrect = false;
        break;
      }
    }

    if (isCorrect) {
      const elapsed = Math.max(1, Math.floor((Date.now() - startTime) / 1000));
      onComplete(wrongAttempts, elapsed);
    } else {
      setWrongAttempts((p) => p + 1);
      setErrorMessage("Sequence incorrect! Tap any step to remove it and try a different order.");
      triggerShake();
      setTimeout(() => setErrorMessage(null), 3500);
    }
  };

  if (initialSteps.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <MaterialCommunityIcons name="alert-circle-outline" size={24} color="#F59E0B" />
        <Text style={styles.emptyCardText}>No sequence steps available for this drill.</Text>
      </View>
    );
  }

  const placedCount = orderedSteps.length;
  const totalCount = initialSteps.length;
  const isAllPlaced = placedCount === totalCount;

  return (
    <View style={styles.container}>
      {/* Top Header & Progress Card */}
      <View style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <View style={styles.progressTitleGroup}>
            <MaterialCommunityIcons
              name="lock-open-variant-outline"
              size={16}
              color={isCompleted ? "#10B981" : "#7C3AED"}
            />
            <Text style={styles.progressLabel} numberOfLines={1}>
              {isCompleted ? "Sequence Verified" : "Reconstruct Sequence"}
            </Text>
          </View>

          <View style={styles.progressRightRow}>
            {!isCompleted && orderedSteps.length > 0 && (
              <TouchableOpacity
                onPress={handleReset}
                style={styles.resetBtn}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="restart" size={13} color="#64748B" />
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
                name={isAllPlaced ? "check-circle" : "order-numeric-ascending"}
                size={13}
                color={isAllPlaced ? "#10B981" : "#7C3AED"}
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
              ? "All steps arranged in exact operational sequence!"
              : isAllPlaced
              ? "All steps placed! Tap 'Verify Sequence' to check your answer."
              : "Tap available steps below in their correct chronological order.")}
        </Text>
      </View>

      {/* Target Sequence Container with Shake on Error */}
      <Animated.View
        style={[
          styles.sequenceCard,
          errorMessage ? styles.sequenceCardError : null,
          { transform: [{ translateX: shakeAnim }] },
        ]}
      >
        <View style={styles.sequenceHeaderRow}>
          <MaterialCommunityIcons
            name="format-list-numbered"
            size={18}
            color={isCompleted ? "#10B981" : "#7C3AED"}
          />
          <Text style={styles.sequenceHeaderLabel}>YOUR SEQUENCE ORDER</Text>
        </View>

        {orderedSteps.length === 0 ? (
          <View style={styles.placeholderBox}>
            <MaterialCommunityIcons
              name="gesture-tap"
              size={28}
              color="rgba(124, 58, 237, 0.4)"
            />
            <Text style={styles.placeholderTitle}>Sequence is empty</Text>
            <Text style={styles.placeholderSubtitle}>
              Tap steps from the pool below to begin ordering
            </Text>
          </View>
        ) : (
          <View style={styles.orderedList}>
            {orderedSteps.map((step, idx) => (
              <TouchableOpacity
                key={`ord-${step.id}`}
                style={[
                  styles.orderedRow,
                  isCompleted && styles.orderedRowCompleted,
                ]}
                disabled={isCompleted}
                onPress={() => handleRemove(step)}
                activeOpacity={0.78}
              >
                {/* Step Number Circle */}
                <View
                  style={[
                    styles.stepBadge,
                    isCompleted && styles.stepBadgeCompleted,
                  ]}
                >
                  <Text style={styles.stepBadgeNumber}>{idx + 1}</Text>
                </View>

                {/* Step Text (No Truncation) */}
                <Text
                  style={[
                    styles.orderedText,
                    isCompleted && styles.orderedTextCompleted,
                  ]}
                >
                  {step.text}
                </Text>

                {/* Remove Indicator */}
                {!isCompleted && (
                  <View style={styles.removeIconCircle}>
                    <MaterialCommunityIcons
                      name="close"
                      size={13}
                      color="#64748B"
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
            ))}
          </View>
        )}
      </Animated.View>

      {/* Available Steps Pool */}
      {!isCompleted && availableSteps.length > 0 && (
        <View style={styles.availableSection}>
          <View style={styles.availableHeaderRow}>
            <MaterialCommunityIcons name="layers-outline" size={14} color="#7C3AED" />
            <Text style={styles.availableHeaderLabel}>
              AVAILABLE STEPS • TAP TO PLACE NEXT ({availableSteps.length})
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
                    <MaterialCommunityIcons name="plus" size={14} color="#7C3AED" />
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
            Drill Completed • {initialSteps.length} steps verified in sequence (+{earnedXp || 0} XP)
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
            name={isAllPlaced ? "shield-check" : "lock-clock"}
            size={18}
            color={isAllPlaced ? "#FFFFFF" : "#94A3B8"}
          />
          <Text
            style={[
              styles.submitBtnText,
              !isAllPlaced && styles.submitBtnTextDisabled,
            ]}
          >
            {isAllPlaced
              ? "Verify Sequence"
              : `Place All Steps (${placedCount}/${totalCount})`}
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
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  emptyCardText: {
    color: "#64748B",
    fontSize: 14,
    textAlign: "center",
  },

  // Progress Card
  progressCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 10,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
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
    color: "#0F172A",
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
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  resetBtnText: {
    color: "#475569",
    fontSize: 11,
    fontWeight: "700",
  },
  progressCounterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FAF5FF",
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E9D5FF",
  },
  progressCounterPillCompleted: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  progressCounterText: {
    color: "#7C3AED",
    fontSize: 12,
    fontWeight: "900",
  },
  progressCounterTextCompleted: {
    color: "#059669",
  },
  hintText: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 16,
  },
  hintTextError: {
    color: "#DC2626",
  },

  // Sequence Card (Target dropzone)
  sequenceCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    gap: 12,
    minHeight: 140,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sequenceCardError: {
    borderColor: "#EF4444",
    backgroundColor: "#FEF2F2",
  },
  sequenceHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sequenceHeaderLabel: {
    color: "#64748B",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
  },

  // Empty Placeholder State
  placeholderBox: {
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    borderStyle: "dashed",
    borderRadius: 12,
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#F8FAFC",
  },
  placeholderTitle: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "700",
  },
  placeholderSubtitle: {
    color: "#64748B",
    fontSize: 11.5,
    textAlign: "center",
  },

  // Ordered List & Rows
  orderedList: {
    gap: 8,
  },
  orderedRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FAF5FF",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: "#DDD6FE",
    gap: 10,
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  orderedRowCompleted: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#7C3AED",
    alignItems: "center",
    justifyContent: "center",
  },
  stepBadgeCompleted: {
    backgroundColor: "#10B981",
  },
  stepBadgeNumber: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
  },
  orderedText: {
    color: "#0F172A",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
    flex: 1,
  },
  orderedTextCompleted: {
    color: "#059669",
  },
  removeIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
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
    color: "#64748B",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  availableList: {
    gap: 8,
  },
  availableCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
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
    backgroundColor: "#FAF5FF",
    borderWidth: 1,
    borderColor: "#E9D5FF",
    alignItems: "center",
    justifyContent: "center",
  },
  availableText: {
    color: "#1E293B",
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
    backgroundColor: "#7C3AED",
    borderRadius: 14,
    paddingVertical: 15,
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  submitBtnDisabled: {
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
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
    color: "#94A3B8",
  },

  // Completed Banner
  completedNotice: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#ECFDF5",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  completedNoticeText: {
    color: "#059669",
    fontSize: 13,
    fontWeight: "700",
  },
});
