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

export default function RiskRizzDrill({
  drillData,
  isCompleted,
  earnedXp,
  onComplete,
}: DrillProps) {
  const [startTime] = useState(Date.now());
  const [wrongAttempts, setWrongAttempts] = useState(0);

  const rawPairs = Array.isArray(drillData?.pairs) ? drillData.pairs : [];

  const [leftItems] = useState(() =>
    rawPairs.map((p, i) => ({ id: i, text: p.left || p.term })).sort(() => (isCompleted ? 0 : Math.random() - 0.5))
  );
  const [rightItems] = useState(() =>
    rawPairs.map((p, i) => ({ id: i, text: p.right || p.definition })).sort(() => (isCompleted ? 0 : Math.random() - 0.5))
  );

  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [matchedPairs, setMatchedPairs] = useState<number[]>([]);
  const [errorPair, setErrorPair] = useState<{ left: number; right: number } | null>(null);

  useEffect(() => {
    if (isCompleted) {
      setMatchedPairs(rawPairs.map((_, i) => i));
    }
  }, [isCompleted, rawPairs.length]);

  const handleRightClick = (rightId: number) => {
    if (selectedLeft === null) return;

    if (selectedLeft === rightId) {
      const newMatches = [...matchedPairs, rightId];
      setMatchedPairs(newMatches);
      setSelectedLeft(null);

      if (newMatches.length === rawPairs.length) {
        const timeSecs = Math.floor((Date.now() - startTime) / 1000);
        onComplete(wrongAttempts, timeSecs);
      }
    } else {
      setWrongAttempts((prev) => prev + 1);
      setErrorPair({ left: selectedLeft, right: rightId });
      setTimeout(() => {
        setErrorPair(null);
        setSelectedLeft(null);
      }, 800);
    }
  };

  if (rawPairs.length === 0) {
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
      <View style={styles.columnsWrapper}>
        {/* LEFT COLUMN */}
        <View style={styles.column}>
          <Text style={styles.columnTitle}>Terms / Scenarios</Text>
          {leftItems.map((item) => {
            const isMatched = matchedPairs.includes(item.id);
            const isSelected = selectedLeft === item.id;
            const isError = errorPair?.left === item.id;

            return (
              <TouchableOpacity
                key={`L-${item.id}`}
                style={[
                  styles.itemCard,
                  isMatched && styles.matchedCard,
                  isSelected && styles.selectedLeftCard,
                  isError && styles.errorCard,
                ]}
                disabled={isMatched}
                onPress={() =>
                  !isMatched && setSelectedLeft(isSelected ? null : item.id)
                }
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.itemText,
                    isMatched && styles.matchedText,
                    isSelected && styles.selectedText,
                    isError && styles.errorTextColored,
                  ]}
                >
                  {item.text}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* RIGHT COLUMN */}
        <View style={styles.column}>
          <Text style={styles.columnTitle}>Definitions / Actions</Text>
          {rightItems.map((item) => {
            const isMatched = matchedPairs.includes(item.id);
            const isError = errorPair?.right === item.id;

            return (
              <TouchableOpacity
                key={`R-${item.id}`}
                style={[
                  styles.itemCard,
                  isMatched && styles.matchedCard,
                  isError && styles.errorCard,
                ]}
                disabled={isMatched || selectedLeft === null}
                onPress={() => !isMatched && handleRightClick(item.id)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.itemText,
                    isMatched && styles.matchedText,
                    isError && styles.errorTextColored,
                  ]}
                >
                  {item.text}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {isCompleted && (
        <View style={styles.successBanner}>
          <MaterialCommunityIcons name="check-circle" size={20} color={GC.success} />
          <Text style={styles.successText}>
            Successfully Completed! (+{earnedXp || 0} XP)
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 40,
    gap: 16,
  },
  errorBox: {
    padding: 16,
    backgroundColor: "#FFF1F2",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FECDD3",
  },
  errorText: {
    color: "#E11D48",
    fontWeight: "500",
  },
  columnsWrapper: {
    flexDirection: "row",
    gap: 16,
  },
  column: {
    flex: 1,
    gap: 12,
  },
  columnTitle: {
    color: GC.textMuted,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  itemCard: {
    backgroundColor: GC.surface,
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: GC.border,
    minHeight: 80,
    justifyContent: "center",
  },
  matchedCard: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
    opacity: 0.5,
  },
  selectedLeftCard: {
    backgroundColor: "#EEF2FF",
    borderColor: "#6366F1",
    shadowColor: "#6366F1",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  errorCard: {
    backgroundColor: "#FFF1F2",
    borderColor: "#FB7185",
  },
  itemText: {
    color: GC.textPrimary,
    fontWeight: "600",
    fontSize: 13,
  },
  matchedText: {
    color: "#047857",
  },
  selectedText: {
    color: "#4338CA",
  },
  errorTextColored: {
    color: "#BE123C",
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
    marginTop: 16,
  },
  successText: {
    color: GC.success,
    fontWeight: "800",
    fontSize: 14,
  },
});
