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

export default function AuditSpotterDrill({
  drillData,
  isCompleted,
  earnedXp,
  onComplete,
}: DrillProps) {
  const [startTime] = useState(Date.now());
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [selectedWords, setSelectedWords] = useState<number[]>([]);
  const [isError, setIsError] = useState(false);

  const fullText: string = drillData?.text || drillData?.document || drillData?.scenario || "";
  const rawFlags: string[] = Array.isArray(drillData?.red_flags)
    ? drillData.red_flags
    : Array.isArray(drillData?.flags)
    ? drillData.flags
    : [];

  // Split by whitespace
  const words = fullText.split(/(\s+)/);

  useEffect(() => {
    if (isCompleted) {
      const newSelected: number[] = [];
      const cleanStr = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();

      for (const flag of rawFlags) {
        const cleanFlag = cleanStr(flag);
        if (!cleanFlag) continue;

        const flagWords = cleanFlag.split(" ");
        for (let i = 0; i <= words.length - flagWords.length; i++) {
          let match = true;
          for (let j = 0; j < flagWords.length; j++) {
            if (cleanStr(words[i + j]) !== flagWords[j]) {
              match = false;
              break;
            }
          }
          if (match) {
            for (let j = 0; j < flagWords.length; j++) {
              newSelected.push(i + j);
            }
          }
        }
      }
      setSelectedWords(Array.from(new Set(newSelected)));
    }
  }, [isCompleted, rawFlags.length, fullText]);

  const toggleWord = (index: number) => {
    if (isCompleted) return;
    if (words[index].trim() === "") return; // Don't allow clicking raw whitespace

    setSelectedWords((prev) => {
      if (prev.includes(index)) {
        return prev.filter((i) => i !== index);
      } else {
        return [...prev, index];
      }
    });
  };

  const handleSubmit = () => {
    const sortedIndices = [...selectedWords].sort((a, b) => a - b);
    const cleanStr = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
    const selectedText = cleanStr(sortedIndices.map((i) => words[i]).join(" "));

    let foundCount = 0;

    for (const flag of rawFlags) {
      const cleanFlag = cleanStr(flag);
      if (!cleanFlag) continue;

      if (selectedText.includes(cleanFlag)) {
        foundCount++;
      } else {
        const flagWords = cleanFlag.split(" ");
        let matchCount = 0;
        for (const fw of flagWords) {
          if (selectedText.includes(fw)) matchCount++;
        }
        if (flagWords.length > 0 && matchCount / flagWords.length >= 0.7) {
          foundCount++;
        }
      }
    }

    const isCorrect = rawFlags.length > 0 && foundCount >= rawFlags.length;

    if (isCorrect) {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      onComplete(wrongAttempts, elapsed);
    } else {
      setWrongAttempts((prev) => prev + 1);
      setIsError(true);
      setTimeout(() => setIsError(false), 1500);
    }
  };

  if (!fullText || rawFlags.length === 0) {
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
      <View style={styles.instructionBox}>
        <MaterialCommunityIcons name="shield-alert" size={24} color="#D97706" />
        <Text style={styles.instructionText}>
          Audit this document. Tap the words/phrases that represent non-compliant rules or red flags based on standard policy.
        </Text>
      </View>

      <View style={styles.documentCard}>
        <Text style={styles.documentText}>
          {words.map((word, idx) => {
            const isWhitespace = word.trim() === "";
            const isSelected = selectedWords.includes(idx);

            if (isWhitespace) {
              return <Text key={idx}>{word}</Text>;
            }

            return (
              <Text
                key={idx}
                onPress={() => toggleWord(idx)}
                style={[
                  styles.word,
                  isSelected && styles.wordSelected,
                  isCompleted && isSelected && styles.wordCompleted,
                ]}
              >
                {word}
              </Text>
            );
          })}
        </Text>
      </View>

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
            selectedWords.length === 0 && styles.submitBtnDisabled,
            isError && styles.submitBtnError,
          ]}
          disabled={selectedWords.length === 0}
          onPress={handleSubmit}
          activeOpacity={0.8}
        >
          <Text style={styles.submitBtnText}>
            {isError ? "Incorrect! Spot the real red flags." : "Flag Selected Text"}
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: 20, paddingBottom: 40 },
  errorBox: {
    padding: 16,
    backgroundColor: "#FFF1F2",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FECDD3",
  },
  errorText: { color: "#E11D48", fontWeight: "500" },
  instructionBox: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A",
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  instructionText: {
    flex: 1,
    color: "#92400E",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  documentCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#E2E8F0",
    padding: 24,
    minHeight: 200,
  },
  documentText: {
    fontSize: 18,
    lineHeight: 32,
    color: "#334155",
  },
  word: {
    paddingHorizontal: 2,
    borderRadius: 4,
  },
  wordSelected: {
    backgroundColor: "#FECDD3",
    color: "#881337",
    fontWeight: "bold",
  },
  wordCompleted: {
    backgroundColor: "#FECDD3",
    color: "#881337",
    fontWeight: "bold",
  },
  submitBtn: {
    backgroundColor: "#F59E0B",
    padding: 18,
    borderRadius: 16,
    alignItems: "center",
    shadowColor: "#F59E0B",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  submitBtnDisabled: {
    backgroundColor: "#E2E8F0",
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnError: {
    backgroundColor: "#EF4444",
    shadowColor: "#EF4444",
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
    letterSpacing: 0.5,
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
