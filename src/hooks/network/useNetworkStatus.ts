import { useEffect, useState } from "react";
import NetInfo from "@react-native-community/netinfo";
// import { logger } from 'src/services/UnifiedLogger';

export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState<boolean | null>(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      // Do not treat null as offline
      if (state.isInternetReachable === null) {
        console.info("[Network] Checking connectivity...");
        return;
      }

      const online =
        Boolean(state.isConnected) && Boolean(state.isInternetReachable);

      setIsOnline(online);

      console.info("[Network] Status changed:", {
        isOnline: online,
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
        type: state.type,
      });
    });

    return unsubscribe;
  }, []);

  return isOnline;
};
