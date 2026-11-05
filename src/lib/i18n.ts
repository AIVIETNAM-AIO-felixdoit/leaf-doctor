import type { Lang, Severity } from "./types";

const strings = {
  appName: { vi: "Leaf Doctor", en: "Leaf Doctor" },
  tagline: {
    vi: "Chụp một chiếc lá — biết bệnh gì, nặng bao nhiêu phần trăm, xử lý thế nào.",
    en: "Snap one leaf — know the disease, how much of the leaf is damaged, and what to do.",
  },
  demoBanner: {
    vi: "Chế độ demo: chưa có MODEL_API_KEY nên đang hiển thị dữ liệu mẫu.",
    en: "Demo mode: no MODEL_API_KEY set, showing sample data.",
  },
  pickPhoto: { vi: "Chụp / chọn ảnh lá", en: "Take / choose a leaf photo" },
  changePhoto: { vi: "Đổi ảnh", en: "Change photo" },
  crop: { vi: "Cây trồng (không bắt buộc)", en: "Crop (optional)" },
  cropAuto: { vi: "Tự nhận diện", en: "Auto-detect" },
  note: { vi: "Mô tả thêm (không bắt buộc)", en: "Describe the problem (optional)" },
  notePlaceholder: { vi: "VD: lá vàng mép, lan nhanh sau mưa…", en: "e.g. yellow edges, spreading fast after rain…" },
  record: { vi: "Nói", en: "Speak" },
  stop: { vi: "Dừng", en: "Stop" },
  transcribing: { vi: "Đang nghe…", en: "Transcribing…" },
  analyze: { vi: "Chẩn đoán", en: "Diagnose" },
  analyzing: { vi: "Đang phân tích…", en: "Analyzing…" },
  step1: { vi: "Muse Spark đang chẩn đoán", en: "Muse Spark is diagnosing" },
  step2: { vi: "SAM 3.1 đang khoanh vùng lá và vết bệnh", en: "SAM 3.1 is segmenting leaf and lesions" },
  affected: { vi: "diện tích lá bị hại", en: "of leaf area affected" },
  lesions: { vi: "vết bệnh", en: "lesions" },
  confidence: { vi: "độ tin cậy", en: "confidence" },
  showOverlay: { vi: "Hiện vùng bệnh", en: "Show overlay" },
  legendLeaf: { vi: "Lá", en: "Leaf" },
  legendLesion: { vi: "Vết bệnh", en: "Lesion" },
  symptoms: { vi: "Triệu chứng thấy trong ảnh", en: "Symptoms in this photo" },
  causes: { vi: "Nguyên nhân", en: "Cause" },
  treatment: { vi: "Phác đồ xử lý", en: "Treatment plan" },
  organic: { vi: "Giải pháp sinh học / chi phí thấp", en: "Organic / low-cost options" },
  prevention: { vi: "Phòng ngừa", en: "Prevention" },
  urgency: { vi: "Mức khẩn cấp", en: "Urgency" },
  labelNote: {
    vi: "Luôn đọc kỹ nhãn thuốc và tuân thủ thời gian cách ly. Kết quả chỉ mang tính tham khảo.",
    en: "Always follow the product label and pre-harvest interval. Advisory only.",
  },
  askTitle: { vi: "Hỏi thêm bác sĩ", en: "Ask a follow-up" },
  askPlaceholder: { vi: "VD: Phun lúc nào trong ngày là tốt nhất?", en: "e.g. What time of day should I spray?" },
  send: { vi: "Gửi", en: "Send" },
  history: { vi: "Theo dõi theo thời gian", en: "Progress over time" },
  historyEmpty: {
    vi: "Chưa có lần khám nào. Chụp lại cùng một cây sau vài ngày để xem bệnh giảm hay tăng.",
    en: "No checks yet. Re-scan the same plant after a few days to see if it is improving.",
  },
  clear: { vi: "Xoá", en: "Clear" },
  poweredBy: { vi: "Chạy bằng", en: "Powered by" },
  notPlant: { vi: "Không nhận ra cây trồng trong ảnh.", en: "No plant detected in this photo." },
  samFailed: { vi: "Không đo được vùng bệnh lần này", en: "Segmentation unavailable this time" },
} satisfies Record<string, Record<Lang, string>>;

export type StringKey = keyof typeof strings;

export const t = (lang: Lang, key: StringKey) => strings[key][lang];

export const severityLabel: Record<Severity, Record<Lang, string>> = {
  healthy: { vi: "Khỏe mạnh", en: "Healthy" },
  mild: { vi: "Nhẹ", en: "Mild" },
  moderate: { vi: "Trung bình", en: "Moderate" },
  severe: { vi: "Nặng", en: "Severe" },
};

export const severityColor: Record<Severity, string> = {
  healthy: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200",
  mild: "bg-lime-100 text-lime-800 dark:bg-lime-900/50 dark:text-lime-200",
  moderate: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200",
  severe: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200",
};

export const CROPS: { value: string; vi: string; en: string }[] = [
  { value: "rice", vi: "Lúa", en: "Rice" },
  { value: "coffee", vi: "Cà phê", en: "Coffee" },
  { value: "durian", vi: "Sầu riêng", en: "Durian" },
  { value: "black pepper", vi: "Hồ tiêu", en: "Black pepper" },
  { value: "cassava", vi: "Sắn (khoai mì)", en: "Cassava" },
  { value: "mango", vi: "Xoài", en: "Mango" },
  { value: "citrus", vi: "Cây có múi", en: "Citrus" },
  { value: "tomato", vi: "Cà chua", en: "Tomato" },
  { value: "chili", vi: "Ớt", en: "Chili" },
  { value: "vegetables", vi: "Rau màu", en: "Vegetables" },
];
