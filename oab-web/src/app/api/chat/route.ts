import OpenAI from "openai";

type PdfFunctionResult = {
  ok?: boolean;
  downloadUrl?: string;
  storagePath?: string;
  error?: unknown;
  expiresAt?: number;
};

type ResponseLike = {
  id?: string;
  output_text?: string;
  previous_response_id?: string | null;
  error?: { message?: string } | null;
  output?: Array<Record<string, unknown>>;
};

type ResponseFunctionToolCallLike = {
  type: "function_call";
  call_id: string;
  name: string;
  arguments: string;
};

const PDF_FUNCTION_URL = process.env.PDF_FUNCTION_URL || "";
const RESPONSE_PROMPT_ID =
  process.env.OPENAI_RESPONSE_PROMPT_ID ||
  "pmpt_69b6c6d563b48190abc1ff491758a65603e2489b1acb8ca8";
const RESPONSE_PROMPT_VERSION =
  process.env.OPENAI_RESPONSE_PROMPT_VERSION || "14";
const RESPONSE_VECTOR_STORE_ID =
  process.env.OPENAI_VECTOR_STORE_ID || "vs_69b72bdacc608191bca56976c10d9c64";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit & { timeoutMs?: number } = {}
) {
  const { timeoutMs = 20_000, ...rest } = init;
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeoutMs);
  return fetch(input, { ...rest, signal: ctrl.signal }).finally(() =>
    clearTimeout(tid)
  );
}

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
    /\b(send|give|provide|share|show)\b.*\b(link|report|pdf)\b/.test(t) ||
    /\bdownload\b.*\b(report|pdf)\b/.test(t) ||
    (/\blink\b/.test(t) && /\b(report|pdf)\b/.test(t))
  );
}

function extractUrls(text: string): string[] {
  if (!text) return [];
  const urls: string[] = [];
  const re = /\bhttps?:\/\/[^\s)]+/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    urls.push(match[0]);
  }
  return urls;
}

function parsePdfFunctionResult(raw: string): PdfFunctionResult | null {
  try {
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (!parsed || typeof parsed !== "object") return null;
    const data = parsed as Partial<PdfFunctionResult>;
    return {
      ok: typeof data.ok === "boolean" ? data.ok : undefined,
      downloadUrl:
        typeof data.downloadUrl === "string" ? data.downloadUrl : undefined,
      storagePath:
        typeof data.storagePath === "string" ? data.storagePath : undefined,
      error: data.error,
      expiresAt:
        typeof data.expiresAt === "number" ? data.expiresAt : undefined,
    };
  } catch {
    return null;
  }
}

function extractTextFromResponse(response: ResponseLike | null): string {
  if (!response) return "";
  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }
  const parts: string[] = [];
  for (const item of response.output ?? []) {
    if (item?.type !== "message") continue;
    const content = Array.isArray(item.content)
      ? (item.content as Array<Record<string, unknown>>)
      : [];
    for (const part of content) {
      if (part?.type === "output_text" && typeof part.text === "string") {
        parts.push(part.text);
      }
    }
  }
  return parts.join("\n").trim();
}

function getFunctionCalls(response: ResponseLike | null): ResponseFunctionToolCallLike[] {
  const calls: ResponseFunctionToolCallLike[] = [];
  for (const item of response?.output ?? []) {
    if (
      item?.type === "function_call" &&
      typeof item.call_id === "string" &&
      typeof item.name === "string" &&
      typeof item.arguments === "string"
    ) {
      calls.push(item as unknown as ResponseFunctionToolCallLike);
    }
  }
  return calls;
}

async function findLatestReportUrlFromResponseChain(
  client: OpenAI,
  responseId: string
): Promise<string> {
  let currentId = responseId;
  for (let i = 0; i < 30 && currentId; i++) {
    try {
      const response = (await client.responses.retrieve(
        currentId
      )) as unknown as ResponseLike;
      const text = extractTextFromResponse(response);
      const urls = extractUrls(text);
      const winner = urls.find(
        (url) =>
          /https:\/\/storage\.googleapis\.com\//i.test(url) ||
          /firebasestorage\.app/i.test(url)
      );
      if (winner) return winner;
      currentId =
        typeof response.previous_response_id === "string"
          ? response.previous_response_id
          : "";
    } catch {
      return "";
    }
  }
  return "";
}

