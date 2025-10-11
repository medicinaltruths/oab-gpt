"use client";

import { useEffect, useRef, useState } from "react";

type Message = { role: "user" | "assistant"; content: string };

export default function ChatPane() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: `Hi, I'm Felicity. Ready to go?` },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;

    const prompt = input.trim();
    setMessages((m) => [...m, { role: "user", content: prompt }]);
    setInput("");
    setBusy(true);

    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await r.json();
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Sorry—something went wrong." },
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function generatePdf() {
    setBusy(true);
    try {
      // minimal demo payload; replace with your collected chat/session data
      const payload = {
        patientName: "Anonymous",
        symptomSummary: "Collected from the chat (demo).",
        previousTreatments: "PFMT, meds (demo)",
        socialFactors: "Work, travel constraints (demo)",
        treatmentRecommended: "Will be determined (demo)",
        treatmentExplanation: "Personalized explanation (demo)",
        questionsForDoctor:
          "What is the expected improvement and timeline? (demo)",
        sessionId: `sess-${Date.now()}`,
      };

      const res = await fetch("/api/create-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.downloadUrl) {
        window.open(data.downloadUrl, "_blank");
      } else if (data.storagePath) {
        // after you add Firebase Auth client-side, fetch getDownloadURL(storagePath)
        alert(`Report saved to: ${data.storagePath}`);
      } else {
        alert("Report created, but no link returned.");
      }
    } catch {
      alert("Could not generate PDF.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 md:p-5 sticky top-4">
      <div className="h-[55vh] overflow-y-auto space-y-3 pr-1">
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "assistant"
                ? "bg-slate-50 border border-slate-200 p-3 rounded-xl"
                : "bg-blue-50 border border-blue-200 p-3 rounded-xl text-slate-900"
            }
          >
            <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">
              {m.role}
            </div>
            <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form onSubmit={sendMessage} className="mt-4 flex gap-2">
        <input
          className="flex-1 rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
          placeholder="Type your message…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
        />
        <button
          className="rounded-xl px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          disabled={busy}
        >
          Send
        </button>
      </form>

      <button
        onClick={generatePdf}
        className="mt-3 w-full rounded-xl px-4 py-2 border border-slate-300 hover:bg-slate-50"
        disabled={busy}
      >
        Generate PDF summary
      </button>
    </aside>
  );
}