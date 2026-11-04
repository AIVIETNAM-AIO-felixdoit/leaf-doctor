# 🌿 Leaf Doctor · Bác Sĩ Lá

**Snap one leaf. Know the disease, how much of the leaf is damaged, and what to do — in the farmer's own language.**

Built for the Meta Global AI Developer Hackathon (Indie track, theme *Build for Your World*).

**▶ Live demo: https://leaf-doctor-eight.vercel.app** (toggle VI / EN in the top-right corner)

## The problem

Vietnam has millions of smallholder farming households, most working very small plots. When rice blast, coffee rust or durian leaf blight shows up, the usual options are guessing, asking the pesticide seller (who has something to sell), or waiting days for an extension officer. Wrong or late treatment means lost harvests and over-spraying.

Two things are missing: **a reliable diagnosis**, and **an objective way to tell how bad it is and whether the treatment is working**. "It looks a bit worse" is not a measurement.

## What it does

1. **Photo in** — take a picture of the sick leaf (phone camera, no extra hardware). Optionally pick the crop and describe the problem by **voice** in Vietnamese or English.
2. **Muse Spark (vision)** identifies the crop and the disease / pest / deficiency, explains the cause, and writes an ordered treatment plan (active ingredients, dosage per 16 L sprayer, organic alternatives, prevention, urgency).
3. **SAM 3.1** segments the leaf and every lesion at pixel level. Muse Spark tells SAM *what to look for* (e.g. `"brown spot"`, `"white powder"`), so segmentation adapts to each disease. We rasterise all masks onto a shared grid and compute **% of leaf area affected** — the standard severity measure used in plant pathology, now available from a phone photo.
4. **Severity + overlay** — the damaged area is painted on the photo (green = leaf, red = lesions, yellow boxes = detections) with a severity grade.
5. **Track over time** — every scan is saved locally; re-scan the same plant after a few days and see the affected area go ▲ or ▼, i.e. whether the treatment works.
6. **Follow-up chat** — ask "when should I spray?" or "is it safe for my bees?" by text or voice; answers are grounded in the current diagnosis and measurement.

## Meta models used

| Model | Role |
|---|---|
| `muse-spark-1.3` | Vision diagnosis → structured JSON; picks the SAM concept prompts; follow-up chat (streamed) |
| `sam-3.1` | Concept segmentation of leaf + lesions → masks → area maths |
| `muse-voice-transcribe-1.0` | Voice notes and questions (Vietnamese / English) |

## Architecture

```
Browser (Next.js, React)                      Next.js route handlers (server)            Meta Model API
─────────────────────────                     ─────────────────────────────              ─────────────────
photo → downscale ≤1280px ───────────────▶ /api/analyze
                                             ├─ SAM 3.1 "leaf" (starts immediately) ───▶ /v1/responses (stream)
                                             ├─ Muse Spark diagnosis (JSON) ───────────▶ /v1/chat/completions
                                             │    └─ returns lesionPrompts
                                             ├─ SAM 3.1 × lesionPrompts (parallel) ────▶ /v1/responses (stream)
                                             └─ rasterise masks → leaf ∪ lesion grid
                                                → affected % , severity, overlay
mic → WebM → decode+resample → 16 kHz WAV ─▶ /api/transcribe ─────────────────────────▶ /v1/asr/transcribe
follow-up question ──────────────────────▶ /api/chat (streamed text) ─────────────────▶ /v1/chat/completions
```

Key details:
- SAM 3.1 output is parsed with `@meta-sam/parser`; each mask covers its record's `bounds`, so masks are resampled onto a 320-cell grid and unioned — overlapping detections are counted once.
- Affected area = `lesion / (leaf ∪ lesion)`, so lesions at the leaf margin that the leaf mask misses still count.
- The leaf segmentation runs in parallel with the diagnosis to cut latency; lesion prompts run in parallel after it.
- SAM failures degrade gracefully: the diagnosis is still shown.
- Muse Voice Transcribe requires 16-bit mono WAV, so the browser decodes the MediaRecorder recording and re-encodes it at 16 kHz before upload.
- The API key never reaches the browser.

## Run it

```bash
cd app
npm install
cp .env.local.example .env.local   # paste MODEL_API_KEY
npm run dev                         # http://localhost:3000
```

Without a key the app runs in **demo mode** with sample data (clearly labelled), so the UI can be explored offline.

## Limitations & next steps

- Advisory only — always follow the pesticide label and local regulations.
- Severity from a single leaf; next: multi-leaf / whole-plant video with SAM 3.1 video tracking.
- Offline-first PWA and Zalo bot for farmers with patchy connectivity.
- Region-specific product lists and an extension-officer review queue.

## License

MIT
