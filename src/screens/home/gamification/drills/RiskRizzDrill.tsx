import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  PanResponder,
  Animated,
  Dimensions,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { GC } from "./GamificationColors";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;

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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | null>(null);
  const translateX = useRef(new Animated.Value(0)).current;
  const rotate = translateX.interpolate({
    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
    outputRange: ["-15deg", "0deg", "15deg"],
  });

  const statements: any[] = Array.isArray(drillData?.statements)
    ? drillData.statements
    : Array.isArray(drillData?.pairs)
    ? drillData.pairs.map((p: any) => ({
        statement: p.left || p.term || "",
        is_compliant: false,
        correct_action: p.right || p.definition || "",
      }))
    : drillData?.statement
    ? [drillData]
    : [];

  const total = statements.length;
  const done = currentIndex >= total;

  useEffect(() => {
    if (done) {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      onComplete(wrongAttempts, elapsed);
    }
  }, [done]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 5 && !isCompleted,
      onPanResponderMove: (_, g) => {
        translateX.setValue(g.dx);
        setSwipeDirection(g.dx > 0 ? "right" : "left");
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx > SWIPE_THRESHOLD) {
          handleSwipe("right");
        } else if (g.dx < -SWIPE_THRESHOLD) {
          handleSwipe("left");
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
          setSwipeDirection(null);
        }
      },
    })
  ).current;

  const handleSwipe = (direction: "left" | "right") => {
    const current = statements[currentIndex];
    const correct = current?.is_compliant === true ? "right" : "left";
    const toX = direction === "right" ? SCREEN_WIDTH * 1.5 : -SCREEN_WIDTH * 1.5;

    Animated.timing(translateX, {
      toValue: toX,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      if (direction !== correct) {
        setWrongAttempts((p) => p + 1);
      }
      translateX.setValue(0);
      setSwipeDirection(null);
      setCurrentIndex((p) => p + 1);
    });
  };

  if (statements.length === 0) {
    return (
      <View style={styles.emptyBox}>
        <Text style={styles.emptyText}>Invalid drill data. Please regenerate.</Text>
      </View>
    );
  }

  if (isCompleted || done) {
    return (
      <View style={styles.completedBox}>
        <MaterialCommunityIcons name="check-circle" size={40} color={GC.success} />
        <Text style={styles.completedText}>All cards judged correctly!</Text>
      </View>
    );
  }

  const current = statements[currentIndex];

  return (
    <View style={styles.container}>
      <View style={styles.progressRow}>
        <Text style={styles.progressText}>
          {currentIndex + 1} / {total}
        </Text>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${((currentIndex) / total) * 100}%` },
            ]}
          />
        </View>
      </View>

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <MaterialCommunityIcons name="arrow-left-circle" size={18} color={GC.danger} />
          <Text style={styles.legendLabel}>VIOLATION</Text>
        </View>
        <View style={styles.legendItem}>
          <Text style={styles.legendLabel}>COMPLIANT</Text>
          <MaterialCommunityIcons name="arrow-right-circle" size={18} color={GC.success} />
        </View>
      </View>

      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.card,
          {
            transform: [{ translateX }, { rotate }],
            borderColor:
              swipeDirection === "right"
                ? GC.success
                : swipeDirection === "left"
                ? GC.danger
                : GC.border,
          },
        ]}
      >
        {swipeDirection === "right" && (
          <View style={[styles.swipeLabel, styles.rightLabel]}>
            <Text style={styles.swipeLabelText}>PASS ✅</Text>
          </View>
        )}
        {swipeDirection === "left" && (
          <View style={[styles.swipeLabel, styles.leftLabel]}>
            <Text style={styles.swipeLabelText}>FLAG 🚩</Text>
          </View>
        )}
        <Text style={styles.statementText}>{current?.statement || current?.left || current?.term}</Text>
        {current?.violation_category && (
          <Text style={styles.categoryChip}>{current.violation_category}</Text>
        )}
      </Animated.View>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.btnFlag} onPress={() => handleSwipe("left")}>
          <MaterialCommunityIcons name="flag" size={22} color={GC.danger} />
          <Text style={[styles.btnLabel, { color: GC.danger }]}>VIOLATION</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnPass} onPress={() => handleSwipe("right")}>
          <MaterialCommunityIcons name="check-bold" size={22} color={GC.success} />
          <Text style={[styles.btnLabel, { color: GC.success }]}>COMPLIANT</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  emptyBox: {
    padding: 24,
    backgroundColor: "#2D0808",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GC.danger,
  },
  emptyText: { color: GC.danger, fontSize: 14, fontWeight: "600" },
  completedBox: {
    alignItems: "center",
    padding: 32,
    gap: 12,
    backgroundColor: GC.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: GC.success,
  },
  completedText: {
    color: GC.success,
    fontSize: 16,
    fontWeight: "700",
  },
  progressRow: { gap: 8 },
  progressText: {
    color: GC.textMuted,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
  },
  progressBar: {
    height: 4,
    backgroundColor: GC.border,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: GC.primary,
    borderRadius: 4,
  },
  legendRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendLabel: {
    color: GC.textMuted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  card: {
    backgroundColor: GC.card,
    borderRadius: 20,
    borderWidth: 2,
    padding: 28,
    minHeight: 180,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    shadowColor: GC.primary,
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  statementText: {
    color: GC.textPrimary,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 26,
  },
  categoryChip: {
    marginTop: 12,
    color: GC.textMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    backgroundColor: GC.cardAlt,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: GC.border,
  },
  swipeLabel: {
    position: "absolute",
    top: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 2,
  },
  rightLabel: {
    right: 12,
    backgroundColor: "#052E16",
    borderColor: GC.success,
  },
  leftLabel: {
    left: 12,
    backgroundColor: "#2D0808",
    borderColor: GC.danger,
  },
  swipeLabelText: {
    color: GC.textPrimary,
    fontSize: 13,
    fontWeight: "900",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  btnFlag: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    backgroundColor: "#2D0808",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: GC.danger,
  },
  btnPass: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    backgroundColor: "#052E16",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: GC.success,
  },
  btnLabel: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1,
  },
});
