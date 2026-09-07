import * as FileSystem from "expo-file-system";
import { UploadType } from "expo-file-system";
import { logger } from "../utils/UnifiedLogger";
import { getPresignedUploadUrlApi } from "../api/users/Request";

// ── File Size Limits (Matching Backend Strict Security Policy) ────────
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_AUDIO_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
export const MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1).replace(".0", "")} MB`;
  }
  if (bytes >= 1024) {
    const kb = bytes / 1024;
    return `${kb.toFixed(1).replace(".0", "")} KB`;
  }
  return `${bytes} Bytes`;
}

export function getCategoryLimits(mimeType: string): {
  category: "Image" | "Audio" | "Video" | "File";
  maxBytes: number;
  maxHuman: string;
} {
  const mime = (mimeType || "").toLowerCase();
  if (mime.startsWith("image/")) {
    return {
      category: "Image",
      maxBytes: MAX_IMAGE_SIZE_BYTES,
      maxHuman: "5 MB",
    };
  }
  if (mime.startsWith("audio/")) {
    return {
      category: "Audio",
      maxBytes: MAX_AUDIO_SIZE_BYTES,
      maxHuman: "25 MB",
    };
  }
  if (mime.startsWith("video/")) {
    return {
      category: "Video",
      maxBytes: MAX_VIDEO_SIZE_BYTES,
      maxHuman: "50 MB",
    };
  }
  return {
    category: "File",
    maxBytes: MAX_IMAGE_SIZE_BYTES,
    maxHuman: "5 MB",
  };
}

export interface UploadMediaOptions {
  fileName?: string;
  userId?: string;
}

/**
 * Uploads a local device media file (image, video, or audio) to cloud storage
 * via a pre-signed PUT upload URL with client-side and server-side size validation.
 *
 * @param fileUri Local file URI (e.g. file:///data/... or file:///var/mobile/...)
 * @param mimeType MIME type of the file (e.g. image/jpeg, video/mp4, audio/m4a)
 * @param options Additional options (fileName, userId)
 * @returns The permanent cloud public URL
 */
export async function uploadMediaToStorage(
  fileUri: string | null | undefined,
  mimeType: string,
  options?: UploadMediaOptions,
): Promise<string> {
  if (!fileUri) return "";

  const trimmedUri = fileUri.trim();

  // If already a remote URL, no upload needed
  if (trimmedUri.startsWith("http://") || trimmedUri.startsWith("https://")) {
    return trimmedUri;
  }

  // Inspect local file metadata (size, existence)
  const fileInfo = await FileSystem.getInfoAsync(trimmedUri);
  if (!fileInfo.exists) {
    throw new Error(`Media file could not be found on device: ${trimmedUri}`);
  }

  const fileSize = fileInfo.size ?? 0;
  const limit = getCategoryLimits(mimeType);

  // Client-side pre-validation: immediately alert user with exact file details
  if (fileSize > limit.maxBytes) {
    throw new Error(
      `${limit.category} size (${formatFileSize(fileSize)}) exceeds the ${limit.maxHuman} limit. Please choose or record a smaller file.`,
    );
  }

  // Determine a clean file name
  let cleanFileName = options?.fileName;
  if (!cleanFileName) {
    const uriParts = trimmedUri.split("/");
    const lastPart = uriParts[uriParts.length - 1];
    cleanFileName = lastPart && lastPart.includes(".") ? lastPart : `upload_${Date.now()}`;
  }

  logger.info("[StorageUpload] Requesting pre-signed URL for:", {
    fileName: cleanFileName,
    mimeType,
    fileSize,
  });

  // Request pre-signed upload URL from backend
  const presigned = await getPresignedUploadUrlApi(
    cleanFileName,
    mimeType,
    fileSize,
    options?.userId,
  );

  if (!presigned?.upload_url) {
    throw new Error("Server failed to generate a pre-signed upload URL.");
  }

  logger.info("[StorageUpload] Uploading binary to cloud storage via PUT...");

  // Stream upload binary file to pre-signed URL
  const uploadResponse = await FileSystem.uploadAsync(
    presigned.upload_url,
    trimmedUri,
    {
      httpMethod: "PUT",
      uploadType: UploadType.BINARY_CONTENT as any,
      headers: {
        "Content-Type": mimeType,
      },
    },
  );

  if (uploadResponse.status < 200 || uploadResponse.status >= 300) {
    logger.error("[StorageUpload] Upload failed with HTTP status:", uploadResponse.status, uploadResponse.body);
    throw new Error(
      `Cloud storage upload failed (${uploadResponse.status}). Please try again.`,
    );
  }

  logger.info("[StorageUpload] Upload succeeded. Public URL:", presigned.file_url);
  return presigned.file_url;
}
