import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Dimensions,
  ActivityIndicator
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../../contex/AuthContext";

const { width } = Dimensions.get("window");

export default function OTPScreen() {
  const { phoneNumber, verifyOTP, sendOTP } = useAuth(); // Added sendOTP for resend logic

  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [timer, setTimer] = useState(30);

  const inputRef = useRef<TextInput>(null);

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => {
      inputRef.current?.focus();
    }, 500);
  }, []);

  // Timer Logic
  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleVerify = async () => {
    if (otp.length !== 6) return;

    setIsLoading(true);
    setError("");

    const success = await verifyOTP(otp);

    if (!success) {
      setError("Invalid OTP. Please try again.");
      setOtp("");
      inputRef.current?.focus();
    }
    // Note: If success, the AuthContext should handle navigation via state change
    setIsLoading(false);
  };

  const handleResend = async () => {
    if (timer > 0) return;
    setTimer(30);
    setError("");
    await sendOTP();
  };

  const renderOtpBoxes = () => {
    return Array(6)
      .fill(0)
      .map((_, i) => {
        const char = otp[i] || "";
        const isFocused = otp.length === i;
        return (
          <View 
            key={i} 
            style={[
              styles.otpBox, 
              char && styles.otpBoxActive,
              isFocused && styles.otpBoxFocused,
              error && styles.otpBoxError
            ]}
          >
            <Text style={styles.otpText}>{char}</Text>
          </View>
        );
      });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
        <View style={styles.content}>
          <Text style={styles.title}>OTP Verification</Text>
          <Text style={styles.subtitle}>
            We've sent a code to <Text style={styles.phoneHighlight}>+91 {phoneNumber}</Text>
          </Text>

          <TouchableOpacity
            onPress={() => inputRef.current?.focus()}
            style={styles.otpRow}
            activeOpacity={1}
          >
            {renderOtpBoxes()}
          </TouchableOpacity>

          <TextInput
            ref={inputRef}
            value={otp}
            onChangeText={(txt) => setOtp(txt.replace(/[^0-9]/g, ""))}
            maxLength={6}
            keyboardType="number-pad"
            style={styles.hiddenInput}
          />

          {error && (
            <View style={styles.errorContainer}>
              <MaterialCommunityIcons name="alert-circle" size={20} color="#EF4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.verifyButton,
              (otp.length !== 6 || isLoading) && styles.buttonDisabled,
            ]}
            onPress={handleVerify}
            disabled={otp.length !== 6 || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.buttonText}>Verify</Text>
            )}
          </TouchableOpacity>

          <View style={styles.resendContainer}>
            {timer > 0 ? (
              <Text style={styles.resendText}>
                Resend code in <Text style={styles.timerText}>{timer}s</Text>
              </Text>
            ) : (
              <TouchableOpacity onPress={handleResend}>
                <Text style={styles.resendLink}>Resend OTP</Text>
              </TouchableOpacity>
            )}
          </View>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  scrollContent: { paddingHorizontal: 24, paddingTop: 60 },
  content: { marginTop: 20, alignItems: "center" },
  title: { fontSize: 28, fontWeight: "800", color: "#1E293B", marginBottom: 12 },
  subtitle: { fontSize: 16, color: "#64748B", textAlign: "center", lineHeight: 24, marginBottom: 40 },
  phoneHighlight: { color: "#1E293B", fontWeight: "700" },
  otpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 24,
  },
  otpBox: {
    width: (width - 80) / 6,
    height: 60,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 2,
    borderColor: "#E2E8F0",
    justifyContent: "center",
    alignItems: "center",
  },
  otpBoxActive: { borderColor: "#94A3B8" },
  otpBoxFocused: { borderColor: "#2563EB", backgroundColor: "#FFFFFF" },
  otpBoxError: { borderColor: "#EF4444", backgroundColor: "#FFF1F2" },
  otpText: { fontSize: 24, fontWeight: "700", color: "#1E293B" },
  hiddenInput: { position: "absolute", opacity: 0, width: 1 },
  errorContainer: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  errorText: { color: "#EF4444", fontSize: 14, marginLeft: 6, fontWeight: "500" },
  verifyButton: {
    width: "100%",
    backgroundColor: "#2563EB",
    height: 60,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  buttonDisabled: { backgroundColor: "#CBD5E1" },
  buttonText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  resendContainer: { marginTop: 30 },
  resendText: { color: "#64748B", fontSize: 14 },
  timerText: { color: "#1E293B", fontWeight: "600" },
  resendLink: { color: "#2563EB", fontWeight: "700", fontSize: 14 },
  devHint: { marginTop: 40, padding: 10, backgroundColor: '#F1F5F9', borderRadius: 8 },
  devHintText: { color: '#64748B', fontSize: 12, fontWeight: '600' }
});