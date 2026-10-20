const { submitSurveyPdf } = require("../lib/submit");

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body) return JSON.parse(req.body);

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return JSON.parse(raw || "{}");
}

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end(JSON.stringify({ ok: false, error: "Method not allowed" }));
    return;
  }

  try {
    const body = await readJsonBody(req);
    const {
      filename = "HygieneTech_SiteSurvey.pdf",
      pdfBase64,
      clientName = "—",
      siteName = "—",
      surveyDate = "—",
      surveyBy = "—",
      to = "info@hygienetech.in",
    } = body;

    if (!pdfBase64) {
      res.statusCode = 400;
      res.end(JSON.stringify({ ok: false, error: "Missing pdfBase64" }));
      return;
    }

    const pdfBuffer = Buffer.from(
      String(pdfBase64).replace(/^data:application\/pdf;base64,/, ""),
      "base64"
    );
    if (!pdfBuffer.length) {
      res.statusCode = 400;
      res.end(JSON.stringify({ ok: false, error: "Invalid PDF data" }));
      return;
    }

    const result = await submitSurveyPdf(pdfBuffer, {
      filename,
      clientName,
      siteName,
      surveyDate,
      surveyBy,
      to,
    });

    res.statusCode = 200;
    res.end(
      JSON.stringify({
        ok: true,
        saved: result.savedLocal || result.savedGitHub,
        emailed: result.emailed,
        warnings: {
          local: result.savedLocalError || null,
          github: result.savedGitHubError || null,
        },
      })
    );
  } catch (err) {
    console.error(err);
    res.statusCode = 500;
    res.end(JSON.stringify({ ok: false, error: err.message || "Server error" }));
  }
};
