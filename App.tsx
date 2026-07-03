import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider } from './src/contex/AuthContext'; 
import { NotificationProvider } from './src/contex/NotificationContext';
import AppNavigator from './src/navigations/AppNavigator';
import { navigationRef } from './src/navigations/NavigationService';

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <NavigationContainer ref={navigationRef}>
          <AppNavigator />
        </NavigationContainer>
      </NotificationProvider>
    </AuthProvider>
  );
}
