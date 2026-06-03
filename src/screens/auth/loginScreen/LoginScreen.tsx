import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Modal,
  StyleSheet,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../../../contex/AuthContext";
import styles from "./style";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

export default function LoginScreen() {
  const { phoneNumber, setPhoneNumber, sendOTP, checkUserExists } = useAuth();
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showNotRegisteredModal, setShowNotRegisteredModal] = useState(false);
  const insets = useSafeAreaInsets();

  const handleSendCode = async () => {
    setError("");

    if (phoneNumber.length !== 10) {
      setError("Please enter exactly 10 digits");
      return;
    }

    setIsLoading(true);

    // Step 1: Verify the phone number exists in the backend AND is active
    const user = await checkUserExists(phoneNumber);

    if (!user) {
      // Show modal instead of inline error — makes it clear this is an
      // admin-side issue, not a typo
      setShowNotRegisteredModal(true);
      setIsLoading(false);
      return;
    }

    // Step 2: User is verified and active — safe to send OTP
    const success = await sendOTP();
    if (!success) {
      setError("Failed to send OTP. Please try again.");
    }

    setIsLoading(false);
  };

  const isButtonDisabled = phoneNumber.length !== 10 || isLoading;

  return (
    <>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[styles.container, { paddingTop: insets.top }]}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
          {/* Header */}
          <View style={styles.topSection}>
            <View style={styles.circle1} />
            <View style={styles.circle2} />
            <View style={styles.headerTextContainer}>
              <Text style={styles.welcomeText}>Welcome to</Text>
              <Text style={styles.brandName}>Lucid</Text>
            </View>
          </View>

          {/* Form */}
          <View style={styles.formCard}>
            <Text style={styles.title}>Sign In</Text>
            <Text style={styles.subtitle}>Enter your mobile number</Text>

            <View style={styles.inputLabelRow}>
              <Text style={styles.label}>Phone Number</Text>
              {error ? <Text style={styles.errorTextInline}>{error}</Text> : null}
            </View>

            <View style={[styles.inputContainer, error && styles.inputError]}>
              <View style={styles.countryPicker}>
                <Text style={styles.flag}>🇮🇳</Text>
                <Text style={styles.countryCode}>+91</Text>
                <View style={styles.divider} />
              </View>

              <TextInput
                style={styles.input}
                keyboardType="phone-pad"
                value={phoneNumber}
                onChangeText={(txt) =>
                  setPhoneNumber(txt.replace(/[^0-9]/g, ""))
                }
                maxLength={10}
                placeholder="Enter phone number"
              />
            </View>

            <TouchableOpacity
              style={[
                styles.primaryButton,
                isButtonDisabled && styles.buttonDisabled,
              ]}
              onPress={handleSendCode}
              disabled={isButtonDisabled}
            >
              {isLoading ? (
                <Text style={styles.buttonText}>Checking...</Text>
              ) : (
                <View style={styles.buttonContent}>
                  <Text style={styles.buttonText}>Get OTP</Text>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={24}
                    color="#fff"
                  />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Not Registered Modal */}
      <Modal
        visible={showNotRegisteredModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNotRegisteredModal(false)}
      >
        <View style={modalStyles.overlay}>
          <View style={modalStyles.card}>
            <View style={modalStyles.iconContainer}>
              <MaterialCommunityIcons
                name="account-off-outline"
                size={40}
                color="#EF4444"
              />
            </View>

            <Text style={modalStyles.title}>Not Registered</Text>
            <Text style={modalStyles.message}>
              The number{" "}
              <Text style={modalStyles.phoneHighlight}>+91 {phoneNumber}</Text>{" "}
              is not registered with Lucid. Please contact your administrator to
              get access.
            </Text>

            <TouchableOpacity
              style={modalStyles.button}
              onPress={() => setShowNotRegisteredModal(false)}
            >
              <Text style={modalStyles.buttonText}>OK, Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const modalStyles = StyleSheet.create({
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
    backgroundColor: "#FEF2F2",
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
    marginBottom: 24,
  },
  phoneHighlight: {
    color: "#1E293B",
    fontWeight: "700",
  },
  button: {
    backgroundColor: "#2563EB",
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});