"use client";

import { useEffect, useRef, useState } from "react";
import { FollowUpChat } from "@/components/FollowUpChat";
import { MaskOverlay } from "@/components/MaskOverlay";
import { VoiceButton } from "@/components/VoiceButton";
import { loadImage, thumbnail } from "@/lib/client-media";
import { CROPS, severityColor, severityLabel, t } from "@/lib/i18n";
import type { AnalyzeResult, HistoryEntry, Lang } from "@/lib/types";

const HISTORY_KEY = "leaf-doctor-history";

function readHistory(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeHistory(entries: HistoryEntry[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, 20)));
  } catch {
    /* storage unavailable */
  }
}

export default function Home() {
  const [lang, setLang] = useState<Lang>("vi");
  const [photo, setPhoto] = useState<{ dataUrl: string; width: number; height: number } | null>(null);
  const [crop, setCrop] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [showOverlay, setShowOverlay] = useState(true);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHistory(readHistory());
    try {
      const saved = localStorage.getItem("leaf-doctor-lang");
      if (saved === "en" || saved === "vi") setLang(saved);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!busy) return;
    const start = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - start), 200);
    return () => clearInterval(id);
  }, [busy]);

  function switchLang(next: Lang) {
    setLang(next);
    try {
      localStorage.setItem("leaf-doctor-lang", next);
    } catch {
      /* ignore */
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setResult(null);
    setError(null);
    setPhoto(await loadImage(file));
  }

  async function analyze() {
    if (!photo) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: photo.dataUrl, width: photo.width, height: photo.height, lang, crop, note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      const r = data as AnalyzeResult;
      setResult(r);
      setShowOverlay(true);
      const entry: HistoryEntry = {
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        crop: r.diagnosis.crop,
        disease: r.diagnosis.disease,
        affectedPct: r.measurement.affectedPct,
        severity: r.measurement.severity,
        thumb: await thumbnail(photo.dataUrl),
      };
      const next = [entry, ...history];
      setHistory(next);
      writeHistory(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const d = result?.diagnosis;
  const m = result?.measurement;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-6 sm:px-6">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
            <span aria-hidden>🌿</span> {t(lang, "appName")}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-[var(--dim)] sm:text-base">{t(lang, "tagline")}</p>
        </div>
        <div className="flex shrink-0 overflow-hidden rounded-xl border border-[var(--line)] text-sm">
          {(["vi", "en"] as const).map((l) => (
            <button
              key={l}
              onClick={() => switchLang(l)}
              className={`px-3 py-1.5 font-medium ${lang === l ? "bg-[var(--accent)] text-white" : "hover:bg-[var(--muted)]"}`}
            >
              {l === "vi" ? "VI" : "EN"}
            </button>
          ))}
        </div>
      </header>

      {result?.demo && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          {t(lang, "demoBanner")}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* Left: input */}
        <section className="space-y-4">
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          {photo ? (
            <div className="space-y-2">
              <MaskOverlay src={photo.dataUrl} measurement={m ?? null} show={showOverlay} />
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <button onClick={() => fileRef.current?.click()} className="font-medium text-[var(--accent)] hover:underline">
                  {t(lang, "changePhoto")}
                </button>
                {m && (m.leaf || m.lesion) && (
                  <div className="flex items-center gap-3 text-[var(--dim)]">
                    <span className="flex items-center gap-1">
                      <i className="inline-block h-3 w-3 rounded-sm bg-green-500/60" /> {t(lang, "legendLeaf")}
                    </span>
                    <span className="flex items-center gap-1">
                      <i className="inline-block h-3 w-3 rounded-sm bg-red-500/80" /> {t(lang, "legendLesion")}
                    </span>
                    <label className="flex cursor-pointer items-center gap-1">
                      <input type="checkbox" checked={showOverlay} onChange={(e) => setShowOverlay(e.target.checked)} />
                      {t(lang, "showOverlay")}
                    </label>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[var(--line)] bg-[var(--card)] text-[var(--dim)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                <path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L17 6h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z" />
                <circle cx="12" cy="13" r="3.5" />
              </svg>
              <span className="font-medium">{t(lang, "pickPhoto")}</span>
            </button>
          )}

          <div className="space-y-3 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">{t(lang, "crop")}</span>
              <select
                value={crop}
                onChange={(e) => setCrop(e.target.value)}
                className="w-full rounded-xl border border-[var(--line)] bg-transparent px-3 py-2 outline-none focus:border-[var(--accent)]"
              >
                <option value="">{t(lang, "cropAuto")}</option>
                {CROPS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c[lang]}
                  </option>
                ))}
              </select>
            </label>
            <div className="text-sm">
              <span className="mb-1 block font-medium">{t(lang, "note")}</span>
              <div className="flex gap-2">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder={t(lang, "notePlaceholder")}
                  className="min-w-0 flex-1 resize-none rounded-xl border border-[var(--line)] bg-transparent px-3 py-2 outline-none focus:border-[var(--accent)]"
                />
                <VoiceButton lang={lang} onText={(text) => setNote((n) => (n ? `${n} ${text}` : text))} />
              </div>
            </div>
            <button
              onClick={analyze}
              disabled={!photo || busy}
              className="w-full rounded-xl bg-[var(--accent)] py-3 font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-50"
            >
              {busy ? `${t(lang, "analyzing")} ${(elapsed / 1000).toFixed(1)}s` : t(lang, "analyze")}
            </button>
            {busy && (
              <ol className="space-y-1 text-sm text-[var(--dim)]">
                <li className="flex items-center gap-2">
                  <Spinner /> {t(lang, "step1")}
                </li>
                <li className="flex items-center gap-2">
                  <Spinner /> {t(lang, "step2")}
                </li>
              </ol>
            )}
            {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
          </div>
        </section>

        {/* Right: results */}
        <section className="space-y-4">
          {d && m ? (
            <>
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-[var(--dim)]">{d.crop}</p>
                    <h2 className="text-xl font-bold leading-tight sm:text-2xl">{d.disease}</h2>
                    {d.scientificName && <p className="text-sm italic text-[var(--dim)]">{d.scientificName}</p>}
                  </div>
                  <span className={`rounded-full px-3 py-1 text-sm font-semibold ${severityColor[m.severity]}`}>
                    {severityLabel[m.severity][lang]}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <Stat value={m.error ? "—" : `${m.affectedPct}%`} label={t(lang, "affected")} strong />
                  <Stat value={m.error ? "—" : String(m.lesionCount)} label={t(lang, "lesions")} />
                  <Stat value={`${Math.round(d.confidence * 100)}%`} label={t(lang, "confidence")} />
                </div>
                {!m.error && (
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--muted)]">
                    <div className="h-full rounded-full bg-gradient-to-r from-lime-500 via-amber-500 to-red-600" style={{ width: `${Math.min(100, m.affectedPct * 2)}%` }} />
                  </div>
                )}
                {m.error && <p className="mt-2 text-xs text-[var(--dim)]">{t(lang, "samFailed")}: {m.error}</p>}
                <p className="mt-4 leading-relaxed">{d.summary}</p>
              </div>

              <Card title={t(lang, "treatment")} accent>
                <ol className="list-decimal space-y-1.5 pl-5">
                  {d.treatment.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
                <p className="mt-3 text-xs text-[var(--dim)]">⚠️ {t(lang, "labelNote")}</p>
              </Card>
              {d.urgency && (
                <Card title={t(lang, "urgency")}>
                  <p>{d.urgency}</p>
                </Card>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <Card title={t(lang, "symptoms")}>
                  <Bullets items={d.symptoms} />
                </Card>
                <Card title={t(lang, "causes")}>
                  <p>{d.causes}</p>
                </Card>
                <Card title={t(lang, "organic")}>
                  <Bullets items={d.organicOptions} />
                </Card>
                <Card title={t(lang, "prevention")}>
                  <Bullets items={d.prevention} />
                </Card>
              </div>
              <FollowUpChat key={JSON.stringify(d).length + m.affectedPct} lang={lang} result={result!} />
            </>
          ) : (
            <HowItWorks lang={lang} />
          )}

          <section className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">{t(lang, "history")}</h3>
              {history.length > 0 && (
                <button
                  onClick={() => {
                    setHistory([]);
                    writeHistory([]);
                  }}
                  className="text-xs text-[var(--dim)] hover:underline"
                >
                  {t(lang, "clear")}
                </button>
              )}
            </div>
            {history.length === 0 ? (
              <p className="text-sm text-[var(--dim)]">{t(lang, "historyEmpty")}</p>
            ) : (
              <ul className="space-y-2">
                {history.map((h, i) => {
                  const prev = history[i + 1];
                  const delta = prev && prev.disease === h.disease ? h.affectedPct - prev.affectedPct : null;
                  return (
                    <li key={h.id} className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={h.thumb} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{h.disease}</p>
                        <p className="text-xs text-[var(--dim)]">
                          {h.crop} · {new Date(h.date).toLocaleString(lang === "vi" ? "vi-VN" : "en-US", { dateStyle: "short", timeStyle: "short" })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold tabular-nums">{h.affectedPct}%</p>
                        {delta !== null && Math.abs(delta) >= 0.5 && (
                          <p className={`text-xs tabular-nums ${delta > 0 ? "text-red-600" : "text-emerald-600"}`}>
                            {delta > 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </section>
      </div>

      <footer className="mt-10 text-center text-xs text-[var(--dim)]">
        {t(lang, "poweredBy")} Muse Spark · SAM 3.1 · Muse Voice Transcribe — Meta Model API
      </footer>
    </main>
  );
}

function Spinner() {
  return <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />;
}

function Stat({ value, label, strong }: { value: string; label: string; strong?: boolean }) {
  return (
    <div className="rounded-xl bg-[var(--muted)] px-2 py-3">
      <p className={`font-bold tabular-nums ${strong ? "text-2xl text-[var(--accent)] sm:text-3xl" : "text-xl sm:text-2xl"}`}>{value}</p>
      <p className="mt-0.5 text-xs leading-tight text-[var(--dim)]">{label}</p>
    </div>
  );
}

function Card({ title, children, accent }: { title: string; children: React.ReactNode; accent?: boolean }) {
  return (
    <section className={`rounded-2xl border bg-[var(--card)] p-4 text-sm leading-relaxed sm:p-5 ${accent ? "border-[var(--accent)]" : "border-[var(--line)]"}`}>
      <h3 className="mb-2 text-base font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5">
      {items.map((s, i) => (
        <li key={i}>{s}</li>
      ))}
    </ul>
  );
}

function HowItWorks({ lang }: { lang: Lang }) {
  const steps =
    lang === "vi"
      ? [
          ["📷", "Chụp lá bệnh", "Một tấm ảnh bằng điện thoại, không cần thiết bị gì thêm."],
          ["🧠", "Muse Spark chẩn đoán", "Nhận diện cây, bệnh, nguyên nhân và lập phác đồ xử lý bằng tiếng Việt."],
          ["🎯", "SAM 3.1 đo vùng bệnh", "Khoanh từng vết bệnh và chiếc lá theo pixel để tính % diện tích bị hại — con số khách quan, không phỏng đoán."],
          ["📈", "Theo dõi tiến triển", "Chụp lại sau vài ngày để biết thuốc có hiệu quả không."],
        ]
      : [
          ["📷", "Snap the sick leaf", "One phone photo, no extra hardware."],
          ["🧠", "Muse Spark diagnoses", "Identifies crop, disease and cause, and writes a treatment plan in the farmer's language."],
          ["🎯", "SAM 3.1 measures damage", "Segments the leaf and every lesion pixel-by-pixel to compute % area affected — an objective number, not a guess."],
          ["📈", "Track progress", "Re-scan after a few days to see whether the treatment is working."],
        ];
  return (
    <ol className="grid gap-3 sm:grid-cols-2">
      {steps.map(([icon, title, body]) => (
        <li key={title} className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4">
          <p className="text-2xl" aria-hidden>
            {icon}
          </p>
          <p className="mt-2 font-semibold">{title}</p>
          <p className="mt-1 text-sm text-[var(--dim)]">{body}</p>
        </li>
      ))}
    </ol>
  );
}
