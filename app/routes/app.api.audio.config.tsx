import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

/** GET /app/api/audio/config — returns backend base URL for audio playback (e.g. audio_url is path relative to this) */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const backendUrl = process.env.BACKEND_URL?.replace(/\/$/, "") ?? "";
  return Response.json({ backendUrl });
};

export default function AudioConfigRoute() {
  return null;
}
