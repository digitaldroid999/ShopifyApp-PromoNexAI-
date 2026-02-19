/**
 * PromoNex AI – video generation steps.
 * Step 1: Remove background via PhotoRoom segment API, save to public/bg_removed_images/.
 * Stock images: Pexels, Pixabay, Unsplash (each optional; missing/failed sources reported for UI).
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const PHOTOROOM_SEGMENT_URL = "https://sdk.photoroom.com/v1/segment";

// --- Stock background images (Fetch background modal) ---

export interface NormalizedStockImage {
  id: string;
  title: string;
  thumbnail_url?: string;
  preview_url?: string;
  download_url?: string;
  type?: string;
}

export interface SearchStockImagesResult {
  success: boolean;
  images: NormalizedStockImage[];
  total: number;
  page: number;
  per_page: number;
  source?: "demo";
  /** Per-source counts when using APIs; undefined when demo. */
  sources?: { pexels?: number; pixabay?: number; unsplash?: number };
  /** Per-source error messages when one or more APIs fail or return no data. */
  errors?: { pexels?: string; pixabay?: string; unsplash?: string };
}

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

// --- Stock image search (Pexels, Pixabay, Unsplash) ---

async function searchPexels(
  query: string,
  page: number,
  perPage: number
): Promise<{ images: NormalizedStockImage[]; total: number }> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return { images: [], total: 0 };

  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}`;
  const response = await fetch(url, {
    headers: { Authorization: apiKey },
  });

  if (!response.ok) throw new Error(`Pexels API error: ${response.status}`);

  const data = (await response.json()) as {
    photos?: Array<{
      id: number;
      src?: { original?: string; large2x?: string; large?: string; medium?: string; small?: string };
      photographer?: string;
      alt?: string;
    }>;
    total_results?: number;
  };

  const images: NormalizedStockImage[] = (data.photos || []).map((photo) => ({
    id: `pexels-${photo.id}`,
    title: photo.alt || `Photo by ${photo.photographer || "Pexels"}`,
    thumbnail_url: photo.src?.medium || photo.src?.small,
    preview_url: photo.src?.large || photo.src?.medium,
    download_url: photo.src?.original || photo.src?.large2x || photo.src?.large,
    type: "photo",
  }));

  return { images, total: data.total_results ?? images.length };
}

async function searchPixabay(
  query: string,
  page: number,
  perPage: number
): Promise<{ images: NormalizedStockImage[]; total: number }> {
  const apiKey = process.env.PIXABAY_API_KEY;
  if (!apiKey) return { images: [], total: 0 };

  const params = new URLSearchParams({
    key: apiKey,
    q: query,
    image_type: "photo",
    page: String(page),
    per_page: String(perPage),
    safesearch: "true",
  });
  const response = await fetch(`https://pixabay.com/api/?${params.toString()}`);

  if (!response.ok) throw new Error(`Pixabay API error: ${response.status}`);

  const data = (await response.json()) as {
    hits?: Array<{
      id: number;
      previewURL?: string;
      webformatURL?: string;
      largeImageURL?: string;
      fullHDURL?: string;
      imageURL?: string;
      tags?: string;
      user?: string;
    }>;
    total?: number;
    totalHits?: number;
  };

  const images: NormalizedStockImage[] = (data.hits || []).map((hit) => ({
    id: `pixabay-${hit.id}`,
    title: hit.tags?.split(",")[0]?.trim() || `Photo by ${hit.user || "Pixabay"}`,
    thumbnail_url: hit.previewURL,
    preview_url: hit.webformatURL || hit.largeImageURL,
    download_url: hit.largeImageURL || hit.fullHDURL || hit.imageURL || hit.webformatURL,
    type: "photo",
  }));

  return { images, total: data.total ?? data.totalHits ?? images.length };
}

async function searchUnsplash(
  query: string,
  page: number,
  perPage: number
): Promise<{ images: NormalizedStockImage[]; total: number }> {
  const apiKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!apiKey) return { images: [], total: 0 };

  const params = new URLSearchParams({
    query,
    page: String(page),
    per_page: String(perPage),
    client_id: apiKey,
  });
  const response = await fetch(
    `https://api.unsplash.com/search/photos?${params.toString()}`
  );

  if (!response.ok) throw new Error(`Unsplash API error: ${response.status}`);

  const data = (await response.json()) as {
    results?: Array<{
      id: string;
      urls?: { raw?: string; full?: string; regular?: string; small?: string; thumb?: string };
      alt_description?: string;
      user?: { name?: string };
    }>;
    total?: number;
  };

  const images: NormalizedStockImage[] = (data.results || []).map((photo) => ({
    id: `unsplash-${photo.id}`,
    title: photo.alt_description || `Photo by ${photo.user?.name || "Unsplash"}`,
    thumbnail_url: photo.urls?.small || photo.urls?.thumb,
    preview_url: photo.urls?.regular || photo.urls?.full,
    download_url: photo.urls?.full || photo.urls?.regular,
    type: "photo",
  }));

  return { images, total: data.total ?? images.length };
}

