import { v2 as cloudinary } from "cloudinary";
import { env, cloudinaryEnabled } from "../../config/env";

if (cloudinaryEnabled) {
  cloudinary.config({
    cloud_name: env.cloudinaryCloudName,
    api_key: env.cloudinaryApiKey,
    api_secret: env.cloudinaryApiSecret,
  });
}

/**
 * Uploads a base64 image string to Cloudinary.
 * If Cloudinary is not enabled (missing env variables), it falls back to mock mode
 * returning a mock URL so the system continues to work locally.
 */
export async function uploadImage(base64Data: string): Promise<string> {
  if (!cloudinaryEnabled) {
    console.log("☁️ [cloudinary:mock] Cloudinary credentials missing. Returning fallback mock URL.");
    // Return a beautiful unsplash mockup car care image as fallback
    return "https://images.unsplash.com/photo-1607860108855-64acf2078ed9?q=80&w=600&auto=format&fit=crop";
  }

  const result = await cloudinary.uploader.upload(base64Data, {
    folder: "nexclean",
  });
  return result.secure_url;
}
