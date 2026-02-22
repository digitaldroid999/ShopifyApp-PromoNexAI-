/**
 * PromoNex AI – video generation steps.
 * Step 1: Remove background via PhotoRoom segment API, save to public/bg_removed_images/.
 * Stock images: Pexels, Pixabay only (image select modal).
 * Stock videos: Pexels, Pixabay, Coverr (video select modal).
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
  /** Total count for pagination (sum of source totals when multiple APIs). */
  total: number;
  page: number;
  per_page: number;
  source?: "demo";
  /** Per-source counts when using APIs; undefined when demo. */
  sources?: { pexels?: number; pixabay?: number; coverr?: number };
  /** Per-source error messages when one or more APIs fail or return no data. */
  errors?: { pexels?: string; pixabay?: string; coverr?: string };
}

/** Same shape as SearchStockImagesResult; used for video search. */
export interface SearchStockVideosResult extends Omit<SearchStockImagesResult, "images"> {
  images: NormalizedStockImage[]; // id, title, thumbnail_url, preview_url, download_url, type: "video"
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

// --- Scene 2: merge product image onto background video (third-party API, async/polling) ---

export type MergeVideoStartResult =
  | { ok: true; task_id: string; status: string }
  | { ok: false; error: string };

/**
 * Starts image-video merge task via third-party API.
 * POST {BACKEND_URL}/image/merge-video/start
 * Request: { product_image_url, background_video_url, scene_id, user_id, duration? }
 * Response: { task_id, status, scene_id, user_id, message, created_at }
 * When duration (seconds) is set, output is limited to that length; omit for full background length.
 */
export async function mergeVideoStart(
  productImageUrl: string,
  backgroundVideoUrl: string,
  sceneId: string,
  userId: string,
  durationSeconds?: number
): Promise<MergeVideoStartResult> {
  const base = process.env.BACKEND_URL;
  if (!base?.trim()) {
    return { ok: false, error: "BACKEND_URL is not set in .env" };
  }
  const endpoint = `${base.replace(/\/$/, "")}/image/merge-video/start`;
  const body: Record<string, unknown> = {
    product_image_url: productImageUrl,
    background_video_url: backgroundVideoUrl,
    scene_id: sceneId,
    user_id: userId,
  };
  if (durationSeconds != null && Number.isFinite(durationSeconds) && durationSeconds > 0) {
    body.duration = durationSeconds;
  }
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    const raw = await response.text();
    let data: { task_id?: string; id?: string; status?: string; message?: string } = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      return { ok: false, error: `Backend returned invalid JSON (${response.status})` };
    }
    if (!response.ok) {
      const err = data.message ?? raw?.slice(0, 200) ?? response.statusText;
      return { ok: false, error: String(err) };
    }
    // Backend may return task_id or id
    const task_id =
      (typeof data.task_id === "string" ? data.task_id.trim() : "") ||
      (typeof data.id === "string" ? data.id.trim() : "");
    if (!task_id) {
      return { ok: false, error: "Backend did not return task_id or id" };
    }
    return { ok: true, task_id, status: data.status ?? "pending" };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `mergeVideoStart failed: ${message}` };
  }
}

export type MergeVideoTaskStatus = {
  status: string;
  video_url: string | null;
  error_message: string | null;
};

/**
 * Polls merge-video task status.
 * GET {BACKEND_URL}/image/merge-video/tasks/{task_id}
 * Response: { task_id, status, video_url?, error_message?, ... }
 */
export async function mergeVideoTaskStatus(taskId: string): Promise<MergeVideoTaskStatus | null> {
  const base = process.env.BACKEND_URL;
  if (!base?.trim()) return null;
  const endpoint = `${base.replace(/\/$/, "")}/image/merge-video/tasks/${encodeURIComponent(taskId)}`;
  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    const raw = await response.text();
    let data: { status?: string; video_url?: string | null; error_message?: string | null } = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      return null;
    }
    return {
      status: typeof data.status === "string" ? data.status : "pending",
      video_url: typeof data.video_url === "string" ? data.video_url : null,
      error_message: typeof data.error_message === "string" ? data.error_message : null,
    };
  } catch {
    return null;
  }
}

// --- Stock image/video search (Pexels, Pixabay, Coverr) ---

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

