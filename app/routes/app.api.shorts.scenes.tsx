import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

const DEFAULT_DURATION_SEC = 8;

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);

  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  let shortId: string | undefined;
  let sceneNumber: number | undefined;

  const contentType = request.headers.get("Content-Type") || "";
  if (contentType.includes("application/json")) {
    let body: { shortId?: string; sceneNumber?: number };
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }
    shortId = body.shortId?.trim();
    const rawScene = body.sceneNumber;
    sceneNumber =
      typeof rawScene === "number"
        ? rawScene
        : typeof rawScene === "string"
          ? parseInt(rawScene, 10)
          : undefined;
  } else {
    const formData = await request.formData();
    shortId = (formData.get("shortId") ?? formData.get("short_id"))?.toString()?.trim();
    const rawScene = formData.get("sceneNumber") ?? formData.get("scene_number");
    sceneNumber =
      typeof rawScene === "number"
        ? rawScene
        : rawScene != null
          ? parseInt(String(rawScene), 10)
          : undefined;
  }

  if (!shortId) {
    return Response.json({ error: "shortId required" }, { status: 400 });
  }
  if (sceneNumber === undefined || Number.isNaN(sceneNumber) || sceneNumber < 1 || sceneNumber > 3) {
    return Response.json({ error: "sceneNumber must be 1, 2, or 3" }, { status: 400 });
  }

  console.log("[app.api.shorts.scenes] ensure scene:", { shortId, sceneNumber });

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const videoScene = (prisma as any).videoScene;
    const existing = await videoScene.findFirst({
      where: { shortId, sceneNumber },
    });

    if (existing) {
      return Response.json({ sceneId: existing.id, created: false });
    }

    const scene = await videoScene.create({
      data: {
        shortId,
        sceneNumber,
        duration: DEFAULT_DURATION_SEC,
        status: "pending",
      },
    });
    return Response.json({ sceneId: scene.id, created: true });
  } catch (err) {
    console.error("[app.api.shorts.scenes] VideoScene create failed:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to create scene" },
      { status: 500 }
    );
  }
};

export default function ApiShortsScenesRoute() {
  return null;
}
