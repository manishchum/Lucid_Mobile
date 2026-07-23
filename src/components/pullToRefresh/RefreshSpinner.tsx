import React from "react";
import { RefreshControl, Platform } from "react-native";

export default function getRefreshControl(
  refreshing: boolean,
  onRefresh: () => void | Promise<void>,
  color = "#6366F1", // Indigo primary color
  backgroundColor = "#FFFFFF",
) {
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      colors={[color]} // Android progress indicator color
      tintColor={color} // iOS progress indicator color
      progressBackgroundColor={backgroundColor} // Android card background
      title={Platform.OS === "ios" ? "Pull to refresh" : undefined}
      titleColor={Platform.OS === "ios" ? "#94A3B8" : undefined}
    />
  );
}
