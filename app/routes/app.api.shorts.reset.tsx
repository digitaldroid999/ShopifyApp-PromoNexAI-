import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

/**
 * POST: Reset a short and all its scenes to default (e.g. after "Start from scratch").
 * Body: { shortId: string }
 * - Short: finalVideoUrl = null, status = "draft"
 * - All VideoScenes for that short: imageUrl = null, generatedVideoUrl = null, status = "pending"
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);

  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  let body: { shortId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const shortId = body.shortId?.trim();
  if (!shortId) {
    return Response.json({ error: "shortId required" }, { status: 400 });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const shortDelegate = (prisma as any).short;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const videoScene = (prisma as any).videoScene;

    await shortDelegate.update({
      where: { id: shortId },
      data: { finalVideoUrl: null, status: "draft" },
    });

    await videoScene.updateMany({
      where: { shortId },
      data: {
        imageUrl: null,
        generatedVideoUrl: null,
        status: "pending",
      },
    });

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[app.api.shorts.reset] Reset failed:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to reset short and scenes" },
      { status: 500 }
    );
  }
};
