/* eslint-env node */
/* eslint-disable max-len, require-jsdoc, no-console */

const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const twilio = require("twilio");
const corsMW = require("cors");
const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const { randomUUID } = require("crypto");

const BUILD_TAG = "generateSummaryPdf v7 (2026-06-07)";

// ===== Configure =====
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*"; // e.g. "https://oab.yourdomain.com"
const REPORT_RETENTION_DAYS = 365;
const DEFAULT_HOSPITAL_ID = process.env.DEFAULT_HOSPITAL_ID || "esth";
const TWILIO_WHATSAPP_MODE =
  (process.env.TWILIO_WHATSAPP_MODE || "sandbox").toLowerCase();
const TWILIO_WHATSAPP_SANDBOX_KEYWORD =
  process.env.TWILIO_WHATSAPP_SANDBOX_KEYWORD || "plan-simple";
const TWILIO_WHATSAPP_INITIAL_MESSAGE =
  process.env.TWILIO_WHATSAPP_INITIAL_MESSAGE ||
  "Hi Felicity, let's get started";
const TWILIO_VALIDATE_SIGNATURE =
  (process.env.TWILIO_VALIDATE_SIGNATURE || "true").toLowerCase() !== "false";
const TWILIO_WHATSAPP_NUMBER =
  process.env.TWILIO_WHATSAPP_NUMBER || "+441182300299";
const CHAT_API_URL =
  process.env.CHAT_API_URL || "https://oab-gpt.vercel.app/api/chat";
const WHATSAPP_REPLY_CHUNK_SIZE = 1200;
const WHATSAPP_OUTBOUND_DELAY_MS = 700;
const cors = corsMW({ origin: ALLOWED_ORIGIN, credentials: true });

// Init Admin
if (!admin.apps.length) {
  admin.initializeApp(); // Uses Functions' default service account + default bucket
}
const bucket = admin.storage().bucket();
const auth = admin.auth();
const db = admin.firestore();
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

function normalizeUkPhoneNumber(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";

  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");

  if (!digits) return "";
  if (hasPlus && digits.startsWith("44")) return `+${digits}`;
  if (digits.startsWith("44")) return `+${digits}`;
  if (digits.startsWith("07") && digits.length === 11) return `+44${digits.slice(1)}`;
  if (digits.startsWith("7") && digits.length === 10) return `+44${digits}`;
  if (digits.startsWith("0") && digits.length >= 10) return `+44${digits.slice(1)}`;
  return hasPlus ? `+${digits}` : digits;
}

function isUkMobileNumber(value) {
  return /^\+447\d{9}$/.test(String(value || ""));
}

function whatsappContactDocId(phoneNumber) {
  return String(phoneNumber || "").replace(/\D/g, "");
}

function createAssessmentId() {
  const year = new Date().getUTCFullYear();
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  return `OAB-${year}-${timestamp}${random}`;
}

function normalizeRecommendation(value) {
  const normalized = String(value || "").toLowerCase();
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
  return String(value || "").trim() || "Other";
}

function analyticsEventRef(assessmentId, type) {
  return db.collection("analytics")
    .doc("events")
    .collection("items")
    .doc(`${assessmentId}_${type}`);
}

function analyticsEventData(options) {
  return {
    type: options.type,
    assessmentId: options.assessmentId,
    sessionId: options.sessionId || null,
    hospitalId: options.hospitalId || DEFAULT_HOSPITAL_ID,
    channel: options.channel || "web",
    recommendation: options.recommendation || null,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  };
}

