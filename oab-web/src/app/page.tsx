"use client";
import { useEffect, useRef, useState } from "react";
import { ensureAnonUser } from "@/lib/firebase";
import ReactMarkdown from "react-markdown";

/* ----------------------------- */
/* Global typing for Dev helpers */
/* ----------------------------- */
declare global {
  interface Window {
    __oab?: { ensureAnonUser: typeof ensureAnonUser };
  }
}

function DevExpose() {
  // Only attach helpers in development and only on the client
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      window.__oab = { ensureAnonUser };
    }
  }, []);
  return null;
}

const THREAD_KEY = "oab_thread_id";
const LAST_ACTIVITY_KEY = "oab_last_activity";
const THREAD_IDLE_MS = 45 * 60 * 1000; // 45 minutes: start a fresh thread after inactivity

type Message = { role: "user" | "assistant"; content: string };

function HeroTop() {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    video.defaultMuted = true;

    const tryPlay = () => {
      const playPromise = video.play();
      if (playPromise) {
        playPromise.catch(() => {
          // Autoplay can still be blocked by browser/device settings.
        });
      }
    };

    if (video.readyState >= 2) {
      tryPlay();
    } else {
      video.addEventListener("canplay", tryPlay, { once: true });
    }

    const handleVisibility = () => {
      if (document.visibilityState === "visible" && video.paused) {
        tryPlay();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      video.removeEventListener("canplay", tryPlay);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return (
    <header className="relative isolate w-full min-h-screen md:min-h-[100svh] border-b border-white/15 overflow-hidden">
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover scale-[1.02]"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
      >
        <source
          src="https://d8j0ntlcm91z4.cloudfront.net/user_39w19TCI1XWyxZ4H2GlXo141kWt/hf_20260221_180907_303b6b72-0efa-479c-932d-6406d0e56a51.mp4"
          type="video/mp4"
        />
      </video>

      <div className="relative z-10 max-w-7xl mx-auto px-8 md:px-16 min-h-screen md:min-h-[100svh] py-20 md:py-24 lg:py-28 flex items-center">
        <div className="w-full max-w-5xl mx-auto text-center px-6 md:px-10 lg:px-14">
          <div className="hero-fade-seq hero-fade-1">
            <div
              className="text-xs md:text-sm tracking-[0.2em] uppercase text-[#faf5d9]/85"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Patient‑centred&nbsp;|&nbsp;Evidence‑based
            </div>
            <h1
              className="mt-6 text-5xl sm:text-6xl md:text-7xl lg:text-[5.6rem] leading-[1.06] text-[#faf5d9] drop-shadow-[0_4px_22px_rgba(0,0,0,0.45)]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Empowering Bladder Health
            </h1>
          </div>
          <p
            className="hero-fade-seq hero-fade-2 mt-6 mx-auto text-sm sm:text-base md:text-lg lg:text-xl md:whitespace-nowrap text-[#faf5d9]/78 drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Helping you make decisions about treatment for overactive bladder.
          </p>

          <div className="hero-fade-seq hero-fade-3 mt-10 flex flex-wrap items-center justify-center gap-4 md:gap-5">
            <button
              onClick={() => {
                document
                  .getElementById("chat-section")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
              className="hero-cta-gradient hero-cta-warm"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Start your assessment
            </button>
            <button
              onClick={() => {
                document
                  .getElementById("info-section")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
              className="hero-cta-gradient hero-cta-cool"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Learn more
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

function TypingBubble() {
  return (
    <div className="flex items-start gap-2 max-w-[85%]">
      <div className="h-8 w-8 flex-shrink-0 rounded-full bg-[#02052e] flex items-center justify-center text-white text-sm">
        👩‍⚕️
      </div>
      <div className="bg-[#f2f2f2] text-[#02052e] p-3 rounded-2xl flex items-center">
        <span className="sr-only">Felicity is typing</span>
        <div className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-[#02052e] opacity-60 dot-1" />
          <span className="inline-block w-2 h-2 rounded-full bg-[#02052e] opacity-60 dot-2" />
          <span className="inline-block w-2 h-2 rounded-full bg-[#02052e] opacity-60 dot-3" />
        </div>
      </div>
      <style jsx>{`
        @keyframes oab-blink {
          0% {
            opacity: 0.2;
            transform: translateY(0);
          }
          20% {
            opacity: 1;
            transform: translateY(-2px);
          }
          40% {
            opacity: 0.2;
            transform: translateY(0);
          }
        }
        .dot-1 {
          animation: oab-blink 1.2s infinite 0s ease-in-out;
        }
        .dot-2 {
          animation: oab-blink 1.2s infinite 0.2s ease-in-out;
        }
        .dot-3 {
          animation: oab-blink 1.2s infinite 0.4s ease-in-out;
        }
      `}</style>
    </div>
  );
}

function ChatPane() {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);

  // Helper to clean up duplicate raw URLs when markdown link is present
  function normalizeAssistantText(text: string): string {
    // If there's any markdown link [..](http...) present, remove standalone occurrences
    // of that same URL on their own lines so we don't show both the short link and the raw URL.
    const link = text.match(/\]\((https?:\/\/[^\s)]+)\)/);
    if (link && link[1]) {
      const url = link[1];
      const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const urlLine = new RegExp(`^\\s*${escaped}\\s*$`, "gm");
      return text.replace(urlLine, "").trim();
    }
    return text;
  }

  useEffect(() => {
    // restore threadId across refreshes
    const saved =
      typeof window !== "undefined" ? localStorage.getItem(THREAD_KEY) : null;
    const last =
      typeof window !== "undefined"
        ? Number(localStorage.getItem(LAST_ACTIVITY_KEY) || "0")
        : 0;
    const now = Date.now();
    if (
      saved &&
      saved !== "null" &&
      saved !== "undefined" &&
      now - last < THREAD_IDLE_MS
    ) {
      setThreadId(saved);
    } else {
      // stale or missing thread — ensure we start clean
      if (typeof window !== "undefined") {
        localStorage.removeItem(THREAD_KEY);
      }
      setThreadId(null);
    }
  }, []);

  useEffect(() => {
    ensureAnonUser().then(setUid).catch(console.error);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const last = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || "0");
      if (!last) localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    }
  }, []);

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi, I'm Felicity.\nI'm here to help you understand your overactive bladder symptoms and tell you about treatment options that suit your values and preferences. The idea is to give you accurate and helpful information so you can make the best decisions for your current symptoms. First some preliminary questions. Ready to go?",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const msgRefs = useRef<HTMLDivElement[]>([]);
  const typingRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = listRef.current;
    if (!container) return;

    // Try to align the penultimate message to the top of the chat viewport.
    const penIdx = messages.length - 2;
    if (penIdx >= 0) {
      const penEl = msgRefs.current[penIdx];
      if (penEl) {
        const top = penEl.offsetTop - container.offsetTop;
        container.scrollTo({ top, behavior: "smooth" });
        return;
      }
    }

    // Fallback: smooth scroll to bottom
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (busy && listRef.current) {
      // Nudge the container to bring the typing indicator into view
      const el = typingRef.current;
      if (el) {
        const container = listRef.current;
        const top = el.offsetTop - container.offsetTop - 12;
        container.scrollTo({ top, behavior: "smooth" });
      }
    }
  }, [busy]);

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last?.role === "assistant") {
      taRef.current?.focus({ preventScroll: true } as FocusOptions);
    }
  }, [messages]);

  async function generateReportFlow() {
    if (!uid) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content:
            "I couldn't confirm your session. Please try again in a moment.",
        },
      ]);
      return;
    }
    if (!threadId) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content:
            "I couldn't find this conversation thread. Please try sending a quick message and try again.",
        },
      ]);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/create-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid,
          threadId,
          sessionId: `sess-${Date.now()}`,
        }),
      });
      const out: {
        downloadUrl?: string;
        storagePath?: string;
      } = await res.json();
      if (out?.downloadUrl) {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: `Your report is ready. It’ll be available for a limited time:\n${out.downloadUrl}`,
          },
        ]);
      } else if (out?.storagePath) {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: `Your report is ready and stored securely. Link will be available shortly:\n${out.storagePath}`,
          },
        ]);
      } else {
        setMessages((m) => [
          ...m,
          { role: "assistant", content: "Report created, but I couldn't get a link back." },
        ]);
      }
    } catch (e) {
      console.error(e);
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Sorry — I couldn't generate the PDF just now." },
      ]);
    } finally {
      setBusy(false);
      if (typeof window !== "undefined") {
        localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
      }
      taRef.current?.focus({ preventScroll: true } as FocusOptions);
    }
  }

  async function sendMessage(e: React.FormEvent) {
  e.preventDefault();
  if (!input.trim()) return;

  const prompt = input.trim();
  if (typeof window !== "undefined") {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
  }

  setMessages((m) => [...m, { role: "user", content: prompt }]);

  // If the last assistant message asked to generate a PDF, and the user replies with consent or "nothing else", trigger report
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const assistantAskedToGenerate = !!lastAssistant && /generate.*pdf/i.test(lastAssistant.content);
  const userConsents =
    /\b(yes|yeah|yep|ok|okay|please|go ahead|proceed|no|nope|nothing|that's all|thats all|no thanks|no thank you|all good)\b/i.test(
      prompt
    );

  if (assistantAskedToGenerate && userConsents) {
    setInput("");
    if (taRef.current) {
      taRef.current.style.height = "auto";
      taRef.current.style.removeProperty("height");
    }
    taRef.current?.focus({ preventScroll: true } as FocusOptions);
    await generateReportFlow();
    return;
  }

  setInput("");
  // Reset textarea height back to one line after sending
  if (taRef.current) {
    taRef.current.style.height = "auto";
    taRef.current.style.removeProperty("height");
  }
  // Keep focus in the input without scrolling the page
  taRef.current?.focus({ preventScroll: true } as FocusOptions);
  setBusy(true);

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, threadId }),
    });

    const data: { threadId?: string; reply?: string; reason?: string } = await res.json();

    if (data.threadId && data.threadId !== threadId) {
      setThreadId(data.threadId);
      if (typeof window !== "undefined") {
        localStorage.setItem(THREAD_KEY, data.threadId);
        localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
      }
    }

    if (data?.reason === "run_active") {
      // Keep typing bubble on and retry soon (wrap async inside a sync callback)
      setTimeout(() => {
        void (async () => {
          try {
            const retry = await fetch("/api/chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ prompt, threadId }),
            });

            const retryData = (await retry.json()) as {
              threadId?: string;
              reply?: string;
            };

            if (retryData.threadId && retryData.threadId !== threadId) {
              setThreadId(retryData.threadId);
              if (typeof window !== "undefined") {
                localStorage.setItem(THREAD_KEY, retryData.threadId);
                localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
              }
            }

            if (retryData.reply) {
              setMessages((prev) => [
                ...prev,
                { role: "assistant", content: retryData.reply as string },
              ]);
            }
          } catch (err) {
            console.error(err);
          } finally {
            setBusy(false);
          }
        })();
      }, 1500);

      return;
    }

    setMessages((m) => [
      ...m,
      { role: "assistant", content: data.reply || "…" },
    ]);
    taRef.current?.focus({ preventScroll: true } as FocusOptions);
  } finally {
    setBusy(false);
  }
}

  function resetConversation() {
    setThreadId(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem(THREAD_KEY);
      localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    }
    setMessages([
      {
        role: "assistant",
        content:
          "Hi, I'm Felicity.\nI'm here to help you understand your overactive bladder symptoms and tell you about treatment options that suit your values and preferences. The idea is to give you accurate and helpful information so you can make the best decisions for your current symptoms. First some preliminary questions. Ready to go?",
      },
    ]);
    // keep focus ready on the input
    requestAnimationFrame(() =>
      taRef.current?.focus({ preventScroll: true } as FocusOptions)
    );
  }

  return (
    <aside
      id="chat"
      className="bg-white rounded-2xl shadow-lg border border-slate-200 p-4 md:p-5"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs text-slate-500">
          {threadId
            ? "Continuing your current conversation."
            : "New conversation started."}
        </span>
        <button
          type="button"
          onClick={resetConversation}
          className="text-xs px-2 py-1 rounded-md border border-slate-300 hover:bg-slate-50 text-[#02052e]"
          aria-label="Start a new conversation"
          title="Start a new conversation"
        >
          New conversation
        </button>
      </div>
      <div
        ref={listRef}
        className="h-[55vh] overflow-y-auto space-y-3 pr-1 overscroll-contain"
      >
        {messages.map((m, i) => (
          <div
            key={i}
            ref={(el) => {
              if (el) msgRefs.current[i] = el;
            }}
            className={`flex ${
              m.role === "assistant" ? "justify-start" : "justify-end"
            }`}
          >
            {m.role === "assistant" ? (
              <div className="flex items-start gap-2 max-w-[85%]">
                <div className="h-8 w-8 flex-shrink-0 rounded-full bg-[#02052e] flex items-center justify-center text-white text-sm">
                  👩‍⚕️
                </div>
                <div className="bg-[#f2f2f2] text-[#02052e] p-3 rounded-2xl flex-1">
                  <div className="text-[10px] uppercase tracking-wide opacity-60 mb-1">
                    Felicity
                  </div>
                  <div className="leading-relaxed prose prose-sm max-w-none">
                    <ReactMarkdown
                      components={{
                        a: (props) => (
                          <a
                            {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
                            className="underline text-blue-600 hover:text-blue-700"
                            target="_blank"
                            rel="noopener noreferrer"
                          />
                        ),
                        p: (props) => (
                          <p
                            {...(props as React.HTMLAttributes<HTMLParagraphElement>)}
                            className="whitespace-pre-wrap leading-relaxed"
                          />
                        ),
                        li: (props) => (
                          <li
                            {...(props as React.LiHTMLAttributes<HTMLLIElement>)}
                            className="whitespace-pre-wrap leading-relaxed"
                          />
                        ),
                      }}
                    >
                      {normalizeAssistantText(m.content)}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            ) : (
              <div className="max-w-[85%] bg-[#02052e] text-white p-3 rounded-2xl">
                <div className="text-[10px] uppercase tracking-wide opacity-60 mb-1">
                  You
                </div>
                <div className="whitespace-pre-wrap leading-relaxed">
                  {m.content}
                </div>
              </div>
            )}
          </div>
        ))}
        {busy && (
          <div ref={typingRef} className="flex justify-start">
            <TypingBubble />
          </div>
        )}
      </div>

      <form onSubmit={sendMessage} className="mt-10 mb-4 relative flex items-end">
        <textarea
          ref={taRef}
          rows={1}
          className="flex-1 rounded-xl border border-slate-300 px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-300 placeholder:text-[#d9d9d9] text-[#02052e] resize-none bg-white"
          placeholder="Type a message..."
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            if (taRef.current) {
              taRef.current.style.height = "auto";
              taRef.current.style.height = taRef.current.scrollHeight + "px";
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              // submit on Enter, newline with Shift+Enter
              // trigger submit
              (e.currentTarget.form as HTMLFormElement)?.requestSubmit();
            }
          }}
          disabled={busy}
        />
        <button
          aria-label="Send"
          className="absolute right-1.5 bottom-1 h-10.5 w-10.5 inline-flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
          disabled={busy}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-5 w-5"
          >
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </form>
    </aside>
  );
}

