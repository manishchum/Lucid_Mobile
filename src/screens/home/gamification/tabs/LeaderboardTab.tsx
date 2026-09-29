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
import Svg, { Polygon, Rect, Defs, LinearGradient as SvgLinearGradient, Stop, Ellipse } from "react-native-svg";
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

const PodiumBlock3D = ({ width, height, rank, dy = 3, leftInset = 12, rightInset = 12 }: { width: number; height: number; rank: number, dy?: number, leftInset?: number, rightInset?: number }) => {
  return (
    <View style={{ width, height: height + dy, position: "relative", marginTop: 0, zIndex: -1 }}>
      <Svg width={width} height={height + dy}>
        <Defs>
          <SvgLinearGradient id={`frontGrad${rank}`} x1="10%" y1="100%" x2="0%" y2="0%">
            <Stop offset="10%" stopColor="#2A2A2A" />
            <Stop offset="100%" stopColor="#A3A3A3" />
          </SvgLinearGradient>
          <SvgLinearGradient id={`topGrad${rank}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="10%" stopColor="#C4C4C4" />
            <Stop offset="100%" stopColor="#FFFFFF" />
          </SvgLinearGradient>
        </Defs>

        {/* Top Face (Trapezoid) */}
        <Polygon 
          points={`${leftInset},20 ${width - rightInset},20 ${width},${dy} 0,${dy}`} 
          fill={`url(#topGrad${rank})`} 
        />
        
        {/* Floating Shadow on Top Face (Stacked Opacity to avoid Android RadialGradient bugs) */}
        <Ellipse cx={width / 2} cy={20 + (dy - 20) / 2} rx={width / 2.2} ry={(dy - 20) / 2.2} fill="rgba(0,0,0,0)" />
        <Ellipse cx={width / 2} cy={20 + (dy - 20) / 2} rx={width / 2.8} ry={(dy - 20) / 2.8} fill="rgba(0,0,0,0.01)" />
        <Ellipse cx={width / 2} cy={20 + (dy - 20) / 2} rx={width / 3.5} ry={(dy - 20) / 3.5} fill="rgba(0,0,0,0.02)" />
        <Ellipse cx={width / 2} cy={20 + (dy - 20) / 2} rx={width / 4.5} ry={(dy - 20) / 4.5} fill="rgba(0,0,0,0.04)" />

        {/* Front Face (Gradient Rectangle) */}
        <Rect 
          x={0} 
          y={dy} 
          width={width} 
          height={height} 
          fill={`url(#frontGrad${rank})`} 
        />

        {/* 3D Edge Bevel Highlights */}
        {/* <Rect x={0} y={dy} width={width} height={2} fill="rgba(255,255,255,0.9)" />
        <Rect x={0} y={dy} width={width} height={4} fill="rgba(255,255,255,0.4)" /> */}
      </Svg>

      <View style={{ position: "absolute", left: 0, top: dy, width: width, height: height, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ fontSize: 64, fontWeight: "900", color: "#F5F5F5", opacity: 0.9 }}>{rank}</Text>
      </View>
    </View>
  );
};

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
            <View style={[styles.podiumItemWrapper, { zIndex: 5, marginRight: -10, marginBottom: 15 }]}>
              <View style={styles.podiumAvatarContainer}>
                <View style={styles.podiumAvatar}>
                  <Text style={styles.podiumAvatarText}>{getInitials(top3[1]?.name || "")}</Text>
                </View>
                <View style={styles.rankBadge}>
                  <Text style={styles.rankBadgeText}>2</Text>
                </View>
              </View>
              <Text style={styles.podiumName}>{top3[1]?.name}</Text>
              <View style={styles.xpRow}>
                <MaterialCommunityIcons name="star-four-points" size={14} color="#A855F7" />
                <Text style={styles.podiumXp}>{(top3[1]?.xp || 0).toLocaleString()}</Text>
              </View>
              <PodiumBlock3D width={105} height={120} rank={2} dy={30} rightInset={0} leftInset={12} />
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
              <Text style={[styles.podiumName, styles.podiumNameFirst]}>
                {top3[0]?.name}
              </Text>
              <View style={styles.xpRow}>
                <MaterialCommunityIcons name="star-four-points" size={14} color="#A855F7" />
                <Text style={styles.podiumXp}>{(top3[0]?.xp || 0).toLocaleString()}</Text>
              </View>
              <PodiumBlock3D width={115} height={160} rank={1} dy={40} leftInset={12} rightInset={12} />
            </View>
          )}

          {top3.length >= 3 && (
            <View style={[styles.podiumItemWrapper, { zIndex: 1, marginLeft: -10, marginBottom: 30 }]}>
              <View style={styles.podiumAvatarContainer}>
                <View style={styles.podiumAvatar}>
                  <Text style={styles.podiumAvatarText}>{getInitials(top3[2]?.name || "")}</Text>
                </View>
                <View style={[styles.rankBadge, { backgroundColor: "#B45309" }]}>
                  <Text style={styles.rankBadgeText}>3</Text>
                </View>
              </View>
              <Text style={styles.podiumName}>{top3[2]?.name}</Text>
              <View style={styles.xpRow}>
                <MaterialCommunityIcons name="star-four-points" size={14} color="#A855F7" />
                <Text style={styles.podiumXp}>{(top3[2]?.xp || 0).toLocaleString()}</Text>
              </View>
              <PodiumBlock3D width={105} height={90} rank={3} dy={30} leftInset={0} rightInset={12} />
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
    marginBottom: -30,
  },
  podiumItemWrapper: {
    alignItems: "center",
  },
  podiumFirst: {
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
    color: "#FFF",
    fontSize: 12,
    fontWeight: "800",
  },
  listSection: {
    paddingHorizontal: 16,
    gap: 12,
    paddingTop: 20,
    marginTop: 0,
    zIndex:10,
    backgroundColor: "#1A1A24",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    minHeight: 400,
    paddingBottom: 800,
    marginBottom: -800,
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
