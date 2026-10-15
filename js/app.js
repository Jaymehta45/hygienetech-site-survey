(() => {
  const STORAGE_KEY = "ht-site-survey-v1";
  const schema = window.HT_SCHEMA;
  const state = loadState();

  const els = {
    stepRoot: document.getElementById("stepRoot"),
    stepLabel: document.getElementById("stepLabel"),
    progressFill: document.getElementById("progressFill"),
    btnPrev: document.getElementById("btnPrev"),
    btnNext: document.getElementById("btnNext"),
    status: document.getElementById("statusBanner"),
  };

  let stepIndex = Math.min(state.stepIndex || 0, schema.length - 1);

  function loadState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function saveState() {
    state.stepIndex = stepIndex;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function val(name, fallback = "") {
    return state[name] ?? fallback;
  }

  function setVal(name, value) {
    state[name] = value;
    saveState();
  }

  function slug(text) {
    return String(text)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function showStatus(message, type = "info") {
    els.status.className = `status-banner show ${type}`;
    els.status.textContent = message;
  }

  function clearStatus() {
    els.status.className = "status-banner";
    els.status.textContent = "";
  }

  function renderField(field) {
    const id = field.name;
    const value = escapeHtml(val(id));

    if (field.type === "choice") {
      const options = field.options
        .map((opt) => {
          const checked = val(id) === opt ? "checked" : "";
          return `<label class="choice"><input type="radio" name="${id}" value="${escapeHtml(opt)}" ${checked}><span>${escapeHtml(opt)}</span></label>`;
        })
        .join("");
      return `<div class="field" data-field="${id}"><label>${escapeHtml(field.label)}</label><div class="choice-row">${options}</div></div>`;
    }

    if (field.type === "textarea") {
      return `<div class="field"><label for="${id}">${escapeHtml(field.label)}</label><textarea id="${id}" name="${id}" placeholder="${escapeHtml(field.placeholder || "")}">${value}</textarea></div>`;
    }

    const inputType = field.type || "text";
    const mode = inputType === "number" ? "decimal" : inputType === "tel" ? "tel" : "text";
    return `<div class="field"><label for="${id}">${escapeHtml(field.label)}</label><input id="${id}" name="${id}" type="${inputType}" inputmode="${mode}" placeholder="${escapeHtml(field.placeholder || "")}" value="${value}"></div>`;
  }

  function renderTable(section) {
    const colCount = section.columns.length + 1;
    const header = `<div class="table-row header cols-${colCount}"><div>Particular</div>${section.columns.map((c) => `<div>${escapeHtml(c.label)}</div>`).join("")}</div>`;
    const rows = section.rows
      .map((row) => {
        const cells = section.columns
          .map((col) => {
            const name = `${section.id}_${row.key}_${col.key}`;
            const inputType = col.input || "text";
            const mode = inputType === "number" ? "decimal" : "text";
            return `<input name="${name}" type="${inputType}" inputmode="${mode}" value="${escapeHtml(val(name))}" aria-label="${escapeHtml(row.label)} ${escapeHtml(col.label)}">`;
          })
          .join("");
        return `<div class="table-row cols-${colCount}"><label>${escapeHtml(row.label)}</label>${cells}</div>`;
      })
      .join("");
    return `<div class="table-block">${header}${rows}</div>`;
  }

  function renderMatrix(section) {
    const header = `<div class="table-row header cols-5"><div>Activity</div>${section.columns.map((c) => `<div>${escapeHtml(c)}</div>`).join("")}</div>`;
    const rows = section.rows
      .map((activity) => {
        const cells = section.columns
          .map((col) => {
            const name = `freq_${slug(activity)}_${slug(col)}`;
            const checked = val(name) === true || val(name) === "true" ? "checked" : "";
            return `<label class="check-item" style="justify-content:center;padding:8px;margin:0"><input type="checkbox" name="${name}" ${checked}><span class="hidden">${escapeHtml(col)}</span></label>`;
          })
          .join("");
        return `<div class="table-row cols-5"><label>${escapeHtml(activity)}</label>${cells}</div>`;
      })
      .join("");
    return `<div class="table-block">${header}${rows}</div>`;
  }

  function renderChecks(section) {
    return `<div class="check-grid">${section.items
      .map((item) => {
        const name = `${section.prefix}_${slug(item)}`;
        const checked = val(name) === true || val(name) === "true" ? "checked" : "";
        return `<label class="check-item"><input type="checkbox" name="${name}" ${checked}><span>${escapeHtml(item)}</span></label>`;
      })
      .join("")}</div>`;
  }

  function renderSupply(section) {
    const header = `<div class="table-row header cols-3"><div>Item</div><div>Client</div><div>Contractor</div></div>`;
    const rows = section.items
      .map((item) => {
        const base = `supply_${slug(item)}`;
        const client = val(`${base}_client`) === true || val(`${base}_client`) === "true" ? "checked" : "";
        const contractor = val(`${base}_contractor`) === true || val(`${base}_contractor`) === "true" ? "checked" : "";
        return `<div class="table-row cols-3"><label>${escapeHtml(item)}</label>
          <label class="check-item" style="justify-content:center;padding:8px;margin:0"><input type="checkbox" name="${base}_client" ${client}></label>
          <label class="check-item" style="justify-content:center;padding:8px;margin:0"><input type="checkbox" name="${base}_contractor" ${contractor}></label>
        </div>`;
      })
      .join("");
    return `<div class="table-block">${header}${rows}</div>`;
  }

  function renderYesNo(section) {
    return `<div class="check-grid">${section.items
      .map((item) => {
        const name = `comp_${slug(item)}`;
        const current = val(name);
        return `<div class="yesno"><span>${escapeHtml(item)}</span>
          <div class="choice-row">
            <label class="choice"><input type="radio" name="${name}" value="Yes" ${current === "Yes" ? "checked" : ""}><span>Yes</span></label>
            <label class="choice"><input type="radio" name="${name}" value="No" ${current === "No" ? "checked" : ""}><span>No</span></label>
          </div>
        </div>`;
      })
      .join("")}</div>`;
  }

  function renderReview() {
    const filled = Object.keys(state).filter((k) => k !== "stepIndex" && state[k] !== "" && state[k] !== false && state[k] != null).length;
    return `
      <div class="review-list">
        <div class="review-item"><strong>Client</strong><span>${escapeHtml(val("clientName") || "—")}</span></div>
        <div class="review-item"><strong>Site</strong><span>${escapeHtml(val("siteName") || "—")}</span></div>
        <div class="review-item"><strong>Survey date</strong><span>${escapeHtml(val("surveyDate") || "—")}</span></div>
        <div class="review-item"><strong>Surveyor</strong><span>${escapeHtml(val("surveyBy") || "—")}</span></div>
        <div class="review-item"><strong>Fields captured</strong><span>${filled}</span></div>
        <div class="review-item"><strong>Also emails</strong><span>${escapeHtml(window.HT_CONFIG.emailTo)}</span></div>
      </div>
      <p class="step-desc" style="margin-top:16px;margin-bottom:0">Tap <strong>Download PDF</strong> to save the report on this device. A copy is also emailed to the office afterward.</p>
    `;
  }

  function collectFromDom() {
    const root = els.stepRoot;
    root.querySelectorAll("input, textarea, select").forEach((el) => {
      if (!el.name) return;
      if (el.type === "checkbox") {
        setVal(el.name, el.checked);
      } else if (el.type === "radio") {
        if (el.checked) setVal(el.name, el.value);
      } else {
        setVal(el.name, el.value);
      }
    });
  }

  function render() {
    const section = schema[stepIndex];
    const total = schema.length;
    const progress = ((stepIndex + 1) / total) * 100;

    els.progressFill.style.width = `${progress}%`;
    els.stepLabel.textContent = `Step ${stepIndex + 1} of ${total}`;
    els.btnPrev.disabled = stepIndex === 0;

    const isLast = stepIndex === total - 1;
    els.btnNext.textContent = isLast ? "Download PDF" : "Next";

    let body = "";
    if (section.kind === "table") body = renderTable(section);
    else if (section.kind === "matrix") body = renderMatrix(section);
    else if (section.kind === "checks") body = renderChecks(section);
    else if (section.kind === "supply") body = renderSupply(section);
    else if (section.kind === "yesno") body = renderYesNo(section);
    else if (section.kind === "review") body = renderReview();
    else body = `<div class="field-grid">${section.fields.map(renderField).join("")}</div>`;

    const tips = section.tips
      ? `<ul class="tips" style="margin-top:18px">${section.tips.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>`
      : "";

    els.stepRoot.innerHTML = `
      <p class="step-kicker">Section ${section.id === "REVIEW" ? "Final" : section.id}</p>
      <h2 class="step-title">${escapeHtml(section.title)}</h2>
      <p class="step-desc">${escapeHtml(section.desc || "")}</p>
      ${body}
      ${tips}
    `;

    saveState();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function bindLiveSave() {
    els.stepRoot.addEventListener("change", () => collectFromDom());
    els.stepRoot.addEventListener("input", () => collectFromDom());
  }

  els.btnPrev.addEventListener("click", () => {
    collectFromDom();
    clearStatus();
    if (stepIndex > 0) {
      stepIndex -= 1;
      render();
    }
  });

  els.btnNext.addEventListener("click", async () => {
    collectFromDom();
    clearStatus();

    if (stepIndex < schema.length - 1) {
      stepIndex += 1;
      render();
      return;
    }

    els.btnNext.disabled = true;
    els.btnPrev.disabled = true;
    showStatus("Creating PDF…", "info");

    try {
      const { doc, blob, filename } = await window.HT_PDF.generate(state);
      await window.HT_EMAIL.submit({ state, blob, filename, doc, onStatus: showStatus });
    } catch (err) {
      console.error(err);
      showStatus(err.message || "Something went wrong while creating the report.", "err");
    } finally {
      els.btnNext.disabled = false;
      els.btnPrev.disabled = false;
    }
  });

  bindLiveSave();
  render();
})();
