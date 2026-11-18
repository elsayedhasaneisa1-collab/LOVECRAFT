const CATBOX_API = "https://catbox.moe/user/api.php";

function apiEndpoint(configured?: string): string {
  const candidate = configured?.trim() || process.env.CATBOX_API_URL?.trim() || CATBOX_API;
  const parsed = new URL(candidate);
  if (parsed.protocol !== "https:" || parsed.hostname !== "catbox.moe" || parsed.pathname !== "/user/api.php") {
    throw new Error("Invalid Catbox API endpoint");
  }
  return parsed.toString();
}

export function hasCatboxConfigured(): boolean {
  return true;
}

export async function uploadToCatbox(file: Buffer, filename: string, endpoint?: string): Promise<string> {
  const form = new FormData();
  form.set("reqtype", "fileupload");
  form.set("fileToUpload", new Blob([new Uint8Array(file)], { type: "image/webp" }), filename);
  const userhash = process.env.CATBOX_USERHASH?.trim();
  if (userhash) form.set("userhash", userhash);

  const response = await fetch(apiEndpoint(endpoint), {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(20_000),
    headers: { "User-Agent": "LOVECRAFT/1.0 image uploader" },
    cache: "no-store",
  });
  const result = (await response.text()).trim();
  if (!response.ok || !/^https:\/\/files\.catbox\.moe\/[a-z0-9]+\.webp$/i.test(result)) {
    throw new Error(`Catbox upload failed (${response.status})`);
  }
  return result;
}

export async function deleteFromCatbox(url: string): Promise<boolean> {
  const userhash = process.env.CATBOX_USERHASH?.trim();
  const match = /^https:\/\/files\.catbox\.moe\/([a-z0-9]+)\.webp$/i.exec(url);
  if (!userhash || !match) return false;
  const form = new FormData();
  form.set("reqtype", "deletefiles");
  form.set("userhash", userhash);
  form.set("files", match[1]);
  try {
    const response = await fetch(CATBOX_API, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(10_000),
      headers: { "User-Agent": "LOVECRAFT/1.0 image cleanup" },
      cache: "no-store",
    });
    return response.ok && /success/i.test((await response.text()).trim());
  } catch {
    return false;
  }
}
