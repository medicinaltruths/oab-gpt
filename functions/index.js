/* eslint-env node */
/* eslint-disable max-len, require-jsdoc, no-console */

const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const corsMW = require("cors");
const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");

const BUILD_TAG = "generateSummaryPdf v3 (2025-09-03)";

// ===== Configure =====
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*"; // e.g. "https://oab.yourdomain.com"
const SIGNED_URL_FALLBACK_MINUTES = 48 * 60; // 48 hours for unauthenticated test calls
const cors = corsMW({ origin: ALLOWED_ORIGIN, credentials: true });

// Init Admin
if (!admin.apps.length) {
  admin.initializeApp(); // Uses Functions' default service account + default bucket
}
const bucket = admin.storage().bucket();
const auth = admin.auth();
setGlobalOptions({ region: "europe-west2", timeoutSeconds: 60, memoryMiB: 512 });

// ------- Helpers -------
function isString(x) {
  return typeof x === "string" && x.trim().length > 0;
}

function coerceText(x, fallback) {
  const fb = typeof fallback === "string" ? fallback : "Not provided";
  if (x === undefined || x === null) return fb;
  const s = String(x);
  return s.trim().length ? s.trim() : fb;
}

// Width-aware word-wrap; also breaks long tokens so lines never overflow
function wrapTextByWidth(text, font, fontSize, maxWidth) {
  const src = String(text || "");
  const words = src.split(/\s+/);
  const out = [];
  let line = "";

  // Helper: break a single long token into chunks that fit maxWidth
  function breakLongToken(token) {
    const chunks = [];
    let buf = "";
    for (const ch of token) {
      const test = buf + ch;
      if (font.widthOfTextAtSize(test, fontSize) <= maxWidth) {
        buf = test;
      } else {
        if (buf) chunks.push(buf);
        buf = ch;
      }
    }
    if (buf) chunks.push(buf);
    return chunks;
  }

  for (let w of words) {
    // If token alone is wider than maxWidth, split it
    if (font.widthOfTextAtSize(w, fontSize) > maxWidth) {
      const parts = breakLongToken(w);
      for (const p of parts) {
        if (!line) {
          line = p;
        } else if (font.widthOfTextAtSize(line + " " + p, fontSize) <= maxWidth) {
          line = line + " " + p;
        } else {
          out.push(line);
          line = p;
        }
      }
      continue;
    }
    const test = line ? (line + " " + w) : w;
    if (font.widthOfTextAtSize(test, fontSize) <= maxWidth) {
      line = test;
    } else {
      if (line) out.push(line);
      line = w;
    }
  }
  if (line) out.push(line);
  return out;
}

// Draw a subtle border inside the page edges (helps visually confirm margins on print)
function drawPageBorder(page, inset = 24) {
  const { width, height } = page.getSize();
  page.drawRectangle({
    x: inset,
    y: inset,
    width: width - inset * 2,
    height: height - inset * 2,
    borderColor: rgb(0.85, 0.85, 0.85),
    borderWidth: 0.5,
  });
}

// Draw a titled section and handle page breaks; returns updated { page, y }
function drawSection(pdf, page, y, title, body, opts) {
  const options = opts || {};
  const left = options.left ?? 50;
  const right = options.right ?? 50;
  const top = options.top ?? 50;
  const bottom = options.bottom ?? 60;
  const contentWidth = page.getSize().width - left - right;

  const font = options.font;
  const titleFont = options.titleFont || options.font;
  const fontSize = options.fontSize || 12;
  const titleSize = options.titleSize || (fontSize + 2);
  const lineGap = options.lineGap || 16;
  const paraGap = options.paraGap || 10;

  const lines = wrapTextByWidth(body, font, fontSize, contentWidth);

  function ensureSpace(linesNeeded) {
    const need = typeof linesNeeded === "number" ? linesNeeded : 2;
    if (y < bottom + need * lineGap) {
      page = pdf.addPage([595.28, 841.89]); // A4
      drawPageBorder(page);
      y = page.getSize().height - top;
    }
  }

  // Title
  ensureSpace(2);
  page.drawText(String(title) + ":", {
    x: left,
    y: y,
    size: titleSize,
    font: titleFont,
    color: rgb(0, 0.3, 0.6),
  });
  y -= lineGap + 4;

  // Body
  for (const ln of lines) {
    ensureSpace(1);
    page.drawText(ln, {
      x: left,
      y: y,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    });
    y -= lineGap;
  }
  y -= paraGap;
  return { page, y };
}