async function ensureWhatsappAssessment(options) {
  const existingId = String(options.assessmentId || "").trim();
  if (existingId) {
    const existingRef = db.collection("patient_assessments").doc(existingId);
    const existingSnapshot = await existingRef.get();
    if (existingSnapshot.exists && !existingSnapshot.get("conversationCompleted")) {
      return {
        assessmentId: existingId,
        ref: existingRef,
        snapshot: existingSnapshot,
        created: false,
      };
    }
  }

  const assessmentId = createAssessmentId();
  const ref = db.collection("patient_assessments").doc(assessmentId);
  const now = admin.firestore.FieldValue.serverTimestamp();
  const hospitalId = options.hospitalId || DEFAULT_HOSPITAL_ID;
  const batch = db.batch();
  batch.set(ref, {
    assessmentId,
    hospitalId,
    source: "whatsapp",
    channel: "whatsapp",
    firstName: options.firstName || null,
    conversationStarted: true,
    conversationCompleted: false,
    status: "in_progress",
    totalMessages: 0,
    messageCount: 0,
    conversationDurationMinutes: 0,
    pdfGenerated: false,
    reportGenerated: false,
    recommendation: null,
    recommendationCategory: null,
    alternativeRecommendations: [],
    pdfStoragePath: "",
    pdfDownloadUrl: "",
    promptVersion: "V15",
    reviewStatus: "pending",
    clinicianRecommendation: null,
    clinicianComments: "",
    clinicianReviewed: false,
    clinicianReviewedAt: null,
    preClinicQuestionnaire: null,
    postClinicQuestionnaire: null,
    concordance: null,
    sessionId: options.sessionId || null,
    whatsappContactId: options.contactId || null,
    createdAt: now,
    updatedAt: now,
  });
  batch.set(
    analyticsEventRef(assessmentId, "assessment_started"),
    analyticsEventData({
      type: "assessment_started",
      assessmentId,
      sessionId: options.sessionId,
      hospitalId,
      channel: "whatsapp",
    })
  );
  await batch.commit();
  return {assessmentId, ref, snapshot: null, created: true};
}

function normalizeTwilioAddress(value) {
  const raw = String(value || "").replace(/^whatsapp:/i, "").trim();
  if (!raw) return "";
  if (raw.startsWith("+")) return `+${raw.replace(/\D/g, "")}`;
  return normalizeUkPhoneNumber(raw);
}

function isSandboxWhatsappMode() {
  return TWILIO_WHATSAPP_MODE !== "live";
}

function parseFormBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    return req.body;
  }

  let raw = "";
  if (typeof req.body === "string") {
    raw = req.body;
  } else if (Buffer.isBuffer(req.body)) {
    raw = req.body.toString("utf8");
  } else if (req.rawBody) {
    raw = Buffer.isBuffer(req.rawBody) ? req.rawBody.toString("utf8") : String(req.rawBody);
  }

  const params = new URLSearchParams(raw);
  const out = {};
  for (const [key, value] of params.entries()) {
    out[key] = value;
  }
  return out;
}

function getRequestUrl(req) {
  const protoHeader = String(req.headers["x-forwarded-proto"] || req.protocol || "https");
  const proto = protoHeader.split(",")[0].trim() || "https";
  const host = req.get("host") || req.headers.host || "";
  const originalUrl = req.originalUrl || req.url || "";
  return `${proto}://${host}${originalUrl}`;
}

function isValidTwilioRequest(req, params) {
  if (!TWILIO_VALIDATE_SIGNATURE) return true;
  const authToken = process.env.TWILIO_AUTH_TOKEN || "";
  const signature = req.get("X-Twilio-Signature") || "";

  if (!authToken || !signature) return false;

  return twilio.validateRequest(
    authToken,
    signature,
    getRequestUrl(req),
    params
  );
}

function buildMessagingTwiml(text) {
  const response = new twilio.twiml.MessagingResponse();
  const parts = splitWhatsappReply(text);

  for (const part of parts) {
    response.message(part);
  }

  return response.toString();
}

