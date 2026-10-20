/**
 * Local server: serves the form, saves PDFs into submitted-pdfs/, emails the PDF.
 * Run: npm start
 */
require("dotenv").config();

const express = require("express");
const path = require("path");
const { execSync } = require("child_process");
const { submitSurveyPdf, PDF_DIR, EMAIL_TO_DEFAULT } = require("./lib/submit");

// Prefer GH token from env; otherwise try local `gh` CLI for GitHub folder sync
if (!process.env.GITHUB_TOKEN && !process.env.GH_TOKEN) {
  try {
    process.env.GITHUB_TOKEN = execSync("gh auth token", { encoding: "utf8" }).trim();
  } catch {
    /* optional */
  }
}

const app = express();
const PORT = Number(process.env.PORT || 5180);

app.use(express.json({ limit: "15mb" }));
app.use(express.static(__dirname));

app.post("/api/send-report", async (req, res) => {
  try {
    const {
      filename = "HygieneTech_SiteSurvey.pdf",
      pdfBase64,
      clientName = "—",
      siteName = "—",
      surveyDate = "—",
      surveyBy = "—",
      to = EMAIL_TO_DEFAULT,
    } = req.body || {};

    if (!pdfBase64) {
      res.status(400).json({ ok: false, error: "Missing pdfBase64" });
      return;
    }

    const pdfBuffer = Buffer.from(
      String(pdfBase64).replace(/^data:application\/pdf;base64,/, ""),
      "base64"
    );
    if (!pdfBuffer.length) {
      res.status(400).json({ ok: false, error: "Invalid PDF data" });
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

    res.json({
      ok: true,
      saved: result.savedLocal || result.savedGitHub,
      emailed: result.emailed,
      warnings: {
        local: result.savedLocalError || null,
        github: result.savedGitHubError || null,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message || "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(`HygieneTech Site Survey → http://localhost:${PORT}`);
  console.log(`PDFs save to → ${PDF_DIR}`);
  console.log(`Email to → ${process.env.EMAIL_TO || EMAIL_TO_DEFAULT}`);
});
