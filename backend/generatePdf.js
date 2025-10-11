'use strict';

/**
 * OAB PDF Function tester / helper
 *
 * Usage (unauthenticated; returns short-lived signed URL):
 *   node generatePdf.js
 *
 * Usage (authenticated; returns storagePath):
 *   node generatePdf.js --token="FIREBASE_ID_TOKEN"
 *
 * Custom payload file:
 *   node generatePdf.js --payload=./payload.json
 *
 * Override function URL:
 *   node generatePdf.js --url="https://europe-west2-<project-id>.cloudfunctions.net/generateSummaryPdf"
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ---- Defaults (edit if needed)
var DEFAULT_FUNCTION_URL = process.env.PDF_FUNCTION_URL ||
  'https://europe-west2-oab-decision-aid.cloudfunctions.net/generateSummaryPdf';

// ---- Simple CLI arg parser
function parseArgs(argv) {
  var args = {};
  for (var i = 0; i < argv.length; i++) {
    var a = argv[i];
    if (a.indexOf('--') === 0) {
      var eq = a.indexOf('=');
      if (eq > -1) {
        var k = a.substring(2, eq);
        var v = a.substring(eq + 1);
        args[k] = v;
      } else {
        var key = a.substring(2);
        var next = argv[i + 1];
        if (next && next.indexOf('--') !== 0) {
          args[key] = next;
          i++;
        } else {
          args[key] = true;
        }
      }
    }
  }
  return args;
}

function isString(x) {
  return typeof x === 'string';
}
function coerceText(x, fb) {
  var fallback = isString(fb) ? fb : 'Not provided';
  if (x === undefined || x === null) return fallback;
  var s = String(x);
  return s.trim().length ? s.trim() : fallback;
}

function loadPayloadFromFile(p) {
  var abs = path.isAbsolute(p) ? p : path.join(process.cwd(), p);
  var txt = fs.readFileSync(abs, 'utf8');
  return JSON.parse(txt);
}

function buildDefaultPayload() {
  return {
    patientName: 'Test Patient',
    symptomSummary: 'Urgency ~12/day, nocturia 2/night, some urge leakage (pads 2/day).',
    previousTreatments: 'PFMT (partial), solifenacin (stopped due to dry mouth).',
    socialFactors: 'Works full-time, prefers minimal clinic visits; ok with injections; no car.',
    treatmentRecommended: 'PTNS initially; if logistics become difficult, consider intradetrusor Botox.',
    treatmentExplanation: 'PTNS is non-invasive (weekly x12, then monthly); Botox gives 6–12 month benefit but small ISC risk.',
    questionsForDoctor: 'What counts as success for me? If Botox, what dose and my ISC risk? How will we track improvement (diary, ICIQ-OAB, pad counts)?',
    sessionId: 'demo-local'
  };
}

function validateMinimal(payload) {
  var missing = [];
  if (!payload || typeof payload !== 'object') {
    return ['payload'];
  }
  if (!isString(payload.symptomSummary) || payload.symptomSummary.trim() === '') {
    missing.push('symptomSummary');
  }
  if (!isString(payload.treatmentRecommended) || payload.treatmentRecommended.trim() === '') {
    missing.push('treatmentRecommended');
  }
  if (!isString(payload.treatmentExplanation) || payload.treatmentExplanation.trim() === '') {
    missing.push('treatmentExplanation');
  }
  return missing;
}

/**
 * Calls the Cloud Function and returns the JSON response.
 * If `idToken` is provided, the function will return { mode:'storage', storagePath }
 * Otherwise it returns { mode:'signed-url', downloadUrl, expiresAt }
 */
async function generateSummaryPdf(payload, options) {
  var opts = options || {};
  var url = isString(opts.url) && opts.url ? opts.url : DEFAULT_FUNCTION_URL;
  var idToken = isString(opts.idToken) && opts.idToken ? opts.idToken : null;

  // Coerce text fields to avoid undefined
  var body = {
    patientName: coerceText(payload.patientName),
    symptomSummary: coerceText(payload.symptomSummary),
    previousTreatments: coerceText(payload.previousTreatments),
    socialFactors: coerceText(payload.socialFactors),
    treatmentRecommended: coerceText(payload.treatmentRecommended),
    treatmentExplanation: coerceText(payload.treatmentExplanation),
    questionsForDoctor: coerceText(payload.questionsForDoctor),
    sessionId: isString(payload.sessionId) && payload.sessionId ? String(payload.sessionId) : 'nosession'
  };

  var headers = { 'Content-Type': 'application/json' };
  if (idToken) {
    headers.Authorization = 'Bearer ' + idToken;
  }

  var res = await axios.post(url, body, { headers: headers });
  return res.data;
}

// ---- CLI runner
async function main() {
  var args = parseArgs(process.argv.slice(2));

  if (args.help || args.h) {
    console.log('\nUsage: node generatePdf.js [--payload=./payload.json] [--token=ID_TOKEN] [--url=FUNCTION_URL]');
    console.log('Env fallback: PDF_FUNCTION_URL\n');
    process.exit(0);
  }

  var payload = null;
  if (args.payload) {
    try {
      payload = loadPayloadFromFile(args.payload);
    } catch (e) {
      console.error('❌ Failed to read payload file:', e && e.message ? e.message : String(e));
      process.exit(1);
    }
  } else {
    payload = buildDefaultPayload();
  }

  // Minimal validation
  var missing = validateMinimal(payload);
  if (missing.length) {
    console.error('❌ Missing required fields in payload:', missing.join(', '));
    process.exit(1);
  }

  var options = {
    url: isString(args.url) ? args.url : (process.env.PDF_FUNCTION_URL || DEFAULT_FUNCTION_URL),
    idToken: isString(args.token) ? args.token : (process.env.FIREBASE_ID_TOKEN || null)
  };

  console.log('→ Calling function:', options.url);
  if (options.idToken) console.log('→ Using ID token (authenticated mode).');

  try {
    var data = await generateSummaryPdf(payload, options);
    console.log('✅ Response:', data);

    if (data && data.downloadUrl) {
      console.log('✅ PDF Link:', data.downloadUrl);
    } else if (data && data.storagePath) {
      console.log('✅ Storage Path:', data.storagePath);
      console.log('   (Use Firebase Storage getDownloadURL() on the client for owner-only access.)');
    } else {
      console.log('ℹ️ No link returned; full response printed above.');
    }
    process.exit(0);
  } catch (err) {
    if (err && err.response) {
      console.error('❌ HTTP Error:', err.response.status, err.response.statusText);
      console.error('   Body:', err.response.data);
    } else {
      console.error('❌ Error:', err && err.message ? err.message : String(err));
    }
    process.exit(2);
  }
}

// Run only if invoked directly
if (require.main === module) {
  main();
}

module.exports = {
  generateSummaryPdf: generateSummaryPdf
};