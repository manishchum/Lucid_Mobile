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

export default function AuditSpotterDrill({
  drillData,
  isCompleted,
  earnedXp,
  onComplete,
}: DrillProps) {
  const [startTime] = useState(Date.now());
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [selectedWords, setSelectedWords] = useState<number[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const fullText: string =
    drillData?.text ||
    drillData?.document ||
    drillData?.scenario ||
    drillData?.passage ||
    drillData?.content ||
    "";

  const rawFlags: string[] = Array.isArray(drillData?.red_flags)
    ? drillData.red_flags
    : Array.isArray(drillData?.flags)
    ? drillData.flags
    : Array.isArray(drillData?.violations)
    ? drillData.violations
    : Array.isArray(drillData?.errors)
    ? drillData.errors
    : [];

  // Split by whitespace preserving tokens
  const words = fullText.split(/(\s+)/);

  useEffect(() => {
    if (isCompleted) {
      const newSelected: number[] = [];
      const cleanStr = (s: string) =>
        s.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();

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

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 7, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -7, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 5, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -5, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();
  };

  const toggleWord = (index: number) => {
    if (isCompleted) return;
    if (words[index].trim() === "") return; // Don't allow clicking raw whitespace

    setErrorMessage(null);
    setSelectedWords((prev) => {
      if (prev.includes(index)) {
        return prev.filter((i) => i !== index);
      } else {
        return [...prev, index];
      }
    });
  };

  const handleClear = () => {
    if (isCompleted) return;
    setSelectedWords([]);
    setErrorMessage(null);
  };

  const handleSubmit = () => {
    if (isCompleted) return;
    if (selectedWords.length === 0) {
      setErrorMessage("Please select non-compliant words or phrases to flag!");
      triggerShake();
      return;
    }

    const sortedIndices = [...selectedWords].sort((a, b) => a - b);
    const cleanStr = (s: string) =>
      s.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
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
      const elapsed = Math.max(1, Math.floor((Date.now() - startTime) / 1000));
      onComplete(wrongAttempts, elapsed);
    } else {
      setWrongAttempts((prev) => prev + 1);
      setErrorMessage(
        "Incorrect flags! Some red flags were missed, or compliant text was selected."
      );
      triggerShake();
      setTimeout(() => setErrorMessage(null), 3500);
    }
  };

  if (!fullText.trim() || rawFlags.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <MaterialCommunityIcons name="alert-circle-outline" size={24} color="#F59E0B" />
        <Text style={styles.emptyCardText}>
          No audit document available for this drill.
        </Text>
      </View>
    );
  }

  const selectedCount = selectedWords.length;

  return (
    <View style={styles.container}>
      {/* Top Header & Progress Card */}
      <View style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <View style={styles.progressTitleGroup}>
            <MaterialCommunityIcons
              name="file-document-alert-outline"
              size={16}
              color={isCompleted ? "#10B981" : "#EF4444"}
            />
            <Text style={styles.progressLabel} numberOfLines={1}>
              {isCompleted ? "Audit Verified" : "Spot Red Flags"}
            </Text>
          </View>

          <View style={styles.progressRightRow}>
            {!isCompleted && selectedCount > 0 && (
              <TouchableOpacity
                onPress={handleClear}
                style={styles.clearBtn}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="restart" size={13} color="#64748B" />
                <Text style={styles.clearBtnText}>Clear</Text>
              </TouchableOpacity>
            )}

            <View
              style={[
                styles.progressCounterPill,
                isCompleted && styles.progressCounterPillCompleted,
              ]}
            >
              <MaterialCommunityIcons
                name={isCompleted ? "check-circle" : "flag"}
                size={12}
                color={isCompleted ? "#10B981" : "#EF4444"}
              />
              <Text
                style={[
                  styles.progressCounterText,
                  isCompleted && styles.progressCounterTextCompleted,
                ]}
              >
                {isCompleted ? "Verified" : `${selectedCount} Flags`}
              </Text>
            </View>
          </View>
        </View>

        {/* Dynamic Instructional Guidance */}
        <Text style={[styles.hintText, errorMessage ? styles.hintTextError : null]}>
          {errorMessage ||
            (isCompleted
              ? "All policy violations and red flags identified!"
              : selectedCount > 0
              ? "Review your selected flags, then tap 'Submit Audit' below."
              : "Tap any words or phrases in the document that violate policy.")}
        </Text>
      </View>

      {/* Main Document Card with Shake Animation on Error */}
      <Animated.View
        style={[
          styles.documentCard,
          errorMessage ? styles.documentCardError : null,
          { transform: [{ translateX: shakeAnim }] },
        ]}
      >
        <View style={styles.documentHeaderRow}>
          <MaterialCommunityIcons name="shield-search" size={16} color="#DC2626" />
          <Text style={styles.documentHeaderTitle}>DOCUMENT AUDIT SAMPLE</Text>
        </View>

        <Text style={styles.documentBodyText}>
          {words.map((word, idx) => {
            const isWhitespace = word.trim() === "";
            const isSelected = selectedWords.includes(idx);

            if (isWhitespace) {
              return <Text key={`ws-${idx}`}>{word}</Text>;
            }

            return (
              <Text
                key={`word-${idx}`}
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
      </Animated.View>

      {/* Submit / Completed Action */}
      {isCompleted ? (
        <View style={styles.completedNotice}>
          <MaterialCommunityIcons name="check-circle" size={18} color="#10B981" />
          <Text style={styles.completedNoticeText}>
            Drill Completed • Non-compliant red flags spotted (+{earnedXp || 0} XP)
          </Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[
            styles.submitBtn,
            selectedCount === 0 && styles.submitBtnDisabled,
          ]}
          disabled={selectedCount === 0}
          onPress={handleSubmit}
          activeOpacity={0.82}
        >
          <MaterialCommunityIcons
            name={selectedCount > 0 ? "flag" : "flag-outline"}
            size={18}
            color={selectedCount > 0 ? "#FFFFFF" : "#94A3B8"}
          />
          <Text
            style={[
              styles.submitBtnText,
              selectedCount === 0 && styles.submitBtnTextDisabled,
            ]}
          >
            {selectedCount > 0
              ? `Submit Audit (${selectedCount} Flagged)`
              : "Select Text to Flag"}
          </Text>
        </TouchableOpacity>
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

  // Progress Card
  progressCard: {
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
  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    flexShrink: 1,
    marginRight: 8,
  },
  progressLabel: {
    color: "#0F172A",
    fontSize: 13,
    fontWeight: "700",
  },
  progressRightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  clearBtnText: {
    color: "#475569",
    fontSize: 11,
    fontWeight: "700",
  },
  progressCounterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  progressCounterPillCompleted: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  progressCounterText: {
    color: "#DC2626",
    fontSize: 12,
    fontWeight: "900",
  },
  progressCounterTextCompleted: {
    color: "#059669",
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

  // Document Card
  documentCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    gap: 14,
    minHeight: 180,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  documentCardError: {
    borderColor: "#EF4444",
    backgroundColor: "#FEF2F2",
  },
  documentHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  documentHeaderTitle: {
    color: "#64748B",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  documentBodyText: {
    fontSize: 15.5,
    lineHeight: 30,
    color: "#0F172A",
  },

  // Interactive Words
  word: {
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 4,
  },
  wordSelected: {
    backgroundColor: "#FEE2E2",
    color: "#DC2626",
    fontWeight: "700",
    borderBottomWidth: 2,
    borderBottomColor: "#EF4444",
  },
  wordCompleted: {
    backgroundColor: "#ECFDF5",
    color: "#059669",
    fontWeight: "700",
    borderBottomWidth: 2,
    borderBottomColor: "#10B981",
  },

  // Submit Button
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#DC2626",
    borderRadius: 14,
    paddingVertical: 15,
    shadowColor: "#DC2626",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  submitBtnDisabled: {
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  submitBtnTextDisabled: {
    color: "#94A3B8",
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
  },
  completedNoticeText: {
    color: "#059669",
    fontSize: 13,
    fontWeight: "700",
  },
});
