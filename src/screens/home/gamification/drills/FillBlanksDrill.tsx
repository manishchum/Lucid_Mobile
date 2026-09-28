import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
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
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Record<string, boolean | null>>({});
  const [activeBlank, setActiveBlank] = useState<string | null>(null);
  const shakeAnims: Record<string, Animated.Value> = {};

  const template: string = drillData?.sentence_template || "";
  const blanks: any[] = drillData?.blanks || [];
  const explanation: string = drillData?.explanation || "";

  // Parse template into segments
  const segments = template.split(/(\{\{blank_\d+\}\})/g);

  const allCorrect = blanks.every(
    (b) => userAnswers[b.blank_id] === b.correct_word
  );

  const handleOptionSelect = (blankId: string, option: string, correctWord: string) => {
    if (isCompleted) return;
    const newAnswers = { ...userAnswers, [blankId]: option };
    setUserAnswers(newAnswers);

    if (option === correctWord) {
      setChecked((p) => ({ ...p, [blankId]: true }));
      setActiveBlank(null);

      // Check if all blanks are correct
      const allDone = blanks.every(
        (b) => (newAnswers[b.blank_id] || "") === b.correct_word
      );
      if (allDone) {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setTimeout(() => onComplete(wrongAttempts, elapsed), 600);
      }
    } else {
      setWrongAttempts((p) => p + 1);
      setChecked((p) => ({ ...p, [blankId]: false }));
      setTimeout(() => {
        setChecked((p) => ({ ...p, [blankId]: null }));
        setUserAnswers((prev) => ({ ...prev, [blankId]: "" }));
      }, 900);
    }
  };

  const currentBlank = blanks.find((b) => b.blank_id === activeBlank);

  return (
    <View style={styles.container}>
      <View style={styles.templateCard}>
        <Text style={styles.templateLabel}>FILL IN THE BLANKS</Text>
        <View style={styles.templateRow}>
          {segments.map((seg, i) => {
            const match = seg.match(/\{\{(blank_\d+)\}\}/);
            if (match) {
              const blankId = match[1];
              const blank = blanks.find((b) => b.blank_id === blankId);
              const answer = userAnswers[blankId] || "";
              const status = checked[blankId];
              const isActive = activeBlank === blankId;

              return (
                <TouchableOpacity
                  key={i}
                  onPress={() =>
                    !isCompleted && setActiveBlank(isActive ? null : blankId)
                  }
                  style={[
                    styles.blank,
                    isActive && styles.blankActive,
                    status === true && styles.blankCorrect,
                    status === false && styles.blankWrong,
                  ]}
                >
                  <Text
                    style={[
                      styles.blankText,
                      answer ? styles.blankFilled : styles.blankEmpty,
                    ]}
                  >
                    {answer || (blank?.correct_word ? "_______" : "___")}
                  </Text>
                </TouchableOpacity>
              );
            }
            return (
              <Text key={i} style={styles.segmentText}>
                {seg}
              </Text>
            );
          })}
        </View>
      </View>

      {activeBlank && currentBlank && (
        <View style={styles.optionsSection}>
          <Text style={styles.optionsLabel}>SELECT THE CORRECT WORD</Text>
          <View style={styles.optionsGrid}>
            {currentBlank.options.map((opt: string, i: number) => (
              <TouchableOpacity
                key={i}
                style={styles.optionChip}
                onPress={() =>
                  handleOptionSelect(activeBlank, opt, currentBlank.correct_word)
                }
                activeOpacity={0.75}
              >
                <Text style={styles.optionChipText}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {explanation !== "" && (
        <View style={styles.explanationBox}>
          <MaterialCommunityIcons
            name="information-outline"
            size={16}
            color={GC.accent}
          />
          <Text style={styles.explanationText}>{explanation}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  templateCard: {
    backgroundColor: GC.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: GC.border,
    padding: 20,
    gap: 14,
  },
  templateLabel: {
    color: GC.textMuted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
  },
  templateRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 4,
  },
  segmentText: {
    color: GC.textPrimary,
    fontSize: 16,
    fontWeight: "500",
    lineHeight: 26,
  },
  blank: {
    borderBottomWidth: 2,
    borderBottomColor: GC.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 80,
    alignItems: "center",
    borderRadius: 6,
    backgroundColor: GC.cardAlt,
  },
  blankActive: {
    backgroundColor: "#1A1035",
    borderColor: GC.primaryLight,
    borderWidth: 1,
  },
  blankCorrect: {
    backgroundColor: "#052E16",
    borderBottomColor: GC.success,
  },
  blankWrong: {
    backgroundColor: "#2D0808",
    borderBottomColor: GC.danger,
  },
  blankText: { fontSize: 15, fontWeight: "700" },
  blankFilled: { color: GC.primaryLight },
  blankEmpty: { color: GC.textMuted },
  optionsSection: { gap: 10 },
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
    backgroundColor: GC.card,
    borderWidth: 1.5,
    borderColor: GC.primaryBorder,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  optionChipText: {
    color: GC.primaryLight,
    fontSize: 14,
    fontWeight: "700",
  },
  explanationBox: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#0A1628",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: GC.accent,
    alignItems: "flex-start",
  },
  explanationText: {
    color: GC.textSecondary,
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
    lineHeight: 18,
  },
});
