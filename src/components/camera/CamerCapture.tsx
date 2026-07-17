import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import ImageCropPicker from "react-native-image-crop-picker";
import { useCamera } from "../../hooks/useCamera";

interface CameraCaptureProps {
  /** Called every time a new photo is captured (or null when reset) */
  onCapture: (base64: string | null, uri: string | null) => void;
}

export default function CameraCapture({ onCapture }: CameraCaptureProps) {
  const { isCapturing, capturedUri, launchCamera, reset } = useCamera();
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [isCropping, setIsCropping] = useState(false);

  const handleTakePhoto = async () => {
    const result = await launchCamera();
    if (result.success) {
      setPreviewUri(result.uri);
      onCapture(result.base64, result.uri);
    }
  };

  const handleRetake = () => {
    reset();
    setPreviewUri(null);
    onCapture(null, null);
  };

  const handleCrop = async () => {
    const sourceUri = previewUri ?? capturedUri;
    if (!sourceUri) return;
    try {
      setIsCropping(true);
      const cropped = await ImageCropPicker.openCropper({
        path: sourceUri,
        includeBase64: true,
        cropperToolbarTitle: "Crop Photo",
        mediaType: "photo",
        compressImageQuality: 0.8,
      });
      if (cropped?.path && cropped?.data) {
        setPreviewUri(cropped.path);
        onCapture(cropped.data, cropped.path);
      }
    } catch (err: any) {
      if (err?.code !== "E_PICKER_CANCELLED") {
        Alert.alert(
          "Crop failed",
          err?.message ?? "Could not crop this photo. Please try again.",
        );
      }
    } finally {
      setIsCropping(false);
    }
  };

  // ── After capture: show thumbnail
  if (previewUri ?? capturedUri) {
    return (
      <View style={styles.previewWrapper}>
        <Image
          source={{ uri: previewUri ?? capturedUri ?? undefined }}
          style={styles.thumbnail}
          resizeMode="cover"
        />

        {/* Overlay badge */}
        <View style={styles.successBadge}>
          <MaterialCommunityIcons
            name="check-circle"
            size={15}
            color="#16A34A"
          />
          <Text style={styles.successBadgeText}>Photo ready to submit</Text>
        </View>

        {/* Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.retakeBtn]}
            onPress={handleRetake}
            activeOpacity={0.8}
            disabled={isCropping}
          >
            <MaterialCommunityIcons
              name="camera-retake-outline"
              size={14}
              color="#7C3AED"
            />
            <Text style={styles.retakeBtnText}>Retake</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.cropBtn]}
            onPress={handleCrop}
            activeOpacity={0.8}
            disabled={isCropping}
          >
            {isCropping ? (
              <ActivityIndicator size="small" color="#7C3AED" />
            ) : (
              <MaterialCommunityIcons name="crop" size={14} color="#7C3AED" />
            )}
            <Text style={styles.retakeBtnText}>
              {isCropping ? "Cropping…" : "Crop"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Before capture
  return (
    <TouchableOpacity
      style={[styles.launchBox, isCapturing && styles.launchBoxBusy]}
      onPress={handleTakePhoto}
      activeOpacity={0.75}
      disabled={isCapturing}
    >
      {isCapturing ? (
        <>
          <ActivityIndicator size="small" color="#7C3AED" />
          <Text style={styles.launchLabel}>Opening camera…</Text>
        </>
      ) : (
        <>
          <View style={styles.launchIconCircle}>
            <MaterialCommunityIcons
              name="camera-outline"
              size={28}
              color="#7C3AED"
            />
          </View>
          <Text style={styles.launchLabel}>Live Camera Snap</Text>
          <Text style={styles.launchSubLabel}>Tap to take a live photo</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Launch state
  launchBox: {
    borderWidth: 1.5,
    borderColor: "#C4B5FD",
    borderStyle: "dashed",
    borderRadius: 16,
    paddingVertical: 28,
    alignItems: "center",
    backgroundColor: "#FAFAFF",
    gap: 6,
  },
  launchBoxBusy: {
    opacity: 0.7,
  },
  launchIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: "#F5F3FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  launchLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#7C3AED",
  },
  launchSubLabel: {
    fontSize: 11,
    color: "#94A3B8",
  },

  // Preview state
  previewWrapper: {
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  thumbnail: {
    width: "100%",
    height: 180,
    backgroundColor: "#F1F5F9",
  },
  successBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  successBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#16A34A",
  },
  retakeBtn: {
    backgroundColor: "#F5F3FF",
  },
  cropBtn: {
    backgroundColor: "#EDE9FE",
    borderLeftWidth: 1,
    borderLeftColor: "#DDD6FE",
  },
  actionsRow: {
    flexDirection: "row",
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 10,
  },
  retakeBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#7C3AED",
  },
});
