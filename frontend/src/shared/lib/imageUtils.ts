const KYC_MAX_BYTES = 300 * 1024;

type DecodedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  close?: () => void;
};

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read the converted image"));
    reader.readAsDataURL(blob);
  });
}

function dataUriToBlob(dataUri: string): Blob {
  const [header, encoded = ""] = dataUri.split(",", 2);
  const mime = /^data:([^;]+);base64$/i.exec(header)?.[1] ?? "application/octet-stream";
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mime });
}

/**
 * Safari has shipped combinations where `canvas.toBlob(..., "image/webp")`
 * returns null/PNG while `toDataURL("image/webp")` works. Try both native
 * paths before deciding the encoder is unavailable.
 */
function canvasToBlob(canvas: HTMLCanvasElement, type: "image/webp" | "image/jpeg", quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const finishWithDataUri = () => {
      try {
        const dataUri = canvas.toDataURL(type, quality);
        if (!dataUri.startsWith(`data:${type};`)) {
          reject(new Error(`Native ${type} encoding is unavailable`));
          return;
        }
        resolve(dataUriToBlob(dataUri));
      } catch {
        reject(new Error(`Native ${type} encoding is unavailable`));
      }
    };

    if (typeof canvas.toBlob !== "function") {
      finishWithDataUri();
      return;
    }

    canvas.toBlob(
      (blob) => {
        if (blob?.type === type) resolve(blob);
        else finishWithDataUri();
      },
      type,
      quality,
    );
  });
}

async function canvasToPreferredImage(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  try {
    return await canvasToBlob(canvas, "image/webp", quality);
  } catch {
    // Older iOS WebViews cannot encode WebP. A size-limited JPEG still leaves
    // the device compressed, and the backend's Cloudinary upload forces WebP
    // as the stored format so this fallback does not consume PNG/JPEG storage.
    return canvasToBlob(canvas, "image/jpeg", Math.min(0.86, quality));
  }
}

function decodeWithImageElement(file: File): Promise<DecodedImage> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      if (!width || !height) {
        reject(new Error("This image has no readable dimensions"));
        return;
      }
      resolve({ source: image, width, height });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This image could not be opened"));
    };
    // iOS Safari applies the camera's EXIF orientation while decoding an
    // HTMLImageElement, making this a reliable fallback for portrait photos.
    image.src = url;
  });
}

async function decodeImage(file: File): Promise<DecodedImage> {
  if (!file.type.startsWith("image/")) throw new Error("Choose a photo from your camera or library");

  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close?.() };
    } catch {
      // Some iOS versions expose createImageBitmap but reject the orientation
      // option. Retrying without it is still preferable to failing the upload.
      try {
        const bitmap = await createImageBitmap(file);
        return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close?.() };
      } catch {
        // Fall through to HTMLImageElement, which also handles iPhone camera
        // images that Safari itself can display (including HEIC on iOS).
      }
    }
  }

  try {
    return await decodeWithImageElement(file);
  } catch {
    throw new Error("This photo could not be opened. Try taking it again or choose another image.");
  }
}

/**
 * Compress a selected image before it leaves the device.
 *
 * WebP is preferred. On iOS builds without a native WebP canvas encoder we
 * automatically use a compressed JPEG payload; Cloudinary's upload contract
 * converts that payload to WebP before the stored asset is created.
 */
export async function fileToCompressedDataUri(
  file: File,
  maxDim = 1280,
  quality = 0.78,
  maxBytes = KYC_MAX_BYTES,
): Promise<string> {
  const decoded = await decodeImage(file);
  try {
    let scale = Math.min(1, maxDim / Math.max(decoded.width, decoded.height));
    let lastBlob: Blob | null = null;

    for (let pass = 0; pass < 10; pass += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(decoded.width * scale));
      canvas.height = Math.max(1, Math.round(decoded.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Image conversion is unavailable on this device");
      ctx.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);

      const passQuality = Math.max(0.42, quality - (pass % 4) * 0.1);
      lastBlob = await canvasToPreferredImage(canvas, passQuality);
      if (lastBlob.size <= maxBytes) return blobToDataUri(lastBlob);
      if (pass % 4 === 3) scale *= 0.8;
    }

    if (!lastBlob || lastBlob.size > maxBytes) {
      throw new Error("The optimized photo is still too large. Move closer to the document and try again.");
    }
    return blobToDataUri(lastBlob);
  } finally {
    decoded.close?.();
  }
}

/** Convert general UI artwork to WebP; unlike KYC, callers require WebP output. */
export async function convertToWebP(file: File, quality = 0.85): Promise<string> {
  const decoded = await decodeImage(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = decoded.width;
    canvas.height = decoded.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Image conversion is unavailable on this device");
    ctx.drawImage(decoded.source, 0, 0);
    try {
      return blobToDataUri(await canvasToBlob(canvas, "image/webp", quality));
    } catch {
      throw new Error("WebP conversion is unavailable in this browser. Try a newer browser or another device.");
    }
  } finally {
    decoded.close?.();
  }
}
