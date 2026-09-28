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
  const timeLimit = drillData?.time_limit_seconds || 30;
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [isWrong, setIsWrong] = useState(false);
  const timerRef = useRef<any>(null);
  const shakeAnim = useState(new Animated.Value(0))[0];
  const timerAnim = useRef(new Animated.Value(1)).current;

  const questions: any[] = drillData?.questions || [];
  const currentQ = questions[currentQIdx];
  const done = currentQIdx >= questions.length;

  useEffect(() => {
    if (isCompleted || done) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((prev: number) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          // Time out — record as failed with many wrong attempts
          onComplete(wrongAttempts + 5, timeLimit);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [currentQIdx, done, isCompleted]);

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 12, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 55, useNativeDriver: true }),
    ]).start();
  };

  const handleSelect = (idx: number) => {
    if (selected !== null || isCompleted || done) return;
    const correct = currentQ?.correct_option_index ?? -1;
    setSelected(idx);

    if (idx === correct) {
      // Correct — advance
      setTimeout(() => {
        setSelected(null);
        const nextIdx = currentQIdx + 1;
        setCurrentQIdx(nextIdx);
        if (nextIdx >= questions.length) {
          clearInterval(timerRef.current);
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          onComplete(wrongAttempts, elapsed);
        }
      }, 500);
    } else {
      setWrongAttempts((p) => p + 1);
      setIsWrong(true);
      shake();
      // Penalize 5s
      setTimeLeft((p: number) => Math.max(1, p - 5));
      setTimeout(() => {
        setSelected(null);
        setIsWrong(false);
      }, 900);
    }
  };

  const timerPct = (timeLeft / timeLimit) * 100;
  const timerColor =
    timerPct > 50 ? GC.success : timerPct > 25 ? GC.gold : GC.danger;

  if (isCompleted) {
    return (
      <View style={styles.completedBox}>
        <MaterialCommunityIcons name="lightning-bolt" size={32} color={GC.gold} />
        <Text style={styles.completedText}>Speed Run Complete!</Text>
      </View>
    );
  }

  if (done) return null;

  return (
    <View style={styles.container}>
      {/* Timer */}
      <View style={styles.timerSection}>
        <View style={styles.timerRow}>
          <MaterialCommunityIcons name="clock-fast" size={18} color={timerColor} />
          <Text style={[styles.timerText, { color: timerColor }]}>{timeLeft}s</Text>
          <Text style={styles.qCount}>
            Q {currentQIdx + 1}/{questions.length}
          </Text>
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

      {/* Question */}
      <Animated.View
        style={[
          styles.questionCard,
          isWrong && styles.questionCardWrong,
          { transform: [{ translateX: shakeAnim }] },
        ]}
      >
        <Text style={styles.questionText}>{currentQ?.question || ""}</Text>
      </Animated.View>

      {/* Options */}
      <View style={styles.optionsGrid}>
        {(currentQ?.options || []).map((opt: string, i: number) => {
          const isSelected = selected === i;
          const correct = currentQ?.correct_option_index;
          let btnStyle = styles.optionDefault;
          if (isSelected && i === correct) btnStyle = styles.optionCorrect;
          else if (isSelected && i !== correct) btnStyle = styles.optionWrong;

          return (
            <TouchableOpacity
              key={i}
              style={[styles.option, btnStyle]}
              onPress={() => handleSelect(i)}
              activeOpacity={0.8}
            >
              <Text style={styles.optionLetter}>
                {["A", "B", "C", "D"][i]}
              </Text>
              <Text style={styles.optionText}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  completedBox: {
    alignItems: "center",
    padding: 32,
    gap: 12,
    backgroundColor: GC.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: GC.gold,
  },
  completedText: {
    color: GC.gold,
    fontSize: 18,
    fontWeight: "800",
  },
  timerSection: { gap: 8 },
  timerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  timerText: {
    fontSize: 22,
    fontWeight: "900",
    flex: 1,
  },
  qCount: {
    color: GC.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  timerBarBg: {
    height: 6,
    backgroundColor: GC.border,
    borderRadius: 6,
    overflow: "hidden",
  },
  timerBarFill: {
    height: "100%",
    borderRadius: 6,
  },
  questionCard: {
    backgroundColor: GC.card,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: GC.border,
    padding: 20,
    minHeight: 90,
    justifyContent: "center",
  },
  questionCardWrong: {
    borderColor: GC.danger,
    backgroundColor: "#2D0808",
  },
  questionText: {
    color: GC.textPrimary,
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 26,
    textAlign: "center",
  },
  optionsGrid: { gap: 10 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
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
  optionLetter: {
    color: GC.primaryLight,
    fontSize: 14,
    fontWeight: "900",
    width: 24,
    textAlign: "center",
  },
  optionText: {
    color: GC.textPrimary,
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
    lineHeight: 20,
  },
});
