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

export default function FillBlanksDrill({
  drillData,
  isCompleted,
  earnedXp,
  onComplete,
}: DrillProps) {
  const [startTime] = useState(Date.now());
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [activeBlankIndex, setActiveBlankIndex] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Comprehensive parsing: handle all possible field names and blank markers
  const rawText =
    drillData?.text_with_blanks ||
    drillData?.text ||
    drillData?.statement ||
    drillData?.sentence ||
    drillData?.passage ||
    drillData?.question ||
    drillData?.content?.text_with_blanks ||
    drillData?.content?.text ||
    "";

  const options: string[] = Array.isArray(drillData?.options)
    ? drillData.options
    : Array.isArray(drillData?.choices)
    ? drillData.choices
    : [];

  const correctAnswers: string[] = Array.isArray(drillData?.correct_answers)
    ? drillData.correct_answers
    : drillData?.correct_answer
    ? [drillData.correct_answer]
    : [];

  // Match [BLANK], [blank], [BLANK 1], [blank_1], {blank}, <blank>, (blank), __, ...
  const blankPattern = /\[blank[^\]]*\]|\{blank[^\}]*\}|<blank[^>]*>|\(blank[^\)]*\)|_{2,}|\.{3,}/gi;
  let normalizedText = rawText.replace(blankPattern, "[BLANK]");

  let blanksCount = (normalizedText.match(/\[BLANK\]/g) || []).length;

  // Fallback 1: If text did not have a blank marker, replace occurrences of correct answers with [BLANK]
  if (blanksCount === 0 && correctAnswers.length > 0) {
    for (const ans of correctAnswers) {
      if (ans && typeof ans === "string" && ans.trim().length > 0) {
        const escaped = ans.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const ansRegex = new RegExp(`\\b${escaped}\\b`, "i");
        if (ansRegex.test(normalizedText)) {
          normalizedText = normalizedText.replace(ansRegex, "[BLANK]");
        }
      }
    }
    blanksCount = (normalizedText.match(/\[BLANK\]/g) || []).length;
  }

  // Fallback 2: Ensure at least 1 blank target
  if (blanksCount === 0) {
    blanksCount = Math.max(1, correctAnswers.length);
  }

  const parts = normalizedText.includes("[BLANK]")
    ? normalizedText.split("[BLANK]")
    : [normalizedText, ""];

  // Sync completed state
  useEffect(() => {
    if (isCompleted) {
      const correct: Record<number, string> = {};
      correctAnswers.forEach((ans: string, i: number) => {
        correct[i] = ans;
      });
      setSelectedAnswers(correct);
    }
  }, [isCompleted, correctAnswers]);

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 7, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -7, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 5, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -5, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();
  };

  const handleOptionSelect = (option: string) => {
    if (isCompleted) return;
    setErrorMessage(null);

    // If an active blank is chosen, place it there
    let targetIndex = activeBlankIndex;
    if (targetIndex >= blanksCount || targetIndex < 0) {
      // Find the first unfilled blank
      for (let i = 0; i < blanksCount; i++) {
        if (!selectedAnswers[i]) {
          targetIndex = i;
          break;
        }
      }
    }

    const updated = { ...selectedAnswers, [targetIndex]: option };
    setSelectedAnswers(updated);

    // Auto-advance to next unfilled blank
    let nextUnfilled = -1;
    for (let i = 0; i < blanksCount; i++) {
      if (!updated[i]) {
        nextUnfilled = i;
        break;
      }
    }

    if (nextUnfilled !== -1) {
      setActiveBlankIndex(nextUnfilled);
    } else {
      // All filled! Keep on current or last
      setActiveBlankIndex(targetIndex);
    }
  };

  const handleBlankPress = (index: number) => {
    if (isCompleted) return;
    setErrorMessage(null);
    if (selectedAnswers[index]) {
      // If already filled, clicking toggles or clears it
      setActiveBlankIndex(index);
    } else {
      setActiveBlankIndex(index);
    }
  };

  const handleClearBlank = (index: number) => {
    if (isCompleted) return;
    const next = { ...selectedAnswers };
    delete next[index];
    setSelectedAnswers(next);
    setActiveBlankIndex(index);
    setErrorMessage(null);
  };

  const handleSubmit = () => {
    if (isCompleted) return;
    if (Object.keys(selectedAnswers).length < blanksCount) {
      setErrorMessage("Please fill all the blanks before submitting!");
      triggerShake();
      return;
    }

    let isCorrect = true;
    for (let i = 0; i < blanksCount; i++) {
      const userAns = (selectedAnswers[i] || "").trim().toLowerCase();
      const expectedAns = (correctAnswers[i] || "").trim().toLowerCase();
      if (userAns !== expectedAns) {
        isCorrect = false;
        break;
      }
    }

    if (isCorrect) {
      const elapsed = Math.max(1, Math.floor((Date.now() - startTime) / 1000));
      onComplete(wrongAttempts, elapsed);
    } else {
      setWrongAttempts((prev) => prev + 1);
      setErrorMessage("Some answers are incorrect. Review your choices and try again!");
      triggerShake();
      setTimeout(() => {
        setErrorMessage(null);
      }, 3500);
    }
  };

  if (!rawText || !rawText.trim()) {
    return (
      <View style={styles.emptyCard}>
        <MaterialCommunityIcons name="alert-circle-outline" size={24} color="#F59E0B" />
        <Text style={styles.emptyCardText}>
          No fill-in statement available for this drill.
        </Text>
      </View>
    );
  }

  const filledCount = Object.keys(selectedAnswers).length;
  const isAllFilled = filledCount === blanksCount;

  return (
    <View style={styles.container}>
      {/* Top Header & Progress */}
      <View style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <View style={styles.progressTitleGroup}>
            <MaterialCommunityIcons
              name="text-box-edit-outline"
              size={16}
              color={isCompleted ? "#10B981" : "#7C3AED"}
            />
            <Text style={styles.progressLabel}>
              {isCompleted ? "Drill Completed" : "Fill In The Blanks"}
            </Text>
          </View>

          <View
            style={[
              styles.progressCounterPill,
              isAllFilled && styles.progressCounterPillCompleted,
            ]}
          >
            <MaterialCommunityIcons
              name={isAllFilled ? "check-circle" : "circle-edit-outline"}
              size={13}
              color={isAllFilled ? "#10B981" : "#7C3AED"}
            />
            <Text
              style={[
                styles.progressCounterText,
                isAllFilled && styles.progressCounterTextCompleted,
              ]}
            >
              {filledCount} / {blanksCount} Filled
            </Text>
          </View>
        </View>

        {/* Dynamic Instructional Hint */}
        <Text style={[styles.hintText, errorMessage ? styles.hintTextError : null]}>
          {errorMessage ||
            (isCompleted
              ? "All blanks solved accurately!"
              : isAllFilled
              ? "All blanks filled! Review and tap Submit Answer below."
              : `Filling Blank ${activeBlankIndex + 1}: Select an option from the word bank.`)}
        </Text>
      </View>

      {/* Main Passage Card with Shake Animation on Error */}
      <Animated.View
        style={[
          styles.passageCard,
          errorMessage ? styles.passageCardError : null,
          { transform: [{ translateX: shakeAnim }] },
        ]}
      >
        <View style={styles.passageHeaderRow}>
          <MaterialCommunityIcons name="format-quote-open" size={20} color="#7C3AED" />
          <Text style={styles.passageHeaderLabel}>STATEMENT / PASSAGE</Text>
        </View>

        <Text style={styles.passageText}>
          {parts.map((part: string, idx: number) => {
            const isLast = idx === parts.length - 1;
            const answer = selectedAnswers[idx];
            const isActive = activeBlankIndex === idx && !isCompleted;

            return (
              <React.Fragment key={`part-${idx}`}>
                <Text style={styles.normalText}>{part}</Text>
                {!isLast && (
                  <Text
                    style={[
                      styles.blankSlot,
                      isActive && styles.blankSlotActive,
                      answer ? styles.blankSlotFilled : null,
                      isCompleted && styles.blankSlotCompleted,
                    ]}
                    onPress={() => handleBlankPress(idx)}
                  >
                    {answer ? ` ${answer} ` : ` [ Blank ${idx + 1} ] `}
                  </Text>
                )}
              </React.Fragment>
            );
          })}
        </Text>

        {/* Active Blank Quick Clear Bar (if active blank is filled) */}
        {!isCompleted && selectedAnswers[activeBlankIndex] && (
          <View style={styles.clearBarRow}>
            <Text style={styles.clearBarLabel}>
              Blank {activeBlankIndex + 1}:{" "}
              <Text style={styles.clearBarAnswer}>
                "{selectedAnswers[activeBlankIndex]}"
              </Text>
            </Text>
            <TouchableOpacity
              onPress={() => handleClearBlank(activeBlankIndex)}
              style={styles.clearBtn}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="close-circle" size={14} color="#EF4444" />
              <Text style={styles.clearBtnText}>Remove</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>

      {/* Word Bank / Options Section */}
      {!isCompleted && options.length > 0 && (
        <View style={styles.wordBankSection}>
          <View style={styles.wordBankHeader}>
            <MaterialCommunityIcons name="format-list-bulleted-type" size={14} color="#7C3AED" />
            <Text style={styles.wordBankTitle}>WORD BANK</Text>
            <Text style={styles.wordBankSub}>
              (Tap word to place into Blank {activeBlankIndex + 1})
            </Text>
          </View>

          <View style={styles.optionsWrap}>
            {options.map((opt: string, i: number) => {
              // Check if option is already used in any blank
              const usedInBlankIndex = Object.entries(selectedAnswers).find(
                ([_, val]) => val === opt
              )?.[0];
              const isUsed = usedInBlankIndex !== undefined;
              const isCurrentSelection =
                selectedAnswers[activeBlankIndex] === opt;

              return (
                <TouchableOpacity
                  key={`opt-${i}`}
                  style={[
                    styles.optionChip,
                    isCurrentSelection && styles.optionChipActive,
                    isUsed && !isCurrentSelection && styles.optionChipUsed,
                  ]}
                  onPress={() => handleOptionSelect(opt)}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      isCurrentSelection && styles.optionChipTextActive,
                      isUsed && !isCurrentSelection && styles.optionChipTextUsed,
                    ]}
                  >
                    {opt}
                  </Text>
                  {isUsed && (
                    <View style={styles.usedBadge}>
                      <Text style={styles.usedBadgeText}>
                        B{Number(usedInBlankIndex) + 1}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Submit / Completed Action */}
      {isCompleted ? (
        <View style={styles.completedNotice}>
          <MaterialCommunityIcons name="check-circle" size={18} color="#10B981" />
          <Text style={styles.completedNoticeText}>
            Drill Completed • All {blanksCount} blanks correct (+{earnedXp || 0} XP)
          </Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[
            styles.submitBtn,
            !isAllFilled && styles.submitBtnDisabled,
          ]}
          disabled={!isAllFilled}
          onPress={handleSubmit}
          activeOpacity={0.82}
        >
          <MaterialCommunityIcons
            name={isAllFilled ? "check-bold" : "dots-horizontal"}
            size={18}
            color={isAllFilled ? "#FFFFFF" : "#94A3B8"}
          />
          <Text
            style={[
              styles.submitBtnText,
              !isAllFilled && styles.submitBtnTextDisabled,
            ]}
          >
            {isAllFilled ? "Submit Answer" : `Fill All Blanks (${filledCount}/${blanksCount})`}
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
  },
  progressLabel: {
    color: "#0F172A",
    fontSize: 13,
    fontWeight: "700",
  },
  progressCounterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FAF5FF",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
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

  // Main Passage Card
  passageCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    gap: 14,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  passageCardError: {
    borderColor: "#EF4444",
    backgroundColor: "#FEF2F2",
  },
  passageHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  passageHeaderLabel: {
    color: "#64748B",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  passageText: {
    lineHeight: 32,
  },
  normalText: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "500",
  },

  // Blank Interactive Slots
  blankSlot: {
    color: "#7C3AED",
    fontSize: 14.5,
    fontWeight: "700",
    backgroundColor: "#FAF5FF",
    borderWidth: 1.5,
    borderColor: "#DDD6FE",
    borderRadius: 8,
    overflow: "hidden",
  },
  blankSlotActive: {
    color: "#FFFFFF",
    backgroundColor: "#7C3AED",
    borderColor: "#6D28D9",
    fontWeight: "800",
  },
  blankSlotFilled: {
    color: "#059669",
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
    fontWeight: "700",
  },
  blankSlotCompleted: {
    color: "#059669",
    borderColor: "#10B981",
  },

  // Active Blank Clear Bar
  clearBarRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  clearBarLabel: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "500",
    flex: 1,
  },
  clearBarAnswer: {
    color: "#0F172A",
    fontWeight: "700",
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#FEE2E2",
  },
  clearBtnText: {
    color: "#DC2626",
    fontSize: 11,
    fontWeight: "700",
  },

  // Word Bank Section
  wordBankSection: {
    gap: 10,
  },
  wordBankHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 2,
  },
  wordBankTitle: {
    color: "#64748B",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  wordBankSub: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "500",
  },
  optionsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
  },
  optionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  optionChipActive: {
    backgroundColor: "#FAF5FF",
    borderColor: "#7C3AED",
  },
  optionChipUsed: {
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8F0",
    opacity: 0.6,
  },
  optionChipText: {
    color: "#1E293B",
    fontSize: 13,
    fontWeight: "700",
  },
  optionChipTextActive: {
    color: "#7C3AED",
    fontWeight: "800",
  },
  optionChipTextUsed: {
    color: "#94A3B8",
  },
  usedBadge: {
    backgroundColor: "#FAF5FF",
    borderWidth: 1,
    borderColor: "#E9D5FF",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 5,
  },
  usedBadgeText: {
    color: "#7C3AED",
    fontSize: 9,
    fontWeight: "800",
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
