import { registerRootComponent } from 'expo';

import App from './App';

// Safe register background message handler for FCM (Push Notifications in background/closed state)
try {
  const messaging = require('@react-native-firebase/messaging').default;
  if (messaging) {
    messaging().setBackgroundMessageHandler(async (remoteMessage: any) => {
      console.log('[FCM] Message handled in the background:', remoteMessage);
      
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const { getDashboardSummary } = require('./src/api/users/Request');
      const { getContentCategories, getContentItems } = require('./src/api/content-library/Request');

      const type = remoteMessage.data?.type || "";
      const userId = remoteMessage.data?.userId || "";
      const companyId = remoteMessage.data?.companyId || "";

      let resolvedUserId = userId;
      let resolvedCompanyId = companyId;

      try {
        const cachedUserJson = await AsyncStorage.getItem('@cached_user');
        if (cachedUserJson) {
          const cachedUser = JSON.parse(cachedUserJson);
          if (!resolvedUserId) resolvedUserId = cachedUser.userId || cachedUser.user_id;
          if (!resolvedCompanyId) resolvedCompanyId = cachedUser.companyId || cachedUser.company_id;
        }
      } catch (e) {
        console.warn('[FCM Background] Failed to read cached user:', e);
      }

      if (resolvedUserId) {
        try {
          console.log('[FCM Background] Fetching fresh dashboard summary for user:', resolvedUserId);
          const data = await getDashboardSummary(resolvedUserId, resolvedCompanyId || "");
          const cacheKey = `@dashboard_data_${resolvedUserId}`;
          await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
          console.log('[FCM Background] Successfully updated dashboard cache.');
        } catch (err: any) {
          console.error('[FCM Background] Failed to update dashboard cache:', err.message);
        }
      }

      if (resolvedCompanyId) {
        try {
          console.log('[FCM Background] Fetching fresh content categories for company:', resolvedCompanyId);
          const response = await getContentCategories(resolvedCompanyId);
          const categories = response.data || [];
          const cacheKey = `@content_categories_${resolvedCompanyId}`;
          await AsyncStorage.setItem(cacheKey, JSON.stringify(categories));
          console.log('[FCM Background] Successfully updated content categories cache.');
        } catch (err: any) {
          console.error('[FCM Background] Failed to update content categories cache:', err.message);
        }

        try {
          console.log('[FCM Background] Fetching fresh content items for company:', resolvedCompanyId);
          const response = await getContentItems(undefined, resolvedCompanyId);
          const items = response.data || [];
          const cacheKey = `@content_items_all_${resolvedCompanyId}`;
          await AsyncStorage.setItem(cacheKey, JSON.stringify(items));
          console.log('[FCM Background] Successfully updated content items cache.');
        } catch (err: any) {
          console.error('[FCM Background] Failed to update content items cache:', err.message);
        }
      }
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
