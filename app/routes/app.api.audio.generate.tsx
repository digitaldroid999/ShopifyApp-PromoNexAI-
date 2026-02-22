import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { generateAudio } from "../services/audio.server";

/** POST /app/api/audio/generate — proxy to BACKEND_URL/audio/generate */
export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }
  let body: { voice_id?: string; user_id?: string; short_id?: string; script?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const voice_id = typeof body.voice_id === "string" ? body.voice_id.trim() : "";
  const user_id = typeof body.user_id === "string" ? body.user_id.trim() : "";
  const short_id = typeof body.short_id === "string" ? body.short_id.trim() : "";
  const script = typeof body.script === "string" ? body.script.trim() : "";
  if (!voice_id || !user_id || !short_id || !script) {
    return Response.json(
      { error: "voice_id, user_id, short_id, and script are required" },
      { status: 400 }
    );
  }
  const result = await generateAudio(voice_id, user_id, short_id, script);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json(result);
};

export default function AudioGenerateRoute() {
  return null;
}
