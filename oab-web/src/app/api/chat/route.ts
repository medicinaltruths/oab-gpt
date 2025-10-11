// import { url } from "inspector";
import OpenAI from "openai";

/* ------------------------------------------------------------------------- */
/* Minimal types: enough to satisfy TS/ESLint without importing SDK internals */
/* ------------------------------------------------------------------------- */
type RunStatus =
  | "queued"
  | "in_progress"
  | "requires_action"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired";

interface ToolFunctionCall {
  id: string;
  type: "function";
  function: { name: string; arguments?: string };
}

interface RunShape {
  id?: string;
  thread_id?: string;
  status: RunStatus;
  required_action?: {
    submit_tool_outputs?: {
      tool_calls: ToolFunctionCall[];
    };
  };
}

type TextContent = { type: "text"; text: { value: string } };
type AnyContent = { type: string; [k: string]: unknown };
interface ThreadMessage {
  role?: string;
  content?: Array<TextContent | AnyContent>;
}

/* ----------------------------------------- */
/* Module-level set to de-dupe tool call IDs */
/* ----------------------------------------- */
const handledToolCallIds = new Set<string>();

/* ------------------------------------------------------------------------- */
/* Cloud Function endpoint for PDF generation (assistant-led URL delivery)   */
/* ------------------------------------------------------------------------- */
const PDF_FUNCTION_URL = process.env.PDF_FUNCTION_URL || "";

/* ----------------------- */
/* Simple intent heuristics */
/* ----------------------- */
function isNewReportRequest(text: string): boolean {
  const t = (text || "").toLowerCase();
  return (
    /(^|\b)(new|another|fresh)\s+(pdf|report)\b/.test(t) ||
    ((/generate|make|create/.test(t)) && /\b(report|pdf)\b/.test(t))
  );
}
function isSendLinkRequest(text: string): boolean {
  const t = (text || "").toLowerCase();
  return (
    (/\b(send|give|provide|share|show)\b.*\b(link|report|pdf)\b/.test(t)) ||
    (/\bdownload\b.*\b(report|pdf)\b/.test(t)) ||
    (/\blink\b/.test(t) && /\b(report|pdf)\b/.test(t))
  );
}

console.log("[chat-route] loaded v9 (typed, eslint-clean)");

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // always run on server, no caching
export const maxDuration = 60; // seconds (adjust to your Vercel plan)

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* -------------------------- */
/* Message/text helper guards */
/* -------------------------- */
function extractTextFromMessage(msg: unknown): string {
  const m = msg as ThreadMessage | undefined;
  if (!m || !Array.isArray(m.content)) return "";
  const parts: string[] = [];
  for (const part of m.content) {
    const p = part as Partial<TextContent>;
    if (p?.type === "text" && typeof p?.text?.value === "string") {
      parts.push(p.text.value);
    }
  }
  return parts.join("\n").trim();
}

function extractUrls(text: string): string[] {
  if (!text) return [];
  const urls: string[] = [];
  const re = /\bhttps?:\/\/[^\s)]+/gi;
  let m: RegExpExecArray | null;
  // eslint-disable-next-line no-cond-assign
  while ((m = re.exec(text)) !== null) {
    urls.push(m[0]);
  }
  return urls;
}

async function findLatestReportUrlFromThread(
  client: OpenAI,
  threadId: string
): Promise<string | ""> {
  try {
    const list = await client.beta.threads.messages.list(threadId, {
      order: "desc",
      limit: 30,
    });
    for (const m of (list.data as unknown as ThreadMessage[])) {
      if (!Array.isArray(m?.content)) continue;
      for (const c of (m.content as Array<TextContent | AnyContent>)) {
        const t = c as TextContent;
        if (t?.type === "text" && t?.text?.value) {
          const text = String(t.text.value);
          if (/download|report/i.test(text)) {
            const urls = extractUrls(text);
            const winner = urls.find(
              (u) =>
                /https:\/\/storage\.googleapis\.com\//i.test(u) ||
                /firebasestorage\.app/i.test(u)
            );
            if (winner) return winner;
          }
        }
      }
    }
  } catch {
    /* no-op */
  }
  return "";
}

