/**
 * PromoNex AI – video generation steps.
 * Step 1: Remove background via PhotoRoom segment API, save to public/bg_removed_images/.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const PHOTOROOM_SEGMENT_URL = "https://sdk.photoroom.com/v1/segment";

export type RemoveBackgroundResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/**
 * Fetches image from URL and returns a Blob (for PhotoRoom image_file).
 */
async function fetchImageBlob(imageUrl: string): Promise<Blob> {
  const res = await fetch(imageUrl, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  return res.blob();
}

/**
 * Step 1: Remove background using PhotoRoom segment API.
 * Saves the result to public/bg_removed_images/<uuid>.png and returns the public URL.
 */
export async function removeBackground(
  imageUrl: string
): Promise<RemoveBackgroundResult> {
  const apiKey = process.env.PHOTOROOM_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: "PHOTOROOM_API_KEY is not set. Add it to your .env file.",
    };
  }

  try {
    const imageBlob = await fetchImageBlob(imageUrl);
    const ext = (imageBlob.type?.split("/")[1] || "jpg").replace("jpeg", "jpg");
    const formData = new FormData();
    formData.append(
      "image_file",
      imageBlob,
      `image.${ext}`
    );

    const response = await fetch(PHOTOROOM_SEGMENT_URL, {
      method: "POST",
      headers: { "x-api-key": apiKey },
      body: formData,
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        ok: false,
        error: `PhotoRoom API error: ${response.status} ${text}`,
      };
    }

    const resultBuffer = Buffer.from(await response.arrayBuffer());
    const dir = path.join(process.cwd(), "public", "bg_removed_images");
    await mkdir(dir, { recursive: true });

    const filename = `${randomUUID()}.png`;
    const filePath = path.join(dir, filename);
    await writeFile(filePath, resultBuffer);

    // URL the frontend can use: /bg_removed_images/<filename>
    const url = `/bg_removed_images/${filename}`;
    return { ok: true, url };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `removeBackground failed: ${message}` };
  }
}
