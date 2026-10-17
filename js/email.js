(() => {
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2500);
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || "");
        const base64 = result.includes(",") ? result.split(",")[1] : result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /** Email body is a short note + PDF file only — never the full form. */
  async function sendPdfOnlyViaFormSubmit({ state, blob, filename }) {
    const to = window.HT_CONFIG.emailTo;
    const pdfFile = new File([blob], filename, { type: "application/pdf" });
    const fd = new FormData();

    fd.append("_subject", `Site Survey PDF — ${state.clientName || "Client"} / ${state.siteName || "Site"}`);
    fd.append("_captcha", "false");
    fd.append("_template", "box");
    fd.append(
      "message",
      [
        "HygieneTech Site Survey report is attached as a PDF.",
        "",
        `File: ${filename}`,
        `Client: ${state.clientName || "—"}`,
        `Site: ${state.siteName || "—"}`,
        `Survey date: ${state.surveyDate || "—"}`,
        `Surveyor: ${state.surveyBy || "—"}`,
        "",
        "Please open the attached PDF for the full report.",
      ].join("\n")
    );
    fd.append("attachment", pdfFile);

    const res = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(to)}`, {
      method: "POST",
      body: fd,
      headers: { Accept: "application/json" },
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || data.error || `Email failed (${res.status})`);
    }
    return data;
  }

  async function sendPdfViaApi({ state, blob, filename }) {
    const pdfBase64 = await blobToBase64(blob);
    const res = await fetch("/api/send-report", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        filename,
        pdfBase64,
        clientName: state.clientName || "—",
        siteName: state.siteName || "—",
        surveyDate: state.surveyDate || "—",
        surveyBy: state.surveyBy || "—",
        to: window.HT_CONFIG.emailTo,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      throw new Error(data.error || `API email failed (${res.status})`);
    }
    return data;
  }

  async function submit({ state, blob, filename, doc, onStatus }) {
    onStatus("Downloading PDF…", "info");
    try {
      if (doc && typeof window.HT_PDF.download === "function") {
        window.HT_PDF.download(doc, filename);
      } else {
        downloadBlob(blob, filename);
      }
    } catch (err) {
      console.error(err);
      downloadBlob(blob, filename);
    }

    onStatus(`PDF downloaded: ${filename}. Emailing the PDF to ${window.HT_CONFIG.emailTo}…`, "ok");

    try {
      try {
        await sendPdfViaApi({ state, blob, filename });
      } catch (apiErr) {
        console.warn("API PDF email failed, trying FormSubmit PDF-only:", apiErr);
        await sendPdfOnlyViaFormSubmit({ state, blob, filename });
      }

      onStatus(
        `PDF downloaded and emailed to ${window.HT_CONFIG.emailTo} (PDF attachment, not the form).`,
        "ok"
      );
    } catch (err) {
      console.error(err);
      const msg = String(err.message || err);
      if (/activate|confirm|check your email/i.test(msg)) {
        onStatus(
          `PDF downloaded. To enable PDF email, open the activation mail at ${window.HT_CONFIG.emailTo} once, then try again.`,
          "info"
        );
        return;
      }
      onStatus(
        `PDF downloaded. Email of the PDF failed (${msg}) — attach the downloaded file to ${window.HT_CONFIG.emailTo} manually.`,
        "info"
      );
    }
  }

  window.HT_EMAIL = { submit };
})();
