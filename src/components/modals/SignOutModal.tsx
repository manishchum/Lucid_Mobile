import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
  Animated,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface SignOutModalProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function SignOutModal({
  visible,
  onCancel,
  onConfirm,
}: SignOutModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.card}>
              {/* Header Red Icon Badge */}
              <View style={styles.iconCircle}>
                <MaterialCommunityIcons
                  name="logout"
                  size={28}
                  color="#EF4444"
                />
              </View>

              {/* Title & Body Text */}
              <Text style={styles.title}>Sign Out</Text>
              <Text style={styles.message}>
                Are you sure you want to sign out? You will need to log back in to access your sprints.
              </Text>

              {/* Action Buttons */}
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={onCancel}
                  activeOpacity={0.8}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.signOutButton]}
                  onPress={onConfirm}
                  activeOpacity={0.85}
                >
                  <MaterialCommunityIcons
                    name="logout"
                    size={18}
                    color="#FFFFFF"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.signOutButtonText}>Sign Out</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    // Elevation & Shadows
    elevation: 8,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 8,
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  button: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
  },
  cancelButton: {
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#475569",
  },
  signOutButton: {
    backgroundColor: "#EF4444",
  },
  signOutButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
