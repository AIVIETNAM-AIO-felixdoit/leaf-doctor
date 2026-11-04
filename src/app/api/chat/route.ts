import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { MODELS, hasApiKey, metaClient } from "@/lib/meta";
import type { Diagnosis, Lang, Measurement } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ChatBody {
  lang: Lang;
  diagnosis: Diagnosis;
  measurement: Pick<Measurement, "affectedPct" | "severity" | "lesionCount">;
  messages: { role: "user" | "assistant"; content: string }[];
}

/** Follow-up questions about an existing diagnosis, streamed back as plain text. */
export async function POST(req: Request) {
  const limited = rateLimit(req, "chat", 60);
  if (limited) return limited;
  const body = (await req.json()) as ChatBody;
  const vi = body.lang !== "en";

  if (!hasApiKey()) {
    return new Response(vi ? "(Chế độ demo) Thêm MODEL_API_KEY để hỏi đáp với Muse Spark." : "(Demo mode) Add MODEL_API_KEY to chat with Muse Spark.");
  }

  const context = `You are a friendly plant doctor helping a smallholder farmer. Answer in ${vi ? "Vietnamese" : "English"}, briefly (under 120 words), concretely, with safety notes for pesticides when relevant.
Current case: ${JSON.stringify({ ...body.diagnosis, plantPrompt: undefined, lesionPrompts: undefined })}
Measured by SAM 3.1 segmentation: ${body.measurement.affectedPct}% of leaf area affected, ${body.measurement.lesionCount} lesions, severity "${body.measurement.severity}".`;

  try {
    const stream = await metaClient().chat.completions.create({
      model: MODELS.vision,
      reasoning_effort: "low",
      stream: true,
      messages: [{ role: "developer", content: context }, ...body.messages.slice(-10)],
    } as never);

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream as unknown as AsyncIterable<{ choices: { delta?: { content?: string } }[] }>) {
            const text = chunk.choices[0]?.delta?.content;
            if (text) controller.enqueue(encoder.encode(text));
          }
        } finally {
          controller.close();
        }
      },
    });
    return new Response(readable, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  } catch (err) {
    console.error("chat failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
