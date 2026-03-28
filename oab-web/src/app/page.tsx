"use client";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

const THREAD_KEY = "oab_thread_id";
const LAST_ACTIVITY_KEY = "oab_last_activity";
const THREAD_IDLE_MS = 45 * 60 * 1000; // 45 minutes: start a fresh thread after inactivity

type Message = { role: "user" | "assistant"; content: string };

const HOW_FELICITY_ACCORDION_ITEMS: Array<{ title: string; points: string[] }> = [
  {
    title: "What Felicity asks",
    points: [
      "Your bladder symptoms (frequency, urgency, leakage, night-time waking)",
      "The impact on daily life and what matters most to you",
      "Relevant factors that influence treatment choice (for example tolerability, preferences, and practical considerations)",
    ],
  },
  {
    title: "What you receive",
    points: [
      "A plain-English summary of your symptom pattern",
      "A tailored overview of suitable treatment pathways",
      "A structured report you can save or share with your clinician",
    ],
  },
  {
    title: "Important note",
    points: [
      "Felicity provides information and decision support - it does not replace medical assessment. If you have severe pain, blood in the urine, recurrent infections, or rapidly worsening symptoms, seek clinical review.",
    ],
  },
];

function HeroTop() {
  function scrollToTarget(id: string, offset = 20, extraViewportRatio = 0) {
    const el = document.getElementById(id);
    if (!el) return;
    const extraScroll = window.innerHeight * extraViewportRatio;
    const top = el.getBoundingClientRect().top + window.scrollY - offset + extraScroll;
    window.scrollTo({ top, behavior: "smooth" });
  }

  return (
    <header className="relative isolate overflow-hidden bg-black">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-[14%] z-0 h-[26rem] bg-[radial-gradient(ellipse_at_50%_40%,rgba(67,228,237,0.22)_0%,rgba(31,132,148,0.14)_34%,rgba(14,74,83,0.08)_52%,rgba(0,0,0,0)_78%)] blur-3xl"
      />

      <div className="relative z-10 max-w-7xl mx-auto px-8 md:px-16 min-h-[88svh] py-20 md:py-24 lg:py-28 flex items-center">
        <div className="w-full max-w-5xl mx-auto text-center px-6 md:px-10 lg:px-14">
          <div
            className="hero-overlay-panel mx-auto w-full max-w-4xl rounded-3xl border border-white/20 bg-[#020a1f]/82 backdrop-blur-xl p-7 md:p-10"
            style={{ fontFamily: "var(--font-display)" }}
          >
            <div className="text-xs md:text-sm tracking-[0.2em] uppercase text-[#faf5d9]/85">
              Patient‑centred&nbsp;|&nbsp;Evidence‑based
            </div>
            <h1 className="hero-metal-text mt-6 text-[2.84rem] sm:text-6xl md:text-7xl lg:text-[5.6rem] leading-[1.06] drop-shadow-[0_4px_22px_rgba(0,0,0,0.45)]">
              Empowering Bladder Health
            </h1>
            <p className="mt-6 mx-auto text-sm sm:text-base md:text-lg lg:text-xl md:whitespace-nowrap font-bold text-[#faf5d9]/78 drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
              Helping you make decisions about treatment for overactive bladder.
            </p>
          </div>

          <div className="mt-11 flex flex-wrap items-center justify-center gap-4 md:gap-5">
              <button
                onClick={() => {
                  scrollToTarget("introducing-felicity", 20, 0.2);
                }}
                className="hero-cta-gradient hero-cta-warm"
                style={{ fontFamily: "var(--font-display)" }}
            >
              Start your assessment
            </button>
            <button
              onClick={() => {
                scrollToTarget("card-explainers");
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

function IntroFelicitySection() {
  const introBullets = [
    "Personalised insight based on your symptoms and priorities",
    "Clear, balanced explanations of treatment options",
    "Designed to support confident, informed decisions",
  ];

  function scrollToTarget(id: string, offset = 20) {
    const el = document.getElementById(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: "smooth" });
  }

  return (
    <section id="introducing-felicity" className="relative bg-black">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-[calc(30vh+1.5rem)] z-0 h-[30rem] bg-[radial-gradient(ellipse_at_50%_0%,rgba(67,228,237,0.36)_0%,rgba(31,132,148,0.23)_30%,rgba(14,74,83,0.16)_50%,rgba(0,0,0,0)_76%)] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-[calc(30vh+20rem)] z-0 h-[22rem] bg-[radial-gradient(ellipse_at_50%_92%,rgba(135,206,235,0.25)_0%,rgba(108,186,224,0.15)_34%,rgba(52,112,148,0.1)_54%,rgba(0,0,0,0)_78%)] blur-3xl"
      />
      <div aria-hidden="true" className="h-[30vh]" />
      <div className="relative z-10 max-w-7xl mx-auto px-8 md:px-16 pb-20 md:pb-24 lg:pb-28">
        <div className="w-full max-w-5xl mx-auto px-6 md:px-10 lg:px-14">
          <h2
            className="-mt-4 md:-mt-6 text-[2.7rem] md:text-[3.85rem] font-semibold text-[#faf5d9] text-center"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Introducing Felicity AI.
          </h2>

          <div
            className="mt-8 w-full rounded-3xl border border-white/20 bg-white/[0.09] backdrop-blur-xl shadow-[0_18px_45px_rgba(0,0,0,0.4)] p-6 md:p-8 text-left"
            style={{ fontFamily: "var(--font-display)" }}
          >
            <p className="text-3xl md:text-4xl text-[#faf5d9] leading-tight">
              Intelligent guidance. Thoughtfully delivered.
            </p>
            <ul className="mt-5 list-disc pl-5 space-y-3 text-[20px] md:text-[21px] text-[#faf5d9]/93 leading-relaxed marker:text-[#faf5d9]/93">
              {introBullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
            <p className="mt-5 text-[19px] md:text-xl text-[#faf5d9]/83 leading-relaxed">
              Built around shared decision-making and current clinical best practice.
            </p>
            <a
              href="#how-felicity-works"
              onClick={(e) => {
                e.preventDefault();
                window.dispatchEvent(new Event("oab-open-how-felicity"));
                scrollToTarget("how-felicity-works");
              }}
              className="inline-block mt-5 text-lg text-[#8ad4ff] hover:text-[#b7e7ff] transition"
            >
              {"→ See how Felicity works"}
            </a>
          </div>
          <p
            className="mt-24 text-center text-3xl md:text-4xl text-[#faf5d9]/88"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Start your consultation below:
          </p>
        </div>
      </div>
    </section>
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

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;

    const prompt = input.trim();
    if (typeof window !== "undefined") {
      localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    }

    setMessages((m) => [...m, { role: "user", content: prompt }]);

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
      className="relative overflow-hidden rounded-3xl border border-[#d7deea]/90 bg-[linear-gradient(142deg,rgba(242,245,250,0.9)_0%,rgba(226,232,240,0.86)_46%,rgba(244,247,251,0.9)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.7),inset_0_-2px_0_rgba(119,132,152,0.28),0_22px_70px_rgba(0,0,0,0.3)] backdrop-blur-[1px] p-4 md:p-5"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-[2px] rounded-[calc(1.5rem-2px)] bg-[linear-gradient(148deg,rgba(255,255,255,0.2)_0%,rgba(255,255,255,0.08)_18%,rgba(255,255,255,0)_42%,rgba(22,35,52,0.12)_100%)]"
      />
      <div className="relative z-10">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs text-slate-600">
          {threadId
            ? "Continuing your current conversation."
            : "New conversation started."}
        </span>
        <button
          type="button"
          onClick={resetConversation}
          className="text-xs px-2 py-1 rounded-md border border-slate-300 hover:bg-slate-100 text-slate-700 transition"
          aria-label="Start a new conversation"
          title="Start a new conversation"
        >
          New conversation
        </button>
      </div>
      <div
        ref={listRef}
        className="h-[calc(55vh+5px)] overflow-y-auto space-y-3 pr-1 overscroll-contain"
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
                <div className="relative overflow-hidden flex-1 rounded-2xl border border-[#d9e0ea]/85 bg-[linear-gradient(146deg,rgba(246,248,252,0.98)_0%,rgba(236,241,247,0.92)_50%,rgba(247,249,252,0.96)_100%)] text-[#02052e] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.78),inset_0_-1px_0_rgba(128,141,161,0.2),0_8px_22px_rgba(4,12,26,0.1)]">
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-[1px] rounded-[calc(1rem-1px)] bg-[linear-gradient(150deg,rgba(255,255,255,0.18)_0%,rgba(255,255,255,0.08)_18%,rgba(255,255,255,0)_44%,rgba(21,33,49,0.08)_100%)]"
                  />
                  <div className="relative z-10">
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
                              className="whitespace-pre-wrap text-[13.33px] md:text-sm leading-relaxed"
                            />
                          ),
                          li: (props) => (
                            <li
                              {...(props as React.LiHTMLAttributes<HTMLLIElement>)}
                              className="whitespace-pre-wrap text-[13.33px] md:text-sm leading-relaxed"
                            />
                          ),
                        }}
                      >
                        {normalizeAssistantText(m.content)}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative overflow-hidden max-w-[85%] rounded-2xl border border-[#2c4268]/88 bg-[linear-gradient(152deg,rgba(2,6,43,0.98)_0%,rgba(4,16,61,0.96)_52%,rgba(7,31,88,0.96)_100%)] text-white p-3 shadow-[inset_0_1px_0_rgba(156,180,228,0.24),inset_0_-1px_0_rgba(1,4,18,0.5),0_10px_24px_rgba(0,0,0,0.28)]">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-[1px] rounded-[calc(1rem-1px)] bg-[linear-gradient(148deg,rgba(160,189,236,0.14)_0%,rgba(160,189,236,0.05)_18%,rgba(9,25,64,0)_44%,rgba(0,0,0,0.2)_100%)]"
                />
                <div className="relative z-10">
                  <div className="text-[10px] uppercase tracking-wide opacity-60 mb-1">
                    You
                  </div>
                  <div className="whitespace-pre-wrap text-[13.33px] md:text-base leading-relaxed">
                    {m.content}
                  </div>
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

      <form onSubmit={sendMessage} className="mt-10 mb-4 px-[5px]">
        <div className="relative w-full rounded-xl border border-[#d5dbe6] bg-[linear-gradient(145deg,rgba(255,255,255,0.99)_0%,rgba(245,248,252,0.96)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),inset_0_-1px_0_rgba(134,150,173,0.25),0_8px_18px_rgba(2,10,30,0.08)] focus-within:border-[#c7d0de]">
          <textarea
            ref={taRef}
            rows={1}
            className="block w-full min-h-[52px] resize-none bg-transparent px-4 py-3 pr-[52px] text-[#02052e] placeholder:text-[#b8c0cf] focus:outline-none"
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
            className="absolute right-[8.5px] top-1/2 h-[40px] w-[40px] -translate-y-1/2 inline-flex items-center justify-center rounded-lg overflow-hidden border border-[#2d4370]/90 bg-[linear-gradient(150deg,rgba(2,8,46,0.98)_0%,rgba(5,18,70,0.97)_52%,rgba(9,35,98,0.96)_100%)] text-white shadow-[inset_0_1px_0_rgba(163,188,231,0.26),inset_0_-1px_0_rgba(1,4,20,0.56),0_10px_22px_rgba(0,0,0,0.3)] transition hover:brightness-105 disabled:opacity-50"
            disabled={busy}
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-[1px] rounded-[calc(0.5rem-1px)] bg-[linear-gradient(145deg,rgba(170,198,242,0.15)_0%,rgba(170,198,242,0.06)_18%,rgba(7,22,61,0)_44%,rgba(0,0,0,0.22)_100%)]"
            />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="relative z-10 h-5 w-5"
            >
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </form>
      </div>
    </aside>
  );
}

function ChatSection() {
  const [howOpen, setHowOpen] = useState(false);
  const [openItems, setOpenItems] = useState<Record<number, boolean>>({
    0: false,
    1: false,
    2: false,
  });
  const howSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onOpenHow = () => {
      setHowOpen(true);
      window.requestAnimationFrame(() => {
        howSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    };
    window.addEventListener("oab-open-how-felicity", onOpenHow as EventListener);
    return () => {
      window.removeEventListener("oab-open-how-felicity", onOpenHow as EventListener);
    };
  }, []);

  function toggleHow() {
    setHowOpen((prev) => !prev);
  }

  function toggleInner(index: number) {
    setOpenItems((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  }

  return (
    <section id="chat-section" className="relative pb-24 md:pb-28 bg-black">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-8 bg-[linear-gradient(290deg,rgba(0,0,0,1)_0%,rgba(0,0,0,0.94)_24%,rgba(0,0,0,0.9)_52%,rgba(0,0,0,0.95)_76%,rgba(0,0,0,1)_100%)] blur-2xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_18%_38%,rgba(172,153,237,0.32)_0%,rgba(172,153,237,0.2)_22%,rgba(40,34,61,0.22)_44%,rgba(0,0,0,0.84)_76%,rgba(0,0,0,1)_100%),radial-gradient(ellipse_at_82%_38%,rgba(67,228,237,0.37)_0%,rgba(67,228,237,0.22)_24%,rgba(20,62,66,0.2)_46%,rgba(0,0,0,0.84)_78%,rgba(0,0,0,1)_100%)] blur-xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_43%_36%,rgba(185,168,246,0.26)_0%,rgba(126,110,185,0.2)_26%,rgba(56,45,90,0.14)_44%,rgba(0,0,0,0.17)_66%,rgba(0,0,0,0.39)_100%),radial-gradient(circle_at_71%_68%,rgba(76,222,236,0.27)_0%,rgba(31,132,148,0.21)_28%,rgba(14,74,83,0.14)_46%,rgba(0,0,0,0.17)_68%,rgba(0,0,0,0.41)_100%)] blur-3xl"
      />
      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-10">
        <div id="chat-window" className="w-full lg:w-[85.714%] mx-auto">
          <ChatPane />
        </div>

        <div
          id="how-felicity-works"
          ref={howSectionRef}
          className="relative overflow-hidden mt-14 md:mt-16 rounded-3xl border border-white/18 bg-black/55 backdrop-blur-xl p-6 md:p-8"
          style={{ fontFamily: "var(--font-display)" }}
        >
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-black/40" />
          <div className="relative z-10">
          <button
            id="how-felicity-toggle"
            type="button"
            onClick={toggleHow}
            className="w-full px-1 py-1 text-left flex items-center justify-between"
          >
            <span className="text-3xl md:text-4xl font-semibold text-[#faf5d9]">
              How Felicity Works
            </span>
            <span
              className={`text-[#faf5d9]/70 text-4xl leading-none transition-transform duration-200 ${
                howOpen ? "rotate-45" : ""
              }`}
            >
              +
            </span>
          </button>

          {howOpen && (
            <div className="min-h-0 pt-5">
              <p className="text-lg md:text-xl leading-relaxed text-[#faf5d9]/92">
                Felicity is structured around a patient decision-aid approach used in overactive
                bladder care. It guides you through a short assessment, then summarises your
                results in a clear report you can use to support a consultation.
              </p>

              <div className="mt-6 space-y-3">
                {HOW_FELICITY_ACCORDION_ITEMS.map((item, idx) => {
                  const isOpen = !!openItems[idx];
                  return (
                    <div
                      key={item.title}
                      className={`rounded-2xl border border-white/15 bg-white/[0.05] ${
                        isOpen ? "bg-white/[0.08]" : ""
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleInner(idx)}
                        className="w-full px-5 py-4 flex items-center justify-between text-[#faf5d9] text-xl font-semibold text-left"
                      >
                        <span>{item.title}</span>
                        <span
                          className={`text-[#faf5d9]/70 text-3xl leading-none transition-transform duration-200 ${
                            isOpen ? "rotate-45" : ""
                          }`}
                        >
                          +
                        </span>
                      </button>
                      {isOpen && (
                        <div className="px-5 pb-5">
                          <ul className="space-y-2 text-base md:text-lg text-[#faf5d9]/90 leading-relaxed">
                            {item.points.map((point) => (
                              <li key={point}>- {point}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-7 space-y-3 text-base md:text-lg leading-relaxed text-[#faf5d9]/87">
                <p>
                  Felicity was developed from a validated Patient Decision Aid developed by the
                  World Federation of Incontinence and Pelvic Problems (WFIPP). The PDF version
                  can be found here:{" "}
                  <a
                    href="https://wfipp.org/overactive-bladder-patient-decision-aid/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-[#8ad4ff] hover:text-[#b7e7ff]"
                  >
                    https://wfipp.org/overactive-bladder-patient-decision-aid/
                  </a>
                </p>
                <p>
                  Disclaimer - no patient confidential information is collected during this
                  conversation and all reports are stored for 48 hours for you to download. After
                  this time limit, reports are automatically deleted from our servers.
                </p>
              </div>
            </div>
          )}
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
    <section id="info-section" className="relative isolate overflow-hidden py-16 md:py-20 bg-transparent">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_29%_47%,rgba(175,203,239,0.26)_0%,rgba(109,136,173,0.2)_24%,rgba(36,45,60,0.14)_42%,rgba(0,0,0,0)_80%),radial-gradient(circle_at_50%_80%,rgba(87,255,255,0.29)_0%,rgba(42,171,191,0.22)_25%,rgba(20,97,109,0.14)_44%,rgba(0,0,0,0)_82%)] blur-3xl"
      />
      <div className="relative z-10 max-w-6xl mx-auto px-6 md:px-10">
        <h2
          className="text-3xl md:text-4xl font-bold text-[#faf5d9]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Clarity first. Peace of mind forever.
        </h2>

        {/* Cards row */}
        <div id="card-explainers" className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-10 justify-items-center">
          {TABS.map((t) => {
            const isActive = active === t.k;
            return (
              <button
                key={t.k}
                onClick={() => setActive(t.k)}
                aria-pressed={isActive}
                className={[
                  "info-card hero-cta-gradient w-full max-w-[260px] h-48 md:h-52 text-center flex flex-col items-center justify-start p-4",
                  isActive ? "info-card-selected" : "hero-cta-warm",
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
          className="info-panel-luxe mt-12 md:mt-14 text-slate-800 leading-relaxed rounded-xl p-6 text-[18px] md:text-[19px]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {active === "OAB" && (
            <div>
              <p className="text-[22px] md:text-[24px] font-semibold">
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
              <p className="text-[22px] md:text-[24px] font-semibold">
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
              <p className="text-[22px] md:text-[24px] font-semibold">
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
              <p className="text-[22px] md:text-[24px] font-semibold">
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
            className="info-panel-luxe w-full md:w-2/3 rounded-xl p-6 text-slate-800"
            style={{ fontFamily: "var(--font-display)" }}
          >
            <h3 className="text-[22px] md:text-[24px] font-semibold mb-4 text-center underline underline-offset-4 decoration-[1.5px]">
              Useful Information &amp; Links
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-[18px] md:text-[19px]">
                <tbody>
                  <tr>
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
                  <tr>
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
                  <tr>
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
                  <tr>
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
                  <tr>
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
                  <tr>
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
                  <tr>
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
                  <tr>
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
                  <tr>
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
                  <tr>
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
    <main className="bg-black">
      <HeroTop />
      <IntroFelicitySection />
      <ChatSection />
      <InfoTabs />
    </main>
  );
}
