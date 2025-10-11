// backend/generatePdf.js

const axios = require("axios");

/**
 * Calls the deployed Cloud Function to generate a summary PDF.
 * @param {Object} data - patient/session data for the PDF
 * @returns {Promise<Object|null>} response data or null if error
 */
async function generateSummaryPdf(data) {
  try {
    const response = await axios.post(
      "https://europe-west2-oab-decision-aid.cloudfunctions.net/generateSummaryPdf",
      data,
      { headers: { "Content-Type": "application/json" } }
    );

    console.log("✅ Function response:", response.data);

    if (response.data.downloadUrl) {
      console.log("➡️ Download link:", response.data.downloadUrl);
    } else if (response.data.storagePath) {
      console.log("➡️ Stored at:", response.data.storagePath);
    }

    return response.data;
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
  generateSummaryPdf({
    patientName: "John Smith",
    symptomSummary: "Urgency + frequency, 12x/day, 2x/night",
    previousTreatments:
      "Tried bladder training, oxybutynin (dry mouth), solifenacin",
    socialFactors: "Busy job, no car, wants minimal clinic visits",
    treatmentRecommended: "PTNS initially, consider Botox if access is difficult",
    treatmentExplanation:
      "PTNS is non-invasive but weekly; Botox lasts 6–12 months but may require ISC.",
    questionsForDoctor: [
      "How long until PTNS starts to work?",
      "What is the success rate?",
      "What are the risks with Botox?",
    ],
    sessionId: "local-test-001",
  });
}

module.exports = generateSummaryPdf;