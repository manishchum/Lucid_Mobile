import React, { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet, Alert } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../contex/AuthContext";
import { TenantProvider, useTenant } from "../contex/TenantContext";
import { DrawerProvider, useDrawer } from "../contex/DrawerContext";
import {
  ActiveSprintProvider,
  useActiveSprint,
} from "../contex/ActiveSprintContext";
import { APP_ROUTES, STACK_ROUTES } from "./Routes";

// Screens
import LoginScreen from "../screens/auth/loginScreen/LoginScreen";
import OTPScreen from "../screens/auth/OTPScreen";
import HomeScreen from "../screens/home/homeScreen/HomeScreen";
import SprintScreen from "../screens/home/SprintScreen";
import StudioScreen from "../screens/home/StudioScreen";
import ProfileScreen from "../screens/home/ProfileScreen";
import ModuleQuizScreen from "../screens/home/ModuleQuizScreen";
import NotificationsScreen from "../screens/home/NotificationsScreen";
import ContentLibraryScreen from "../screens/home/ContentLibraryScreen";
import ContentViewerScreen from "../screens/home/ContentViewerScreen";
import SprintverseScreen from "../screens/home/SprintverseScreen";
import ReportsScreen from "../screens/home/ReportsScreen";

// Components
import AppHeader from "../components/navigation/AppHeader";
import AppDrawer from "../components/navigation/AppDrawer";
import LeaderboardModal from "../components/leaderboard/LeaderboardModal";
import NotificationsModal from "../components/notifications/NotificationsModal";
import {
  useGetDashboardSummary,
  useGetLeaderboardHighlight,
} from "../api/users";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Bottom Tab Navigator
function BottomTabNavigator() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }: any) => ({
        headerShown: true,
        header: () => <AppHeader />,
        tabBarActiveTintColor: "#6366f1",
        tabBarInactiveTintColor: "#a1a5b4",
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: "#e5e7eb",
          backgroundColor: "#ffffff",
          paddingBottom: insets.bottom + 8,
          height: 60 + insets.bottom,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          marginTop: 4,
        },
        tabBarIcon: ({ color, size }: any) => {
          let iconName: React.ComponentProps<
            typeof MaterialCommunityIcons
          >["name"];

          switch (route.name) {
            case APP_ROUTES.HOME:
              iconName = "home";
              break;
            case STACK_ROUTES.SPRINT:
              iconName = "lightning-bolt";
              break;
            case STACK_ROUTES.STUDIO:
              iconName = "brush";
              break;
            case APP_ROUTES.CONTENT_LIBRARY:
              iconName = "folder-multiple";
              break;
            case APP_ROUTES.SPRINTVERSE:
              iconName = "compass";
              break;
            default:
              iconName = "home";
          }

          return (
            <MaterialCommunityIcons name={iconName} size={size} color={color} />
          );
        },
      })}
    >
      <Tab.Screen
        name={APP_ROUTES.HOME}
        component={HomeScreen}
        options={{ tabBarLabel: "Home" }}
      />
      <Tab.Screen
        name={STACK_ROUTES.SPRINT}
        component={SprintScreen}
        options={{ tabBarLabel: "Sprint" }}
      />
      <Tab.Screen
        name={STACK_ROUTES.STUDIO}
        component={StudioScreen}
        options={{ tabBarLabel: "Studio" }}
      />
      <Tab.Screen
        name={APP_ROUTES.CONTENT_LIBRARY}
        component={ContentLibraryScreen}
        options={{ tabBarLabel: "Library" }}
      />
    </Tab.Navigator>
  );
}

