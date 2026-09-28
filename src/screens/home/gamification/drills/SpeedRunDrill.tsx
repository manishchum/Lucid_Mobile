import React, { useState, useEffect, useRef } from "react";
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

export default function SpeedRunDrill({
  drillData,
  isCompleted,
  earnedXp,
  onComplete,
}: DrillProps) {
  const [startTime] = useState(Date.now());
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const timeLimit = 30; // Web uses hardcoded 30 seconds
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [selectedOpt, setSelectedOpt] = useState<string | null>(null);
  const [isWrong, setIsWrong] = useState(false);
  const timerRef = useRef<any>(null);
  const shakeAnim = useState(new Animated.Value(0))[0];

  const question = drillData?.question || "";
  const options = Array.isArray(drillData?.options) ? drillData.options : [];
  const correctAnswer = drillData?.correct_answer || "";

  useEffect(() => {
    if (isCompleted) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((prev: number) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [isCompleted]);

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 12, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 55, useNativeDriver: true }),
    ]).start();
  };

  const handleSelect = (opt: string) => {
    if (isCompleted) return;

    if (opt === correctAnswer) {
      clearInterval(timerRef.current);
      setSelectedOpt(opt);
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      onComplete(wrongAttempts, elapsed);
    } else {
      setWrongAttempts((p) => p + 1);
      setIsWrong(true);
      shake();
      setTimeLeft((p: number) => Math.max(0, p - 5));
      setTimeout(() => {
        setIsWrong(false);
      }, 900);
    }
  };

  const timerPct = (timeLeft / timeLimit) * 100;
  const timerColor =
    timerPct > 50 ? GC.success : timerPct > 25 ? GC.gold : GC.danger;

  return (
    <View style={styles.container}>
      {!isCompleted && (
        <View style={styles.timerSection}>
          <View style={styles.timerRow}>
            <MaterialCommunityIcons name="clock-fast" size={24} color={timerColor} />
            <Text style={[styles.timerText, { color: timerColor }]}>{timeLeft}s</Text>
          </View>
          <View style={styles.timerBarBg}>
            <View
              style={[
                styles.timerBarFill,
                { width: `${timerPct}%`, backgroundColor: timerColor },
              ]}
            />
          </View>
        </View>
      )}

      <Animated.View
        style={[
          styles.questionCard,
          isWrong && styles.questionCardWrong,
          { transform: [{ translateX: shakeAnim }] },
        ]}
      >
        <Text style={styles.questionText}>{question}</Text>
      </Animated.View>

      <View style={styles.optionsGrid}>
        {options.map((opt: string, i: number) => {
          let btnStyle = styles.optionDefault;
          let isOptSelected = false;

          if (isCompleted) {
            if (opt === correctAnswer) {
              btnStyle = styles.optionCorrect;
            } else {
              btnStyle = styles.optionDisabled;
            }
          } else if (isWrong && selectedOpt === opt) {
            // Technically we don't hold the wrong selection state, just flash it.
            // But we flash the question card instead.
          }

          return (
            <TouchableOpacity
              key={i}
              style={[styles.option, btnStyle]}
              onPress={() => handleSelect(opt)}
              disabled={isCompleted}
              activeOpacity={0.8}
            >
              <Text style={styles.optionText}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {isCompleted && (
        <View style={styles.successBanner}>
          <MaterialCommunityIcons name="check-circle" size={20} color={GC.success} />
          <Text style={styles.successText}>
            Successfully Completed! (+{earnedXp || 0} XP)
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 20, paddingBottom: 30 },
  timerSection: { gap: 12, alignItems: "center" },
  timerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  timerText: {
    fontSize: 28,
    fontWeight: "900",
  },
  timerBarBg: {
    height: 8,
    backgroundColor: GC.border,
    borderRadius: 8,
    overflow: "hidden",
    width: "100%",
  },
  timerBarFill: {
    height: "100%",
    borderRadius: 8,
  },
  questionCard: {
    backgroundColor: GC.card,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: GC.border,
    padding: 24,
    minHeight: 120,
    justifyContent: "center",
  },
  questionCardWrong: {
    borderColor: GC.danger,
    backgroundColor: "#2D0808",
  },
  questionText: {
    color: GC.textPrimary,
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 28,
    textAlign: "center",
  },
  optionsGrid: { gap: 12 },
  option: {
    borderRadius: 16,
    borderWidth: 2,
    padding: 16,
  },
  optionDefault: {
    backgroundColor: GC.card,
    borderColor: GC.border,
  },
  optionCorrect: {
    backgroundColor: "#052E16",
    borderColor: GC.success,
  },
  optionDisabled: {
    backgroundColor: GC.cardAlt,
    borderColor: GC.border,
    opacity: 0.5,
  },
  optionText: {
    color: GC.textPrimary,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
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
    marginTop: 10,
  },
  successText: {
    color: GC.success,
    fontWeight: "800",
    fontSize: 14,
  },
});
