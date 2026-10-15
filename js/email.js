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

  async function sendViaFormSubmit({ state, blob, filename }) {
    const to = window.HT_CONFIG.emailTo;
    const fd = new FormData();

    fd.append("_subject", `Site Survey Report — ${state.clientName || "Client"} / ${state.siteName || "Site"}`);
    fd.append("_template", "table");
    fd.append("_captcha", "false");
    fd.append("_honey", "");

    if (state.contactPerson || state.surveyBy) {
      fd.append("name", state.contactPerson || state.surveyBy || "Site Survey");
    }
    if (state.contactNumber) {
      fd.append("contact_number", state.contactNumber);
    }

    fd.append("client_name", state.clientName || "—");
    fd.append("site_name", state.siteName || "—");
    fd.append("survey_date", state.surveyDate || "—");
    fd.append("survey_conducted_by", state.surveyBy || "—");
    fd.append("site_address", state.siteAddress || "—");
    fd.append(
      "message",
      `New HygieneTech housekeeping site survey PDF attached.\n\nClient: ${state.clientName || "—"}\nSite: ${state.siteName || "—"}\nDate: ${state.surveyDate || "—"}\nSurveyor: ${state.surveyBy || "—"}`
    );
    fd.append("attachment", blob, filename);

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

  async function submit({ state, blob, filename, doc, onStatus }) {
    // 1) Download PDF first (primary action)
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

    onStatus(`PDF downloaded: ${filename}. Sending a copy to ${window.HT_CONFIG.emailTo}…`, "ok");

    // 2) Email is secondary — never undo a successful download
    try {
      await sendViaFormSubmit({ state, blob, filename });
      onStatus(
        `PDF downloaded and emailed to ${window.HT_CONFIG.emailTo}.`,
        "ok"
      );
    } catch (err) {
      console.error(err);
      const msg = String(err.message || err);
      if (/activate|confirm|check your email/i.test(msg)) {
        onStatus(
          `PDF downloaded. To enable auto-email, open the activation mail at ${window.HT_CONFIG.emailTo} once, then try again.`,
          "info"
        );
        return;
      }
      onStatus(
        `PDF downloaded successfully. Email could not be sent (${msg}) — attach the file manually to ${window.HT_CONFIG.emailTo} if needed.`,
        "info"
      );
    }
  }

  window.HT_EMAIL = { submit };
})();
