import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { getElevenLabsVoices } from "../services/audio.server";

/** GET /app/api/audio/voices — returns list of voices from ElevenLabs */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const result = await getElevenLabsVoices();
  if (!result.ok) {
    return Response.json({ success: false, error: result.error, voices: [] }, { status: 400 });
  }
  return Response.json({ success: true, voices: result.voices });
};
