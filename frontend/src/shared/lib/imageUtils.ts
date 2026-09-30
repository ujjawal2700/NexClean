const KYC_MAX_BYTES = 300 * 1024;

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read the converted image"));
    reader.readAsDataURL(blob);
  });
}

function canvasToWebP(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        // Some browsers silently fall back to PNG if an encoder is missing.
        // Never let that bypass the WebP-only upload contract.
        if (!blob || blob.type !== "image/webp") {
          reject(new Error("This browser cannot convert photos to WebP. Please update it and try again."));
          return;
        }
        resolve(blob);
      },
      "image/webp",
      quality,
    );
  });
}

async function decodeImage(file: File): Promise<ImageBitmap> {
  if (!file.type.startsWith("image/")) throw new Error("Choose a JPG, PNG, or WebP image");
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("This image could not be opened. Choose a JPG, PNG, or WebP image.");
  }
}

/**
 * Convert a selected image to WebP before it leaves the device.
 *
 * KYC photos use an adaptive 300 KiB binary budget. Two base64 data URIs then
 * remain below roughly 850 KiB as JSON, avoiding nginx's common 1 MiB request
 * limit while retaining enough resolution for document review.
 */
export async function fileToCompressedDataUri(
  file: File,
  maxDim = 1280,
  quality = 0.78,
  maxBytes = KYC_MAX_BYTES,
): Promise<string> {
  const bitmap = await decodeImage(file);
  try {
    let scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    let lastBlob: Blob | null = null;

    for (let pass = 0; pass < 10; pass += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Image conversion is unavailable on this device");
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      const passQuality = Math.max(0.46, quality - (pass % 4) * 0.1);
      lastBlob = await canvasToWebP(canvas, passQuality);
      if (lastBlob.size <= maxBytes) return blobToDataUri(lastBlob);
      if (pass % 4 === 3) scale *= 0.8;
    }

    if (!lastBlob || lastBlob.size > maxBytes) {
      throw new Error("The converted image is still too large. Crop it closer to the document and try again.");
    }
    return blobToDataUri(lastBlob);
  } finally {
    bitmap.close?.();
  }
}

/** Convert general UI artwork to WebP without the stricter KYC size budget. */
export async function convertToWebP(file: File, quality = 0.85): Promise<string> {
  const bitmap = await decodeImage(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Image conversion is unavailable on this device");
    ctx.drawImage(bitmap, 0, 0);
    return blobToDataUri(await canvasToWebP(canvas, quality));
  } finally {
    bitmap.close?.();
  }
}
