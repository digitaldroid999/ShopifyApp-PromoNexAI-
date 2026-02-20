import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { compositeImages } from "../services/composite.server";

const LOG_PREFIX = "[Composite API]";

export const action = async ({ request }: ActionFunctionArgs) => {
  console.log(`${LOG_PREFIX} 1. Request received: ${request.method} ${request.url}`);
  await authenticate.admin(request);
  console.log(`${LOG_PREFIX} 2. Auth OK`);

  if (request.method !== "POST") {
    console.warn(`${LOG_PREFIX} Rejected: method not allowed`);
    return Response.json(
      { success: false, error: "Method not allowed", image_url: null, message: "", created_at: new Date().toISOString() },
      { status: 405 }
    );
  }

  let body: { background_url?: string; overlay_url?: string; scene_id?: string; user_id?: string };
  try {
    body = await request.json();
    console.log(`${LOG_PREFIX} 3. Body parsed:`, { background_url: body.background_url, overlay_url: body.overlay_url, scene_id: body.scene_id });
  } catch {
    console.warn(`${LOG_PREFIX} Invalid JSON body`);
    return Response.json(
      {
        success: false,
        image_url: null,
        error: "Invalid JSON body",
        message: "Invalid request",
        created_at: new Date().toISOString(),
      },
      { status: 400 }
    );
  }

  const background_url = body.background_url;
  const overlay_url = body.overlay_url;
  const scene_id = body.scene_id ?? `scene-${Date.now()}`;
  const user_id = body.user_id ?? "anonymous";

  if (!background_url || typeof background_url !== "string") {
    console.warn(`${LOG_PREFIX} Validation failed: missing or invalid background_url`);
    return Response.json(
      {
        success: false,
        image_url: null,
        error: "Missing or invalid background_url",
        message: "Missing required fields",
        created_at: new Date().toISOString(),
      },
      { status: 400 }
    );
  }
  if (!overlay_url || typeof overlay_url !== "string") {
    console.warn(`${LOG_PREFIX} Validation failed: missing or invalid overlay_url`);
    return Response.json(
      {
        success: false,
        image_url: null,
        error: "Missing or invalid overlay_url",
        message: "Missing required fields",
        created_at: new Date().toISOString(),
      },
      { status: 400 }
    );
  }

  console.log(`${LOG_PREFIX} 4. Calling compositeImages(background_url, overlay_url, scene_id="${scene_id}")`);
  const result = await compositeImages(background_url, overlay_url, scene_id);
  console.log(`${LOG_PREFIX} 5. compositeImages result:`, { success: result.success, image_url: result.image_url, error: result.error });

  const jsonBody = {
    success: result.success,
    image_url: result.image_url,
    error: result.error,
    message: result.message,
    created_at: result.created_at,
  };
  return new Response(JSON.stringify(jsonBody), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
};

export default function ApiImageCompositeRoute() {
  return null;
}
