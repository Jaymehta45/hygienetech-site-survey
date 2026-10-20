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

  /** Browser-side FormSubmit — Origin header makes PDF email work. */
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
    if (!res.ok || data.success === "false" || data.success === false) {
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
      throw new Error(data.error || `Save/email failed (${res.status})`);
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

    onStatus(`PDF downloaded. Saving to submitted-pdfs and emailing to ${window.HT_CONFIG.emailTo}…`, "info");

    let apiResult = null;
    try {
      apiResult = await sendPdfViaApi({ state, blob, filename });
    } catch (apiErr) {
      console.warn("API save/email failed:", apiErr);
    }

    const alreadyEmailed = Boolean(apiResult && apiResult.emailed);
    if (!alreadyEmailed) {
      try {
        await sendPdfOnlyViaFormSubmit({ state, blob, filename });
      } catch (mailErr) {
        console.error(mailErr);
        const msg = String(mailErr.message || mailErr);
        const savedPath =
          apiResult && apiResult.saved
            ? apiResult.saved.relativePath || apiResult.saved.storedName
            : null;

        if (/activate|confirm|check your email/i.test(msg)) {
          onStatus(
            `PDF downloaded${savedPath ? ` and saved (${savedPath})` : ""}. Activate FormSubmit once via the email sent to ${window.HT_CONFIG.emailTo}, then submit again.`,
            "info"
          );
          return;
        }

        onStatus(
          `PDF downloaded${savedPath ? ` and saved (${savedPath})` : ""}. Email failed (${msg}). For reliable folder saves, run: npm start`,
          savedPath ? "info" : "err"
        );
        return;
      }
    }

    const savedPath =
      (apiResult && apiResult.saved && (apiResult.saved.relativePath || apiResult.saved.storedName)) ||
      "submitted-pdfs/";
    onStatus(`Done. PDF saved (${savedPath}) and emailed to ${window.HT_CONFIG.emailTo}.`, "ok");
  }

  window.HT_EMAIL = { submit };
})();
