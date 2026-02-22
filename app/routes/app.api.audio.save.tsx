import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

/** POST /app/api/audio/save — save generated audio URL and subtitles to AudioInfo */
export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }
  let body: {
    short_id?: string;
    generated_audio_url?: string;
    subtitles?: unknown;
    voice_id?: string;
    voice_name?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const shortId = typeof body.short_id === "string" ? body.short_id.trim() : "";
  if (!shortId) {
    return Response.json({ error: "short_id is required" }, { status: 400 });
  }
  const generatedAudioUrl =
    typeof body.generated_audio_url === "string" ? body.generated_audio_url.trim() || null : null;
  const subtitles = body.subtitles != null ? body.subtitles : null;
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
        generatedAudioUrl: generatedAudioUrl ?? undefined,
        subtitles: subtitles != null ? (subtitles as object) : undefined,
        voiceId: voiceId ?? undefined,
        voiceName: voiceName ?? undefined,
        status: "ready",
      },
      update: {
        ...(generatedAudioUrl !== null && { generatedAudioUrl }),
        ...(subtitles !== null && { subtitles: subtitles as object }),
        ...(voiceId !== null && { voiceId }),
        ...(voiceName !== null && { voiceName }),
        status: "ready",
      },
    });
    return Response.json({ success: true, message: "Audio saved" });
  } catch (e) {
    console.error("[app.api.audio.save]", e);
    return Response.json({ error: "Failed to save audio" }, { status: 500 });
  }
};

export default function AudioSaveRoute() {
  return null;
}
