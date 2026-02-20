/**
 * Image compositing via third-party backend API.
 * Calls BACKEND_URL to composite overlay (foreground) on background; no local sharp.
 * Matches backend contract: background_url, overlay_url, scene_id, user_id.
 */

const LOG_PREFIX = "[Composite Service]";

const getCompositeEndpoint = (): string => {
  const base = process.env.BACKEND_URL;
  if (!base?.trim()) {
    throw new Error("BACKEND_URL is not set in .env");
  }
  const url = base.replace(/\/$/, "");
  return `${url}/image/composite`;
};

export interface CompositeImagesResult {
  success: boolean;
  image_url: string | null;
  error: string | null;
  message: string;
  created_at: string;
}

/**
 * Composites overlay (foreground) on background via third-party API.
 * Returns the image_url from the backend (e.g. public URL of composited image).
 */
export async function compositeImages(
  backgroundUrl: string,
  overlayUrl: string,
  sceneId: string,
  userId: string = "anonymous"
): Promise<CompositeImagesResult> {
  const created_at = new Date().toISOString();
  console.log(`${LOG_PREFIX} 1. compositeImages called: sceneId="${sceneId}" (using third-party API)`);
  console.log(`${LOG_PREFIX}    background: ${backgroundUrl}`);
  console.log(`${LOG_PREFIX}    overlay: ${overlayUrl}`);

  try {
    const endpoint = getCompositeEndpoint();
    console.log(`${LOG_PREFIX} 2. Calling backend: POST ${endpoint}`);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        overlay_url: overlayUrl,
        background_url: backgroundUrl,
        scene_id: sceneId,
        user_id: userId,
      }),
      signal: AbortSignal.timeout(60000),
    });

    const rawText = await response.text();
    let result: { success?: boolean; image_url?: string | null; error?: string | null } = {};
    try {
      result = rawText ? JSON.parse(rawText) : {};
    } catch {
      console.error(`${LOG_PREFIX} Backend response is not JSON (status ${response.status}). Raw (first 300 chars):`, rawText.slice(0, 300));
      return {
        success: false,
        image_url: null,
        error: `Backend returned invalid response: ${response.status} ${response.statusText}`,
        message: "Compositing failed",
        created_at,
      };
    }

    if (!response.ok) {
      const errMsg = result.error ?? rawText.slice(0, 200) ?? response.statusText;
      console.error(`${LOG_PREFIX} Backend error (${response.status}):`, errMsg);
      return {
        success: false,
        image_url: null,
        error: String(errMsg),
        message: "Compositing failed",
        created_at,
      };
    }

    if (!result.success) {
      const errMsg = result.error ?? "Composition failed";
      console.error(`${LOG_PREFIX} Backend reported failure:`, errMsg);
      return {
        success: false,
        image_url: null,
        error: String(errMsg),
        message: "Compositing failed",
        created_at,
      };
    }

    const image_url = result.image_url ?? null;
    console.log(`${LOG_PREFIX} 3. Done. image_url: ${image_url}`);

    return {
      success: true,
      image_url,
      error: null,
      message: "Images composited via backend",
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
