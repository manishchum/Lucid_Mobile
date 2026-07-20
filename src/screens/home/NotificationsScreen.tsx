import React, { useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNotifications, Notification } from "../../contex/NotificationContext";
import { STACK_ROUTES } from "../../navigations/Routes";
import RefreshSpinner from "../../components/pullToRefresh/RefreshSpinner";

export default function NotificationsScreen({ navigation }: { navigation: any }) {
  const { notifications, isLoading, fetchNotifications, markAsRead, markAllAsRead } = useNotifications();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchNotifications();
    }, [fetchNotifications])
  );

  const handleNotificationPress = async (item: Notification) => {
    if (!item.read) {
      await markAsRead(item.id);
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 60) {
        return diffMins <= 1 ? "Just now" : `${diffMins}m ago`;
      }
      if (diffHours < 24) {
        return `${diffHours}h ago`;
      }
      if (diffDays < 7) {
        return `${diffDays}d ago`;
      }
      return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    } catch {
      return "";
    }
  };

  const renderItem = ({ item }: { item: Notification }) => {
    const isSprint = item.type === "sprint_assigned";
    const iconName = isSprint ? "lightning-bolt" : "brush";
    const iconColor = isSprint ? "#6366F1" : "#EC4899";
    const iconBg = isSprint ? "#EEF2FF" : "#FDF2F8";

    return (
      <TouchableOpacity
        style={[styles.notificationCard, !item.read && styles.unreadCard]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
          <MaterialCommunityIcons name={iconName} size={22} color={iconColor} />
        </View>
        <View style={styles.textContainer}>
          <View style={styles.cardHeader}>
            <Text style={[styles.titleText, !item.read && styles.unreadText]}>
              {item.title}
            </Text>
            <Text style={styles.timeText}>{formatTime(item.created_at)}</Text>
          </View>
          <Text style={styles.messageText} numberOfLines={2}>
            {item.message}
          </Text>
        </View>
        {!item.read && <View style={styles.blueDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="dark-content" />
      
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity style={styles.markAllBtn} onPress={markAllAsRead}>
          <Text style={styles.markAllText}>Mark all read</Text>
        </TouchableOpacity>
      </View>

      {/* ── NOTIFICATIONS LIST ──────────────────────────────────────────── */}
      {isLoading && notifications.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="bell-outline" size={64} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>All caught up!</Text>
          <Text style={styles.emptySub}>You will see new updates and task assignments here.</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          refreshControl={RefreshSpinner(refreshing, onRefresh)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E293B",
  },
  markAllBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  markAllText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6366F1",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#475569",
    marginTop: 16,
  },
  emptySub: {
    fontSize: 14,
    color: "#94A3B8",
    textAlign: "center",
    marginTop: 8,
  },
  listContainer: {
    paddingVertical: 12,
  },
  notificationCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginHorizontal: 12,
    marginVertical: 4,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    position: "relative",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  unreadCard: {
    borderColor: "#E0E7FF",
    backgroundColor: "#F8FAFF",
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
  },
  textContainer: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  titleText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#475569",
  },
  unreadText: {
    fontWeight: "700",
    color: "#1E293B",
  },
  timeText: {
    fontSize: 11,
    color: "#94A3B8",
  },
  messageText: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 18,
  },
  blueDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#6366F1",
    position: "absolute",
    right: 12,
    top: 14,
  },
});
