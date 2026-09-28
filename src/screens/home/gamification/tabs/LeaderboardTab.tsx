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
import { GC } from "../drills/GamificationColors";
import { LeaderboardUser } from "../../../../api/gamification/Request";

interface Props {
  data: LeaderboardUser[];
  isLoading: boolean;
  onRefresh: () => void;
}

const MEDAL_COLORS = ["#F59E0B", "#94A3B8", "#B45309"];
const MEDAL_EMOJIS = ["🥇", "🥈", "🥉"];

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
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={false}
          onRefresh={onRefresh}
          tintColor={GC.primary}
          colors={[GC.primary]}
        />
      }
    >
      {/* Podium */}
      <View style={styles.podiumSection}>
        {top3.length >= 2 && (
          <View style={styles.podiumItem}>
            <Text style={styles.podiumMedal}>{MEDAL_EMOJIS[1]}</Text>
            <View style={[styles.podiumAvatar, { borderColor: MEDAL_COLORS[1] }]}>
              <Text style={styles.podiumAvatarText}>{getInitials(top3[1]?.name || "")}</Text>
            </View>
            <Text style={styles.podiumName} numberOfLines={1}>{top3[1]?.name}</Text>
            <Text style={[styles.podiumXp, { color: MEDAL_COLORS[1] }]}>
              {(top3[1]?.xp || 0).toLocaleString()} XP
            </Text>
            <View style={[styles.podiumBase, { backgroundColor: MEDAL_COLORS[1] + "22", height: 60 }]} />
          </View>
        )}

        {top3.length >= 1 && (
          <View style={[styles.podiumItem, styles.podiumFirst]}>
            <Text style={styles.podiumCrown}>👑</Text>
            <Text style={styles.podiumMedal}>{MEDAL_EMOJIS[0]}</Text>
            <View style={[styles.podiumAvatar, styles.podiumAvatarFirst, { borderColor: MEDAL_COLORS[0] }]}>
              <Text style={styles.podiumAvatarTextFirst}>{getInitials(top3[0]?.name || "")}</Text>
            </View>
            <Text style={styles.podiumName} numberOfLines={1}>{top3[0]?.name}</Text>
            <Text style={[styles.podiumXp, { color: MEDAL_COLORS[0] }]}>
              {(top3[0]?.xp || 0).toLocaleString()} XP
            </Text>
            <View style={[styles.podiumBase, { backgroundColor: MEDAL_COLORS[0] + "22", height: 80 }]} />
          </View>
        )}

        {top3.length >= 3 && (
          <View style={styles.podiumItem}>
            <Text style={styles.podiumMedal}>{MEDAL_EMOJIS[2]}</Text>
            <View style={[styles.podiumAvatar, { borderColor: MEDAL_COLORS[2] }]}>
              <Text style={styles.podiumAvatarText}>{getInitials(top3[2]?.name || "")}</Text>
            </View>
            <Text style={styles.podiumName} numberOfLines={1}>{top3[2]?.name}</Text>
            <Text style={[styles.podiumXp, { color: MEDAL_COLORS[2] }]}>
              {(top3[2]?.xp || 0).toLocaleString()} XP
            </Text>
            <View style={[styles.podiumBase, { backgroundColor: MEDAL_COLORS[2] + "22", height: 44 }]} />
          </View>
        )}
      </View>

      {/* Rest of leaderboard */}
      {rest.map((user, i) => {
        const rank = i + 4;
        return (
          <View
            key={user.id}
            style={[styles.row, user.is_current_user && styles.rowCurrent]}
          >
            <Text style={[styles.rank, user.is_current_user && styles.rankCurrent]}>
              #{rank}
            </Text>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(user.name)}</Text>
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowName}>{user.name}</Text>
              <Text style={styles.rowRole} numberOfLines={1}>{user.role}</Text>
            </View>
            <View style={styles.rowStats}>
              <View style={styles.statItem}>
                <MaterialCommunityIcons name="shield-star" size={12} color={GC.primaryLight} />
                <Text style={styles.statText}>{user.badges_count}</Text>
              </View>
              <Text style={styles.xpText}>{user.xp.toLocaleString()} XP</Text>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 10, paddingBottom: 80 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 16,
  },
  emptyTitle: { color: GC.textPrimary, fontSize: 18, fontWeight: "800" },
  emptySubtitle: { color: GC.textMuted, fontSize: 14, textAlign: "center" },
  podiumSection: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 8,
    marginBottom: 8,
    paddingVertical: 8,
  },
  podiumItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  podiumFirst: { flex: 1.2 },
  podiumCrown: { fontSize: 20 },
  podiumMedal: { fontSize: 22 },
  podiumAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: GC.card,
    borderWidth: 2.5,
    justifyContent: "center",
    alignItems: "center",
  },
  podiumAvatarFirst: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
  },
  podiumAvatarText: {
    color: GC.textPrimary,
    fontSize: 16,
    fontWeight: "900",
  },
  podiumAvatarTextFirst: {
    color: GC.textPrimary,
    fontSize: 20,
    fontWeight: "900",
  },
  podiumName: {
    color: GC.textPrimary,
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
    maxWidth: 80,
  },
  podiumXp: { fontSize: 11, fontWeight: "900" },
  podiumBase: {
    width: "100%",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    marginTop: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: GC.card,
    borderRadius: 14,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: GC.border,
  },
  rowCurrent: {
    borderColor: GC.primary,
    backgroundColor: "#140D2B",
  },
  rank: {
    color: GC.textMuted,
    fontSize: 13,
    fontWeight: "900",
    width: 28,
    textAlign: "center",
  },
  rankCurrent: { color: GC.primaryLight },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: GC.primary + "33",
    borderWidth: 1,
    borderColor: GC.primaryBorder,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { color: GC.primaryLight, fontSize: 13, fontWeight: "900" },
  rowInfo: { flex: 1 },
  rowName: { color: GC.textPrimary, fontSize: 14, fontWeight: "700" },
  rowRole: { color: GC.textMuted, fontSize: 11, fontWeight: "500" },
  rowStats: { alignItems: "flex-end", gap: 2 },
  statItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  statText: { color: GC.primaryLight, fontSize: 11, fontWeight: "700" },
  xpText: { color: GC.gold, fontSize: 13, fontWeight: "900" },
});
