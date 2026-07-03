import { useState, useCallback } from "react";
import * as ImagePicker from "expo-image-picker";
import { Alert, Platform } from "react-native";

export type CameraResult =
  | { success: true; base64: string; uri: string; mimeType: string }
  | {
      success: false;
      reason: "cancelled" | "permission_denied" | "error";
      error?: string;
    };

interface UseCameraReturn {
  isCapturing: boolean;
  capturedBase64: string | null;
  capturedUri: string | null;
  launchCamera: () => Promise<CameraResult>;
  reset: () => void;
}

export function useCamera(): UseCameraReturn {
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedBase64, setCapturedBase64] = useState<string | null>(null);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);

  const requestPermission = async (): Promise<boolean> => {
    // On web or simulator camera might not exist skip gracefully
    if (Platform.OS === "web") return false;

    const { status, canAskAgain } =
      await ImagePicker.requestCameraPermissionsAsync();

    if (status === "granted") return true;

    if (!canAskAgain) {
      Alert.alert(
        "Camera permission needed",
        "Please enable camera access in your device Settings to take photos.",
        [{ text: "OK" }],
      );
    } else {
      Alert.alert(
        "Camera access denied",
        "Camera permission is required to take photos for task submission.",
        [{ text: "OK" }],
      );
    }
    return false;
  };

  const launchCamera = useCallback(async (): Promise<CameraResult> => {
    setIsCapturing(true);
    try {
      const granted = await requestPermission();
      if (!granted) {
        return { success: false, reason: "permission_denied" };
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, // lets user crop/rotate before confirming
        quality: 0.7, // balance quality vs upload size
        base64: true, // need base64 for the API
        exif: false, // not needed to save memory
      });

      if (result.canceled) {
        return { success: false, reason: "cancelled" };
      }

      const asset = result.assets[0];
      if (!asset.base64) {
        return {
          success: false,
          reason: "error",
          error: "Base64 data missing from captured image.",
        };
      }

      // Derive MIME type (defaults to jpeg)
      const ext = asset.uri.split(".").pop()?.toLowerCase() ?? "jpg";
      const mimeType = ext === "png" ? "image/png" : "image/jpeg";

      setCapturedBase64(asset.base64);
      setCapturedUri(asset.uri);

      return {
        success: true,
        base64: asset.base64, // raw base64
        uri: asset.uri,
        mimeType,
      };
    } catch (err: any) {
      const message = err?.message ?? "Unknown camera error";
      Alert.alert("Camera error", message);
      return { success: false, reason: "error", error: message };
    } finally {
      setIsCapturing(false);
    }
  }, []);

  const reset = useCallback(() => {
    setCapturedBase64(null);
    setCapturedUri(null);
  }, []);

  return { isCapturing, capturedBase64, capturedUri, launchCamera, reset };
}
