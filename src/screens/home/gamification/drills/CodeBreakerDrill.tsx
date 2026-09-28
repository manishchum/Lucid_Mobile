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

export default function CodeBreakerDrill({
  drillData,
  isCompleted,
  earnedXp,
  onComplete,
}: DrillProps) {
  const [startTime] = useState(Date.now());
  const [wrongAttempts, setWrongAttempts] = useState(0);

  const sequence = Array.isArray(drillData?.sequence) ? drillData.sequence : [];
  const steps = sequence.map((s: any) => s?.step || String(s || ""));

  const [availableSteps, setAvailableSteps] = useState<string[]>(() => {
    if (isCompleted) return [];
    return [...steps].sort(() => Math.random() - 0.5);
  });
  
  const [orderedSteps, setOrderedSteps] = useState<string[]>(
    isCompleted ? [...steps] : []
  );
  
  const [isError, setIsError] = useState(false);

  const handleSelect = (step: string) => {
    setAvailableSteps((prev) => prev.filter((s) => s !== step));
    setOrderedSteps((prev) => [...prev, step]);
  };

  const handleRemove = (step: string) => {
    setOrderedSteps((prev) => prev.filter((s) => s !== step));
    setAvailableSteps((prev) => [...prev, step]);
  };

  const handleSubmit = () => {
    let isCorrect = true;
    for (let i = 0; i < steps.length; i++) {
      if (orderedSteps[i] !== steps[i]) {
        isCorrect = false;
        break;
      }
    }

    if (isCorrect) {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      onComplete(wrongAttempts, elapsed);
    } else {
      setWrongAttempts((p) => p + 1);
      setIsError(true);
      setTimeout(() => setIsError(false), 1000);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.orderedContainer}>
        <Text style={styles.sectionTitle}>YOUR SEQUENCE</Text>
        {orderedSteps.length === 0 ? (
          <Text style={styles.placeholderText}>
            Tap steps below to build the sequence
          </Text>
        ) : (
          orderedSteps.map((step, idx) => (
            <TouchableOpacity
              key={`ord-${idx}`}
              style={[
                styles.orderedItem,
                isCompleted && styles.completedItem,
              ]}
              disabled={isCompleted}
              onPress={() => handleRemove(step)}
              activeOpacity={0.8}
            >
              <Text style={styles.orderedIndex}>{idx + 1}.</Text>
              <Text style={styles.orderedText}>{step}</Text>
            </TouchableOpacity>
          ))
        )}
      </View>

      <View style={styles.availableContainer}>
        {availableSteps.map((step, idx) => (
          <TouchableOpacity
            key={`av-${idx}`}
            style={styles.availableItem}
            onPress={() => handleSelect(step)}
            activeOpacity={0.8}
          >
            <Text style={styles.availableText}>{step}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {!isCompleted ? (
        <TouchableOpacity
          style={[
            styles.submitBtn,
            orderedSteps.length < steps.length && styles.submitBtnDisabled,
            isError && styles.submitBtnError,
          ]}
          disabled={orderedSteps.length < steps.length || isError}
          onPress={handleSubmit}
          activeOpacity={0.8}
        >
          <Text style={styles.submitBtnText}>
            {isError ? "Incorrect Sequence! Try Again." : "Verify Sequence"}
          </Text>
        </TouchableOpacity>
      ) : (
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
    gap: 24,
  },
  orderedContainer: {
    backgroundColor: GC.surface,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GC.border,
    minHeight: 150,
  },
  sectionTitle: {
    color: GC.textMuted,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 16,
  },
  placeholderText: {
    color: GC.textMuted,
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 20,
  },
  orderedItem: {
    backgroundColor: "#4F46E5",
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  completedItem: {
    backgroundColor: GC.success,
    opacity: 0.9,
  },
  orderedIndex: {
    color: "rgba(255,255,255,0.5)",
    fontWeight: "900",
    marginRight: 12,
  },
  orderedText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
    flex: 1,
  },
  availableContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  availableItem: {
    backgroundColor: GC.bg,
    borderWidth: 2,
    borderColor: GC.border,
    padding: 16,
    borderRadius: 12,
    width: "100%",
  },
  availableText: {
    color: GC.textPrimary,
    fontWeight: "600",
    fontSize: 14,
  },
  submitBtn: {
    backgroundColor: "#4F46E5",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  submitBtnDisabled: {
    backgroundColor: GC.border,
  },
  submitBtnError: {
    backgroundColor: GC.danger,
  },
  submitBtnText: {
    color: GC.bg,
    fontWeight: "800",
    fontSize: 15,
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
