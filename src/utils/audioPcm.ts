const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/**
 * Encodes a Uint8Array into a standard Base64 string without stack overflow issues.
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let result = "";
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b1 = bytes[i];
    const b2 = i + 1 < len ? bytes[i + 1] : 0;
    const b3 = i + 2 < len ? bytes[i + 2] : 0;
    const triplet = (b1 << 16) | (b2 << 8) | b3;
    result += BASE64_CHARS[(triplet >> 18) & 63];
    result += BASE64_CHARS[(triplet >> 12) & 63];
    result += i + 1 < len ? BASE64_CHARS[(triplet >> 6) & 63] : "=";
    result += i + 2 < len ? BASE64_CHARS[triplet & 63] : "=";
  }
  return result;
}

/**
 * Decodes a Base64 string into a Uint8Array.
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, "");
  const len = clean.length;
  const byteLen = Math.floor((len * 3) / 4);
  const bytes = new Uint8Array(byteLen);
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const c1 = BASE64_CHARS.indexOf(clean[i]);
    const c2 = BASE64_CHARS.indexOf(clean[i + 1]);
    const c3 = i + 2 < len ? BASE64_CHARS.indexOf(clean[i + 2]) : 64;
    const c4 = i + 3 < len ? BASE64_CHARS.indexOf(clean[i + 3]) : 64;

    const triplet = (c1 << 18) | (c2 << 12) | ((c3 & 63) << 6) | (c4 & 63);
    if (p < byteLen) bytes[p++] = (triplet >> 16) & 255;
    if (c3 !== 64 && p < byteLen) bytes[p++] = (triplet >> 8) & 255;
    if (c4 !== 64 && p < byteLen) bytes[p++] = triplet & 255;
  }
  return bytes.subarray(0, p);
}

/**
 * Converts accumulated PCM16 audio chunks into a playable WAV file formatted as Base64.
 * Standard format for OpenAI Realtime output is 24000Hz, 1 channel (mono), 16-bit PCM.
 */
export function pcm16ChunksToWavBase64(
  chunksBase64: string[],
  sampleRate = 24000,
  numChannels = 1
): string {
  // 1. Decode each chunk
  const decodedChunks: Uint8Array[] = [];
  let totalDataLen = 0;
  for (const chunk of chunksBase64) {
    if (!chunk) continue;
    const arr = base64ToUint8Array(chunk);
    decodedChunks.push(arr);
    totalDataLen += arr.length;
  }

  if (totalDataLen === 0) return "";

  // 2. Build 44-byte WAV header + combined PCM data
  const byteRate = sampleRate * numChannels * 2;
  const blockAlign = numChannels * 2;
  const totalFileSize = 44 + totalDataLen;
  const outBytes = new Uint8Array(totalFileSize);
  const view = new DataView(outBytes.buffer);

  // "RIFF"
  view.setUint32(0, 0x52494646, false);
  view.setUint32(4, 36 + totalDataLen, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"

  // "fmt "
  view.setUint32(12, 0x666d7420, false);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // 16 bits per sample

  // "data"
  view.setUint32(36, 0x64617461, false);
  view.setUint32(40, totalDataLen, true);

  // Copy audio data
  let offset = 44;
  for (const chunk of decodedChunks) {
    outBytes.set(chunk, offset);
    offset += chunk.length;
  }

  return uint8ArrayToBase64(outBytes);
}
