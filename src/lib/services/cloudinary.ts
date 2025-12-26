import { v2 as cloudinary } from "cloudinary";
import type { UploadApiResponse } from "cloudinary";

/**
 * Result of Cloudinary upload
 */
export interface UploadResult {
  success: boolean;
  url: string | null;
  publicId: string | null;
  error?: string;
}

/**
 * Configures Cloudinary with credentials from environment
 */
function configureCloudinary(): boolean {
  const cloudName = getEnv("CLOUDINARY_CLOUD_NAME");
  const apiKey = getEnv("CLOUDINARY_API_KEY");
  const apiSecret = getEnv("CLOUDINARY_API_SECRET");

  if (!cloudName || !apiKey || !apiSecret) {
    return false;
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });

  return true;
}

/**
 * Uploads a screenshot buffer to Cloudinary
 * @param buffer - PNG image buffer
 * @param bookmarkId - Bookmark ID for file naming
 * @returns Upload result with URL or error
 */
export async function uploadScreenshot(
  buffer: Buffer,
  bookmarkId: string
): Promise<UploadResult> {
  if (!configureCloudinary()) {
    return {
      success: false,
      url: null,
      publicId: null,
      error: "Cloudinary credentials not configured",
    };
  }

  // Organize by year/month
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const folder = `screenshots/${year}/${month}`;

  return new Promise((resolve) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: bookmarkId,
        resource_type: "image",
        format: "png",
        overwrite: true,
      },
      (error, result: UploadApiResponse | undefined) => {
        if (error) {
          resolve({
            success: false,
            url: null,
            publicId: null,
            error: error.message,
          });
          return;
        }

        if (!result) {
          resolve({
            success: false,
            url: null,
            publicId: null,
            error: "No result returned from Cloudinary",
          });
          return;
        }

        resolve({
          success: true,
          url: result.secure_url,
          publicId: result.public_id,
        });
      }
    );

    uploadStream.end(buffer);
  });
}

/**
 * Gets environment variable from Netlify or Node.js context
 */
function getEnv(key: string): string | undefined {
  if (typeof Netlify !== "undefined" && Netlify?.env) {
    return Netlify.env.get(key);
  }
  return process.env[key];
}

