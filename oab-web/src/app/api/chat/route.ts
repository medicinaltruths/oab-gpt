import OpenAI from "openai";

type PdfFunctionResult = {
  ok?: boolean;
  downloadUrl?: string;
  storagePath?: string;
  error?: unknown;
  expiresAt?: number;
  retentionUntil?: number;
};

type AssessmentUpdate = {
  firstName?: string;
  age?: number;
  sex?: string;
  conversationCompleted?: boolean;
  recommendedTreatment?: string;
  recommendationCategory?: string;
  alternativeRecommendations?: string[];
  recommendationRationale?: string;
  symptomSummary?: string;
  previousTreatments?: string;
  socialFactors?: string;
  reportGenerated?: boolean;
  pdfUrl?: string;
  storagePath?: string;
  pdfDownloadUrlExpiresAt?: number;
  reportRetentionUntil?: number;
  reportExpiryDate?: number;
  promptVersion?: string;
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
  process.env.OPENAI_RESPONSE_PROMPT_VERSION || "15";
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

function normalizeRecommendationCategory(value: string): string {
  const normalized = value.toLowerCase();
  if (normalized.includes("ptns") || normalized.includes("tibial")) return "PTNS";
  if (normalized.includes("botox") || normalized.includes("botulinum")) return "Botox";
  if (normalized.includes("snm") || normalized.includes("sacral")) return "SNM";
  if (normalized.includes("medication") || normalized.includes("medicine")) {
    return "Medication";
  }
  if (
    normalized.includes("conservative") ||
    normalized.includes("bladder training") ||
    normalized.includes("lifestyle")
  ) {
    return "Conservative";
  }
  return value.trim() || "Other";
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

function sanitizeUserFacingText(text: string): string {
  return String(text || "")
    .replace(/(?:filecite|cite)[^]*/gi, "")
    .replace(/【[^】]*(?:filecite|turn\d+(?:file|search)\d+)[^】]*】/gi, "")
    .replace(/\[\s*(?:filecite|cite)[^\]]*\]/gi, "")
    .replace(
      /\bfilecite\b(?:\s*[:：]?\s*(?:turn\d*file\d*|turnfile\s*\d+|[\d,\s-]+))?/gi,
      "",
    )
    .replace(/\bturn\d+(?:file|search)\d+\b/gi, "")
    .replace(/\bturnfile\s*\d+\b/gi, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
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
      retentionUntil:
        typeof data.retentionUntil === "number"
          ? data.retentionUntil
          : undefined,
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
        "Create a downloadable PDF summary of the user's OAB discussion and preferences, store it in Firebase Storage for the assessment retention period, and return its download URL.",
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
          patient_age: {
            type: "number",
            description: "Patient age in years, if stated during the assessment.",
          },
          patient_sex: {
            type: "string",
            description: "Patient sex, if stated during the assessment.",
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
          alternative_recommendations: {
            type: "array",
            items: { type: "string" },
            description:
              "Other reasonable treatment options discussed with the patient.",
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
    assessmentId: string;
    hospitalId: string;
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
    patientAge:
      typeof args.patient_age === "number" ? args.patient_age : undefined,
    patientSex:
      typeof args.patient_sex === "string" ? args.patient_sex : undefined,
    symptomSummary: String(args.symptom_summary ?? ""),
    previousTreatments: String(args.previous_treatments ?? ""),
    socialFactors: String(args.social_factors ?? ""),
    treatmentRecommended: String(args.treatment_recommended ?? ""),
    treatmentExplanation: String(args.treatment_explanation ?? ""),
    alternativeRecommendations: Array.isArray(args.alternative_recommendations)
      ? args.alternative_recommendations.map(String)
      : [],
    questionsForDoctor: String(args.questions_for_doctor ?? ""),
    sessionId: options.sessionId || `responses-${Date.now()}`,
    assessmentId: options.assessmentId,
    hospitalId: options.hospitalId,
    promptVersion: `V${RESPONSE_PROMPT_VERSION}`,
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

function buildReportReply(url: string, channel: "web" | "whatsapp"): string {
  if (channel === "whatsapp") {
    return (
      `Your report is ready.\n\n` +
      `📄 Download your report:\n\n${url}\n\n` +
      `This secure link opens your PDF report.\n\n` +
      `Is there anything else I can help with today?`
    );
  }
  return (
    `Your report is ready.\n\n` +
    `Use the download button below to open your PDF report.`
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
      assessmentId?: string | null;
      hospitalId?: string | null;
      channel?: "web" | "whatsapp" | null;
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
    const assessmentId =
      typeof body.assessmentId === "string" ? body.assessmentId.trim() : "";
    const hospitalId =
      typeof body.hospitalId === "string" && body.hospitalId.trim()
        ? body.hospitalId.trim()
        : "esth";
    const channel = body.channel === "whatsapp" ? "whatsapp" : "web";

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
    let assessmentUpdate: AssessmentUpdate | null = null;
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

        let toolArgs: Record<string, unknown> = {};
        try {
          toolArgs = JSON.parse(call.arguments || "{}") as Record<string, unknown>;
        } catch {
          toolArgs = {};
        }

        const result = await executeGenerateSummaryPdf(call, {
          traceId: response.id || threadId || "",
          sessionId,
          firebaseIdToken,
          assessmentId,
          hospitalId,
        });
        const parsedResult = extractPdfResultFromToolOutput(result.output);
        if (parsedResult) {
          lastToolResult = parsedResult;
          assessmentUpdate = {
            firstName:
              typeof toolArgs.patient_name === "string"
                ? toolArgs.patient_name.trim()
                : undefined,
            age:
              typeof toolArgs.patient_age === "number"
                ? toolArgs.patient_age
                : undefined,
            sex:
              typeof toolArgs.patient_sex === "string"
                ? toolArgs.patient_sex.trim()
                : undefined,
            conversationCompleted: parsedResult.ok === true,
            recommendedTreatment:
              typeof toolArgs.treatment_recommended === "string"
                ? toolArgs.treatment_recommended.trim()
                : undefined,
            recommendationCategory:
              typeof toolArgs.treatment_recommended === "string"
                ? normalizeRecommendationCategory(
                    toolArgs.treatment_recommended.trim(),
                  )
                : undefined,
            alternativeRecommendations: Array.isArray(
              toolArgs.alternative_recommendations,
            )
              ? toolArgs.alternative_recommendations.map(String)
              : [],
            recommendationRationale:
              typeof toolArgs.treatment_explanation === "string"
                ? toolArgs.treatment_explanation.trim()
                : undefined,
            symptomSummary:
              typeof toolArgs.symptom_summary === "string"
                ? toolArgs.symptom_summary.trim()
                : undefined,
            previousTreatments:
              typeof toolArgs.previous_treatments === "string"
                ? toolArgs.previous_treatments.trim()
                : undefined,
            socialFactors:
              typeof toolArgs.social_factors === "string"
                ? toolArgs.social_factors.trim()
                : undefined,
            reportGenerated: parsedResult.ok === true,
            pdfUrl: parsedResult.downloadUrl,
            storagePath: parsedResult.storagePath,
            pdfDownloadUrlExpiresAt: parsedResult.expiresAt,
            reportRetentionUntil: parsedResult.retentionUntil,
            reportExpiryDate: parsedResult.retentionUntil,
            promptVersion: `V${RESPONSE_PROMPT_VERSION}`,
          };
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
            reply: buildReportReply(
              String(lastToolResult.downloadUrl),
              channel,
            ),
            threadId: response.id || threadId,
            assessmentUpdate,
            downloadUrl: lastToolResult.downloadUrl,
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
    let finalReply = sanitizeUserFacingText(extractTextFromResponse(response));
    const canonicalUrl = String(
      lastToolResult?.downloadUrl || priorUrl || ""
    );

    if (canonicalUrl) {
      finalReply = buildReportReply(canonicalUrl, channel);
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
    finalReply = sanitizeUserFacingText(finalReply);

    return new Response(
      JSON.stringify({
        reply: finalReply,
        threadId: finalThreadId,
        assessmentUpdate,
        downloadUrl: canonicalUrl || undefined,
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
