import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import QRCode from "qrcode";
import sharp from "sharp";
import qrTypeface from "./qr-typeface.json";

/**
 * LOVECRAFT QR Studio
 * Produces a branded, category-shaped QR card for every published site.
 * The QR matrix itself is never obstructed: the module grid, the finder patterns and the
 * four-module quiet zone stay intact so scanning always succeeds.
 */

/** Bump whenever the artwork geometry changes so cached cards are regenerated. */
export const QR_RENDER_VERSION = "v8";

export type QrShapeKey =
  | "love"
  | "events"
  | "friends"
  | "games"
  | "portfolio"
  | "messages"
  | "bot";

export interface QrTheme {
  key: QrShapeKey;
  labelAr: string;
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  dot: string;
  silhouette: string;
  outline?: string;
}

const heart =
  "M600 520C330 320 210 200 210 110 210 44 262 0 322 0c40 0 62 20 78 44 16-24 38-44 78-44 60 0 112 44 112 110 0 90-120 210-390 410Z";
const gift =
  "M232 300h336v306c0 22-18 40-40 40H272c-22 0-40-18-40-40V300Zm-12-84h452c22 0 40 18 40 40v40H180v-40c0-22 18-40 40-40Zm188 40V146c-52 6-96 26-118 58-24-16-40-34-46-56 44-18 106-12 164 24 58-36 120-42 164-24-6 22-22 40-46 56-22-32-66-52-118-58v110Z";
const rings = `M300 300m-176 0a176 176 0 1 0 352 0a176 176 0 1 0-352 0M600 300m-176 0a176 176 0 1 0 352 0a176 176 0 1 0-352 0`;
const controller =
  "M228 300h344c52 0 104 66 124 150 18 76-12 126-66 126-38 0-62-26-86-58-16-20-32-28-72-28H348c-40 0-56 8-72 28-24 32-48 58-86 58-54 0-84-50-66-126 20-84 72-150 124-150Z";
const palette =
  "M600 40c-220 0-398 160-398 356 0 196 178 364 398 364 64 0 96-42 96-88 0-26-10-44-26-62-16-20-26-36-26-56 0-48 40-78 92-78h82c100 0 168-72 168-176C986 168 852 40 600 40Z";
const envelope =
  "M160 226h480c26 0 48 22 48 48v276c0 26-22 48-48 48H160c-26 0-48-22-48-48V274c0-26 22-48 48-48Zm0 0 240 170 240-170";
const star =
  "M600 60l92 208 226 22-172 152 52 222-198-118-198 118 52-222L274 290l226-22 100-208Z";