function formatReplyForWhatsapp(text) {
  return String(text || "")
    .replace(/(?:filecite|cite)[^]*/gi, "")
    .replace(/【[^】]*(?:filecite|turn\d+(?:file|search)\d+)[^】]*】/gi, "")
    .replace(/\[\s*(?:filecite|cite)[^\]]*\]/gi, "")
    .replace(/\bfilecite\b(?:\s*[:：]?\s*(?:turn\d*file\d*|turnfile\s*\d+|[\d,\s-]+))?/gi, "")
    .replace(/\bturn\d+(?:file|search)\d+\b/gi, "")
    .replace(/\bturnfile\s*\d+\b/gi, "")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1: $2")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*[-*•]\s+/gm, "- ")
    .replace(/^\s*\d+\.\s+/gm, (m) => m.trim())
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[【】[\]]/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitLongWhatsappParagraph(paragraph, maxLength) {
  const parts = [];
  let remaining = String(paragraph || "").trim();

  while (remaining.length > maxLength) {
    let splitAt = remaining.lastIndexOf("\n", maxLength);
    if (splitAt < Math.floor(maxLength * 0.5)) {
      splitAt = remaining.lastIndexOf(". ", maxLength);
    }
    if (splitAt < Math.floor(maxLength * 0.5)) {
      splitAt = remaining.lastIndexOf("; ", maxLength);
    }
    if (splitAt < Math.floor(maxLength * 0.5)) {
      splitAt = remaining.lastIndexOf(", ", maxLength);
    }
    if (splitAt < Math.floor(maxLength * 0.5)) {
      splitAt = remaining.lastIndexOf(" ", maxLength);
    }
    if (splitAt <= 0) {
      splitAt = maxLength;
    }

    const chunk = remaining.slice(0, splitAt).trim();
    if (chunk) parts.push(chunk);
    remaining = remaining.slice(splitAt).trim();
  }

  if (remaining) parts.push(remaining);
  return parts;
}

