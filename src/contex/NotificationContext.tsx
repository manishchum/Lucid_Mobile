import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { Alert, AppState, AppStateStatus, Animated, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import messaging from "@react-native-firebase/messaging";
import { getAuth, getIdToken } from "@react-native-firebase/auth";
import { useAuth } from "./AuthContext";
import { eventBus } from "../utils/EventBus";
import { navigate } from "../navigations/NavigationService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STACK_ROUTES } from "../navigations/Routes";

let isMessagingSupported = false;
try {
  if (messaging) {
    messaging();
    isMessagingSupported = true;
  }
} catch (error) {
  console.log(
    "[NotificationContext] Firebase Messaging is not installed natively on this project. Falling back to WebSocket-only notifications.",
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
  handleSprintNotificationClick: (sprintId: string, assignmentTitle?: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

const EXPO_API_URL =
  process.env.EXPO_PUBLIC_API_URL || "https://api.workfloww.ai";
const API_BASE_URL = `${EXPO_API_URL}/api`;
const WS_BASE_URL = EXPO_API_URL.replace(/^http/, "ws") + "/api";

export const NotificationProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { isLoggedIn, cachedUser } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{ title: string; message: string; onPress?: () => void } | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const showToast = useCallback((title: string, message: string, onPress?: () => void) => {
    setToast({ title, message, onPress });
  }, []);

  const handleSprintNotificationClick = useCallback(async (sprintId?: string, assignmentTitle?: string) => {
    navigate("Notifications");
  }, []);

  // Blocking notifications for Release Phase 2 release 2
  const NOTIFICATIONS_LIVE_ENABLED = true; // Toggle to true once push implemented from Firebase

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
      console.error(
        "[NotificationContext] Error fetching notifications:",
        error,
      );
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
          prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
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
      console.log(
        "[FCM] Skipping setup since native Firebase Messaging is not supported/installed.",
      );
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
    if (!isLoggedIn || !isMessagingSupported || !NOTIFICATIONS_LIVE_ENABLED)
      return;

    try {
      const unsubscribe = messaging().onMessage(async (remoteMessage: any) => {
        console.log("[FCM] Foreground message received:", remoteMessage);
        // Trigger a fetch to refresh notification log
        fetchNotifications();

        // Emit events on EventBus for real-time foreground updates
        const pushType = remoteMessage.data?.type || "";
        if (pushType === "dashboard" || pushType === "sprint") {
          eventBus.emit("refresh_dashboard");
        } else if (pushType === "categories") {
          eventBus.emit("refresh_categories");
        } else if (pushType === "items") {
          eventBus.emit("refresh_items");
        } else {
          // Fallback: refresh all contexts to guarantee consistency
          eventBus.emit("refresh_dashboard");
          eventBus.emit("refresh_categories");
          eventBus.emit("refresh_items");
        }

        // Display toast if UI notification payload is present
        if (remoteMessage.notification) {
          showToast(
            remoteMessage.notification.title || "Notification",
            remoteMessage.notification.body || "",
            () => {
              const val = remoteMessage.data?.id || remoteMessage.data?.learning_plan_id || remoteMessage.data?.module_id;
              if (val) {
                handleSprintNotificationClick(String(val));
              }
            }
          );
        }
      });

      return unsubscribe;
    } catch (error) {
      console.error("[FCM] Error subscribing to FCM messages:", error);
    }
  }, [isLoggedIn]);
 
  // Listen to background and quit-state FCM notification clicks
  useEffect(() => {
    if (!isLoggedIn || !isMessagingSupported || !NOTIFICATIONS_LIVE_ENABLED)
      return;

    try {
      // 1. Handle when app is in background state and notification is clicked
      const unsubscribeOnNotificationOpened = messaging().onNotificationOpenedApp((remoteMessage: any) => {
        console.log("[FCM] Notification caused app to open from background state:", remoteMessage);
        const val = remoteMessage.data?.id || remoteMessage.data?.learning_plan_id || remoteMessage.data?.module_id;
        const titleVal = remoteMessage.data?.assignment_title;
        if (val || titleVal) {
          handleSprintNotificationClick(String(val || ""), String(titleVal || ""));
        } else {
          navigate("Notifications");
        }
      });

      // 2. Handle when app is in closed (quit) state and notification is clicked
      messaging()
        .getInitialNotification()
        .then((remoteMessage: any) => {
          if (remoteMessage) {
            console.log("[FCM] Notification caused app to open from quit state:", remoteMessage);
            const val = remoteMessage.data?.id || remoteMessage.data?.learning_plan_id || remoteMessage.data?.module_id;
            const titleVal = remoteMessage.data?.assignment_title;
            if (val || titleVal) {
              setTimeout(() => {
                handleSprintNotificationClick(String(val || ""), String(titleVal || ""));
              }, 800);
            } else {
              setTimeout(() => {
                navigate("Notifications");
              }, 500);
            }
          }
        })
        .catch((error: any) => {
          console.error("[FCM] getInitialNotification error:", error);
        });

      return () => {
        unsubscribeOnNotificationOpened();
      };
    } catch (error) {
      console.error("[FCM] Error setting up click listeners:", error);
    }
  }, [isLoggedIn]);

  // Handle WebSocket Connection
  useEffect(() => {
    if (!isLoggedIn || !cachedUser || !NOTIFICATIONS_LIVE_ENABLED) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    let active = true;
    let reconnectTimeout: any;
    const isForeground = { current: AppState.currentState === "active" };

    const connectWS = async () => {
      try {
        const authInstance = getAuth();
        const currentUser = authInstance.currentUser;
        if (!currentUser) return;
        const token = await getIdToken(currentUser).catch(() => null);
        if (!token) return;

        const wsUrl = `${WS_BASE_URL}/notifications/ws?token=${token}&user_id=${cachedUser.userId}`;
        console.log("[WebSocket] Connecting to WS server for user:", cachedUser.userId);
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log("[WebSocket] Connected successfully");
        };

        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (payload.event === "refresh_data") {
              const refreshType = payload.data?.type || payload.type || "";
              if (refreshType === "dashboard" || refreshType === "sprint") {
                eventBus.emit("refresh_dashboard");
              } else if (refreshType === "categories") {
                eventBus.emit("refresh_categories");
              } else if (refreshType === "items") {
                eventBus.emit("refresh_items");
              } else {
                eventBus.emit("refresh_dashboard");
                eventBus.emit("refresh_categories");
                eventBus.emit("refresh_items");
              }
            } else if (payload.event === "new_notification") {
              const newNotif = payload.data as Notification;
              setNotifications((prev) => {
                if (prev.some((n) => n.id === newNotif.id)) {
                  return prev;
                }
                setUnreadCount((count) => count + 1);
                return [newNotif, ...prev];
              });

              // Trigger updates on receiving new notification
              const notifType = newNotif.type || "";
              if (notifType === "new_sprint" || notifType === "sprint_assigned") {
                eventBus.emit("refresh_dashboard");
              } else if (notifType === "new_content" || notifType === "library_update") {
                eventBus.emit("refresh_categories");
                eventBus.emit("refresh_items");
              } else {
                eventBus.emit("refresh_dashboard");
                eventBus.emit("refresh_categories");
                eventBus.emit("refresh_items");
              }

              // Show in-app toast
              showToast(
                newNotif.title,
                newNotif.message,
                () => {
                  const val = newNotif.metadata?.sprint_id || newNotif.metadata?.learning_plan_id || newNotif.metadata?.id || newNotif.metadata?.module_id;
                  const titleVal = newNotif.metadata?.assignment_title;
                  let metadataObj = newNotif.metadata;
                  if (typeof metadataObj === "string") {
                    try {
                      metadataObj = JSON.parse(metadataObj);
                    } catch {}
                  }
                  const resolvedVal = val || metadataObj?.sprint_id || metadataObj?.learning_plan_id || metadataObj?.id || metadataObj?.module_id;
                  const resolvedTitle = titleVal || metadataObj?.assignment_title;

                  if (resolvedVal || resolvedTitle) {
                    handleSprintNotificationClick(String(resolvedVal || ""), String(resolvedTitle || ""));
                  }
                }
              );
            }
          } catch (e) {
            console.error("[WebSocket] Message parsing error:", e);
          }
        };

        ws.onclose = (e) => {
          console.log("[WebSocket] Closed:", e.reason);
          if (active && isForeground.current) {
            // Reconnect after 5 seconds
            reconnectTimeout = setTimeout(connectWS, 5000);
          }
        };

        ws.onerror = (err) => {
          console.log("[WebSocket] Error (handled safely):", err);
        };

        wsRef.current = ws;
      } catch (err) {
        console.error("[WebSocket] Connection error:", err);
      }
    };

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === "active" && active) {
        isForeground.current = true;
        console.log(
          "[WebSocket] App returned to foreground. Reconnecting and refreshing...",
        );
        fetchNotifications();
        
        // Broadcast EventBus refresh signals to update screen hooks on app resume
        eventBus.emit("refresh_dashboard");
        eventBus.emit("refresh_categories");
        eventBus.emit("refresh_items");

        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          clearTimeout(reconnectTimeout);
          connectWS();
        }
      } else if ((nextAppState === "background" || nextAppState === "inactive") && active) {
        isForeground.current = false;
        console.log("[WebSocket] App going to background. Closing connection to save battery.");
        clearTimeout(reconnectTimeout);
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

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
        handleSprintNotificationClick,
      }}
    >
      {children}
      {toast && (
        <Toast
          title={toast.title}
          message={toast.message}
          onPress={toast.onPress}
          onDismiss={() => setToast(null)}
        />
      )}
    </NotificationContext.Provider>
  );
};