export const QR_THEMES: Record<QrShapeKey, QrTheme> = {
  love: {
    key: "love",
    labelAr: "شكل قلب",
    primary: "#C2566A",
    secondary: "#F0A6A0",
    accent: "#E8B96A",
    background: "#2A1119",
    surface: "#FFF7F5",
    dot: "#3A1A22",
    silhouette: `<path d="${heart}" fill="currentColor"/>`,
    outline: `<path d="${heart}"/>`,
  },
  events: {
    key: "events",
    labelAr: "شكل هدية",
    primary: "#C89B3C",
    secondary: "#F2D9A0",
    accent: "#E27C4A",
    background: "#2A2011",
    surface: "#FFFCF3",
    dot: "#33260F",
    silhouette: `<path d="${gift}" fill="currentColor"/>`,
    outline: `<path d="${gift}"/>`,
  },
  friends: {
    key: "friends",
    labelAr: "شكل حلقتين",
    primary: "#C9784F",
    secondary: "#F0B48C",
    accent: "#5FA08C",
    background: "#251610",
    surface: "#FFF9F4",
    dot: "#331E12",
    silhouette: `<g fill="none" stroke="currentColor" stroke-width="46"><circle cx="410" cy="300" r="150"/><circle cx="590" cy="300" r="150"/></g>`,
    outline: `<g fill="none" stroke="currentColor" stroke-width="10"><circle cx="410" cy="300" r="170"/><circle cx="590" cy="300" r="170"/></g>`,
  },
  games: {
    key: "games",
    labelAr: "شكل ذراع تحكم",
    primary: "#7B5AC9",
    secondary: "#B79BF0",
    accent: "#35C6D4",
    background: "#171026",
    surface: "#F8F5FF",
    dot: "#1F1533",
    silhouette: `<path d="${controller}" fill="currentColor"/>`,
    outline: `<path d="${controller}"/>`,
  },
  portfolio: {
    key: "portfolio",
    labelAr: "شكل لوحة ألوان",
    primary: "#2F8F84",
    secondary: "#7FCBC0",
    accent: "#E0A24C",
    background: "#0E2422",
    surface: "#F7FDFC",
    dot: "#12312E",
    silhouette: `<path d="${palette}" fill="currentColor"/>`,
    outline: `<path d="${palette}"/><circle cx="430" cy="300" r="66"/>`,
  },
  messages: {
    key: "messages",
    labelAr: "شكل ظرف",
    primary: "#3C5A93",
    secondary: "#8FA9DC",
    accent: "#C8894E",
    background: "#111A2B",
    surface: "#F8FAFF",
    dot: "#16223A",
    silhouette: `<path d="${envelope}" fill="currentColor"/>`,
    outline: `<path d="${envelope}"/><path d="M160 276 400 446 640 276"/>`,
  },
  bot: {
    key: "bot",
    labelAr: "شكل نجمة",
    primary: "#C2566A",
    secondary: "#E8B96A",
    accent: "#7B5AC9",
    background: "#221426",
    surface: "#FFF9FB",
    dot: "#2A1524",
    silhouette: `<path d="${star}" fill="currentColor"/>`,
    outline: `<path d="${star}"/>`,
  },
};

export function themeForCategory(categorySlug: string): QrTheme {
  return QR_THEMES[(categorySlug as QrShapeKey) in QR_THEMES ? (categorySlug as QrShapeKey) : "bot"];
}

/** The brand asset lives in the repository root and is mirrored into assets/ for bundling. */
export const WATERMARK_SOURCES = [
  path.join(process.cwd(), "watermark.png"),
  path.join(process.cwd(), "assets", "watermark.png"),
];

/** A writable cache directory that works on both a normal server and serverless runtimes. */
export function qrCacheDir(): string {
  return process.env.QR_CACHE_DIR?.trim() || path.join(os.tmpdir(), "lovecraft-qr");
}
let watermarkCache: { dataUri: string; buffer: Buffer } | null = null;

