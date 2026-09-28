import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { GC } from "./GamificationColors";

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
  const [isError, setIsError] = useState(false);
  const [activeBlankIndex, setActiveBlankIndex] = useState<number | null>(null);

  // Parse payload robustly to match web
  const textWithBlanks = drillData?.text_with_blanks || drillData?.text || "";
  const blanks = (textWithBlanks.match(/\[BLANK\]/g) || []).length;
  const options: string[] = Array.isArray(drillData?.options) ? drillData.options : [];
  const correctAnswers: string[] = Array.isArray(drillData?.correct_answers) ? drillData.correct_answers : [];

  // Split text by [BLANK]
  const parts = textWithBlanks.split(/\[BLANK\]/g);

  useEffect(() => {
    if (isCompleted) {
      const correct: Record<number, string> = {};
      correctAnswers.forEach((ans: string, i: number) => {
        correct[i] = ans;
      });
      setSelectedAnswers(correct);
    }
  }, [isCompleted, correctAnswers]);

  const handleSubmit = () => {
    if (Object.keys(selectedAnswers).length < blanks) return;

    let isCorrect = true;
    for (let i = 0; i < blanks; i++) {
      if (selectedAnswers[i] !== correctAnswers[i]) {
        isCorrect = false;
        break;
      }
    }

    if (isCorrect) {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      onComplete(wrongAttempts, elapsed);
    } else {
      setWrongAttempts((prev) => prev + 1);
      setIsError(true);
      setTimeout(() => setIsError(false), 1000);
    }
  };

  const handleOptionSelect = (opt: string) => {
    if (activeBlankIndex === null) return;
    setSelectedAnswers((prev) => ({ ...prev, [activeBlankIndex]: opt }));
    setActiveBlankIndex(null);
  };

  if (!textWithBlanks) {
    return (
      <View style={styles.errorBox}>
        <Text style={styles.errorText}>
          Error: This drill was generated with invalid data. Please regenerate the sprint.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View
        style={[
          styles.textCard,
          isError && styles.textCardError,
        ]}
      >
        <Text style={styles.paragraphText}>
          {parts.map((part: string, idx: number) => {
            const isLast = idx === parts.length - 1;
            const answer = selectedAnswers[idx];
            const isActive = activeBlankIndex === idx;

            return (
              <React.Fragment key={idx}>
                <Text style={styles.normalText}>{part}</Text>
                {!isLast && (
                  <Text
                    style={[
                      styles.blankPlaceholder,
                      isActive && styles.blankPlaceholderActive,
                      answer && styles.blankPlaceholderFilled,
                    ]}
                    onPress={() => !isCompleted && setActiveBlankIndex(isActive ? null : idx)}
                  >
                    {answer ? ` ${answer} ` : " [ SELECT ] "}
                  </Text>
                )}
              </React.Fragment>
            );
          })}
        </Text>
      </View>

      {activeBlankIndex !== null && !isCompleted && (
        <View style={styles.optionsSection}>
          <Text style={styles.optionsLabel}>SELECT OPTION FOR BLANK {activeBlankIndex + 1}</Text>
          <View style={styles.optionsGrid}>
            {options.map((opt: string, i: number) => (
              <TouchableOpacity
                key={i}
                style={styles.optionChip}
                onPress={() => handleOptionSelect(opt)}
                activeOpacity={0.75}
              >
                <Text style={styles.optionChipText}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {isCompleted ? (
        <View style={styles.successBanner}>
          <MaterialCommunityIcons name="check-circle" size={20} color={GC.success} />
          <Text style={styles.successText}>
            Successfully Completed! (+{earnedXp || 0} XP)
          </Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[
            styles.submitBtn,
            Object.keys(selectedAnswers).length < blanks && styles.submitBtnDisabled,
            isError && styles.submitBtnError,
          ]}
          disabled={Object.keys(selectedAnswers).length < blanks || isError}
          onPress={handleSubmit}
          activeOpacity={0.8}
        >
          <Text style={styles.submitBtnText}>
            {isError ? "Incorrect Answers! Try Again." : "Submit Answer"}
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: 24, paddingBottom: 40 },
  errorBox: {
    padding: 16,
    backgroundColor: "#FFF1F2",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FECDD3",
  },
  errorText: { color: "#E11D48", fontWeight: "500" },
  textCard: {
    backgroundColor: GC.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: GC.border,
    padding: 24,
  },
  textCardError: {
    backgroundColor: "#FFF1F2",
    borderColor: "#FDA4AF",
  },
  paragraphText: {
    lineHeight: 32,
  },
  normalText: {
    color: GC.textPrimary,
    fontSize: 16,
    fontWeight: "500",
  },
  blankPlaceholder: {
    color: "#6366F1",
    fontSize: 16,
    fontWeight: "800",
    backgroundColor: "#EEF2FF",
    borderWidth: 1,
    borderColor: "#C7D2FE",
    overflow: "hidden",
  },
  blankPlaceholderActive: {
    backgroundColor: "#E0E7FF",
    borderColor: "#818CF8",
  },
  blankPlaceholderFilled: {
    color: "#4338CA",
  },
  optionsSection: { gap: 12 },
  optionsLabel: {
    color: GC.textMuted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
  },
  optionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  optionChip: {
    backgroundColor: GC.surface,
    borderWidth: 2,
    borderColor: GC.border,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  optionChipText: {
    color: GC.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  submitBtn: {
    backgroundColor: "#4F46E5",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  submitBtnDisabled: {
    backgroundColor: GC.border,
  },
  submitBtnError: {
    backgroundColor: GC.danger,
  },
  submitBtnText: {
    color: GC.bg,
    fontWeight: "800",
    fontSize: 15,
  },
  successBanner: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderColor: GC.success,
    borderWidth: 1,
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  successText: {
    color: GC.success,
    fontWeight: "800",
    fontSize: 14,
  },
});
