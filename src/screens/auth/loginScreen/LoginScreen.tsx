import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  Modal,
  StyleSheet,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../../../contex/AuthContext";
import styles from "./style";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNetworkStatus } from "../../../hooks/network/useNetworkStatus";
import NoInternetModal from "../../../components/networkModal/NetworkModal";

export default function LoginScreen() {
  const { width } = useWindowDimensions();
  const { phoneNumber, setPhoneNumber, sendOTP, checkUserExists } = useAuth();
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showNotRegisteredModal, setShowNotRegisteredModal] = useState(false);
  const [showAccessDeniedModal, setShowAccessDeniedModal] = useState(false);
  const [accessDeniedMessage, setAccessDeniedMessage] = useState("");
  const [showNoInternet, setShowNoInternet] = useState(false);
  const insets = useSafeAreaInsets();
  const isOnline = useNetworkStatus();

  const handleSendCode = async () => {
    setError("");

    if (phoneNumber.length !== 10) {
      setError("Please enter exactly 10 digits");
      return;
    }

    if (isOnline === false) {
      setShowNoInternet(true);
      return;
    }

    setIsLoading(true);

    try {
      // Step 1: Verify user registration, active status, and company validity
      const result = await checkUserExists(phoneNumber);

      if (result.status === "not_registered") {
        setShowNotRegisteredModal(true);
        return;
      }

      if (result.status === "inactive") {
        setAccessDeniedMessage(
          "Access Denied. Your account is deactivated. Please contact your administrator."
        );
        setShowAccessDeniedModal(true);
        return;
      }

      if (result.status === "company_invalid") {
        setAccessDeniedMessage(
          "Access Denied. Your company account is not registered or inactive. Please contact your administrator."
        );
        setShowAccessDeniedModal(true);
        return;
      }

      // Step 2: User is verified, active, and company exists — safe to send OTP
      const success = await sendOTP();
      if (!success) {
        setError("Failed to send OTP. Please try again.");
      }
    } catch (err: any) {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || "https://api.workfloww.ai";
      setError(`Connection failed: ${err?.message || "Please check connection"} (${apiUrl})`);
    } finally {
      setIsLoading(false);
    }
  };

  const isButtonDisabled = phoneNumber.length !== 10 || isLoading;

  return (
    <>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[styles.container, { paddingTop: insets.top }]}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          bounces={false}
        >
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
                placeholderTextColor="#64748B"
              />
            </View>

            {error ? (
              <Text style={styles.errorTextBelow}>{error}</Text>
            ) : null}

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

      {/* Access Denied Modal */}
      <Modal
        visible={showAccessDeniedModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAccessDeniedModal(false)}
      >
        <View style={modalStyles.overlay}>
          <View style={modalStyles.card}>
            <View style={modalStyles.iconContainer}>
              <MaterialCommunityIcons
                name="shield-alert-outline"
                size={40}
                color="#EF4444"
              />
            </View>

            <Text style={modalStyles.title}>Access Denied</Text>
            <Text style={modalStyles.message}>{accessDeniedMessage}</Text>

            <TouchableOpacity
              style={modalStyles.button}
              onPress={() => setShowAccessDeniedModal(false)}
            >
              <Text style={modalStyles.buttonText}>OK, Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <NoInternetModal
        visible={showNoInternet}
        onDismiss={() => setShowNoInternet(false)}
      />
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
