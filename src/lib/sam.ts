import { decodeMaskToRaster, parseImageStream, recordsOfKind } from "@meta-sam/parser";
import { MODELS, metaClient } from "./meta";
import type { LesionBox, MaskGrid } from "./types";

/** Grid resolution used for area maths and the overlay (long side, in cells). */
const GRID_LONG_SIDE = 512;

export interface Grid {
  width: number;
  height: number;
  cells: Uint8Array;
}

export function makeGrid(imageWidth: number, imageHeight: number): Grid {
  const scale = GRID_LONG_SIDE / Math.max(imageWidth, imageHeight);
  const width = Math.max(1, Math.round(imageWidth * scale));
  const height = Math.max(1, Math.round(imageHeight * scale));
  return { width, height, cells: new Uint8Array(width * height) };
}

export interface SegmentResult {
  /** Union of every instance. */
  grid: Grid;
  /** One grid per detected instance, so callers can pick e.g. only the leaves that carry lesions. */
  instances: Grid[];
  boxes: LesionBox[];
  count: number;
}

/**
 * Segment one concept with SAM 3.1 and rasterise every returned mask onto a
 * shared low-res grid, so overlapping detections are counted once.
 */
export async function segment(
  imageDataUrl: string,
  prompt: string,
  imageWidth: number,
  imageHeight: number,
): Promise<SegmentResult> {
  const stream = await openSamStream(imageDataUrl, prompt);
  const parsed = parseImageStream(stream as AsyncIterable<{ type: string }>);
  const result = await parsed.finalResult;

  const grid = makeGrid(imageWidth, imageHeight);
  const instances: Grid[] = [];
  const boxes: LesionBox[] = [];
  const cellW = imageWidth / grid.width;
  const cellH = imageHeight / grid.height;

  for (const record of recordsOfKind(result.records, "mask")) {
    const { left, top, right, bottom } = record.bounds;
    const { width: mw, height: mh } = record.mask;
    if (mw <= 0 || mh <= 0 || right <= left || bottom <= top) continue;
    const raster = decodeMaskToRaster(record.mask);
    boxes.push({ left, top, right, bottom, confidence: record.confidence, prompt });
    const instance = makeGrid(imageWidth, imageHeight);
    instances.push(instance);

    const gx0 = Math.max(0, Math.floor(left / cellW));
    const gx1 = Math.min(grid.width, Math.ceil(right / cellW));
    const gy0 = Math.max(0, Math.floor(top / cellH));
    const gy1 = Math.min(grid.height, Math.ceil(bottom / cellH));
    for (let gy = gy0; gy < gy1; gy++) {
      const sy = (gy + 0.5) * cellH;
      if (sy < top || sy >= bottom) continue;
      const my = Math.min(mh - 1, Math.floor(((sy - top) / (bottom - top)) * mh));
      for (let gx = gx0; gx < gx1; gx++) {
        const sx = (gx + 0.5) * cellW;
        if (sx < left || sx >= right) continue;
        const mx = Math.min(mw - 1, Math.floor(((sx - left) / (right - left)) * mw));
        if (raster[my * mw + mx]) {
          grid.cells[gy * grid.width + gx] = 1;
          instance.cells[gy * grid.width + gx] = 1;
        }
      }
    }
  }

  return { grid, instances, boxes, count: boxes.length };
}

async function openSamStream(imageDataUrl: string, prompt: string) {
  const client = metaClient();
  const create = (image: { image_url: string } | { file_id: string }) =>
    client.responses.create({
      model: MODELS.sam,
      input: [
        {
          type: "message",
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            { type: "input_image", detail: "auto", ...image } as never,
          ],
        },
      ],
      stream: true,
      metadata: { mask_encoding: "one_bit", include_confidence: "true" },
    });

  try {
    return await create({ image_url: imageDataUrl });
  } catch (err) {
    // Some deployments only accept hosted images for SAM; fall back to the Files API.
    const fileId = await uploadImage(imageDataUrl);
    try {
      return await create({ file_id: fileId });
    } catch {
      throw err;
    }
  }
}

const uploadCache = new Map<string, string>();

async function uploadImage(imageDataUrl: string): Promise<string> {
  const key = imageDataUrl.slice(-64) + imageDataUrl.length;
  const cached = uploadCache.get(key);
  if (cached) return cached;
  const match = imageDataUrl.match(/^data:(image\/[a-z+]+);base64,(.*)$/);
  if (!match) throw new Error("Expected a base64 image data URL");
  const bytes = Buffer.from(match[2], "base64");
  const ext = match[1].split("/")[1];
  const file = await metaClient().files.create({
    file: new File([bytes], `leaf.${ext}`, { type: match[1] }),
    purpose: "user_data",
  });
  uploadCache.set(key, file.id);
  return file.id;
}

export function union(a: Grid, b: Grid): Grid {
  const cells = new Uint8Array(a.cells.length);
  for (let i = 0; i < cells.length; i++) cells[i] = a.cells[i] | b.cells[i];
  return { ...a, cells };
}

export function countOn(cells: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < cells.length; i++) n += cells[i];
  return n;
}

export function countBoth(a: Uint8Array, b: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < a.length; i++) n += a[i] & b[i];
  return n;
}

export function toMaskGrid(grid: Grid): MaskGrid {
  return {
    width: grid.width,
    height: grid.height,
    data: Buffer.from(grid.cells).toString("base64"),
  };
}
