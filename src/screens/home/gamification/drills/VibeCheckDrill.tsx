import React, { useState } from "react";
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

export default function VibeCheckDrill({
  drillData,
  isCompleted,
  earnedXp,
  onComplete,
}: DrillProps) {
  const [startTime] = useState(Date.now());
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const shakeAnim = useState(new Animated.Value(0))[0];

  const scenario =
    drillData?.scenario ||
    drillData?.statement ||
    drillData?.question ||
    "Evaluate the given scenario and determine if it is True or False.";

  const isTrue =
    drillData?.is_true === true ||
    drillData?.is_true === "true" ||
    drillData?.correct_answer === true;

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const handleSelect = (userChoice: boolean) => {
    if (isCompleted || selectedChoice !== null) return;

    if (userChoice === isTrue) {
      setSelectedChoice(userChoice);
      setErrorMessage(null);
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      onComplete(wrongAttempts, elapsed);
    } else {
      setWrongAttempts((prev) => prev + 1);
      setErrorMessage("Incorrect — rethink the scenario and try the other option!");
      shake();
      setTimeout(() => {
        setErrorMessage(null);
      }, 2500);
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Format & Objective Hint */}
      <View style={styles.topBadgeRow}>
        {/* <View style={styles.formatTag}>
          <MaterialCommunityIcons name="head-heart-outline" size={14} color="#A855F7" />
          <Text style={styles.formatTagText}>VIBE CHECK</Text>
        </View> */}
        <Text style={styles.objectiveText}>Is this statement or scenario True or False?</Text>
      </View>

      {/* Scenario Card with subtle animated shake on mistake */}
      <Animated.View
        style={[
          styles.scenarioCard,
          errorMessage ? styles.scenarioCardError : null,
          { transform: [{ translateX: shakeAnim }] },
        ]}
      >
        <View style={styles.scenarioHeader}>
          <MaterialCommunityIcons name="format-quote-open" size={24} color="#7C3AED" />
          <Text style={styles.scenarioHeaderLabel}>SCENARIO</Text>
        </View>

        <Text style={styles.scenarioText}>{scenario}</Text>

        {/* Error Feedback Message (Light theme warning) */}
        {errorMessage ? (
          <View style={styles.errorNotice}>
            <MaterialCommunityIcons name="alert-circle-outline" size={15} color="#DC2626" />
            <Text style={styles.errorNoticeText}>{errorMessage}</Text>
          </View>
        ) : null}
      </Animated.View>

      {/* Choice Buttons Row */}
      <View style={styles.choicesRow}>
        {/* TRUE Option */}
        <TouchableOpacity
          style={[
            styles.choiceCard,
            styles.choiceCardTrue,
            (selectedChoice === true || (isCompleted && isTrue)) && styles.choiceCardTrueSelected,
            isCompleted && !isTrue && styles.choiceCardDimmed,
          ]}
          disabled={isCompleted || selectedChoice !== null}
          onPress={() => handleSelect(true)}
          activeOpacity={0.82}
        >
          <View
            style={[
              styles.choiceIconCircle,
              styles.choiceIconCircleTrue,
              (selectedChoice === true || (isCompleted && isTrue)) && styles.choiceIconCircleTrueSelected,
            ]}
          >
            <MaterialCommunityIcons
              name="check-bold"
              size={22}
              color={(selectedChoice === true || (isCompleted && isTrue)) ? "#FFFFFF" : "#10B981"}
            />
          </View>
          <Text style={styles.choiceTitle}>TRUE</Text>
          <Text style={styles.choiceSubtitle}>Legit • Valid</Text>
        </TouchableOpacity>

        {/* FALSE Option */}
        <TouchableOpacity
          style={[
            styles.choiceCard,
            styles.choiceCardFalse,
            (selectedChoice === false || (isCompleted && !isTrue)) && styles.choiceCardFalseSelected,
            isCompleted && isTrue && styles.choiceCardDimmed,
          ]}
          disabled={isCompleted || selectedChoice !== null}
          onPress={() => handleSelect(false)}
          activeOpacity={0.82}
        >
          <View
            style={[
              styles.choiceIconCircle,
              styles.choiceIconCircleFalse,
              (selectedChoice === false || (isCompleted && !isTrue)) && styles.choiceIconCircleFalseSelected,
            ]}
          >
            <MaterialCommunityIcons
              name="close-thick"
              size={22}
              color={(selectedChoice === false || (isCompleted && !isTrue)) ? "#FFFFFF" : "#F43F5E"}
            />
          </View>
          <Text style={styles.choiceTitle}>FALSE</Text>
          <Text style={styles.choiceSubtitle}>Risky • Flawed</Text>
        </TouchableOpacity>
      </View>

      {/* Already Completed Notice */}
      {isCompleted && (
        <View style={styles.completedNotice}>
          <MaterialCommunityIcons name="check-circle" size={16} color="#10B981" />
          <Text style={styles.completedNoticeText}>
            Drill Completed • {isTrue ? "Correct answer is True" : "Correct answer is False"}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 18,
  },

  // Top Badge Row
  topBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  formatTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FAF5FF",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E9D5FF",
  },
  formatTagText: {
    color: "#7C3AED",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  objectiveText: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "500",
  },

  // Scenario Card
  scenarioCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 12,
    minHeight: 160,
    justifyContent: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  scenarioCardError: {
    borderColor: "#EF4444",
    backgroundColor: "#FEF2F2",
  },
  scenarioHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  scenarioHeaderLabel: {
    color: "#7C3AED",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  scenarioText: {
    color: "#0F172A",
    fontSize: 17,
    fontWeight: "600",
    lineHeight: 26,
    letterSpacing: 0.2,
  },
  errorNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FECACA",
    marginTop: 4,
  },
  errorNoticeText: {
    color: "#DC2626",
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
  },

  // Choices Row
  choicesRow: {
    flexDirection: "row",
    gap: 14,
  },
  choiceCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingVertical: 22,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },

  // TRUE Styling
  choiceCardTrue: {
    borderColor: "#A7F3D0",
  },
  choiceCardTrueSelected: {
    backgroundColor: "#ECFDF5",
    borderColor: "#10B981",
  },
  choiceIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",
  },
  choiceIconCircleTrue: {
    backgroundColor: "#ECFDF5",
  },
  choiceIconCircleTrueSelected: {
    backgroundColor: "#10B981",
  },

  // FALSE Styling
  choiceCardFalse: {
    borderColor: "#FECDD3",
  },
  choiceCardFalseSelected: {
    backgroundColor: "#FFF1F2",
    borderColor: "#F43F5E",
  },
  choiceIconCircleFalse: {
    backgroundColor: "#FFF1F2",
  },
  choiceIconCircleFalseSelected: {
    backgroundColor: "#F43F5E",
  },

  // Dimmed Card
  choiceCardDimmed: {
    opacity: 0.4,
  },

  // Typography
  choiceTitle: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 1,
  },
  choiceSubtitle: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "600",
  },

  // Completed Notice
  completedNotice: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#ECFDF5",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  completedNoticeText: {
    color: "#059669",
    fontSize: 12,
    fontWeight: "700",
  },
});
