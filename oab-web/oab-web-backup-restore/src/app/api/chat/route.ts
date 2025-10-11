// import { url } from "inspector";
import OpenAI from "openai";

// Module-level set to avoid re-processing duplicate tool call IDs
const handledToolCallIds = new Set<string>();

// Cloud Function endpoint for PDF generation (assistant-led flow)
const PDF_FUNCTION_URL = process.env.PDF_FUNCTION_URL || "";

// --- Simple intent helpers (module scope) ---
function isNewReportRequest(text: string): boolean {
  const t = (text || "").toLowerCase();
  return (/(^|\b)(new|another|fresh)\s+(pdf|report)\b/.test(t)) ||
         ((/generate|make|create/.test(t)) && /\b(report|pdf)\b/.test(t));
}
function isSendLinkRequest(text: string): boolean {
  const t = (text || "").toLowerCase();
  return (/\b(send|give|provide|share|show)\b.*\b(link|report|pdf)\b/.test(t)) ||
         (/\bdownload\b.*\b(report|pdf)\b/.test(t)) ||
         (/\blink\b/.test(t) && /\b(report|pdf)\b/.test(t));
}

console.log("[chat-route] loaded v8 (thread isolation + reset)");
// NOTE: The "requires_action" handling lives inside the polling loop in step (4) below. Search for "status === \"requires_action\"" to jump to it.

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // always run on server, no caching
export const maxDuration = 60;          // seconds (adjust to your Vercel plan)

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function internalUrl(req: Request, path: string) {
  const u = new URL(req.url);
  u.pathname = path;
  u.search = "";
  return u.toString();
}

function extractTextFromMessage(msg: any): string {
  if (!msg || !Array.isArray(msg.content)) return "";
  const parts: string[] = [];
  for (const part of msg.content) {
    if (part?.type === "text" && typeof part?.text?.value === "string") {
      parts.push(part.text.value);
    }
  }
  return parts.join("\n").trim();
}

function extractUrls(text: string): string[] {
  if (!text) return [];
  const urls: string[] = [];
  const re = /\bhttps?:\/\/[^\s)]+/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    urls.push(m[0]);
  }
  return urls;
}

async function findLatestReportUrlFromThread(client: OpenAI, threadId: string): Promise<string | "" > {
  try {
    const list = await client.beta.threads.messages.list(threadId, { order: "desc", limit: 30 });
    for (const m of list.data) {
      if (!Array.isArray(m?.content)) continue;
      for (const c of m.content) {
        if (c?.type === "text" && c?.text?.value) {
          const t = String(c.text.value);
          // Prefer messages that explicitly mention download/report
          if (/download|report/i.test(t)) {
            const urls = extractUrls(t);
            const winner = urls.find(u =>
              /https:\/\/storage\.googleapis\.com\//i.test(u) ||
              /firebasestorage\.app/i.test(u)
            );
            if (winner) return winner;
          }
        }
      }
    }
  } catch {}
  return "";
}

async function retrieveRunHTTP(threadId: string, runId: string): Promise<any> {
  const res = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${runId}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
      "OpenAI-Beta": "assistants=v2",
    },
    // Ensure Node fetch, not Next caching
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`HTTP retrieve failed ${res.status}: ${err}`);
  }
  return await res.json();
}

async function listRunsLatestHTTP(threadId: string): Promise<string> {
  const url = new URL(`https://api.openai.com/v1/threads/${threadId}/runs`);
  url.searchParams.set("limit", "1");
  url.searchParams.set("order", "desc");
  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
      "OpenAI-Beta": "assistants=v2",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`HTTP list failed ${res.status}: ${err}`);
  }
  const data: any = await res.json();
  return data?.data?.[0]?.id || "";
}

async function listRunsLatestHTTPWithStatus(threadId: string): Promise<{ id: string; status: string } | null> {
  const url = new URL(`https://api.openai.com/v1/threads/${threadId}/runs`);
  url.searchParams.set("limit", "1");
  url.searchParams.set("order", "desc");
  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
      "OpenAI-Beta": "assistants=v2",
    },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data: any = await res.json();
  const r = data?.data?.[0];
  return r ? { id: r.id, status: r.status } : null;
}

