/**
 * Image compositing: overlay (foreground) on background, save to public/composited_images/.
 * Matches original backend contract: background_url, overlay_url, scene_id, user_id.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const COMPOSITED_DIR = "composited_images";
const PUBLIC_DIR = "public";

export interface CompositeImagesResult {
  success: boolean;
  image_url: string | null;
  error: string | null;
  message: string;
  created_at: string;
}

async function fetchImageBuffer(imageUrl: string): Promise<Buffer> {
  const res = await fetch(imageUrl, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function sanitizeId(sceneId: string): string {
  const safe = sceneId.replace(/[^a-zA-Z0-9_-]/g, "");
  return safe || `scene-${Date.now()}`;
}

const LOG_PREFIX = "[Composite Service]";

/**
 * Composites overlay (foreground) on top of background, saves to public/composited_images/composited-{sceneId}.png.
 * Returns public URL path (e.g. /composited_images/composited-abc123.png).
 */
export async function compositeImages(
  backgroundUrl: string,
  overlayUrl: string,
  sceneId: string
): Promise<CompositeImagesResult> {
  const created_at = new Date().toISOString();
  console.log(`${LOG_PREFIX} 1. compositeImages called: sceneId="${sceneId}"`);
  console.log(`${LOG_PREFIX}    background: ${backgroundUrl}`);
  console.log(`${LOG_PREFIX}    overlay: ${overlayUrl}`);

  try {
    console.log(`${LOG_PREFIX} 2. Fetching background and overlay image buffers...`);
    const [backgroundBuffer, overlayBuffer] = await Promise.all([
      fetchImageBuffer(backgroundUrl),
      fetchImageBuffer(overlayUrl),
    ]);
    console.log(`${LOG_PREFIX}    background buffer: ${backgroundBuffer.length} bytes, overlay buffer: ${overlayBuffer.length} bytes`);

    console.log(`${LOG_PREFIX} 3. Loading images with sharp and reading metadata...`);
    const background = sharp(backgroundBuffer);
    const overlay = sharp(overlayBuffer);
    const bgMeta = await background.metadata();
    const ovMeta = await overlay.metadata();

    const bgWidth = bgMeta.width ?? 1920;
    const bgHeight = bgMeta.height ?? 1080;
    const ovWidth = ovMeta.width ?? bgWidth;
    const ovHeight = ovMeta.height ?? bgHeight;
    console.log(`${LOG_PREFIX}    background size: ${bgWidth}x${bgHeight}, overlay size: ${ovWidth}x${ovHeight}`);

    const scale = Math.min(bgWidth / ovWidth, bgHeight / ovHeight, 1);
    const overlayWidth = Math.round(ovWidth * scale);
    const overlayHeight = Math.round(ovHeight * scale);
    const left = Math.round((bgWidth - overlayWidth) / 2);
    const top = Math.round((bgHeight - overlayHeight) / 2);
    console.log(`${LOG_PREFIX} 4. Scale=${scale.toFixed(3)} → overlay placed at ${overlayWidth}x${overlayHeight}, position (${left}, ${top})`);

    console.log(`${LOG_PREFIX} 5. Resizing overlay and compositing onto background...`);
    const resizedOverlay = await overlay
      .resize(overlayWidth, overlayHeight, { fit: "inside" })
      .toBuffer();

    const composited = await background
      .composite([
        { input: resizedOverlay, left, top, blend: "over" as const },
      ])
      .png()
      .toBuffer();
    console.log(`${LOG_PREFIX}    composited PNG buffer: ${composited.length} bytes`);

    const dir = path.join(process.cwd(), PUBLIC_DIR, COMPOSITED_DIR);
    await mkdir(dir, { recursive: true });
    const safeId = sanitizeId(sceneId);
    const filename = `composited-${safeId}.png`;
    const filePath = path.join(dir, filename);
    await writeFile(filePath, composited);
    console.log(`${LOG_PREFIX} 6. Saved to ${filePath}`);

    const image_url = `/${COMPOSITED_DIR}/${filename}`;
    console.log(`${LOG_PREFIX} 7. Done. Public URL: ${image_url}`);

    return {
      success: true,
      image_url,
      error: null,
      message: "Images composited and saved to public folder",
      created_at,
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error(`${LOG_PREFIX} Error:`, error);
    return {
      success: false,
      image_url: null,
      error,
      message: "Compositing failed",
      created_at,
    };
  }
}
