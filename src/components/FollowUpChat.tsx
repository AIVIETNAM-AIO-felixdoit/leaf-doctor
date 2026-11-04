"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";
import type { AnalyzeResult, Lang } from "@/lib/types";
import { VoiceButton } from "./VoiceButton";

type Msg = { role: "user" | "assistant"; content: string };

export function FollowUpChat({ lang, result }: { lang: Lang; result: AnalyzeResult }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: question }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    try {
      const { affectedPct, severity, lesionCount } = result.measurement;
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang, diagnosis: result.diagnosis, measurement: { affectedPct, severity, lesionCount }, messages: next }),
      });
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => null))?.error ?? res.statusText);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        setMessages([...next, { role: "assistant", content: answer }]);
      }
    } catch (err) {
      setMessages([...next, { role: "assistant", content: `⚠️ ${err instanceof Error ? err.message : String(err)}` }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 sm:p-5">
      <h3 className="mb-3 font-semibold">{t(lang, "askTitle")}</h3>
      {messages.length > 0 && (
        <div className="mb-3 space-y-2">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-[90%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm leading-relaxed ${
                m.role === "user" ? "ml-auto bg-[var(--accent)] text-white" : "bg-[var(--muted)]"
              }`}
            >
              {m.content || "…"}
            </div>
          ))}
        </div>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t(lang, "askPlaceholder")}
          className="min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
        <VoiceButton lang={lang} onText={send} />
        <button
          disabled={busy || !input.trim()}
          className="shrink-0 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {t(lang, "send")}
        </button>
      </form>
    </section>
  );
}
