// Backwards-compatible route name. Uploads are handled by Vercel Blob, not Catbox.
export { POST } from "../photo/route";
export const runtime = "nodejs";
export const maxDuration = 30;
