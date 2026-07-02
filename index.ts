import { registerRootComponent } from 'expo';

import App from './App';

// Safe register background message handler for FCM (Push Notifications in background/closed state)
try {
  const messaging = require('@react-native-firebase/messaging').default;
  if (messaging) {
    messaging().setBackgroundMessageHandler(async (remoteMessage: any) => {
      console.log('[FCM] Message handled in the background:', remoteMessage);
    });
  }
} catch (e) {
  console.log(
    '[index] Firebase Messaging is not natively installed; skipping background handler registration.'
  );
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
