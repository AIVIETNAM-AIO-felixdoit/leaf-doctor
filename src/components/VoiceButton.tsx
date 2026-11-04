"use client";

import { useRef, useState } from "react";
import { toWav16k } from "@/lib/client-media";
import { t } from "@/lib/i18n";
import type { Lang } from "@/lib/types";

/** Push-to-talk: records in the browser, converts to WAV, transcribes with Muse Voice Transcribe. */
export function VoiceButton({ lang, onText }: { lang: Lang; onText: (text: string) => void }) {
  const [state, setState] = useState<"idle" | "recording" | "busy">("idle");
  const recorder = useRef<MediaRecorder | null>(null);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop());
        setState("busy");
        try {
          const wav = await toWav16k(new Blob(chunks, { type: rec.mimeType }));
          const form = new FormData();
          form.append("audio", wav, "note.wav");
          form.append("lang", lang);
          const res = await fetch("/api/transcribe", { method: "POST", body: form });
          const data = await res.json();
          if (data.transcript) onText(data.transcript);
          else if (data.error) alert(data.error);
        } finally {
          setState("idle");
        }
      };
      rec.start();
      recorder.current = rec;
      setState("recording");
    } catch (err) {
      alert(String(err));
    }
  }

  const label = state === "recording" ? t(lang, "stop") : state === "busy" ? t(lang, "transcribing") : t(lang, "record");
  return (
    <button
      type="button"
      disabled={state === "busy"}
      onClick={() => (state === "recording" ? recorder.current?.stop() : start())}
      className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${
        state === "recording"
          ? "animate-pulse border-red-500 bg-red-500 text-white"
          : "border-[var(--line)] bg-[var(--card)] hover:bg-[var(--muted)]"
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
        <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" />
      </svg>
      {label}
    </button>
  );
}
