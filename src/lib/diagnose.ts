import { MODELS, extractJson, metaClient } from "./meta";
import type { Diagnosis, Lang, Severity } from "./types";

const LANG_NAME: Record<Lang, string> = { vi: "Vietnamese", en: "English" };

function systemPrompt(lang: Lang) {
  return `You are an experienced plant pathologist and agricultural extension officer working with smallholder farmers in Southeast Asia (rice, coffee, durian, pepper, cassava, fruit trees, vegetables).

Look at the photo and diagnose the most likely disease, pest damage or nutrient deficiency. Be practical: farmers will act on your advice.

Reply with ONE JSON object and nothing else, using exactly these keys:
{
  "isPlant": boolean,              // false if the photo is not a plant
  "crop": string,                  // crop name
  "disease": string,               // common name, or "Healthy"
  "scientificName": string,        // pathogen / pest scientific name, "" if healthy or unknown
  "confidence": number,            // 0..1
  "summary": string,               // 1-2 sentences a farmer understands
  "symptoms": string[],            // visible symptoms you see in THIS photo
  "causes": string,                // why it happens, conditions that favour it
  "treatment": string[],           // ordered, concrete steps with active ingredient names and typical dosage per 16-litre sprayer where relevant; say to follow the product label
  "organicOptions": string[],      // low-cost / biological alternatives
  "prevention": string[],
  "urgency": string,               // what happens if untreated and how fast to act
  "plantPrompt": string,           // ENGLISH short noun phrase for a segmentation model to find the plant tissue, e.g. "leaf", "rice leaf", "coffee leaf", "fruit"
  "lesionPrompts": string[]        // 1-2 ENGLISH short noun phrases for a segmentation model to find the damaged areas, e.g. "brown spot", "yellow patch", "white powder"; [] if healthy
}

Write every human-readable string value in ${LANG_NAME[lang]}. plantPrompt and lesionPrompts must stay in English, be 1-3 words each, and must not contain commas.`;
}

export async function diagnose(
  imageDataUrl: string,
  opts: { lang: Lang; crop?: string; note?: string },
): Promise<Diagnosis> {
  const hints = [
    opts.crop ? `The farmer says the crop is: ${opts.crop}.` : "",
    opts.note ? `The farmer describes the problem: "${opts.note}"` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const completion = await metaClient().chat.completions.create({
    model: MODELS.vision,
    reasoning_effort: "low",
    messages: [
      { role: "developer", content: systemPrompt(opts.lang) },
      {
        role: "user",
        content: [
          { type: "text", text: hints || "Diagnose this plant." },
          { type: "image_url", image_url: { url: imageDataUrl } },
        ],
      },
    ],
  } as never);

  const text = (completion as { choices: { message: { content: string | null } }[] }).choices[0]
    ?.message?.content;
  if (!text) throw new Error("Empty reply from Muse Spark");
  const d = extractJson<Partial<Diagnosis>>(text);
  return normalize(d);
}

function normalize(d: Partial<Diagnosis>): Diagnosis {
  const arr = (v: unknown) => (Array.isArray(v) ? v.map(String).filter(Boolean) : []);
  const cleanPrompt = (p: string) => p.replace(/[,;+]/g, " ").trim().split(/\s+/).slice(0, 3).join(" ");
  return {
    isPlant: d.isPlant !== false,
    crop: String(d.crop ?? ""),
    disease: String(d.disease ?? ""),
    scientificName: String(d.scientificName ?? ""),
    confidence: Math.min(1, Math.max(0, Number(d.confidence ?? 0.5))),
    summary: String(d.summary ?? ""),
    symptoms: arr(d.symptoms),
    causes: String(d.causes ?? ""),
    treatment: arr(d.treatment),
    organicOptions: arr(d.organicOptions),
    prevention: arr(d.prevention),
    urgency: String(d.urgency ?? ""),
    plantPrompt: cleanPrompt(String(d.plantPrompt || "leaf")) || "leaf",
    lesionPrompts: arr(d.lesionPrompts).map(cleanPrompt).filter(Boolean).slice(0, 2),
  };
}

export function severityFor(affectedPct: number, healthy: boolean): Severity {
  if (healthy && affectedPct < 3) return "healthy";
  if (affectedPct < 10) return "mild";
  if (affectedPct < 25) return "moderate";
  return "severe";
}