/* ----------------------------- */
/* HTTP helpers (typed responses) */
/* ----------------------------- */
async function retrieveRunHTTP(
  threadId: string,
  runId: string
): Promise<RunShape> {
  const res = await fetch(
    `https://api.openai.com/v1/threads/${threadId}/runs/${runId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
        "OpenAI-Beta": "assistants=v2",
      },
      cache: "no-store",
    }
  );
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`HTTP retrieve failed ${res.status}: ${errText}`);
  }
  return (await res.json()) as RunShape;
}

async function listRunsLatestHTTP(threadId: string): Promise<string> {
  const url = new URL(`https://api.openai.com/v1/threads/${threadId}/runs`);
  url.searchParams.set("limit", "1");
  url.searchParams.set("order", "desc");
  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
      "OpenAI-Beta": "assistants=v2",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`HTTP list failed ${res.status}: ${err}`);
  }
  const data = (await res.json()) as { data?: Array<{ id?: string }> };
  return data?.data?.[0]?.id || "";
}

async function listRunsLatestHTTPWithStatus(
  threadId: string
): Promise<{ id: string; status: RunStatus } | null> {
  const url = new URL(`https://api.openai.com/v1/threads/${threadId}/runs`);
  url.searchParams.set("limit", "1");
  url.searchParams.set("order", "desc");
  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
      "OpenAI-Beta": "assistants=v2",
    },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    data?: Array<{ id?: string; status?: RunStatus }>;
  };
  const r = data?.data?.[0];
  return r && r.id && r.status ? { id: r.id, status: r.status } : null;
}

async function cancelRunHTTP(threadId: string, runId: string) {
  const res = await fetch(
    `https://api.openai.com/v1/threads/${threadId}/runs/${runId}/cancel`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
        "OpenAI-Beta": "assistants=v2",
      },
    }
  );
  return res.ok;
}

