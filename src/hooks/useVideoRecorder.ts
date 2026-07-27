import { useCallback, useState } from "react";
import { CustomVideoRecorderResult } from "../components/camera/CustomVideoRecorder";

export type VideoResult =
  | { success: true; uri: string; mimeType: string }
  | {
      success: false;
      reason: "cancelled" | "permission_denied" | "error";
      error?: string;
    };

interface UseVideoRecorderReturn {
  isCameraOpen: boolean;
  capturedUri: string | null;
  capturedMimeType: string | null;
  openCamera: () => void;
  closeCamera: () => void;
  handleRecorded: (result: CustomVideoRecorderResult) => void;
  reset: () => void;
}

export function useVideoRecorder(): UseVideoRecorderReturn {
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [capturedMimeType, setCapturedMimeType] = useState<string | null>(null);

  const openCamera = useCallback(() => {
    setIsCameraOpen(true);
  }, []);

  const closeCamera = useCallback(() => {
    setIsCameraOpen(false);
  }, []);

  const handleRecorded = useCallback((result: CustomVideoRecorderResult) => {
    setCapturedUri(result.uri);
    setCapturedMimeType(result.mimeType);
    setIsCameraOpen(false);
  }, []);

  const reset = useCallback(() => {
    setCapturedUri(null);
    setCapturedMimeType(null);
  }, []);

  return {
    isCameraOpen,
    capturedUri,
    capturedMimeType,
    openCamera,
    closeCamera,
    handleRecorded,
    reset,
  };
}
