import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { extractBackgroundPrompt } from "../services/promonexai.server";

/** POST /app/api/background/extract-prompt — proxy to BACKEND_URL/background/extract-prompt */
export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }
  let body: { product_description?: string; mood?: string; style?: string; environment?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const product_description = typeof body.product_description === "string" ? body.product_description.trim() : "";
  if (!product_description) {
    return Response.json({ success: false, prompt: "", error: "product_description is required" }, { status: 400 });
  }
  const result = await extractBackgroundPrompt({
    product_description,
    mood: typeof body.mood === "string" ? body.mood.trim() || undefined : undefined,
    style: typeof body.style === "string" ? body.style.trim() || undefined : undefined,
    environment: typeof body.environment === "string" ? body.environment.trim() || undefined : undefined,
  });
  return Response.json(result);
};
