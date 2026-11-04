import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { diagnose, severityFor } from "@/lib/diagnose";
import { hasApiKey } from "@/lib/meta";
import { demoResult } from "@/lib/demo";
import { countBoth, countOn, makeGrid, segment, toMaskGrid, union, type Grid, type SegmentResult } from "@/lib/sam";
import type { AnalyzeResult, Lang, LesionBox, Measurement } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface AnalyzeBody {
  image: string;
  width: number;
  height: number;
  lang?: Lang;
  crop?: string;
  note?: string;
}

export async function POST(req: Request) {
  const limited = rateLimit(req, "analyze", 30);
  if (limited) return limited;
  const body = (await req.json()) as AnalyzeBody;
  const lang: Lang = body.lang === "en" ? "en" : "vi";
  if (!body.image?.startsWith("data:image/") || !body.width || !body.height) {
    return NextResponse.json({ error: "Missing image" }, { status: 400 });
  }

  if (!hasApiKey()) {
    return NextResponse.json(demoResult(lang, body.width, body.height));
  }

  const timings: Record<string, number> = {};
  const t0 = Date.now();
  const timed = <T,>(label: string, p: Promise<T>) =>
    p.finally(() => {
      timings[label] = Date.now() - t0;
    });

  // SAM can start on the generic "leaf" concept while Muse Spark is still diagnosing.
  const leafPromise = timed("sam_leaf", safeSegment(body, "leaf"));

  try {
    const diagnosis = await timed("spark_diagnosis", diagnose(body.image, { lang, crop: body.crop, note: body.note }));
    if (!diagnosis.isPlant) {
      return NextResponse.json({ error: lang === "vi" ? "Ảnh không phải cây trồng." : "This photo doesn't look like a plant." }, { status: 422 });
    }

    const extraPlant =
      diagnosis.plantPrompt && !/\bleaf\b|\bleaves\b/i.test(diagnosis.plantPrompt) && diagnosis.plantPrompt !== "leaf"
        ? timed("sam_plant", safeSegment(body, diagnosis.plantPrompt))
        : Promise.resolve(null);
    const lesionPromises = diagnosis.lesionPrompts.map((p, i) => timed(`sam_lesion_${i}`, safeSegment(body, p)));

    const [leaf, plant, ...lesions] = await Promise.all([leafPromise, extraPlant, ...lesionPromises]);
    // SAM is sensitive to wording; if the model's phrases found nothing on a sick plant, "spot" is the most robust fallback.
    if (diagnosis.lesionPrompts.length && !lesions.some((s) => ok(s) && s.count > 0)) {
      lesions.push(await timed("sam_lesion_fallback", safeSegment(body, "spot")));
    }
    const measurement = measure(body.width, body.height, [leaf, plant], lesions, diagnosis.disease);
    timings.total = Date.now() - t0;

    const result: AnalyzeResult = { demo: false, diagnosis, measurement, timings };
    return NextResponse.json(result);
  } catch (err) {
    console.error("analyze failed", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

async function safeSegment(body: AnalyzeBody, prompt: string): Promise<SegmentResult | { error: string }> {
  try {
    return await segment(body.image, prompt, body.width, body.height);
  } catch (err) {
    console.error(`SAM "${prompt}" failed`, err);
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

type Seg = SegmentResult | { error: string } | null;
const ok = (s: Seg): s is SegmentResult => !!s && "grid" in s;

function measure(width: number, height: number, plantSegs: Seg[], lesionSegs: Seg[], disease: string): Measurement {
  const empty = makeGrid(width, height);
  const merge = (grids: Grid[]): Grid => grids.reduce((g, s) => union(g, s), empty);
  const lesion = merge(lesionSegs.filter(ok).map((s) => s.grid));

  // "leaf" also finds background leaves; only the ones carrying lesions are the patient.
  // With no lesions (healthy plant), fall back to the largest leaf.
  const leafInstances = plantSegs.filter(ok).flatMap((s) => s.instances);
  const sick = leafInstances.filter((g) => countBoth(g.cells, lesion.cells) > 0);
  const largest = leafInstances.reduce<Grid | null>((best, g) => (!best || countOn(g.cells) > countOn(best.cells) ? g : best), null);
  const leaf = merge(sick.length ? sick : largest ? [largest] : []);
  const boxes: LesionBox[] = lesionSegs.filter(ok).flatMap((s) => s.boxes);

  // Lesions sometimes fall outside the leaf mask at the edges, so the plant area is leaf ∪ lesion.
  const total = leaf.cells.length;
  const leafOn = countOn(leaf.cells);
  const lesionOn = countOn(lesion.cells);
  const plantArea = leafOn + lesionOn - countBoth(leaf.cells, lesion.cells);
  const affectedPct = plantArea > 0 ? (lesionOn / plantArea) * 100 : 0;
  const healthy = /healthy|khỏe|khoẻ|bình thường/i.test(disease);

  const errors = [...plantSegs, ...lesionSegs].filter((s): s is { error: string } => !!s && "error" in s);
  return {
    imageWidth: width,
    imageHeight: height,
    leafPct: (leafOn / total) * 100,
    lesionPct: (lesionOn / total) * 100,
    affectedPct: round1(affectedPct),
    lesionCount: boxes.length,
    severity: severityFor(affectedPct, healthy),
    leaf: leafOn ? toMaskGrid(leaf) : null,
    lesion: lesionOn ? toMaskGrid(lesion) : null,
    boxes,
    ...(errors.length && !leafOn && !lesionOn ? { error: errors[0].error } : {}),
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;
