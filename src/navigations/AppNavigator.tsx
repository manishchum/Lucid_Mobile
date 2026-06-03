import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../contex/AuthContext';
import { APP_ROUTES } from './Routes';

// Screens
import LoginScreen from '../screens/auth/loginScreen/LoginScreen';
import OTPScreen from '../screens/auth/OTPScreen';
import HomeScreen from '../screens/home/homeScreen/HomeScreen';
import SprintScreen from '../screens/home/SprintScreen';
import StudioScreen from '../screens/home/StudioScreen';
import ProfileScreen from '../screens/home/ProfileScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Bottom Tab Navigator
function BottomTabNavigator() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#6366f1',
        tabBarInactiveTintColor: '#a1a5b4',
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: '#e5e7eb',
          backgroundColor: '#ffffff',
          // Adds exactly the gesture-nav / button-nav height on Android,
          // and the home-indicator inset on iPhone. Keeps the 8px design
          // padding on top of whatever the system needs.
          paddingBottom: insets.bottom + 8,
          height: 60 + insets.bottom,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          marginTop: 4,
        },
        tabBarIcon: ({ color, size }) => {
          let iconName;

          switch (route.name) {
            case APP_ROUTES.HOME:
              iconName = 'home';
              break;
            case APP_ROUTES.SPRINT:
              iconName = 'lightning-bolt';
              break;
            case APP_ROUTES.STUDIO:
              iconName = 'brush';
              break;
            case APP_ROUTES.PROFILE:
              iconName = 'account';
              break;
            default:
              iconName = 'home';
          }

          return <MaterialCommunityIcons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name={APP_ROUTES.HOME}
        component={HomeScreen}
        options={{ tabBarLabel: 'Home' }}
      />
      <Tab.Screen
        name={APP_ROUTES.SPRINT}
        component={SprintScreen}
        options={{ tabBarLabel: 'Sprint' }}
      />
      <Tab.Screen
        name={APP_ROUTES.STUDIO}
        component={StudioScreen}
        options={{
          tabBarLabel: 'Studio',
          // Preserve the module params when user switches away and back
          unmountOnBlur: false,
        }}
      />
      <Tab.Screen
        name={APP_ROUTES.PROFILE}
        component={ProfileScreen}
        options={{ tabBarLabel: 'Profile' }}
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

// Root Navigator
// isInitializing: true while Firebase resolves the persisted session on cold
// start. We show a full-screen spinner rather than flashing the Login screen
// briefly before redirecting to Home.
export default function AppNavigator() {
  const { isLoggedIn, isInitializing } = useAuth();

  if (isInitializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isLoggedIn ? (
        <>
          <Stack.Screen name="AppTabs" component={BottomTabNavigator} />
        </>
      ) : (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
});