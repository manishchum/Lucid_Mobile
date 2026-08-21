import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
  Dimensions,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SWIPE_THRESHOLD = 0.25 * SCREEN_WIDTH;

interface Flashcard {
  heading: string;
  points: string[];
}

type SupportedLang = string;

interface Props {
  isExpanded: boolean;
  onToggle: () => void;
  flashcardData: Flashcard[] | null;
  moduleId?: string | null;
  lang?: SupportedLang;
  isTranslating?: boolean;
}

export default function FlashcardsSection({
  isExpanded,
  onToggle,
  flashcardData,
  moduleId = null,
  lang = "en",
  isTranslating = false,
}: Props) {
  const [cardIdx, setCardIdx] = useState(0);

  const cards = flashcardData ?? [];
  const total = cards.length;
  const current = cards[cardIdx];

  // Reset card index when module or card list changes
  useEffect(() => {
    setCardIdx(0);
  }, [moduleId, flashcardData]);

  // ── Refs so PanResponder always reads the LIVE value, never a stale closure ──
  const cardIdxRef = useRef(0);
  const totalRef = useRef(total);
  cardIdxRef.current = cardIdx;
  totalRef.current = total;

  const position = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const handleResetCard = () => {
    Animated.parallel([
      Animated.spring(position, {
        toValue: 0,
        friction: 5,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const animateToCard = (direction: -1 | 1, newIdx: number) => {
    Animated.parallel([
      Animated.timing(position, {
        toValue: direction * -SCREEN_WIDTH,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCardIdx(newIdx);
      cardIdxRef.current = newIdx;
      // Incoming card starts on the opposite side
      position.setValue(direction * SCREEN_WIDTH);
      Animated.parallel([
        Animated.spring(position, {
          toValue: 0,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const handleNextCard = () => {
    const idx = cardIdxRef.current;
    const tot = totalRef.current;
    // Next → card exits LEFT (-SCREEN_WIDTH), new card enters from RIGHT (+SCREEN_WIDTH)
    if (idx < tot - 1) animateToCard(1, idx + 1);
    else handleResetCard();
  };

  const handlePrevCard = () => {
    const idx = cardIdxRef.current;
    // Prev → card exits RIGHT (+SCREEN_WIDTH), new card enters from LEFT (-SCREEN_WIDTH)
    if (idx > 0) animateToCard(-1, idx - 1);
    else handleResetCard();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 8 && Math.abs(gs.dx) > Math.abs(gs.dy),
      onPanResponderMove: (_, gs) => {
        position.setValue(gs.dx);
      },
      onPanResponderRelease: (_, gs) => {
        const idx = cardIdxRef.current;
        const tot = totalRef.current;
        if (gs.dx > SWIPE_THRESHOLD) {
          // Swiped RIGHT → go to PREVIOUS card (card exits RIGHT, new enters from LEFT)
          if (idx > 0) animateToCard(-1, idx - 1);
          else handleResetCard();
        } else if (gs.dx < -SWIPE_THRESHOLD) {
          // Swiped LEFT → go to NEXT card (card exits LEFT, new enters from RIGHT)
          if (idx < tot - 1) animateToCard(1, idx + 1);
          else handleResetCard();
        } else {
          handleResetCard();
        }
      },
      onPanResponderTerminate: () => handleResetCard(),
    }),
  ).current;

  const animatedStyle = {
    transform: [{ translateX: position }],
    opacity: opacity,
  };

  return (
    <View style={styles.card}>
      <TouchableOpacity onPress={onToggle} style={styles.header}>
        <View style={[styles.iconBox, { backgroundColor: "#ECFDF5" }]}>
          <MaterialCommunityIcons
            name="cards-outline"
            size={22}
            color="#10B981"
          />
        </View>
        <Text style={styles.title}>Flashcards</Text>
        {total > 0 && <Text style={styles.count}>{total} cards</Text>}
        <MaterialCommunityIcons
          name={isExpanded ? "chevron-up" : "chevron-down"}
          size={22}
          color="#94A3B8"
        />
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.body}>
          {isTranslating ? (
            <View style={[styles.emptyState, { minHeight: 200, justifyContent: 'center', alignItems: 'center' }]}>
              <ActivityIndicator size="large" color="#10B981" />
              <Text style={[styles.emptyText, { marginTop: 12 }]}>Translating flashcards...</Text>
            </View>
          ) : total === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No flashcards available.</Text>
            </View>
          ) : (
            <>
              {/* FIXED HEIGHT CAROUSEL WRAPPER */}
              <View style={styles.carouselContainer}>
                <Animated.View
                  style={[styles.flashcard, animatedStyle]}
                  {...panResponder.panHandlers}
                >
                  <View style={styles.topicHeader}>
                    <Text style={styles.tag}>TOPIC</Text>
                    <Text
                      style={styles.mainText}
                      numberOfLines={2}
                      adjustsFontSizeToFit
                    >
                      {current.heading}
                    </Text>
                  </View>

                  <View style={styles.divider} />

                  <ScrollView
                    style={styles.pointsScroll}
                    showsVerticalScrollIndicator={false}
                    nestedScrollEnabled
                  >
                    <View style={styles.pointsList}>
                      {current.points.map((point, i) => (
                        <View key={i} style={styles.pointRow}>
                          <Text style={styles.pointBullet}>•</Text>
                          <Text style={styles.pointText}>{point}</Text>
                        </View>
                      ))}
                    </View>
                  </ScrollView>

                  <View style={styles.swipeHintRow}>
                    <MaterialCommunityIcons
                      name="gesture-swipe-horizontal"
                      size={16}
                      color="#A7F3D0"
                    />
                    <Text style={styles.swipeHint}>
                      Swipe left / right to browse
                    </Text>
                  </View>
                </Animated.View>
              </View>

              <View style={styles.controls}>
                <TouchableOpacity
                  style={[styles.ctrl, cardIdx === 0 && styles.ctrlDisabled]}
                  onPress={handlePrevCard}
                  disabled={cardIdx === 0}
                >
                  <MaterialCommunityIcons
                    name="chevron-left"
                    size={24}
                    color={cardIdx === 0 ? "#CBD5E1" : "#1E293B"}
                  />
                </TouchableOpacity>
                <Text style={styles.pageCount}>
                  {cardIdx + 1} / {total}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.ctrl,
                    cardIdx === total - 1 && styles.ctrlDisabled,
                  ]}
                  onPress={handleNextCard}
                  disabled={cardIdx === total - 1}
                >
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={24}
                    color={cardIdx === total - 1 ? "#CBD5E1" : "#1E293B"}
                  />
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "white",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
  },
  header: { flexDirection: "row", alignItems: "center", padding: 16, gap: 12 },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { flex: 1, fontSize: 16, fontWeight: "700", color: "#1E293B" },
  count: { fontSize: 12, color: "#64748B", fontWeight: "600", marginRight: 4 },

  body: { padding: 16, paddingTop: 0 },
  emptyState: { alignItems: "center", paddingVertical: 30 },
  emptyText: { color: "#94A3B8", fontSize: 14 },

  /* ENFORCED FIXED HEIGHT ELEMENT */
  carouselContainer: { height: 280, borderRadius: 24 },
  flashcard: {
    flex: 1,
    backgroundColor: "#10B981",
    borderRadius: 24,
    padding: 20,
    justifyContent: "flex-start",
    alignItems: "stretch",
    elevation: 2,
    shadowColor: "#064E3B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  topicHeader: {
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
  },
  tag: {
    fontSize: 10,
    fontWeight: "800",
    color: "#D1FAE5",
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  mainText: {
    fontSize: 16,
    fontWeight: "800",
    color: "white",
    textAlign: "center",
    lineHeight: 22,
  },

  divider: {
    height: 1,
    backgroundColor: "#10B981",
    borderBottomWidth: 1,
    borderBottomColor: "#A7F3D0",
    opacity: 0.3,
    marginVertical: 10,
  },

  pointsScroll: { flex: 1 },
  pointsList: { gap: 8, paddingBottom: 4 },
  pointRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  pointBullet: {
    color: "#D1FAE5",
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "700",
  },
  pointText: {
    flex: 1,
    color: "white",
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "500",
  },

  swipeHintRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    opacity: 0.85,
  },
  swipeHint: { color: "#D1FAE5", fontSize: 11, fontWeight: "600" },

  controls: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 30,
    marginTop: 16,
  },
  ctrl: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },
  ctrlDisabled: { opacity: 0.4 },
  pageCount: { fontSize: 14, fontWeight: "700", color: "#64748B" },
});