function splitWhatsappReply(text) {
  const cleaned = formatReplyForWhatsapp(text);
  if (!cleaned) return [];
  if (cleaned.length <= WHATSAPP_REPLY_CHUNK_SIZE) return [cleaned];

  const paragraphs = cleaned.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  const chunks = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const paragraphParts = splitLongWhatsappParagraph(paragraph, WHATSAPP_REPLY_CHUNK_SIZE);

    for (const part of paragraphParts) {
      const candidate = current ? `${current}\n\n${part}` : part;
      if (candidate.length <= WHATSAPP_REPLY_CHUNK_SIZE) {
        current = candidate;
      } else {
        if (current) chunks.push(current);
        current = part;
      }
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

function buildWhatsappPrompt(options) {
  const contactName = String(options.contactName || "").trim();
  const userMessage = String(options.userMessage || "").trim();
  const hasExistingThread = !!options.hasExistingThread;

  const prefix =
    "Context: the user is messaging via WhatsApp. Reply in plain text only, " +
    "suitable for WhatsApp, concise, warm, and easy to read. Avoid markdown, " +
    "avoid emojis except the document icon in a generated report message, " +
    "avoid markdown tables, and keep the reply under 900 characters " +
    "unless the user explicitly asks for more detail.";
  const nameLine =
    !hasExistingThread && contactName
      ? `The user's preferred name from signup is ${contactName}.`
      : "";

  return [prefix, nameLine, `User message: ${userMessage}`].filter(Boolean).join("\n\n");
}

function buildWhatsappReportReply(url) {
  return (
    "Your report is ready.\n\n" +
    "📄 Download your report:\n\n" +
    `${url}\n\n` +
    "This link expires in 48 hours.\n\n" +
    "Is there anything else I can help with today?"
  );
}

async function postToChatApi(payload) {
  const response = await fetch(CHAT_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Chat API ${response.status}: ${errorText}`);
  }

  return response.json();
}

function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID || "";
  const authToken = process.env.TWILIO_AUTH_TOKEN || "";

  if (!accountSid || !authToken) {
    throw new Error("Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN");
  }

  return twilio(accountSid, authToken);
}

async function sendWhatsappMessages(to, text) {
  const client = getTwilioClient();
  const parts = splitWhatsappReply(text);
  const from = `whatsapp:${TWILIO_WHATSAPP_NUMBER}`;
  const recipient = `whatsapp:${to}`;
  const sent = [];

  for (const part of parts) {
    const message = await client.messages.create({
      from: from,
      to: recipient,
      body: part,
    });
    sent.push(message.sid);
    if (parts.length > 1) {
      await new Promise((resolve) => setTimeout(resolve, WHATSAPP_OUTBOUND_DELAY_MS));
    }
  }

  return sent;
}

async function enqueueWhatsappInboundMessage(payload) {
  const fallbackId = `${whatsappContactDocId(payload.from)}-${Date.now()}`;
  const jobId = payload.messageSid || fallbackId;
  const ref = db.collection("whatsappInboundQueue").doc(jobId);

  try {
    await ref.create({
      ...payload,
      status: "queued",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    if (err && (err.code === 6 || err.code === "already-exists")) {
      await ref.set({
        duplicateReceivedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, {merge: true});
      return jobId;
    }
    throw err;
  }

  return jobId;
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
        patientAge: Number.isFinite(Number(body.patientAge)) ?
          Number(body.patientAge) :
          null,
        patientSex: isString(body.patientSex) ? body.patientSex.trim() : null,
        symptomSummary: coerceText(body.symptomSummary),
        previousTreatments: coerceText(body.previousTreatments),
        socialFactors: coerceText(body.socialFactors),
        treatmentRecommended: coerceText(body.treatmentRecommended),
        treatmentExplanation: coerceText(body.treatmentExplanation),
        questionsForDoctor: coerceText(body.questionsForDoctor),
        alternativeRecommendations: Array.isArray(body.alternativeRecommendations) ?
          body.alternativeRecommendations
            .map((item) => String(item || "").trim())
            .filter(Boolean) :
          [],
      };
      const assessmentId = isString(body.assessmentId) ? body.assessmentId.trim() : "";
      let hospitalId = isString(body.hospitalId) ?
        body.hospitalId.trim() :
        DEFAULT_HOSPITAL_ID;
      const promptVersion = isString(body.promptVersion) ?
        body.promptVersion.trim() :
        "V15";

      // Try to verify Firebase Auth
      const decoded = await verifyIdTokenFromHeader(req); // null if not present/invalid
      const uid = decoded && decoded.uid ? decoded.uid : null;
      let assessmentRef = null;

      if (assessmentId) {
        assessmentRef = db.collection("patient_assessments").doc(assessmentId);
        const assessmentSnapshot = await assessmentRef.get();
        if (!assessmentSnapshot.exists) {
          return res.status(404).json({ok: false, error: "Assessment record not found"});
        }

        const assessmentData = assessmentSnapshot.data() || {};
        const ownerAuthorized =
          uid && assessmentData.ownerUid && assessmentData.ownerUid === uid;
        const websiteSessionAuthorized =
          (assessmentData.channel === "web" ||
            assessmentData.source === "website") &&
          assessmentData.sessionId &&
          assessmentData.sessionId === body.sessionId;
        const whatsappAuthorized =
          (assessmentData.channel === "whatsapp" ||
            assessmentData.source === "whatsapp") &&
          assessmentData.sessionId &&
          assessmentData.sessionId === body.sessionId;

        if (!ownerAuthorized && !websiteSessionAuthorized && !whatsappAuthorized) {
          console.warn("[generateSummaryPdf] Assessment update not authorised", {
            assessmentId,
            hasUid: !!uid,
            channel: assessmentData.channel || assessmentData.source || "unknown",
            sessionMatches:
              !!assessmentData.sessionId &&
              assessmentData.sessionId === body.sessionId,
          });
          return res.status(403).json({ok: false, error: "Assessment update not authorised"});
        }
        hospitalId = assessmentData.hospitalId || hospitalId;
      }

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
          cacheControl: "private, max-age=3600",
          metadata: {
            firebaseStorageDownloadTokens: randomUUID(),
            assessmentId: assessmentId || "",
            hospitalId: hospitalId,
            reportRetentionDays: String(REPORT_RETENTION_DAYS),
          },
        },
        resumable: false,
      });

      const retentionUntil = now + REPORT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
      const [metadata] = await file.getMetadata();
      const token = metadata.metadata &&
        metadata.metadata.firebaseStorageDownloadTokens;
      const url = token ?
        `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}` +
          `/o/${encodeURIComponent(path)}?alt=media&token=${encodeURIComponent(token)}` :
        null;

      if (!url) {
        throw new Error("Firebase Storage did not return a report download token");
      }

      if (assessmentRef) {
        const recommendation = payload.treatmentRecommended;
        const recommendationCategory = normalizeRecommendation(recommendation);
        const assessmentSnapshot = await assessmentRef.get();
        const assessmentData = assessmentSnapshot.data() || {};
        const channel = assessmentData.channel ||
          (assessmentData.source === "whatsapp" ? "whatsapp" : "web");
        const batch = db.batch();
        batch.set(assessmentRef, {
          assessmentId,
          hospitalId,
          firstName: payload.patientName === "Not provided" ? null : payload.patientName,
          age: payload.patientAge,
          sex: payload.patientSex,
          conversationCompleted: true,
          status: "completed",
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          pdfGenerated: true,
          reportGenerated: true,
          pdfDownloadUrl: url,
          pdfStoragePath: path,
          pdfCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
          pdfDownloadUrlExpiresAt: admin.firestore.Timestamp.fromMillis(retentionUntil),
          reportRetentionUntil: admin.firestore.Timestamp.fromMillis(retentionUntil),
          pdfUrl: url,
          storagePath: path,
          reportCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
          reportExpiryDate: admin.firestore.Timestamp.fromMillis(retentionUntil),
          recommendation,
          recommendationCategory,
          alternativeRecommendations: payload.alternativeRecommendations,
          recommendedTreatment: recommendation,
          recommendationRationale: payload.treatmentExplanation,
          symptomSummary: payload.symptomSummary,
          previousTreatments: payload.previousTreatments,
          socialFactors: payload.socialFactors,
          promptVersion,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, {merge: true});
        [
          "assessment_completed",
          "recommendation_generated",
          "pdf_generated",
        ].forEach((type) => {
          batch.set(
            analyticsEventRef(assessmentId, type),
            analyticsEventData({
              type,
              assessmentId,
              sessionId,
              hospitalId,
              channel,
              recommendation:
                type === "recommendation_generated" ? recommendationCategory : null,
            }),
            {merge: true}
          );
        });
        await batch.commit();
      }

      return res.status(200).json({
        ok: true,
        mode: "signed-url",
        storagePath: path,
        downloadUrl: url,
        expiresAt: retentionUntil,
        retentionUntil,
        build: BUILD_TAG,
        message:
          "Report link and storage are retained for 12 months.",
      });
    } catch (err) {
      const msg = (err && err.message) ? err.message : String(err);
      console.error("generateSummaryPdf error:", msg);
      return res.status(500).json({ ok: false, error: msg });
    }
  });
});

exports.saveWhatsappContact = onRequest(async (req, res) => {
  return cors(req, res, async function() {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Use POST" });
      }

      const ct = req.headers["content-type"] || "";
      if (!/application\/json/i.test(ct)) {
        return res.status(415).json({ error: "Content-Type must be application/json" });
      }

      const body = req.body || {};
      const name = String(body.name || "").trim();
      const source = String(body.source || "website").trim() || "website";
      const phoneNumber = normalizeUkPhoneNumber(body.phoneNumber);
      const whatsappMode = String(
        body.whatsappMode || TWILIO_WHATSAPP_MODE
      ).trim().toLowerCase() || TWILIO_WHATSAPP_MODE;
      const hospitalId = String(body.hospitalId || DEFAULT_HOSPITAL_ID).trim() ||
        DEFAULT_HOSPITAL_ID;
      const starterMessage = String(
        body.starterMessage ||
          (isSandboxWhatsappMode() ?
            `join ${TWILIO_WHATSAPP_SANDBOX_KEYWORD}` :
            TWILIO_WHATSAPP_INITIAL_MESSAGE)
      ).trim();

      if (!name) {
        return res.status(400).json({ ok: false, error: "Missing name" });
      }

      if (!isUkMobileNumber(phoneNumber)) {
        return res.status(400).json({ ok: false, error: "Invalid UK mobile number" });
      }

      const now = admin.firestore.FieldValue.serverTimestamp();
      const ref = db.collection("whatsappContacts").doc(whatsappContactDocId(phoneNumber));
      const existing = await ref.get();

      await ref.set({
        phoneNumber,
        name,
        source,
        updatedAt: now,
        createdAt: existing.exists ? existing.get("createdAt") || now : now,
        latestChannel: "website",
        sandboxKeyword: TWILIO_WHATSAPP_SANDBOX_KEYWORD,
        whatsappMode: whatsappMode,
        starterMessage: starterMessage || null,
        hospitalId,
        openAiResponseId: existing.exists ? existing.get("openAiResponseId") || null : null,
      }, {merge: true});

      return res.status(200).json({
        ok: true,
        phoneNumber,
        stored: true,
      });
    } catch (err) {
      const msg = (err && err.message) ? err.message : String(err);
      console.error("saveWhatsappContact error:", msg);
      return res.status(500).json({ ok: false, error: msg });
    }
  });
});

exports.twilioWhatsappWebhook = onRequest(async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).type("text/plain").send("Use POST");
    }

    const body = parseFormBody(req);
    if (!isValidTwilioRequest(req, body)) {
      return res.status(403).type("text/plain").send("Invalid Twilio signature");
    }

    const incomingText = String(body.Body || "").trim();
    const from = normalizeTwilioAddress(body.From);
    const messageSid = String(body.MessageSid || "").trim() || null;

    if (!from) {
      return res.status(200).type("text/xml").send(buildMessagingTwiml(""));
    }

    const ref = db.collection("whatsappContacts").doc(whatsappContactDocId(from));
    const snapshot = await ref.get();
    const existing = snapshot.exists ? (snapshot.data() || {}) : {};
    const name = isString(existing.name) ? existing.name.trim() : "";
    const openAiResponseId = isString(existing.openAiResponseId) ?
      existing.openAiResponseId.trim() : "";
    const whatsappMode = isString(existing.whatsappMode) ?
      existing.whatsappMode.trim().toLowerCase() : TWILIO_WHATSAPP_MODE;
    const starterMessage = isString(existing.starterMessage) ?
      existing.starterMessage.trim() :
      (isSandboxWhatsappMode() ?
        `join ${TWILIO_WHATSAPP_SANDBOX_KEYWORD}` :
      TWILIO_WHATSAPP_INITIAL_MESSAGE);
    const hospitalId = isString(existing.hospitalId) ?
      existing.hospitalId.trim() :
      DEFAULT_HOSPITAL_ID;
    const now = admin.firestore.FieldValue.serverTimestamp();

    await ref.set({
      phoneNumber: from,
      name: name || null,
      latestChannel: "whatsapp",
      source: existing.source || "whatsapp",
      createdAt: snapshot.exists ? existing.createdAt || now : now,
      updatedAt: now,
      lastInboundAt: now,
      lastInboundBody: incomingText || null,
      lastInboundMessageSid: messageSid,
      whatsappMode: whatsappMode,
      starterMessage: starterMessage || null,
      hospitalId,
    }, {merge: true});

    if (!incomingText) {
      return res.status(200).type("text/xml").send(buildMessagingTwiml(""));
    }

    const joinCommand = `join ${TWILIO_WHATSAPP_SANDBOX_KEYWORD}`.trim().toLowerCase();
    const lowerIncomingText = incomingText.toLowerCase();
    const isJoinMessage =
      whatsappMode !== "live" && lowerIncomingText === joinCommand;
    const isLiveStarterMessage =
      whatsappMode === "live" &&
      !openAiResponseId &&
      starterMessage &&
      lowerIncomingText === starterMessage.toLowerCase();

    if (isJoinMessage || isLiveStarterMessage) {
      const welcome = name ?
        `Hi ${name}, you're connected to Felicity on WhatsApp. ` +
          "Tell me about your bladder symptoms and what matters most to you, " +
          "and I'll guide you step by step." :
        "You're connected to Felicity on WhatsApp. Tell me about your bladder " +
          "symptoms and what matters most to you, and I'll guide you step by step.";

      await ref.set({
        sandboxJoinedAt: now,
        lastOutboundAt: now,
        lastOutboundBody: welcome,
      }, {merge: true});

      return res.status(200).type("text/xml").send(buildMessagingTwiml(welcome));
    }

    const sessionId = `whatsapp-${whatsappContactDocId(from)}`;
    await enqueueWhatsappInboundMessage({
      from: from,
      contactId: whatsappContactDocId(from),
      name: name || null,
      incomingText: incomingText,
      messageSid: messageSid,
      openAiResponseId: openAiResponseId || null,
      whatsappMode: whatsappMode,
      starterMessage: starterMessage || null,
      sessionId: sessionId,
      hospitalId: hospitalId,
      assessmentId: existing.currentAssessmentId || null,
    });

    await ref.set({
      lastQueuedAt: now,
      updatedAt: now,
    }, {merge: true});

    return res.status(200).type("text/xml").send(buildMessagingTwiml(""));
  } catch (err) {
    const msg = (err && err.message) ? err.message : String(err);
    console.error("twilioWhatsappWebhook error:", msg);
    const fallback =
      "I'm sorry, but there was a technical problem reaching Felicity just now. " +
      "Please try sending your message again in a moment.";
    return res.status(200).type("text/xml").send(buildMessagingTwiml(fallback));
  }
});