async function searchCoverr(
  query: string,
  page: number,
  perPage: number
): Promise<{ images: NormalizedStockImage[]; total: number }> {
  const apiKey = process.env.COVERR_API_KEY;
  if (!apiKey) return { images: [], total: 0 };

  // Coverr: page is 0-based, page_size per page, urls=true to get video URLs
  const params = new URLSearchParams({
    query: query.trim(),
    page: String(Math.max(0, page - 1)),
    page_size: String(perPage),
    urls: "true",
  });
  const response = await fetch(
    `https://api.coverr.co/videos?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${apiKey}` },
    }
  );

  if (!response.ok) throw new Error(`Coverr API error: ${response.status}`);

  const data = (await response.json()) as {
    hits?: Array<{
      id: string;
      title?: string;
      poster?: string;
      thumbnail?: string;
      urls?: { mp4?: string; mp4_preview?: string; mp4_download?: string };
    }>;
    total?: number;
  };

  const images: NormalizedStockImage[] = (data.hits || []).map((hit) => ({
    id: `coverr-${hit.id}`,
    title: hit.title || "Coverr video",
    thumbnail_url: hit.thumbnail || hit.poster,
    preview_url: hit.urls?.mp4_preview || hit.urls?.mp4,
    download_url: hit.urls?.mp4_download || hit.urls?.mp4 || hit.urls?.mp4_preview,
    type: "video",
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
 * Search stock images only (Pexels photos + Pixabay images). For image select modal.
 * Coverr is video-only and is not used here.
 */
export async function searchStockImages(
  query: string,
  page = 1,
  perPage = 12
): Promise<SearchStockImagesResult> {
  const per = Math.min(perPage, 30);
  const hasPexels = !!process.env.PEXELS_API_KEY;
  const hasPixabay = !!process.env.PIXABAY_API_KEY;

  if (!hasPexels && !hasPixabay) {
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
  ]);

  const bySource: NormalizedStockImage[][] = [];
  const sources: SearchStockImagesResult["sources"] = {};
  const errors: SearchStockImagesResult["errors"] = {};
  let totalFromApis = 0;
  const sourceNames = ["pexels", "pixabay"] as const;

  results.forEach((result, i) => {
    const name = sourceNames[i];
    if (result.status === "fulfilled" && result.value.images.length > 0) {
      bySource.push(result.value.images);
      sources![name] = result.value.images.length;
      totalFromApis += result.value.total;
    } else if (result.status === "fulfilled" && result.value.images.length === 0) {
      if (name === "pexels" && !hasPexels) errors![name] = "API key not set";
      else if (name === "pixabay" && !hasPixabay) errors![name] = "API key not set";
      else errors![name] = "No results";
    } else if (result.status === "rejected") {
      errors![name] = result.reason?.message ?? "Request failed";
    }
  });

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
    total: totalFromApis || interleaved.length,
    page,
    per_page: per,
    sources,
    errors: Object.keys(errors).length ? errors : undefined,
  };
}

// --- Stock video search (Pexels, Pixabay, Coverr) ---

async function searchPexelsVideos(
  query: string,
  page: number,
  perPage: number
): Promise<{ images: NormalizedStockImage[]; total: number }> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return { images: [], total: 0 };

  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}`;
  const response = await fetch(url, {
    headers: { Authorization: apiKey },
  });

  if (!response.ok) throw new Error(`Pexels API error: ${response.status}`);

  const data = (await response.json()) as {
    videos?: Array<{
      id: number;
      image?: string;
      video_files?: Array<{ link?: string; quality?: string }>;
      video_pictures?: Array<{ picture?: string }>;
      user?: { name?: string };
    }>;
    total_results?: number;
  };

  const images: NormalizedStockImage[] = (data.videos || []).map((v) => {
    const file = v.video_files?.find((f) => f.quality === "hd" || f.quality === "sd") || v.video_files?.[0];
    const picture = v.video_pictures?.[0]?.picture || v.image;
    return {
      id: `pexels-v-${v.id}`,
      title: `Video by ${v.user?.name || "Pexels"}`,
      thumbnail_url: picture,
      preview_url: file?.link,
      download_url: file?.link,
      type: "video",
    };
  });

  return { images, total: data.total_results ?? images.length };
}

async function searchPixabayVideos(
  query: string,
  page: number,
  perPage: number
): Promise<{ images: NormalizedStockImage[]; total: number }> {
  const apiKey = process.env.PIXABAY_API_KEY;
  if (!apiKey) return { images: [], total: 0 };

  const params = new URLSearchParams({
    key: apiKey,
    q: query,
    page: String(page),
    per_page: String(perPage),
    safesearch: "true",
  });
  const response = await fetch(`https://pixabay.com/api/videos/?${params.toString()}`);

  if (!response.ok) throw new Error(`Pixabay API error: ${response.status}`);

  const data = (await response.json()) as {
    hits?: Array<{
      id: number;
      tags?: string;
      user?: string;
      videos?: {
        medium?: { url?: string; thumbnail?: string };
        small?: { url?: string; thumbnail?: string };
        large?: { url?: string; thumbnail?: string };
      };
    }>;
    total?: number;
    totalHits?: number;
  };

  const images: NormalizedStockImage[] = (data.hits || []).map((hit) => {
    const v = hit.videos?.medium || hit.videos?.small || hit.videos?.large;
    return {
      id: `pixabay-v-${hit.id}`,
      title: hit.tags?.split(",")[0]?.trim() || `Video by ${hit.user || "Pixabay"}`,
      thumbnail_url: v?.thumbnail,
      preview_url: v?.url,
      download_url: v?.url,
      type: "video",
    };
  });

  return { images, total: data.total ?? data.totalHits ?? images.length };
}