// Draw a bullet list section (splits input by newlines / leading - or •)
function drawBulletedSection(pdf, page, y, title, body, opts) {
  const options = opts || {};
  const left = options.left ?? 50;
  const right = options.right ?? 50;
  const top = options.top ?? 50;
  const bottom = options.bottom ?? 60;
  const contentWidth = page.getSize().width - left - right;

  const font = options.font;
  const titleFont = options.titleFont || options.font;
  const fontSize = options.fontSize || 12;
  const titleSize = options.titleSize || (fontSize + 2);
  const lineGap = options.lineGap || 16;
  const bulletIndent = options.bulletIndent || 12;
  const paraGap = options.paraGap || 10;

  function ensureSpace(linesNeeded) {
    const need = typeof linesNeeded === "number" ? linesNeeded : 2;
    if (y < bottom + need * lineGap) {
      page = pdf.addPage([595.28, 841.89]); // A4
      drawPageBorder(page);
      y = page.getSize().height - top;
    }
  }

  // Title
  ensureSpace(2);
  page.drawText(String(title) + ":", {
    x: left,
    y: y,
    size: titleSize,
    font: titleFont,
    color: rgb(0, 0.3, 0.6),
  });
  y -= lineGap + 4;

  const raw = String(body || "").trim();
  let items = raw.split(/\r?\n/).map(s => s.replace(/^\s*[-•]\s*/, "").trim()).filter(Boolean);
  // Fallback: split "1. foo? 2. bar? 3) baz?" style into separate bullets
  if (items.length <= 1) {
    items = raw.split(/\s*\d+[.)]\s+/).map(s => s.trim()).filter(Boolean);
  }

  if (items.length === 0) {
    ensureSpace(1);
    page.drawText("No questions provided.", { x: left, y, size: fontSize, font, color: rgb(0,0,0) });
    y -= lineGap + paraGap;
    return { page, y };
  }

  for (const raw of items) {
    // Wrap with space for bullet indent
    const lines = wrapTextByWidth(raw, font, fontSize, contentWidth - bulletIndent);
    ensureSpace(lines.length);
    // Vector bullet (circle) to avoid missing glyph issues in some fonts
    page.drawCircle({
      x: left + 3,
      y: y + (fontSize * 0.35),
      size: 1.8,
      color: rgb(0, 0, 0),
    });
    // First line
    page.drawText(lines[0], { x: left + bulletIndent, y, size: fontSize, font, color: rgb(0,0,0) });
    y -= lineGap;
    // Continuations
    for (const cont of lines.slice(1)) {
      ensureSpace(1);
      page.drawText(cont, { x: left + bulletIndent, y, size: fontSize, font, color: rgb(0,0,0) });
      y -= lineGap;
    }
  }
  y -= paraGap;
  return { page, y };
}

async function makePdf(payload) {
  const pdf = await PDFDocument.create();
  const pageSize = [595.28, 841.89]; // A4
  let page = pdf.addPage(pageSize);
  drawPageBorder(page);
  // Embed fonts for accurate width measurement
  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // Margins
  const top = 50, right = 50, bottom = 60, left = 50;
  let y = page.getSize().height - top;

  // Header
  page.drawText("OAB Decision Aid — Personalised Report", {
    x: left,
    y: y,
    size: 16,
    font: fontBold,
    color: rgb(0.06, 0.28, 0.55),
  });
  // Build/version marker to verify deployment/source
  page.drawText(BUILD_TAG, {
    x: left,
    y: y + 4, // just under the main header
    size: 9,
    font: fontRegular,
    color: rgb(0.45, 0.45, 0.45),
  });
  y -= 28;

  const patientName = coerceText(payload.patientName);
  const symptomSummary = coerceText(payload.symptomSummary);
  const previousTreatments = coerceText(payload.previousTreatments);
  const socialFactors = coerceText(payload.socialFactors);
  const treatmentRecommended = coerceText(payload.treatmentRecommended);
  const treatmentExplanation = coerceText(payload.treatmentExplanation);
  const questionsForDoctor = coerceText(payload.questionsForDoctor);

  let out = drawSection(pdf, page, y, "Patient", patientName, { left, right, top, bottom, font: fontRegular, titleFont: fontBold });
  page = out.page; y = out.y;
  out = drawSection(pdf, page, y, "Urinary Symptoms", symptomSummary, { left, right, top, bottom, font: fontRegular, titleFont: fontBold });
  page = out.page; y = out.y;
  out = drawSection(pdf, page, y, "Previous Treatments", previousTreatments, { left, right, top, bottom, font: fontRegular, titleFont: fontBold });
  page = out.page; y = out.y;
  out = drawSection(pdf, page, y, "Social Factors", socialFactors, { left, right, top, bottom, font: fontRegular, titleFont: fontBold });
  page = out.page; y = out.y;
  out = drawSection(pdf, page, y, "Recommended Treatment", treatmentRecommended, { left, right, top, bottom, font: fontRegular, titleFont: fontBold });
  page = out.page; y = out.y;
  out = drawSection(pdf, page, y, "Rationale", treatmentExplanation, { left, right, top, bottom, font: fontRegular, titleFont: fontBold });
  page = out.page; y = out.y;
  out = drawBulletedSection(pdf, page, y, "Questions for Doctor", questionsForDoctor, { left, right, top, bottom, font: fontRegular, titleFont: fontBold });
  page = out.page; y = out.y;

  // Footer
  if (y < bottom + 20) {
    page = pdf.addPage(pageSize);
    drawPageBorder(page);
    y = page.getSize().height - top;
  }
  page.drawText(
    "This report is for discussion with your clinician; it is not medical advice.",
    { x: left, y: bottom, size: 10, font: fontRegular, color: rgb(0.3, 0.3, 0.3) }
  );

  const bytes = await pdf.save();
  return bytes;
}

