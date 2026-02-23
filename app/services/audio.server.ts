/**
 * Audio: ElevenLabs voices + backend proxy for script generation and TTS.
 * - Voices: GET https://api.elevenlabs.io/v1/voices (ELEVENLABS_API_KEY)
 * - Script: POST {BACKEND_URL}/audio/generate-script
 * - Generate: POST {BACKEND_URL}/audio/generate
 */

const LOG_PREFIX = "[Audio Service]";

function getBackendBase(): string {
  const base = process.env.BACKEND_URL;
  if (!base?.trim()) {
    throw new Error("BACKEND_URL is not set in .env");
  }
  return base.replace(/\/$/, "");
}

/** ElevenLabs API: list voices (requires xi-api-key) */
export async function getElevenLabsVoices(): Promise<{
  ok: true;
  voices: Array<{ voice_id: string; name: string; preview_url?: string }>;
} | { ok: false; error: string }> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key?.trim()) {
    return { ok: false, error: "ELEVENLABS_API_KEY is not set in .env" };
  }
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/voices", {
      method: "GET",
      headers: {
        "xi-api-key": key,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(15000),
    });
    const data = (await res.json()) as { voices?: Array<{ voice_id?: string; name?: string; preview_url?: string }>; detail?: { message?: string } };
    if (!res.ok) {
      const msg = data?.detail?.message ?? data?.detail ?? `HTTP ${res.status}`;
      return { ok: false, error: String(msg) };
    }
    const voices = Array.isArray(data.voices)
      ? data.voices
          .filter((v) => v && typeof v.voice_id === "string")
          .map((v) => ({
            voice_id: v.voice_id!,
            name: typeof v.name === "string" ? v.name : v.voice_id!,
            preview_url: typeof v.preview_url === "string" ? v.preview_url : undefined,
          }))
      : [];
    return { ok: true, voices };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`${LOG_PREFIX} getElevenLabsVoices error:`, message);
    return { ok: false, error: message };
  }
}

/** Backend: generate script. Request/response match user spec. Optional product_description is sent for context. */
export async function generateScript(
  voiceId: string,
  userId: string,
  shortId: string,
  productDescription?: string
): Promise<{
  ok: true;
  short_id: string;
  script: string;
  words_per_minute?: number;
  target_duration_seconds?: number;
  message?: string;
} | { ok: false; error: string }> {
  const base = getBackendBase();
  const endpoint = `${base}/audio/generate-script`;
  const payload = {
    voice_id: voiceId,
    user_id: userId,
    short_id: shortId,
    productDescription: typeof productDescription === "string" ? productDescription : "",
  };
  console.log(`${LOG_PREFIX} [script] request voice_id=${voiceId} user_id=${userId} short_id=${shortId} has_product_description=${!!payload.productDescription} -> ${endpoint}`);
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60000),
    });
    const data = (await res.json()) as {
      short_id?: string;
      script?: string;
      words_per_minute?: number;
      target_duration_seconds?: number;
      message?: string;
      error?: string;
    };
    if (!res.ok) {
      console.warn(`${LOG_PREFIX} [script] failed status=${res.status} error=${data?.error ?? "unknown"}`);
      return { ok: false, error: data?.error ?? `HTTP ${res.status}` };
    }
    if (typeof data.script !== "string") {
      console.warn(`${LOG_PREFIX} [script] invalid response: missing script`);
      return { ok: false, error: "Invalid response: missing script" };
    }
    console.log(`${LOG_PREFIX} [script] success short_id=${data.short_id ?? shortId} script_length=${data.script.length} words_per_minute=${data.words_per_minute ?? "—"} target_duration_seconds=${data.target_duration_seconds ?? "—"}`);
    return {
      ok: true,
      short_id: data.short_id ?? shortId,
      script: data.script,
      words_per_minute: data.words_per_minute,
      target_duration_seconds: data.target_duration_seconds,
      message: data.message,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`${LOG_PREFIX} [script] error:`, message);
    return { ok: false, error: message };
  }
}

/** Backend: generate audio from script. Request/response match user spec. */
export async function generateAudio(
  voiceId: string,
  userId: string,
  shortId: string,
  script: string
): Promise<
  | {
      ok: true;
      voice_id: string;
      user_id: string;
      short_id: string;
      audio_url: string;
      script: string;
      words_per_minute?: number;
      duration?: number;
      created_at?: string;
      is_cached?: boolean;
      message?: string;
      subtitle_timing?: Array<{ text: string; start_time: number; end_time: number; duration: number }>;
    }
  | { ok: false; error: string }
> {
  const base = getBackendBase();
  const endpoint = `${base}/audio/generate`;
  console.log(`${LOG_PREFIX} [audio] request voice_id=${voiceId} user_id=${userId} short_id=${shortId} script_length=${script.length} -> ${endpoint}`);
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        voice_id: voiceId,
        user_id: userId,
        short_id: shortId,
        script,
      }),
      signal: AbortSignal.timeout(120000),
    });
    const data = (await res.json()) as {
      voice_id?: string;
      user_id?: string;
      short_id?: string;
      audio_url?: string;
      script?: string;
      words_per_minute?: number;
      duration?: number;
      created_at?: string;
      is_cached?: boolean;
      message?: string;
      subtitle_timing?: Array<{ text: string; start_time: number; end_time: number; duration: number }>;
      error?: string;
    };
    if (!res.ok) {
      console.warn(`${LOG_PREFIX} [audio] failed status=${res.status} error=${data?.error ?? "unknown"}`);
      return { ok: false, error: data?.error ?? `HTTP ${res.status}` };
    }
    if (typeof data.audio_url !== "string") {
      console.warn(`${LOG_PREFIX} [audio] invalid response: missing audio_url`);
      return { ok: false, error: "Invalid response: missing audio_url" };
    }
    console.log(`${LOG_PREFIX} [audio] success audio_url=${data.audio_url} duration=${data.duration ?? "—"} is_cached=${data.is_cached ?? false} subtitle_segments=${data.subtitle_timing?.length ?? 0}`);
    return {
      ok: true,
      voice_id: data.voice_id ?? voiceId,
      user_id: data.user_id ?? userId,
      short_id: data.short_id ?? shortId,
      audio_url: data.audio_url,
      script: data.script ?? script,
      words_per_minute: data.words_per_minute,
      duration: data.duration,
      created_at: data.created_at,
      is_cached: data.is_cached,
      message: data.message,
      subtitle_timing: data.subtitle_timing,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`${LOG_PREFIX} [audio] error:`, message);
    return { ok: false, error: message };
  }
}
