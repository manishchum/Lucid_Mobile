import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  FlatList,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth, ForcedLogoutReason } from "../../../contex/AuthContext";
import styles from "./style";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNetworkStatus } from "../../../hooks/network/useNetworkStatus";
import NoInternetModal from "../../../components/networkModal/NetworkModal";
import { logger } from "../../../utils/UnifiedLogger";
import { friendlyError } from "../../../utils/friendlyError";
import { maskPhone } from "../../../utils/sanitizer";
import {
  COUNTRIES,
  CountryItem,
  formatDisplayPhone,
  isValidLocalPhone,
  sanitizeLocalPhoneInput,
} from "../../../utils/countries";

interface ForcedLogoutCopy {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  iconBg: string;
  iconColor: string;
  title: string;
  message: string;
}

function getForcedLogoutCopy(
  reason: Exclude<ForcedLogoutReason, null>,
): ForcedLogoutCopy {
  switch (reason) {
    case "session_terminated":
      return {
        icon: "cellphone-lock",
        iconBg: "#FEF3C7",
        iconColor: "#D97706",
        title: "Signed Out on This Device",
        message:
          "You were logged out because your account was signed in on another mobile device.",
      };
    case "session_expired":
      return {
        icon: "clock-alert-outline",
        iconBg: "#EFF6FF",
        iconColor: "#2563EB",
        title: "Session Expired",
        message:
          "Your 30-day session has expired for security. Please sign in again to continue.",
      };
    case "company_deactivated":
      return {
        icon: "domain-off",
        iconBg: "#FEE2E2",
        iconColor: "#EF4444",
        title: "Company Access Suspended",
        message:
          "Your company's access has been suspended. Please contact your administrator.",
      };
    case "user_deactivated":
    default:
      return {
        icon: "account-off-outline",
        iconBg: "#FEE2E2",
        iconColor: "#EF4444",
        title: "Account Deactivated",
        message:
          "Your account has been deactivated. Please contact your administrator.",
      };
  }
}

