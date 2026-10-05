import React, { useState, useRef, useEffect } from "react";
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
  ActivityIndicator,
  Keyboard,
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
  const [errorDetails, setErrorDetails] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showNotRegisteredModal, setShowNotRegisteredModal] = useState(false);
  const [showAccessDeniedModal, setShowAccessDeniedModal] = useState(false);
  const [accessDeniedMessage, setAccessDeniedMessage] = useState("");
  const [showNoInternet, setShowNoInternet] = useState(false);
  const insets = useSafeAreaInsets();
  const isOnline = useNetworkStatus();
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const triggerSendCode = async (phoneToVerify: string) => {
    const cleanNumber = phoneToVerify.replace(/\D/g, "");
    if (cleanNumber.length !== 10) return;

    if (isOnline === false) {
      setShowNoInternet(true);
      return;
    }

    setIsLoading(true);
    setError("");
    setErrorDetails("");
    Keyboard.dismiss();

    try {
      // Send OTP — explicitly pass the clean 10-digit phone number
      const result = await sendOTP(cleanNumber);
      if (!result.success) {
        if (result.status === 404) {
          setShowNotRegisteredModal(true);
        } else if (result.status === 403) {
          setAccessDeniedMessage(
            result.message || "Access Denied. Your account or company is inactive. Please contact your administrator."
          );
          setShowAccessDeniedModal(true);
        } else {
          setError(result.message || "Failed to send OTP. Please try again.");
          if (result.details) {
            setErrorDetails(result.details);
          }
        }
      }
    } catch (err: any) {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || "https://api.workfloww.ai";
      setError(`Connection failed: ${err?.message || "Please check connection"}`);
      setErrorDetails(`Target: ${apiUrl}/api/auth/send-otp | ${err?.name || "Error"} ${err?.cause ? JSON.stringify(err.cause) : ""}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhoneChange = (txt: string) => {
    let cleanTxt = txt.replace(/[^0-9]/g, "");

    // Handle user pasting with country code (+91) or leading 0
    if (cleanTxt.startsWith("91") && cleanTxt.length > 10) {
      cleanTxt = cleanTxt.slice(2);
    } else if (cleanTxt.startsWith("0") && cleanTxt.length > 10) {
      cleanTxt = cleanTxt.slice(1);
    }

    // Limit to 10 digits
    if (cleanTxt.length > 10) {
      cleanTxt = cleanTxt.slice(0, 10);
    }

    setPhoneNumber(cleanTxt);
    setError("");
    setErrorDetails("");

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (cleanTxt.length === 10) {
      debounceTimerRef.current = setTimeout(() => {
        triggerSendCode(cleanTxt);
      }, 300);
    }
  };

  return (
    <>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[styles.container, { paddingTop: insets.top }]}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          bounces={false}
          keyboardShouldPersistTaps="handled"
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
                onChangeText={handlePhoneChange}
                maxLength={16}
                placeholder="Enter phone number"
                placeholderTextColor="#64748B"
                editable={!isLoading}
              />
            </View>

            {error ? (
              <View style={{ marginTop: 6, marginBottom: 4 }}>
                <Text style={styles.errorTextBelow}>{error}</Text>
                {errorDetails ? (
                  <Text style={{ fontSize: 11, color: "#94A3B8", marginTop: 2, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" }}>
                    {errorDetails}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {isLoading ? (
              <View style={styles.statusIndicator}>
                <ActivityIndicator size="small" color="#2563EB" />
                <Text style={styles.statusText}>Sending verification code...</Text>
              </View>
            ) : error && phoneNumber.replace(/\D/g, "").length === 10 ? (
              <TouchableOpacity
                style={{ marginTop: 12, alignItems: "center", paddingVertical: 8 }}
                onPress={() => triggerSendCode(phoneNumber.replace(/\D/g, "").slice(-10))}
              >
                <Text style={styles.linkText}>Tap to Retry</Text>
              </TouchableOpacity>
            ) : null}
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
