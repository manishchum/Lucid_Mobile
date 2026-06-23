import React from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface NoInternetModalProps {
  visible: boolean;
  onDismiss: () => void;

  contextMessage?: string;
}

export default function NoInternetModal({
  visible,
  onDismiss,
  contextMessage,
}: NoInternetModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons name="wifi-off" size={40} color="#F59E0B" />
          </View>

          <Text style={styles.title}>No Internet Connection</Text>
          <Text style={styles.message}>
            Please check your Wi-Fi or mobile data and try again.
          </Text>

          {contextMessage ? (
            <View style={styles.contextBox}>
              <MaterialCommunityIcons
                name="shield-check-outline"
                size={14}
                color="#065F46"
                style={{ marginRight: 6, flexShrink: 0 }}
              />
              <Text style={styles.contextText}>{contextMessage}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.button}
            onPress={onDismiss}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>OK, Got it</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#FFFBEB",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1E293B",
    marginBottom: 10,
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 16,
  },
  contextBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#D1FAE5",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 20,
    width: "100%",
  },
  contextText: {
    flex: 1,
    fontSize: 13,
    color: "#065F46",
    lineHeight: 19,
    fontWeight: "500",
  },
  button: {
    backgroundColor: "#4F46E5",
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
    marginTop: 4,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});