function getDemoImages(): NormalizedStockImage[] {
  return [
    {
      id: "demo-1",
      title: "Abstract Blue Gradient",
      thumbnail_url: "https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=400",
      preview_url: "https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=1200",
      download_url: "https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=1920",
      type: "photo",
    },
    {
      id: "demo-2",
      title: "Purple Pink Gradient",
      thumbnail_url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400",
      preview_url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200",
      download_url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1920",
      type: "photo",
    },
    {
      id: "demo-3",
      title: "Orange Yellow Gradient",
      thumbnail_url: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=400",
      preview_url: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1200",
      download_url: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1920",
      type: "photo",
    },
    {
      id: "demo-4",
      title: "Green Teal Gradient",
      thumbnail_url: "https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=400",
      preview_url: "https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=1200",
      download_url: "https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=1920",
      type: "photo",
    },
    {
      id: "demo-5",
      title: "Red Pink Gradient",
      thumbnail_url: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=400",
      preview_url: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=1200",
      download_url: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=1920",
      type: "photo",
    },
    {
      id: "demo-6",
      title: "Dark Blue Purple",
      thumbnail_url: "https://images.unsplash.com/photo-1618005198919-d3d4b5a92ead?w=400",
      preview_url: "https://images.unsplash.com/photo-1618005198919-d3d4b5a92ead?w=1200",
      download_url: "https://images.unsplash.com/photo-1618005198919-d3d4b5a92ead?w=1920",
      type: "photo",
    },
  ];
}

/**
 * Search stock background images from Pexels, Pixabay, and Unsplash.
 * Uses Promise.allSettled so one failing API does not break others.
 * Returns per-source counts and errors so the UI can show status for each.
 */
export async function searchStockImages(
  query: string,
  page = 1,
  perPage = 12
): Promise<SearchStockImagesResult> {
  const per = Math.min(perPage, 30);
  const hasPexels = !!process.env.PEXELS_API_KEY;
  const hasPixabay = !!process.env.PIXABAY_API_KEY;
  const hasUnsplash = !!process.env.UNSPLASH_ACCESS_KEY;

  if (!hasPexels && !hasPixabay && !hasUnsplash) {
    return {
      success: true,
      images: getDemoImages(),
      total: 8,
      page: 1,
      per_page: per,
      source: "demo",
    };
  }

  const results = await Promise.allSettled([
    hasPexels ? searchPexels(query.trim(), page, per) : Promise.resolve({ images: [] as NormalizedStockImage[], total: 0 }),
    hasPixabay ? searchPixabay(query.trim(), page, per) : Promise.resolve({ images: [] as NormalizedStockImage[], total: 0 }),
    hasUnsplash ? searchUnsplash(query.trim(), page, per) : Promise.resolve({ images: [] as NormalizedStockImage[], total: 0 }),
  ]);

  const bySource: NormalizedStockImage[][] = [];
  const sources: SearchStockImagesResult["sources"] = {};
  const errors: SearchStockImagesResult["errors"] = {};
  const sourceNames = ["pexels", "pixabay", "unsplash"] as const;

  results.forEach((result, i) => {
    const name = sourceNames[i];
    if (result.status === "fulfilled" && result.value.images.length > 0) {
      bySource.push(result.value.images);
      sources![name] = result.value.images.length;
    } else if (result.status === "fulfilled" && result.value.images.length === 0) {
      if (name === "pexels" && !hasPexels) errors![name] = "API key not set";
      else if (name === "pixabay" && !hasPixabay) errors![name] = "API key not set";
      else if (name === "unsplash" && !hasUnsplash) errors![name] = "API key not set";
      else errors![name] = "No results";
    } else if (result.status === "rejected") {
      errors![name] = result.reason?.message ?? "Request failed";
    }
  });

  // Interleave results from multiple sources
  const interleaved: NormalizedStockImage[] = [];
  let idx = 0;
  while (interleaved.length < per) {
    let added = 0;
    for (const list of bySource) {
      if (list[idx]) {
        interleaved.push(list[idx]);
        added++;
        if (interleaved.length >= per) break;
      }
    }
    if (added === 0) break;
    idx++;
  }

  return {
    success: true,
    images: interleaved,
    total: interleaved.length,
    page,
    per_page: per,
    sources,
    errors: Object.keys(errors).length ? errors : undefined,
  };
}
