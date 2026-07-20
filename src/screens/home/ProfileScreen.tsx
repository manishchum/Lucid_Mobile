import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  BackHandler,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../../contex/AuthContext";
import { getUserByPhone } from "../../api/users/Request";
import { useGetCompany } from "../../api/users/Hooks";
import { User } from "../../api/users/Dto";
import FeedbackCard from "../../components/feedback/FeedbackCard";
import RefreshSpinner from "../../components/pullToRefresh/RefreshSpinner";

function toE164(rawPhone: string): string {
  const digits = rawPhone.replace(/[^\d]/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (digits.length === 11 && digits.startsWith("0"))
    return `+91${digits.slice(1)}`;
  return rawPhone.startsWith("+") ? rawPhone : `+91${digits}`;
}

export default function ProfileScreen() {
  const { phoneNumber, cachedUser } = useAuth();
  const navigation = useNavigation<any>();

  useEffect(() => {
    const onBackPress = () => {
      navigation.goBack();
      return true;
    };
    const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => subscription.remove();
  }, [navigation]);


  const [user, setUser] = useState<User | null>(
    cachedUser
      ? {
          user_id: cachedUser.userId,
          email: cachedUser.email,
          name: cachedUser.name,
          phone: cachedUser.phone,
          company_id: cachedUser.companyId,
          department_id: cachedUser.departmentId ?? "",
          manager_id: cachedUser.managerId,
          position: "",
          avatar_url: null,
          employment_status: "Active",
          hire_date: "",
          last_login: null,
          login_count: 0,
          is_active: cachedUser.isActive,
          created_at: "",
          updated_at: "",
          title_id: null,
          function_id: null,
          sub_function_id: null,
          ready_status: true,
          email_unsubscribed: false,
          unsubscribed_at: null,
          firebase_uid: cachedUser.firebaseUid,
        }
      : null,
  );
  const [loading, setLoading] = useState(!cachedUser);
  const [refreshing, setRefreshing] = useState(false);

  const fetchUserData = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      if (phoneNumber) {
        const normalizedPhone = toE164(phoneNumber);
        const response = await getUserByPhone(normalizedPhone);
        if (response?.user) {
          setUser(response.user);
        } else {
          console.warn("[ProfileScreen] No user found for", normalizedPhone);
        }
      }
    } catch (error) {
      console.error("[ProfileScreen] Error fetching user:", error);
    } finally {
      setLoading(false);
    }
  }, [phoneNumber]);

  useEffect(() => {
    fetchUserData(true);
  }, [fetchUserData]);

  // Fetch company name from company_id once the user record is loaded
  const { company, isLoading: companyLoading, refetch: refetchCompany } = useGetCompany(
    user?.company_id ?? null,
    cachedUser?.userId ?? null,
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchUserData(false),
        refetchCompany(),
      ]);
    } catch (err) {
      console.error("[ProfileScreen] Refresh error:", err);
    } finally {
      setRefreshing(false);
    }
  }, [fetchUserData, refetchCompany]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getInitials = (name: string) => {
    return name
      ? name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
          .substring(0, 2)
      : "??";
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Profile</Text>
        <View style={{ width: 32 }} />
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          RefreshSpinner(refreshing, onRefresh)
        }
      >
        {/* PROFILE HEADER */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {getInitials(user?.name || "")}
            </Text>
          </View>
          <Text style={styles.userName}>{user?.name || "User Name"}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>
              {user?.position || "Team Member"}
            </Text>
          </View>
        </View>

        {/* ACCOUNT DETAILS SECTION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Details</Text>
          <View style={styles.infoCard}>
            <InfoRow
              icon="email-outline"
              label="Email Address"
              value={user?.email}
            />
            <Divider />
            <InfoRow
              icon="phone-outline"
              label="Phone Number"
              value={user?.phone}
            />
            <Divider />
            <InfoRow
              icon="office-building-outline"
              label="Company"
              value={
                company?.name ??
                (companyLoading ? "Loading…" : user?.company_id)
              }
            />
          </View>
        </View>

        {/* EMPLOYMENT SECTION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Employment</Text>
          <View style={styles.infoCard}>
            <InfoRow
              icon="briefcase-variant-outline"
              label="Current Position"
              value={user?.position}
            />
            <Divider />
            <InfoRow
              icon="calendar-check-outline"
              label="Member Since"
              value={formatDate(user?.hire_date || user?.created_at || "")}
            />
            <Divider />
            <InfoRow
              icon="shield-check-outline"
              label="Status"
              value={user?.employment_status || "Active"}
              isStatus
            />
          </View>
        </View>

        {/* RATE YOUR EXPERIENCE SECTION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rate Your Experience</Text>
          <FeedbackCard />
        </View>

        {/* ADMIN NOTICE */}
        <View style={styles.adminNotice}>
          <MaterialCommunityIcons
            name="information-outline"
            size={20}
            color="#64748B"
          />
          <Text style={styles.adminNoticeText}>
            Profile details are managed by your administrator. Contact HR to
            update information.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** HELPER COMPONENTS **/
const InfoRow = ({ icon, label, value, isStatus }: any) => (
  <View style={styles.infoRow}>
    <View style={styles.infoIconWrapper}>
      <MaterialCommunityIcons name={icon} size={22} color="#64748B" />
    </View>
    <View style={styles.infoContent}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, isStatus && styles.statusText]}>
        {value || "—"}
      </Text>
    </View>
  </View>
);

const Divider = () => <View style={styles.divider} />;

/** STYLES **/
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#FFF" },
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  scrollContent: { paddingBottom: 40 },

  // Header
  profileHeader: {
    alignItems: "center",
    paddingVertical: 30,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  avatarCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: "#4F46E5",
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: "800",
    color: "#4F46E5",
  },
  userName: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1E293B",
    marginBottom: 8,
  },
  roleBadge: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  roleBadgeText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
    textTransform: "uppercase",
  },

  // Sections
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 12,
    marginLeft: 4,
  },
  infoCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    elevation: 2,
    shadowColor: "#64748B",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },

  // Info Rows
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  infoIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: "#94A3B8",
    fontWeight: "600",
    marginBottom: 2,
    textTransform: "uppercase",
  },
  infoValue: {
    fontSize: 15,
    fontWeight: "600",
    color: "#334155",
  },
  statusText: {
    color: "#10B981",
    fontWeight: "700",
  },
  divider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 4,
  },

  // Admin Notice
  adminNotice: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    marginHorizontal: 20,
    marginTop: 30,
    padding: 16,
    borderRadius: 16,
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  adminNoticeText: {
    flex: 1,
    fontSize: 13,
    color: "#64748B",
    marginLeft: 10,
    lineHeight: 18,
  },

  header: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    backgroundColor: "#ffffff",
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E293B",
  },
});
