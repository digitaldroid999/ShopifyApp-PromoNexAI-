/**
 * Storyblocks music search for background music selection.
 * Uses API v2: https://api.storyblocks.com/api/v2/audio/search
 * Same HMAC pattern as Auto-Promo-AI src/app/api/stock/music/route.ts
 * Env: STORYBLOCKS_API_KEY, STORYBLOCKS_API_SECRET, STORYBLOCKS_PROJECT_ID (optional).
 */

import { createHmac } from "node:crypto";

const STORYBLOCKS_BASE = "https://api.storyblocks.com";
const SEARCH_PATH = "/api/v2/audio/search";

export type StoryblocksMusicItem = {
  id: string;
  title: string;
  preview_url: string | null;
  duration_seconds: number | null;
  bpm: number | null;
  thumbnail_url: string | null;
};

export type StoryblocksMusicSearchResult = {
  success: boolean;
  tracks: StoryblocksMusicItem[];
  total: number;
  page: number;
  per_page: number;
  error?: string;
};

/** HMAC for v2: sign only the resource path (no query string). */
function buildHmac(secret: string, expires: number, resource: string): string {
  const hmacKey = secret + expires;
  return createHmac("sha256", hmacKey).update(resource).digest("hex");
}

/**
 * Search Storyblocks music. Requires STORYBLOCKS_API_KEY and STORYBLOCKS_API_SECRET.
 * STORYBLOCKS_PROJECT_ID optional; user_id and project_id sent per request.
 */
export async function searchStoryblocksMusic(
  query: string,
  page: number,
  perPage: number,
  userId: string = "promo-nex-user",
  projectId?: string
): Promise<StoryblocksMusicSearchResult> {
  const apiKey = process.env.STORYBLOCKS_API_KEY?.trim();
  const secret = process.env.STORYBLOCKS_API_SECRET?.trim();
  const envProjectId = process.env.STORYBLOCKS_PROJECT_ID?.trim();
  const resolvedProjectId = projectId ?? envProjectId ?? "promo-nex-project";

  if (!apiKey || !secret) {
    return {
      success: false,
      tracks: [],
      total: 0,
      page: 1,
      per_page: perPage,
      error: "Storyblocks API keys not configured (STORYBLOCKS_API_KEY, STORYBLOCKS_API_SECRET)",
    };
  }

  const expires = Math.floor(Date.now() / 1000);
  const resource = SEARCH_PATH;
  const hmac = buildHmac(secret, expires, resource);

  const params = new URLSearchParams({
    APIKEY: apiKey,
    EXPIRES: String(expires),
    HMAC: hmac,
    project_id: resolvedProjectId,
    user_id: userId,
    keywords: query.trim() || "background music",
    page: String(Math.max(1, page)),
    results_per_page: String(Math.min(30, Math.max(1, perPage))),
  });

  const url = `${STORYBLOCKS_BASE}${resource}?${params.toString()}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    const rawBody = await res.text();
    const contentType = res.headers.get("content-type") ?? "";

    if (!rawBody.trim()) {
      console.error("[storyblocks] search failed: empty response", res.status);
      return {
        success: false,
        tracks: [],
        total: 0,
        page,
        per_page: perPage,
        error: `Empty response (HTTP ${res.status})`,
      };
    }

    const isJson =
      contentType.includes("application/json") ||
      (rawBody.trimStart().startsWith("{") || rawBody.trimStart().startsWith("["));

    if (!isJson) {
      const preview = rawBody.slice(0, 120).replace(/\s+/g, " ");
      console.error("[storyblocks] search failed: API returned non-JSON", res.status, preview);
      return {
        success: false,
        tracks: [],
        total: 0,
        page,
        per_page: perPage,
        error: `Storyblocks API returned HTML or non-JSON (HTTP ${res.status}). Check API URL, key/secret, and account access.`,
      };
    }

    let data: {
      info?: Array<{
        id?: string;
        title?: string;
        duration?: number;
        duration_seconds?: number;
        bpm?: number;
        preview_url?: string;
        preview_URL?: string;
        thumbnail_url?: string;
        thumbnail_URL?: string;
      }>;
      totalSearchResults?: number;
      total_search_results?: number;
      error?: string;
    };
    try {
      data = JSON.parse(rawBody) as typeof data;
    } catch (parseErr) {
      console.error("[storyblocks] search failed: invalid JSON", parseErr);
      return {
        success: false,
        tracks: [],
        total: 0,
        page,
        per_page: perPage,
        error: "Invalid JSON from Storyblocks API",
      };
    }

    if (!res.ok) {
      const errMsg =
        (data as { error?: string }).error ||
        (data as { message?: string }).message ||
        `HTTP ${res.status}`;
      console.error("[storyblocks] search failed:", res.status, errMsg);
      return {
        success: false,
        tracks: [],
        total: 0,
        page,
        per_page: perPage,
        error: errMsg,
      };
    }

    const rawList =
      (data as { results?: unknown[] }).results ??
      data.info ??
      (data as { items?: unknown[] }).items ??
      (data as { data?: unknown[] }).data ??
      [];
    const total =
      (data as { total?: number }).total ??
      data.totalSearchResults ??
      (data as { total_results?: number }).total_results ??
      data.total_search_results ??
      (data as { total_count?: number }).total_count ??
      (Array.isArray(rawList) ? rawList.length : 0);

    const rawItems = Array.isArray(rawList) ? rawList : [];
    const tracks: StoryblocksMusicItem[] = rawItems.map((item: unknown) => {
      const it = item as Record<string, unknown>;
      const id = it.id != null ? String(it.id) : "";
      return {
        id: id ? (id.startsWith("sb-") ? id : `sb-${id}`) : `sb-${Date.now()}-${Math.random()}`,
        title: String(it.title ?? it.name ?? it.Title ?? "Track"),
        preview_url:
          typeof it.preview_url === "string"
            ? it.preview_url
            : typeof it.preview === "string"
              ? it.preview
              : typeof it.url === "string"
                ? it.url
                : typeof it.stream_url === "string"
                  ? it.stream_url
                  : typeof it.preview_URL === "string"
                    ? it.preview_URL
                    : null,
        duration_seconds:
          typeof it.duration_seconds === "number"
            ? it.duration_seconds
            : typeof it.duration === "number"
              ? it.duration
              : null,
        bpm: typeof it.bpm === "number" ? it.bpm : null,
        thumbnail_url:
          typeof it.thumbnail_url === "string"
            ? it.thumbnail_url
            : typeof it.thumbnail_URL === "string"
              ? it.thumbnail_URL
              : null,
      };
    });

    return {
      success: true,
      tracks: tracks.filter((t) => t.id),
      total: typeof total === "number" ? total : tracks.length,
      page,
      per_page: perPage,
    };
  } catch (e) {
    console.error("[storyblocks] search error:", e);
    return {
      success: false,
      tracks: [],
      total: 0,
      page,
      per_page: perPage,
      error: e instanceof Error ? e.message : "Request failed",
    };
  }
}
