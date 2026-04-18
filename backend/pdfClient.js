const { generateSummaryPdf } = require("./generatePdf");

/**
 * Compatibility wrapper around backend/generatePdf.js.
 * Keeps older imports working while using the normalized payload handling.
 * @param {Object} data - patient/session data for the PDF
 * @param {Object} [options] - optional function URL / ID token
 * @returns {Promise<Object|null>} response data or null if error
 */
async function pdfClient(data, options) {
  try {
    const response = await generateSummaryPdf(data, options);

    console.log("✅ Function response:", response);

    if (response && response.downloadUrl) {
      console.log("➡️ Download link:", response.downloadUrl);
    } else if (response && response.storagePath) {
      console.log("➡️ Stored at:", response.storagePath);
    }

    return response;
  } catch (err) {
    console.error(
      "❌ Error from Cloud Function:",
      err.response?.data || err.message
    );
    return null;
  }
}

// Quick test when running locally: `node backend/generatePdf.js`
if (require.main === module) {
  pdfClient({
    patientName: "John Smith",
    symptomSummary: "Urgency + frequency, 12x/day, 2x/night",
    previousTreatments:
      "Tried bladder training, oxybutynin (dry mouth), solifenacin",
    socialFactors: "Busy job, no car, wants minimal clinic visits",
    treatmentRecommended: "PTNS initially, consider Botox if access is difficult",
    treatmentExplanation:
      "PTNS is non-invasive but weekly; Botox lasts 6–12 months but may require ISC.",
    questionsForDoctor:
      "How long until PTNS starts to work?\nWhat is the success rate?\nWhat are the risks with Botox?",
    sessionId: "local-test-001",
  });
}

module.exports = pdfClient;
