import { severityFor } from "./diagnose";
import { countOn, makeGrid, toMaskGrid } from "./sam";
import type { AnalyzeResult, Lang } from "./types";

/**
 * Canned result used when MODEL_API_KEY is not set, so the UI can be developed
 * offline. The page shows a "demo mode" banner whenever this is returned.
 */
export function demoResult(lang: Lang, width: number, height: number): AnalyzeResult {
  const leaf = makeGrid(width, height);
  const lesion = makeGrid(width, height);
  const { width: gw, height: gh } = leaf;
  const spots = [
    [0.4, 0.4, 0.06],
    [0.58, 0.55, 0.05],
    [0.47, 0.66, 0.04],
    [0.66, 0.36, 0.035],
  ];
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      const nx = x / gw - 0.5;
      const ny = y / gh - 0.5;
      if ((nx * nx) / 0.12 + (ny * ny) / 0.07 < 1) leaf.cells[y * gw + x] = 1;
      for (const [cx, cy, r] of spots) {
        if ((x / gw - cx) ** 2 + (y / gh - cy) ** 2 < r * r) lesion.cells[y * gw + x] = 1;
      }
    }
  }
  const affectedPct = Math.round((countOn(lesion.cells) / countOn(leaf.cells)) * 1000) / 10;
  const vi = lang === "vi";
  return {
    demo: true,
    timings: {},
    measurement: {
      imageWidth: width,
      imageHeight: height,
      leafPct: (countOn(leaf.cells) / leaf.cells.length) * 100,
      lesionPct: (countOn(lesion.cells) / lesion.cells.length) * 100,
      affectedPct,
      lesionCount: spots.length,
      severity: severityFor(affectedPct, false),
      leaf: toMaskGrid(leaf),
      lesion: toMaskGrid(lesion),
      boxes: spots.map(([cx, cy, r]) => ({
        left: (cx - r) * width,
        top: (cy - r) * height,
        right: (cx + r) * width,
        bottom: (cy + r) * height,
        confidence: 0.9,
        prompt: "brown spot",
      })),
    },
    diagnosis: {
      isPlant: true,
      crop: vi ? "Lúa" : "Rice",
      disease: vi ? "Bệnh đạo ôn (dữ liệu mẫu)" : "Rice blast (sample data)",
      scientificName: "Magnaporthe oryzae",
      confidence: 0.82,
      summary: vi
        ? "Đây là kết quả mẫu. Thêm MODEL_API_KEY vào .env.local để chẩn đoán thật bằng Muse Spark và SAM 3.1."
        : "This is sample output. Add MODEL_API_KEY to .env.local to run the real Muse Spark + SAM 3.1 pipeline.",
      symptoms: vi
        ? ["Vết bệnh hình thoi, tâm xám, viền nâu", "Một số vết đã liên kết thành mảng"]
        : ["Diamond-shaped lesions with grey centres and brown margins", "Some lesions merging into patches"],
      causes: vi
        ? "Nấm phát triển mạnh khi trời âm u, ẩm độ cao, bón thừa đạm."
        : "The fungus thrives in cloudy, humid weather and with excess nitrogen.",
      treatment: vi
        ? ["Ngưng bón đạm ngay", "Phun Tricyclazole 75WP theo liều trên nhãn", "Phun lại sau 5–7 ngày nếu vết bệnh còn lan"]
        : ["Stop nitrogen fertiliser now", "Spray Tricyclazole 75WP at the label rate", "Repeat after 5–7 days if lesions keep spreading"],
      organicOptions: vi ? ["Chế phẩm Trichoderma", "Bacillus subtilis"] : ["Trichoderma products", "Bacillus subtilis"],
      prevention: vi
        ? ["Dùng giống kháng", "Sạ thưa, bón cân đối NPK"]
        : ["Use resistant varieties", "Lower seeding density, balanced NPK"],
      urgency: vi ? "Cần xử lý trong 2–3 ngày." : "Act within 2–3 days.",
      plantPrompt: "rice leaf",
      lesionPrompts: ["brown spot"],
    },
  };
}
