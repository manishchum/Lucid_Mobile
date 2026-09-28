import React, { useState } from "react";
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

export default function VibeCheckDrill({
  drillData,
  isCompleted,
  earnedXp,
  onComplete,
}: DrillProps) {
  const [startTime] = useState(Date.now());
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const shakeAnim = useState(new Animated.Value(0))[0];

  const scenario =
    drillData?.scenario ||
    drillData?.statement ||
    drillData?.question ||
    "No scenario provided.";
  
  const isTrue =
    drillData?.is_true === true ||
    drillData?.is_true === "true" ||
    drillData?.correct_answer === true;

  const [isError, setIsError] = useState(false);

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: 10,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -10,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 6,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 0,
        duration: 60,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleSelect = (userChoice: boolean) => {
    if (userChoice === isTrue) {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      onComplete(wrongAttempts, elapsed);
    } else {
      setWrongAttempts((p) => p + 1);
      setIsError(true);
      shake();
      setTimeout(() => setIsError(false), 1000);
    }
  };

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.scenarioBox,
          isError && styles.scenarioBoxError,
          { transform: [{ translateX: shakeAnim }] },
        ]}
      >
        <Text style={styles.scenarioText}>"{scenario}"</Text>
      </Animated.View>

      <View style={styles.buttonsRow}>
        <TouchableOpacity
          style={[
            styles.choiceBtn,
            styles.choiceBtnTrue,
            isCompleted && isTrue && styles.choiceBtnActiveTrue,
            isCompleted && !isTrue && styles.choiceBtnDisabled,
          ]}
          disabled={isCompleted}
          onPress={() => handleSelect(true)}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons 
            name="thumb-up" 
            size={32} 
            color={isCompleted && isTrue ? "#FFF" : "#059669"} 
          />
          <Text style={[
            styles.choiceBtnText,
            { color: isCompleted && isTrue ? "#FFF" : "#059669" }
          ]}>
            True / Pass
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.choiceBtn,
            styles.choiceBtnFalse,
            isCompleted && !isTrue && styles.choiceBtnActiveFalse,
            isCompleted && isTrue && styles.choiceBtnDisabled,
          ]}
          disabled={isCompleted}
          onPress={() => handleSelect(false)}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons 
            name="thumb-down" 
            size={32} 
            color={isCompleted && !isTrue ? "#FFF" : "#E11D48"} 
          />
          <Text style={[
            styles.choiceBtnText,
            { color: isCompleted && !isTrue ? "#FFF" : "#E11D48" }
          ]}>
            False / Fail
          </Text>
        </TouchableOpacity>
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
  container: {
    gap: 24,
  },
  scenarioBox: {
    backgroundColor: GC.surface,
    padding: 24,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: GC.border,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
    minHeight: 160,
    justifyContent: "center",
  },
  scenarioBoxError: {
    borderColor: "#FDA4AF",
    backgroundColor: "#FFF1F2",
  },
  scenarioText: {
    color: GC.textPrimary,
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 28,
  },
  buttonsRow: {
    flexDirection: "row",
    gap: 16,
  },
  choiceBtn: {
    flex: 1,
    padding: 24,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  choiceBtnTrue: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  choiceBtnFalse: {
    backgroundColor: "#FFF1F2",
    borderColor: "#FECDD3",
  },
  choiceBtnActiveTrue: {
    backgroundColor: "#10B981",
    borderColor: "#059669",
  },
  choiceBtnActiveFalse: {
    backgroundColor: "#F43F5E",
    borderColor: "#E11D48",
  },
  choiceBtnDisabled: {
    opacity: 0.5,
    backgroundColor: GC.surface,
    borderColor: GC.border,
  },
  choiceBtnText: {
    fontWeight: "900",
    fontSize: 16,
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
    marginTop: 8,
  },
  successText: {
    color: GC.success,
    fontWeight: "800",
    fontSize: 14,
  },
});
