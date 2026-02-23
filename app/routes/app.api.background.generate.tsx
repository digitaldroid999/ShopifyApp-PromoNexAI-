import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { startBackgroundGeneration } from "../services/promonexai.server";

const LOG = "[API background/generate]";

/** POST /app/api/background/generate — proxy to BACKEND_URL/background/generate */
export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  if (request.method !== "POST") {
    console.log(`${LOG} Method not allowed: ${request.method}`);
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }
  let body: {
    product_description?: string;
    user_id?: string;
    scene_id?: string;
    short_id?: string;
    manual_prompt?: string;
    mood?: string;
    style?: string;
    environment?: string;
  };
  try {
    body = await request.json();
  } catch {
    console.log(`${LOG} Invalid JSON body`);
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const product_description = typeof body.product_description === "string" ? body.product_description.trim() : "";
  const user_id = typeof body.user_id === "string" ? body.user_id.trim() : "";
  console.log(`${LOG} [1] Request received`, { user_id, scene_id: body.scene_id, short_id: body.short_id, has_manual_prompt: !!body.manual_prompt, has_mood: !!body.mood });
  if (!user_id) {
    console.log(`${LOG} [1] Validation failed: user_id required`);
    return Response.json({ ok: false, error: "user_id is required" }, { status: 400 });
  }
  const result = await startBackgroundGeneration({
    product_description: product_description || "Product",
    user_id,
    scene_id: typeof body.scene_id === "string" ? body.scene_id.trim() || undefined : undefined,
    short_id: typeof body.short_id === "string" ? body.short_id.trim() || undefined : undefined,
    manual_prompt: typeof body.manual_prompt === "string" ? body.manual_prompt.trim() || undefined : undefined,
    mood: typeof body.mood === "string" ? body.mood.trim() || undefined : undefined,
    style: typeof body.style === "string" ? body.style.trim() || undefined : undefined,
    environment: typeof body.environment === "string" ? body.environment.trim() || undefined : undefined,
  });
  if (!result.ok) {
    console.log(`${LOG} [2] Backend error:`, result.error);
    return Response.json({ ok: false, error: result.error }, { status: 400 });
  }
  console.log(`${LOG} [2] Success → task_id=${result.task_id}`);
  return Response.json({ ok: true, task_id: result.task_id });
};
