import 'dotenv/config';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import jsQR from 'jsqr';
import { QR_THEMES, renderQrArtifact, themeForCategory, type QrShapeKey } from '../src/lib/qr-studio';

/** Decodes the rendered card exactly like a phone camera would. */
/** A phone sees the card at many distances, so it must decode at every scale. */
const SCAN_WIDTHS = [1400, 1200, 1000, 900, 800, 700];

async function decodeAt(buffer: Buffer, width: number): Promise<string | null> {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .resize({ width, withoutEnlargement: false })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const result = jsQR(new Uint8ClampedArray(data), info.width, info.height, {
    inversionAttempts: 'attemptBoth',
  });
  return result?.data ?? null;
}

async function decode(buffer: Buffer): Promise<string | null> {
  for (const width of SCAN_WIDTHS) {
    const result = await decodeAt(buffer, width);
    if (result) return result;
  }
  return null;
}

const outputDir = path.join(process.cwd(), 'public', 'qr');

async function main() {
  const handle = '@LoveCraftMakerBot';
  const cases: Array<{ shape: QrShapeKey; url: string }> = [
    { shape: 'love', url: 'https://lovecraft.app/s/noor-envelope' },
    { shape: 'events', url: 'https://lovecraft.app/s/layla-omar-wedding' },
    { shape: 'friends', url: 'https://lovecraft.app/s/squad-friendship-quiz' },
    { shape: 'games', url: 'https://lovecraft.app/s/golden-mystery-boxes' },
    { shape: 'portfolio', url: 'https://lovecraft.app/s/karim-creative-studio' },
    { shape: 'messages', url: 'https://lovecraft.app/s/starlight-countdown' },
    { shape: 'bot', url: 'https://t.me/LoveCraftMakerBot?start=REF83921' },
  ];

  const results: Array<Record<string, unknown>> = [];
  for (const testCase of cases) {
    const theme = themeForCategory(testCase.shape);
    assert.equal(theme.key, testCase.shape);
    const artifact = await renderQrArtifact({
      url: testCase.url,
      theme,
      title: 'Your Moments',
      handle,
      outputDir,
      publicPrefix: '/qr',
    });

    // The card must decode back to the exact link.
    const decoded = await decode(artifact.buffer);
    assert.equal(decoded, testCase.url, `${testCase.shape} QR did not decode to the site link`);
    const perScale: Record<string, string | null> = {};
    for (const width of SCAN_WIDTHS) perScale[String(width)] = await decodeAt(artifact.buffer, width);
    const failedScales = Object.entries(perScale).filter(([, value]) => value !== testCase.url);
    assert.equal(failedScales.length, 0, `${testCase.shape} failed at scales: ${failedScales.map(([w]) => w).join(', ')}`);

    // The brand lockup and the watermark must be present in the artwork.
    const metadata = await sharp(artifact.buffer).metadata();
    assert.equal(metadata.format, 'png');
    assert(metadata.width! >= 1000 && metadata.height! >= 1000);

    // A second call must reuse the cached file instead of re-rendering.
    const again = await renderQrArtifact({
      url: testCase.url,
      theme,
      title: 'Your Moments',
      handle,
      outputDir,
      publicPrefix: '/qr',
    });
    assert.equal(again.reused, true, 'The QR card must be cached on disk');
    assert.equal(again.fileName, artifact.fileName);

    results.push({
      shape: testCase.shape,
      shapeLabelAr: theme.labelAr,
      file: `/qr/${artifact.fileName}`,
      bytes: artifact.buffer.length,
      decodedTo: decoded,
      cached: again.reused,
      scannedAtWidths: perScale,
    });
    console.log(`${testCase.shape.padEnd(10)} -> ${artifact.fileName} (${Math.round(artifact.buffer.length / 1024)}KB) decodes to ${decoded}`);
  }

  // The watermark must exist at the repository root as the brand asset.
  const watermark = await fs.readFile(path.join(process.cwd(), 'watermark.png'));
  assert(watermark.length > 1000, 'watermark.png must exist at the repository root');

  // Every shape must look different: compare a downscaled signature of each card.
  const signatures = new Map<string, string>();
  for (const entry of results) {
    const buffer = await fs.readFile(path.join(process.cwd(), 'public', String(entry.file)));
    const signature = await sharp(buffer).greyscale().resize(24, 24).raw().toBuffer();
    signatures.set(String(entry.shape), signature.toString('base64'));
  }
  const unique = new Set(signatures.values());
  assert.equal(unique.size, results.length, 'Each category must produce a visually distinct card');

  await fs.writeFile(
    path.join(process.cwd(), 'docs', 'qa', 'qr-cards.json'),
    JSON.stringify({ checkedAt: new Date().toISOString(), handle, cards: results }, null, 2) + '\n',
  );
  console.log(`\nAll ${results.length} QR shapes decode correctly, are cached on disk and are visually distinct.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