interface ToastProps {
  title: string;
  message: string;
  onDismiss: () => void;
  onPress?: () => void;
}

const Toast = ({ title, message, onDismiss, onPress }: ToastProps) => {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(-150)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const dismissTimer = useRef<any>(null);

  const dismissToast = useCallback(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -150,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  }, [onDismiss, slideAnim, opacityAnim]);

  const handlePress = useCallback(() => {
    if (onPress) {
      onPress();
    }
    dismissToast();
  }, [onPress, dismissToast]);

  useEffect(() => {
    // Slide in
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto dismiss after 4 seconds
    dismissTimer.current = setTimeout(() => {
      dismissToast();
    }, 4000);

    return () => {
      if (dismissTimer.current) {
        clearTimeout(dismissTimer.current);
      }
    };
  }, [slideAnim, opacityAnim, dismissToast]);

  return (
    <Animated.View
      style={[
        toastStyles.toastContainer,
        {
          top: insets.top + 12,
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <View style={toastStyles.toastContent}>
        <TouchableOpacity
          style={toastStyles.toastMainTouchable}
          onPress={handlePress}
          activeOpacity={0.85}
          disabled={!onPress}
        >
          <View style={toastStyles.iconWrapper}>
            <MaterialCommunityIcons name="bell-ring" size={22} color="#2563eb" />
          </View>
          <View style={toastStyles.textWrapper}>
            <Text style={toastStyles.toastTitle} numberOfLines={1}>
              {title}
            </Text>
            <Text style={toastStyles.toastMessage} numberOfLines={2}>
              {message}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={toastStyles.closeButton} onPress={dismissToast}>
          <MaterialCommunityIcons name="close" size={18} color="#64748b" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const toastStyles = StyleSheet.create({
  toastContainer: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 99999,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  toastContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  toastMainTouchable: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#eff6ff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  textWrapper: {
    flex: 1,
    marginRight: 8,
  },
  toastTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 2,
  },
  toastMessage: {
    fontSize: 12,
    color: "#475569",
    lineHeight: 16,
  },
  closeButton: {
    padding: 4,
  },
});

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotifications must be used within a NotificationProvider",
    );
  }
  return context;
};
