import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

/** POST — save background music selection to Short.metadata.bgMusic */
export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  let body: { short_id?: string; bg_music?: { id?: string; title?: string; preview_url?: string } };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const shortId = typeof body.short_id === "string" ? body.short_id.trim() : "";
  if (!shortId) {
    return Response.json({ error: "short_id is required" }, { status: 400 });
  }

  const bgMusic = body.bg_music;
  const payload =
    bgMusic && typeof bgMusic === "object"
      ? {
          id: typeof bgMusic.id === "string" ? bgMusic.id.trim() || null : null,
          title: typeof bgMusic.title === "string" ? bgMusic.title.trim() || null : null,
          preview_url: typeof bgMusic.preview_url === "string" ? bgMusic.preview_url.trim() || null : null,
        }
      : null;

  try {
    const short = await (prisma as any).short.findUnique({
      where: { id: shortId },
      select: { id: true, metadata: true },
    });
    if (!short) {
      return Response.json({ error: "Short not found" }, { status: 404 });
    }

    const currentMeta = (short.metadata as Record<string, unknown>) ?? {};
    const updatedMetadata = {
      ...currentMeta,
      bgMusic: payload,
    };

    await (prisma as any).short.update({
      where: { id: shortId },
      data: { metadata: updatedMetadata },
    });

    return Response.json({ success: true, bgMusic: payload });
  } catch (e) {
    console.error("[app.api.shorts.save-bg-music]", e);
    return Response.json({ error: "Failed to save background music" }, { status: 500 });
  }
};
