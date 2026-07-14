import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform, Image } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDrawer } from "../../contex/DrawerContext";
import { useNotifications } from "../../contex/NotificationContext";

export default function AppHeader() {
  const insets = useSafeAreaInsets();
  const { toggleDrawer, setIsLeaderboardOpen, setIsNotificationsOpen } = useDrawer();
  const { unreadCount } = useNotifications();

  return (
    <View style={[styles.headerContainer, { paddingTop: Math.max(insets.top, 12) }]}>
      <View style={styles.header}>
        {/* Left Side: Logo & App Name */}
        <View style={styles.logoContainer}>
          <Image
            source={require("../../../assets/logo.png")}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.logoText}>LucidX</Text>
        </View>

        {/* Right Side: Leaderboard, Notifications, & Hamburger Menu */}
        <View style={styles.rightActions}>
          <TouchableOpacity
            onPress={() => setIsLeaderboardOpen(true)}
            style={styles.iconBtn}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="trophy-outline" size={22} color="#475569" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setIsNotificationsOpen(true)}
            style={styles.iconBtn}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="bell" size={22} color="#475569" />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={toggleDrawer} style={styles.iconBtn} activeOpacity={0.7}>
            <MaterialCommunityIcons name="menu" size={24} color="#1E293B" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    ...Platform.select({
      ios: {
        shadowColor: "#64748B",
        shadowOpacity: 0.05,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
      },
      android: {
        elevation: 2,
      },
    }),
  },
  header: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logoImage: {
    width: 30,
    height: 30,
  },
  logoText: {
    fontSize: 20,
    fontWeight: "900",
    color: "#6366F1",
    letterSpacing: 0.5,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  rightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#EF4444",
    borderRadius: 9,
    width: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800",
  },
});
