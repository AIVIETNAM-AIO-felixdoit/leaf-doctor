"use client";

import { useEffect, useRef } from "react";
import type { Measurement, MaskGrid } from "@/lib/types";

const LEAF_RGBA: [number, number, number, number] = [34, 197, 94, 70];
const LESION_RGBA: [number, number, number, number] = [239, 68, 68, 170];

function decode(grid: MaskGrid): Uint8Array {
  const bin = atob(grid.data);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Photo with SAM 3.1 leaf (green) and lesion (red) masks painted on top. */
export function MaskOverlay({ src, measurement, show }: { src: string; measurement: Measurement | null; show: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const grid = measurement?.leaf ?? measurement?.lesion;
    if (!measurement || !grid) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    canvas.width = grid.width;
    canvas.height = grid.height;
    const img = ctx.createImageData(grid.width, grid.height);
    const leaf = measurement.leaf ? decode(measurement.leaf) : null;
    const lesion = measurement.lesion ? decode(measurement.lesion) : null;
    for (let i = 0; i < grid.width * grid.height; i++) {
      const rgba = lesion?.[i] ? LESION_RGBA : leaf?.[i] ? LEAF_RGBA : null;
      if (rgba) img.data.set(rgba, i * 4);
    }
    ctx.putImageData(img, 0, 0);
  }, [measurement]);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-black/5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="block w-full" />
      <canvas
        ref={canvasRef}
        className={`pointer-events-none absolute inset-0 h-full w-full transition-opacity duration-500 ${show ? "opacity-100" : "opacity-0"}`}
        style={{ imageRendering: "auto" }}
      />
    </div>
  );
}
