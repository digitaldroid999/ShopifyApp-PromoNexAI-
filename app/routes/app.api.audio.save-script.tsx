import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

/** POST /app/api/audio/save-script — save audio_script (and optional voice) to AudioInfo */
export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }
  let body: { short_id?: string; audio_script?: string; voice_id?: string; voice_name?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const shortId = typeof body.short_id === "string" ? body.short_id.trim() : "";
  if (!shortId) {
    return Response.json({ error: "short_id is required" }, { status: 400 });
  }
  const audioScript = typeof body.audio_script === "string" ? body.audio_script : null;
  const voiceId = typeof body.voice_id === "string" ? body.voice_id.trim() || null : null;
  const voiceName = typeof body.voice_name === "string" ? body.voice_name.trim() || null : null;

  try {
    const short = await (prisma as any).short.findUnique({
      where: { id: shortId },
      select: { id: true },
    });
    if (!short) {
      return Response.json({ error: "Short not found" }, { status: 404 });
    }

    await (prisma as any).audioInfo.upsert({
      where: { shortId },
      create: {
        shortId,
        audioScript: audioScript ?? undefined,
        voiceId: voiceId ?? undefined,
        voiceName: voiceName ?? undefined,
      },
      update: {
        ...(audioScript !== null && { audioScript }),
        ...(voiceId !== null && { voiceId }),
        ...(voiceName !== null && { voiceName }),
      },
    });
    return Response.json({ success: true, message: "Script saved" });
  } catch (e) {
    console.error("[app.api.audio.save-script]", e);
    return Response.json({ error: "Failed to save script" }, { status: 500 });
  }
};
