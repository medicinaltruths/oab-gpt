import { NextRequest } from "next/server";
import { generateSummaryPdf } from "@/lib/pdfClient";

/**
 * This endpoint is called by two callers:
 *  1) Your web app (client) — sends { uid, threadId, ... } and optionally an Authorization: Bearer <idToken>.
 *  2) The OpenAI Assistants "tool call" — sends snake_case fields and a thread_id, but no Firebase token.
 *
 * We normalize both shapes, build a payload for the Cloud Function, and return either a signed downloadUrl
 * or a storagePath (depending on how the function is configured to respond).
 */

// Simple CORS helper (useful for local tests and future cross-origin calls)
const corsHeaders: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

// Map snake_case tool-call fields → camelCase used by our Cloud Function
function normalizeBody(raw: any) {
  const b = raw || {};

  // Accept either camelCase or snake_case from the Assistant tool
  const patientName = b.patientName ?? b.patient_name ?? "";
  const symptomSummary = b.symptomSummary ?? b.symptom_summary ?? "";
  const previousTreatments = b.previousTreatments ?? b.previous_treatments ?? "";
  const socialFactors = b.socialFactors ?? b.social_factors ?? "";
  const treatmentRecommended = b.treatmentRecommended ?? b.treatment_recommended ?? "";
  const treatmentExplanation = b.treatmentExplanation ?? b.treatment_explanation ?? "";
  const questionsForDoctor = b.questionsForDoctor ?? b.questions_for_doctor ?? "";

  // Build HTML bullet list for questions (so the PDF renders real bullets)
  function toBulletsHTML(src?: string) {
    const items = (src ?? "")
      .split(/\r?\n/)
      .map((s: string) => s.replace(/^\s*[-•]\s*/, "").trim())
      .filter(Boolean);
    if (!items.length) return "<p>No questions provided.</p>";
    return `<ul class="questions">${items.map((li: string) => `<li>${li.replace(/[&<>"]/g, (m) => ({ "&":"&amp;","<":"&lt;",">":"&gt;", "\"":"&quot;" } as any)[m])}</li>`).join("")}</ul>`;
  }
  const questionsHtml = toBulletsHTML(questionsForDoctor);

  // Default PDF layout options (A4 + safe margins + right padding to avoid clipping)
  const pdfLayout = {
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

  // Hint for how long the signed URL should live (ms). pdfClient may ignore this if unsupported.
  const signedUrlTTLms = 48 * 60 * 60 * 1000; // 48 hours

  // Thread / run metadata: Assistant provides thread_id; keep run_id if present for diagnostics.
  const threadId = b.threadId ?? b.thread_id ?? "";
  const runId = b.runId ?? b.run_id ?? undefined;

  // Caller identity:
  // - Client will send a real Firebase uid.
  // - Tool calls won’t have one, so namespace by thread to keep objects isolated.
  const uid = b.uid || (threadId ? `assistant:${threadId}` : undefined);

  const sessionId =
    b.sessionId ??
    b.session_id ??
    (uid ? `${uid}-${Date.now()}` : `sess-${Date.now()}`);

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

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();

    // Pull Firebase ID token from Authorization header if present ("Bearer <token>")
    const idToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || undefined;

    const body = normalizeBody(raw);

    // Minimal validation — we must have a threadId; uid will be synthesized if missing.
    if (!body.threadId) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing threadId" }),
        { status: 400, headers: corsHeaders }
      );
    }
    if (!body.uid) {
      // Should only happen on tool calls; synthesize a uid from threadId.
      body.uid = `assistant:${body.threadId}`;
    }

    // Call Cloud Function. Pass idToken if available (enables per-user ACL if you turn it on).
    // Prefer enhanced fields if pdfClient supports them; fall back gracefully otherwise
    const data = await generateSummaryPdf(
      {
        ...body,
        // Provide both raw and HTML forms of questions so the renderer can choose
        questionsHtml: (body as any).questionsHtml,
        pdfLayout: (body as any).pdfLayout,
        signedUrlTTLms: (body as any).signedUrlTTLms,
      },
      idToken
    );

    // Normalize a successful shape for the frontend
    // The cloud function may return {downloadUrl} (signed) or {storagePath}.
    // The questionsHtml, pdfLayout, and signedUrlTTLms fields are pass-throughs for the PDF client and safe to ignore.
    if (data?.downloadUrl || data?.storagePath) {
      return new Response(JSON.stringify({ ok: true, ...data }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    // If we got here, the function didn't return what we expected
    return new Response(
      JSON.stringify({
        ok: false,
        error: "PDF function responded without a URL or path",
        data,
      }),
      { status: 502, headers: corsHeaders }
    );
  } catch (e: any) {
    // Surface a concise, serializable error
    const message =
      e?.response?.data?.error ||
      e?.message ||
      "Unknown error";
    console.error("create-report error:", message);
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}