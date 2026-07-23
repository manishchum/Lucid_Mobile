import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  StatusBar,
  BackHandler,
  Linking,
  Alert,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useDrawer } from "../../contex/DrawerContext";
import { useAuth } from "../../contex/AuthContext";
import { getUserByPhone } from "../../api/users/Request";
import { APP_ROUTES } from "../../navigations/Routes";

const { width } = Dimensions.get("window");
const DRAWER_WIDTH = width * 0.78;

function toE164(rawPhone: string): string {
  const digits = rawPhone.replace(/[^\d]/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (digits.length === 11 && digits.startsWith("0"))
    return `+91${digits.slice(1)}`;
  return rawPhone.startsWith("+") ? rawPhone : `+91${digits}`;
}

export default function AppDrawer() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { isDrawerOpen, closeDrawer } = useDrawer();
  const { cachedUser, phoneNumber, logout } = useAuth();
  
  const confirmLogout = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: () => {
            closeDrawer();
            logout();
          },
        },
      ],
      { cancelable: true }
    );
  };
  
  const [user, setUser] = useState<any>(null);

  const slideAnim = useRef(new Animated.Value(DRAWER_WIDTH)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const phone = cachedUser?.phone || phoneNumber;
        if (phone) {
          const normalizedPhone = toE164(phone);
          const response = await getUserByPhone(normalizedPhone);
          if (response?.user) {
            setUser(response.user);
          }
        }
      } catch (error) {
        console.error("[AppDrawer] Error fetching user:", error);
      }
    };
    if (cachedUser || phoneNumber) {
      fetchUserData();
    }
  }, [cachedUser, phoneNumber]);

  const [shouldRender, setShouldRender] = useState(isDrawerOpen);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: isDrawerOpen ? 0 : DRAWER_WIDTH,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: isDrawerOpen ? 1 : 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();

    if (isDrawerOpen) {
      setShouldRender(true);
    } else {
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [isDrawerOpen]);
  useEffect(() => {
    if (isDrawerOpen) {
      const onBackPress = () => {
        closeDrawer();
        return true;
      };
      const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
      return () => subscription.remove();
    }
  }, [isDrawerOpen]);

  const handleSupportPress = async () => {
    closeDrawer();
    const url = "https://wa.me/919211540400";
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert("Error", "WhatsApp is not installed or the link cannot be opened.");
      }
    } catch (error) {
      console.error("[AppDrawer] Failed to open WhatsApp link:", error);
      Alert.alert("Error", "Something went wrong while opening the link.");
    }
  };
  const handleProfilePress = () => {
    closeDrawer();
    navigation.navigate(APP_ROUTES.PROFILE);
  };

  const handleSprintversePress = () => {
    closeDrawer();
    navigation.navigate(APP_ROUTES.SPRINTVERSE);
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

  if (!shouldRender) {
    return null;
  }

  const displayName = user?.name || cachedUser?.name || "User Name";
  const displayPosition = user?.position || "Team Member";
  const displayEmail = user?.email || cachedUser?.email || "";

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents={isDrawerOpen ? "auto" : "none"}>
      {/* Backdrop overlay */}
      <TouchableWithoutFeedback onPress={closeDrawer}>
        <Animated.View style={[styles.overlay, { opacity: opacityAnim }]} />
      </TouchableWithoutFeedback>

      {/* Drawer content panel */}
      <Animated.View
        style={[
          styles.drawerContainer,
          {
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 16,
            transform: [{ translateX: slideAnim }],
          },
        ]}
      >
        <View style={{ flex: 1 }}>
          {/* User Profile Header */}
          <TouchableOpacity
            onPress={handleProfilePress}
            activeOpacity={0.8}
            style={styles.profileSection}
          >
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{getInitials(displayName)}</Text>
            </View>
            <View style={styles.profileDetails}>
              <Text style={styles.profileName} numberOfLines={1}>
                {displayName}
              </Text>
              <Text style={styles.profilePosition} numberOfLines={1}>
                {displayPosition}
              </Text>
              <Text style={styles.profileEmail} numberOfLines={1}>
                {displayEmail}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Navigation Items */}
          <View style={styles.navItemsList}>
            <TouchableOpacity
              onPress={handleSprintversePress}
              activeOpacity={0.7}
              style={styles.navItem}
            >
              <View style={styles.navIconWrapper}>
                <MaterialCommunityIcons name="orbit" size={24} color="#6366F1" />
              </View>
              <Text style={styles.navItemText}>Sprintverse</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSupportPress}
              activeOpacity={0.7}
              style={[styles.navItem, { marginTop: 12 }]}
            >
              <View style={styles.navIconWrapper}>
                <MaterialCommunityIcons name="whatsapp" size={24} color="#25D366" />
              </View>
              <Text style={styles.navItemText}>Help & Support</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity
          onPress={confirmLogout}
          activeOpacity={0.8}
          style={styles.logoutButton}
        >
          <MaterialCommunityIcons name="logout" size={22} color="#EF4444" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
  },
  drawerContainer: {
    width: DRAWER_WIDTH,
    height: "100%",
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderBottomLeftRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 16,
    position: "absolute",
    right: 0,
    top: 0,
  },
  profileSection: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#6366F1",
  },
  avatarText: {
    fontSize: 20,
    fontWeight: "800",
    color: "#6366F1",
  },
  profileDetails: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1E293B",
  },
  profilePosition: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 2,
  },
  profileEmail: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 1,
  },
  divider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginHorizontal: 20,
    marginVertical: 8,
  },
  navItemsList: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
  },
  navIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  navItemText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: "#1E293B",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#FFF1F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    marginTop: "auto",
  },
  logoutText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#EF4444",
    marginLeft: 10,
  },
});
