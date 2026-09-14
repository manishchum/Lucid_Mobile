import React, { useEffect, useState, useRef, useCallback } from "react";
import { View, StyleSheet, Alert } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import {
  createBottomTabNavigator,
  BottomTabBar,
} from "@react-navigation/bottom-tabs";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useObserve } from "expo-observe";
import * as ExpoSplashScreen from "expo-splash-screen";

import { useAuth } from "../contex/AuthContext";
import { TenantProvider, useTenant } from "../contex/TenantContext";
import { DrawerProvider, useDrawer } from "../contex/DrawerContext";
import {
  ActiveSprintProvider,
  useActiveSprint,
} from "../contex/ActiveSprintContext";
import {
  PodcastPlayerProvider,
  usePodcastPlayer,
} from "../contex/PodcastPlayerContext";
import { PodcastMiniPlayer } from "../components/podcast/PodcastMiniPlayer";
import { APP_ROUTES, STACK_ROUTES } from "./Routes";
import { initMobileErrorReporting } from "../utils/errorReporter";
import { initOfflineQueueListener } from "../utils/offlineQueue";
import { SplashScreen } from "../components/splash/SplashScreen";

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
import RoleplayScreen from "../screens/home/roleplay/RoleplayScreen";
import RoleplaySessionScreen from "../screens/home/roleplay/RoleplaySessionScreen";
import RoleplayReportScreen from "../screens/home/roleplay/RoleplayReportScreen";

// Components
import AppHeader from "../components/navigation/AppHeader";
import AppDrawer from "../components/navigation/AppDrawer";
import LeaderboardModal from "../components/leaderboard/LeaderboardModal";
import NotificationsModal from "../components/notifications/NotificationsModal";
import {
  useGetDashboardSummary,
  useGetLeaderboardHighlight,
} from "../api/users";

// Prevent Expo splash screen from auto-hiding until our custom animated splash renders
ExpoSplashScreen.preventAutoHideAsync().catch(() => {});

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Bottom Tab Navigator
function BottomTabNavigator() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      tabBar={(props) => (
        <View style={{ backgroundColor: "#ffffff" }}>
          <PodcastMiniPlayer />
          <BottomTabBar {...props} />
        </View>
      )}
      screenOptions={({ route }: any) => ({
        headerShown: true,
        header: () => <AppHeader />,
        tabBarActiveTintColor: "#6366f1",
        tabBarInactiveTintColor: "#a1a5b4",
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: "#e5e7eb",
          backgroundColor: "#ffffff",
          paddingBottom: insets.bottom > 0 ? insets.bottom : 4,
          paddingVertical: 8,
          height: 52 + (insets.bottom > 0 ? insets.bottom : 0),
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginTop: 0,
          marginBottom: 2,
        },
        tabBarIcon: ({ color }: any) => {
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
            <MaterialCommunityIcons name={iconName} size={22} color={color} />
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

  const [isSplashActive, setIsSplashActive] = useState(false);
  const isInitialStateSetRef = useRef(false);
  const prevIsLoggedInRef = useRef<boolean | null>(null);
  const appStartTimeRef = useRef(Date.now());

  useEffect(() => {
    if (isInitializing) return;

    if (!isInitialStateSetRef.current) {
      isInitialStateSetRef.current = true;
      // Hide native Expo splash screen as soon as JS auth initialization is complete
      ExpoSplashScreen.hideAsync().catch(() => {});

      if (isLoggedIn) {
        // Scenario 2: Recurring user (already logged in) -> show animated splash screen
        console.log("[AppNavigator] Launching recurring user flow -> showing splash screen");
        setIsSplashActive(true);
      } else {
        // Scenario 1: First-time user / unauthenticated -> skip pre-login splash, go to login screen directly
        console.log("[AppNavigator] Launching first-time / unauthenticated flow -> showing login screen");
        setIsSplashActive(false);
      }
    } else {
      // Handle post-login transition (unauthenticated -> authenticated)
      if (prevIsLoggedInRef.current === false && isLoggedIn) {
        console.log("[AppNavigator] Post-login transition detected -> triggering splash screen");
        appStartTimeRef.current = Date.now();
        setIsSplashActive(true);
      }
    }

    prevIsLoggedInRef.current = isLoggedIn;
  }, [isInitializing, isLoggedIn]);

  const handleSplashComplete = useCallback(() => {
    const splashDuration = Date.now() - appStartTimeRef.current;
    console.log(
      `[PerfMeter] 🚀 APP INITIALIZATION & SPLASH COMPLETED: Total Splash Active=${splashDuration}ms | IsLoggedIn=${isLoggedIn} | UserId=${cachedUser?.userId ?? "guest"}`
    );
    setIsSplashActive(false);
  }, [isLoggedIn, cachedUser]);

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

  const { markInteractive } = useObserve();

  // Start production crash/error reporting to the same /api/logs endpoint web points to
  const cachedEmailRef = useRef<string | null>(null);
  cachedEmailRef.current = cachedUser?.email ?? null;
  useEffect(() => {
    initMobileErrorReporting(() => cachedEmailRef.current);
    // Register offline queue listener — replays queued submissions on reconnect
    initOfflineQueueListener();
  }, []);

  useEffect(() => {
    if (!isInitializing) {
      markInteractive();
    }
  }, [isInitializing, markInteractive]);

  // Pre-fetch global leaderboard state & dashboard summary while splash screen is active
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

  const { stats, isLoading: isDashboardLoading } = useGetDashboardSummary(
    isLoggedIn ? userId : null,
    isLoggedIn ? companyId : null,
  );
  const progressPercentage = stats?.progressPercentage ?? 0;

  // Data is fully ready when auth initialization completes AND if logged in, initial dashboard summary has finished fetching
  const isDataReady = !isInitializing && (!isLoggedIn || !isDashboardLoading);

  if (isInitializing) {
    return <View style={{ flex: 1, backgroundColor: "#FFFFFF" }} />;
  }

  if (isSplashActive) {
    return (
      <SplashScreen
        isDataReady={isDataReady}
        onAnimationComplete={handleSplashComplete}
        minimumDurationMs={1500}
      />
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
            <Stack.Screen
              name={STACK_ROUTES.ROLEPLAY}
              component={RoleplayScreen}
              options={{
                presentation: "card",
                animation: "slide_from_right",
                headerShown: false,
              }}
            />
            <Stack.Screen
              name={STACK_ROUTES.ROLEPLAY_SESSION}
              component={RoleplaySessionScreen}
              options={{
                presentation: "card",
                animation: "slide_from_right",
                headerShown: false,
              }}
            />
            <Stack.Screen
              name={STACK_ROUTES.ROLEPLAY_REPORT}
              component={RoleplayReportScreen}
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
        <PodcastPlayerProvider>
          <DrawerProvider>
            <AppNavigatorContent />
          </DrawerProvider>
        </PodcastPlayerProvider>
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