function ChatSection() {
  return (
    <section
      id="chat-section"
      className="py-20 md:py-20"
      style={{ background: "linear-gradient(160deg, #01333d, black)" }}
    >
      <div className="max-w-6xl mx-auto px-6 md:px-10">
        <h2
          className="text-3xl md:text-4xl font-semibold text-[#faf5d9] mb-10"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Introducing, Felicity AI ✨
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Left: chat (2/3) */}
          <div className="lg:col-span-2">
            <ChatPane />
          </div>
          {/* Right: side copy */}
          <div className="lg:col-span-1 lg:ml-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <h3
                className="text-xl font-semibold text-white"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Chat with Felicity, our smart AI assistant.
              </h3>
              <div
                className="mt-3 text-sm text-white"
                style={{ fontFamily: "var(--font-display)" }}
              >
                <p>
                  Get guidance that is friendly, clear and based on the latest
                  evidence and clinical best‑practice.
                </p>
                <p className="mt-3">
                  Felicity has been trained on the thoroughly researched OAB
                  decision aid tool which aims to assess your symptoms, and give
                  you recommendations based on your preferences.
                </p>
                <p className="mt-3">
                  You can ask her questions, ask for explanations or just have a
                  chat.
                </p>
                <p className="mt-3">
                  If at any time you want to reset the conversation, simply
                  press the &quot;New conversation&quot; button at the top and
                  you can start over. If you just want to change a previous
                  answer, simply ask Felicity and you can change your answer in
                  your conversation thread.
                </p>
                <p className="mt-3">
                  At the end, Felicity will give you a link so you can get a
                  summary of your discussion, your preferred treatment options,
                  and a list of questions that you may want to ask your doctor
                  before proceeding with any treatment.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

type TabKey = "OAB" | "behaviour" | "meds" | "advanced";
const TABS: Array<{ k: TabKey; label: string; icon: string }> = [
  { k: "OAB", label: "What is Overactive Bladder (OAB)", icon: "💧" },
  { k: "behaviour", label: "Behaviour & lifestyle", icon: "🧘" },
  { k: "meds", label: "Medications for OAB", icon: "💊" },
  { k: "advanced", label: "Advanced therapies", icon: "⚙️" },
];

function InfoTabs() {
  const [active, setActive] = useState<TabKey>("OAB");
  return (
    <section
      id="info-section"
      className="py-16 md:py-20"
      style={{ background: "linear-gradient(150deg, #d7d8d9, #494a4a)" }}
    >
      <div className="max-w-6xl mx-auto px-6 md:px-10">
        <h2
          className="text-3xl md:text-4xl font-bold text-slate-900"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Clarity first. Peace of mind forever.
        </h2>

        {/* Cards row */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-10 justify-items-center">
          {TABS.map((t) => {
            const isActive = active === t.k;
            return (
              <button
                key={t.k}
                onClick={() => setActive(t.k)}
                aria-pressed={isActive}
                className={[
                  "w-full max-w-[260px] h-48 md:h-52 rounded-2xl border transition-all text-center flex flex-col items-center justify-start p-4",
                  isActive
                    ? "bg-[#02052e] text-white border-[#02052e] shadow-lg ring-1 ring-[#02052e]/30"
                    : "bg-white text-[#02052e] border-[#02052e]/40 hover:bg-[#f8f9fa]",
                ].join(" ")}
                style={{ fontFamily: "var(--font-display)" }}
              >
                <div className="text-base md:text-lg font-bold leading-snug min-h-[3.2rem] md:min-h-[3.6rem] flex items-start text-center">
                  {t.label}
                </div>
                <div className="mt-4 md:mt-5 text-6xl md:text-6xl">{t.icon}</div>
              </button>
            );
          })}
        </div>

        <div
          className="mt-12 md:mt-14 text-slate-800 leading-relaxed bg-white/80 rounded-xl p-6 border border-white/60 text-[17px] md:text-[18px]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {active === "OAB" && (
            <div>
              <p className="text-[20px] md:text-[22px] font-semibold">
                <strong>What is Overactive Bladder (OAB)?</strong>
              </p>
              <p className="mt-3">
                Overactive bladder, or OAB, is a condition where the bladder
                becomes too eager to empty, often at the wrong times.
              </p>
              <p className="mt-3">People with OAB may notice:</p>
              <ul className="mt-2 list-disc pl-6 space-y-2">
                <li>
                  A sudden, hard-to-control urge to pass urine (urgency)
                </li>
                <li>
                  Needing to urinate more often than usual, including multiple
                  trips at night
                </li>
                <li>Sometimes leaking urine before they reach the toilet</li>
              </ul>
              <p className="mt-4">
                Around 2 in 10 people experience OAB at some point in life.
                It’s more common with age, but it can affect anyone — men,
                women, even younger people.
              </p>
              <p className="mt-3">
                OAB is not “just part of getting older.” Sometimes it reflects
                changes in bladder muscle activity, nerve signalling, or
                underlying health issues such as diabetes. Living with OAB can
                also affect confidence, relationships, and sleep — which is why
                recognising and addressing it is so important.
              </p>
            </div>
          )}
          {active === "behaviour" && (
            <div>
              <p className="text-[20px] md:text-[22px] font-semibold">
                <strong>Behaviour and Lifestyle Modifications</strong>
              </p>
              <p className="mt-3">
                Simple daily strategies are often the first step in managing
                OAB. They aim to retrain your bladder and reduce triggers.
                Helpful approaches include:
              </p>
              <ul className="mt-2 list-disc pl-6 space-y-2">
                <li>
                  <strong>Bladder training</strong> – gradually spacing out
                  toilet trips to “re‑teach” the bladder to hold more urine.
                </li>
                <li>
                  <strong>Fluid management</strong> – drinking enough to stay
                  healthy, but avoiding excess; limiting caffeine, alcohol,
                  fizzy or citrus drinks that can irritate the bladder.
                </li>
                <li>
                  <strong>Pelvic floor exercises</strong> – strengthening the
                  sling of muscles that support your bladder and urethra can
                  give you better control.
                </li>
                <li>
                  <strong>Healthy habits</strong> – keeping a healthy weight,
                  eating fibre to avoid constipation, and quitting smoking all
                  help reduce pressure on the bladder.
                </li>
                <li>
                  <strong>Mind‑body approaches</strong> – yoga, meditation, or
                  relaxation techniques can reduce urgency by calming the
                  nervous system.
                </li>
              </ul>
              <p className="mt-4">
                These changes don’t always solve OAB completely, but they can
                make a real difference, especially when combined with other
                treatments.
              </p>
            </div>
          )}
          {active === "meds" && (
            <div>
              <p className="text-[20px] md:text-[22px] font-semibold">
                <strong>Medication Treatment for OAB</strong>
              </p>
              <p className="mt-3">
                If lifestyle steps aren’t enough, medications may help. The two
                main types are:
              </p>
              <ul className="mt-2 list-disc pl-6 space-y-2">
                <li>
                  <strong>Antimuscarinics</strong> (e.g., solifenacin,
                  oxybutynin, tolterodine, fesoterodine): these calm the
                  overactive bladder muscle by inhibiting nerves which trigger
                  urination, reducing urgency and leakage. Side effects are
                  common and can include a dry mouth, dry eyes, constipation, or
                  blurred vision.
                </li>
                <li>
                  <strong>Beta‑3 agonists</strong> (e.g., mirabegron, vibegron):
                  these stimulate nerves which relax the bladder muscle,
                  increasing its storage capacity. They usually have fewer side
                  effects but may affect blood pressure in some people
                  (approximately 1%).
                </li>
              </ul>
              <p className="mt-4">
                Medication doesn’t cure OAB, but it can provide significant
                relief. The choice depends on your other health conditions,
                tolerance of side effects, and preference.
              </p>
              <p className="mt-3">
                Some people try more than one drug before finding the right fit.
                Others may try a combination of antimuscarinics and beta‑3
                agonists to manage their symptoms.
              </p>
            </div>
          )}
          {active === "advanced" && (
            <div>
              <p className="text-[20px] md:text-[22px] font-semibold">
                <strong>Further Treatments for OAB</strong>
              </p>
              <p className="mt-3">
                If bladder training and tablets aren’t enough, there are
                effective second‑line options:
              </p>
              <ul className="mt-2 list-disc pl-6 space-y-2">
                <li>
                  <strong>Percutaneous Tibial Nerve Stimulation (PTNS)</strong>:
                  a small needle near the ankle delivers gentle electrical
                  pulses that “re‑tune” bladder nerve signals. Usually 12 weekly
                  sessions, then monthly top‑ups.
                </li>
                <li>
                  <strong>Botulinum toxin (Botox) injections</strong>: tiny
                  doses are injected into the bladder wall to relax it. Effects
                  last 6–12 months. Some people may need to learn
                  self‑catheterisation in case the bladder becomes too relaxed.
                </li>
                <li>
                  <strong>Sacral Neuromodulation (SNM)</strong>: a small implant
                  under the skin sends signals to nerves at the base of the
                  spine that control the bladder. It’s like a pacemaker for
                  bladder control and can last 10+ years.
                </li>
                <li>
                  <strong>Surgery (rare)</strong>: in very severe cases, bladder
                  enlargement or diversion can be considered. This is usually
                  the last resort.
                </li>
              </ul>
              <p className="mt-4">
                These treatments are not “one‑size‑fits‑all.” Each has pros and
                cons, and decisions are made based on your lifestyle, comfort
                with procedures, and long‑term goals.
              </p>
            </div>
          )}
        </div>
        {/* Useful Information and Links (static) */}
        <div className="mt-8 md:mt-10 flex justify-center">
          <div
            className="w-full md:w-2/3 bg-white/80 rounded-xl p-6 border border-white/60 text-slate-800"
            style={{ fontFamily: "var(--font-display)" }}
          >
            <h3 className="text-[20px] md:text-[22px] font-semibold mb-4 text-center">
              Useful information &amp; links
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-[17px] md:text-[18px]">
                <tbody>
                  <tr className="border-t border-white/60 first:border-t-0">
                    <th className="text-left align-top py-2 pr-3 font-semibold">
                      Urinary incontinence
                    </th>
                    <td className="py-2">
                      <a
                        href="https://www.baus.org.uk/patients/conditions/5/incontinence_of_urine"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:opacity-80"
                      >
                        baus.org.uk/patients/conditions/5/incontinence_of_urine
                      </a>
                    </td>
                  </tr>
                  <tr className="border-t border-white/60">
                    <th className="text-left align-top py-2 pr-3 font-semibold">
                      Bladder training
                    </th>
                    <td className="py-2">
                      <a
                        href="https://www.baus.org.uk/_userfiles/pages/files/Patients/Leaflets/Bladder%20training.pdf"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:opacity-80"
                      >
                        Bladder training (PDF) — BAUS
                      </a>
                    </td>
                  </tr>
                  <tr className="border-t border-white/60">
                    <th className="text-left align-top py-2 pr-3 font-semibold">
                      Input/output chart
                    </th>
                    <td className="py-2">
                      <a
                        href="https://www.baus.org.uk/_userfiles/pages/files/patients/leaflets/Input%20output%20chart.pdf"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:opacity-80"
                      >
                        Input/output chart (PDF) — BAUS
                      </a>
                    </td>
                  </tr>
                  <tr className="border-t border-white/60">
                    <th className="text-left align-top py-2 pr-3 font-semibold">
                      Pelvic floor (men)
                    </th>
                    <td className="py-2">
                      <a
                        href="https://www.baus.org.uk/_userfiles/pages/files/Patients/Leaflets/Pelvic%20floor%20XS%20male.pdf"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:opacity-80"
                      >
                        Pelvic floor exercises — BAUS (PDF)
                      </a>
                    </td>
                  </tr>
                  <tr className="border-t border-white/60">
                    <th className="text-left align-top py-2 pr-3 font-semibold">
                      Pelvic floor (women)
                    </th>
                    <td className="py-2">
                      <a
                        href="https://www.baus.org.uk/_userfiles/pages/files/Patients/Leaflets/Pelvic%20floor%20XS%20female.pdf"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:opacity-80"
                      >
                        Pelvic floor exercises — BAUS (PDF)
                      </a>
                    </td>
                  </tr>
                  <tr className="border-t border-white/60">
                    <th className="text-left align-top py-2 pr-3 font-semibold">
                      OAB treatment options
                    </th>
                    <td className="py-2">
                      <a
                        href="https://www.baus.org.uk/_userfiles/pages/files/Patients/Leaflets/OAB%20options.pdf"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:opacity-80"
                      >
                        Treatment options for overactive bladder — BAUS (PDF)
                      </a>
                    </td>
                  </tr>
                  <tr className="border-t border-white/60">
                    <th className="text-left align-top py-2 pr-3 font-semibold">
                      Botox injections
                    </th>
                    <td className="py-2">
                      <a
                        href="https://www.baus.org.uk/_userfiles/pages/files/Patients/Leaflets/Botox.pdf"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:opacity-80"
                      >
                        Botox injections — BAUS (PDF)
                      </a>
                    </td>
                  </tr>
                  <tr className="border-t border-white/60">
                    <th className="text-left align-top py-2 pr-3 font-semibold">
                      PTNS
                    </th>
                    <td className="py-2">
                      <a
                        href="https://bsug.org.uk/budcms/includes/kcfinder/upload/files/info-leaflets/PTNS%20BSUG%20July%202017.pdf"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:opacity-80"
                      >
                        Posterior Tibial Nerve Stimulation — BSUG (PDF)
                      </a>
                    </td>
                  </tr>
                  <tr className="border-t border-white/60">
                    <th className="text-left align-top py-2 pr-3 font-semibold">
                      Sacral nerve stimulation
                    </th>
                    <td className="py-2">
                      <a
                        href="https://www.baus.org.uk/_userfiles/pages/files/Patients/Leaflets/Sacral%20neuromodulation.pdf"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:opacity-80"
                      >
                        Sacral nerve stimulation — BAUS (PDF)
                      </a>
                    </td>
                  </tr>
                  <tr className="border-t border-white/60">
                    <th className="text-left align-top py-2 pr-3 font-semibold">
                      Enterocystoplasty
                    </th>
                    <td className="py-2">
                      <a
                        href="https://www.baus.org.uk/_userfiles/pages/files/patients/leaflets/Enterocystoplasty.pdf"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:opacity-80"
                      >
                        Enterocystoplasty (bladder enlargement surgery) — BAUS
                        (PDF)
                      </a>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Page() {
  return (
    <>
      <DevExpose />
      <HeroTop />
      <ChatSection />
      <InfoTabs />
    </>
  );
}

