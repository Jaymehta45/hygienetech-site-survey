(() => {
  function getJsPDF() {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      throw new Error("PDF library failed to load. Check your internet connection and refresh.");
    }
    return window.jspdf.jsPDF;
  }

  const GREEN = [45, 184, 75];
  const BLUE = [42, 91, 168];
  const INK = [21, 32, 51];
  const MUTED = [90, 106, 126];
  const LINE = [215, 224, 234];

  function filled(state, key) {
    const v = state[key];
    if (v === true) return "Yes";
    if (v === false || v == null || v === "") return "—";
    return String(v);
  }

  function slug(text) {
    return String(text)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
  }

  async function loadLogoDataUrl() {
    const res = await fetch("assets/logo.png");
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // Logo source is ~16:9 — keep that ratio when scaling
  const LOGO_RATIO = 800 / 450;

  function addHeader(doc, logoDataUrl, pageW) {
    const headerH = 42;
    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, pageW, headerH, "F");

    if (logoDataUrl) {
      try {
        const logoH = 34;
        const logoW = logoH * LOGO_RATIO;
        doc.addImage(logoDataUrl, "PNG", 10, (headerH - logoH) / 2, logoW, logoH);
      } catch {
        /* ignore logo failure */
      }
    }

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Site Survey Report", pageW - 12, 17, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(170, 190, 210);
    doc.text("Corporate Office Housekeeping", pageW - 12, 24, { align: "right" });
    doc.text("Scoping Checklist", pageW - 12, 29, { align: "right" });
    return headerH;
  }

  function addFooter(doc, pageW, pageH, page, total) {
    doc.setDrawColor(...LINE);
    doc.line(12, pageH - 12, pageW - 12, pageH - 12);
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("HygieneTech  •  Preserving Health • Enriching Lives", 12, pageH - 7);
    doc.text(`Page ${page} of ${total}`, pageW - 12, pageH - 7, { align: "right" });
  }

  function sectionTitle(doc, title, y) {
    doc.setFillColor(42, 91, 168);
    doc.roundedRect(12, y, 4, 7, 1, 1, "F");
    doc.setTextColor(...INK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(title, 20, y + 5.5);
    return y + 12;
  }

  function ensureSpace(ctx, need) {
    if (ctx.y + need > ctx.pageH - 18) {
      ctx.doc.addPage();
      const headerH = addHeader(ctx.doc, ctx.logo, ctx.pageW);
      ctx.y = headerH + 10;
    }
  }

  function kvTable(ctx, rows) {
    const usable = rows.filter((r) => filled(ctx.state, r.key) !== "—" || true);
    if (!usable.length) return;

    ensureSpace(ctx, 16);
    ctx.y = sectionTitle(ctx.doc, rows._title || "Details", ctx.y);

    ctx.doc.autoTable({
      startY: ctx.y,
      margin: { left: 12, right: 12 },
      head: [["Item", "Details"]],
      body: usable.map((r) => [r.label, filled(ctx.state, r.key)]),
      theme: "grid",
      styles: {
        fontSize: 9,
        cellPadding: 3,
        textColor: INK,
        lineColor: LINE,
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: BLUE,
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      alternateRowStyles: { fillColor: [248, 251, 254] },
      columnStyles: {
        0: { cellWidth: 70, fontStyle: "bold" },
        1: { cellWidth: "auto" },
      },
    });
    ctx.y = ctx.doc.lastAutoTable.finalY + 10;
  }

  function namedTable(ctx, title, head, body) {
    if (!body.length) return;
    ensureSpace(ctx, 20);
    ctx.y = sectionTitle(ctx.doc, title, ctx.y);
    ctx.doc.autoTable({
      startY: ctx.y,
      margin: { left: 12, right: 12 },
      head: [head],
      body,
      theme: "grid",
      styles: {
        fontSize: 8.5,
        cellPadding: 2.6,
        textColor: INK,
        lineColor: LINE,
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: BLUE,
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      alternateRowStyles: { fillColor: [248, 251, 254] },
    });
    ctx.y = ctx.doc.lastAutoTable.finalY + 10;
  }

  function buildFromSchema(ctx) {
    const schema = window.HT_SCHEMA.filter((s) => s.id !== "REVIEW");

    for (const section of schema) {
      if (section.kind === "table") {
        const head = ["Particular", ...section.columns.map((c) => c.label)];
        const body = section.rows.map((row) => [
          row.label,
          ...section.columns.map((col) => filled(ctx.state, `${section.id}_${row.key}_${col.key}`)),
        ]);
        namedTable(ctx, `${section.id}. ${section.title}`, head, body);
        continue;
      }

      if (section.kind === "matrix") {
        const head = ["Activity", ...section.columns];
        const body = section.rows.map((activity) => [
          activity,
          ...section.columns.map((col) => {
            const on = ctx.state[`freq_${slug(activity)}_${slug(col)}`] === true;
            return on ? "✓" : "";
          }),
        ]);
        namedTable(ctx, `${section.id}. ${section.title}`, head, body);
        continue;
      }

      if (section.kind === "checks") {
        const body = section.items.map((item) => {
          const on = ctx.state[`${section.prefix}_${slug(item)}`] === true;
          return [item, on ? "Required" : "—"];
        });
        namedTable(ctx, `${section.id}. ${section.title}`, ["Chemical", "Status"], body);
        continue;
      }

      if (section.kind === "supply") {
        const body = section.items.map((item) => {
          const base = `supply_${slug(item)}`;
          const client = ctx.state[`${base}_client`] === true ? "✓" : "";
          const contractor = ctx.state[`${base}_contractor`] === true ? "✓" : "";
          return [item, client, contractor];
        });
        namedTable(ctx, `${section.id}. ${section.title}`, ["Item", "Client", "Contractor"], body);
        continue;
      }

      if (section.kind === "yesno") {
        const body = section.items.map((item) => [item, filled(ctx.state, `comp_${slug(item)}`)]);
        namedTable(ctx, `${section.id}. ${section.title}`, ["Requirement", "Status"], body);
        continue;
      }

      if (section.fields) {
        const rows = section.fields.map((f) => ({ label: f.label, key: f.name }));
        rows._title = `${section.id}. ${section.title}`;
        const prev = ctx.y;
        ensureSpace(ctx, 16);
        ctx.y = sectionTitle(ctx.doc, rows._title, ctx.y);
        ctx.doc.autoTable({
          startY: ctx.y,
          margin: { left: 12, right: 12 },
          head: [["Item", "Details"]],
          body: rows.map((r) => [r.label, filled(ctx.state, r.key)]),
          theme: "grid",
          styles: {
            fontSize: 9,
            cellPadding: 3,
            textColor: INK,
            lineColor: LINE,
            lineWidth: 0.2,
          },
          headStyles: {
            fillColor: section.id === "A" ? GREEN : BLUE,
            textColor: [255, 255, 255],
            fontStyle: "bold",
          },
          alternateRowStyles: { fillColor: [248, 251, 254] },
          columnStyles: {
            0: { cellWidth: 70, fontStyle: "bold" },
            1: { cellWidth: "auto" },
          },
        });
        ctx.y = ctx.doc.lastAutoTable.finalY + 10;
        if (ctx.y === prev) ctx.y += 10;
      }
    }
  }

  async function generate(state) {
    const jsPDF = getJsPDF();
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const logo = await loadLogoDataUrl();

    const headerH = addHeader(doc, logo, pageW);
    let y = headerH + 8;

    // Large brand block on page 1
    if (logo) {
      try {
        const bigH = 28;
        const bigW = bigH * LOGO_RATIO;
        doc.setFillColor(0, 0, 0);
        doc.roundedRect(12, y, pageW - 24, bigH + 10, 3, 3, "F");
        doc.addImage(logo, "PNG", (pageW - bigW) / 2, y + 5, bigW, bigH);
        y += bigH + 18;
      } catch {
        y += 4;
      }
    }

    // Cover strip
    doc.setFillColor(248, 251, 254);
    doc.roundedRect(12, y, pageW - 24, 36, 3, 3, "F");
    doc.setTextColor(...INK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(state.clientName || "Client not specified", 18, y + 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(...MUTED);
    doc.text(state.siteName || "Site not specified", 18, y + 22);
    doc.setFontSize(9);
    doc.text(`Survey date: ${state.surveyDate || "—"}   •   By: ${state.surveyBy || "—"}`, 18, y + 30);
    y += 46;

    const ctx = { doc, state, logo, pageW, pageH, y };
    buildFromSchema(ctx);

    const total = doc.getNumberOfPages();
    for (let i = 1; i <= total; i += 1) {
      doc.setPage(i);
      addFooter(doc, pageW, pageH, i, total);
    }

    const safeClient = (state.clientName || "survey").replace(/[^\w\-]+/g, "_").slice(0, 40);
    const safeSite = (state.siteName || "site").replace(/[^\w\-]+/g, "_").slice(0, 40);
    const filename = `HygieneTech_SiteSurvey_${safeClient}_${safeSite}.pdf`;
    const blob = doc.output("blob");

    return { doc, blob, filename };
  }

  function download(doc, filename) {
    // jsPDF's save() is the most reliable download path on mobile + desktop
    doc.save(filename);
  }

  window.HT_PDF = { generate, download };
})();