exports.processWhatsappInboundMessage = onDocumentCreated(
  "whatsappInboundQueue/{messageId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const job = snapshot.data() || {};
    const from = String(job.from || "").trim();
    const contactId = String(job.contactId || whatsappContactDocId(from)).trim();
    const incomingText = String(job.incomingText || "").trim();
    const name = isString(job.name) ? String(job.name).trim() : "";
    const sessionId = isString(job.sessionId) ?
      String(job.sessionId).trim() :
      `whatsapp-${contactId}`;
    const messageSid = isString(job.messageSid) ? String(job.messageSid).trim() : null;
    const jobRef = snapshot.ref;
    const contactRef = db.collection("whatsappContacts").doc(contactId);
    const now = admin.firestore.FieldValue.serverTimestamp();

    if (!from || !incomingText) {
      await jobRef.set({
        status: "skipped",
        error: "Missing from or incomingText",
        updatedAt: now,
      }, {merge: true});
      return;
    }

    await jobRef.set({
      status: "processing",
      processingStartedAt: now,
      updatedAt: now,
    }, {merge: true});

    try {
      const contactSnapshot = await contactRef.get();
      const contact = contactSnapshot.exists ? (contactSnapshot.data() || {}) : {};
      const openAiResponseId = isString(contact.openAiResponseId) ?
        String(contact.openAiResponseId).trim() :
        (isString(job.openAiResponseId) ? String(job.openAiResponseId).trim() : "");
      const contactName = isString(contact.name) ? String(contact.name).trim() : name;
      const hospitalId = isString(contact.hospitalId) ?
        String(contact.hospitalId).trim() :
        (isString(job.hospitalId) ? String(job.hospitalId).trim() : DEFAULT_HOSPITAL_ID);
      const assessment = await ensureWhatsappAssessment({
        assessmentId: contact.currentAssessmentId || job.assessmentId,
        hospitalId,
        firstName: contactName,
        contactId,
        sessionId,
      });
      const effectiveResponseId = assessment.created ? "" : openAiResponseId;
      await contactRef.set({
        currentAssessmentId: assessment.assessmentId,
        hospitalId,
        openAiResponseId: effectiveResponseId || null,
        updatedAt: now,
      }, {merge: true});
      const prompt = buildWhatsappPrompt({
        contactName: contactName,
        userMessage: incomingText,
        hasExistingThread: !!effectiveResponseId,
      });

      const chatResult = await postToChatApi({
        prompt: prompt,
        threadId: effectiveResponseId,
        sessionId: sessionId,
        assessmentId: assessment.assessmentId,
        hospitalId: hospitalId,
        channel: "whatsapp",
      });

      const reportUrl = isString(chatResult.downloadUrl) ?
        String(chatResult.downloadUrl).trim() :
        (
          chatResult.assessmentUpdate &&
          isString(chatResult.assessmentUpdate.pdfUrl) ?
            String(chatResult.assessmentUpdate.pdfUrl).trim() :
            ""
        );
      const reply = formatReplyForWhatsapp(
        reportUrl ?
          buildWhatsappReportReply(reportUrl) :
          (
            chatResult.reply ||
            "I'm sorry, but I hit a technical problem just now. Please try again."
          )
      );
      const nextThreadId = isString(chatResult.threadId) ?
        String(chatResult.threadId).trim() :
        "";
      const sentMessageSids = await sendWhatsappMessages(from, reply);

      await contactRef.set({
        openAiResponseId: nextThreadId || effectiveResponseId || null,
        lastOutboundAt: now,
        lastOutboundBody: reply,
        lastOutboundMessageSids: sentMessageSids,
        updatedAt: now,
        currentAssessmentId: assessment.assessmentId,
        hospitalId,
      }, {merge: true});

      const assessmentSnapshot = await assessment.ref.get();
      const assessmentData = assessmentSnapshot.data() || {};
      const createdAt = assessmentData.createdAt &&
        typeof assessmentData.createdAt.toDate === "function" ?
        assessmentData.createdAt.toDate().getTime() :
        Date.now();
      await assessment.ref.set({
        firstName: contactName || assessmentData.firstName || null,
        openAiResponseId: nextThreadId || effectiveResponseId || null,
        totalMessages: admin.firestore.FieldValue.increment(2),
        messageCount: admin.firestore.FieldValue.increment(2),
        conversationDurationMinutes: Math.max(
          0,
          Math.round((Date.now() - createdAt) / 60000)
        ),
        updatedAt: now,
      }, {merge: true});

      await jobRef.set({
        status: "sent",
        completedAt: now,
        updatedAt: now,
        reply: reply,
        openAiResponseId: nextThreadId || effectiveResponseId || null,
        sentMessageSids: sentMessageSids,
      }, {merge: true});
    } catch (err) {
      const msg = (err && err.message) ? err.message : String(err);
      console.error("processWhatsappInboundMessage error:", msg);
      const fallback =
        "I'm sorry, but there was a technical problem reaching Felicity just now. " +
        "Please try sending your message again in a moment.";

      try {
        const sentMessageSids = await sendWhatsappMessages(from, fallback);
        await contactRef.set({
          lastOutboundAt: now,
          lastOutboundBody: fallback,
          lastOutboundMessageSids: sentMessageSids,
          lastOutboundError: msg,
          updatedAt: now,
        }, {merge: true});
      } catch (sendErr) {
        console.error(
          "processWhatsappInboundMessage fallback send error:",
          sendErr && sendErr.message ? sendErr.message : String(sendErr)
        );
      }

      await jobRef.set({
        status: "error",
        error: msg,
        failedAt: now,
        updatedAt: now,
        messageSid: messageSid,
      }, {merge: true});
    }
  }
);
