// Lyffin Listing Tool - PDF Template Builders & Printing
const LOGO_SRC = "/logo.png";

function computeFactoryDueDate(dueDate, bufferDays) {
  if (!dueDate) return "";
  const bd = Math.max(0, +bufferDays || 0);
  const d = new Date(dueDate + "T00:00:00");
  if (isNaN(d.getTime())) return "";
  d.setDate(d.getDate() - bd);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const dd = String(d.getDate()).padStart(2, "0");
  return `${dd}-${months[d.getMonth()]}-${d.getFullYear()}`;
}

function printViaHiddenIframe(html) {
  const old = document.getElementById("pdf-print-frame");
  if (old) old.remove();
  const iframe = document.createElement("iframe");
  iframe.id = "pdf-print-frame";
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();
  iframe.onload = () => {
    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (e) {
        alert("Could not open print dialog automatically. Please check your browser's print / popup settings.");
        console.error(e);
      }
    }, 400);
  };
}

function buildPDF(branded = true) {
  const { clientName, quoteNo, projectName, date, dueDate, preparedBy, revision } = project;
  const SUMMARY_ROWS_PER_PAGE = 24;

  function fmtDate(d) {
    if (!d) return "";
    const [y, m, mo] = d.split("-");
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${mo}-${months[parseInt(m, 10) - 1]}-${y}`;
  }

  const dueDateFmt = branded ? fmtDate(dueDate) : computeFactoryDueDate(dueDate, project.bufferDays);
  const dateFmt = fmtDate(date);
  const areas = [...new Set(products.map(p => p.area).filter(Boolean))];
  const tot = totalPieces();

  const coverLogoHtml = branded ? `<img src="${LOGO_SRC}" class="cover-logo" alt="Lyffin"/>` : "";
  const coverLogoStyle = branded ? "" : "margin-top:80px;";
  const summaryLogoHtml = branded ? `<img src="${LOGO_SRC}" class="pdf-logo" alt="Lyffin"/>` : "";
  const drawingContactHtml = branded ? `<div class="ph-contact">www.lyffin.com | hello@lyffin.com | 8590 777 808</div>` : "";
  const drawingLogoHtml = branded ? `<img src="${LOGO_SRC}" class="pdf-logo" alt="Lyffin"/>` : "";

  const productPages = products.map((p, idx) => {
    const qty = parseInt(p.qty) || 1;
    const displayImg = p.annotatedImage || p.productImage;
    const finishes = (p.finishes || []).filter(Boolean);
    const upholstery = (p.upholstery || []).filter(Boolean);
    const swatches = (p.swatchImages || []).map((s, si) => ({ img: s, label: upholstery[si] || "" })).filter(s => s.img);

    const finishRows = finishes.length
      ? finishes.map((f, i) => `<div class="spec-row"><span class="spec-key">Finish ${i + 1}</span><span class="spec-val">${f}</span></div>`).join("")
      : `<div class="spec-row"><span class="spec-key">Finish 1</span><span class="spec-val grey">Need to be selected</span></div>`;

    const uphRows = upholstery.length
      ? upholstery.map((u, i) => `<div class="spec-row"><span class="spec-key">Upholstery ${i + 1}</span><span class="spec-val">${u}</span></div>`).join("")
      : `<div class="spec-row"><span class="spec-key">Upholstery</span><span class="spec-val grey">To be selected</span></div>`;

    const swatchHtml = swatches.length
      ? swatches.map(s => `<div class="swatch-item"><img src="${s.img}" style="width:100%;max-width:185px;height:auto;max-height:165px;min-width:0;min-height:0;object-fit:contain;display:block;"/>${s.label ? `<div class="swatch-lbl">${s.label}</div>` : ""}</div>`).join("")
      : "";

    const drawingPages = (p.drawings || []).map((d, di) => `
<div class="pg">
  <div class="ph">
    ${drawingLogoHtml}
    <div class="ph-mid"><div class="ph-title">Factory Drawing</div>${drawingContactHtml}</div>
    <div class="ph-right">SBQ-No : ${idx + 1} · Drawing ${di + 1}</div>
  </div>
  <div class="meta-bar">
    <div class="meta-l"><div class="meta-date">Date : ${date || ""}</div><div class="meta-client">${clientName}</div><div class="meta-pno">Product No-${esc(p.productNo) || (idx + 1)} — ${esc(p.name)}</div></div>
    <div class="meta-r"><div class="meta-place">Placement: ${esc(p.area) || "—"}</div></div>
  </div>
  <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:4mm 0;">
    <img src="${d.img}" style="max-width:100%;max-height:220mm;min-width:0;min-height:0;object-fit:contain;"/>
    ${d.caption ? `<div style="text-align:center;font-size:9px;color:#555;margin-top:6px;">${d.caption}</div>` : ""}
  </div>
  <div class="pf"><span>All dimensions are in centimeters.</span><span>Factory Drawing — ${esc(p.name)}</span></div>
</div>`).join("");

    const logoHtml = branded ? `<img src="${LOGO_SRC}" class="pdf-logo" alt="Lyffin"/>` : "";
    const contactHtml = branded ? `<div class="ph-contact">www.lyffin.com | hello@lyffin.com | 8590 777 808</div><div class="ph-contact">Subhash Chandra Bose Rd, Jawahar Nagar, Kadavanthra, Kochi, Ernakulam, Kerala 682020</div>` : "";

    return `
<div class="pg">
  <div class="ph">
    ${logoHtml}
    <div class="ph-mid">
      <div class="ph-title">Factory Listing</div>
      ${contactHtml}
    </div>
    <div class="ph-right">SBQ-No : ${idx + 1}</div>
  </div>
  <div class="meta-bar">
    <div class="meta-l">
      <div class="meta-date">Date : ${date || ""}</div>
      <div class="meta-client">${clientName}</div>
      <div class="meta-pno">Product No-${esc(p.productNo) || (idx + 1)}</div>
    </div>
    <div class="meta-r">
      <div class="meta-place">Placement: <span>${esc(p.area) || "—"}</span></div>
      <div class="meta-due">Due Date : <span>${dueDateFmt || "—"}</span></div>
      <div class="meta-qty">Quantity: <span>${qty}</span></div>
    </div>
  </div>
  <div class="img-box">
    ${displayImg ? `<img src="${displayImg}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:block;"/>` : `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#bbb;font-size:11px;text-align:center;">${p.imagePath || "No image uploaded"}</div>`}
  </div>
  <div class="specs">
    <div class="specs-title">Dimensions &amp; Technical Specifications</div>
    <div class="specs-grid">
      <div class="specs-left-col">
        <div class="spec-name">${esc(p.name)}</div>
        <div class="spec-dim">${escNL(p.dimensions)}${p.details ? `<br/><span style="font-size:11px;color:#888;font-style:italic;">${escNL(p.details)}</span>` : ""}</div>
        ${p.material ? `<div class="spec-row" style="margin-top:4px;"><span class="spec-key">Material</span><span class="spec-val">${esc(p.material)}</span></div>` : ""}
      </div>
      <div class="specs-mid-col">
        <div class="spec-section-label">Finish</div>
        ${finishRows}
        <div class="spec-section-label">Upholstery</div>
        ${uphRows}
      </div>
      <div class="specs-right-col">
        ${swatchHtml}
      </div>
    </div>
  </div>
  <div class="pf"><span>All dimensions are in centimeters.</span><span>Page ${idx + 2}</span></div>
</div>
${drawingPages}`;
  }).join("");

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<title>Lyffin X ${clientName}_Factory Listing_Rev${revision || "1"}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Helvetica Neue',Arial,sans-serif;color:#111;background:#fff;}
.pg{width:210mm;min-height:297mm;max-height:297mm;padding:6mm 8mm;position:relative;page-break-after:always;display:flex;flex-direction:column;overflow:hidden;border-bottom:1px solid #f0f0f0;}
.pg:last-child{page-break-after:auto;}
.cover{align-items:center;justify-content:center;text-align:center;}
.cover-logo{height:120px;width:auto;margin-bottom:24px;}
.csub{font-size:32px;color:#333;letter-spacing:.15em;text-transform:uppercase;margin-bottom:48px;font-weight:300;}
.ccl{font-size:44px;margin-bottom:10px;font-weight:500;}
.cdet{font-size:15px;color:#777;margin-top:6px;}
.ph{display:flex;align-items:center;gap:14px;border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:8px;flex-shrink:0;}
.pdf-logo{height:44px;width:auto;flex-shrink:0;}
.ph-mid{flex:1;}
.ph-title{font-size:20px;font-weight:700;letter-spacing:.04em;}
.ph-contact{font-size:9px;color:#666;line-height:1.5;margin-top:2px;}
.ph-right{font-size:15px;font-weight:700;white-space:nowrap;}
.meta-bar{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1px solid #ccc;padding-bottom:5px;margin-bottom:7px;flex-shrink:0;}
.meta-date{font-size:10px;color:#666;margin-bottom:2px;}
.meta-client{font-size:18px;font-weight:600;}
.meta-pno{font-size:12px;color:#555;margin-top:1px;}
.meta-r{text-align:right;}
.meta-place{font-size:11px;color:#c0392b;font-weight:700;margin-bottom:2px;}
.meta-place span{font-weight:700;}
.meta-due{font-size:11px;margin-bottom:3px;}
.meta-due span{color:#c0392b;font-weight:700;}
.meta-qty{font-size:20px;font-weight:300;}
.meta-qty span{font-weight:700;font-size:22px;}
.img-box{flex:1;min-height:0;position:relative;overflow:hidden;margin-bottom:5px;background:#fafafa;border-radius:3px;}
.img-box img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;}
.specs{flex-shrink:0;border-top:1px solid #ccc;padding-top:7px;}
.specs-title{font-size:14px;font-weight:700;margin-bottom:7px;border-bottom:.5px solid #eee;padding-bottom:3px;}
.specs-grid{display:flex;align-items:flex-start;}
.specs-left-col{flex-shrink:0;width:50mm;padding-right:6mm;border-right:.5px solid #e2e2e2;}
.specs-mid-col{flex:1;display:flex;flex-direction:column;gap:4px;align-items:stretch;min-width:0;padding:0 6mm;border-right:.5px solid #e2e2e2;}
.specs-right-col{flex-shrink:0;width:60mm;display:flex;flex-direction:column;gap:6px;align-items:flex-start;padding-left:5mm;}
.spec-name{font-size:13px;font-weight:700;margin-bottom:3px;}
.spec-dim{font-size:12px;color:#555;margin-bottom:5px;}
.spec-section-label{font-size:10px;font-weight:700;color:#111;text-transform:uppercase;letter-spacing:.05em;margin-top:5px;margin-bottom:2px;border-bottom:.5px solid #ddd;padding-bottom:1px;display:inline-block;margin-right:6px;}
.spec-row{display:flex;align-items:baseline;gap:5px;margin-bottom:3px;}
.spec-key{font-size:11px;color:#c0392b;font-weight:700;white-space:nowrap;min-width:78px;flex-shrink:0;}
.spec-val{font-size:11px;color:#111;flex:1;}
.grey{color:#888;}
.swatch-item{display:flex;flex-direction:column;align-items:flex-start;gap:2px;width:100%;}
.swatch-lbl{font-size:9px;color:#c0392b;font-weight:700;text-align:left;word-break:break-word;line-height:1.3;width:100%;margin-top:1px;}
.pf{flex-shrink:0;margin-top:3px;padding-top:4px;border-top:.5px solid #eee;display:flex;justify-content:space-between;font-size:9px;color:#888;}
.stbl{width:100%;border-collapse:collapse;font-size:11px;margin-top:10px;}
.stbl th{background:#f5f5f5;padding:6px 8px;text-align:left;border:.5px solid #ddd;font-size:10px;text-transform:uppercase;letter-spacing:.04em;}
.stbl td{padding:6px 8px;border:.5px solid #eee;}
.srow{display:flex;gap:12px;margin:10px 0;}
.sbox{border:1px solid #ddd;border-radius:4px;padding:8px 18px;text-align:center;}
.sn{font-size:24px;font-weight:700;}
.sl{font-size:9px;color:#888;text-transform:uppercase;}
@media print{
  body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .pg{border:none;}
  @page{margin:0;size:A4;}
}
</style></head><body>

<div class="pg cover">
  ${coverLogoHtml}
  <div class="csub" style="${coverLogoStyle}">Factory Listing</div>
  <div class="ccl">${esc(clientName)}</div>
  ${quoteNo ? `<div class="cdet">Quotation: ${quoteNo}</div>` : ""}
  ${projectName ? `<div class="cdet">${esc(projectName)}</div>` : ""}
  ${dueDateFmt ? `<div class="cdet">Due: ${dueDateFmt}</div>` : ""}
  <div class="cdet" style="margin-top:20px;">Revision ${revision || "1"}</div>
  ${preparedBy ? `<div class="cdet" style="color:#bbb;">Prepared by ${preparedBy}</div>` : ""}
</div>

${productPages}

<div class="pg">
  <div class="ph">
    ${summaryLogoHtml}
    <div class="ph-mid"><div class="ph-title">Product Summary</div></div>
    <div style="font-size:9px;color:#666;text-align:right">${dateFmt || ""} · ${quoteNo || ""} · Rev ${revision || "1"}</div>
  </div>
  <div class="srow">
    <div class="sbox"><div class="sn">${products.length}</div><div class="sl">Products</div></div>
    <div class="sbox"><div class="sn">${tot}</div><div class="sl">Total pieces</div></div>
    <div class="sbox"><div class="sn">${areas.length}</div><div class="sl">Areas</div></div>
  </div>
  ${(function() {
    const hist = project.revisionHistory || [];
    const last = hist.length ? hist[hist.length - 1] : null;
    const pts = last ? (last.points || (last.note ? [last.note] : [])) : [];
    if (!pts.length) return "";
    return `<div style="border:1px solid #e0c988;background:#fdf6e3;border-radius:4px;padding:6px 10px;font-size:10px;color:#555;margin-bottom:2px;"><b style="color:#111;">Rev ${esc(revision || "1")} — what changed:</b><ul style="margin:3px 0 0 14px;padding:0;">${pts.map(pt => `<li>${esc(pt)}</li>`).join("")}</ul></div>`;
  })()}
  <table class="stbl">
    <thead><tr><th>#</th><th>Product</th><th>Qty</th><th>Placement</th><th>Dimensions</th><th>Finish</th><th>Upholstery</th></tr></thead>
    <tbody>${products.slice(0, SUMMARY_ROWS_PER_PAGE).map((p, i) => `<tr><td style="color:#999">${esc(p.productNo) || (i + 1)}</td><td><b>${esc(p.name)}</b></td><td style="text-align:center;font-weight:600">${esc(p.qty)}</td><td style="color:#c0392b">${esc(p.area) || "—"}</td><td style="color:#555">${escNL(p.dimensions)}${p.details ? `<br/><span style="font-size:10px;color:#888;font-style:italic;">${escNL(p.details)}</span>` : ""}</td><td>${(p.finishes || []).filter(Boolean).map(esc).join(", ") || "—"}</td><td>${(p.upholstery || []).filter(Boolean).map(esc).join(", ") || "To be selected"}</td></tr>`).join("")}</tbody>
  </table>
  <div class="pf"><span>Lyffin — ${esc(clientName)}</span><span>Page 1 of ${Math.ceil(products.length / SUMMARY_ROWS_PER_PAGE)}</span></div>
</div>

${products.length > SUMMARY_ROWS_PER_PAGE ? Array.from({ length: Math.ceil((products.length - SUMMARY_ROWS_PER_PAGE) / SUMMARY_ROWS_PER_PAGE) }, (_, ci) => {
  const pageNum = ci + 2;
  const start = SUMMARY_ROWS_PER_PAGE + ci * SUMMARY_ROWS_PER_PAGE;
  const chunk = products.slice(start, start + SUMMARY_ROWS_PER_PAGE);
  return `<div class="pg">
  <div class="ph">
    ${summaryLogoHtml}
    <div class="ph-mid"><div class="ph-title">Product Summary <span style="font-weight:400;color:#999;">(continued)</span></div></div>
    <div style="font-size:9px;color:#666;text-align:right">${dateFmt || ""} · ${quoteNo || ""} · Rev ${revision || "1"}</div>
  </div>
  <table class="stbl">
    <thead><tr><th>#</th><th>Product</th><th>Qty</th><th>Placement</th><th>Dimensions</th><th>Finish</th><th>Upholstery</th></tr></thead>
    <tbody>${chunk.map((p, i) => `<tr><td style="color:#999">${esc(p.productNo) || (start + i + 1)}</td><td><b>${esc(p.name)}</b></td><td style="text-align:center;font-weight:600">${esc(p.qty)}</td><td style="color:#c0392b">${esc(p.area) || "—"}</td><td style="color:#555">${escNL(p.dimensions)}${p.details ? `<br/><span style="font-size:10px;color:#888;font-style:italic;">${escNL(p.details)}</span>` : ""}</td><td>${(p.finishes || []).filter(Boolean).map(esc).join(", ") || "—"}</td><td>${(p.upholstery || []).filter(Boolean).map(esc).join(", ") || "To be selected"}</td></tr>`).join("")}</tbody>
  </table>
  <div class="pf"><span>Lyffin — ${esc(clientName)}</span><span>Page ${pageNum} of ${Math.ceil(products.length / SUMMARY_ROWS_PER_PAGE)}</span></div>
</div>`;
}).join("") : ""}
</body></html>`;
}

function generatePDF(branded = true) {
  try {
    const safeName = (project.clientName || "Client").replace(/[^a-zA-Z0-9 ]/g, "").trim().replace(/\s+/g, "_");
    const rev = (project.revision || "1").replace(/[^a-zA-Z0-9]/g, "");
    const suffix = branded ? "" : "_FC";
    const filename = `Lyffin X ${safeName}_Factory List_Rev${rev}${suffix}.pdf`;
    const html = buildPDF(branded);

    const w = window.open("", "_blank");
    if (w && !w.closed) {
      w.document.write(html);
      w.document.close();
      w.document.title = filename.replace(".pdf", "");
      setTimeout(() => { try { w.print(); } catch (e) { console.log(e); } }, 800);
      return;
    }
    printViaHiddenIframe(html);
  } catch (err) {
    alert("PDF error: " + err.message);
    console.error(err);
  }
}

function buildDeliveryChecklistPDF() {
  const { clientName, quoteNo, projectName, clientAddress, clientPhone, date, dueDate, revision } = project;
  const totalPcs = products.reduce((s, p) => s + (parseInt(p.qty) || 1), 0);

  const rows = [];
  products.forEach((p, idx) => {
    const qty = parseInt(p.qty) || 1;
    for (let q = 1; q <= qty; q++) {
      rows.push({
        pieceNo: qty > 1 ? `${p.productNo || idx + 1}_${q}` : `${p.productNo || idx + 1}`,
        name: p.name || "—",
        dimensions: p.dimensions || "—",
        area: p.area || "—",
        isFirst: q === 1,
        totalQty: qty,
        productIdx: idx
      });
    }
  });

  const ROWS_PER_PAGE_1 = 26;
  const ROWS_PER_PAGE = 32;
  const pages = [];
  let remaining = [...rows];
  pages.push(remaining.splice(0, ROWS_PER_PAGE_1));
  while (remaining.length > 0) pages.push(remaining.splice(0, ROWS_PER_PAGE));

  const totalPages = pages.length;

  const buildPageRows = (pageRows) => `
    <tbody>
    ${pageRows.map(r => `
      <tr>
        <td style="text-align:center;font-size:10px;color:#c0392b;font-weight:700;white-space:nowrap;">${esc(r.pieceNo)}</td>
        <td style="font-weight:${r.isFirst ? "600" : "400"};font-size:11px;">${esc(r.name)}</td>
        <td style="font-size:10px;color:#555;">${esc(r.dimensions)}</td>
        <td style="font-size:10px;color:#c0392b;font-weight:600;">${esc(r.area)}</td>
        <td style="text-align:center;"><div style="width:18px;height:18px;border:1.5px solid #333;border-radius:3px;margin:0 auto;"></div></td>
        <td style="text-align:center;"><div style="width:18px;height:18px;border:1.5px solid #333;border-radius:3px;margin:0 auto;"></div></td>
        <td style="font-size:9px;color:#aaa;border-bottom:.5px solid #eee;" colspan="1">&nbsp;</td>
      </tr>`).join("")}
    </tbody>`;

  const tableHead = `
    <thead>
      <tr style="background:#f5f5f5;">
        <th style="width:52px;text-align:center;">Piece No.</th>
        <th>Product Name</th>
        <th style="width:120px;">Dimensions</th>
        <th style="width:100px;">Placement</th>
        <th style="width:36px;text-align:center;font-size:9px;">Loaded</th>
        <th style="width:36px;text-align:center;font-size:9px;">Delivered</th>
        <th style="width:80px;font-size:9px;">Remarks</th>
      </tr>
    </thead>`;

  const pageHtml = pages.map((pageRows, pi) => {
    const pageNum = pi + 1;
    const isFirst = pi === 0;
    return `
<div class="pg">
  <div class="ph">
    <img src="${LOGO_SRC}" class="pdf-logo" alt="Lyffin"/>
    <div class="ph-mid">
      <div class="ph-title">Delivery Checklist</div>
      <div class="ph-contact">www.lyffin.com | hello@lyffin.com | 8590 777 808</div>
      <div class="ph-contact">Subhash Chandra Bose Rd, Jawahar Nagar, Kadavanthra, Kochi, Ernakulam, Kerala 682020</div>
    </div>
    <div style="font-size:9px;color:#666;text-align:right;white-space:nowrap;">${date || ""}<br/>${quoteNo || ""}<br/>Rev ${revision || "1"}</div>
  </div>

  ${isFirst ? `
  <div style="display:flex;gap:10px;margin-bottom:8px;">
    <div style="flex:1;border:.5px solid #ccc;border-radius:4px;padding:7px 10px;">
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#888;margin-bottom:4px;">Recipient</div>
      <div style="font-size:11px;font-weight:600;">${esc(clientName) || "—"}</div>
      <div style="font-size:10px;color:#555;margin-top:2px;">${esc(clientAddress || projectName || "—")}</div>
      <div style="font-size:10px;color:#555;">${clientPhone ? `Ph: ${esc(clientPhone)}` : "&nbsp;"}</div>
    </div>
    <div style="display:flex;gap:8px;">
      <div style="border:.5px solid #ccc;border-radius:4px;padding:7px 14px;text-align:center;">
        <div style="font-size:22px;font-weight:700;">${products.length}</div>
        <div style="font-size:9px;color:#888;text-transform:uppercase;">Products</div>
      </div>
      <div style="border:.5px solid #ccc;border-radius:4px;padding:7px 14px;text-align:center;">
        <div style="font-size:22px;font-weight:700;">${totalPcs}</div>
        <div style="font-size:9px;color:#888;text-transform:uppercase;">Pieces</div>
      </div>
    </div>
  </div>` : ""}

  <table style="width:100%;border-collapse:collapse;font-size:11px;">
    ${tableHead}
    ${buildPageRows(pageRows)}
  </table>

  ${isFirst ? `
  <div style="margin-top:10px;display:flex;gap:20px;border-top:1px solid #eee;padding-top:8px;">
    <div style="flex:1;font-size:10px;">
      <span style="font-weight:600;">Loaded by:</span>
      <span style="display:inline-block;min-width:120px;border-bottom:.5px solid #999;">&nbsp;</span>
      &nbsp;&nbsp;
      <span style="font-weight:600;">Date:</span>
      <span style="display:inline-block;min-width:80px;border-bottom:.5px solid #999;">&nbsp;</span>
    </div>
    <div style="flex:1;font-size:10px;">
      <span style="font-weight:600;">Received by:</span>
      <span style="display:inline-block;min-width:120px;border-bottom:.5px solid #999;">&nbsp;</span>
      &nbsp;&nbsp;
      <span style="font-weight:600;">Date:</span>
      <span style="display:inline-block;min-width:80px;border-bottom:.5px solid #999;">&nbsp;</span>
    </div>
  </div>` : ""}

  <div class="pf">
    <span>Lyffin — ${esc(clientName)}</span>
    <span style="color:#c0392b;font-weight:600;">${pageNum < totalPages ? "Continued on next page →" : ""}</span>
    <span>Page ${pageNum} of ${totalPages}</span>
  </div>
</div>`;
  }).join("");

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<title>Lyffin_Delivery_Checklist_${(clientName || "Client").replace(/[^a-zA-Z0-9]/g, "_")}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Helvetica Neue',Arial,sans-serif;background:#fff;color:#111;}
.pg{width:210mm;min-height:297mm;max-height:297mm;padding:6mm 8mm;position:relative;page-break-after:always;display:flex;flex-direction:column;overflow:hidden;}
.pg:last-child{page-break-after:auto;}
.ph{display:flex;align-items:center;gap:10px;border-bottom:1px solid #ddd;padding-bottom:6px;margin-bottom:8px;flex-shrink:0;}
.pdf-logo{height:34px;width:auto;flex-shrink:0;}
.ph-mid{flex:1;}
.ph-title{font-size:16px;font-weight:600;}
.ph-contact{font-size:8px;color:#666;line-height:1.5;}
table{width:100%;border-collapse:collapse;font-size:11px;}
thead th{background:#f5f5f5;padding:5px 6px;text-align:left;border:.5px solid #ddd;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;}
tbody tr{border-bottom:.5px solid #eee;}
tbody tr:nth-child(even){background:#fafafa;}
tbody td{padding:5px 6px;vertical-align:middle;}
.pf{margin-top:auto;padding-top:4px;border-top:.5px solid #eee;display:flex;justify-content:space-between;font-size:9px;color:#888;flex-shrink:0;}
@media print{
  body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .pg{border:none;}
  @page{margin:0;size:A4;}
}
</style>
</head><body>${pageHtml}</body></html>`;
}

function generateDeliveryChecklistPDF() {
  try {
    const html = buildDeliveryChecklistPDF();
    const w = window.open("", "_blank");
    if (w && !w.closed) {
      w.document.write(html);
      w.document.close();
      w.document.title = "Lyffin_Delivery_Checklist_" + (project.clientName || "Client").replace(/[^a-zA-Z0-9]/g, "_");
      setTimeout(() => { try { w.print(); } catch (e) {} }, 800);
      return;
    }
    printViaHiddenIframe(html);
  } catch (err) {
    alert("Checklist PDF error: " + err.message);
  }
}

function buildTagsPDF() {
  const { clientName, quoteNo, projectName, date, dueDate, preparedBy, clientAddress, clientPhone } = project;

  const cards = [];
  products.forEach((p, idx) => {
    const qty = parseInt(p.qty) || 1;
    for (let q = 1; q <= qty; q++) {
      const pieceNo = qty > 1 ? `${p.productNo || idx + 1}_${q}` : `${p.productNo || idx + 1}`;
      cards.push({
        p,
        pieceNo,
        img: p.annotatedImage || p.productImage || null
      });
    }
  });

  const cardHtml = cards.map(({ p, pieceNo, img }) => `
<div class="tag-card">
  <div class="tag-header">
    <div class="tag-title">Furniture Tagging &amp; Placement list</div>
  </div>
  <div class="tag-logo-row">
    <img src="${LOGO_SRC}" class="tag-logo" alt="Lyffin"/>
    <div class="tag-contact">
      www.lyffin.com | hello@lyffin.com | 8590 777 808<br/>
      Subhash Chandra Bose Rd, Jawahar Nagar, Kadavanthra,<br/>
      Kochi, Ernakulam, Kerala 682020
    </div>
  </div>
  <div class="tag-recipient">
    <div class="tag-rec-title">Recipient Details</div>
    <div class="tag-rec-row"><span class="tag-lbl">Name</span><span class="tag-val">: ${clientName || "—"}</span></div>
    <div class="tag-rec-row"><span class="tag-lbl">Address</span><span class="tag-val">: ${project.clientAddress || projectName || "—"}</span></div>
    <div class="tag-rec-row"><span class="tag-lbl">Ph.NO</span><span class="tag-val">: ${project.clientPhone || ""}</span></div>
  </div>
  <div class="tag-divider"></div>
  <div class="tag-placement">Placement: <span class="tag-place-val">${esc(p.area) || "—"}</span></div>
  <div class="tag-pno">Product Number : <span class="tag-pno-val">${pieceNo}</span></div>
  <div class="tag-img-box">
    ${img ? `<img src="${img}" class="tag-img"/>` : `<div class="tag-no-img"></div>`}
  </div>
  <div class="tag-spec">
    <div class="tag-spec-row"><span class="tag-spec-lbl">Product Name :</span><span class="tag-spec-val">${esc(p.name) || "—"}</span></div>
    <div class="tag-spec-row"><span class="tag-spec-lbl">Dimension &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;:</span><span class="tag-spec-val">${escNL(p.dimensions) || "—"}${p.details ? `<br/><span style="font-size:10px;color:#888;font-style:italic;">${escNL(p.details)}</span>` : ""}</span></div>
  </div>
</div>`).join("");

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<title>Lyffin_Tags_${(clientName || "Client").replace(/[^a-zA-Z0-9]/g, "_")}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Helvetica Neue',Arial,sans-serif;background:#fff;color:#111;}
.page-wrap{display:flex;flex-wrap:wrap;width:210mm;}
.tag-card{
  width:105mm;
  height:148.5mm;
  padding:3mm 4mm;
  border:0.5px solid #ccc;
  display:flex;
  flex-direction:column;
  page-break-inside:avoid;
  overflow:hidden;
}
.tag-header{text-align:center;margin-bottom:2mm;}
.tag-title{font-size:8px;font-weight:700;color:#111;letter-spacing:.02em;}
.tag-logo-row{display:flex;flex-direction:column;align-items:flex-start;gap:1.5mm;margin-bottom:2mm;}
.tag-logo{height:28px;width:auto;}
.tag-contact{font-size:5.5px;color:#333;line-height:1.4;}
.tag-recipient{border:.5px solid #aaa;padding:2mm;margin-bottom:2mm;}
.tag-rec-title{font-size:6.5px;font-weight:700;margin-bottom:1mm;text-decoration:underline;}
.tag-rec-row{display:flex;font-size:6.5px;margin-bottom:.8mm;}
.tag-lbl{min-width:14mm;font-weight:500;}
.tag-val{flex:1;}
.tag-divider{border-top:1px solid #111;margin:2mm 0;}
.tag-placement{font-size:7.5px;font-weight:700;color:#c0392b;margin-bottom:.8mm;}
.tag-pno{font-size:7px;margin-bottom:1.5mm;}
.tag-pno-val{font-weight:700;}
.tag-img-box{flex:1;display:flex;align-items:center;justify-content:center;border:.5px solid #eee;background:#fafafa;margin-bottom:1.5mm;min-height:35mm;overflow:hidden;}
.tag-img{max-width:100%;max-height:100%;min-width:0;min-height:0;object-fit:contain;}
.tag-no-img{width:100%;height:35mm;}
.tag-spec{border-top:.5px solid #ccc;padding-top:2mm;}
.tag-spec-row{display:flex;align-items:baseline;font-size:7px;margin-bottom:.8mm;}
.tag-spec-lbl{min-width:22mm;color:#c0392b;font-weight:700;white-space:nowrap;}
.tag-spec-val{flex:1;font-weight:500;}
@media print{
  body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  @page{margin:0;size:A4;}
  .page-wrap{width:210mm;}
}
</style>
</head>
<body>
<div class="page-wrap">
${cardHtml}
</div>
</body></html>`;
}

function generateTagsPDF() {
  try {
    const html = buildTagsPDF();
    const w = window.open("", "_blank");
    if (w && !w.closed) {
      w.document.write(html);
      w.document.close();
      w.document.title = "Lyffin_Tags_" + (project.clientName || "Client").replace(/[^a-zA-Z0-9]/g, "_");
      setTimeout(() => { try { w.print(); } catch (e) {} }, 800);
      return;
    }
    printViaHiddenIframe(html);
  } catch (err) {
    alert("Tags PDF error: " + err.message);
  }
}

function buildReturnPickupPDF(items) {
  const { clientName, quoteNo, projectName, clientAddress, clientPhone, date, revision } = project;

  const ROWS_PER_PAGE_1 = 9;
  const ROWS_PER_PAGE = 12;
  const pages = [];
  let remaining = [...items];
  pages.push(remaining.splice(0, ROWS_PER_PAGE_1));
  while (remaining.length > 0) pages.push(remaining.splice(0, ROWS_PER_PAGE));
  const totalPages = pages.length;

  const buildRows = (pageItems, startIdx) => pageItems.map((it, i) => {
    const img = it.product.annotatedImage || it.product.productImage || null;
    return `
    <tr>
      <td style="text-align:center;font-size:10px;color:#888;vertical-align:middle;">${startIdx + i + 1}</td>
      <td style="vertical-align:middle;padding:4px 6px;">
        ${img ? `<img src="${img}" style="width:42px;height:42px;object-fit:cover;border-radius:4px;border:.5px solid #ddd;display:block;"/>` : `<div style="width:42px;height:42px;border:.5px dashed #ccc;border-radius:4px;"></div>`}
      </td>
      <td style="font-size:11px;vertical-align:middle;">
        <div style="font-weight:600;">${esc(it.product.name || "—")}</div>
        <div style="font-size:9.5px;color:#888;margin-top:1px;">No. ${esc(it.product.productNo || "—")} &nbsp;·&nbsp; ${esc(it.product.dimensions || "—")}</div>
        ${it.product.details ? `<div style="font-size:9px;color:#888;font-style:italic;margin-top:1px;">${escNL(it.product.details)}</div>` : ""}
      </td>
      <td style="font-size:10px;color:#555;vertical-align:middle;">${esc(it.product.area || "—")}</td>
      <td style="font-size:10px;color:#555;vertical-align:middle;">${esc(it.reason || "—")}</td>
      <td style="text-align:center;font-size:10px;font-weight:700;color:${it.action === "Repair" ? "#b45309" : "#c0392b"};vertical-align:middle;">${esc(it.action)}</td>
      <td style="text-align:center;vertical-align:middle;"><div style="width:18px;height:18px;border:1.5px solid #333;border-radius:3px;margin:0 auto;"></div></td>
    </tr>`;
  }).join("");

  const tableHead = `
    <thead>
      <tr>
        <th style="width:26px;text-align:center;">#</th>
        <th style="width:50px;">Photo</th>
        <th>Product</th>
        <th style="width:80px;">Placement</th>
        <th style="width:120px;">Reason for Return</th>
        <th style="width:64px;text-align:center;">Action</th>
        <th style="width:52px;text-align:center;font-size:9px;">Picked Up</th>
      </tr>
    </thead>`;

  let rowsSoFar = 0;
  const pageHtml = pages.map((pageItems, pi) => {
    const pageNum = pi + 1;
    const isFirst = pi === 0;
    const html = `
<div class="pg">
  <div class="ph">
    <img src="${LOGO_SRC}" class="pdf-logo" alt="Lyffin"/>
    <div class="ph-mid">
      <div class="ph-title">Return Pickup &amp; Replacement/Repair List</div>
      <div class="ph-contact">www.lyffin.com | hello@lyffin.com | 8590 777 808</div>
      <div class="ph-contact">Subhash Chandra Bose Rd, Jawahar Nagar, Kadavanthra, Kochi, Ernakulam, Kerala 682020</div>
    </div>
    <div style="font-size:9px;color:#666;text-align:right;white-space:nowrap;">${date || ""}<br/>${quoteNo || ""}<br/>Rev ${revision || "1"}</div>
  </div>

  ${isFirst ? `
  <div style="display:flex;gap:10px;margin-bottom:8px;">
    <div style="flex:1;border:.5px solid #ccc;border-radius:4px;padding:7px 10px;">
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#888;margin-bottom:4px;">Site / Client</div>
      <div style="font-size:11px;font-weight:600;">${esc(clientName) || "—"}</div>
      <div style="font-size:10px;color:#555;margin-top:2px;">${esc(clientAddress || projectName || "—")}</div>
      <div style="font-size:10px;color:#555;">${clientPhone ? `Ph: ${esc(clientPhone)}` : "&nbsp;"}</div>
    </div>
    <div style="border:.5px solid #ccc;border-radius:4px;padding:7px 14px;text-align:center;">
      <div style="font-size:22px;font-weight:700;">${items.length}</div>
      <div style="font-size:9px;color:#888;text-transform:uppercase;">Items</div>
    </div>
  </div>` : ""}

  <table style="width:100%;border-collapse:collapse;font-size:11px;">
    ${tableHead}
    <tbody>${buildRows(pageItems, rowsSoFar)}</tbody>
  </table>

  ${isFirst ? `
  <div style="margin-top:10px;display:flex;gap:20px;border-top:1px solid #eee;padding-top:8px;">
    <div style="flex:1;font-size:10px;">
      <span style="font-weight:600;">Picked up by:</span>
      <span style="display:inline-block;min-width:120px;border-bottom:.5px solid #999;">&nbsp;</span>
      &nbsp;&nbsp;
      <span style="font-weight:600;">Date:</span>
      <span style="display:inline-block;min-width:80px;border-bottom:.5px solid #999;">&nbsp;</span>
    </div>
    <div style="flex:1;font-size:10px;">
      <span style="font-weight:600;">Client / site confirmation:</span>
      <span style="display:inline-block;min-width:120px;border-bottom:.5px solid #999;">&nbsp;</span>
    </div>
  </div>` : ""}

  <div class="pf">
    <span>Lyffin — ${esc(clientName)}</span>
    <span style="color:#c0392b;font-weight:600;">${pageNum < totalPages ? "Continued on next page →" : ""}</span>
    <span>Page ${pageNum} of ${totalPages}</span>
  </div>
</div>`;
    rowsSoFar += pageItems.length;
    return html;
  }).join("");

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<title>Lyffin_Return_Pickup_${(clientName || "Client").replace(/[^a-zA-Z0-9]/g, "_")}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Helvetica Neue',Arial,sans-serif;background:#fff;color:#111;}
.pg{width:210mm;min-height:297mm;max-height:297mm;padding:6mm 8mm;position:relative;page-break-after:always;display:flex;flex-direction:column;overflow:hidden;}
.pg:last-child{page-break-after:auto;}
.ph{display:flex;align-items:center;gap:10px;border-bottom:1px solid #ddd;padding-bottom:6px;margin-bottom:8px;flex-shrink:0;}
.pdf-logo{height:34px;width:auto;flex-shrink:0;}
.ph-mid{flex:1;}
.ph-title{font-size:16px;font-weight:600;}
.ph-contact{font-size:8px;color:#666;line-height:1.5;}
table{width:100%;border-collapse:collapse;font-size:11px;}
thead th{background:#f5f5f5;padding:5px 6px;text-align:left;border:.5px solid #ddd;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;}
tbody tr{border-bottom:.5px solid #eee;}
tbody tr:nth-child(even){background:#fafafa;}
tbody td{padding:5px 6px;vertical-align:middle;}
.pf{margin-top:auto;padding-top:4px;border-top:.5px solid #eee;display:flex;justify-content:space-between;font-size:9px;color:#888;flex-shrink:0;}
@media print{
  body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .pg{border:none;}
  @page{margin:0;size:A4;}
}
</style>
</head><body>${pageHtml}</body></html>`;
}
