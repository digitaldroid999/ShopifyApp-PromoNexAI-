import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { compositeImages } from "../services/composite.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);

  if (request.method !== "POST") {
    return Response.json(
      { success: false, error: "Method not allowed", image_url: null, message: "", created_at: new Date().toISOString() },
      { status: 405 }
    );
  }

  let body: { background_url?: string; overlay_url?: string; scene_id?: string; user_id?: string };
  try {
    body = await request.json();
  } catch {
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

  const result = await compositeImages(background_url, overlay_url, scene_id);

  return Response.json({
    success: result.success,
    image_url: result.image_url,
    error: result.error,
    message: result.message,
    created_at: result.created_at,
  });
};

export default function ApiImageCompositeRoute() {
  return null;
}
