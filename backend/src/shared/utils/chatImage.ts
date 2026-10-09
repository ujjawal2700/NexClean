import { ApiError } from "./ApiError";
import { uploadImage } from "./cloudinary";

/** Only accept an inline, optimized image: never fetch a caller-provided URL. */
export async function storeChatImage(image: unknown, folder: string): Promise<string | undefined> {
  if (image === undefined || image === null) return undefined;
  if (typeof image !== "string") throw ApiError.badRequest("Choose a photo to upload");
  const match = /^data:image\/(webp|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(image);
  if (!match || match[2].length > 1400000) throw ApiError.badRequest("Choose a photo smaller than 1 MB after upload preparation");
  const bytes = Buffer.from(match[2], "base64");
  const valid = match[1] === "webp"
    ? bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP"
    : bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (!valid || bytes.length > 1024 * 1024) throw ApiError.badRequest("This photo could not be opened. Choose another image.");
  try {
    // Cloudinary stores WebP even on older devices whose encoder falls back to JPEG.
    return await uploadImage(image, { folder });
  } catch {
    throw ApiError.badRequest("Photo upload failed. Please try again.");
  }
}

export function chatText(value: unknown): string {
  if (value !== undefined && typeof value !== "string") throw ApiError.badRequest("Message text must be a string");
  const text = (value as string | undefined)?.trim() ?? "";
  if (text.length > 4000) throw ApiError.badRequest("Message must be 4000 characters or fewer");
  return text;
}
