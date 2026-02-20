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

  try {
    const [backgroundBuffer, overlayBuffer] = await Promise.all([
      fetchImageBuffer(backgroundUrl),
      fetchImageBuffer(overlayUrl),
    ]);

    const background = sharp(backgroundBuffer);
    const overlay = sharp(overlayBuffer);
    const bgMeta = await background.metadata();
    const ovMeta = await overlay.metadata();

    const bgWidth = bgMeta.width ?? 1920;
    const bgHeight = bgMeta.height ?? 1080;
    const ovWidth = ovMeta.width ?? bgWidth;
    const ovHeight = ovMeta.height ?? bgHeight;
    const scale = Math.min(bgWidth / ovWidth, bgHeight / ovHeight, 1);
    const overlayWidth = Math.round(ovWidth * scale);
    const overlayHeight = Math.round(ovHeight * scale);
    const left = Math.round((bgWidth - overlayWidth) / 2);
    const top = Math.round((bgHeight - overlayHeight) / 2);

    const resizedOverlay = await overlay
      .resize(overlayWidth, overlayHeight, { fit: "inside" })
      .toBuffer();

    const composited = await background
      .composite([
        { input: resizedOverlay, left, top, blend: "over" as const },
      ])
      .png()
      .toBuffer();

    const dir = path.join(process.cwd(), PUBLIC_DIR, COMPOSITED_DIR);
    await mkdir(dir, { recursive: true });

    const safeId = sanitizeId(sceneId);
    const filename = `composited-${safeId}.png`;
    const filePath = path.join(dir, filename);
    await writeFile(filePath, composited);

    const image_url = `/${COMPOSITED_DIR}/${filename}`;

    return {
      success: true,
      image_url,
      error: null,
      message: "Images composited and saved to public folder",
      created_at,
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return {
      success: false,
      image_url: null,
      error,
      message: "Compositing failed",
      created_at,
    };
  }
}
