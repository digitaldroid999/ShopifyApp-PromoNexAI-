import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { getElevenLabsVoices } from "../services/audio.server";
import { getCredits } from "../lib/credits.server";

const STANDARD_VOICES_LIMIT = 5;
const PREMIUM_VOICES_LIMIT = 50;

/** GET /app/api/audio/voices — returns list of voices from ElevenLabs. 5 voices for standard, 50 for Premium Voices. */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = (session as { shop?: string }).shop ?? "";
  const limit = shop ? (await getCredits(shop)).isPremiumVoices ? PREMIUM_VOICES_LIMIT : STANDARD_VOICES_LIMIT : STANDARD_VOICES_LIMIT;

  const result = await getElevenLabsVoices();
  if (!result.ok) {
    return Response.json({ success: false, error: result.error, voices: [] }, { status: 400 });
  }
  const voices = Array.isArray(result.voices) ? result.voices.slice(0, limit) : [];
  return Response.json({ success: true, voices });
};
