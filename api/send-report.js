/**
 * Accepts the generated PDF and emails it to HygieneTech.
 * Body is a short notice only — the PDF is the attachment (not the form fields).
 */
module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    res.end(JSON.stringify({ ok: false, error: "Method not allowed" }));
    return;
  }

  try {
    let body = req.body;
    if (!body || typeof body === "string") {
      if (typeof body === "string" && body) {
        body = JSON.parse(body);
      } else {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const raw = Buffer.concat(chunks).toString("utf8");
        body = JSON.parse(raw || "{}");
      }
    }

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

    const pdfBuffer = Buffer.from(String(pdfBase64).replace(/^data:application\/pdf;base64,/, ""), "base64");
    if (!pdfBuffer.length) {
      res.statusCode = 400;
      res.end(JSON.stringify({ ok: false, error: "Invalid PDF data" }));
      return;
    }

    const fd = new FormData();
    fd.append(
      "_subject",
      `Site Survey PDF — ${clientName} / ${siteName}`
    );
    fd.append("_captcha", "false");
    fd.append("_template", "box");
    fd.append(
      "message",
      [
        "HygieneTech Site Survey report is attached as a PDF.",
        "",
        `File: ${filename}`,
        `Client: ${clientName}`,
        `Site: ${siteName}`,
        `Survey date: ${surveyDate}`,
        `Surveyor: ${surveyBy}`,
        "",
        "Please open the attached PDF for the full report.",
      ].join("\n")
    );

    const pdfBlob = new Blob([pdfBuffer], { type: "application/pdf" });
    fd.append("attachment", pdfBlob, filename);

    const upstream = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(to)}`, {
      method: "POST",
      body: fd,
      headers: { Accept: "application/json" },
    });

    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      res.statusCode = upstream.status || 502;
      res.end(
        JSON.stringify({
          ok: false,
          error: data.message || data.error || "Email provider rejected the PDF send",
        })
      );
      return;
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true, data }));
  } catch (err) {
    console.error(err);
    res.statusCode = 500;
    res.end(JSON.stringify({ ok: false, error: err.message || "Server error" }));
  }
};
