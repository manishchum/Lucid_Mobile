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

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export default function SpeedRunDrill({
  drillData,
  isCompleted,
  earnedXp,
  onComplete,
}: DrillProps) {
  const [startTime] = useState(Date.now());
  const [wrongAttempts, setWrongAttempts] = useState(0);

  const timeLimit = typeof drillData?.time_limit === "number" ? drillData.time_limit : 30;
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [wrongOption, setWrongOption] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const timerRef = useRef<any>(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const question =
    drillData?.question ||
    drillData?.prompt ||
    drillData?.scenario ||
    drillData?.title ||
    "";

  const options: string[] = Array.isArray(drillData?.options)
    ? drillData.options
    : Array.isArray(drillData?.choices)
    ? drillData.choices
    : [];

  const correctAnswer =
    drillData?.correct_answer ||
    drillData?.answer ||
    "";

  // Countdown timer
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

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 7, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -7, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 5, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -5, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();
  };

  const handleSelect = (option: string) => {
    if (isCompleted || selectedOption !== null) return;

    if (option.trim().toLowerCase() === correctAnswer.trim().toLowerCase()) {
      // Correct!
      if (timerRef.current) clearInterval(timerRef.current);
      setSelectedOption(option);
      setErrorMessage(null);
      const elapsed = Math.max(1, Math.floor((Date.now() - startTime) / 1000));
      onComplete(wrongAttempts, elapsed);
    } else {
      // Mismatch
      setWrongAttempts((prev: number) => prev + 1);
      setWrongOption(option);
      setTimeLeft((prev: number) => Math.max(0, prev - 5));
      setErrorMessage("-5s Penalty! Incorrect option.");
      triggerShake();

      setTimeout(() => {
        setWrongOption(null);
        setErrorMessage(null);
      }, 750);
    }
  };

  if (!question || options.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <MaterialCommunityIcons name="alert-circle-outline" size={24} color="#F59E0B" />
        <Text style={styles.emptyCardText}>
          No speed run question available for this drill.
        </Text>
      </View>
    );
  }

  const timerPct = Math.max(0, Math.min(100, (timeLeft / timeLimit) * 100));
  const isDangerTime = timeLeft <= 5;
  const isWarningTime = timeLeft > 5 && timeLeft <= 12;

  const timerColor = isCompleted
    ? "#10B981"
    : isDangerTime
    ? "#EF4444"
    : isWarningTime
    ? "#F59E0B"
    : "#10B981";

  return (
    <View style={styles.container}>
      {/* Top Countdown & Status Card */}
      <View style={styles.timerCard}>
        <View style={styles.timerHeader}>
          <View style={styles.timerTitleGroup}>
            <MaterialCommunityIcons
              name="lightning-bolt"
              size={16}
              color={isCompleted ? "#10B981" : "#D97706"}
            />
            <Text style={styles.timerTitle} numberOfLines={1}>
              {isCompleted ? "Speed Run Cleared!" : "Speed Run Challenge"}
            </Text>
          </View>

          <View style={styles.timerBadge}>
            <MaterialCommunityIcons
              name={isCompleted ? "check-circle" : "timer-sand"}
              size={13}
              color={timerColor}
            />
            <Text style={[styles.timerBadgeText, { color: timerColor }]}>
              {isCompleted ? "Completed" : `${timeLeft}s Left`}
            </Text>
          </View>
        </View>

        {/* Dynamic Progress Bar */}
        {!isCompleted && (
          <View style={styles.progressBarTrack}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${timerPct}%`, backgroundColor: timerColor },
              ]}
            />
          </View>
        )}

        {/* Dynamic Instructional Guidance */}
        <Text style={[styles.hintText, errorMessage ? styles.hintTextError : null]}>
          {errorMessage ||
            (isCompleted
              ? "Rapid fire sprint answered correctly!"
              : isDangerTime
              ? "Time running out! Choose your answer fast!"
              : "Read quickly and tap the correct option before the timer expires.")}
        </Text>
      </View>

      {/* Main Question Dilemma Card with Shake on Error */}
      <Animated.View
        style={[
          styles.questionCard,
          errorMessage ? styles.questionCardError : null,
          { transform: [{ translateX: shakeAnim }] },
        ]}
      >
        <View style={styles.questionHeaderRow}>
          <MaterialCommunityIcons name="help-circle-outline" size={16} color="#7C3AED" />
          <Text style={styles.questionHeaderLabel}>QUESTION / SCENARIO</Text>
        </View>

        <Text style={styles.questionText}>{question}</Text>
      </Animated.View>

      {/* Options List */}
      <View style={styles.optionsList}>
        {options.map((opt: string, i: number) => {
          const isCorrect =
            opt.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
          const isSelected = selectedOption === opt;
          const isWrong = wrongOption === opt;
          const letter = LETTERS[i] || `${i + 1}`;

          // Styling logic
          const showAsCorrect = isCompleted ? isCorrect : isSelected && isCorrect;
          const showAsDimmed = isCompleted && !isCorrect;

          return (
            <TouchableOpacity
              key={`opt-${i}`}
              style={[
                styles.optionCard,
                showAsCorrect && styles.optionCardCorrect,
                isWrong && styles.optionCardWrong,
                showAsDimmed && styles.optionCardDimmed,
              ]}
              onPress={() => handleSelect(opt)}
              disabled={isCompleted || selectedOption !== null}
              activeOpacity={0.78}
            >
              <View style={styles.optionContentRow}>
                {/* Letter Badge */}
                <View
                  style={[
                    styles.letterBadge,
                    showAsCorrect && styles.letterBadgeCorrect,
                    isWrong && styles.letterBadgeWrong,
                  ]}
                >
                  <Text
                    style={[
                      styles.letterBadgeText,
                      showAsCorrect && styles.letterBadgeTextCorrect,
                      isWrong && styles.letterBadgeTextWrong,
                    ]}
                  >
                    {letter}
                  </Text>
                </View>

                {/* Option Text (No Truncation) */}
                <Text
                  style={[
                    styles.optionText,
                    showAsCorrect && styles.optionTextCorrect,
                    isWrong && styles.optionTextWrong,
                    showAsDimmed && styles.optionTextDimmed,
                  ]}
                >
                  {opt}
                </Text>

                {/* Status Indicator Icon */}
                <View style={styles.statusBox}>
                  {showAsCorrect ? (
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={18}
                      color="#10B981"
                    />
                  ) : isWrong ? (
                    <MaterialCommunityIcons
                      name="close-circle"
                      size={18}
                      color="#EF4444"
                    />
                  ) : null}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Completed Notice */}
      {isCompleted && (
        <View style={styles.completedNotice}>
          <MaterialCommunityIcons name="check-circle" size={18} color="#10B981" />
          <Text style={styles.completedNoticeText}>
            Speed Run Completed! (+{earnedXp || 0} XP)
          </Text>
        </View>
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

  // Timer Card
  timerCard: {
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
  timerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timerTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    flexShrink: 1,
    marginRight: 8,
  },
  timerTitle: {
    color: "#0F172A",
    fontSize: 13,
    fontWeight: "700",
  },
  timerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    flexShrink: 0,
  },
  timerBadgeText: {
    fontSize: 12,
    fontWeight: "900",
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: "#E2E8F0",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
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

  // Question Card
  questionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    gap: 12,
    minHeight: 110,
    justifyContent: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  questionCardError: {
    borderColor: "#EF4444",
    backgroundColor: "#FEF2F2",
  },
  questionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  questionHeaderLabel: {
    color: "#64748B",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  questionText: {
    color: "#0F172A",
    fontSize: 15.5,
    fontWeight: "700",
    lineHeight: 23,
  },

  // Options List
  optionsList: {
    gap: 10,
  },
  optionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 13,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    minHeight: 58,
    justifyContent: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  optionCardCorrect: {
    backgroundColor: "#ECFDF5",
    borderColor: "#10B981",
  },
  optionCardWrong: {
    backgroundColor: "#FEF2F2",
    borderColor: "#EF4444",
  },
  optionCardDimmed: {
    opacity: 0.45,
  },
  optionContentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  letterBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  letterBadgeCorrect: {
    backgroundColor: "#D1FAE5",
    borderColor: "#10B981",
  },
  letterBadgeWrong: {
    backgroundColor: "#FEE2E2",
    borderColor: "#EF4444",
  },
  letterBadgeText: {
    color: "#475569",
    fontSize: 11.5,
    fontWeight: "800",
  },
  letterBadgeTextCorrect: {
    color: "#059669",
  },
  letterBadgeTextWrong: {
    color: "#DC2626",
  },
  optionText: {
    color: "#1E293B",
    fontSize: 13.5,
    fontWeight: "600",
    lineHeight: 19,
    flex: 1,
  },
  optionTextCorrect: {
    color: "#059669",
    fontWeight: "700",
  },
  optionTextWrong: {
    color: "#DC2626",
  },
  optionTextDimmed: {
    color: "#94A3B8",
  },
  statusBox: {
    width: 20,
    alignItems: "center",
    justifyContent: "center",
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
    marginTop: 2,
  },
  completedNoticeText: {
    color: "#059669",
    fontSize: 13,
    fontWeight: "700",
  },
});
