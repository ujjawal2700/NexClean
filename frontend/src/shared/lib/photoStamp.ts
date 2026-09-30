import { reverseGeocode } from "./geocode";
import type { LatLng } from "./maps";

/**
 * Geotag stamp burned into the job's before/after photos.
 *
 * The stamp lives in the pixels, not in EXIF or a database field, because the
 * photo is the proof: it is what the customer sees, what an admin opens during
 * a dispute, and what survives being forwarded on WhatsApp. EXIF would be
 * stripped by the canvas re-encode anyway, and a separate field can drift from
 * the picture it describes.
 */

export type PhotoStamp = {
  coords: LatLng;
  /** GPS accuracy radius in metres, when known. */
  accuracy: number | null;
  /** Human-readable address; null when reverse geocoding was unavailable. */
  address: string | null;
  /** When the photo was taken (device clock). */
  takenAt: Date;
  /** Short tag drawn in the corner, e.g. "BEFORE WASH". */
  label: string;
};

/**
 * Reverse-geocode with a ceiling. The stamp is still valid with coordinates
 * alone, so a slow or failed Maps call must never hold up the upload.
 */
export async function addressFor(coords: LatLng, timeoutMs = 4000): Promise<string | null> {
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
  const lookup = reverseGeocode(coords)
    .then((a) => a?.formatted || null)
    .catch(() => null);
  return Promise.race([lookup, timeout]);
}

function formatStampTime(d: Date): string {
  const date = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });
  return `${date}, ${time}`;
}

/** Greedy word wrap, capped at `maxLines` with an ellipsis on the last line. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !line) {
      line = next;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;

  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
  kept[maxLines - 1] = `${last}…`;
  return kept;
}

/**
 * Downscale the photo (same budget as `fileToCompressedDataUri`), draw the
 * geotag panel along the bottom, and return a JPEG data URI.
 */
export async function stampPhoto(
  file: File,
  stamp: PhotoStamp,
  maxDim = 1400,
  quality = 0.8,
): Promise<string> {
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
  bitmap.close?.();

  // Size text off the shorter edge so portrait and landscape shots get the
  // same legibility.
  const unit = Math.max(12, Math.round(Math.min(width, height) * 0.032));
  const pad = Math.round(unit * 0.8);
  const lineGap = Math.round(unit * 0.35);
  const font = (weight: number, size: number) =>
    `${weight} ${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;

  const { lat, lng } = stamp.coords;
  const coordLine =
    `Lat ${lat.toFixed(6)}°  Long ${lng.toFixed(6)}°` +
    (stamp.accuracy != null ? `  ±${Math.round(stamp.accuracy)}m` : "");
  const timeLine = formatStampTime(stamp.takenAt);

  ctx.font = font(600, unit);
  const addressLines = stamp.address ? wrap(ctx, stamp.address, width - pad * 2, 2) : [];

  const lines: { text: string; weight: number; size: number }[] = [
    ...addressLines.map((text) => ({ text, weight: 600, size: unit })),
    { text: coordLine, weight: 500, size: Math.round(unit * 0.85) },
    { text: timeLine, weight: 500, size: Math.round(unit * 0.85) },
  ];
  const panelHeight =
    pad * 2 + lines.reduce((sum, l) => sum + l.size, 0) + lineGap * (lines.length - 1);

  // Bottom panel: dark enough for white text over a bright car body.
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(0, height - panelHeight, width, panelHeight);

  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "top";
  ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
  ctx.shadowBlur = 2;
  let y = height - panelHeight + pad;
  for (const l of lines) {
    ctx.font = font(l.weight, l.size);
    ctx.fillText(l.text, pad, y);
    y += l.size + lineGap;
  }

  // Corner tag so a before shot can't be mistaken for an after shot.
  ctx.shadowBlur = 0;
  const tagSize = Math.round(unit * 0.8);
  ctx.font = font(700, tagSize);
  const tagPadX = Math.round(tagSize * 0.6);
  const tagPadY = Math.round(tagSize * 0.35);
  const tagWidth = ctx.measureText(stamp.label).width + tagPadX * 2;
  const tagHeight = tagSize + tagPadY * 2;
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(pad, pad, tagWidth, tagHeight);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(stamp.label, pad + tagPadX, pad + tagPadY);

  return canvas.toDataURL("image/jpeg", quality);
}
