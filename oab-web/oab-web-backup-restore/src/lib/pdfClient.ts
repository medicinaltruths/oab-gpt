export async function generateSummaryPdf(payload: any, idToken?: string) {
  // --- Helpers (kept local to this module) ---
  const mm = (n: number) => `${n}mm`;

  function toBulletsHTML(src?: string) {
    const items = (src ?? "")
      .split(/\r?\n/)
      .map((s: string) => s.replace(/^\s*[-•]\s*/, "").trim())
      .filter(Boolean);
    if (!items.length) return "<p>No questions provided.</p>";
    // Minimal escaping
    const esc = (t: string) => t.replace(/[&<>"]/g, (m) => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;" } as any)[m]);
    return `<ul class="questions">${items.map(li => `<li>${esc(li)}</li>`).join("")}</ul>`;
  }

  function mergePdfLayout(userLayout?: any) {
    const baseCss = `
      @page { size: A4; margin: 16mm 16mm 18mm 16mm; }
      html, body { margin: 0; padding: 0; }
      .page { box-sizing: border-box; width: 100%; padding-right: 2mm; word-break: break-word; overflow-wrap: anywhere; hyphens: auto; }
      ul.questions { margin: 6px 0 12px; padding-left: 18px; list-style: disc; }
      ul.questions li { margin: 2px 0; }
    `.trim();

    const layout = userLayout ?? {};
    const margin = layout.margin ?? { top: mm(16), right: mm(16), bottom: mm(18), left: mm(16) };
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
      : toBulletsHTML(payload?.questions_for_doctor ?? payload?.questionsForDoctor);

  const pdfLayout = mergePdfLayout(payload?.pdfLayout);

  // Some renderers accept these top-level flags (harmless if ignored)
  const pdfOptions = {
    format: pdfLayout.format,
    printBackground: true,
    preferCSSPageSize: true,
    margin: pdfLayout.margin,
  };

  const finalPayload = {
    ...payload,
    questionsHtml,
    pdfLayout,
    pdfOptions,
    signedUrlTTLms,
    // A tiny hint block some backends like to read
    renderHints: {
      engine: "html-to-pdf",     // hint; backend can ignore
      enforceA4: true,
      safeRightPaddingMm: 2,
    },
  };

  const r = await fetch(process.env.PDF_FUNCTION_URL!, {
    method: "POST",
    headers,
    body: JSON.stringify(finalPayload),
    // cache: "no-store" is default for POST in Next.js route handlers
  });

  if (!r.ok) {
    const err = await r.text().catch(() => "");
    throw new Error(`PDF function error: ${r.status} ${err}`);
  }
  return r.json();
}