function buildResponsesTools() {
  return [
    {
      type: "function" as const,
      description:
        "Create a downloadable PDF summary of the user's OAB discussion and preferences, store it in Firebase Storage, and return a short-lived download URL.",
      name: "generate_summary_pdf",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          patient_name: {
            type: "string",
            description:
              "User's first name or initials as they prefer to appear on the report.",
          },
          symptom_summary: {
            type: "string",
            description:
              "Clear summary of urinary symptoms, severity or frequency, pad use, and relevant scores.",
          },
          previous_treatments: {
            type: "string",
            description:
              "Treatments tried to date and their outcomes or side-effects.",
          },
          social_factors: {
            type: "string",
            description:
              "Personal or practical factors that affect treatment suitability.",
          },
          treatment_recommended: {
            type: "string",
            description:
              "The most suitable treatment recommendation for this user based on the discussion and their preferences.",
          },
          treatment_explanation: {
            type: "string",
            description:
              "Why this recommendation suits their case, including benefits, trade-offs, and logistics.",
          },
          questions_for_doctor: {
            type: "string",
            description:
              "Tailored questions for the user to discuss with their clinician.",
          },
          session_id: {
            type: "string",
            description:
              "Client-side session identifier for grouping reports.",
          },
          uid: {
            type: "string",
            description:
              "Anonymous Firebase Auth UID if available.",
          },
          thread_id: {
            type: "string",
            description:
              "Conversation trace identifier for report generation.",
          },
        },
        required: [
          "patient_name",
          "symptom_summary",
          "previous_treatments",
          "social_factors",
          "treatment_recommended",
          "treatment_explanation",
          "questions_for_doctor",
          "session_id",
        ],
      },
      strict: false,
    },
    {
      type: "file_search" as const,
      vector_store_ids: [RESPONSE_VECTOR_STORE_ID],
    },
  ];
}

async function executeGenerateSummaryPdf(
  call: ResponseFunctionToolCallLike,
  options: {
    traceId: string;
    sessionId: string;
    firebaseIdToken: string;
  }
): Promise<{ call_id: string; output: string }> {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(call.arguments || "{}") as Record<string, unknown>;
  } catch {
    args = {};
  }

  if (!PDF_FUNCTION_URL) {
    return {
      call_id: call.call_id,
      output: JSON.stringify({
        ok: false,
        error: "PDF function endpoint missing: set PDF_FUNCTION_URL",
      }),
    };
  }

  const payload = {
    uid: typeof args.uid === "string" ? args.uid : undefined,
    threadId:
      typeof args.thread_id === "string" && args.thread_id.trim()
        ? args.thread_id
        : options.traceId,
    patientName: String(args.patient_name ?? ""),
    symptomSummary: String(args.symptom_summary ?? ""),
    previousTreatments: String(args.previous_treatments ?? ""),
    socialFactors: String(args.social_factors ?? ""),
    treatmentRecommended: String(args.treatment_recommended ?? ""),
    treatmentExplanation: String(args.treatment_explanation ?? ""),
    questionsForDoctor: String(args.questions_for_doctor ?? ""),
    sessionId: options.sessionId || `responses-${Date.now()}`,
  };

  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (options.firebaseIdToken) {
    headers.Authorization = `Bearer ${options.firebaseIdToken}`;
  }

  try {
    const callPdfFunction = async (requestHeaders: HeadersInit) => {
      let lastResp: Response | null = null;
      let lastRaw = "";
      let lastErr: unknown = null;

      for (let i = 0; i < 3; i++) {
        try {
          const resp = await fetchWithTimeout(PDF_FUNCTION_URL, {
            method: "POST",
            headers: requestHeaders,
            cache: "no-store",
            body: JSON.stringify(payload),
            timeoutMs: 20_000,
          });
          const raw = await resp.text();
          console.log("[chat] PDF function status:", resp.status);
          console.log("[chat] PDF function body:", raw);

          lastResp = resp;
          lastRaw = raw;

          if (resp.status >= 500 || resp.status === 429) {
            lastErr = new Error(`HTTP ${resp.status}`);
            await wait(400 * Math.pow(2, i));
            continue;
          }

          return { resp, raw, data: parsePdfFunctionResult(raw) };
        } catch (err: unknown) {
          lastErr = err;
          await wait(400 * Math.pow(2, i));
        }
      }

      return {
        resp: lastResp,
        raw: lastRaw,
        data: parsePdfFunctionResult(lastRaw),
        error:
          lastErr instanceof Error ? lastErr.message : String(lastErr ?? ""),
      };
    };

    let { resp, raw, data, error } = await callPdfFunction(headers);

    // Backward compatibility:
    // the currently deployed Firebase function returns only storagePath for
    // authenticated requests, so retry once without auth to get a signed URL.
    if (
      options.firebaseIdToken
    ) {
      const shouldRetryWithoutAuth =
        !resp ||
        !resp.ok ||
        (data?.ok && !data.downloadUrl && !!data.storagePath);

      if (shouldRetryWithoutAuth) {
        console.log(
          "[chat] Retrying PDF function without auth header after auth attempt failed or returned no usable link"
        );
        const retry = await callPdfFunction({ "Content-Type": "application/json" });
        if (retry.resp?.ok) {
          data = {
            ...(retry.data ?? {}),
            storagePath: data?.storagePath ?? retry.data?.storagePath,
          };
          resp = retry.resp;
          raw = retry.raw;
          error = retry.error;
        }
      }
    }

    if (!resp?.ok) {
      const detail =
        (data && typeof data.error !== "undefined" && String(data.error)) ||
        raw ||
        error ||
        `PDF function error ${resp?.status ?? "unknown"}`;
      return {
        call_id: call.call_id,
        output: JSON.stringify({
          ok: false,
          error: detail,
        }),
      };
    }

    return {
      call_id: call.call_id,
      output: JSON.stringify(
        data ?? {
          ok: false,
          error: "PDF function responded without a parseable JSON body",
        }
      ),
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      call_id: call.call_id,
      output: JSON.stringify({ ok: false, error: msg }),
    };
  }
}