/**
 * Search stock videos only (Pexels, Pixabay, Coverr). For video select modal.
 */
export async function searchStockVideos(
  query: string,
  page = 1,
  perPage = 12
): Promise<SearchStockVideosResult> {
  const per = Math.min(perPage, 30);
  const hasPexels = !!process.env.PEXELS_API_KEY;
  const hasPixabay = !!process.env.PIXABAY_API_KEY;
  const hasCoverr = !!process.env.COVERR_API_KEY;

  if (!hasPexels && !hasPixabay && !hasCoverr) {
    return {
      success: true,
      images: [],
      total: 0,
      page: 1,
      per_page: per,
      errors: { pexels: "API key not set", pixabay: "API key not set", coverr: "API key not set" },
    };
  }

  const results = await Promise.allSettled([
    hasPexels ? searchPexelsVideos(query.trim(), page, per) : Promise.resolve({ images: [] as NormalizedStockImage[], total: 0 }),
    hasPixabay ? searchPixabayVideos(query.trim(), page, per) : Promise.resolve({ images: [] as NormalizedStockImage[], total: 0 }),
    hasCoverr ? searchCoverr(query.trim(), page, per) : Promise.resolve({ images: [] as NormalizedStockImage[], total: 0 }),
  ]);

  const bySource: NormalizedStockImage[][] = [];
  const sources: SearchStockVideosResult["sources"] = {};
  const errors: SearchStockVideosResult["errors"] = {};
  let totalFromApis = 0;
  const sourceNames = ["pexels", "pixabay", "coverr"] as const;

  results.forEach((result, i) => {
    const name = sourceNames[i];
    if (result.status === "fulfilled" && result.value.images.length > 0) {
      bySource.push(result.value.images);
      sources![name] = result.value.images.length;
      totalFromApis += result.value.total;
    } else if (result.status === "fulfilled" && result.value.images.length === 0) {
      if (name === "pexels" && !hasPexels) errors![name] = "API key not set";
      else if (name === "pixabay" && !hasPixabay) errors![name] = "API key not set";
      else if (name === "coverr" && !hasCoverr) errors![name] = "API key not set";
      else errors![name] = "No results";
    } else if (result.status === "rejected") {
      errors![name] = result.reason?.message ?? "Request failed";
    }
  });

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
    total: totalFromApis || interleaved.length,
    page,
    per_page: per,
    sources,
    errors: Object.keys(errors).length ? errors : undefined,
  };
}

// --- Background: extract prompt (OpenAI) ---

export type ExtractBackgroundPromptResult =
  | { success: true; prompt: string; error: null }
  | { success: false; prompt: ""; error: string };

/**
 * POST {BACKEND_URL}/background/extract-prompt
 * Request: { product_description, mood?, style?, environment? }
 * Response: { success, prompt, error? }
 */
export async function extractBackgroundPrompt(params: {
  product_description: string;
  mood?: string;
  style?: string;
  environment?: string;
}): Promise<ExtractBackgroundPromptResult> {
  const base = process.env.BACKEND_URL;
  if (!base?.trim()) {
    return { success: false, prompt: "", error: "BACKEND_URL is not set in .env" };
  }
  const endpoint = `${base.replace(/\/$/, "")}/background/extract-prompt`;
  const body = {
    product_description: params.product_description.trim(),
    ...(params.mood?.trim() && { mood: params.mood.trim() }),
    ...(params.style?.trim() && { style: params.style.trim() }),
    ...(params.environment?.trim() && { environment: params.environment.trim() }),
  };
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    const raw = await response.text();
    let data: { success?: boolean; prompt?: string; error?: string | null } = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      return { success: false, prompt: "", error: `Backend returned invalid JSON (${response.status})` };
    }
    if (!response.ok) {
      const err = data.error ?? raw?.slice(0, 200) ?? response.statusText;
      return { success: false, prompt: "", error: String(err) };
    }
    if (data.success === true && typeof data.prompt === "string") {
      return { success: true, prompt: data.prompt, error: null };
    }
    return { success: false, prompt: "", error: data.error ?? "Invalid response" };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { success: false, prompt: "", error: message };
  }
}