async function verifyIdTokenFromHeader(req) {
  try {
    const authHeader =
      req.headers.authorization ||
      req.get("Authorization") ||
      "";
    const m = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!m) return null;
    const token = m[1];
    const decoded = await auth.verifyIdToken(token);
    return decoded; // contains uid, email, etc.
  } catch (e) {
    return null;
  }
}

// ------- HTTPS Function (Gen2 / v2 API) -------
exports.generateSummaryPdf = onRequest(async (req, res) => {
  // CORS (tighten to your domain via ALLOWED_ORIGIN env)
  return cors(req, res, async function () {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Use POST" });
      }
      const ct = req.headers["content-type"] || "";
      if (!/application\/json/i.test(ct)) {
        return res.status(415).json({ error: "Content-Type must be application/json" });
      }

      const body = req.body || {};
      console.log("[generateSummaryPdf] BUILD:", BUILD_TAG, "URL:", req.originalUrl || req.url);

      const payload = {
        patientName: coerceText(body.patientName),
        symptomSummary: coerceText(body.symptomSummary),
        previousTreatments: coerceText(body.previousTreatments),
        socialFactors: coerceText(body.socialFactors),
        treatmentRecommended: coerceText(body.treatmentRecommended),
        treatmentExplanation: coerceText(body.treatmentExplanation),
        questionsForDoctor: coerceText(body.questionsForDoctor),
      };

      // Try to verify Firebase Auth
      const decoded = await verifyIdTokenFromHeader(req); // null if not present/invalid
      const uid = decoded && decoded.uid ? decoded.uid : null;

      // Build PDF
      const pdfBytes = await makePdf(payload);
      const now = Date.now();
      const sessionId = isString(body.sessionId) ? body.sessionId.trim() : "nosession";
      const filename = "OAB-summary-" + now + ".pdf";
      const path = uid
        ? ("reports/" + uid + "/" + sessionId + "/" + filename)
        : ("reports/anon/" + sessionId + "/" + filename);

      // Save to Storage
      const file = bucket.file(path);
      await file.save(Buffer.from(pdfBytes), {
        metadata: {
          contentType: "application/pdf",
          cacheControl: "no-store",
        },
        resumable: false,
      });

      // Response strategy:
      // - If authed: return storage path (frontend should use Firebase Storage SDK + rules)
      // - If not authed: return short-lived signed URL for convenience/testing
      if (uid) {
        return res.status(200).json({
          ok: true,
          mode: "storage",
          storagePath: path,
          build: BUILD_TAG,
          message: "Authenticated: use Firebase Storage getDownloadURL() to fetch.",
        });
      } else {
        const ttlMsFromBody = (typeof body.signedUrlTTLms === "number" && body.signedUrlTTLms > 0)
          ? Math.min(body.signedUrlTTLms, 7 * 24 * 60 * 60 * 1000) // cap at 7 days
          : SIGNED_URL_FALLBACK_MINUTES * 60 * 1000; // default 48h
        const expiresAt = now + ttlMsFromBody;
        const signed = await file.getSignedUrl({
          action: "read",
          expires: expiresAt,
        });
        const url = signed && signed[0] ? signed[0] : null;
        return res.status(200).json({
          ok: true,
          mode: "signed-url",
          downloadUrl: url,
          expiresAt: expiresAt,
          build: BUILD_TAG,
          message: "Unauthenticated request: returning short-lived signed URL.",
        });
      }
    } catch (err) {
      const msg = (err && err.message) ? err.message : String(err);
      console.error("generateSummaryPdf error:", msg);
      return res.status(500).json({ ok: false, error: msg });
    }
  });
});