/* ------------------------------------------------------------------ */
/* submit_tool_outputs via HTTP (avoid SDK shape/versioning friction) */
/* ------------------------------------------------------------------ */
async function submitToolOutputsCompat(
  _client: OpenAI, // signature compatibility
  threadId: string,
  runId: string,
  tool_outputs: Array<{ tool_call_id: string; output: string }>
): Promise<unknown> {
  try {
    const res = await fetch(
      `https://api.openai.com/v1/threads/${threadId}/runs/${runId}/submit_tool_outputs`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
          "OpenAI-Beta": "assistants=v2",
        },
        cache: "no-store",
        body: JSON.stringify({ tool_outputs }),
      }
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP submit_tool_outputs failed ${res.status}: ${text}`);
    }
    return await res.json();
  } catch (err: unknown) {
    console.error(
      "[chat] submitToolOutputsCompat failed (HTTP)",
      err,
      { threadId, runId, tool_outputs }
    );
    throw err;
  }
}

/* ---------------------------------------- */
/* Handle "requires_action" immediately now */
/* ---------------------------------------- */
async function handleRequiredActionNow(
  client: OpenAI,
  req: Request, // kept for future use if you add auth/ip, etc.
  threadId: string,
  runId: string
): Promise<void> {
  const run = await retrieveRunHTTP(threadId, runId);
  const toolCalls: ToolFunctionCall[] =
    run?.required_action?.submit_tool_outputs?.tool_calls ?? [];
  console.log(
    "[chat] handleRequiredActionNow: toolCalls",
    JSON.stringify(
      toolCalls.map((t) => ({ id: t?.id, name: t?.function?.name, type: t?.type }))
    )
  );
  if (!toolCalls.length) return;

  const tool_outputs: Array<{ tool_call_id: string; output: string }> = [];

  for (const call of toolCalls) {
    if (handledToolCallIds.has(call.id)) continue;
    if (call?.type !== "function" || !call?.function) continue;
    if (call.function.name !== "generate_summary_pdf") continue;

    // Parse args coming from the Assistant
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(call.function.arguments ?? "{}") as Record<string, unknown>;
    } catch {
      /* ignore bad JSON */
    }

    const payload = {
      uid: undefined as unknown as string | undefined, // anon; your API returns signed URL
      threadId: String(threadId),
      patientName: String(args.patient_name ?? ""),
      symptomSummary: String(args.symptom_summary ?? ""),
      previousTreatments: String(args.previous_treatments ?? ""),
      socialFactors: String(args.social_factors ?? ""),
      treatmentRecommended: String(args.treatment_recommended ?? ""),
      treatmentExplanation: String(args.treatment_explanation ?? ""),
      questionsForDoctor: String(args.questions_for_doctor ?? ""),
      sessionId: `assistants-${Date.now()}`,
    };

    // Call Cloud Function directly (assistant-led URL delivery)
    if (!PDF_FUNCTION_URL) {
      console.error(
        "[chat] Missing PDF_FUNCTION_URL env, cannot generate report"
      );
    }
    const url = PDF_FUNCTION_URL;
    let outputText = "";
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(payload),
      });
      const raw = await resp.text();
      console.log("[chat] CF create-report status:", resp.status);
      console.log("[chat] CF create-report body:", raw);

      let data: { ok?: boolean; downloadUrl?: string; error?: unknown } | null =
        null;
      try {
        data = raw ? (JSON.parse(raw) as typeof data) : null;
      } catch {
        /* ignore non-JSON error bodies */
      }

      if (resp.ok && data?.ok && typeof data.downloadUrl === "string" && data.downloadUrl) {
        outputText = data.downloadUrl; // send the actual signed URL back to the Assistant
      } else if (data?.error) {
        outputText = `ERROR: ${String(data.error)}`;
      } else {
        outputText = `ERROR: PDF function responded without a URL (status ${resp.status}).`;
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[chat] CF create-report fetch failed:", msg);
      outputText = `ERROR: ${msg}`;
    }

    tool_outputs.push({
      tool_call_id: call.id,
      output:
        outputText && outputText.startsWith("ERROR:")
          ? outputText
          : outputText || "REPORT_READY",
    });

    handledToolCallIds.add(call.id);
  }

  if (tool_outputs.length) {
    try {
      await submitToolOutputsCompat(client, threadId, runId, tool_outputs);
    } catch (e) {
      console.warn(
        "[chat] non-fatal: submitToolOutputsCompat failed in handleRequiredActionNow",
        e
      );
    }
  }
}

/* --------------- */
/* POST entrypoint */
/* --------------- */
export async function POST(req: Request) {
  try {
    const body = ((await req.json().catch(() => ({}))) ?? {}) as {
      prompt?: string;
      threadId?: string | null;
      newSession?: boolean;
    };

    let lastToolResult: { downloadUrl?: string } | null = null;

    const prompt = String(body?.prompt ?? "");
    let threadId = String(body?.threadId ?? "");
    const newSession = !!body?.newSession;

    handledToolCallIds.clear();

    // Normalize accidental literal strings or explicit reset
    if (threadId === "null" || threadId === "undefined") threadId = "";
    if (newSession) threadId = ""; // force a fresh thread for a new assessment/session

    // Lightweight in-chat reset for testing
    if (prompt.trim().toLowerCase() === "/reset") {
      return new Response(
        JSON.stringify({
          reply: "Session reset. Please say hello to begin.",
          threadId: "",
        }),
        { status: 200 }
      );
    }

    if (!prompt) {
      return new Response(JSON.stringify({ error: "Missing prompt" }), {
        status: 400,
      });
    }
    if (!process.env.OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing OPENAI_API_KEY" }), {
        status: 500,
      });
    }
    if (!process.env.OPENAI_ASSISTANT_ID) {
      return new Response(
        JSON.stringify({ error: "Missing OPENAI_ASSISTANT_ID" }),
        { status: 500 }
      );
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // 1) Ensure a valid thread
    if (threadId) {
      try {
        await client.beta.threads.retrieve(threadId);
      } catch {
        threadId = "";
      }
    }
    if (!threadId) {
      const th = await client.beta.threads.create();
      const created = th as unknown as { id?: string };
      threadId = created?.id || "";
    }
    if (!threadId || !threadId.startsWith("thread_")) {
      return new Response(
        JSON.stringify({ error: "Invalid threadId", threadId }),
        { status: 500 }
      );
    }

    // 2) Intent routing and lingering-run cancel
    const wantNewReport = isNewReportRequest(prompt);
    const wantLinkOnly = !wantNewReport && isSendLinkRequest(prompt);

    try {
      if (!wantNewReport && !wantLinkOnly) {
        const latestMaybe = await listRunsLatestHTTPWithStatus(threadId);
        const activeStates = new Set<RunStatus>([
          "queued",
          "in_progress",
          "requires_action",
        ]);
        if (latestMaybe && activeStates.has(latestMaybe.status)) {
          await cancelRunHTTP(threadId, latestMaybe.id);
        }
      }
    } catch {
      /* non-fatal */
    }

    // Guard: if latest run is active, try to finish it (incl. tools) or return a soft-busy payload
    if (threadId) {
      const activeStates = new Set<RunStatus>([
        "queued",
        "in_progress",
        "requires_action",
      ]);
      let latest = await listRunsLatestHTTPWithStatus(threadId);

      if (latest && activeStates.has(latest.status)) {
        const start = Date.now();

        while (
          latest &&
          activeStates.has(latest.status) &&
          Date.now() - start < 20_000
        ) {
          if (latest.status === "requires_action") {
            try {
              await handleRequiredActionNow(client, req, threadId, latest.id);
            } catch (e) {
              console.warn("[chat] handleRequiredActionNow (pre-message) failed:", e);
            }
            latest = await listRunsLatestHTTPWithStatus(threadId);
            continue;
          }
          await wait(400);
          latest = await listRunsLatestHTTPWithStatus(threadId);
        }

        if (latest && activeStates.has(latest.status)) {
          return new Response(
            JSON.stringify({
              reply:
                "I’m very sorry, but there’s been a technical problem on my side generating your PDF report just now. I don’t have a downloadable report link at the moment.\n\n" +
                "If it’s helpful, I can provide a full written summary here in the chat that you can save or screenshot, or attempt the PDF generation again later while I work on fixing the issue.\n\n" +
                "Please let me know how you’d like to proceed. I’m here to help however I can.",
              threadId,
              runId: latest.id,
              status: latest.status,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
      }
    }

    // Try to preload a prior canonical report URL (for "send link again" turns)
    const priorUrl = await findLatestReportUrlFromThread(client, threadId);
    if (priorUrl) {
      lastToolResult = { downloadUrl: priorUrl };
    }

    // 3) Add user message
    await client.beta.threads.messages.create(threadId, {
      role: "user",
      content: prompt,
    });

    // 4) Create a run
    const createdRun = await client.beta.threads.runs.create(threadId, {
      assistant_id: process.env.OPENAI_ASSISTANT_ID!,
    });
    console.log("[chat] createdRun raw", createdRun);

    type CreatedRunLike = { id?: string; thread_id?: string; status?: RunStatus };
    let runId = (createdRun as CreatedRunLike).id || "";
    const runThreadId = (createdRun as CreatedRunLike).thread_id || "";

    if (runThreadId && runThreadId.startsWith("thread_")) {
      threadId = runThreadId;
    }
    if (!runId || !runId.startsWith("run_")) {
      runId = await listRunsLatestHTTP(threadId);
    }
    if (!runId.startsWith("run_")) {
      return new Response(
        JSON.stringify({ error: "Invalid runId created/listed", threadId, runId }),
        { status: 500 }
      );
    }

    // 5) Poll run until completed (45s timeout)
    let status: RunStatus = (createdRun as CreatedRunLike).status || "queued";
    const deadline = Date.now() + 45_000;

    while (status !== "completed") {
      if (Date.now() > deadline) {
        if (lastToolResult?.downloadUrl) {
          const url = String(lastToolResult.downloadUrl);
          const finalReply =
            `Ok, I've created your report! You can download it here:\n\n` +
            `[Download your report here.](${url})\n\n` +
            `This link will be available for about 48 hours.\n\n` +
            `Is there anything else you'd like me to assist you with?\n\n`;
          return new Response(
            JSON.stringify({ reply: finalReply, threadId }),
            { status: 200 }
          );
        }
        return new Response(
          JSON.stringify({
            error: "Run polling timed out",
            threadId,
            runId,
            lastKnownStatus: status,
          }),
          { status: 504 }
        );
      }

      await wait(400);

      // Guard against accidental undefined threadId
      if (!threadId || !threadId.startsWith("thread_")) {
        return new Response(
          JSON.stringify({ error: "threadId lost before retrieve", threadId, runId }),
          { status: 500 }
        );
      }

      console.log("[chat] about-to-retrieve", {
        threadId,
        runId,
        types: { thread: typeof threadId, run: typeof runId },
      });

      try {
        const refreshed = await retrieveRunHTTP(threadId, runId);
        status = refreshed.status;

        if (status === "requires_action") {
          console.log("[chat] run requires_action – inspecting tool calls…");
          const toolCalls: ToolFunctionCall[] =
            refreshed?.required_action?.submit_tool_outputs?.tool_calls ?? [];
          const tool_outputs: Array<{ tool_call_id: string; output: string }> = [];

          for (const call of toolCalls) {
            if (handledToolCallIds.has(call.id)) continue;
            if (call?.type !== "function" || !call?.function) continue;
            if (call.function.name !== "generate_summary_pdf") continue;

            let args: Record<string, unknown> = {};
            try {
              args = JSON.parse(call.function.arguments ?? "{}") as Record<string, unknown>;
            } catch {
              /* ignore bad JSON */
            }

            const payload = {
              uid: undefined as unknown as string | undefined,
              threadId: String(threadId),
              patientName: String(args.patient_name ?? ""),
              symptomSummary: String(args.symptom_summary ?? ""),
              previousTreatments: String(args.previous_treatments ?? ""),
              socialFactors: String(args.social_factors ?? ""),
              treatmentRecommended: String(args.treatment_recommended ?? ""),
              treatmentExplanation: String(args.treatment_explanation ?? ""),
              questionsForDoctor: String(args.questions_for_doctor ?? ""),
              sessionId: `assistants-${Date.now()}`,
            };

            if (!PDF_FUNCTION_URL) {
              console.error("[chat] Missing PDF_FUNCTION_URL env, cannot generate report");
            }

            let outputText = "";
            try {
              const resp = await fetch(PDF_FUNCTION_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                cache: "no-store",
                body: JSON.stringify(payload),
              });
              const raw = await resp.text();
              console.log("[chat] CF create-report status:", resp.status);
              console.log("[chat] CF create-report body:", raw);

              let data: { ok?: boolean; downloadUrl?: string; error?: unknown } | null = null;
              try {
                data = raw ? (JSON.parse(raw) as typeof data) : null;
              } catch {
                /* ignore */
              }
              lastToolResult = data || lastToolResult;

              if (resp.ok && data?.ok && typeof data.downloadUrl === "string" && data.downloadUrl) {
                outputText = data.downloadUrl;
              } else if (data?.error) {
                outputText = `ERROR: ${String(data.error)}`;
              } else {
                outputText = `ERROR: PDF function responded without a URL (status ${resp.status}).`;
              }
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : String(e);
              outputText = `ERROR: ${msg}`;
            }

            tool_outputs.push({
              tool_call_id: call.id,
              output:
                outputText && outputText.startsWith("ERROR:")
                  ? outputText
                  : outputText || "REPORT_READY",
            });
            handledToolCallIds.add(call.id);
          }

          if (tool_outputs.length) {
            try {
              await submitToolOutputsCompat(client, threadId, runId, tool_outputs);
            } catch (e) {
              console.warn(
                "[chat] non-fatal: submitToolOutputsCompat failed after tool_outputs",
                e
              );
            }
            continue; // let Assistant finish message; keep polling
          }
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn("[chat] retrieve error", msg, { threadId, runId });

        if (
          /Cannot destructure property 'thread_id' of 'params' as it is undefined/i.test(
            msg
          )
        ) {
          try {
            const latestId = await listRunsLatestHTTP(threadId);
            if (latestId && latestId.startsWith("run_")) {
              runId = latestId;
            }
          } catch {
            /* ignore */
          }
          await wait(1000);
          continue;
        }

        return new Response(
          JSON.stringify({
            error: "runs.retrieve threw",
            message: msg,
            threadId,
            runId,
          }),
          { status: 500 }
        );
      }

      if (status === "failed" || status === "cancelled" || status === "expired") {
        return new Response(
          JSON.stringify({ error: `Run ${status}`, threadId, runId }),
          { status: 500 }
        );
      }
    }

    // 6) Read latest assistant text
    const list = await client.beta.threads.messages.list(threadId, {
      order: "desc",
      limit: 15,
    });
    const assistantMsg = (list.data as unknown as ThreadMessage[]).find(
      (m) =>
        m.role === "assistant" &&
        Array.isArray(m.content) &&
        m.content.some(
          (c) => (c as TextContent)?.type === "text" && (c as TextContent).text?.value
        )
    );
    const reply = assistantMsg ? extractTextFromMessage(assistantMsg) : "";

    // Sanitize/normalize links if we have a canonical downloadUrl
    let sanitizedReply = reply;
    const canonicalUrl = lastToolResult?.downloadUrl ? String(lastToolResult.downloadUrl) : "";
    if (canonicalUrl) {
      sanitizedReply = sanitizedReply.replace(
        /\[(.*?)\]\(sandbox:\/download\/[^\)]+\)/gi,
        `[$1](${canonicalUrl})`
      );
      sanitizedReply = sanitizedReply.replace(/sandbox:\/download\/\S+/gi, canonicalUrl);
      sanitizedReply = sanitizedReply.replace(
        /\[(.*?)\]\((https?:\/\/[^\s)]+)\)/gi,
        (m, text) => {
          const t = String(text || "");
          if (/download|report/i.test(t)) {
            return `[${t}](${canonicalUrl})`;
          }
          return m;
        }
      );
      sanitizedReply = sanitizedReply.replace(/^(https?:\/\/[^\s)]+)\s*$/gmi, () => canonicalUrl);
    }

    let finalReply = sanitizedReply;
    if (!finalReply && lastToolResult?.downloadUrl) {
      const url = String(lastToolResult.downloadUrl);
      finalReply =
        `Ok, I've created your report! You can download it here:\n\n` +
        `[Download your report here.](${url})\n\n` +
        `This link will be available for about 48 hours.\n` +
        `Is there anything else you'd like me to assist you with?\n\n`;
    }
    if (!finalReply) {
      finalReply =
        "The report was generated, but I couldn’t retrieve the message. Please try again.";
    }

    if (assistantMsg && extractTextFromMessage(assistantMsg)) {
      return new Response(JSON.stringify({ reply: finalReply, threadId }), {
        status: 200,
      });
    }
    try {
      await client.beta.threads.messages.create(threadId, {
        role: "assistant",
        content: finalReply,
      });
    } catch (e) {
      console.warn("[chat] failed to append finalReply to thread", e);
    }
    return new Response(JSON.stringify({ reply: finalReply, threadId }), {
      status: 200,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg ?? "Unknown error" }), {
      status: 500,
    });
  }
}
