import OpenAI from "openai";

export const META_BASE_URL = "https://api.meta.ai/v1";

export const MODELS = {
  vision: process.env.SPARK_MODEL ?? "muse-spark-1.3",
  sam: "sam-3.1",
  transcribe: "muse-voice-transcribe-1.0",
} as const;

export function hasApiKey(): boolean {
  return Boolean(process.env.MODEL_API_KEY);
}

let client: OpenAI | null = null;

export function metaClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      baseURL: META_BASE_URL,
      apiKey: process.env.MODEL_API_KEY,
      maxRetries: 3,
      timeout: 120_000,
    });
  }
  return client;
}

/** Pull the first JSON object out of a model reply (tolerates ```json fences and stray prose). */
export function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Model reply contained no JSON object");
  return JSON.parse(body.slice(start, end + 1)) as T;
}
