import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
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

export default function VibeCheckDrill({
  drillData,
  isCompleted,
  earnedXp,
  onComplete,
}: DrillProps) {
  const [startTime] = useState(Date.now());
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const shakeAnim = useState(new Animated.Value(0))[0];

  const scenario =
    drillData?.scenario_text ||
    drillData?.scenario ||
    drillData?.statement ||
    "No scenario provided.";
  const options = drillData?.options || [];
  const takeaway = drillData?.takeaway || "";

  const [selected, setSelected] = useState<string | null>(
    isCompleted ? "done" : null
  );
  const [feedback, setFeedback] = useState<string>("");

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: 10,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -10,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 6,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 0,
        duration: 60,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleSelect = (opt: any) => {
    if (isCompleted || selected) return;
    setSelected(opt.id);
    setFeedback(opt.feedback || "");
    if (opt.is_ethical) {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setTimeout(() => onComplete(wrongAttempts, elapsed), 800);
    } else {
      setWrongAttempts((p) => p + 1);
      shake();
      setTimeout(() => setSelected(null), 1000);
    }
  };

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.scenarioCard,
          { transform: [{ translateX: shakeAnim }] },
        ]}
      >
        <Text style={styles.scenarioText}>"{scenario}"</Text>
      </Animated.View>

      <Text style={styles.label}>WHAT DO YOU DO?</Text>

      {options.map((opt: any) => {
        const isSelected = selected === opt.id;
        const isCorrect = opt.is_ethical;
        let bg = styles.optionDefault;
        if (isCompleted && isCorrect) bg = styles.optionCorrect;
        else if (isSelected && isCorrect) bg = styles.optionCorrect;
        else if (isSelected && !isCorrect) bg = styles.optionWrong;

        return (
          <TouchableOpacity
            key={opt.id}
            style={[styles.option, bg]}
            onPress={() => handleSelect(opt)}
            activeOpacity={0.8}
            disabled={isCompleted}
          >
            <Text style={styles.optionText}>{opt.text}</Text>
            {((isCompleted && isCorrect) || (isSelected && isCorrect)) && (
              <MaterialCommunityIcons name="check-circle" size={20} color={GC.success} />
            )}
          </TouchableOpacity>
        );
      })}

      {feedback !== "" && (
        <View style={styles.feedbackBox}>
          <Text style={styles.feedbackText}>{feedback}</Text>
        </View>
      )}

      {takeaway !== "" && isCompleted && (
        <View style={styles.takeawayBox}>
          <MaterialCommunityIcons name="lightbulb-on" size={16} color={GC.gold} />
          <Text style={styles.takeawayText}>{takeaway}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  scenarioCard: {
    backgroundColor: GC.cardAlt,
    borderWidth: 1,
    borderColor: GC.border,
    borderRadius: 16,
    padding: 20,
  },
  scenarioText: {
    color: GC.textPrimary,
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 24,
    fontStyle: "italic",
  },
  label: {
    color: GC.textMuted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
    marginTop: 4,
  },
  option: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  optionDefault: {
    backgroundColor: GC.card,
    borderColor: GC.border,
  },
  optionCorrect: {
    backgroundColor: "#052E16",
    borderColor: GC.success,
  },
  optionWrong: {
    backgroundColor: "#2D0808",
    borderColor: GC.danger,
  },
  optionText: {
    color: GC.textPrimary,
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
    lineHeight: 20,
  },
  feedbackBox: {
    backgroundColor: "#1A1A2E",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: GC.primaryBorder,
  },
  feedbackText: {
    color: GC.primaryLight,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
  },
  takeawayBox: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#1C1200",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#3D2800",
    alignItems: "flex-start",
  },
  takeawayText: {
    color: GC.gold,
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
    lineHeight: 18,
  },
});
