/**
 * Remotion server integration for Scene 1 (and future scenes) video generation.
 * Uses async/polling: POST /shopify/videos → GET /tasks/:taskId until completed/failed.
 * REMOTION_URL in .env must point to the Remotion API (e.g. http://localhost:5050).
 */

const LOG_PREFIX = "[Remotion Service]";

function getRemotionBase(): string {
  const base = process.env.REMOTION_URL;
  if (!base?.trim()) {
    throw new Error("REMOTION_URL is not set in .env");
  }
  return base.replace(/\/$/, "");
}

export type RemotionProduct = {
  name: string;
  price?: string;
  rating?: number;
};

export type StartShopifyVideoParams = {
  template: string;
  imageUrl: string;
  product: RemotionProduct;
  user_id: string;
  short_id: string;
};

export type StartShopifyVideoResult =
  | { ok: true; taskId: string }
  | { ok: false; error: string };

/**
 * POST to Remotion /shopify/videos to start video generation.
 * Returns the Remotion taskId from the response.
 */
export async function startShopifyVideo(
  params: StartShopifyVideoParams
): Promise<StartShopifyVideoResult> {
  const base = getRemotionBase();
  const url = `${base}/shopify/videos`;
  console.log(`${LOG_PREFIX} POST ${url}`);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        template: params.template,
        imageUrl: params.imageUrl,
        product: params.product,
        user_id: params.user_id,
        short_id: params.short_id,
      }),
      signal: AbortSignal.timeout(15000),
    });

    const text = await res.text();
    let data: { taskId?: string; status?: string; error?: string };
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      console.error(`${LOG_PREFIX} Response not JSON:`, text.slice(0, 200));
      if (res.status === 404 || /Cannot POST|Cannot GET|404|Not Found/i.test(text)) {
        return {
          ok: false,
          error: `Remotion server at ${url} returned 404. Ensure REMOTION_URL is correct and the server has POST /shopify/videos enabled.`,
        };
      }
      return { ok: false, error: "Remotion server returned invalid response (not JSON)." };
    }

    if (!res.ok) {
      const err = data.error ?? text.slice(0, 200) ?? res.statusText;
      console.error(`${LOG_PREFIX} Remotion error (${res.status}):`, err);
      return { ok: false, error: String(err) };
    }

    const taskId = data.taskId?.trim();
    if (!taskId) {
      return { ok: false, error: "Remotion did not return taskId" };
    }

    console.log(`${LOG_PREFIX} Task started: ${taskId}`);
    return { ok: true, taskId };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    console.error(`${LOG_PREFIX} startShopifyVideo error:`, err);
    return { ok: false, error: err };
  }
}

export type RemotionTaskStatus = {
  id: string;
  status: "pending" | "completed" | "failed";
  stage?: string;
  progress?: number;
  videoUrl?: string;
  error?: string;
};

/**
 * GET Remotion /tasks/:taskId and return status.
 */
export async function fetchRemotionTaskStatus(
  remotionTaskId: string
): Promise<RemotionTaskStatus | null> {
  const base = getRemotionBase();
  const url = `${base}/tasks/${encodeURIComponent(remotionTaskId)}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const text = await res.text();
    let data: Record<string, unknown>;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      return null;
    }

    return {
      id: String(data.id ?? remotionTaskId),
      status: (data.status as "pending" | "completed" | "failed") ?? "pending",
      stage: typeof data.stage === "string" ? data.stage : undefined,
      progress: typeof data.progress === "number" ? data.progress : undefined,
      videoUrl: typeof data.videoUrl === "string" ? data.videoUrl : undefined,
      error: typeof data.error === "string" ? data.error : undefined,
    };
  } catch {
    return null;
  }
}
