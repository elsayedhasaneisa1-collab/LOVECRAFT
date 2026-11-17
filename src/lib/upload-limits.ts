// Leave room for multipart boundaries under the Vercel Functions 4.5 MB request limit.
export const MAX_SITE_IMAGE_BYTES = 4 * 1024 * 1024;
export const MAX_SITE_UPLOAD_REQUEST_BYTES = MAX_SITE_IMAGE_BYTES + 96 * 1024;
export const MAX_DRAFT_PHOTOS = 8;
