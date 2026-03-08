import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { testTestAudio } from "../services/audio.server";

/** POST /app/api/audio/test-audio — proxy to BACKEND_URL/audio/test-audio */
export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }
  let body: { voice_id?: string; language?: string; user_id?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const voice_id = typeof body.voice_id === "string" ? body.voice_id.trim() : "";
  const language = typeof body.language === "string" ? body.language.trim() : "en-US";
  const user_id = typeof body.user_id === "string" ? body.user_id.trim() : "";
  if (!voice_id || !user_id) {
    return Response.json(
      { error: "voice_id and user_id are required" },
      { status: 400 }
    );
  }
  const result = await testTestAudio(voice_id, language, user_id);
  if ("ok" in result && result.ok === false) {
    return Response.json({ error: result.error }, { status: 500 });
  }
  return Response.json(result);
};
