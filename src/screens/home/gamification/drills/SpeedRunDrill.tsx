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
              color={isCompleted ? "#10B981" : "#F59E0B"}
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
          <MaterialCommunityIcons name="help-circle-outline" size={16} color="#A855F7" />
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

  // Timer Card
  timerCard: {
    backgroundColor: "#242430",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    gap: 10,
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
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  timerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    flexShrink: 0,
  },
  timerBadgeText: {
    fontSize: 12,
    fontWeight: "900",
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
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

  // Question Card
  questionCard: {
    backgroundColor: "#242430",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.08)",
    gap: 12,
    minHeight: 110,
    justifyContent: "center",
  },
  questionCardError: {
    borderColor: "#EF4444",
    backgroundColor: "rgba(239, 68, 68, 0.08)",
  },
  questionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  questionHeaderLabel: {
    color: "#94A3B8",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  questionText: {
    color: "#FFFFFF",
    fontSize: 15.5,
    fontWeight: "700",
    lineHeight: 23,
  },

  // Options List
  optionsList: {
    gap: 10,
  },
  optionCard: {
    backgroundColor: "#242430",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 13,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.08)",
    minHeight: 58,
    justifyContent: "center",
  },
  optionCardCorrect: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderColor: "#10B981",
  },
  optionCardWrong: {
    backgroundColor: "rgba(239, 68, 68, 0.16)",
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
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  letterBadgeCorrect: {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    borderColor: "#10B981",
  },
  letterBadgeWrong: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    borderColor: "#EF4444",
  },
  letterBadgeText: {
    color: "#CBD5E1",
    fontSize: 11.5,
    fontWeight: "800",
  },
  letterBadgeTextCorrect: {
    color: "#10B981",
  },
  letterBadgeTextWrong: {
    color: "#EF4444",
  },
  optionText: {
    color: "#E2E8F0",
    fontSize: 13.5,
    fontWeight: "600",
    lineHeight: 19,
    flex: 1,
  },
  optionTextCorrect: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  optionTextWrong: {
    color: "#FCA5A5",
  },
  optionTextDimmed: {
    color: "#64748B",
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
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.25)",
    marginTop: 2,
  },
  completedNoticeText: {
    color: "#10B981",
    fontSize: 13,
    fontWeight: "700",
  },
});