async function cancelRunHTTP(threadId: string, runId: string) {
  const res = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${runId}/cancel`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
      "OpenAI-Beta": "assistants=v2",
    },
  });
  return res.ok;
}

// Compatibility helper for submitToolOutputs — use direct HTTP to avoid SDK signature/typing differences
async function submitToolOutputsCompat(
  client: OpenAI, // kept for signature compatibility (unused)
  threadId: string,
  runId: string,
  tool_outputs: Array<{ tool_call_id: string; output: string }>
) {
  try {
    const res = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${runId}/submit_tool_outputs`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
        "OpenAI-Beta": "assistants=v2",
      },
      cache: "no-store",
      body: JSON.stringify({ tool_outputs }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP submit_tool_outputs failed ${res.status}: ${text}`);
    }
    return await res.json();
  } catch (err) {
    console.error("[chat] submitToolOutputsCompat failed (HTTP)", err, { threadId, runId, tool_outputs });
    throw err;
  }
}

async function handleRequiredActionNow(
  client: OpenAI,
  req: Request,
  threadId: string,
  runId: string
): Promise<void> {
  // Fetch full run to read tool calls
  const run: any = await retrieveRunHTTP(threadId, runId);
  const toolCalls = run?.required_action?.submit_tool_outputs?.tool_calls ?? [];
  console.log("[chat] handleRequiredActionNow: toolCalls", JSON.stringify(toolCalls?.map((t:any)=>({id:t?.id,name:t?.function?.name,type:t?.type}))));
  if (!toolCalls.length) return;

  const tool_outputs: Array<{ tool_call_id: string; output: string }> = [];

  for (const call of toolCalls) {
    // Skip duplicate tool calls
    if (handledToolCallIds.has(call.id)) continue;
    if (call?.type !== "function" || !call?.function) continue;
    const fn = call.function;
    if (fn.name !== "generate_summary_pdf") continue;

    // Parse args coming from the Assistant
    let args: any = {};
    try { args = JSON.parse(fn.arguments || "{}"); } catch {}

    const payload = {
      uid: undefined, // anon; your API returns signed URL
      threadId: String(threadId),
      patientName: (args.patient_name ?? "").toString(),
      symptomSummary: (args.symptom_summary ?? "").toString(),
      previousTreatments: (args.previous_treatments ?? "").toString(),
      socialFactors: (args.social_factors ?? "").toString(),
      treatmentRecommended: (args.treatment_recommended ?? "").toString(),
      treatmentExplanation: (args.treatment_explanation ?? "").toString(),
      questionsForDoctor: (args.questions_for_doctor ?? "").toString(),
      sessionId: `assistants-${Date.now()}`,
    };

    // Call Cloud Function directly (assistant-led URL delivery)
    if (!PDF_FUNCTION_URL) {
      console.error("[chat] Missing PDF_FUNCTION_URL env, cannot generate report");
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
      let data: any = null;
      try { data = raw ? JSON.parse(raw) : null; } catch {}
      if (resp.ok && data?.ok && typeof data?.downloadUrl === "string" && data.downloadUrl) {
        outputText = String(data.downloadUrl); // send the actual signed URL back to the Assistant
      } else if (data?.error) {
        outputText = `ERROR: ${String(data.error)}`;
      } else {
        outputText = `ERROR: PDF function responded without a URL (status ${resp.status}).`;
      }
    } catch (e: any) {
      console.error("[chat] CF create-report fetch failed:", e);
      outputText = `ERROR: ${e?.message || String(e)}`;
    }

    tool_outputs.push({
      tool_call_id: call.id,
      output: (outputText && outputText.startsWith("ERROR:"))
        ? outputText
        : (outputText || "REPORT_READY"),
    });
    // Record this tool call as handled
    handledToolCallIds.add(call.id);
  }

  if (tool_outputs.length) {
    console.log("[chat] handleRequiredActionNow: submitting tool_outputs", tool_outputs);
    try {
      await submitToolOutputsCompat(client, threadId, runId, tool_outputs);
    } catch (e) {
      console.warn("[chat] non-fatal: submitToolOutputsCompat failed in handleRequiredActionNow", e);
    }
  }
  return;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      prompt?: string;
      threadId?: string | null;
      /** When true, force a brand-new thread for this request */
      newSession?: boolean;
    };
    let lastToolResult: any = null;
    // Track whether this user turn is a "report" turn (link should be server-returned, not assistant-authored)
    let isReportTurn = false;

    const prompt = (body?.prompt ?? "").toString();
    let threadId = (body?.threadId ?? "").toString();
    const newSession = !!body?.newSession;

    // Clear any remembered tool call ids for this request
    handledToolCallIds.clear();

    // Normalize accidental literal strings or explicit reset
    if (threadId === "null" || threadId === "undefined") threadId = "";
    if (newSession) threadId = ""; // force a fresh thread for a new assessment/session

    // Allow a lightweight text command to reset (useful during local testing)
    if (prompt.trim().toLowerCase() === "/reset") {
      return new Response(JSON.stringify({ reply: "Session reset. Please say hello to begin.", threadId: "" }), { status: 200 });
    }

    if (!prompt) {
      return new Response(JSON.stringify({ error: "Missing prompt" }), { status: 400 });
    }
    if (!process.env.OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing OPENAI_API_KEY" }), { status: 500 });
    }
    if (!process.env.OPENAI_ASSISTANT_ID) {
      return new Response(JSON.stringify({ error: "Missing OPENAI_ASSISTANT_ID" }), { status: 500 });
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
      threadId = (th as any).id || "";
    }
    if (!threadId || !threadId.startsWith("thread_")) {
      return new Response(JSON.stringify({ error: "Invalid threadId", threadId }), { status: 500 });
    }

    // 2) Add user message

    // --- Intent routing & active-run control (minimal change) ---
    const wantNewReport = isNewReportRequest(prompt);
    const wantLinkOnly  = !wantNewReport && isSendLinkRequest(prompt);
    isReportTurn = wantNewReport || wantLinkOnly;

    // If user is just chatting (not asking for PDF/link), proactively cancel any lingering active run so the thread is free.
    try {
      if (!wantNewReport && !wantLinkOnly) {
        const latestMaybe = await listRunsLatestHTTPWithStatus(threadId);
        const activeStates = new Set(["queued", "in_progress", "requires_action"]);
        if (latestMaybe && activeStates.has(latestMaybe.status)) {
          await cancelRunHTTP(threadId, latestMaybe.id);
        }
      }
    } catch {}

    // Guard: if the latest run on this thread is still active, try to finish it (incl. tool calls) or return a soft-busy payload
    if (threadId) {
      const activeStates = new Set(["queued", "in_progress", "requires_action"]);
      let latest = await listRunsLatestHTTPWithStatus(threadId);

      if (latest && activeStates.has(latest.status)) {
        const start = Date.now();

        while (latest && activeStates.has(latest.status) && Date.now() - start < 20_000) {
          // If the run is waiting on tool output, handle it now (this prevents "requires_action" stalls
          // when the Assistant has already asked to call our PDF function).
          if (latest.status === "requires_action") {
            try {
              await handleRequiredActionNow(client, req, threadId, latest.id);
            } catch (e) {
              console.warn("[chat] handleRequiredActionNow (pre-message) failed:", e);
            }
            // 🔄 Refresh run status after submitting tool outputs and let the Assistant finish the turn
            latest = await listRunsLatestHTTPWithStatus(threadId);
            continue;
          }

          // Only return an interim "generating" notice if it's STILL waiting on tools
          if (latest && latest.status === "requires_action") {
          // We handled required_action above; continue polling without surfacing interim messages.
          }

          await wait(400);
          latest = await listRunsLatestHTTPWithStatus(threadId);
        }

        // If it's *still* running, respond with a friendly busy signal so the client can retry soon.
        if (latest && activeStates.has(latest.status)) {
          return new Response(
            JSON.stringify({
              reply:
                "I’m very sorry, but there’s been a technical problem on my side generating your PDF report just now. I don’t have a downloadable report link at the moment.\n\n" +
                "If it’s helpful, I can provide a full written summary here in the chat that you can save or screenshot, or attempt the PDF generation again later while I work on fixing the issue.\n\n" +
                "Please let me know how you’d like to proceed. I’m here to help however I can.",
              threadId,
              runId: latest.id,
              status: latest.status
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
      }
    }
    // Try to preload a prior canonical report URL from the thread (helps on follow-up "send me the link" turns)
    const priorUrl = await findLatestReportUrlFromThread(client, threadId);
    if (priorUrl) {
      lastToolResult = { downloadUrl: priorUrl };
    }
    await client.beta.threads.messages.create(threadId, {
      role: "user",
      content: prompt,
    });

    // 3) Create a run
    const createdRun = await client.beta.threads.runs.create(threadId, {
      assistant_id: process.env.OPENAI_ASSISTANT_ID!,
    });
    console.log("[chat] createdRun raw", createdRun);

    // Some SDK versions expose both `id` and `thread_id`. Derive safely.
    let runId = (createdRun as any).id || "";
    const runThreadId = (createdRun as any).thread_id || "";

    // If the run object told us the thread id, trust it.
    if (runThreadId && runThreadId.startsWith("thread_")) {
      threadId = runThreadId;
    }

    // If the returned id isn't a run id, fetch the latest runs and pick a valid run_…
    if (!runId || !runId.startsWith("run_")) {
      runId = await listRunsLatestHTTP(threadId);
    }

    if (!runId.startsWith("run_")) {
      return new Response(
        JSON.stringify({ error: "Invalid runId created/listed", threadId, runId }),
        { status: 500 }
      );
    }

    // 4) Poll run until completed (45s timeout)
    let status = (createdRun as any).status || "queued";
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
          return new Response(JSON.stringify({ reply: finalReply, threadId }), { status: 200 });
        }
        return new Response(JSON.stringify({ error: "Run polling timed out", threadId, runId, lastKnownStatus: status }), { status: 504 });
      }
      await wait(400);

      // Guard against accidental undefined threadId
      if (!threadId || !threadId.startsWith("thread_")) {
        return new Response(JSON.stringify({ error: "threadId lost before retrieve", threadId, runId }), { status: 500 });
      }

      console.log("[chat] about-to-retrieve", { threadId, runId, types: { thread: typeof threadId, run: typeof runId } });

      try {
        const refreshed: any = await retrieveRunHTTP(threadId, runId);
        status = refreshed.status;

        // If the Assistant asked us to call a tool (e.g. generate_summary_pdf), do it here.
        if (status === "requires_action") {
          console.log("[chat] run requires_action – inspecting tool calls…");
          const toolCalls = refreshed?.required_action?.submit_tool_outputs?.tool_calls ?? [];
          const tool_outputs: Array<{ tool_call_id: string; output: string }> = [];

          for (const call of toolCalls) {
            // Skip duplicate tool calls
            if (handledToolCallIds.has(call.id)) continue;
            const isFunc = call?.type === "function";
            const fn = call?.function;
            if (!isFunc || !fn) continue;

            // Only handle our PDF tool
            if (fn.name === "generate_summary_pdf") {
              let args: any = {};
              try {
                args = JSON.parse(fn.arguments || "{}");
              } catch {
                args = {};
              }

              // Map snake_case args from the tool to the API payload the PDF endpoint expects
              const payload = {
                uid: undefined, // anon; your API returns signed URL
                threadId: String(threadId),
                patientName: (args.patient_name ?? "").toString(),
                symptomSummary: (args.symptom_summary ?? "").toString(),
                previousTreatments: (args.previous_treatments ?? "").toString(),
                socialFactors: (args.social_factors ?? "").toString(),
                treatmentRecommended: (args.treatment_recommended ?? "").toString(),
                treatmentExplanation: (args.treatment_explanation ?? "").toString(),
                questionsForDoctor: (args.questions_for_doctor ?? "").toString(),
                sessionId: `assistants-${Date.now()}`,
              };

              // Call Cloud Function directly (assistant-led URL delivery)
              if (!PDF_FUNCTION_URL) {
                console.error("[chat] Missing PDF_FUNCTION_URL env, cannot generate report");
              }
              let outputText = "";
              try {
                const url = PDF_FUNCTION_URL;
                const resp = await fetch(url, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  cache: "no-store",
                  body: JSON.stringify(payload),
                });
                const raw = await resp.text();
                console.log("[chat] CF create-report status:", resp.status);
                console.log("[chat] CF create-report body:", raw);
                let data: any = null;
                try { data = raw ? JSON.parse(raw) : null; } catch {}
                lastToolResult = data || lastToolResult;
                if (resp.ok && data?.ok && typeof data?.downloadUrl === "string" && data.downloadUrl) {
                  outputText = String(data.downloadUrl);
                } else if (data?.error) {
                  outputText = `ERROR: ${String(data.error)}`;
                } else {
                  outputText = `ERROR: PDF function responded without a URL (status ${resp.status}).`;
                }
              } catch (e: any) {
                outputText = `ERROR: ${e?.message || String(e)}`;
              }

              // Send the real signed URL back to the Assistant when available; preserve ERROR: paths.
              tool_outputs.push({
                tool_call_id: call.id,
                output: (outputText && outputText.startsWith("ERROR:"))
                  ? outputText
                  : (outputText || "REPORT_READY"),
              });

              // Record this tool call as handled
              handledToolCallIds.add(call.id);
            }
          }

          if (tool_outputs.length) {
            try {
              await submitToolOutputsCompat(client, threadId, runId, tool_outputs);
            } catch (e) {
              console.warn("[chat] non-fatal: submitToolOutputsCompat failed after tool_outputs", e);
            }
            // Let the Assistant compose the final message with the URL it just received via tool output.
            // Keep polling until the run reaches 'completed' or times out; do not return a server-authored message here.
            continue;
          }
        }

      } catch (e: any) {
        const msg = e?.message || String(e);
        console.warn("[chat] retrieve error", msg, { threadId, runId });

        // Known OpenAI SDK quirk: some versions emit
        // "Cannot destructure property 'thread_id' of 'params' as it is undefined."
        // when mixed (object/positional) signatures are used internally.
        // If we see that, treat it as transient: refresh the latest run id
        // and keep polling via our HTTP retriever instead of failing hard.
        if (/Cannot destructure property 'thread_id' of 'params' as it is undefined/i.test(msg)) {
          try {
            const latestId = await listRunsLatestHTTP(threadId);
            if (latestId && latestId.startsWith("run_")) {
              runId = latestId;
            }
          } catch {}
          await wait(1000);
          continue; // retry the loop
        }

        // Any other error -> surface to the client
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
        return new Response(JSON.stringify({ error: `Run ${status}`, threadId, runId }), { status: 500 });
      }
    }

    // 5) Read latest assistant text
    const list = await client.beta.threads.messages.list(threadId, { order: "desc", limit: 15 });
    const assistantMsg = list.data.find(
      (m: any) =>
        m.role === "assistant" &&
        Array.isArray(m.content) &&
        m.content.some((c: any) => c?.type === "text" && c.text?.value)
    );
    const reply = assistantMsg ? extractTextFromMessage(assistantMsg) : "";

    // Sanitize/normalize links in the assistant reply if we have a canonical downloadUrl
    let sanitizedReply = reply;
    const canonicalUrl = lastToolResult?.downloadUrl ? String(lastToolResult.downloadUrl) : "";
    if (canonicalUrl) {
      // 1) Replace sandbox links with the canonical URL
      sanitizedReply = sanitizedReply.replace(
        /\[(.*?)\]\(sandbox:\/download\/[^\)]+\)/gi,
        `[$1](${canonicalUrl})`
      );
      sanitizedReply = sanitizedReply.replace(/sandbox:\/download\/\S+/gi, canonicalUrl);

      // 2) If there is a markdown link whose text suggests it's the report/link (download/report),
      //    force its href to the canonical URL.
      sanitizedReply = sanitizedReply.replace(
        /\[(.*?)\]\((https?:\/\/[^\s)]+)\)/gi,
        (m, text, href) => {
          const t = String(text || "");
          if (/download|report/i.test(t)) {
            return `[${t}](${canonicalUrl})`;
          }
          return m;
        }
      );

      // 3) Replace any google storage link (or any http(s) URL) that isn't the canonical one,
      //    when it appears on its own, with the canonical URL (prevents stale or short links).
      sanitizedReply = sanitizedReply.replace(
        /^(https?:\/\/[^\s)]+)\s*$/gmi,
        (m, href) => {
          return canonicalUrl;
        }
      );
    }

    let finalReply = sanitizedReply;
    // If the assistant didn’t produce text (edge case), fall back to server-authored link when available.
    if (!finalReply && lastToolResult?.downloadUrl) {
      const url = String(lastToolResult.downloadUrl);
      finalReply =
        `Ok, I've created your report! You can download it here:\n\n` +
        `[Download your report here.](${url})\n\n` +
        `This link will be available for about 48 hours.\n` +
        `Is there anything else you'd like me to assist you with?\n\n`;
    }
    if (!finalReply) {
      finalReply = "The report was generated, but I couldn’t retrieve the message. Please try again.";
    }
    // If the assistant already posted a final message with text, skip adding our own copy
    if (assistantMsg && extractTextFromMessage(assistantMsg)) {
      return new Response(JSON.stringify({ reply: finalReply, threadId }), { status: 200 });
    }
    try {
      await client.beta.threads.messages.create(threadId, {
        role: "assistant",
        content: finalReply,
      });
    } catch (e) {
      console.warn("[chat] failed to append finalReply to thread", e);
    }
    return new Response(JSON.stringify({ reply: finalReply, threadId }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? "Unknown error" }), { status: 500 });
  }
}