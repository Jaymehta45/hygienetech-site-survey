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

    try {
      const result = await sendPdfViaApi({ state, blob, filename });
      const savedPath =
        (result.saved && (result.saved.relativePath || result.saved.storedName)) || "submitted-pdfs/";
      const mailTo = (result.emailed && result.emailed.to) || window.HT_CONFIG.emailTo;
      onStatus(
        `Done. PDF saved (${savedPath}) and emailed to ${mailTo}.`,
        "ok"
      );
    } catch (err) {
      console.error(err);
      const msg = String(err.message || err);
      if (/activate|confirm|check your email/i.test(msg)) {
        onStatus(
          `PDF downloaded. Email needs one-time activation at ${window.HT_CONFIG.emailTo} — open that mail, confirm, then submit again. Use npm start so PDFs also save into submitted-pdfs/.`,
          "info"
        );
        return;
      }
      onStatus(
        `PDF downloaded on this device. Server save/email failed (${msg}). Run npm start locally to store PDFs in submitted-pdfs/.`,
        "err"
      );
    }
  }

  window.HT_EMAIL = { submit };
})();
