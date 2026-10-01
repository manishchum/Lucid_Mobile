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

interface ItemNode {
  id: number;
  text: string;
}

type SelectedCard = {
  column: "left" | "right";
  id: number;
} | null;

export default function RiskRizzDrill({
  drillData,
  isCompleted,
  earnedXp,
  onComplete,
}: DrillProps) {
  const [startTime] = useState(Date.now());
  const [wrongAttempts, setWrongAttempts] = useState(0);

  const rawPairs = Array.isArray(drillData?.pairs) ? drillData.pairs : [];

  const [leftItems] = useState<ItemNode[]>(() =>
    rawPairs
      .map((p: any, i: number) => ({
        id: i,
        text: p.left || p.term || p.risk || p.title || p.scenario || `Risk ${i + 1}`,
      }))
      .sort(() => (isCompleted ? 0 : Math.random() - 0.5))
  );

  const [rightItems] = useState<ItemNode[]>(() =>
    rawPairs
      .map((p: any, i: number) => ({
        id: i,
        text:
          p.right ||
          p.definition ||
          p.mitigation ||
          p.response ||
          p.match ||
          p.answer ||
          `Mitigation ${i + 1}`,
      }))
      .sort(() => (isCompleted ? 0 : Math.random() - 0.5))
  );

  const [selectedCard, setSelectedCard] = useState<SelectedCard>(null);
  const [matchedPairs, setMatchedPairs] = useState<number[]>([]);
  const [errorPair, setErrorPair] = useState<{ left: number; right: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Auto-complete state when already completed
  useEffect(() => {
    if (isCompleted) {
      setMatchedPairs(rawPairs.map((_: any, i: number) => i));
    }
  }, [isCompleted, rawPairs.length]);

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 7, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -7, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 5, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -5, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();
  };

  // Bi-directional card selection: user can tap either column first!
  const handleCardPress = (column: "left" | "right", id: number) => {
    if (isCompleted || matchedPairs.includes(id)) return;
    if (errorPair) return; // Prevent tapping while error shake is active

    setErrorMessage(null);

    // If nothing selected yet, select this card
    if (!selectedCard) {
      setSelectedCard({ column, id });
      return;
    }

    // If tapping a card in the SAME column:
    if (selectedCard.column === column) {
      if (selectedCard.id === id) {
        // Deselect if tapping the same card again
        setSelectedCard(null);
      } else {
        // Switch selection to the newly tapped card
        setSelectedCard({ column, id });
      }
      return;
    }

    // Tapping a card in the OPPOSITE column: test match!
    const leftId = column === "right" ? selectedCard.id : id;
    const rightId = column === "right" ? id : selectedCard.id;

    if (leftId === rightId) {
      // Correct Match!
      const newMatches = [...matchedPairs, leftId];
      setMatchedPairs(newMatches);
      setSelectedCard(null);
      setErrorMessage(null);

      // Trigger completion instantly when all pairs matched
      if (newMatches.length === rawPairs.length) {
        const timeSecs = Math.max(1, Math.floor((Date.now() - startTime) / 1000));
        onComplete(wrongAttempts, timeSecs);
      }
    } else {
      // Mismatch
      setWrongAttempts((prev) => prev + 1);
      setErrorPair({ left: leftId, right: rightId });
      setErrorMessage("Not a match — try a different pairing!");
      triggerShake();

      setTimeout(() => {
        setErrorPair(null);
        setSelectedCard(null);
        setErrorMessage(null);
      }, 700);
    }
  };

  if (rawPairs.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <MaterialCommunityIcons name="alert-circle-outline" size={24} color="#F59E0B" />
        <Text style={styles.emptyCardText}>No pairs available for this drill.</Text>
      </View>
    );
  }

  const matchProgress = rawPairs.length > 0 ? (matchedPairs.length / rawPairs.length) * 100 : 0;
  const isAllMatched = matchedPairs.length === rawPairs.length;
  const totalRows = Math.max(leftItems.length, rightItems.length);

  const renderCard = (column: "left" | "right", item: ItemNode) => {
    const isMatched = matchedPairs.includes(item.id);
    const isSelected = selectedCard?.column === column && selectedCard?.id === item.id;
    const isOppositeSelected =
      selectedCard !== null && selectedCard.column !== column && !isMatched;
    const isError =
      column === "left" ? errorPair?.left === item.id : errorPair?.right === item.id;

    return (
      <TouchableOpacity
        key={`${column}-${item.id}`}
        style={[
          styles.itemCard,
          isSelected && styles.itemCardSelected,
          isMatched && styles.itemCardMatched,
          isOppositeSelected && styles.itemCardReadyToMatch,
          isError && styles.itemCardError,
        ]}
        disabled={isMatched || isCompleted}
        onPress={() => handleCardPress(column, item.id)}
        activeOpacity={0.78}
      >
        <View style={styles.cardContentRow}>
          <Text
            style={[
              styles.itemText,
              isSelected && styles.itemTextSelected,
              isMatched && styles.itemTextMatched,
              isError && styles.itemTextError,
            ]}
          >
            {item.text}
          </Text>
          <View style={styles.iconBox}>
            {isMatched ? (
              <MaterialCommunityIcons name="check-circle" size={16} color="#10B981" />
            ) : isSelected ? (
              <MaterialCommunityIcons name="radiobox-marked" size={16} color="#7C3AED" />
            ) : (
              <View style={styles.iconPlaceholder} />
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Header & Match Progress Card */}
      <View style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <View style={styles.progressTitleGroup}>
            <MaterialCommunityIcons
              name="link-variant"
              size={16}
              color={isAllMatched ? "#10B981" : "#7C3AED"}
            />
            <Text style={styles.progressLabel}>
              {isAllMatched ? "All Pairs Matched!" : "Match Risk & Mitigation"}
            </Text>
          </View>

          <View
            style={[
              styles.progressCounterPill,
              isAllMatched && styles.progressCounterPillCompleted,
            ]}
          >
            <MaterialCommunityIcons
              name={isAllMatched ? "check-circle" : "checkbox-marked-circle-outline"}
              size={13}
              color={isAllMatched ? "#10B981" : "#7C3AED"}
            />
            <Text
              style={[
                styles.progressCounterText,
                isAllMatched && styles.progressCounterTextCompleted,
              ]}
            >
              {matchedPairs.length} / {rawPairs.length}
            </Text>
          </View>
        </View>

        {/* Progress Bar Track */}
        <View style={styles.progressBarTrack}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${matchProgress}%` },
              isAllMatched && styles.progressBarFillCompleted,
            ]}
          />
        </View>

        {/* Contextual Dynamic Guidance */}
        <Text style={[styles.hintText, errorMessage ? styles.hintTextError : null]}>
          {errorMessage ||
            (isAllMatched
              ? "All pairs successfully resolved!"
              : selectedCard
              ? "Selected. Now tap its match in the other column →"
              : "Tap any risk or mitigation card to begin pairing.")}
        </Text>
      </View>

      {/* Grid Container with Shake Animation on Mismatch */}
      <Animated.View
        style={[
          styles.gridContainer,
          { transform: [{ translateX: shakeAnim }] },
        ]}
      >
        {/* Column Headers Row */}
        <View style={styles.columnHeaderRow}>
          <View style={styles.columnHeader}>
            <MaterialCommunityIcons name="shield-alert-outline" size={13} color="#7C3AED" />
            <Text style={styles.columnTitle}>RISK / SCENARIO</Text>
          </View>
          <View style={styles.columnHeader}>
            <MaterialCommunityIcons name="shield-check-outline" size={13} color="#10B981" />
            <Text style={styles.columnTitle}>DEFENSE / ACTION</Text>
          </View>
        </View>

        {/* Equal Rows (Left and Right cards match exact height and width in each row) */}
        {Array.from({ length: totalRows }).map((_, idx) => {
          const leftItem = leftItems[idx];
          const rightItem = rightItems[idx];

          return (
            <View key={`row-${idx}`} style={styles.cardsRow}>
              {leftItem ? renderCard("left", leftItem) : <View style={styles.itemCardDummy} />}
              {rightItem ? renderCard("right", rightItem) : <View style={styles.itemCardDummy} />}
            </View>
          );
        })}
      </Animated.View>

      {/* Completion Banner */}
      {isCompleted && (
        <View style={styles.completedNotice}>
          <MaterialCommunityIcons name="check-circle" size={16} color="#10B981" />
          <Text style={styles.completedNoticeText}>
            Drill Completed • {rawPairs.length} pairs matched (+{earnedXp || 0} XP)
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

  // Empty State Card
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
  },
  progressLabel: {
    color: "#0F172A",
    fontSize: 13,
    fontWeight: "700",
  },
  progressCounterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FAF5FF",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E9D5FF",
  },
  progressCounterPillCompleted: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  progressCounterText: {
    color: "#7C3AED",
    fontSize: 12,
    fontWeight: "900",
  },
  progressCounterTextCompleted: {
    color: "#059669",
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: "#E2E8F0",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#7C3AED",
    borderRadius: 3,
  },
  progressBarFillCompleted: {
    backgroundColor: "#10B981",
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

  // Grid Layout
  gridContainer: {
    gap: 10,
  },
  columnHeaderRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 2,
  },
  columnHeader: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 2,
  },
  columnTitle: {
    color: "#64748B",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  cardsRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "stretch", // Ensures both cards in the row have the exact same height
  },

  // Card Structure & Sizing (Uniform across Left & Right)
  itemCard: {
    flex: 1, // Exactly 50% width each (minus gap)
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    minHeight: 88, // Consistent uniform baseline height
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  itemCardDummy: {
    flex: 1,
  },
  cardContentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    flex: 1,
  },
  itemText: {
    color: "#1E293B",
    fontSize: 12.5,
    fontWeight: "600",
    lineHeight: 17,
    flex: 1,
  },
  iconBox: {
    width: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  iconPlaceholder: {
    width: 16,
    height: 16,
  },

  // Active Selected State
  itemCardSelected: {
    backgroundColor: "#FAF5FF",
    borderColor: "#7C3AED",
    borderWidth: 2,
  },
  itemTextSelected: {
    color: "#7C3AED",
    fontWeight: "700",
  },

  // Ready To Match State
  itemCardReadyToMatch: {
    borderColor: "#DDD6FE",
  },

  // Matched State (Subtle Emerald + Dimmed)
  itemCardMatched: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
    opacity: 0.8,
  },
  itemTextMatched: {
    color: "#059669",
  },

  // Error State (Red feedback)
  itemCardError: {
    backgroundColor: "#FEF2F2",
    borderColor: "#EF4444",
  },
  itemTextError: {
    color: "#DC2626",
  },

  // Completed Notice
  completedNotice: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#ECFDF5",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    marginTop: 2,
  },
  completedNoticeText: {
    color: "#059669",
    fontSize: 12,
    fontWeight: "700",
  },
});
