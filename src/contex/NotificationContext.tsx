import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { Alert, AppState, AppStateStatus } from "react-native";
import messaging from "@react-native-firebase/messaging";
import { getAuth, getIdToken } from "@react-native-firebase/auth";
import { useAuth } from "./AuthContext";

let isMessagingSupported = false;
try {
  if (messaging) {
    messaging();
    isMessagingSupported = true;
  }
} catch (error) {
  console.log(
    "[NotificationContext] Firebase Messaging is not installed natively on this project. Falling back to WebSocket-only notifications."
  );
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
  metadata: any;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const EXPO_API_URL = process.env.EXPO_PUBLIC_API_URL || "https://api.workfloww.ai";
const API_BASE_URL = `${EXPO_API_URL}/api`;
const WS_BASE_URL = EXPO_API_URL.replace(/^http/, "ws") + "/api";

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoggedIn, cachedUser } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Helper to get headers for API requests
  const getAuthHeaders = async () => {
    const authInstance = getAuth();
    const currentUser = authInstance.currentUser;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (currentUser) {
      const token = await getIdToken(currentUser).catch(() => null);
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }
    if (cachedUser?.userId) {
      headers["X-User-ID"] = cachedUser.userId;
    }
    return headers;
  };

  // Fetch notification log from server
  const fetchNotifications = async () => {
    if (!isLoggedIn || !cachedUser) return;
    setIsLoading(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/notifications/`, {
        method: "GET",
        headers,
      });
      if (response.ok) {
        const data = await response.json();
        const list = data.notifications || [];
        setNotifications(list);
        setUnreadCount(list.filter((n: Notification) => !n.read).length);
      }
    } catch (error) {
      console.error("[NotificationContext] Error fetching notifications:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Mark notification as read
  const markAsRead = async (id: string) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/notifications/${id}/read`, {
        method: "PUT",
        headers,
      });
      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("[NotificationContext] Error marking read:", error);
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/notifications/read-all`, {
        method: "PUT",
        headers,
      });
      if (response.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error("[NotificationContext] Error marking all read:", error);
    }
  };

  // Request FCM Permission and Register token
  const setupFCM = async () => {
    if (!isMessagingSupported) {
      console.log("[FCM] Skipping setup since native Firebase Messaging is not supported/installed.");
      return;
    }
    try {
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        console.log("[FCM] Notification permission granted.");
        const fcmToken = await messaging().getToken();
        if (fcmToken) {
          console.log("[FCM] Obtained token:", fcmToken);
          // Register fcm_token with backend
          const headers = await getAuthHeaders();
          await fetch(`${API_BASE_URL}/notifications/register-token`, {
            method: "POST",
            headers,
            body: JSON.stringify({ fcm_token: fcmToken }),
          });
        }
      }
    } catch (error) {
      console.error("[FCM] Setup failed:", error);
    }
  };

  // Listen to foreground FCM messages
  useEffect(() => {
    if (!isLoggedIn || !isMessagingSupported) return;

    try {
      const unsubscribe = messaging().onMessage(async (remoteMessage) => {
        console.log("[FCM] Foreground message received:", remoteMessage);
        // Trigger a fetch to refresh notification log
        fetchNotifications();
        // Display alert if UI notification payload is present
        if (remoteMessage.notification) {
          Alert.alert(
            remoteMessage.notification.title || "Notification",
            remoteMessage.notification.body || ""
          );
        }
      });

      return unsubscribe;
    } catch (error) {
      console.error("[FCM] Error subscribing to FCM messages:", error);
    }
  }, [isLoggedIn]);

  // Handle WebSocket Connection
  useEffect(() => {
    if (!isLoggedIn || !cachedUser) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    let active = true;
    let reconnectTimeout: any;

    const connectWS = async () => {
      try {
        const authInstance = getAuth();
        const currentUser = authInstance.currentUser;
        if (!currentUser) return;
        const token = await getIdToken(currentUser).catch(() => null);
        if (!token) return;

        const wsUrl = `${WS_BASE_URL}/notifications/ws?token=${token}&user_id=${cachedUser.userId}`;
        console.log("[WebSocket] Connecting to:", wsUrl);
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log("[WebSocket] Connected successfully");
        };

        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (payload.event === "new_notification") {
              const newNotif = payload.data as Notification;
              setNotifications((prev) => {
                if (prev.some((n) => n.id === newNotif.id)) {
                  return prev;
                }
                setUnreadCount((count) => count + 1);
                return [newNotif, ...prev];
              });
              
              // Show in-app alert
              Alert.alert(newNotif.title, newNotif.message);
            }
          } catch (e) {
            console.error("[WebSocket] Message parsing error:", e);
          }
        };

        ws.onclose = (e) => {
          console.log("[WebSocket] Closed:", e.reason);
          if (active) {
            // Reconnect after 5 seconds
            reconnectTimeout = setTimeout(connectWS, 5000);
          }
        };

        ws.onerror = (err) => {
          console.error("[WebSocket] Error:", err);
        };

        wsRef.current = ws;
      } catch (err) {
        console.error("[WebSocket] Connection error:", err);
      }
    };

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === "active" && active) {
        console.log("[WebSocket] App returned to foreground. Reconnecting and refreshing...");
        fetchNotifications();
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          clearTimeout(reconnectTimeout);
          connectWS();
        }
      }
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);

    setupFCM();
    fetchNotifications();
    connectWS();

    return () => {
      active = false;
      subscription.remove();
      clearTimeout(reconnectTimeout);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [isLoggedIn, cachedUser]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isLoading,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
};
