import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { ObserveRoot } from 'expo-observe';
import { AuthProvider } from './src/contex/AuthContext'; 
import { NotificationProvider } from './src/contex/NotificationContext';
import AppNavigator from './src/navigations/AppNavigator';
import { navigationRef } from './src/navigations/NavigationService';
import { ErrorBoundary } from './src/components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AuthProvider>
          <NotificationProvider>
            <NavigationContainer ref={navigationRef}>
              <AppNavigator />
            </NavigationContainer>
          </NotificationProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

export default ObserveRoot.wrap(App);