function extractPdfResultFromToolOutput(output: string): PdfFunctionResult | null {
  return parsePdfFunctionResult(output);
}

function buildFallbackReply(url: string): string {
  return (
    `Ok, I've created your report! You can download it here:\n\n` +
    `[Download your report here.](${url})\n\n` +
    `This link will be available for about 48 hours.\n\n` +
    `Is there anything else you'd like me to assist you with?\n\n`
  );
}

function soundsLikePdfFailure(text: string): boolean {
  const t = text.toLowerCase();
  return (
    /server error/.test(t) ||
    /technical problem/.test(t) ||
    /tried to create/.test(t) ||
    /couldn't create/.test(t) ||
    /could not create/.test(t) ||
    /try generating the pdf again/.test(t) ||
    /paste the full written report/.test(t) ||
    /downloadable pdf three times/.test(t)
  );
}

export async function POST(req: Request) {
  try {
    const body = ((await req.json().catch(() => ({}))) ?? {}) as {
      prompt?: string;
      threadId?: string | null;
      newSession?: boolean;
      sessionId?: string | null;
      firebaseIdToken?: string | null;
    };

    const prompt = String(body.prompt ?? "");
    let threadId = String(body.threadId ?? "");
    const newSession = !!body.newSession;
    const sessionId =
      typeof body.sessionId === "string" && body.sessionId.trim()
        ? body.sessionId.trim()
        : `chat-${Date.now()}`;
    const firebaseIdToken =
      typeof body.firebaseIdToken === "string" ? body.firebaseIdToken.trim() : "";

    if (threadId === "null" || threadId === "undefined") threadId = "";
    if (threadId.startsWith("thread_")) threadId = "";
    if (newSession) threadId = "";

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

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    if (threadId) {
      try {
        await client.responses.retrieve(threadId);
      } catch {
        threadId = "";
      }
    }

    const wantNewReport = isNewReportRequest(prompt);
    const wantLinkOnly = !wantNewReport && isSendLinkRequest(prompt);
    let lastToolResult: PdfFunctionResult | null = null;
    const priorUrl =
      wantLinkOnly && threadId
        ? await findLatestReportUrlFromResponseChain(client, threadId)
        : "";
    if (priorUrl) {
      lastToolResult = { ok: true, downloadUrl: priorUrl };
    }

    let response = (await client.responses.create({
      prompt: {
        id: RESPONSE_PROMPT_ID,
        version: RESPONSE_PROMPT_VERSION,
      },
      input: prompt,
      previous_response_id: threadId || undefined,
      reasoning: {
        summary: "auto",
      },
      tools: buildResponsesTools(),
      store: true,
      include: [
        "reasoning.encrypted_content",
      ],
      metadata: {
        app: "oab-web",
        chat_api: "responses",
      },
    })) as unknown as ResponseLike;

    const handledCallIds = new Set<string>();
    const deadline = Date.now() + 45_000;

    while (Date.now() < deadline) {
      if (response.error?.message) {
        throw new Error(response.error.message);
      }

      const functionCalls = getFunctionCalls(response).filter(
        (call) => !handledCallIds.has(call.call_id)
      );

      if (!functionCalls.length) break;

      const toolOutputs: Array<{
        type: "function_call_output";
        call_id: string;
        output: string;
      }> = [];

      for (const call of functionCalls) {
        if (call.name !== "generate_summary_pdf") {
          toolOutputs.push({
            type: "function_call_output",
            call_id: call.call_id,
            output: JSON.stringify({
              ok: false,
              error: `Unsupported function: ${call.name}`,
            }),
          });
          handledCallIds.add(call.call_id);
          continue;
        }

        const result = await executeGenerateSummaryPdf(call, {
          traceId: response.id || threadId || "",
          sessionId,
          firebaseIdToken,
        });
        const parsedResult = extractPdfResultFromToolOutput(result.output);
        if (parsedResult) {
          lastToolResult = parsedResult;
        }
        toolOutputs.push({
          type: "function_call_output",
          call_id: result.call_id,
          output: result.output,
        });
        handledCallIds.add(call.call_id);
      }

      response = (await client.responses.create({
        prompt: {
          id: RESPONSE_PROMPT_ID,
          version: RESPONSE_PROMPT_VERSION,
        },
        previous_response_id: response.id,
        input: toolOutputs,
        reasoning: {
          summary: "auto",
        },
        tools: buildResponsesTools(),
        store: true,
        include: [
          "reasoning.encrypted_content",
        ],
        metadata: {
          app: "oab-web",
          chat_api: "responses",
        },
      })) as unknown as ResponseLike;
    }

    if (Date.now() >= deadline) {
      if (lastToolResult?.downloadUrl) {
        return new Response(
          JSON.stringify({
            reply: buildFallbackReply(String(lastToolResult.downloadUrl)),
            threadId: response.id || threadId,
          }),
          { status: 200 }
        );
      }
      return new Response(
        JSON.stringify({
          reply:
            "I’m very sorry, but there’s been a technical problem on my side generating your PDF report just now. I don’t have a downloadable report link at the moment.\n\n" +
            "If it’s helpful, I can provide a full written summary here in the chat that you can save or screenshot, or attempt the PDF generation again later while I work on fixing the issue.\n\n" +
            "Please let me know how you’d like to proceed. I’m here to help however I can.",
          threadId: response.id || threadId,
        }),
        { status: 200 }
      );
    }

    const finalThreadId = String(response.id || threadId || "");
    let finalReply = extractTextFromResponse(response);
    const canonicalUrl = String(
      lastToolResult?.downloadUrl || priorUrl || ""
    );

    if (canonicalUrl && finalReply && soundsLikePdfFailure(finalReply)) {
      finalReply = buildFallbackReply(canonicalUrl);
    }

    if (canonicalUrl && finalReply) {
      const urls = extractUrls(finalReply);
      if (!urls.length && /download|report/i.test(finalReply)) {
        finalReply =
          `${finalReply.trim()}\n\n` +
          `[Download your report here.](${canonicalUrl})`;
      }
    }

    if (!finalReply && canonicalUrl) {
      finalReply = buildFallbackReply(canonicalUrl);
    }
    if (!finalReply && lastToolResult?.storagePath) {
      finalReply =
        "The PDF was written to Firebase Storage, but I couldn't resolve " +
        "a download URL from the endpoint response.\n\n" +
        `Storage path: ${lastToolResult.storagePath}`;
    }
    if (!finalReply) {
      finalReply =
        "The report was generated, but I couldn’t retrieve the message. Please try again.";
    }

    return new Response(
      JSON.stringify({
        reply: finalReply,
        threadId: finalThreadId,
      }),
      { status: 200 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg ?? "Unknown error" }), {
      status: 500,
    });
  }
}
