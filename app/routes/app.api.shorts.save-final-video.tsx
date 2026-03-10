import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { consumeCredit, getCredits } from "../lib/credits.server";

/** POST — save final video URL to Short.finalVideoUrl. Consumes 1 credit when a final video is saved. */
export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  let body: { short_id?: string; final_video_url?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const shortId = typeof body.short_id === "string" ? body.short_id.trim() : "";
  if (!shortId) {
    return Response.json({ error: "short_id is required" }, { status: 400 });
  }

  const finalVideoUrl = typeof body.final_video_url === "string" ? body.final_video_url.trim() || null : null;

  try {
    const short = await (prisma as any).short.findUnique({
      where: { id: shortId },
      select: { id: true, userId: true },
    });
    if (!short) {
      return Response.json({ error: "Short not found" }, { status: 404 });
    }

    await (prisma as any).short.update({
      where: { id: shortId },
      data: { finalVideoUrl, status: finalVideoUrl ? "finished" : "in_progress" },
    });

    if (finalVideoUrl && short.userId) {
      const credits = await getCredits(short.userId);
      if (credits.trialEnded && !credits.hasActiveSubscription) {
        return Response.json(
          { error: "Your trial has ended. Subscribe to continue creating videos." },
          { status: 402 }
        );
      }
      const consumed = await consumeCredit(short.userId);
      if (!consumed.ok) {
        console.warn("[app.api.shorts.save-final-video] consumeCredit failed:", consumed.error);
      }
    }

    return Response.json({ success: true, final_video_url: finalVideoUrl });
  } catch (e) {
    console.error("[app.api.shorts.save-final-video]", e);
    return Response.json({ error: "Failed to save final video URL" }, { status: 500 });
  }
};
