#!/usr/bin/env node
/**
 * Publishes the generated QR cards into the repository root.
 * Usage: node scripts/publish-qr-to-github.mjs [owner] [repo] [branch]
 * Requires GITHUB_TOKEN with write access to the repository contents.
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import dotenv from 'dotenv';

dotenv.config();

const token = process.env.GITHUB_TOKEN?.trim();
if (!token) {
  console.error('GITHUB_TOKEN is required.');
  process.exit(1);
}

const owner = process.argv[2] || process.env.GITHUB_TEMPLATES_OWNER || 'elsayedhasaneisa1-collab';
const repo = process.argv[3] || process.env.GITHUB_TEMPLATES_REPO || 'LOVECRAFT';
const branch = process.argv[4] || process.env.GITHUB_TEMPLATES_BRANCH || 'main';
const cacheDir = process.env.QR_CACHE_DIR || path.join(os.tmpdir(), 'lovecraft-qr');

const headers = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'LoveCraft-QR-Studio',
};

async function publish(fileName, buffer) {
  const encoded = fileName.split('/').map(encodeURIComponent).join('/');
  const base = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encoded}`;
  let sha;
  const existing = await fetch(`${base}?ref=${encodeURIComponent(branch)}`, { headers, cache: 'no-store' });
  if (existing.ok) {
    const meta = await existing.json();
    sha = meta.sha;
    if (meta.size === buffer.length) {
      console.log(`= ${fileName} (unchanged)`);
      return true;
    }
  }
  const res = await fetch(base, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `feat(qr): publish ${fileName}`,
      content: buffer.toString('base64'),
      branch,
      ...(sha ? { sha } : {}),
    }),
  });
  if (!res.ok) {
    console.error(`x ${fileName}: ${res.status} ${(await res.text()).slice(0, 160)}`);
    return false;
  }
  console.log(`+ ${fileName}`);
  return true;
}

async function main() {
  let files = [];
  try {
    files = (await fs.readdir(cacheDir)).filter((f) => f.endsWith('.png'));
  } catch {
    console.error(`No QR cache found at ${cacheDir}. Generate cards first.`);
    process.exit(1);
  }
  let ok = 0;
  for (const file of files) {
    const buffer = await fs.readFile(path.join(cacheDir, file));
    if (await publish(file, buffer)) ok += 1;
  }
  console.log(`\nPublished ${ok}/${files.length} cards to ${owner}/${repo}@${branch}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
