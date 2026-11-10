const GNANI_TTS_URL = "https://api.vachana.ai/api/v1/tts/inference";
const MODEL = "timbre-v3.0";
const DEFAULT_VOICE = "Shubham";
const MAX_TEXT_LENGTH = 4_000;

const VOICES = new Set([
  "Avinash",
  "Devansh",
  "Harshad",
  "Prakash",
  "Shubham",
  "Yashraj",
]);

const LANGUAGES = new Set([
  "auto",
  "hi-IN",
  "en-IN",
  "ta-IN",
  "te-IN",
  "kn-IN",
  "ml-IN",
  "mr-IN",
  "pa-IN",
  "bn-IN",
  "gu-IN",
]);

type JsonRecord = Record<string, unknown>;

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorResponse(message: string, status: number) {
  return Response.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const apiKey = process.env.GNANI_API_KEY;
  if (!apiKey) {
    return errorResponse("Gnani is not configured on the server.", 503);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Send a valid JSON request body.", 400);
  }

  if (!isJsonRecord(body)) {
    return errorResponse("Send a JSON object with a text field.", 400);
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const voice = typeof body.voice === "string" ? body.voice : DEFAULT_VOICE;
  const language = typeof body.language === "string" ? body.language : "auto";

  if (!text) {
    return errorResponse("The text field is required.", 400);
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return errorResponse("The text is too long to synthesize.", 413);
  }
  if (!VOICES.has(voice)) {
    return errorResponse("Choose a supported Timbre v3.0 male voice.", 400);
  }
  if (!LANGUAGES.has(language)) {
    return errorResponse("Choose a supported language or use auto.", 400);
  }

  try {
    const upstream = await fetch(GNANI_TTS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key-ID": apiKey,
      },
      body: JSON.stringify({
        text,
        voice,
        model: MODEL,
        language,
        audio_config: {
          sample_rate: 48_000,
          num_channels: 1,
          sample_width: 2,
          encoding: "linear_pcm",
          container: "wav",
        },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });

    if (!upstream.ok) {
      console.error("Gnani TTS request failed with status", upstream.status);
      if (upstream.status === 429) {
        return errorResponse(
          "Gnani is rate-limiting this request or its quota is unavailable. Wait and check your Gnani dashboard before trying again.",
          429,
        );
      }
      if (upstream.status === 401 || upstream.status === 403) {
        return errorResponse(
          "Gnani rejected the API key. Check the local Gnani key configuration without sharing the key.",
          502,
        );
      }
      return errorResponse("Gnani could not synthesize this audio.", 502);
    }

    const audio = await upstream.arrayBuffer();
    const contentType = upstream.headers.get("content-type") ?? "audio/wav";
    if (!contentType.startsWith("audio/")) {
      return errorResponse("Gnani returned an unexpected audio response.", 502);
    }

    return new Response(audio, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": 'inline; filename="namma-macha-fm-broadcast.wav"',
        "Content-Type": contentType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return errorResponse("Audio generation failed. Try again in a moment.", 502);
  }
}
