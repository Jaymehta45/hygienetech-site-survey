(() => {
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
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

  async function submit({ state, blob, filename, onStatus }) {
    downloadBlob(blob, filename);

    onStatus(`PDF saved. Emailing report to ${window.HT_CONFIG.emailTo}…`, "info");

    try {
      await sendViaFormSubmit({ state, blob, filename });
      onStatus(
        `Report emailed to ${window.HT_CONFIG.emailTo}. A local PDF copy was also downloaded.`,
        "ok"
      );
    } catch (err) {
      console.error(err);
      const msg = String(err.message || err);
      // First-time FormSubmit activation lands in the inbox
      if (/activate|confirm|check your email/i.test(msg)) {
        onStatus(
          `Almost there: open the activation email sent to ${window.HT_CONFIG.emailTo}, confirm once, then generate the PDF again.`,
          "info"
        );
        return;
      }
      onStatus(
        `PDF downloaded, but email failed (${msg}). Attach the PDF manually to ${window.HT_CONFIG.emailTo}.`,
        "err"
      );
    }
  }

  window.HT_EMAIL = { submit };
})();
