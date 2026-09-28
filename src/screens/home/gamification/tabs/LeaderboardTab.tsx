import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { GC } from "../drills/GamificationColors";
import { LeaderboardUser } from "../../../../api/gamification/Request";

interface Props {
  data: LeaderboardUser[];
  isLoading: boolean;
  onRefresh: () => void;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function LeaderboardTab({ data, isLoading, onRefresh }: Props) {
  const top3 = data.slice(0, 3);
  const rest = data.slice(3);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={GC.primary} size="large" />
      </View>
    );
  }

  if (data.length === 0) {
    return (
      <View style={styles.center}>
        <MaterialCommunityIcons name="trophy-outline" size={48} color={GC.textMuted} />
        <Text style={styles.emptyTitle}>No Rankings Yet</Text>
        <Text style={styles.emptySubtitle}>Complete drills to appear on the leaderboard.</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      {/* Background Gradient matching Image 2 */}
      <LinearGradient
        colors={["#1A0B2E", "#35155D"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={onRefresh}
            tintColor={"#FFF"}
            colors={["#FFF"]}
          />
        }
      >
        {/* Podium Section */}
        <View style={styles.podiumSection}>
          {top3.length >= 2 && (
            <View style={styles.podiumItemWrapper}>
              <View style={styles.podiumAvatarContainer}>
                <View style={styles.podiumAvatar}>
                  <Text style={styles.podiumAvatarText}>{getInitials(top3[1]?.name || "")}</Text>
                </View>
                <View style={styles.rankBadge}>
                  <Text style={styles.rankBadgeText}>2</Text>
                </View>
              </View>
              <Text style={styles.podiumName} numberOfLines={1}>{top3[1]?.name}</Text>
              <View style={styles.xpRow}>
                <MaterialCommunityIcons name="star-four-points" size={14} color="#A855F7" />
                <Text style={styles.podiumXp}>{(top3[1]?.xp || 0).toLocaleString()}</Text>
              </View>
              <View style={[styles.podiumBlock, { height: 110 }]}>
                <Text style={styles.podiumBlockText}>2</Text>
              </View>
            </View>
          )}

          {top3.length >= 1 && (
            <View style={[styles.podiumItemWrapper, styles.podiumFirst]}>
              <View style={styles.podiumAvatarContainer}>
                <View style={[styles.podiumAvatar, styles.podiumAvatarFirst]}>
                  <Text style={styles.podiumAvatarTextFirst}>{getInitials(top3[0]?.name || "")}</Text>
                </View>
                <View style={[styles.rankBadge, styles.rankBadgeFirst]}>
                  <Text style={styles.rankBadgeTextFirst}>1</Text>
                </View>
              </View>
              <Text style={[styles.podiumName, styles.podiumNameFirst]} numberOfLines={1}>
                {top3[0]?.name}
              </Text>
              <View style={styles.xpRow}>
                <MaterialCommunityIcons name="star-four-points" size={14} color="#A855F7" />
                <Text style={styles.podiumXp}>{(top3[0]?.xp || 0).toLocaleString()}</Text>
              </View>
              <View style={[styles.podiumBlock, { height: 160 }]}>
                <Text style={styles.podiumBlockText}>1</Text>
              </View>
            </View>
          )}

          {top3.length >= 3 && (
            <View style={styles.podiumItemWrapper}>
              <View style={styles.podiumAvatarContainer}>
                <View style={styles.podiumAvatar}>
                  <Text style={styles.podiumAvatarText}>{getInitials(top3[2]?.name || "")}</Text>
                </View>
                <View style={[styles.rankBadge, { backgroundColor: "#B45309" }]}>
                  <Text style={styles.rankBadgeText}>3</Text>
                </View>
              </View>
              <Text style={styles.podiumName} numberOfLines={1}>{top3[2]?.name}</Text>
              <View style={styles.xpRow}>
                <MaterialCommunityIcons name="star-four-points" size={14} color="#A855F7" />
                <Text style={styles.podiumXp}>{(top3[2]?.xp || 0).toLocaleString()}</Text>
              </View>
              <View style={[styles.podiumBlock, { height: 90 }]}>
                <Text style={styles.podiumBlockText}>3</Text>
              </View>
            </View>
          )}
        </View>

        {/* List Section */}
        <View style={styles.listSection}>
          {rest.map((user, i) => {
            const rank = i + 4;
            return (
              <View
                key={user.id}
                style={[styles.row, user.is_current_user && styles.rowCurrent]}
              >
                {/* Background Huge Number */}
                <View style={styles.hugeRankContainer}>
                  <Text style={styles.hugeRankText}>{rank}</Text>
                </View>

                {/* Content */}
                <View style={styles.rowContent}>
                  <View style={styles.listAvatar}>
                    <Text style={styles.listAvatarText}>{getInitials(user.name)}</Text>
                  </View>
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowName}>{user.name}</Text>
                    <View style={styles.xpRow}>
                      <MaterialCommunityIcons name="star-four-points" size={12} color="#A855F7" />
                      <Text style={styles.rowXp}>{user.xp.toLocaleString()}</Text>
                    </View>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  container: { paddingBottom: 100 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    backgroundColor: "#1A0B2E",
  },
  emptyTitle: { color: "#FFF", fontSize: 18, fontWeight: "800", marginTop: 16 },
  emptySubtitle: { color: "#94A3B8", fontSize: 14, textAlign: "center", marginTop: 8 },
  podiumSection: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingTop: 40,
    marginBottom: 20,
  },
  podiumItemWrapper: {
    flex: 1,
    alignItems: "center",
  },
  podiumFirst: {
    flex: 1.1,
    zIndex: 10,
  },
  podiumAvatarContainer: {
    position: "relative",
    marginBottom: 8,
  },
  podiumAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#3B82F6",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFF",
  },
  podiumAvatarFirst: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#EF4444",
  },
  podiumAvatarText: {
    color: "#FFF",
    fontSize: 20,
    fontWeight: "900",
  },
  podiumAvatarTextFirst: {
    color: "#FFF",
    fontSize: 26,
    fontWeight: "900",
  },
  rankBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "#94A3B8", // silver for 2
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#1A0B2E",
  },
  rankBadgeFirst: {
    backgroundColor: "#F59E0B", // gold for 1
    width: 26,
    height: 26,
    borderRadius: 13,
    top: -8,
    right: -8,
  },
  rankBadgeText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "bold",
  },
  rankBadgeTextFirst: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "bold",
  },
  podiumName: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
    maxWidth: 90,
  },
  podiumNameFirst: {
    color: "#EF4444", // Red name for 1st place in image 2
    fontSize: 16,
  },
  xpRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
    marginTop: 2,
  },
  podiumXp: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "800",
  },
  podiumBlock: {
    width: "95%",
    backgroundColor: "#475569", // grey podium blocks
    justifyContent: "center",
    alignItems: "center",
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -4 },
  },
  podiumBlockText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 48,
    fontWeight: "900",
  },
  listSection: {
    paddingHorizontal: 16,
    gap: 12,
    paddingTop: 10,
    backgroundColor: "#1A1A24",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    minHeight: 400,
  },
  row: {
    backgroundColor: "#2C2C35",
    borderRadius: 20,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
    overflow: "hidden",
  },
  rowCurrent: {
    borderWidth: 1,
    borderColor: "#A855F7",
  },
  hugeRankContainer: {
    position: "absolute",
    left: 8,
    top: 4,
    bottom: 0,
    justifyContent: "center",
  },
  hugeRankText: {
    fontSize: 64,
    fontWeight: "900",
    color: "rgba(255, 255, 255, 0.05)",
  },
  rowContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginLeft: 30, // push past the huge number
  },
  listAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#3B82F6",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  listAvatarText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  rowInfo: {
    flex: 1,
    justifyContent: "center",
  },
  rowName: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 2,
  },
  rowXp: {
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "700",
  },
});
