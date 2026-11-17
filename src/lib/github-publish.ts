import { eq } from "drizzle-orm";
import { db, systemSettings } from "@/db";

export interface GithubTarget {
  owner: string;
  repo: string;
  branch: string;
  token: string;
}

let cachedTarget: (GithubTarget & { at: number }) | null = null;

/**
 * Resolves the repository that hosts the generated artwork.
 * The token never leaves the server and is never sent to the browser.
 */
export async function resolveGithubTarget(): Promise<GithubTarget | null> {
  const token = process.env.GITHUB_TOKEN?.trim();
  if (!token) return null;
  if (cachedTarget && Date.now() - cachedTarget.at < 60_000) return cachedTarget;

  const [settings] = await db.select().from(systemSettings).limit(1);
  const target: GithubTarget = {
    owner: process.env.GITHUB_TEMPLATES_OWNER?.trim() || settings?.githubOwner || "elsayedhasaneisa1-collab",
    repo: process.env.GITHUB_TEMPLATES_REPO?.trim() || settings?.githubRepo || "LOVECRAFT",
    branch: process.env.GITHUB_TEMPLATES_BRANCH?.trim() || settings?.githubBranch || "main",
    token,
  };
  cachedTarget = { ...target, at: Date.now() };
  return target;
}

function headers(target: GithubTarget): Record<string, string> {
  return {
    Authorization: `Bearer ${target.token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "LoveCraft-QR-Studio",
  };
}

export interface GithubPublishResult {
  ok: boolean;
  url: string | null;
  skipped?: boolean;
  reason?: string;
}

/**
 * Publishes a file to the repository root. Existing identical files are left untouched,
 * so repeated scans never trigger a write or waste API quota.
 */
export async function publishFileToGithub(
  filePath: string,
  buffer: Buffer,
  message: string,
): Promise<GithubPublishResult> {
  const target = await resolveGithubTarget();
  if (!target) {
    return { ok: false, url: null, reason: "GITHUB_TOKEN غير مضبوط على الخادم." };
  }

  const cleanPath = filePath.replace(/^\/+/, "").replace(/\.\./g, "");
  const encodedPath = cleanPath.split("/").map(encodeURIComponent).join("/");
  const base = `https://api.github.com/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(
    target.repo
  )}/contents/${encodedPath}`;

  try {
    const existingRes = await fetch(`${base}?ref=${encodeURIComponent(target.branch)}`, {
      headers: headers(target),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });

    let sha: string | undefined;
    if (existingRes.ok) {
      const meta = (await existingRes.json()) as { sha?: string; size?: number };
      sha = meta.sha;
      if (meta.size === buffer.length) {
        return {
          ok: true,
          url: `https://raw.githubusercontent.com/${target.owner}/${target.repo}/${target.branch}/${cleanPath}`,
          skipped: true,
        };
      }
    }

    const payload = {
      message,
      content: buffer.toString("base64"),
      branch: target.branch,
      ...(sha ? { sha } : {}),
    };

    const putRes = await fetch(base, {
      method: "PUT",
      headers: { ...headers(target), "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(25_000),
    });

    if (!putRes.ok) {
      const detail = await putRes.text();
      return { ok: false, url: null, reason: `تعذر النشر على GitHub (${putRes.status}). ${detail.slice(0, 120)}` };
    }

    return {
      ok: true,
      url: `https://raw.githubusercontent.com/${target.owner}/${target.repo}/${target.branch}/${cleanPath}`,
    };
  } catch (error) {
    return {
      ok: false,
      url: null,
      reason: error instanceof Error ? error.message : "فشل الاتصال بـ GitHub.",
    };
  }
}
