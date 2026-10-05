import React, { useState, useEffect, useRef } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Animated,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../../contex/AuthContext";
import { getFirebaseToken } from "../../api/users/Request";
import { logger } from "../../utils/UnifiedLogger";

const EXPO_API_URL = process.env.EXPO_PUBLIC_API_URL || "https://api.workfloww.ai";
const API_BASE_URL = `${EXPO_API_URL}/api`;

interface FeedbackBottomSheetProps {
  visible: boolean;
  moduleId: string;
  moduleType: string;
  title: string;
  onClose: () => void;
  onSubmitSuccess: () => void;
}

export const FeedbackBottomSheet: React.FC<FeedbackBottomSheetProps> = ({
  visible,
  moduleId,
  moduleType,
  title,
  onClose,
  onSubmitSuccess,
}) => {
  const { cachedUser } = useAuth();
  const [rating, setRating] = useState<number>(0);
  const [thumbsUp, setThumbsUp] = useState<boolean | null>(null);
  const [comments, setComments] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const slideAnim = useRef(new Animated.Value(300)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 300,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleSubmit = async () => {
    if (!cachedUser?.userId || !moduleId) return;
    
    setIsSubmitting(true);
    try {
      const token = await getFirebaseToken().catch(() => null);
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      headers["X-User-ID"] = cachedUser.userId;

      // Submit feedback to the backend API endpoint
      const response = await fetch(`${API_BASE_URL}/notifications/feedback`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          module_id: moduleId,
          module_type: moduleType,
          rating: rating > 0 ? rating : null,
          thumbs_up: thumbsUp,
          comments: comments.trim(),
        }),
      });

      if (response.ok) {
        logger.info("[Feedback] Successfully submitted feedback.");
        onSubmitSuccess();
        // Reset state
        setRating(0);
        setThumbsUp(null);
        setComments("");
      } else {
        logger.warn("[Feedback] Failed to submit:", await response.text());
        // Fallback closing on error to not block UI
        onSubmitSuccess(); 
      }
    } catch (e) {
      logger.error("[Feedback] Error submitting:", e);
      onSubmitSuccess();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!visible && slideAnim.setOffset === undefined) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalOverlay}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
              <TouchableOpacity style={styles.backdropTouch} onPress={onClose} activeOpacity={1} />
            </Animated.View>

            <Animated.View
              style={[
                styles.bottomSheet,
                { transform: [{ translateY: slideAnim }] },
              ]}
            >
              <View style={styles.dragHandle} />
              
              <Text style={styles.title}>How was this module?</Text>
              <Text style={styles.subtitle}>{title}</Text>

              {/* Thumbs Feedback */}
              <View style={styles.thumbsContainer}>
                <TouchableOpacity
                  style={[styles.thumbBtn, thumbsUp === true && styles.thumbBtnActive]}
                  onPress={() => setThumbsUp(true)}
                >
                  <MaterialCommunityIcons
                    name={thumbsUp === true ? "thumb-up" : "thumb-up-outline"}
                    size={28}
                    color={thumbsUp === true ? "#2563eb" : "#64748b"}
                  />
                  <Text style={[styles.thumbText, thumbsUp === true && { color: "#2563eb" }]}>Helpful</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.thumbBtn, thumbsUp === false && styles.thumbBtnActiveDown]}
                  onPress={() => setThumbsUp(false)}
                >
                  <MaterialCommunityIcons
                    name={thumbsUp === false ? "thumb-down" : "thumb-down-outline"}
                    size={28}
                    color={thumbsUp === false ? "#ef4444" : "#64748b"}
                  />
                  <Text style={[styles.thumbText, thumbsUp === false && { color: "#ef4444" }]}>Needs Work</Text>
                </TouchableOpacity>
              </View>

              {/* Star Rating */}
              <Text style={styles.sectionLabel}>Rate your experience</Text>
              <View style={styles.starsContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity key={star} onPress={() => setRating(star)}>
                    <MaterialCommunityIcons
                      name={star <= rating ? "star" : "star-outline"}
                      size={36}
                      color={star <= rating ? "#fbbf24" : "#cbd5e1"}
                      style={styles.starIcon}
                    />
                  </TouchableOpacity>
                ))}
              </View>

              {/* Comments */}
              <Text style={styles.sectionLabel}>Additional Comments</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Share your thoughts (optional)..."
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={3}
                value={comments}
                onChangeText={setComments}
              />

              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  (!rating && thumbsUp === null && !comments.trim()) && styles.submitBtnDisabled,
                ]}
                onPress={handleSubmit}
                disabled={isSubmitting || (!rating && thumbsUp === null && !comments.trim())}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Submit Feedback</Text>
                )}
              </TouchableOpacity>
            </Animated.View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...(StyleSheet.absoluteFill as any),
    backgroundColor: "rgba(15, 23, 42, 0.4)",
  },
  backdropTouch: {
    flex: 1,
  },
  bottomSheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
    paddingTop: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 20,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#cbd5e1",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 24,
    marginTop: 4,
  },
  thumbsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    marginBottom: 24,
  },
  thumbBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 8,
  },
  thumbBtnActive: {
    backgroundColor: "#eff6ff",
    borderColor: "#bfdbfe",
  },
  thumbBtnActiveDown: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
  },
  thumbText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#475569",
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 12,
  },
  starsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 24,
    gap: 8,
  },
  starIcon: {
    marginHorizontal: 4,
  },
  textInput: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: "#0f172a",
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: 24,
  },
  submitBtn: {
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnDisabled: {
    backgroundColor: "#94a3b8",
  },
  submitBtnText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});
