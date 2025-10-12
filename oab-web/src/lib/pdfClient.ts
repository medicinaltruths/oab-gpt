/**
 * Client helper to call the PDF Cloud Function.
 * Behaviour preserved from the original version; only types/guards were added.
 */

type Millimetres = string;

export type PdfMargin = {
  top: Millimetres;
  right: Millimetres;
  bottom: Millimetres;
  left: Millimetres;
};

export type PdfLayout = {
  format: string; // e.g. "A4"
  margin: PdfMargin;
  css: string;
};

/**
 * Payload accepted by the service. We keep this permissive
 * because the original code spreads all caller-provided fields.
 */
export type GeneratePdfPayload = {
  // Known fields used in this helper (others are passed through untouched)
  signedUrlTTLms?: number;
  questionsHtml?: string;
  questions_for_doctor?: string;
  pdfLayout?: Partial<PdfLayout> & {
    margin?: Partial<PdfMargin>;
    css?: string;
  };

  // Threading/session hints commonly included by callers
  uid?: string;
  threadId?: string;
  runId?: string;
  sessionId?: string;

  // Clinical fields (free text)
  patientName?: string;
  symptomSummary?: string;
  previousTreatments?: string;
  socialFactors?: string;
  treatmentRecommended?: string;
  treatmentExplanation?: string;
  questionsForDoctor?: string;

  // Allow arbitrary extra data (preserved in the spread)
  [k: string]: unknown;
};

/**
 * Return type is intentionally `unknown` because the CF may evolve.
 * Callers can narrow/validate as needed. This avoids `any`.
 */
export async function generateSummaryPdf(
  payload: GeneratePdfPayload,
  idToken?: string
): Promise<unknown> {
  // --- Helpers (kept local to this module) ---
  const mm = (n: number): Millimetres => `${n}mm`;

  function toBulletsHTML(src?: string): string {
    const items = (src ?? "")
      .split(/\r?\n/)
      .map((s) => s.replace(/^\s*[-•]\s*/, "").trim())
      .filter(Boolean);
    if (!items.length) return "<p>No questions provided.</p>";
    // Minimal escaping
    const escMap: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
    };
    const esc = (t: string) => t.replace(/[&<>"]/g, (m) => escMap[m] ?? m);
    return `<ul class="questions">${items
      .map((li) => `<li>${esc(li)}</li>`)
      .join("")}</ul>`;
  }

  function mergePdfLayout(userLayout?: GeneratePdfPayload["pdfLayout"]): PdfLayout {
    const baseCss = `
      @page { size: A4; margin: 16mm 16mm 18mm 16mm; }
      html, body { margin: 0; padding: 0; }
      .page { box-sizing: border-box; width: 100%; padding-right: 2mm; word-break: break-word; overflow-wrap: anywhere; hyphens: auto; }
      ul.questions { margin: 6px 0 12px; padding-left: 18px; list-style: disc; }
      ul.questions li { margin: 2px 0; }
    `.trim();

    const layout = userLayout ?? {};
    const margin: PdfMargin = {
      top: (layout.margin?.top as Millimetres) ?? mm(16),
      right: (layout.margin?.right as Millimetres) ?? mm(16),
      bottom: (layout.margin?.bottom as Millimetres) ?? mm(18),
      left: (layout.margin?.left as Millimetres) ?? mm(16),
    };
    const css = [baseCss, layout.css].filter(Boolean).join("\n");

    return {
      format: layout.format ?? "A4",
      margin,
      css,
    };
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (idToken) headers.Authorization = `Bearer ${idToken}`;

  // --- Build an augmented payload but never remove caller-provided fields ---
  const signedUrlTTLms =
    typeof payload?.signedUrlTTLms === "number" && payload.signedUrlTTLms > 0
      ? payload.signedUrlTTLms
      : 48 * 60 * 60 * 1000; // default 48h

  const questionsHtml =
    typeof payload?.questionsHtml === "string" && payload.questionsHtml.trim()
      ? payload.questionsHtml
      : toBulletsHTML(
          (typeof payload?.questions_for_doctor === "string" && payload.questions_for_doctor) ||
            (typeof payload?.questionsForDoctor === "string" && payload.questionsForDoctor) ||
            ""
        );

  const pdfLayout = mergePdfLayout(payload?.pdfLayout);

  // Some renderers accept these top-level flags (harmless if ignored)
  const pdfOptions = {
    format: pdfLayout.format,
    printBackground: true,
    preferCSSPageSize: true,
    margin: pdfLayout.margin,
  };

  const endpoint = process.env.PDF_FUNCTION_URL;
  if (!endpoint) {
    throw new Error("PDF function endpoint missing: set PDF_FUNCTION_URL");
  }

  const r = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      ...payload,
      questionsHtml,
      pdfLayout,
      pdfOptions,
      signedUrlTTLms,
      // A tiny hint block some backends like to read
      renderHints: {
        engine: "html-to-pdf", // hint; backend can ignore
        enforceA4: true,
        safeRightPaddingMm: 2,
      },
    }),
    // cache: "no-store" is default for POST in Next.js route handlers
  });

  if (!r.ok) {
    const err = await r.text().catch(() => "");
    throw new Error(`PDF function error: ${r.status} ${err}`);
  }
  // Preserve original behaviour: return the raw JSON from the function.
  // Use `unknown` instead of `any` to satisfy ESLint (@typescript-eslint/no-explicit-any).
  const data: unknown = await r.json().catch(() => ({}));
  return data;
}