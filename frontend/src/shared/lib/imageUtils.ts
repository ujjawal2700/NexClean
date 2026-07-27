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
