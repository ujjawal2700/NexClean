/**
 * Converts an image file (PNG, JPG, JPEG, WebP, etc.) into WebP base64 data URL
 * using HTML5 Canvas client-side.
 */
export function convertToWebP(file: File, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get 2d canvas context"));
          return;
        }
        ctx.drawImage(img, 0, 0);
        const webpDataUrl = canvas.toDataURL("image/webp", quality);
        resolve(webpDataUrl);
      };
      img.onerror = (err) => reject(new Error("Failed to load image for WebP conversion: " + String(err)));
      img.src = e.target?.result as string;
    };
    reader.onerror = (err) => reject(new Error("Failed to read image file: " + String(err)));
    reader.readAsDataURL(file);
  });
}

/** Read a file as-is into a base64 data URL. */
export function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Phone camera photos are often 3-8MB; base64-inflated that can blow past the
 * upload limit and crawl on mobile data. Downscale + re-encode as JPEG first.
 * Falls back to the raw file if the canvas pipeline isn't available.
 */
export async function fileToCompressedDataUri(file: File, maxDim = 1600, quality = 0.8): Promise<string> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.drawImage(bitmap, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return fileToDataUri(file);
  }
}
