import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { GC } from "./GamificationColors";

interface DrillProps {
  drillData: any;
  isCompleted: boolean;
  earnedXp?: number;
  onComplete: (wrong_attempts: number, completion_time_seconds: number) => void;
}

export default function CodeBreakerDrill({
  drillData,
  isCompleted,
  earnedXp,
  onComplete,
}: DrillProps) {
  const [startTime] = useState(Date.now());
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [currentClueIdx, setCurrentClueIdx] = useState(0);
  const [solvedDigits, setSolvedDigits] = useState<Record<number, number>>(
    isCompleted
      ? Object.fromEntries(
          (drillData?.clues || []).map((c: any) => [c.digit_position, c.correct_digit])
        )
      : {}
  );
  const [wrongDigit, setWrongDigit] = useState<number | null>(null);

  const title = drillData?.title || "Unlock the Vault";
  const passcode: string = drillData?.passcode || "????";
  const clues: any[] = drillData?.clues || [];

  const allSolved = clues.every((c) => solvedDigits[c.digit_position] !== undefined);
  const currentClue = clues[currentClueIdx];

  const handleDigitSelect = (digit: number) => {
    if (!currentClue || isCompleted) return;
    if (digit === currentClue.correct_digit) {
      setSolvedDigits((p) => ({ ...p, [currentClue.digit_position]: digit }));
      setWrongDigit(null);
      if (currentClueIdx < clues.length - 1) {
        setCurrentClueIdx((p) => p + 1);
      } else {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setTimeout(() => onComplete(wrongAttempts, elapsed), 600);
      }
    } else {
      setWrongAttempts((p) => p + 1);
      setWrongDigit(digit);
      setTimeout(() => setWrongDigit(null), 800);
    }
  };

  const renderPasscode = () => {
    return passcode.split("").map((char, i) => {
      const position = i + 1;
      const solved = solvedDigits[position];
      return (
        <View
          key={i}
          style={[
            styles.digitBox,
            solved !== undefined && styles.digitBoxSolved,
            currentClue?.digit_position === position && !isCompleted && styles.digitBoxActive,
          ]}
        >
          <Text style={styles.digitText}>
            {solved !== undefined ? solved : "?"}
          </Text>
        </View>
      );
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.vaultHeader}>
        <MaterialCommunityIcons name="lock" size={28} color={GC.gold} />
        <Text style={styles.vaultTitle}>{title}</Text>
      </View>

      <View style={styles.passcodeRow}>{renderPasscode()}</View>

      {!isCompleted && currentClue && (
        <>
          <View style={styles.clueCard}>
            <View style={styles.clueHeader}>
              <Text style={styles.clueStep}>
                DIGIT {currentClue.digit_position} OF {clues.length}
              </Text>
              <View style={styles.clueProgress}>
                {clues.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.clueProgressDot,
                      i < currentClueIdx && styles.clueProgressDotDone,
                      i === currentClueIdx && styles.clueProgressDotActive,
                    ]}
                  />
                ))}
              </View>
            </View>
            <Text style={styles.clueQuestion}>{currentClue.hint_question}</Text>
          </View>

          <View style={styles.optionsGrid}>
            {(currentClue.options || []).map((opt: number, i: number) => (
              <TouchableOpacity
                key={i}
                style={[
                  styles.digitBtn,
                  wrongDigit === opt && styles.digitBtnWrong,
                ]}
                onPress={() => handleDigitSelect(opt)}
                activeOpacity={0.8}
              >
                <Text style={styles.digitBtnText}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {(isCompleted || allSolved) && (
        <View style={styles.unlockedBox}>
          <MaterialCommunityIcons name="lock-open-variant" size={24} color={GC.gold} />
          <Text style={styles.unlockedText}>VAULT UNLOCKED! Code: {passcode}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 20 },
  vaultHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  vaultTitle: {
    color: GC.textPrimary,
    fontSize: 18,
    fontWeight: "800",
    flex: 1,
  },
  passcodeRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
  },
  digitBox: {
    width: 64,
    height: 72,
    borderRadius: 16,
    backgroundColor: GC.card,
    borderWidth: 2,
    borderColor: GC.border,
    justifyContent: "center",
    alignItems: "center",
  },
  digitBoxActive: {
    borderColor: GC.primary,
    backgroundColor: "#1A1035",
    shadowColor: GC.primary,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  digitBoxSolved: {
    borderColor: GC.gold,
    backgroundColor: "#1C1200",
  },
  digitText: {
    color: GC.textPrimary,
    fontSize: 28,
    fontWeight: "900",
  },
  clueCard: {
    backgroundColor: GC.card,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: GC.primaryBorder,
    gap: 12,
  },
  clueHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  clueStep: {
    color: GC.primaryLight,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
  },
  clueProgress: {
    flexDirection: "row",
    gap: 6,
  },
  clueProgressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: GC.border,
  },
  clueProgressDotDone: {
    backgroundColor: GC.success,
  },
  clueProgressDotActive: {
    backgroundColor: GC.primary,
  },
  clueQuestion: {
    color: GC.textPrimary,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 24,
  },
  optionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "center",
  },
  digitBtn: {
    width: 68,
    height: 68,
    borderRadius: 16,
    backgroundColor: GC.card,
    borderWidth: 1.5,
    borderColor: GC.border,
    justifyContent: "center",
    alignItems: "center",
  },
  digitBtnWrong: {
    backgroundColor: "#2D0808",
    borderColor: GC.danger,
  },
  digitBtnText: {
    color: GC.textPrimary,
    fontSize: 22,
    fontWeight: "900",
  },
  unlockedBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#1C1200",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: GC.gold,
  },
  unlockedText: {
    color: GC.gold,
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
});