export default function LoginScreen() {
  const {
    phoneNumber,
    setPhoneNumber,
    selectedCountry,
    setSelectedCountry,
    sendOTP,
    forcedLogoutReason,
    clearForcedLogoutReason,
  } = useAuth();
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showNotRegisteredModal, setShowNotRegisteredModal] = useState(false);
  const [showAccessDeniedModal, setShowAccessDeniedModal] = useState(false);
  const [accessDeniedMessage, setAccessDeniedMessage] = useState("");
  const [showNoInternet, setShowNoInternet] = useState(false);
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [countryQuery, setCountryQuery] = useState("");
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

  const filteredCountries = useMemo(() => {
    const q = countryQuery.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dialCode.includes(q) ||
        c.code.toLowerCase().includes(q),
    );
  }, [countryQuery]);

  const triggerSendCode = async (
    phoneToVerify: string,
    countryToUse: CountryItem = selectedCountry,
  ) => {
    const cleanNumber = sanitizeLocalPhoneInput(phoneToVerify, countryToUse);
    if (!isValidLocalPhone(cleanNumber, countryToUse) || isLoading) return;

    if (isOnline === false) {
      setShowNoInternet(true);
      return;
    }

    setIsLoading(true);
    setError("");
    Keyboard.dismiss();

    try {
      const result = await sendOTP(cleanNumber, countryToUse);
      if (!result.success) {
        console.error("[LoginScreen] OTP send failed:", {
          phone: maskPhone(`${countryToUse.dialCode} ${cleanNumber}`),
          status: result.status,
          message: result.message,
          details: result.details,
          retryAfter: result.retryAfter,
        });
        logger.error("[LoginScreen] OTP send failed:", result);

        if (result.status === 404) {
          setShowNotRegisteredModal(true);
        } else if (result.status === 403) {
          setAccessDeniedMessage(
            result.message ||
              "Access Denied. Your account or company is inactive. Please contact your administrator.",
          );
          setShowAccessDeniedModal(true);
        } else {
          setError(friendlyError(result));
        }
      }
    } catch (err: any) {
      console.error("[LoginScreen] Unexpected error sending OTP:", err);
      logger.error("[LoginScreen] Unexpected error sending OTP:", err);
      setError(friendlyError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhoneChange = (txt: string) => {
    const cleanTxt = sanitizeLocalPhoneInput(txt, selectedCountry);

    setPhoneNumber(cleanTxt);
    setError("");

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (
      selectedCountry.autoSendDigits !== null &&
      cleanTxt.length === selectedCountry.autoSendDigits
    ) {
      debounceTimerRef.current = setTimeout(() => {
        triggerSendCode(cleanTxt, selectedCountry);
      }, 300);
    }
  };

  const handleSelectCountry = (country: CountryItem) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    setSelectedCountry(country);
    setError("");
    setCountryQuery("");
    setShowCountryModal(false);
  };

  const phoneReady = isValidLocalPhone(phoneNumber, selectedCountry);
  const showManualSendButton =
    !isLoading &&
    phoneReady &&
    (selectedCountry.autoSendDigits === null || Boolean(error));

  const forcedCopy = forcedLogoutReason
    ? getForcedLogoutCopy(forcedLogoutReason)
    : null;

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
              <TouchableOpacity
                style={styles.countryPicker}
                onPress={() => !isLoading && setShowCountryModal(true)}
                activeOpacity={0.7}
                disabled={isLoading}
                accessibilityRole="button"
                accessibilityLabel="Select country dial code"
              >
                <Text style={styles.flag}>{selectedCountry.flag}</Text>
                <Text style={styles.countryCode}>{selectedCountry.dialCode}</Text>
                <MaterialCommunityIcons
                  name="chevron-down"
                  size={18}
                  color="#64748B"
                  style={{ marginLeft: 4 }}
                />
                <View style={styles.divider} />
              </TouchableOpacity>

              <TextInput
                style={styles.input}
                keyboardType="phone-pad"
                value={phoneNumber}
                onChangeText={handlePhoneChange}
                maxLength={selectedCountry.maxDigits + 5}
                placeholder="Enter phone number"
                placeholderTextColor="#64748B"
                editable={!isLoading}
              />
            </View>

            {error ? (
              <View style={styles.errorContainer}>
                <MaterialCommunityIcons
                  name="alert-circle-outline"
                  size={16}
                  color="#EF4444"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.errorTextBelow}>{error}</Text>
              </View>
            ) : null}

            {isLoading ? (
              <View style={styles.statusIndicator}>
                <ActivityIndicator size="small" color="#2563EB" />
                <Text style={styles.statusText}>
                  Sending verification code...
                </Text>
              </View>
            ) : showManualSendButton ? (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => triggerSendCode(phoneNumber, selectedCountry)}
                activeOpacity={0.85}
              >
                <View style={styles.buttonContent}>
                  <Text style={styles.buttonText}>
                    {error ? "Tap to Retry" : "Send Verification Code"}
                  </Text>
                  <MaterialCommunityIcons
                    name="arrow-right"
                    size={18}
                    color="#FFFFFF"
                  />
                </View>
              </TouchableOpacity>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Country Picker Modal */}
      <Modal
        visible={showCountryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCountryModal(false)}
      >
        <View style={pickerStyles.overlay}>
          <View
            style={[
              pickerStyles.sheet,
              { paddingBottom: Math.max(insets.bottom, 16) },
            ]}
          >
            <View style={pickerStyles.header}>
              <Text style={pickerStyles.headerTitle}>Select Country</Text>
              <TouchableOpacity
                onPress={() => setShowCountryModal(false)}
                style={pickerStyles.closeBtn}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={22}
                  color="#475569"
                />
              </TouchableOpacity>
            </View>

            <View style={pickerStyles.searchBox}>
              <MaterialCommunityIcons
                name="magnify"
                size={20}
                color="#94A3B8"
                style={{ marginRight: 8 }}
              />
              <TextInput
                style={pickerStyles.searchInput}
                placeholder="Search country name or dial code"
                placeholderTextColor="#94A3B8"
                value={countryQuery}
                onChangeText={setCountryQuery}
                autoCorrect={false}
              />
              {countryQuery ? (
                <TouchableOpacity onPress={() => setCountryQuery("")}>
                  <MaterialCommunityIcons
                    name="close-circle"
                    size={18}
                    color="#94A3B8"
                  />
                </TouchableOpacity>
              ) : null}
            </View>

            <FlatList
              data={filteredCountries}
              keyExtractor={(item) => item.code}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const isSelected = item.code === selectedCountry.code;
                return (
                  <TouchableOpacity
                    style={[
                      pickerStyles.row,
                      isSelected && pickerStyles.rowSelected,
                    ]}
                    onPress={() => handleSelectCountry(item)}
                  >
                    <Text style={pickerStyles.rowFlag}>{item.flag}</Text>
                    <Text style={pickerStyles.rowName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={pickerStyles.rowDial}>{item.dialCode}</Text>
                    {isSelected ? (
                      <MaterialCommunityIcons
                        name="check-circle"
                        size={18}
                        color="#2563EB"
                        style={{ marginLeft: 8 }}
                      />
                    ) : null}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={pickerStyles.emptyText}>
                  No matching countries found
                </Text>
              }
            />
          </View>
        </View>
      </Modal>

      {/* Branded Forced Logout / Displacement / Session Expiry Modal */}
      <Modal
        visible={Boolean(forcedCopy)}
        transparent
        animationType="fade"
        onRequestClose={clearForcedLogoutReason}
      >
        <View style={modalStyles.overlay}>
          <View style={modalStyles.card}>
            <View
              style={[
                modalStyles.iconContainer,
                { backgroundColor: forcedCopy?.iconBg ?? "#FEE2E2" },
              ]}
            >
              <MaterialCommunityIcons
                name={forcedCopy?.icon ?? "alert-circle-outline"}
                size={36}
                color={forcedCopy?.iconColor ?? "#EF4444"}
              />
            </View>

            <Text style={modalStyles.title}>
              {forcedCopy?.title ?? "Signed Out"}
            </Text>
            <Text style={modalStyles.message}>
              {forcedCopy?.message ?? "Please sign in again to continue."}
            </Text>

            <TouchableOpacity
              style={modalStyles.button}
              onPress={clearForcedLogoutReason}
              activeOpacity={0.85}
            >
              <Text style={modalStyles.buttonText}>OK, Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
                size={38}
                color="#EF4444"
              />
            </View>

            <Text style={modalStyles.title}>Not Registered</Text>
            <Text style={modalStyles.message}>
              The number{" "}
              <Text style={modalStyles.phoneHighlight}>
                {formatDisplayPhone(phoneNumber, selectedCountry)}
              </Text>{" "}
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
                size={38}
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

const pickerStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "75%",
    paddingTop: 18,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
  },
  closeBtn: {
    padding: 4,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#0F172A",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#F1F5F9",
  },
  rowSelected: {
    backgroundColor: "#EFF6FF",
  },
  rowFlag: {
    fontSize: 22,
    marginRight: 12,
  },
  rowName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#1E293B",
    marginRight: 8,
  },
  rowDial: {
    fontSize: 14,
    fontWeight: "700",
    color: "#475569",
  },
  emptyText: {
    textAlign: "center",
    color: "#94A3B8",
    paddingVertical: 28,
    fontSize: 14,
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 26,
    alignItems: "center",
    width: "100%",
    maxWidth: 350,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 10,
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    color: "#475569",
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 24,
  },
  phoneHighlight: {
    color: "#0F172A",
    fontWeight: "700",
  },
  button: {
    backgroundColor: "#2563EB",
    height: 48,
    borderRadius: 14,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});
