import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider } from './src/contex/AuthContext'; 
import { NotificationProvider } from './src/contex/NotificationContext';
import AppNavigator from './src/navigations/AppNavigator';

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      </NotificationProvider>
    </AuthProvider>
  );
}
