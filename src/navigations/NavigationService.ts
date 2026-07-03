import { createNavigationContainerRef } from "@react-navigation/native";

export const navigationRef = createNavigationContainerRef<any>();

export function navigate(name: string, params?: any) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  } else {
    console.log("[NavigationService] Navigation container is not ready yet.");
  }
}
