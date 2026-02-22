/**
 * Storyblocks (AudioBlocks) music search for background music selection.
 * Uses HMAC auth per https://documentation.storyblocks.com/
 * Env: STORYBLOCKS_API_KEY (public), STORYBLOCKS_API_SECRET (secret).
 */

import { createHmac } from "node:crypto";

const AUDIO_BLOCKS_BASE = "https://api.audioblocks.com";
const SEARCH_PATH = "/api/v1/stock-items/search";

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

function buildHmac(secret: string, expires: number, resource: string): string {
  const key = `${secret}${expires}`;
  return createHmac("sha256", key).update(resource).digest("hex");
}

/**
 * Search Storyblocks music. Requires STORYBLOCKS_API_KEY and STORYBLOCKS_API_SECRET.
 * user_id and project_id are required by the API (we use shortId or a constant for project).
 */
export async function searchStoryblocksMusic(
  query: string,
  page: number,
  perPage: number,
  userId: string = "promo-nex-user",
  projectId: string = "promo-nex-project"
): Promise<StoryblocksMusicSearchResult> {
  const apiKey = process.env.STORYBLOCKS_API_KEY?.trim();
  const secret = process.env.STORYBLOCKS_API_SECRET?.trim();

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

  const expires = Math.floor(Date.now() / 1000) + 3600; // 1 hour
  const params: Record<string, string> = {
    api_key: apiKey,
    expires: String(expires),
    keywords: query.trim() || "upbeat",
    page: String(Math.max(1, page)),
    num_results: String(Math.min(20, Math.max(1, perPage))),
    user_id: userId,
    project_id: projectId,
  };

  const queryString = new URLSearchParams(
    Object.entries(params).sort((a, b) => a[0].localeCompare(b[0]))
  ).toString();
  const resource = `${SEARCH_PATH}?${queryString}`;
  const hmac = buildHmac(secret, expires, resource);
  params.hmac = hmac;

  const url = `${AUDIO_BLOCKS_BASE}${SEARCH_PATH}?${new URLSearchParams(params).toString()}`;

  try {
    const res = await fetch(url, { method: "GET" });
    const data = (await res.json()) as {
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

    const rawList = data.info ?? (data as { results?: unknown[] }).results ?? [];
    const total =
      data.totalSearchResults ??
      data.total_search_results ??
      (Array.isArray(rawList) ? rawList.length : 0);

    const rawItems = Array.isArray(rawList) ? rawList : [];
    const tracks: StoryblocksMusicItem[] = rawItems.map((item: unknown) => {
      const it = item as Record<string, unknown>;
      return {
        id: String(it.id ?? it.ID ?? ""),
        title: String(it.title ?? it.Title ?? "Untitled"),
        preview_url:
          typeof it.preview_url === "string"
            ? it.preview_url
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
