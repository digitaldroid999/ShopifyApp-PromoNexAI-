import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { removeBackground } from "../services/promonexai.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);

  if (request.method !== "POST") {
    return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
  }

  let body: { step?: string; imageUrl?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const step = body.step;
  if (step === "removeBg") {
    const imageUrl = body.imageUrl;
    if (!imageUrl || typeof imageUrl !== "string") {
      return Response.json({ ok: false, error: "Missing or invalid imageUrl" }, { status: 400 });
    }
    const result = await removeBackground(imageUrl);
    return Response.json(result);
  }

  return Response.json({ ok: false, error: `Unknown step: ${step}` }, { status: 400 });
};

export default function ApiVideoRoute() {
  return null;
}
