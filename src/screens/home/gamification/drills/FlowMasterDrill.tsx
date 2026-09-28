import React, { useState } from "react";
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

export default function FlowMasterDrill({
  drillData,
  isCompleted,
  earnedXp,
  onComplete,
}: DrillProps) {
  const [startTime] = useState(Date.now());
  const [wrongAttempts, setWrongAttempts] = useState(0);

  const rawSteps: any[] = drillData?.steps || [];
  const procedureTitle = drillData?.procedure_title || "Arrange the Steps";
  const hint = drillData?.hint || "";

  // Shuffle initially (unless already completed)
  const [orderedSteps, setOrderedSteps] = useState<any[]>(() => {
    const shuffled = [...rawSteps];
    if (!isCompleted) {
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
    } else {
      shuffled.sort((a, b) => a.correct_order - b.correct_order);
    }
    return shuffled;
  });

  const [submitted, setSubmitted] = useState(isCompleted);
  const [result, setResult] = useState<boolean | null>(isCompleted ? true : null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const moveItem = (from: number, to: number) => {
    const newSteps = [...orderedSteps];
    const [item] = newSteps.splice(from, 1);
    newSteps.splice(to, 0, item);
    setOrderedSteps(newSteps);
    setSelectedIndex(null);
  };

  const handleStepPress = (index: number) => {
    if (submitted) return;
    if (selectedIndex === null) {
      setSelectedIndex(index);
    } else if (selectedIndex === index) {
      setSelectedIndex(null);
    } else {
      moveItem(selectedIndex, index);
    }
  };

  const handleSubmit = () => {
    const correct = orderedSteps.every(
      (step, idx) => step.correct_order === idx + 1
    );
    setResult(correct);
    setSubmitted(true);
    if (correct) {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setTimeout(() => onComplete(wrongAttempts, elapsed), 600);
    } else {
      setWrongAttempts((p) => p + 1);
      setTimeout(() => {
        setSubmitted(false);
        setResult(null);
      }, 1500);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.procedureTitle}>{procedureTitle}</Text>
      <Text style={styles.instruction}>
        {selectedIndex !== null
          ? "Tap another step to swap positions"
          : "Tap a step to select, then tap another to swap"}
      </Text>

      {hint !== "" && (
        <View style={styles.hintBox}>
          <MaterialCommunityIcons name="lightbulb-outline" size={14} color={GC.gold} />
          <Text style={styles.hintText}>{hint}</Text>
        </View>
      )}

      <View style={styles.stepsContainer}>
        {orderedSteps.map((step, index) => {
          const isSelected = selectedIndex === index;
          const isWrong =
            submitted && result === false && step.correct_order !== index + 1;
          const isRight =
            submitted && result === true;

          return (
            <TouchableOpacity
              key={step.id}
              onPress={() => handleStepPress(index)}
              style={[
                styles.step,
                isSelected && styles.stepSelected,
                isWrong && styles.stepWrong,
                isRight && styles.stepCorrect,
              ]}
              activeOpacity={0.8}
            >
              <View style={[styles.stepNumber, isSelected && styles.stepNumberSelected]}>
                <Text style={styles.stepNumberText}>{index + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step.text}</Text>
              {isSelected && (
                <MaterialCommunityIcons
                  name="swap-vertical"
                  size={18}
                  color={GC.primaryLight}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {!isCompleted && !submitted && (
        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
          <Text style={styles.submitBtnText}>CHECK ORDER</Text>
          <MaterialCommunityIcons name="check-bold" size={18} color={GC.bg} />
        </TouchableOpacity>
      )}

      {result === false && (
        <View style={styles.wrongBanner}>
          <MaterialCommunityIcons name="close-circle" size={16} color={GC.danger} />
          <Text style={styles.wrongBannerText}>Wrong order! Try again.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14 },
  procedureTitle: {
    color: GC.textPrimary,
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 24,
  },
  instruction: {
    color: GC.textMuted,
    fontSize: 12,
    fontWeight: "600",
    fontStyle: "italic",
  },
  hintBox: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#1C1200",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#3D2800",
    alignItems: "flex-start",
  },
  hintText: {
    color: GC.gold,
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
  },
  stepsContainer: { gap: 8 },
  step: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: GC.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: GC.border,
  },
  stepSelected: {
    borderColor: GC.primary,
    backgroundColor: "#1A1035",
  },
  stepWrong: {
    borderColor: GC.danger,
    backgroundColor: "#2D0808",
  },
  stepCorrect: {
    borderColor: GC.success,
    backgroundColor: "#052E16",
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: GC.cardAlt,
    borderWidth: 1,
    borderColor: GC.border,
    justifyContent: "center",
    alignItems: "center",
  },
  stepNumberSelected: {
    backgroundColor: GC.primary,
    borderColor: GC.primaryLight,
  },
  stepNumberText: {
    color: GC.textPrimary,
    fontSize: 12,
    fontWeight: "800",
  },
  stepText: {
    color: GC.textPrimary,
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
    lineHeight: 20,
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: GC.primary,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 4,
  },
  submitBtnText: {
    color: GC.bg,
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  wrongBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#2D0808",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: GC.danger,
  },
  wrongBannerText: {
    color: GC.danger,
    fontSize: 13,
    fontWeight: "700",
  },
});