async function loadWatermark(): Promise<{ dataUri: string; buffer: Buffer } | null> {
  if (watermarkCache) return watermarkCache;
  for (const candidate of WATERMARK_SOURCES) {
    try {
      const buffer = await fs.readFile(/* turbopackIgnore: true */ candidate);
      watermarkCache = { buffer, dataUri: `data:image/png;base64,${buffer.toString("base64")}` };
      return watermarkCache;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

export async function ensureWatermarkFile(): Promise<string | null> {
  const target = path.join(process.cwd(), "watermark.png");
  try {
    await fs.access(target);
    return target;
  } catch {
    // The watermark is committed at the repository root; regenerate it when it is missing.
  }
  const source = path.join(process.cwd(), "assets", "watermark.svg");
  try {
    const svg = await fs.readFile(/* turbopackIgnore: true */ source);
    const buffer = await sharp(Buffer.from(svg)).resize(512, 512).png().toBuffer();
    await fs.writeFile(target, buffer);
    return target;
  } catch {
    return null;
  }
}

// Convert text to trusted glyph outlines so PNG output does not depend on fonts
// installed in a particular serverless runtime. The source font license is in assets/.
function qrText(text: string, x: number, y: number, fontSize: number, fill: string, options: { bold?: boolean; center?: boolean; tracking?: number; opacity?: number } = {}) {
  const font = options.bold ? qrTypeface.bold : qrTypeface.regular;
  const glyphs = font.glyphs as unknown as Record<string, [number, string]>;
  const scale = fontSize / font.units;
  const tracking = (options.tracking ?? 0) / scale;
  let offset = 0;
  const paths = Array.from(text).map((c) => {
    const [advance, path] = Object.hasOwn(glyphs, c) ? glyphs[c] : glyphs['?'];
    const svg = path ? `<path d="${path}" transform="translate(${offset} 0)"/>` : "";
    offset += advance + tracking;
    return svg;
  }).join("");
  return `<g fill="${fill}" opacity="${options.opacity ?? 1}" transform="translate(${options.center ? x - (offset - tracking) * scale / 2 : x} ${y}) scale(${scale} ${-scale})">${paths}</g>`;
}

const asciiOnly = (value: string) => /^[\x20-\x7E]+$/.test(value);

/**
 * Builds the QR card. The encoded matrix is complete and unobstructed:
 * the silhouette frames the card, the brand lockup sits below the code.
 */
export function buildQrSvg(params: {
  url: string;
  theme: QrTheme;
  title: string;
  handle: string;
  watermarkDataUri: string | null;
}): string {
  const { url, theme, title, handle } = params;
  // Level M keeps the module count (and therefore the module size) small enough
  // to stay readable when a phone scans the card from a distance.
  const qr = QRCode.create(url, { errorCorrectionLevel: "M" });
  const size = qr.modules.size;
  const get = (row: number, col: number) => qr.modules.get(row, col);

  const canvas = 1240;
  const panel = 980;
  const panelX = (canvas - panel) / 2;
  const panelY = 152;
  const quiet = 4.5;
  const module = panel / (size + quiet * 2);
  const gridSize = size * module;
  const gridX = panelX + (panel - gridSize) / 2;
  const gridY = panelY + (panel - gridSize) / 2;

  const finderOrigins: Array<[number, number]> = [
    [0, 0],
    [size - 7, 0],
    [0, size - 7],
  ];
  const inFinder = (row: number, col: number) =>
    finderOrigins.some(([r, c]) => row >= r && row < r + 7 && col >= c && col < c + 7);

  const dots: string[] = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!get(row, col) || inFinder(row, col)) continue;
      const x = gridX + col * module + module * 0.08;
      const y = gridY + row * module + module * 0.08;
      const w = module * 0.9;
      dots.push(
        `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${w.toFixed(
          2
        )}" rx="${(w * 0.18).toFixed(2)}" fill="${theme.dot}"/>`
      );
    }
  }

  const eyes: string[] = [];
  for (const [r, c] of finderOrigins) {
    const x = gridX + c * module;
    const y = gridY + r * module;
    // Exactly mirrors the module pattern: 7x7 ring, 5x5 gap, 3x3 centre.
    eyes.push(
      `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${(module * 7).toFixed(2)}" height="${(
        module * 7
      ).toFixed(2)}" rx="${(module * 1.2).toFixed(2)}" fill="${theme.dot}"/>`,
      `<rect x="${(x + module).toFixed(2)}" y="${(y + module).toFixed(2)}" width="${(
        module * 5
      ).toFixed(2)}" height="${(module * 5).toFixed(2)}" rx="${(module * 0.8).toFixed(
        2
      )}" fill="${theme.surface}"/>`,
      `<rect x="${(x + module * 2).toFixed(2)}" y="${(y + module * 2).toFixed(2)}" width="${(
        module * 3
      ).toFixed(2)}" height="${(module * 3).toFixed(2)}" rx="${(module * 0.5).toFixed(
        2
      )}" fill="${theme.dot}"/>`
    );
  }

  const handleText = (handle.startsWith("@") ? handle : `@${handle}`).slice(0, 33);
  const titleText = asciiOnly(title) ? title.slice(0, 42) : "YOUR MOMENTS · YOUR WEBSITE";

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${canvas}" height="1360" viewBox="0 0 ${canvas} 1360">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${theme.background}"/>
      <stop offset="1" stop-color="${theme.primary}" stop-opacity="0.55"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.38" r="0.62">
      <stop offset="0" stop-color="${theme.secondary}" stop-opacity="0.35"/>
      <stop offset="1" stop-color="${theme.background}" stop-opacity="0"/>
    </radialGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#000000" flood-opacity="0.35"/>
    </filter>
  </defs>

  <rect width="${canvas}" height="1360" fill="url(#bg)"/>
  <rect width="${canvas}" height="1360" fill="url(#glow)"/>
  <g transform="translate(${canvas / 2} 636) scale(1.95) translate(-300 -300)" color="${theme.primary}" opacity="0.34">
    ${theme.silhouette}
  </g>
  <g transform="translate(${canvas / 2} 636) scale(1.95) translate(-300 -300)" color="${theme.secondary}" opacity="0.5" fill="none" stroke="${theme.secondary}" stroke-width="7">
    ${theme.outline ?? theme.silhouette}
  </g>

  ${qrText("LOVECRAFT", canvas / 2, 92, 34, theme.secondary, { bold: true, center: true, tracking: 9 })}
  ${qrText(titleText, canvas / 2, 130, 20, "#FFFFFF", { center: true, tracking: 5, opacity: 0.72 })}

  <rect x="${panelX}" y="${panelY}" width="${panel}" height="${panel}" rx="54" fill="${theme.surface}" filter="url(#shadow)"/>

  <g>${dots.join("")}</g>
  <g>${eyes.join("")}</g>

  <g transform="translate(${canvas / 2 - 200} 1195)">
    ${
      params.watermarkDataUri
        ? `<image x="0" y="-58" width="86" height="86" xlink:href="${params.watermarkDataUri}" preserveAspectRatio="xMidYMid meet"/>`
        : ""
    }
    ${qrText(handleText, 106, -24, 30, "#FFFFFF", { bold: true })}
    ${qrText("SCAN TO OPEN YOUR SITE", 106, 14, 19, "#FFFFFF", { tracking: 3, opacity: 0.7 })}
  </g>
</svg>`;
}

// Serverless delivery is independent of the filesystem. The disk-cached helper below
// remains for the offline visual QA script only.
export async function renderQrPng(params: { url: string; theme: QrTheme; title: string; handle: string }) {
  const watermark = await loadWatermark();
  const svg = buildQrSvg({ ...params, watermarkDataUri: watermark?.dataUri ?? null });
  return sharp(Buffer.from(svg)).png({ compressionLevel: 6 }).toBuffer();
}

export interface QrArtifact {
  buffer: Buffer;
  fileName: string;
  cacheKey: string;
  reused: boolean;
}

/**
 * Renders the QR card and caches it on disk so repeated requests never re-encode or re-rasterise.
 */
export async function renderQrArtifact(params: {
  url: string;
  theme: QrTheme;
  title: string;
  handle: string;
  outputDir: string;
  publicPrefix: string;
}): Promise<QrArtifact> {
  const cacheKey = crypto
    .createHash("sha256")
    .update(`${params.url}|${params.theme.key}|${params.handle}|${QR_RENDER_VERSION}`)
    .digest("hex")
    .slice(0, 16);
  const fileName = `qr-${params.theme.key}-${cacheKey}.png`;
  const target = path.join(params.outputDir, fileName);

  try {
    const existing = await fs.readFile(target);
    return { buffer: existing, fileName, cacheKey, reused: true };
  } catch {
    // Not cached yet: render it once.
  }

  const watermark = await loadWatermark();
  const svg = buildQrSvg({
    url: params.url,
    theme: params.theme,
    title: params.title,
    handle: params.handle,
    watermarkDataUri: watermark?.dataUri ?? null,
  });
  const buffer = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
  await fs.mkdir(params.outputDir, { recursive: true });
  await fs.writeFile(target, buffer);
  return { buffer, fileName, cacheKey, reused: false };
}
