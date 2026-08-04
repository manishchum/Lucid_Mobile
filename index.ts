import { registerRootComponent } from 'expo';

import App from './App';

// Safe register background message handler for FCM (Push Notifications in background/closed state)
try {
  const messaging = require('@react-native-firebase/messaging').default;
  if (messaging) {
    messaging().setBackgroundMessageHandler(async (remoteMessage: any) => {
      const type = remoteMessage.data?.type || "";
      const userId = remoteMessage.data?.userId || "";
      const companyId = remoteMessage.data?.companyId || "";

      const AsyncStorage = require('@react-native-async-storage/async-storage').default;

      // Resolve user/company IDs from cache if not in payload
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

      // COST-02: Only fetch what this specific notification type actually needs.
      // Avoid the previous pattern of always fetching dashboard + categories + items.
      const needsDashboard =
        type === "sprint_assigned" ||
        type === "sprint_updated" ||
        type === "dashboard_update" ||
        type === ""; // unknown type — refresh dashboard as a safe default

      const needsContent =
        type === "content_updated" ||
        type === "categories_updated";

      if (needsDashboard && resolvedUserId) {
        try {
          const { getDashboardSummary } = require('./src/api/users/Request');
          const data = await getDashboardSummary(resolvedUserId, resolvedCompanyId || "");
          await AsyncStorage.setItem(`@dashboard_data_${resolvedUserId}`, JSON.stringify(data));
          console.log('[FCM Background] Dashboard cache updated for type:', type);
        } catch (err: any) {
          console.error('[FCM Background] Dashboard cache update failed:', err.message);
        }
      }

      if (needsContent && resolvedCompanyId) {
        try {
          const { getContentCategories, getContentItems } = require('./src/api/content-library/Request');
          const catResponse = await getContentCategories(resolvedCompanyId);
          await AsyncStorage.setItem(
            `@content_categories_${resolvedCompanyId}`,
            JSON.stringify(catResponse.data || []),
          );
          const itemsResponse = await getContentItems(undefined, resolvedCompanyId);
          await AsyncStorage.setItem(
            `@content_items_all_${resolvedCompanyId}`,
            JSON.stringify(itemsResponse.data || []),
          );
          console.log('[FCM Background] Content cache updated for type:', type);
        } catch (err: any) {
          console.error('[FCM Background] Content cache update failed:', err.message);
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
