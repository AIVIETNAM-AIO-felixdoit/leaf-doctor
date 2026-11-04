import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { META_BASE_URL, MODELS, hasApiKey } from "@/lib/meta";

export const runtime = "nodejs";

/** Expects multipart form with `audio` (16 kHz mono 16-bit WAV, encoded in the browser) and `lang`. */
export async function POST(req: Request) {
  const limited = rateLimit(req, "transcribe", 60);
  if (limited) return limited;
  const form = await req.formData();
  const audio = form.get("audio");
  const lang = form.get("lang") === "en" ? "English" : "Vietnamese";
  if (!(audio instanceof Blob)) return NextResponse.json({ error: "Missing audio" }, { status: 400 });

  if (!hasApiKey()) {
    return NextResponse.json({
      transcript: lang === "Vietnamese" ? "Lá lúa bị đốm nâu hình thoi, lan nhanh sau mấy ngày mưa." : "Brown diamond-shaped spots on the rice leaves, spreading fast after rain.",
      demo: true,
    });
  }

  const upstream = new FormData();
  upstream.append(
    "request",
    new Blob([JSON.stringify({ mode: "PUSH_TO_TALK", model: MODELS.transcribe, audioEncoding: "WAV", languageBias: [lang] })], {
      type: "application/json",
    }),
  );
  upstream.append("audio", audio, "note.wav");

  const res = await fetch(`${META_BASE_URL}/asr/transcribe`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.MODEL_API_KEY}`, Accept: "application/json" },
    body: upstream,
  });
  if (!res.ok) {
    const detail = await res.text();
    console.error("transcribe failed", res.status, detail);
    return NextResponse.json({ error: `Transcription failed (${res.status})` }, { status: 502 });
  }
  const data = (await res.json()) as { transcript?: string };
  return NextResponse.json({ transcript: data.transcript ?? "" });
}
