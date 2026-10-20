const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");

const EMAIL_TO_DEFAULT = "info@hygienetech.in";
const SITE_ORIGIN = process.env.SITE_ORIGIN || "https://site-survey-gamma.vercel.app";
const PDF_DIR = path.join(__dirname, "..", "submitted-pdfs");

function safeName(value, fallback) {
  return String(value || fallback)
    .replace(/[^\w\-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || fallback;
}

function buildStoredFilename({ filename, clientName, siteName }) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  if (filename && /\.pdf$/i.test(filename)) {
    return `${stamp}_${safeName(filename.replace(/\.pdf$/i, ""), "survey")}.pdf`;
  }
  return `${stamp}_${safeName(clientName, "client")}_${safeName(siteName, "site")}.pdf`;
}

function ensurePdfDir() {
  fs.mkdirSync(PDF_DIR, { recursive: true });
}

/** Save PDF into submitted-pdfs/ when the filesystem is writable (local server). */
function savePdfToFolder(pdfBuffer, meta) {
  ensurePdfDir();
  const storedName = buildStoredFilename(meta);
  const fullPath = path.join(PDF_DIR, storedName);
  fs.writeFileSync(fullPath, pdfBuffer);
  return { storedName, fullPath, relativePath: `submitted-pdfs/${storedName}` };
}

/** Commit PDF into submitted-pdfs/ on GitHub so it lands in the project folder remotely. */
async function savePdfToGitHub(pdfBuffer, meta) {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const repo = process.env.GITHUB_REPO || "Jaymehta45/hygienetech-site-survey";
  if (!token) return null;

  const storedName = buildStoredFilename(meta);
  const apiPath = `submitted-pdfs/${storedName}`;
  const [owner, repoName] = repo.split("/");
  const content = pdfBuffer.toString("base64");

  const res = await fetch(`https://api.github.com/repos/${owner}/${repoName}/contents/${apiPath}`, {
    method: "PUT",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      "User-Agent": "hygienetech-site-survey",
    },
    body: JSON.stringify({
      message: `Store site survey PDF: ${storedName}`,
      content,
      branch: process.env.GITHUB_BRANCH || "main",
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `GitHub save failed (${res.status})`);
  }
  return { storedName, relativePath: apiPath, htmlUrl: data.content && data.content.html_url };
}

async function sendPdfViaSmtp(pdfBuffer, meta) {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;

  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    auth: { user, pass },
  });

  const to = meta.to || process.env.EMAIL_TO || EMAIL_TO_DEFAULT;
  const filename = meta.filename || "HygieneTech_SiteSurvey.pdf";

  await transporter.sendMail({
    from: process.env.SMTP_FROM || user,
    to,
    subject: `Site Survey PDF — ${meta.clientName || "Client"} / ${meta.siteName || "Site"}`,
    text: [
      "HygieneTech Site Survey report is attached as a PDF.",
      "",
      `File: ${filename}`,
      `Client: ${meta.clientName || "—"}`,
      `Site: ${meta.siteName || "—"}`,
      `Survey date: ${meta.surveyDate || "—"}`,
      `Surveyor: ${meta.surveyBy || "—"}`,
      "",
      "Please open the attached PDF for the full report.",
    ].join("\n"),
    attachments: [
      {
        filename,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });

  return { method: "smtp", to };
}

async function sendPdfViaFormSubmit(pdfBuffer, meta) {
  const to = meta.to || process.env.EMAIL_TO || EMAIL_TO_DEFAULT;
  const filename = meta.filename || "HygieneTech_SiteSurvey.pdf";
  const fd = new FormData();

  fd.append("_subject", `Site Survey PDF — ${meta.clientName || "Client"} / ${meta.siteName || "Site"}`);
  fd.append("_captcha", "false");
  fd.append("_template", "box");
  fd.append(
    "message",
    [
      "HygieneTech Site Survey report is attached as a PDF.",
      "",
      `File: ${filename}`,
      `Client: ${meta.clientName || "—"}`,
      `Site: ${meta.siteName || "—"}`,
      `Survey date: ${meta.surveyDate || "—"}`,
      `Surveyor: ${meta.surveyBy || "—"}`,
      "",
      "Please open the attached PDF for the full report.",
    ].join("\n")
  );
  fd.append("attachment", new Blob([pdfBuffer], { type: "application/pdf" }), filename);

  const res = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(to)}`, {
    method: "POST",
    body: fd,
    headers: {
      Accept: "application/json",
      Origin: SITE_ORIGIN,
      Referer: `${SITE_ORIGIN}/`,
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === "false" || data.success === false) {
    throw new Error(data.message || data.error || `FormSubmit failed (${res.status})`);
  }
  return { method: "formsubmit", to, data };
}

async function emailPdf(pdfBuffer, meta) {
  const smtp = await sendPdfViaSmtp(pdfBuffer, meta);
  if (smtp) return smtp;
  return sendPdfViaFormSubmit(pdfBuffer, meta);
}

/**
 * Save PDF to local folder (and optionally GitHub), then email the PDF.
 */
async function submitSurveyPdf(pdfBuffer, meta = {}) {
  const result = {
    savedLocal: null,
    savedGitHub: null,
    emailed: null,
  };

  try {
    result.savedLocal = savePdfToFolder(pdfBuffer, meta);
  } catch (err) {
    // Vercel filesystem is read-only except /tmp — expected in production
    result.savedLocalError = err.message;
    try {
      const tmpName = buildStoredFilename(meta);
      const tmpPath = path.join("/tmp", tmpName);
      fs.writeFileSync(tmpPath, pdfBuffer);
      result.savedLocal = { storedName: tmpName, fullPath: tmpPath, relativePath: tmpPath, temporary: true };
    } catch (tmpErr) {
      result.savedLocalError = tmpErr.message;
    }
  }

  try {
    result.savedGitHub = await savePdfToGitHub(pdfBuffer, meta);
  } catch (err) {
    result.savedGitHubError = err.message;
  }

  result.emailed = await emailPdf(pdfBuffer, meta);
  return result;
}

module.exports = {
  PDF_DIR,
  EMAIL_TO_DEFAULT,
  submitSurveyPdf,
  savePdfToFolder,
  emailPdf,
};
