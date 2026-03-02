import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

/** POST /app/api/audio/clear-generated — remove generated audio URL (and subtitles) from AudioInfo for the short */
export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }
  let body: { short_id?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const shortId = typeof body.short_id === "string" ? body.short_id.trim() : "";
  if (!shortId) {
    return Response.json({ error: "short_id is required" }, { status: 400 });
  }

  try {
    const short = await (prisma as any).short.findUnique({
      where: { id: shortId },
      select: { id: true },
    });
    if (!short) {
      return Response.json({ error: "Short not found" }, { status: 404 });
    }

    await (prisma as any).audioInfo.updateMany({
      where: { shortId },
      data: { generatedAudioUrl: null, subtitles: null },
    });
    return Response.json({ success: true, message: "Generated audio removed" });
  } catch (e) {
    console.error("[app.api.audio.clear-generated]", e);
    return Response.json({ error: "Failed to clear generated audio" }, { status: 500 });
  }
};
