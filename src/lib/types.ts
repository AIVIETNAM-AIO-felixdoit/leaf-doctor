export type Lang = "vi" | "en";

export type Severity = "healthy" | "mild" | "moderate" | "severe";

export interface Diagnosis {
  isPlant: boolean;
  crop: string;
  disease: string;
  scientificName: string;
  confidence: number;
  summary: string;
  symptoms: string[];
  causes: string;
  treatment: string[];
  organicOptions: string[];
  prevention: string[];
  urgency: string;
  /** Short English noun phrases handed to SAM 3.1. */
  plantPrompt: string;
  lesionPrompts: string[];
}

/** A binary grid (row-major, 1 byte per cell, base64) at reduced resolution of the source image. */
export interface MaskGrid {
  width: number;
  height: number;
  data: string;
}

export interface LesionBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
  confidence?: number;
  prompt: string;
}

export interface Measurement {
  imageWidth: number;
  imageHeight: number;
  leafPct: number;
  lesionPct: number;
  /** Share of the leaf area covered by lesions — the headline number. */
  affectedPct: number;
  lesionCount: number;
  severity: Severity;
  leaf: MaskGrid | null;
  lesion: MaskGrid | null;
  boxes: LesionBox[];
  /** Set when SAM 3.1 failed entirely; the diagnosis is still usable. */
  error?: string;
}

export interface AnalyzeResult {
  demo: boolean;
  diagnosis: Diagnosis;
  measurement: Measurement;
  timings: Record<string, number>;
}

export interface HistoryEntry {
  id: string;
  date: string;
  crop: string;
  disease: string;
  affectedPct: number;
  severity: Severity;
  thumb: string;
}
