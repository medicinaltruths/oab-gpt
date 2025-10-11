import { NextRequest } from "next/server";
import { generateSummaryPdf } from "@/lib/pdfClient";

/**
 * API route: /api/create-report
 * Normalizes inputs from either:
 *  1) Client-side calls (camelCase, optional Firebase id token), or
 *  2) OpenAI Assistant tool calls (snake_case, no Firebase token),
 * then invokes the Cloud Function via pdfClient and returns a stable shape.
 *
 * Goal: zero `any`, ESLint-clean, same runtime behaviour.
 */

/* ---------------------------------- */
/* CORS                               */
/* ---------------------------------- */
const corsHeaders: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

/* ---------------------------------- */
/* Types                              */
/* ---------------------------------- */
type PdfLayout = {
  format: "A4" | "Letter" | string;
  margin: { top: string; right: string; bottom: string; left: string };
  css: string;
};

interface NormalizedBody {
  uid?: string;
  threadId: string;
  runId?: string;
  sessionId: string;

  patientName: string;
  symptomSummary: string;
  previousTreatments: string;
  socialFactors: string;
  treatmentRecommended: string;
  treatmentExplanation: string;
  questionsForDoctor: string;

  questionsHtml: string;
  pdfLayout: PdfLayout;
  signedUrlTTLms: number;
}

type PdfClientResult = {
  downloadUrl?: string;
  storagePath?: string;
  error?: unknown;
  [k: string]: unknown;
};

/* ---------------------------------- */
/* Helpers                            */
/* ---------------------------------- */
function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function htmlEscape(str: string): string {
  return str.replace(/[&<>"]/g, (m) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
    };
    return map[m] ?? m;
  });
}

function bulletsHtml(src?: string): string {
  const items = (src ?? "")
    .split(/\r?\n/)
    .map((s) => s.replace(/^\s*[-•]\s*/, "").trim())
    .filter(Boolean);
  if (!items.length) return "<p>No questions provided.</p>";
  const lis = items.map((li) => `<li>${htmlEscape(li)}</li>`).join("");
  return `<ul class="questions">${lis}</ul>`;
}

/**
 * Map snake_case and camelCase into a single normalized payload,
 * and provide reasonable defaults for PDF layout.
 */
function normalizeBody(raw: unknown): NormalizedBody {
  const b = isRecord(raw) ? raw : {};

  // Accept either camelCase or snake_case
  const patientName = String(b.patientName ?? b.patient_name ?? "");
  const symptomSummary = String(b.symptomSummary ?? b.symptom_summary ?? "");
  const previousTreatments = String(b.previousTreatments ?? b.previous_treatments ?? "");
  const socialFactors = String(b.socialFactors ?? b.social_factors ?? "");
  const treatmentRecommended = String(b.treatmentRecommended ?? b.treatment_recommended ?? "");
  const treatmentExplanation = String(b.treatmentExplanation ?? b.treatment_explanation ?? "");
  const questionsForDoctor = String(b.questionsForDoctor ?? b.questions_for_doctor ?? "");

  const threadId = String(b.threadId ?? b.thread_id ?? "");
  const runId = b.runId ? String(b.runId) : (b.run_id ? String(b.run_id) : undefined);

  let uid = b.uid ? String(b.uid) : undefined;
  if (!uid && threadId) uid = `assistant:${threadId}`;

  const sessionId =
    (b.sessionId ? String(b.sessionId) : undefined) ??
    (b.session_id ? String(b.session_id) : undefined) ??
    (uid ? `${uid}-${Date.now()}` : `sess-${Date.now()}`);

  const questionsHtml = bulletsHtml(questionsForDoctor);

  const pdfLayout: PdfLayout = {
    format: "A4",
    margin: { top: "16mm", right: "16mm", bottom: "18mm", left: "16mm" },
    css: `
      @page { size: A4; margin: 16mm 16mm 18mm 16mm; }
      html, body { margin: 0; padding: 0; }
      .page { box-sizing: border-box; width: 100%; padding-right: 2mm; word-break: break-word; overflow-wrap: anywhere; hyphens: auto; }
      ul.questions { margin: 6px 0 12px; padding-left: 18px; list-style: disc; }
      ul.questions li { margin: 2px 0; }
    `,
  };

  const signedUrlTTLms = 48 * 60 * 60 * 1000; // 48 hours

  return {
    uid,
    threadId,
    runId,
    sessionId,
    patientName,
    symptomSummary,
    previousTreatments,
    socialFactors,
    treatmentRecommended,
    treatmentExplanation,
    questionsForDoctor,
    questionsHtml,
    pdfLayout,
    signedUrlTTLms,
  };
}

/* ---------------------------------- */
/* POST                               */
/* ---------------------------------- */
export async function POST(req: NextRequest) {
  try {
    const raw = await req.json().catch(() => ({}));
    const idToken =
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || undefined;

    const body = normalizeBody(raw);

    if (!body.threadId) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing threadId" }),
        { status: 400, headers: corsHeaders }
      );
    }
    // `uid` is synthesized in normalizeBody if missing

    // Call Cloud Function through pdfClient with enhanced fields present.
    // generateSummaryPdf should forward what it understands and ignore extras.
    const data = (await generateSummaryPdf(
      {
        ...body,
      },
      idToken
    )) as PdfClientResult;

    if (data?.downloadUrl || data?.storagePath) {
      return new Response(JSON.stringify({ ok: true, ...data }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    return new Response(
      JSON.stringify({
        ok: false,
        error: "PDF function responded without a URL or path",
        data,
      }),
      { status: 502, headers: corsHeaders }
    );
  } catch (e: unknown) {
    const message =
      e instanceof Error
        ? e.message
        : typeof e === "string"
        ? e
        : "Unknown error";
    console.error("create-report error:", message);
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}