// Auth Stack Navigator
function AuthNavigator() {
  const { otpStep } = useAuth();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {otpStep ? (
        <Stack.Screen name="OTP" component={OTPScreen} />
      ) : (
        <Stack.Screen name="LOGIN" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}

function AppNavigatorContent() {
  const {
    isLoggedIn,
    isInitializing,
    cachedUser,
    forcedLogoutReason,
    clearForcedLogoutReason,
  } = useAuth();
  const {
    isLeaderboardOpen,
    setIsLeaderboardOpen,
    isNotificationsOpen,
    setIsNotificationsOpen,
  } = useDrawer();

  useEffect(() => {
    if (!forcedLogoutReason) return;
    const message =
      forcedLogoutReason === "company_deactivated"
        ? "Your company's access has been suspended. Please contact your administrator."
        : forcedLogoutReason === "session_terminated"
          ? "You were logged out because you signed in on another device."
          : "Your account has been deactivated. Please contact your administrator.";
    Alert.alert("Signed out", message, [
      { text: "OK", onPress: clearForcedLogoutReason },
    ]);
  }, [forcedLogoutReason]);

  const userId = cachedUser?.userId ?? null;
  const companyId = cachedUser?.companyId ?? null;

  // Global leaderboard state and fetching
  const {
    leaderboardData,
    isLoading: leaderboardLoading,
    error: leaderboardError,
    refetch: refetchLeaderboard,
  } = useGetLeaderboardHighlight(
    isLoggedIn ? companyId : null,
    isLoggedIn ? userId : null,
    10,
    isLeaderboardOpen,
  );

  const { stats } = useGetDashboardSummary(
    isLoggedIn ? userId : null,
    isLoggedIn ? companyId : null,
  );
  const progressPercentage = stats?.progressPercentage ?? 0;

  if (isInitializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isLoggedIn ? (
          <>
            <Stack.Screen name="AppTabs" component={BottomTabNavigator} />
            <Stack.Screen
              name={APP_ROUTES.PROFILE}
              component={ProfileScreen}
              options={{ presentation: "card", animation: "slide_from_right" }}
            />
            <Stack.Screen
              name={STACK_ROUTES.MODULE_QUIZ}
              component={ModuleQuizScreen}
              options={{ presentation: "card", animation: "slide_from_right" }}
            />
            <Stack.Screen
              name={STACK_ROUTES.NOTIFICATIONS}
              component={NotificationsScreen}
              options={{ presentation: "card", animation: "slide_from_right" }}
            />
            <Stack.Screen
              name={STACK_ROUTES.CONTENT_VIEWER}
              component={ContentViewerScreen}
              options={{
                presentation: "card",
                animation: "slide_from_right",
                headerShown: false,
              }}
            />
            <Stack.Screen
              name={APP_ROUTES.SPRINTVERSE}
              component={SprintverseScreen}
              options={{
                presentation: "card",
                animation: "slide_from_right",
                headerShown: false,
              }}
            />
            <Stack.Screen
              name={APP_ROUTES.REPORTS}
              component={ReportsScreen}
              options={{
                presentation: "card",
                animation: "slide_from_right",
                headerShown: false,
              }}
            />
          </>
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>

      {/* Global Slide-out Drawer */}
      {isLoggedIn && <AppDrawer />}

      {/* Global Leaderboard Modal */}
      {isLoggedIn && (
        <LeaderboardModal
          isOpen={isLeaderboardOpen}
          onClose={() => setIsLeaderboardOpen(false)}
          leaderboardData={leaderboardData}
          isLoading={leaderboardLoading}
          error={leaderboardError}
          currentUser={cachedUser}
          currentProgressPercentage={progressPercentage}
          onRefresh={() => refetchLeaderboard(true)}
        />
      )}

      {/* Global Notifications Modal */}
      {isLoggedIn && (
        <NotificationsModal
          isOpen={isNotificationsOpen}
          onClose={() => setIsNotificationsOpen(false)}
        />
      )}
    </View>
  );
}

// Root Navigator wrapper providing all contexts
export default function AppNavigator() {
  return (
    <TenantProvider>
      <ActiveSprintProvider>
        <DrawerProvider>
          <AppNavigatorContent />
        </DrawerProvider>
      </ActiveSprintProvider>
    </TenantProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
});
