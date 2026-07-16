import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Animated,
  Linking,
  Alert,
  Platform,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

// ─── Constants ────────────────────────────────────────────────────────────────

const STAR_COUNT = 5;

const LABELS: Record<number, string> = {
  1: "Poor",
  2: "Fair",
  3: "Good",
  4: "Great",
  5: "Excellent!",
};

const CONTEXT_TEXT: Record<number, string> = {
  0: "Your feedback makes Lucid better for everyone.",
  1: "We're sorry to hear that. Tell us what went wrong.",
  2: "We can do better! Share what's missing.",
  3: "Thanks! What could we improve to earn 5 stars?",
  4: "We're glad you're enjoying it! ✨",
  5: "We're so glad you're enjoying Lucid! Your support helps us grow. 🚀",
};

// Replace with your actual Play Store / App Store listing IDs
const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.workfloww.lucidmobile";
const APP_STORE_URL =
  "itms-apps://itunes.apple.com/app/idYOUR_APP_ID?action=write-review";

// WhatsApp number for bug reports (already used in ProfileScreen)
const WHATSAPP_BUG_URL = "https://wa.me/919211540400";

// ─── Component ────────────────────────────────────────────────────────────────

export default function FeedbackCard() {
  const [selectedStars, setSelectedStars] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [bugText, setBugText] = useState("");
  const [sendingBug, setSendingBug] = useState(false);

  // One Animated.Value per star for the spring bounce
  const scaleAnims = useRef(
    Array.from({ length: STAR_COUNT }, () => new Animated.Value(1))
  ).current;

  // Guard setState calls if the component unmounts before timers fire
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleStarPress = (star: number) => {
    setSelectedStars(star);

    // Spring bounce on the tapped star
    const anim = scaleAnims[star - 1];
    Animated.sequence([
      Animated.spring(anim, {
        toValue: 1.45,
        useNativeDriver: true,
        speed: 400,
        bounciness: 18,
      }),
      Animated.spring(anim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 300,
        bounciness: 10,
      }),
    ]).start();

    // Auto-submit for 4 or 5 stars — no Submit button needed
    if (star >= 4) {
      setTimeout(() => {
        if (isMountedRef.current) setSubmitted(true);
      }, 300);
    }
  };

  const handleOpenStore = async () => {
    const url = Platform.OS === "ios" ? APP_STORE_URL : PLAY_STORE_URL;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("Oops", "Could not open the store. Please try manually.");
    }
  };

  const handleSendBugReport = async () => {
    if (!bugText.trim()) {
      Alert.alert("Empty Report", "Please describe the issue before sending.");
      return;
    }
    setSendingBug(true);
    try {
      const message = encodeURIComponent(
        `[Lucid Bug Report]\n${bugText.trim()}`
      );
      await Linking.openURL(`${WHATSAPP_BUG_URL}?text=${message}`);
      setSubmitted(true);
    } catch {
      Alert.alert("Error", "Could not open WhatsApp.");
    } finally {
      setSendingBug(false);
    }
  };

  // ── POST-SUBMISSION state ──────────────────────────────────────────────────
  if (submitted) {
    return (
      <View style={styles.card}>
        <View style={styles.thankYouRow}>
          <MaterialCommunityIcons
            name="heart"
            size={28}
            color="#EF4444"
          />
          <Text style={styles.thankYouTitle}>
            {selectedStars >= 4 ? "You're amazing! 🎉" : "Thanks for telling us!"}
          </Text>
        </View>
        <Text style={styles.thankYouSub}>
          {selectedStars >= 4
            ? "Would you mind sharing that on the Play Store? It only takes a second."
            : "We'll review your feedback and use it to improve Lucid."}
        </Text>
        {selectedStars >= 4 && (
          <TouchableOpacity
            style={styles.storeBtn}
            onPress={handleOpenStore}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons
              name={Platform.OS === "ios" ? "apple" : "google-play"}
              size={18}
              color="#fff"
            />
            <Text style={styles.storeBtnText}>
              {Platform.OS === "ios" ? "Rate on App Store" : "Rate on Play Store"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // ── MAIN CARD ──────────────────────────────────────────────────────────────
  return (
    <View style={styles.card}>
      {/* Title row */}
      <View style={styles.titleRow}>
        <MaterialCommunityIcons name="star-circle" size={22} color="#4F46E5" />
        <Text style={styles.cardTitle}>How are we doing?</Text>
      </View>

      {/* Contextual sub-text */}
      <Text style={styles.contextText}>{CONTEXT_TEXT[selectedStars]}</Text>

      {/* Stars */}
      <View style={styles.starsRow}>
        {Array.from({ length: STAR_COUNT }, (_, i) => {
          const star = i + 1;
          const isFilled = star <= selectedStars;
          return (
            <TouchableOpacity
              key={star}
              onPress={() => handleStarPress(star)}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            >
              <Animated.View style={{ transform: [{ scale: scaleAnims[i] }] }}>
                <MaterialCommunityIcons
                  name={isFilled ? "star" : "star-outline"}
                  size={42}
                  color={isFilled ? "#F59E0B" : "#CBD5E1"}
                />
              </Animated.View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Emotional label */}
      {selectedStars > 0 && (
        <Text style={styles.emotionalLabel}>{LABELS[selectedStars]}</Text>
      )}

      {/* Low-rating bug report form (1–3 stars) */}
      {selectedStars > 0 && selectedStars <= 3 && (
        <View style={styles.bugSection}>
          <TextInput
            style={styles.bugInput}
            placeholder="Tell us what went wrong..."
            placeholderTextColor="#94A3B8"
            multiline
            numberOfLines={3}
            value={bugText}
            onChangeText={setBugText}
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={[
              styles.bugSendBtn,
              !bugText.trim() && styles.bugSendBtnDisabled,
            ]}
            onPress={handleSendBugReport}
            disabled={!bugText.trim() || sendingBug}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="send" size={16} color="#fff" />
            <Text style={styles.bugSendBtnText}>
              {sendingBug ? "Sending…" : "Send Report"}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#EEF2FF",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
  },
  contextText: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 19,
    marginBottom: 16,
  },
  starsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 4,
    marginBottom: 10,
  },
  emotionalLabel: {
    textAlign: "center",
    fontSize: 14,
    fontWeight: "700",
    color: "#F59E0B",
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  // Bug report
  bugSection: {
    gap: 10,
  },
  bugInput: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    fontSize: 14,
    color: "#1E293B",
    minHeight: 80,
  },
  bugSendBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#4F46E5",
    borderRadius: 10,
    paddingVertical: 12,
  },
  bugSendBtnDisabled: {
    backgroundColor: "#C7D2FE",
  },
  bugSendBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  // Thank-you state
  thankYouRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  thankYouTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
  },
  thankYouSub: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 19,
    marginBottom: 16,
  },
  storeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#10B981",
    borderRadius: 10,
    paddingVertical: 12,
  },
  storeBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
});
