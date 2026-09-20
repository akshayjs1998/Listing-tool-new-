// Lyffin Listing Tool - Views & UI Controller
let annotCanvas = null, annotCtx = null, annotDrawing = false;
let annotTool = "arrow", annotColor = "#e74c3c", annotStartX = 0, annotStartY = 0, annotSnapshot = null;
let annotThickness = 4, annotFontSize = 24;
let annotUndoStack = [];
const ANNOT_UNDO_MAX = 8;

let quoteRows = null;
let quoteFileName = null;
let quoteFileType = null;

const IS_TOUCH_DEVICE = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

function pushAnnotUndo() {
  if (!annotCtx || !annotCanvas) return;
  annotUndoStack.push(annotCtx.getImageData(0, 0, annotCanvas.width, annotCanvas.height));
  if (annotUndoStack.length > ANNOT_UNDO_MAX) annotUndoStack.shift();
}

function undoAnnotationStep() {
  if (!annotCtx || !annotUndoStack.length) { showToast("Nothing to undo"); return; }
  const prev = annotUndoStack.pop();
  annotCtx.putImageData(prev, 0, 0);
}

function render() {
  renderSteps();
  if (step === 0) renderProject();
  else if (step === 1) renderProducts();
  else if (step === 2) renderVerify();
  else renderExport();
}

function renderSteps() {
  const names = ["Project info", "Products", "Verify", "Export"];
  const main = document.getElementById("main");
  if (!main) return;
  main.innerHTML = `
<div class="steps" id="steps">
  ${names.map((s, i) => `<div class="step${i === step ? " active" : i < step ? " done" : ""}" onclick="goStep(${i})"><span class="step-n">${i < step ? "✓" : i + 1}</span>${s}</div>`).join("")}
</div>
<div id="page-content"></div>`;
}

function goStep(n) {
  if (n > 0 && !project.clientName) {
    alert("Please enter a client name before proceeding.");
    return;
  }
  step = n;
  renderSteps();
  const c = document.getElementById("page-content");
  if (!c) return;
  if (n === 0) renderProjectInto(c);
  else if (n === 1) renderProductsInto(c);
  else if (n === 2) renderVerifyInto(c);
  else {
    renderExportInto(c);
    setTimeout(initOpsFirebase, 100);
  }
}

function renderHome() {
  const projects = Object.values(allProjects).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  const main = document.getElementById("main");
  if (!main) return;
  main.innerHTML = `
<div class="panel">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;flex-wrap:wrap;gap:8px;">
    <div class="panel-title" style="margin-bottom:0;font-size:16px;">Projects</div>
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
      <a href="presentation.html" class="btn sm" style="text-decoration:none;" title="Client presentation drawing generator">
        🎨 Presentation Drawing
      </a>
      <label class="btn sm" style="cursor:pointer;margin:0;" title="Import a .lyffin project file">
        📥 Import project
        <input type="file" accept=".lyffin,.json" style="display:none;" onchange="if(this.files[0])importProject(this.files[0])"/>
      </label>
      <div style="font-size:11px;color:var(--text2);" id="storage-info">Storage: IndexedDB (Persistent)</div>
    </div>
  </div>
  
  <div class="proj-list">
    <div class="proj-card new-proj-card" onclick="newProject()">
      <span style="font-size:22px;margin-right:8px;">+</span> New project
    </div>
    ${projects.length === 0 ? `<div style="text-align:center;padding:2.5rem;color:var(--text2);font-size:13px;">No saved projects yet.<br>Create your first one above.</div>` : ""}
    ${projects.map(p => `
    <div class="proj-card" onclick="openProject('${p.id}')">
      <div>
        <div class="proj-card-name">${esc(p.name || "Untitled")}</div>
        <div class="proj-card-meta">${p.meta ? esc(p.meta) + " · " : ""}</div>
        <div class="proj-card-meta" style="margin-top:2px;font-size:11px;color:var(--text3);">
          ${p.products ? p.products.length + " products · " : ""}
          ${(p.project && p.project.revision) ? "Rev " + p.project.revision + " · " : ""}
          ${p.updatedAt ? "Last saved " + new Date(p.updatedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : ""}
        </div>
      </div>
      <div class="proj-card-actions" onclick="event.stopPropagation()">
        <button class="btn sm primary" onclick="openProject('${p.id}')">Open</button>
        <button class="btn sm" onclick="exportProject('${p.id}')" title="Export as .lyffin file">📤 Export</button>
        <button class="btn sm danger" onclick="deleteProject('${p.id}')">Delete</button>
      </div>
    </div>`).join("")}
  </div>
</div>`;
}

function openProject(id) {
  const p = allProjects[id];
  if (!p) return;
  currentProjectId = id;
  project = {
    clientName: "", quoteNo: "", projectName: "",
    date: new Date().toISOString().split("T")[0],
    dueDate: "", preparedBy: "", revision: "1",
    clientAddress: "", clientPhone: "",
    revisionHistory: [], bufferDays: 5,
    ...(p.project || {})
  };
  products = p.products || [];
  usedAreas = p.usedAreas || [];
  selectedId = null;
  step = 0;
  document.getElementById("save-btn").style.display = "inline-flex";
  document.getElementById("close-btn").style.display = "inline-flex";
  render();
}

function newProject() {
  currentProjectId = "proj_" + Date.now();
  project = {
    clientName: "", quoteNo: "", projectName: "",
    date: new Date().toISOString().split("T")[0],
    dueDate: "", preparedBy: "", revision: "1",
    clientAddress: "", clientPhone: "",
    revisionHistory: [], bufferDays: 5
  };
  products = [blank()];
  usedAreas = [];
  selectedId = null;
  step = 0;
  document.getElementById("save-btn").style.display = "inline-flex";
  document.getElementById("close-btn").style.display = "inline-flex";
  render();
}

async function deleteProject(id) {
  if (!confirm("Delete this project permanently?")) return;
  delete allProjects[id];
  await dbDelete(id);
  renderHome();
}

function exportProject(id) {
  const p = allProjects[id];
  if (!p) { alert("Project not found."); return; }
  const payload = JSON.stringify({ _lyffinExport: true, version: 1, exportedAt: new Date().toISOString(), project: p });
  const safeName = (p.name || "Untitled").replace(/[^a-zA-Z0-9 \-_]/g, "").trim().replace(/\s+/g, "_") || "project";
  const filename = `Lyffin_${safeName}.lyffin`;
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function importProject(file) {
  try {
    const text = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = e => res(e.target.result);
      r.onerror = rej;
      r.readAsText(file);
    });
    const data = JSON.parse(text);
    if (!data._lyffinExport || !data.project) {
      alert("This does not look like a valid Lyffin project file.");
      return;
    }
    const p = data.project;
    const newId = "proj_" + Date.now();
    p.id = newId;
    const existingNames = Object.values(allProjects).map(x => x.name || "");
    if (existingNames.includes(p.name || "")) {
      p.name = (p.name || "Untitled") + " (imported)";
    }
    allProjects[newId] = p;
    await dbPut(p);
    renderHome();
    if (confirm(`"${p.name || "Untitled"}" imported successfully.\n\nOpen it now?`)) {
      openProject(newId);
    }
  } catch (e) {
    alert("Could not import project: " + (e.message || "unknown error"));
    console.error(e);
  }
}

async function closeProject() {
  await saveCurrentProject();
  currentProjectId = null;
  document.getElementById("save-btn").style.display = "none";
  document.getElementById("close-btn").style.display = "none";
  renderHome();
}

function updateRevisionNumber(val) {
  project.revision = val;
  autosaveProject();
}

function saveRevisionEntry() {
  const ta = document.getElementById('rev-note-input');
  if (!ta) return;
  const rawLines = (ta.value || '').split('\n').map(s => s.trim()).filter(Boolean);
  if (!rawLines.length) {
    showToast('Add at least one point describing what changed');
    return;
  }
  if (!project.revisionHistory) project.revisionHistory = [];
  project.revisionHistory.push({ rev: project.revision || '1', points: rawLines, at: new Date().toISOString() });
  ta.value = '';
  autosaveProject();
  renderProject();
  showToast('Revision entry saved');
}

function revisionEntryPoints(entry) {
  if (entry.points && entry.points.length) return entry.points;
  if (entry.note) return [entry.note];
  return [];
}

function renderProject() {
  const c = document.getElementById("page-content");
  if (c) renderProjectInto(c);
}

function renderProjectInto(c) {
  c.innerHTML = `
<div class="panel">
  <div class="panel-title">Project details</div>
  <div class="g2">
    <div class="field"><label>Client name</label><input type="text" value="${esc(project.clientName)}" placeholder="Mr. Sadik Elangode" oninput="project.clientName=this.value;autosaveProject();"/></div>
    <div class="field"><label>Quotation no.</label><input type="text" value="${esc(project.quoteNo)}" placeholder="SBQ-001" oninput="project.quoteNo=this.value;autosaveProject();"/></div>
    <div class="field"><label>Client address</label><input type="text" value="${esc(project.clientAddress || '')}" placeholder="Karaparamba, Kozhikode" oninput="project.clientAddress=this.value;autosaveProject();"/></div>
    <div class="field"><label>Client phone</label><input type="text" value="${esc(project.clientPhone || '')}" placeholder="+91 98765 43210" oninput="project.clientPhone=this.value;autosaveProject();"/></div>
    <div class="field"><label>Project / site</label><input type="text" value="${esc(project.projectName)}" placeholder="Panoor Residence" oninput="project.projectName=this.value;autosaveProject();"/></div>
    <div class="field"><label>Prepared by</label><input type="text" value="${esc(project.preparedBy)}" placeholder="Akshay" oninput="project.preparedBy=this.value;autosaveProject();"/></div>
    <div class="field"><label>Date</label><input type="date" value="${project.date}" oninput="project.date=this.value;autosaveProject();"/></div>
    <div class="field"><label>Due date</label><input type="date" value="${project.dueDate}" oninput="project.dueDate=this.value;autosaveProject();renderProject();"/></div>
    <div class="field"><label>Factory copy buffer (days)</label><input type="number" min="0" max="60" value="${project.bufferDays != null ? project.bufferDays : 5}" oninput="project.bufferDays=Math.max(0,+this.value||0);autosaveProject();renderProject();"/>
      <div style="font-size:11px;color:var(--text2);margin-top:4px">${(function() { const f = computeFactoryDueDate(project.dueDate, project.bufferDays); return f ? `Factory copy will show: ${f}` : 'Set a due date above to preview factory date'; })()}</div>
    </div>
  </div>
  <div style="margin-top:12px;">
    <div style="max-width:120px;">
      <div class="field"><label>Revision no.</label><input type="text" id="rev-input" value="${esc(project.revision || '1')}" placeholder="1" oninput="updateRevisionNumber(this.value);"/></div>
    </div>
    <div style="max-width:420px;margin-top:10px;">
      <div class="field">
        <label>Add revision entry <span style="font-size:10px;color:var(--text2);font-weight:400">(one point per line — what changed)</span></label>
        <textarea id="rev-note-input" rows="3" placeholder="e.g.&#10;Updated fabric for bedroom wardrobe&#10;Changed dining table dimensions to 180x90cm" style="width:100%;padding:8px 10px;border:1px solid var(--border2);border-radius:var(--radius);font-size:13px;font-family:inherit;resize:vertical;box-sizing:border-box;"></textarea>
      </div>
      <button class="btn" onclick="saveRevisionEntry()" style="margin-top:6px;">Save revision entry</button>
      ${(project.revisionHistory && project.revisionHistory.length) ? `
      <div style="margin-top:14px;">
        <div style="font-size:10px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Revision history</div>
        ${project.revisionHistory.slice().reverse().map(r => `
        <div style="font-size:11px;color:var(--text2);padding:7px 0;border-bottom:.5px solid var(--border2)">
          <div><span style="color:var(--text);font-weight:600">Rev ${esc(r.rev)}</span><span style="color:var(--text2);margin-left:6px">${new Date(r.at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span></div>
          <ul style="margin:4px 0 0 16px;padding:0;">${revisionEntryPoints(r).map(pt => `<li style="margin-bottom:2px;">${esc(pt)}</li>`).join('') || '<li style="color:var(--text2);font-style:italic;">No note recorded</li>'}</ul>
        </div>`).join('')}
      </div>` : ''}
    </div>
  </div>
</div>
<div class="btn-row">
  <button class="btn" onclick="closeProject()">← Back to projects</button>
  <button class="btn primary" onclick="if(project.clientName){saveCurrentProject();goStep(1);}else alert('Enter client name first.')">Continue →</button>
</div>`;
}

function addProduct() {
  const np = blank();
  const last = products[products.length - 1];
  if (last) {
    np.productNo = String((parseInt(last.productNo) || 0) + 1);
    np.area = last.area;
  }
  products.push(np);
  selectedId = np.id;
  saveCurrentProject();
  renderProducts();
}

function delProduct(id) {
  products = products.filter(p => p.id !== id);
  if (selectedId === id) selectedId = products.length ? products[0].id : null;
  saveCurrentProject();
  renderProducts();
}

function duplicateProduct(id) {
  const src = products.find(x => x.id === id);
  if (!src) return;
  const np = JSON.parse(JSON.stringify(src));
  np.id = uid();
  np.productNo = String((parseInt(src.productNo) || 0) + 1) + ' (copy)';
  const idx = products.findIndex(x => x.id === id);
  products.splice(idx + 1, 0, np);
  selectedId = np.id;
  saveCurrentProject();
  renderProducts();
  renderDetail();
  showToast('Product duplicated');
}

async function copyToProject(id) {
  const src = products.find(x => x.id === id);
  if (!src) return;
  const otherProjects = Object.values(allProjects).filter(p => p.id !== currentProjectId);
  if (!otherProjects.length) { showToast('No other projects to copy to'); return; }
  const options = otherProjects.map((p, i) => `${i + 1}. ${p.name || p.id}`).join('\n');
  const choice = prompt('Copy "' + (src.name || 'product') + '" to which project?\n\n' + options + '\n\nEnter number:');
  if (!choice) return;
  const idx = parseInt(choice) - 1;
  if (isNaN(idx) || idx < 0 || idx >= otherProjects.length) { showToast('Invalid selection'); return; }
  const target = otherProjects[idx];
  const np = JSON.parse(JSON.stringify(src));
  np.id = uid();
  const saved = allProjects[target.id];
  if (!saved) { showToast('Project not found'); return; }
  saved.products = saved.products || [];
  saved.products.push(np);
  await dbPut(saved);
  showToast('Copied to ' + (target.name || target.id));
}

function moveProductToArea(id, val) {
  if (val === '__new__') {
    const newArea = prompt('Enter new area name:');
    if (!newArea) return;
    if (!usedAreas.includes(newArea)) usedAreas.push(newArea);
    setField(id, 'area', newArea);
  } else {
    setField(id, 'area', val);
  }
  saveCurrentProject();
  renderProducts();
  renderDetail();
}

function setField(id, f, v) {
  const p = products.find(x => x.id === id);
  if (p) {
    p[f] = v;
    if (f === "area" && v && !usedAreas.includes(v)) usedAreas.push(v);
    autosaveProject();
  }
}

function setFinish(id, i, v) {
  const p = products.find(x => x.id === id);
  if (p) {
    if (!p.finishes) p.finishes = [];
    p.finishes[i] = v;
    autosaveProject();
  }
}

function setUph(id, i, v) {
  const p = products.find(x => x.id === id);
  if (p) {
    if (!p.upholstery) p.upholstery = [];
    p.upholstery[i] = v;
    autosaveProject();
  }
}

function addFinish(id) {
  const p = products.find(x => x.id === id);
  if (p) {
    p.finishes = [...(p.finishes || []), ""];
    renderDetail();
  }
  saveCurrentProject();
}

function delFinish(id, i) {
  const p = products.find(x => x.id === id);
  if (p) {
    p.finishes = (p.finishes || []).filter((_, fi) => fi !== i);
    renderDetail();
  }
  saveCurrentProject();
}

function addUph(id) {
  const p = products.find(x => x.id === id);
  if (p) {
    p.upholstery = [...(p.upholstery || []), ""];
    renderDetail();
  }
  saveCurrentProject();
}

function delUph(id, i) {
  const p = products.find(x => x.id === id);
  if (p) {
    p.upholstery = (p.upholstery || []).filter((_, ui) => ui !== i);
    renderDetail();
  }
  saveCurrentProject();
}

async function uploadProductImg(id, file) {
  const raw = await readFile(file);
  try {
    const d = await compressImage(raw, 1400, 0.85);
    const p = products.find(x => x.id === id);
    if (p) {
      p.productImage = d;
      p.annotatedImage = null;
      saveCurrentProject();
      renderDetail();
      renderTableRows();
    }
  } catch (e) {
    alert(e.message || "Could not process image.");
  }
}

function removeProductImg(id) {
  const p = products.find(x => x.id === id);
  if (p) {
    p.productImage = null;
    p.annotatedImage = null;
    saveCurrentProject();
    renderDetail();
    renderTableRows();
  }
}

async function uploadSwatch(id, slotIdx, file) {
  const raw = await readFile(file);
  try {
    const d = await compressSwatch(raw);
    const p = products.find(x => x.id === id);
    if (p) {
      if (!p.swatchImages) p.swatchImages = [null, null, null, null];
      p.swatchImages[slotIdx] = d;
      saveCurrentProject();
      renderDetail();
    }
  } catch (e) {
    alert(e.message || "Could not process swatch image.");
  }
}

function removeSwatch(id, si) {
  const p = products.find(x => x.id === id);
  if (p) {
    if (!p.swatchImages) p.swatchImages = [null, null, null, null];
    p.swatchImages[si] = null;
    saveCurrentProject();
    renderDetail();
  }
}

async function uploadDrawing(id, file) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  if (!p.drawings) p.drawings = [];
  const caption = file.name.replace(/\.[^.]+$/, "");
  if (file.type === "application/pdf") {
    try {
      if (!window.pdfjsLib) {
        await new Promise((res, rej) => {
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
          s.onload = () => {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
            res();
          };
          s.onerror = rej;
          document.head.appendChild(s);
        });
      }
      const pdf = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
      for (let n = 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n);
        const vp = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement("canvas");
        canvas.width = vp.width; canvas.height = vp.height;
        await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
        p.drawings.push({ img: canvas.toDataURL("image/png"), caption: pdf.numPages > 1 ? `${caption} — Page ${n}` : caption });
      }
    } catch (err) {
      alert("PDF error: " + err.message);
      return;
    }
  } else {
    p.drawings.push({ img: await readFile(file), caption });
  }
  saveCurrentProject();
  renderDetail();
}

function removeDrawing(id, di) {
  const p = products.find(x => x.id === id);
  if (p) {
    p.drawings = (p.drawings || []).filter((_, i) => i !== di);
    saveCurrentProject();
    renderDetail();
  }
}

function setDrawingCaption(id, di, v) {
  const p = products.find(x => x.id === id);
  if (p && p.drawings[di]) p.drawings[di].caption = v;
}

function selectAndDetail(id) {
  selectedId = id;
  renderTableRows();
  renderDetail();
  const d = document.getElementById("detail-panel");
  if (d) {
    d.classList.add("mobile-open");
    if (window.innerWidth <= 860) {
      setTimeout(() => {
        d.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 60);
    }
  }
}

function closeMobileDetail() {
  const d = document.getElementById("detail-panel");
  if (d) d.classList.remove("mobile-open");
  const l = document.getElementById("products-layout");
  if (l) l.scrollIntoView({ behavior: "smooth", block: "start" });
}

function navPrev() {
  const i = products.findIndex(x => x.id === selectedId);
  if (i > 0) {
    selectedId = products[i - 1].id;
    renderDetail();
    renderTableRows();
  }
}

function navNext() {
  saveCurrentProject();
  const i = products.findIndex(x => x.id === selectedId);
  if (i < products.length - 1) {
    selectedId = products[i + 1].id;
    renderDetail();
    renderTableRows();
  }
}

function showAreaSuggestions(id, val) {
  const box = document.getElementById("area-sug-" + id);
  if (!box) return;
  const matches = usedAreas.filter(a => a.toLowerCase().includes(val.toLowerCase()) && a !== val);
  if (!matches.length || !val) { box.style.display = "none"; return; }
  box.innerHTML = matches.map(a => `<div class="area-sug-item" onmousedown="pickArea('${id}','${esc(a)}')">${a}</div>`).join("");
  box.style.display = "block";
}

function hideAreaSuggestions(id) {
  setTimeout(() => {
    const b = document.getElementById("area-sug-" + id);
    if (b) b.style.display = "none";
  }, 150);
}

function pickArea(id, val) {
  setField(id, "area", val);
  const inp = document.getElementById("area-inp-" + id);
  if (inp) inp.value = val;
  hideAreaSuggestions(id);
  saveCurrentProject();
}

function renderProducts() {
  const c = document.getElementById("page-content");
  if (c) renderProductsInto(c);
}

function renderProductsInto(c) {
  c.innerHTML = `
<div id="products-layout">
  <div style="min-width:0;width:100%;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem;flex-wrap:wrap;gap:8px;">
      <div style="font-size:14px;font-weight:600;">${products.length} products <span style="font-size:12px;font-weight:400;color:var(--text2);">· ${totalPieces()} pieces</span></div>
      <div style="display:flex;gap:6px;">
        <button class="btn" onclick="addProduct()">+ Add</button>
        <button class="btn primary" onclick="saveCurrentProject();goStep(2);">Review →</button>
      </div>
    </div>
    <div class="scroll-hint">
      <span>👉 Swipe table sideways to view all columns</span>
      <span>Dimensions · Details · Photos · Drw · Swatch →</span>
    </div>
    <div class="tbl-wrap"><div class="table-scroll-container">
      <table class="tbl"><thead><tr>
        <th style="width:24px;"></th>
        <th style="width:44px;">#</th>
        <th style="min-width:140px;">Product name</th>
        <th style="width:46px;">Qty</th>
        <th style="min-width:120px;">Area / Placement</th>
        <th style="min-width:120px;">Dimensions</th>
        <th style="min-width:140px;">Details</th>
        <th style="width:36px;text-align:center;" title="Product Photo">📷</th>
        <th style="width:36px;text-align:center;" title="Annotation">✏</th>
        <th style="width:36px;text-align:center;" title="Technical Drawings">📐</th>
        <th style="width:36px;text-align:center;" title="Fabric / Swatches">🧵</th>
        <th style="width:24px;"></th>
      </tr></thead>
      <tbody id="prod-tbody"></tbody></table>
    </div></div>
    <div class="btn-row">
      <button class="btn" onclick="goStep(0)">← Back</button>
      <button class="btn" onclick="addProduct()">+ Add product</button>
    </div>
  </div>
  <div class="detail" id="detail-panel">
    <button id="detail-close-btn" onclick="closeMobileDetail()" style="display:none;width:100%;margin-bottom:12px;padding:8px;border:1px solid var(--border);border-radius:6px;background:var(--bg2);font-size:13px;cursor:pointer;color:var(--text2);">← Back to products table</button>
    <div style="text-align:center;padding:3rem 1rem;color:var(--text2);">
      <div style="font-size:28px;margin-bottom:8px;opacity:.4;">🖱</div>
      <div style="font-size:13px;">Click a row to edit details</div>
    </div>
  </div>
</div>`;
  renderTableRows();
  if (selectedId) renderDetail();
}

let dragSrcId = null;
function dragStart(e, id) {
  dragSrcId = id;
  e.dataTransfer.effectAllowed = "move";
  e.currentTarget.style.opacity = "0.4";
}
function dragOver(e, id) {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  document.querySelectorAll("tr[draggable]").forEach(r => r.style.borderTop = "");
  if (id !== dragSrcId) {
    const rows = [...document.querySelectorAll("tr[draggable]")];
    const targetRow = rows.find(r => r.getAttribute("ondrop") && r.getAttribute("ondrop").includes("'" + id + "'"));
    if (targetRow) targetRow.style.borderTop = "2px solid #111";
  }
}
function dragDrop(e, targetId) {
  e.preventDefault();
  if (!dragSrcId || dragSrcId === targetId) return;
  const srcIdx = products.findIndex(p => p.id === dragSrcId);
  const tgtIdx = products.findIndex(p => p.id === targetId);
  if (srcIdx < 0 || tgtIdx < 0) return;
  const moved = products.splice(srcIdx, 1)[0];
  products.splice(tgtIdx, 0, moved);
  saveCurrentProject();
  renderTableRows();
}
function dragEnd(e) {
  e.currentTarget.style.opacity = "";
  document.querySelectorAll("tr[draggable]").forEach(r => r.style.borderTop = "");
  dragSrcId = null;
}

function renderTableRows() {
  const tbody = document.getElementById("prod-tbody");
  if (!tbody) return;
  tbody.innerHTML = products.map((p, i) => `
<tr class="${selectedId === p.id ? "active-row" : ""}" 
  draggable="${IS_TOUCH_DEVICE ? "false" : "true"}"
  ondragstart="dragStart(event,'${p.id}')"
  ondragover="dragOver(event,'${p.id}')"
  ondrop="dragDrop(event,'${p.id}')"
  ondragend="dragEnd(event)"
  onclick="selectAndDetail('${p.id}')" 
  style="cursor:pointer;">
  <td style="padding:2px 4px;cursor:grab;color:var(--text3);font-size:14px;text-align:center;" onclick="event.stopPropagation()" title="Drag to reorder">⠿</td>
  <td data-label="#"><input type="text" style="width:34px;padding:3px 4px;font-size:12px;" value="${esc(p.productNo)}" onclick="event.stopPropagation()" onfocus="this.closest('tr').draggable=false" onblur="this.closest('tr').draggable=!IS_TOUCH_DEVICE" oninput="setField('${p.id}','productNo',this.value)"/></td>
  <td data-label="Product name"><input type="text" style="padding:3px 5px;font-size:12px;width:100%;min-width:130px;" value="${esc(p.name)}" placeholder="Product name" onclick="event.stopPropagation()" onfocus="this.closest('tr').draggable=false" onblur="this.closest('tr').draggable=!IS_TOUCH_DEVICE;checkDuplicateProduct('${p.id}')" oninput="setField('${p.id}','name',this.value)"/></td>
  <td data-label="Qty"><input type="number" style="width:38px;padding:3px 4px;font-size:12px;text-align:center;" min="1" value="${p.qty}" onclick="event.stopPropagation()" onfocus="this.closest('tr').draggable=false" onblur="this.closest('tr').draggable=!IS_TOUCH_DEVICE" oninput="setField('${p.id}','qty',parseInt(this.value)||1)"/></td>
  <td data-label="Area / Placement"><div class="area-wrap"><input type="text" id="area-inp-${p.id}" style="padding:3px 5px;font-size:12px;min-width:110px;" value="${esc(p.area)}" placeholder="e.g. Sitout" onclick="event.stopPropagation()" onfocus="this.closest('tr').draggable=false" oninput="setField('${p.id}','area',this.value);showAreaSuggestions('${p.id}',this.value)" onblur="hideAreaSuggestions('${p.id}');this.closest('tr').draggable=!IS_TOUCH_DEVICE"/><div id="area-sug-${p.id}" class="area-suggestions" style="display:none;"></div></div></td>
  <td data-label="Dimensions"><input type="text" style="padding:3px 5px;font-size:12px;min-width:110px;" value="${esc(p.dimensions)}" placeholder="120 x 60 cm" onclick="event.stopPropagation()" onfocus="this.closest('tr').draggable=false" onblur="this.closest('tr').draggable=!IS_TOUCH_DEVICE" oninput="setField('${p.id}','dimensions',this.value)"/></td>
  <td data-label="Details"><textarea rows="1" style="padding:3px 5px;font-size:12px;width:100%;min-width:130px;resize:vertical;font-family:inherit;line-height:1.4;min-height:24px;" placeholder="e.g. Glass top" onclick="event.stopPropagation()" onfocus="this.closest('tr').draggable=false" onblur="this.closest('tr').draggable=!IS_TOUCH_DEVICE" oninput="setField('${p.id}','details',this.value);this.style.height='auto';this.style.height=this.scrollHeight+'px'">${esc(p.details)}</textarea></td>
  <td style="text-align:center;min-width:36px;">${p.productImage ? '<span style="color:var(--success-text);font-weight:bold;">✓</span>' : '<span style="color:var(--danger-text);">✗</span>'}</td>
  <td style="text-align:center;min-width:36px;">${p.annotatedImage ? '<span style="color:var(--success-text);font-weight:bold;">✓</span>' : '<span style="color:var(--text3);">—</span>'}</td>
  <td style="text-align:center;min-width:36px;">${(p.drawings || []).length > 0 ? `<span style="color:var(--success-text);font-weight:bold;">${p.drawings.length}</span>` : '<span style="color:var(--text3);">—</span>'}</td>
  <td style="text-align:center;min-width:36px;">${(p.swatchImages || []).some(s => s) ? '<span style="color:var(--success-text);font-weight:bold;">✓</span>' : '<span style="color:var(--text3);">—</span>'}</td>
  <td style="text-align:center;"><button onclick="event.stopPropagation();delProduct('${p.id}')" style="background:none;border:none;cursor:pointer;color:var(--text2);font-size:13px;padding:3px;" title="Delete product">✕</button></td>
</tr>`).join("");
}

function initAnnotCanvas(id) {
  const p = getProd();
  if (!p || !p.productImage) return;
  annotCanvas = document.getElementById("annot-canvas-" + id);
  if (!annotCanvas) return;
  annotCtx = annotCanvas.getContext("2d");
  annotUndoStack = [];
  const img = new Image();
  img.onload = () => {
    annotCanvas.width = img.width;
    annotCanvas.height = img.height;
    annotCtx.drawImage(img, 0, 0);
    if (p.annotatedImage) {
      const ai = new Image();
      ai.onload = () => annotCtx.drawImage(ai, 0, 0);
      ai.src = p.annotatedImage;
    }
  };
  img.src = p.productImage;

  function touchToMouse(e) {
    e.preventDefault();
    const t = e.touches[0] || e.changedTouches[0];
    return { clientX: t.clientX, clientY: t.clientY, target: e.target };
  }
  annotCanvas.addEventListener("touchstart", (e) => annotMouseDown(touchToMouse(e)), { passive: false });
  annotCanvas.addEventListener("touchmove", (e) => annotMouseMove(touchToMouse(e)), { passive: false });
  annotCanvas.addEventListener("touchend", (e) => annotMouseUp(touchToMouse(e)), { passive: false });
}

function annotMouseDown(e) {
  if (!annotCanvas) return;
  if (annotTool === "text") {
    const r = annotCanvas.getBoundingClientRect();
    const sx = annotCanvas.width / r.width, sy = annotCanvas.height / r.height;
    const cx = (e.clientX - r.left) * sx;
    const cy = (e.clientY - r.top) * sy;
    const old = document.getElementById("annot-text-input");
    if (old) old.remove();

    const inp = document.createElement("input");
    inp.id = "annot-text-input";
    inp.type = "text";
    inp.placeholder = "Type label → Enter";
    inp.style.cssText = "position:fixed;z-index:99999;font-size:15px;font-weight:600;padding:5px 10px;border:2px solid " + annotColor + ";border-radius:6px;background:#fff;color:#111;outline:none;min-width:180px;box-shadow:0 4px 16px rgba(0,0,0,.35);left:" + Math.min(e.clientX, window.innerWidth - 200) + "px;top:" + Math.max(e.clientY - 44, 10) + "px;";
    document.body.appendChild(inp);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        inp.focus();
        inp.select();
      });
    });

    const fontSize = annotFontSize;
    function drawLabel() {
      const label = inp.value.trim();
      if (!label) { inp.remove(); return; }
      pushAnnotUndo();
      annotCtx.font = "bold " + fontSize + "px Arial";
      annotCtx.lineWidth = Math.max(2, fontSize / 7);
      annotCtx.strokeStyle = "white";
      annotCtx.fillStyle = annotColor;
      annotCtx.strokeText(label, cx, cy);
      annotCtx.fillText(label, cx, cy);
      inp.remove();
    }
    inp.addEventListener("keydown", function(ev) {
      if (ev.key === "Enter") { ev.preventDefault(); drawLabel(); }
      else if (ev.key === "Escape") { inp.remove(); }
    });
    inp.addEventListener("blur", function() {
      setTimeout(() => {
        const still = document.getElementById("annot-text-input");
        if (still && document.activeElement !== still) still.remove();
      }, 300);
    });
    return;
  }

  annotDrawing = true;
  const r = annotCanvas.getBoundingClientRect();
  const sx = annotCanvas.width / r.width, sy = annotCanvas.height / r.height;
  annotStartX = (e.clientX - r.left) * sx;
  annotStartY = (e.clientY - r.top) * sy;
  annotSnapshot = annotCtx.getImageData(0, 0, annotCanvas.width, annotCanvas.height);
  pushAnnotUndo();
}

function annotMouseMove(e) {
  if (!annotDrawing || !annotSnapshot) return;
  const r = annotCanvas.getBoundingClientRect();
  const sx = annotCanvas.width / r.width, sy = annotCanvas.height / r.height;
  const x = (e.clientX - r.left) * sx, y = (e.clientY - r.top) * sy;
  annotCtx.putImageData(annotSnapshot, 0, 0);
  drawAnnotShape(annotStartX, annotStartY, x, y);
}

function annotMouseUp(e) {
  if (!annotDrawing) return;
  annotDrawing = false;
  const r = annotCanvas.getBoundingClientRect();
  const sx = annotCanvas.width / r.width, sy = annotCanvas.height / r.height;
  const x = (e.clientX - r.left) * sx, y = (e.clientY - r.top) * sy;
  if (annotSnapshot) annotCtx.putImageData(annotSnapshot, 0, 0);
  drawAnnotShape(annotStartX, annotStartY, x, y);
  annotSnapshot = null;
}

function drawAnnotShape(x1, y1, x2, y2) {
  annotCtx.strokeStyle = annotColor;
  annotCtx.fillStyle = annotColor;
  annotCtx.lineWidth = annotThickness;
  if (annotTool === "arrow") {
    const hl = Math.max(16, annotThickness * 4);
    const a = Math.atan2(y2 - y1, x2 - x1);
    annotCtx.beginPath();
    annotCtx.moveTo(x1, y1);
    annotCtx.lineTo(x2, y2);
    annotCtx.stroke();
    annotCtx.beginPath();
    annotCtx.moveTo(x2, y2);
    annotCtx.lineTo(x2 - hl * Math.cos(a - Math.PI / 6), y2 - hl * Math.sin(a - Math.PI / 6));
    annotCtx.lineTo(x2 - hl * Math.cos(a + Math.PI / 6), y2 - hl * Math.sin(a + Math.PI / 6));
    annotCtx.closePath();
    annotCtx.fill();
  } else if (annotTool === "circle") {
    const rx = Math.abs(x2 - x1) / 2, ry = Math.abs(y2 - y1) / 2;
    annotCtx.beginPath();
    annotCtx.ellipse((x1 + x2) / 2, (y1 + y2) / 2, rx, ry, 0, 0, Math.PI * 2);
    annotCtx.stroke();
  } else if (annotTool === "line") {
    annotCtx.beginPath();
    annotCtx.moveTo(x1, y1);
    annotCtx.lineTo(x2, y2);
    annotCtx.stroke();
  }
}

function setAnnotTool(t) {
  annotTool = t;
  document.querySelectorAll(".tool-btn").forEach(b => b.classList.toggle("active", b.dataset.tool === t));
}
function setAnnotColor(c) {
  annotColor = c;
  document.querySelectorAll(".color-dot").forEach(d => d.classList.toggle("active", d.dataset.color === c));
}
function setAnnotThickness(v) {
  annotThickness = Math.max(1, Math.min(20, parseFloat(v) || 4));
  const lbl = document.getElementById("annot-thickness-val");
  if (lbl) lbl.textContent = annotThickness;
}
function setAnnotFontSize(v) {
  annotFontSize = Math.max(10, Math.min(80, parseInt(v) || 24));
  const lbl = document.getElementById("annot-fontsize-val");
  if (lbl) lbl.textContent = annotFontSize;
}
function saveAnnotation() {
  const p = getProd();
  if (!p || !annotCanvas) return;
  p.annotatedImage = annotCanvas.toDataURL("image/png");
  saveCurrentProject();
  renderDetail();
}
function clearAnnotation() {
  const p = getProd();
  if (!p || !p.productImage || !annotCanvas || !annotCtx) return;
  pushAnnotUndo();
  const img = new Image();
  img.onload = () => annotCtx.drawImage(img, 0, 0);
  img.src = p.productImage;
  p.annotatedImage = null;
  saveCurrentProject();
}

function renderDetail() {
  const panel = document.getElementById("detail-panel");
  if (!panel) return;
  const p = getProd();
  if (!p) {
    panel.innerHTML = `<div style="text-align:center;padding:3rem 1rem;color:var(--text2);font-size:13px;">Click a row to edit</div>`;
    return;
  }
  const idx = products.findIndex(x => x.id === p.id);
  const swatches = p.swatchImages || [null, null, null, null];
  const upholstery = p.upholstery || [];
  const finRows = (p.finishes || []).map((f, i) => `<div class="finish-row"><input type="text" style="padding:5px 7px;font-size:12px;" value="${esc(f)}" placeholder="Finish ${i + 1}" oninput="setFinish('${p.id}',${i},this.value)"/><button class="del-btn" onclick="delFinish('${p.id}',${i})">✕</button></div>`).join("");
  const uphRows = (p.upholstery || []).map((u, i) => `<div class="finish-row"><input type="text" style="padding:5px 7px;font-size:12px;" value="${esc(u)}" placeholder="Upholstery ${i + 1}" oninput="setUph('${p.id}',${i},this.value)"/><button class="del-btn" onclick="delUph('${p.id}',${i})">✕</button></div>`).join("");
  const drawingListHtml = (p.drawings || []).map((d, di) => `<div class="drawing-item"><img src="${d.img}" alt="drawing"/><input type="text" value="${esc(d.caption)}" placeholder="Caption" oninput="setDrawingCaption('${p.id}',${di},this.value)"/><button class="del-btn" onclick="removeDrawing('${p.id}',${di})">✕</button></div>`).join("");
  const hasImg = !!p.productImage;

  const swatchGrid = `<div class="swatch-grid">
    ${[0, 1, 2, 3].map(si => {
      const img = swatches[si]; const label = upholstery[si] || "";
      return `<div class="swatch-slot">
        <input type="file" accept="image/*" id="sw-${p.id}-${si}" style="display:none" onchange="uploadSwatch('${p.id}',${si},this.files[0])"/>
        ${img ? `<div class="swatch-img-wrap"><img src="${img}" alt="swatch"/><button class="swatch-del" onclick="removeSwatch('${p.id}',${si})">×</button></div>` : `<div class="swatch-add" onclick="document.getElementById('sw-${p.id}-${si}').click()">+</div>`}
        <div class="swatch-label">${label ? esc(label) : `Swatch ${si + 1}`}</div>
      </div>`;
    }).join("")}
  </div>`;

  const annotSection = hasImg ? `
<div class="sec-label">Annotate — mark upholstery parts</div>
<div class="annotation-tools">
  <button class="tool-btn active" data-tool="arrow" onclick="setAnnotTool('arrow')">↗ Arrow</button>
  <button class="tool-btn" data-tool="circle" onclick="setAnnotTool('circle')">○ Circle</button>
  <button class="tool-btn" data-tool="line" onclick="setAnnotTool('line')">/ Line</button>
  <button class="tool-btn" data-tool="text" onclick="setAnnotTool('text')">T Text</button>
  <div style="display:flex;gap:4px;margin-left:4px;">${["#e74c3c", "#f39c12", "#2ecc71", "#3498db", "#111", "#fff"].map(c => `<div class="color-dot${c === annotColor ? " active" : ""}" data-color="${c}" style="background:${c};${c === "#fff" ? "border-color:#ccc;" : ""}" onclick="setAnnotColor('${c}')"></div>`).join("")}</div>
  <div style="display:flex;align-items:center;gap:5px;margin-left:8px;padding-left:8px;border-left:1px solid var(--border);font-size:11px;color:var(--text2);">
    <span>Thickness</span>
    <input type="range" min="1" max="16" step="1" value="${annotThickness}" oninput="setAnnotThickness(this.value)" style="width:60px;">
    <span id="annot-thickness-val" style="min-width:16px;">${annotThickness}</span>
  </div>
  <div style="display:flex;align-items:center;gap:5px;margin-left:6px;font-size:11px;color:var(--text2);">
    <span>Font</span>
    <input type="range" min="12" max="72" step="2" value="${annotFontSize}" oninput="setAnnotFontSize(this.value)" style="width:60px;">
    <span id="annot-fontsize-val" style="min-width:20px;">${annotFontSize}</span>
  </div>
</div>
<div class="canvas-wrap"><canvas id="annot-canvas-${p.id}" onmousedown="annotMouseDown(event)" onmousemove="annotMouseMove(event)" onmouseup="annotMouseUp(event)" onmouseleave="annotDrawing=false;annotSnapshot=null"></canvas></div>
<div style="display:flex;gap:6px;margin-bottom:.25rem;">
  <button class="btn sm success" onclick="saveAnnotation()">✓ Save annotation</button>
  <button class="btn sm" onclick="undoAnnotationStep()">← Undo</button>
  <button class="btn sm" onclick="clearAnnotation()">⟲ Reset</button>
  ${p.annotatedImage ? '<span style="font-size:11px;color:var(--success-text);align-self:center;">✓ Saved</span>' : ""}
</div>` : "";

  panel.innerHTML = `
<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
  <div>
    <div style="font-size:14px;font-weight:600;margin-bottom:2px;">${p.productNo ? p.productNo + ". " : ""}</div>
    <div style="font-size:13px;font-weight:600;margin-bottom:2px;">${p.name ? esc(p.name) : "<em style='font-weight:400;color:var(--text2)'>Unnamed</em>"}</div>
  </div>
  <button onclick="delProduct('${p.id}')" title="Delete this product" style="flex-shrink:0;background:none;border:.5px solid var(--border2);border-radius:4px;cursor:pointer;color:var(--text2);font-size:11px;padding:4px 8px;">🗑 Delete</button>
</div>
<div style="display:flex;align-items:center;gap:8px;margin-bottom:.5rem;flex-wrap:wrap;">
  <span style="font-size:11px;color:var(--text2);">Qty ${esc(p.qty)}</span>
  <select style="font-size:11px;padding:3px 7px;border:.5px solid var(--border2);border-radius:4px;background:var(--bg);color:var(--text);cursor:pointer;" onchange="moveProductToArea('${p.id}',this.value)">
    ${usedAreas.map(a => `<option value="${esc(a)}" ${p.area === a ? 'selected' : ''}>${esc(a)}</option>`).join('')}
    ${!usedAreas.includes(p.area) && p.area ? `<option value="${esc(p.area)}" selected>${esc(p.area)}</option>` : ''}
    <option value="" ${!p.area ? 'selected' : ''}>No area</option>
    <option value="__new__">+ New area…</option>
  </select>
</div>
<div class="sec-label">Product photo</div>
<input type="file" accept="image/*" id="img-${p.id}" style="display:none" onchange="uploadProductImg('${p.id}',this.files[0])"/>
${p.productImage ? `<div style="position:relative;margin-bottom:.4rem;"><img src="${p.productImage}" alt="product" style="width:100%;max-height:150px;object-fit:contain;border-radius:var(--radius);border:.5px solid var(--border);display:block;"/><button onclick="removeProductImg('${p.id}')" style="position:absolute;top:5px;right:5px;background:rgba(0,0,0,.6);border:none;border-radius:4px;color:white;font-size:11px;padding:2px 8px;cursor:pointer;">Remove</button></div>` : `<div class="drop-zone" onclick="document.getElementById('img-${p.id}').click()" style="margin-bottom:.4rem;"><div style="font-size:20px;margin-bottom:4px;">📷</div><div style="font-size:12px;color:var(--text2);">Upload product photo</div></div>`}
${annotSection}
<div class="g2" style="margin-bottom:.4rem;">
  <div class="field"><label>Image filename</label><input type="text" style="padding:5px 7px;font-size:12px;" value="${esc(p.imagePath || "")}" placeholder="1.jpg" oninput="setField('${p.id}','imagePath',this.value)"/></div>
  <div class="field"><label>Material</label><input type="text" style="padding:5px 7px;font-size:12px;" value="${esc(p.material || "")}" placeholder="Teak wood / Fabric" oninput="setField('${p.id}','material',this.value)"/></div>
</div>
<div class="sec-label">Factory drawings</div>
<div class="drawing-list">${drawingListHtml || '<div style="font-size:12px;color:var(--text2);padding:4px 0;">No drawings added</div>'}</div>
<input type="file" accept="image/*,application/pdf" id="drw-${p.id}" style="display:none" onchange="uploadDrawing('${p.id}',this.files[0])"/>
<button class="btn sm" onclick="document.getElementById('drw-${p.id}').click()" style="margin-bottom:.4rem;">+ Add drawing / PDF</button>
<div class="sec-label">Finishes</div>
${finRows}
<button class="btn sm" onclick="addFinish('${p.id}')" style="margin-bottom:.4rem;">+ Add finish</button>
<div class="sec-label">Upholstery</div>
${uphRows}
<button class="btn sm" onclick="addUph('${p.id}')" style="margin-bottom:.4rem;">+ Add upholstery</button>
<div class="sec-label">Swatch images (linked to upholstery order)</div>
${swatchGrid}
<div style="display:flex;gap:6px;margin-top:.75rem;">
  <button class="btn" style="flex:1;justify-content:center;" onclick="navPrev()" ${idx === 0 ? "disabled" : ""}>← Prev</button>
  <button class="btn" style="padding:0 10px;font-size:11px;" onclick="duplicateProduct('${p.id}')" title="Duplicate product">⧉ Dup</button>
  <button class="btn" style="padding:0 10px;font-size:11px;" onclick="copyToProject('${p.id}')" title="Copy product to another project">→ Copy</button>
  <button class="btn primary" style="flex:1;justify-content:center;" onclick="navNext()" ${idx === products.length - 1 ? "disabled" : ""}>Next →</button>
</div>`;

  if (hasImg) setTimeout(() => initAnnotCanvas(p.id), 50);
}

function normText(s) {
  return (s || "").toString().toLowerCase().replace(/[₹,]/g, "").replace(/\s+/g, " ").trim();
}
function normNum(s) {
  const n = parseFloat((s || "").toString().replace(/[^0-9.]/g, ""));
  return isNaN(n) ? null : n;
}

async function parseSpreadsheetQuote(file) {
  if (!window.XLSX) {
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  const buf = await file.arrayBuffer();
  const wb = window.XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  let headerIdx = -1, cols = {};
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const row = rows[i].map(c => normText(c));
    const noCol = row.findIndex(c => c === "no" || c === "#" || c === "sl" || c === "sl no" || c === "item");
    const descCol = row.findIndex(c => c.includes("description") || c.includes("product") || c.includes("name"));
    const qtyCol = row.findIndex(c => c === "qty" || c.includes("quantity"));
    if (descCol >= 0 && qtyCol >= 0) {
      headerIdx = i;
      cols = {
        no: noCol, desc: descCol, qty: qtyCol,
        dim: row.findIndex(c => c.includes("dimension") || c.includes("material") || c.includes("size")),
        area: row.findIndex(c => c.includes("area") || c.includes("room") || c.includes("zone"))
      };
      break;
    }
  }
  if (headerIdx < 0) throw new Error("Could not find Description/Qty columns in this spreadsheet.");

  const out = [];
  let currentArea = "";
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(c => !c && c !== 0)) continue;
    const desc = (row[cols.desc] || "").toString().trim();
    const qtyRaw = cols.qty >= 0 ? row[cols.qty] : "";
    const qty = normNum(qtyRaw);
    const otherCellsEmpty = row.every((c, ci) => ci === cols.desc || (!c && c !== 0));
    if (desc && (qty === null) && otherCellsEmpty) {
      currentArea = desc;
      continue;
    }
    if (!desc || qty === null) continue;
    out.push({
      no: cols.no >= 0 ? (row[cols.no] || "").toString().trim() : String(out.length + 1),
      name: desc,
      dimensions: cols.dim >= 0 ? (row[cols.dim] || "").toString().trim() : "",
      qty: qty,
      area: currentArea
    });
  }
  if (!out.length) throw new Error("No product rows found in this file.");
  return out;
}

async function parsePdfQuote(file) {
  if (!window.pdfjsLib) {
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      s.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        res();
      };
      s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  const pdf = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  let fullText = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const content = await page.getTextContent();
    const items = content.items.map(it => ({ str: it.str, x: it.transform[4], y: Math.round(it.transform[5]) }));
    fullText.push(...items);
  }
  const lines = [];
  fullText.sort((a, b) => b.y - a.y);
  let curY = null, curLine = [];
  for (const it of fullText) {
    if (curY === null || Math.abs(it.y - curY) > 3) {
      if (curLine.length) lines.push(curLine);
      curLine = [it]; curY = it.y;
    } else {
      curLine.push(it);
    }
  }
  if (curLine.length) lines.push(curLine);
  const textLines = lines.map(l => l.sort((a, b) => a.x - b.x).map(i => i.str).join(" ").replace(/\s+/g, " ").trim()).filter(Boolean);

  const out = [];
  let currentArea = "";
  const rowRe = /^(\d{1,3})\s+(.+?)\s+(₹[\d,]+|\d[\d,]*\.?\d*)\s+(\d{1,3})\s+(₹[\d,]+)\s*$/;
  for (const line of textLines) {
    if (/^[A-Z][A-Z\s\-&]{2,40}$/.test(line) && !/\d/.test(line)) {
      currentArea = line.trim();
      continue;
    }
    const m = line.match(rowRe);
    if (m) {
      const no = m[1];
      let rest = m[2].trim();
      const qty = normNum(m[4]);
      let name = rest, dim = "";
      const splitMatch = rest.match(/^(.*?)\s+((?:\d[\d.]*\s*(?:cm|x|dia)|standard dimension).*)$/i);
      if (splitMatch && splitMatch[1].trim()) {
        name = splitMatch[1].trim();
        dim = splitMatch[2].trim();
      }
      out.push({ no, name, dimensions: dim, qty, area: currentArea });
    }
  }
  if (!out.length) throw new Error("Could not parse rows from this PDF. You can upload an Excel or CSV file instead.");
  return out;
}

async function handleQuoteUpload(file) {
  quoteFileName = file.name;
  const ext = file.name.split(".").pop().toLowerCase();
  const statusEl = document.getElementById("verify-status");
  if (statusEl) statusEl.textContent = "Reading " + file.name + "…";
  try {
    if (ext === "csv" || ext === "xlsx" || ext === "xls") {
      quoteFileType = ext === "csv" ? "csv" : "xlsx";
      quoteRows = await parseSpreadsheetQuote(file);
    } else if (ext === "pdf") {
      quoteFileType = "pdf";
      quoteRows = await parsePdfQuote(file);
    } else {
      throw new Error("Please upload a .csv, .xlsx, or .pdf file.");
    }
    renderVerify();
  } catch (e) {
    quoteRows = null;
    if (statusEl) statusEl.textContent = "";
    alert("Could not read quotation: " + e.message);
  }
}

function clearQuote() {
  quoteRows = null;
  quoteFileName = null;
  quoteFileType = null;
  renderVerify();
}

function matchQuoteRows() {
  if (!quoteRows) return null;
  const usedQuoteIdx = new Set();
  const results = products.map((p, i) => {
    let match = null, matchIdx = -1;
    const pNo = (p.productNo || String(i + 1)).toString().trim();
    for (let qi = 0; qi < quoteRows.length; qi++) {
      if (usedQuoteIdx.has(qi)) continue;
      if (quoteRows[qi].no === pNo) { match = quoteRows[qi]; matchIdx = qi; break; }
    }
    if (!match) {
      const pName = normText(p.name);
      for (let qi = 0; qi < quoteRows.length; qi++) {
        if (usedQuoteIdx.has(qi)) continue;
        const qName = normText(quoteRows[qi].name);
        if (qName && pName && (qName === pName || qName.includes(pName) || pName.includes(qName))) {
          match = quoteRows[qi]; matchIdx = qi; break;
        }
      }
    }
    if (matchIdx >= 0) usedQuoteIdx.add(matchIdx);

    if (!match) {
      return { product: p, quote: null, status: "missing", issues: ["Not found in quotation"] };
    }
    const issues = [];
    const qtyP = normNum(p.qty), qtyQ = match.qty;
    if (qtyP !== null && qtyQ !== null && qtyP !== qtyQ) {
      issues.push(`Qty mismatch: listing has ${qtyP}, quotation has ${qtyQ}`);
    }
    const nameP = normText(p.name), nameQ = normText(match.name);
    if (nameP && nameQ && nameP !== nameQ && !nameQ.includes(nameP) && !nameP.includes(nameQ)) {
      issues.push(`Name differs: "${p.name}" vs quotation "${match.name}"`);
    }
    const dimP = normText(p.dimensions), dimQ = normText(match.dimensions);
    if (dimP && dimQ && dimP !== dimQ) {
      issues.push(`Dimensions differ: "${p.dimensions}" vs quotation "${match.dimensions}"`);
    }
    return { product: p, quote: match, status: issues.length ? "mismatch" : "ok", issues };
  });

  const unmatchedQuoteRows = quoteRows.filter((q, qi) => !usedQuoteIdx.has(qi));
  return { results, unmatchedQuoteRows };
}

function renderVerify() {
  const c = document.getElementById("page-content");
  if (c) renderVerifyInto(c);
}

function renderVerifyInto(c) {
  if (!quoteRows) {
    c.innerHTML = `
<div class="panel">
  <div class="panel-title">Verify against quotation</div>
  <div style="font-size:13px;color:var(--text2);margin-bottom:14px;line-height:1.6;">
    Upload the original quotation to cross-check product names, dimensions, and quantities before exporting.<br/>
    Supports <b>CSV, Excel (.xlsx)</b> or quotation <b>PDF</b> files.
  </div>
  <div id="verify-status" style="font-size:12px;color:var(--text2);min-height:18px;margin-bottom:10px;"></div>
  <div style="display:flex;gap:10px;flex-wrap:wrap;">
    <label class="btn primary" style="cursor:pointer;">
      📄 Upload quotation (CSV / Excel / PDF)
      <input type="file" accept=".csv,.xlsx,.xls,.pdf" style="display:none;" onchange="if(this.files[0])handleQuoteUpload(this.files[0])"/>
    </label>
  </div>
</div>
<div class="btn-row">
  <button class="btn" onclick="goStep(1)">← Back to products</button>
  <button class="btn" onclick="goStep(3)">Skip verification → Export</button>
</div>`;
    return;
  }

  const m = matchQuoteRows();
  const okCount = m.results.filter(r => r.status === "ok").length;
  const mismatchCount = m.results.filter(r => r.status === "mismatch").length;
  const missingCount = m.results.filter(r => r.status === "missing").length;
  const extraCount = m.unmatchedQuoteRows.length;

  c.innerHTML = `
<div class="panel">
  <div class="panel-title">Verify against quotation</div>
  <div style="font-size:12px;color:var(--text2);margin-bottom:10px;">
    Checked against <b>${esc(quoteFileName)}</b> (${quoteFileType.toUpperCase()}) · ${quoteRows.length} rows parsed
    &nbsp;·&nbsp; <a href="#" onclick="clearQuote();return false;" style="color:var(--danger-text);">remove &amp; re-upload</a>
  </div>
</div>
<div class="stat-grid">
  <div class="stat"><div class="stat-label">Matched OK</div><div class="stat-val" style="color:var(--success-text);">${okCount}</div></div>
  <div class="stat"><div class="stat-label">Mismatches</div><div class="stat-val" style="color:${mismatchCount ? 'var(--danger-text)' : 'var(--text)'};">${mismatchCount}</div></div>
  <div class="stat"><div class="stat-label">Missing from quote</div><div class="stat-val" style="color:${missingCount ? 'var(--danger-text)' : 'var(--text)'};">${missingCount}</div></div>
  <div class="stat"><div class="stat-label">In quote, not in listing</div><div class="stat-val" style="color:${extraCount ? 'var(--warn-text)' : 'var(--text)'};">${extraCount}</div></div>
</div>
${mismatchCount === 0 && missingCount === 0 && extraCount === 0 ? `<div style="background:var(--success-bg);color:var(--success-text);padding:10px 14px;border-radius:var(--radius);font-size:13px;margin-bottom:14px;">✓ Everything matches the quotation. Safe to export.</div>` : ""}
<div class="tbl-wrap" style="margin-bottom:1rem;"><div style="overflow-x:auto;">
<table class="tbl">
  <thead><tr><th>#</th><th>Product (listing)</th><th>Qty</th><th>Quotation match</th><th>Status</th></tr></thead>
  <tbody>
  ${m.results.map((r, i) => {
    const p = r.product;
    const statusBadge = r.status === "ok"
      ? `<span style="color:var(--success-text);font-weight:600;">✓ OK</span>`
      : r.status === "missing"
      ? `<span style="color:var(--danger-text);font-weight:600;">✗ Not in quote</span>`
      : `<span style="color:var(--danger-text);font-weight:600;">⚠ Mismatch</span>`;
    const quoteCell = r.quote
      ? `<div style="font-size:11px;">${esc(r.quote.name)}${r.quote.dimensions ? ` · ${esc(r.quote.dimensions)}` : ""} · Qty ${esc(r.quote.qty)}</div>`
      : `<span style="color:var(--text2);font-size:11px;">—</span>`;
    const issuesCell = r.issues.length ? `<div style="font-size:11px;color:var(--danger-text);margin-top:3px;">${r.issues.map(esc).join("<br/>")}</div>` : "";
    return `<tr onclick="goStep(1);setTimeout(()=>selectAndDetail('${p.id}'),50);" style="cursor:pointer;">
      <td>${esc(p.productNo) || (i + 1)}</td>
      <td style="font-weight:500;">${p.name ? esc(p.name) : "<em style='color:var(--text2)'>unnamed</em>"}${issuesCell}</td>
      <td style="text-align:center;">${esc(p.qty)}</td>
      <td>${quoteCell}</td>
      <td>${statusBadge}</td>
    </tr>`;
  }).join("")}
  </tbody>
</table>
</div></div>
${extraCount > 0 ? `
<div class="panel">
  <div class="panel-title" style="font-size:13px;">Rows found in quotation but not in your listing (${extraCount})</div>
  <div style="font-size:12px;color:var(--text2);">
    ${m.unmatchedQuoteRows.map(q => `#${esc(q.no)} — ${esc(q.name)}${q.dimensions ? " · " + esc(q.dimensions) : ""} · Qty ${esc(q.qty)}${q.area ? " · " + esc(q.area) : ""}`).join("<br/>")}
  </div>
</div>` : ""}
<div class="btn-row">
  <button class="btn" onclick="goStep(1)">← Back to products</button>
  <button class="btn primary" onclick="goStep(3)">Continue to Export →</button>
</div>`;
}

function renderExport() {
  const c = document.getElementById("page-content");
  if (c) renderExportInto(c);
}

function renderExportInto(c) {
  const ip = uphPending(), id2 = imgDone(), tot = totalPieces();
  const areas = [...new Set(products.map(p => p.area).filter(Boolean))];
  const totalDrawings = products.reduce((s, p) => s + (p.drawings || []).length, 0);

  c.innerHTML = `
<div class="stat-grid">
  ${[["Products", products.length], ["Pieces", tot], ["Areas", areas.length], ["Photos", `${id2}/${products.length}`], ["Drawings", totalDrawings], ["Upholstery", `${products.length - ip}/${products.length}`]].map(([l, v]) => `<div class="stat"><div class="stat-label">${l}</div><div class="stat-val">${v}</div></div>`).join("")}
</div>
${ip > 0 ? `<div class="warn">⚠ ${ip} product(s) missing upholstery.</div>` : ""}
${id2 < products.length ? `<div class="warn">⚠ ${products.length - id2} product(s) missing photos.</div>` : ""}
${(function() {
  const hist = project.revisionHistory || [];
  const last = hist.length ? hist[hist.length - 1] : null;
  const rev = project.revision || "1";
  const pts = last ? revisionEntryPoints(last) : [];
  return `<div style="padding:9px 13px;background:var(--info-bg);color:var(--info-text);border-radius:var(--radius);font-size:13px;margin-bottom:.75rem;"><b>Rev ${esc(rev)}</b>${pts.length ? `<ul style="margin:4px 0 0 16px;padding:0;">${pts.map(pt => `<li>${esc(pt)}</li>`).join("")}</ul>` : ` — <em>No revision note recorded</em>`}</div>`;
})()}
<div class="tbl-wrap" style="margin-bottom:1rem;"><div style="overflow-x:auto;"><table class="tbl">
  <thead><tr>${["#", "Product", "Qty", "Area", "Dimensions", "Finishes", "Upholstery", "Photo", "Annot", "Drw", "Swatch"].map((h, hi) => `<th${[4, 5, 6, 7, 8, 9].includes(hi) ? ' class="mobile-hide"' : ''}>${h}</th>`).join("")}</tr></thead>
  <tbody>${products.map((p, i) => `<tr onclick="goStep(1);setTimeout(()=>selectAndDetail('${p.id}'),50);" style="cursor:pointer;">
    <td>${p.productNo || (i + 1)}</td>
    <td style="font-weight:500;">${p.name ? esc(p.name) : "<em style='color:var(--text2)'>unnamed</em>"}</td>
    <td style="text-align:center;">${p.qty}</td>
    <td><span style="font-size:11px;padding:2px 7px;border-radius:20px;background:var(--info-bg);color:var(--info-text);">${esc(p.area) || "—"}</span></td>
    <td class="mobile-hide" style="color:var(--text2);font-size:11px;">${esc(p.dimensions) || "—"}</td>
    <td class="mobile-hide" style="font-size:11px;">${(p.finishes || []).filter(Boolean).join(", ") || "—"}</td>
    <td class="mobile-hide" style="font-size:11px;">${(p.upholstery || []).filter(Boolean).join(", ") || "<em style='color:var(--text2)'>Pending</em>"}</td>
    <td class="mobile-hide" style="text-align:center;">${p.productImage ? '<span style="color:var(--success-text);">✓</span>' : '<span style="color:var(--danger-text);">✗</span>'}</td>
    <td class="mobile-hide" style="text-align:center;">${p.annotatedImage ? '<span style="color:var(--success-text);">✓</span>' : '—'}</td>
    <td class="mobile-hide" style="text-align:center;">${(p.drawings || []).length > 0 ? `<span style="color:var(--success-text);">${p.drawings.length}</span>` : '—'}</td>
    <td style="text-align:center;">${(p.swatchImages || []).some(s => s) ? '<span style="color:var(--success-text);">✓</span>' : '—'}</td>
  </tr>`).join("")}</tbody>
</table></div></div>
<div class="btn-row">
  <button class="btn" onclick="goStep(2)">← Back to verify</button>
  <div style="display:flex;flex-direction:column;gap:6px;padding:10px 14px;background:var(--bg2);border-radius:var(--radius);border:.5px solid var(--border);">
    <div style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:2px;">Factory Listing PDF</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button class="btn success" onclick="generatePDF(true)">
        🖨 Branded PDF <span style="font-size:11px;opacity:.7;">(client copy)</span>
      </button>
      <button class="btn" onclick="generatePDF(false)" style="border-color:var(--border2);">
        🖨 Unbranded PDF <span style="font-size:11px;opacity:.7;">(factory copy)</span>
      </button>
    </div>
  </div>
  <div style="display:flex;flex-direction:column;gap:6px;padding:10px 14px;background:var(--bg2);border-radius:var(--radius);border:.5px solid var(--border);">
    <div style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:2px;">Tagging &amp; Placement List</div>
    <div style="font-size:11px;color:var(--text3);margin-bottom:4px;">Print &amp; attach to each physical piece</div>
    <button class="btn" onclick="generateTagsPDF()" style="background:var(--info-bg);color:var(--info-text);border-color:var(--info-text);">
      🏷 Generate Placement Tags
    </button>
  </div>
  <div style="display:flex;flex-direction:column;gap:6px;padding:10px 14px;background:var(--bg2);border-radius:var(--radius);border:.5px solid var(--border);">
    <div style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:2px;">Delivery Checklist</div>
    <div style="font-size:11px;color:var(--text3);margin-bottom:4px;">One row per piece with Loaded / Delivered check</div>
    <button class="btn" onclick="generateDeliveryChecklistPDF()" style="background:var(--success-bg);color:var(--success-text);border-color:var(--success-text);">
      ✅ Generate Delivery Checklist
    </button>
  </div>
  <div style="display:flex;flex-direction:column;gap:6px;padding:10px 14px;background:var(--bg2);border-radius:var(--radius);border:.5px solid var(--border);">
    <div style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:2px;">Return Pickup &amp; Repair</div>
    <div style="font-size:11px;color:var(--text3);margin-bottom:4px;">Select items to collect from site for replacement or repair</div>
    <button class="btn" onclick="openReturnPickupModal()" style="background:var(--warn-bg);color:var(--warn-text);border-color:var(--warn-text);">
      🔄 Return Pickup List
    </button>
  </div>
  <button class="btn" onclick="saveCurrentProject()">💾 Save project</button>
  <button class="btn" onclick="exportProject(currentProjectId)" title="Export as .lyffin file">📤 Export to file</button>
  <div style="display:flex;flex-direction:column;gap:6px;padding:10px 14px;background:#1a1a18;border-radius:var(--radius);border:.5px solid #b89a6a;">
    <div style="font-size:12px;font-weight:600;color:#b89a6a;margin-bottom:2px;">🔗 Lyffin Ops Platform</div>
    <div style="font-size:11px;color:rgba(255,255,255,0.5);margin-bottom:4px;">Sync products directly with the factory floor Production Tracker.</div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
      <select id="ops-project-select" style="flex:1;min-width:180px;height:32px;padding:0 8px;border-radius:4px;border:1px solid #b89a6a;background:#2a2a28;color:#fff;font-size:12px;">
        <option value="">Loading Ops projects…</option>
      </select>
      <button class="btn" id="push-ops-btn" onclick="pushToOps()" style="background:#b89a6a;color:#1a1a18;border-color:#b89a6a;font-weight:600;">
        🚀 Push to Ops
      </button>
    </div>
    <div id="ops-push-status" style="font-size:11px;margin-top:2px;color:#b89a6a;"></div>
  </div>
</div>`;
}

function openReturnPickupModal() {
  let m = document.getElementById("return-pickup-modal");
  if (!m) {
    m = document.createElement("div");
    m.id = "return-pickup-modal";
    m.style.cssText = "position:fixed;inset:0;z-index:500;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:20px;";
    document.body.appendChild(m);
  }
  window._returnPickupSelections = window._returnPickupSelections || {};
  renderReturnPickupModal();
  m.style.display = "flex";
}

function renderReturnPickupModal() {
  const m = document.getElementById("return-pickup-modal");
  if (!m) return;
  const sels = window._returnPickupSelections || {};
  const itemsHtml = products.map(p => {
    const sel = sels[p.id] || {};
    const img = p.annotatedImage || p.productImage || null;
    return `<div style="padding:10px 0;border-bottom:1px solid #eee;">
      <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
        <input type="checkbox" ${sel.selected ? "checked" : ""} onchange="toggleReturnPickupItem('${p.id}', this.checked)">
        ${img ? `<img src="${img}" alt="thumb" style="width:34px;height:34px;object-fit:cover;border-radius:4px;border:.5px solid #ddd;flex-shrink:0;"/>` : `<div style="width:34px;height:34px;border:.5px dashed #ccc;border-radius:4px;flex-shrink:0;"></div>`}
        <span style="flex:1;min-width:0;">
          <span style="display:block;font-size:13px;font-weight:600;color:#1a1a18;">${esc(p.name || "Unnamed product")}</span>
          <span style="display:block;font-size:11px;color:#888;margin-top:1px;">No. ${esc(p.productNo || "—")}${p.dimensions ? " · " + esc(p.dimensions) : ""}${p.area ? " · " + esc(p.area) : ""}</span>
        </span>
      </label>
      <div id="rp-detail-${p.id}" style="display:${sel.selected ? "flex" : "none"};gap:8px;margin-top:8px;padding-left:52px;flex-wrap:wrap;">
        <input type="text" placeholder="Reason for return" value="${esc(sel.reason || "")}" oninput="setReturnPickupField('${p.id}','reason',this.value)" style="flex:1;min-width:160px;padding:6px 10px;border:1px solid #ccc;border-radius:4px;font-size:12px;">
        <select onchange="setReturnPickupField('${p.id}','action',this.value)" style="padding:6px 10px;border:1px solid #ccc;border-radius:4px;font-size:12px;">
          <option value="Replace" ${(sel.action || "Replace") === "Replace" ? "selected" : ""}>Replace</option>
          <option value="Repair" ${sel.action === "Repair" ? "selected" : ""}>Repair</option>
        </select>
      </div>
    </div>`;
  }).join("");

  m.innerHTML = `<div style="background:#fff;border-radius:10px;max-width:520px;width:100%;max-height:80vh;overflow-y:auto;padding:22px 24px;">
    <div style="font-size:17px;font-weight:700;color:#1a1a18;margin-bottom:4px;">Return Pickup &amp; Replacement/Repair List</div>
    <div style="font-size:12.5px;color:#888;margin-bottom:14px;">Select the products to collect from site, with reason and requested action.</div>
    ${products.length ? itemsHtml : '<div style="font-size:13px;color:#888;padding:20px 0;text-align:center;">No products in this listing yet.</div>'}
    <div style="display:flex;gap:8px;margin-top:18px;justify-content:flex-end;">
      <button class="btn" onclick="closeReturnPickupModal()" style="background:#f0f0f0;color:#1a1a18;">Cancel</button>
      <button class="btn" onclick="generateReturnPickupPDF()" style="background:#b89a6a;color:#1a1a18;font-weight:600;">Generate PDF</button>
    </div>
  </div>`;
}

window.closeReturnPickupModal = function() {
  const m = document.getElementById("return-pickup-modal");
  if (m) m.style.display = "none";
};

window.toggleReturnPickupItem = function(id, checked) {
  const sels = window._returnPickupSelections;
  if (!sels[id]) sels[id] = { action: "Replace" };
  sels[id].selected = checked;
  const detail = document.getElementById("rp-detail-" + id);
  if (detail) detail.style.display = checked ? "flex" : "none";
};

window.setReturnPickupField = function(id, field, value) {
  const sels = window._returnPickupSelections;
  if (!sels[id]) sels[id] = {};
  sels[id][field] = value;
};

window.generateReturnPickupPDF = function() {
  const sels = window._returnPickupSelections || {};
  const items = products.filter(p => sels[p.id] && sels[p.id].selected).map(p => ({
    product: p,
    reason: (sels[p.id].reason || "").trim(),
    action: sels[p.id].action || "Replace"
  }));
  if (!items.length) {
    alert("Select at least one product to include.");
    return;
  }
  try {
    const html = buildReturnPickupPDF(items);
    const w = window.open("", "_blank");
    if (w && !w.closed) {
      w.document.write(html);
      w.document.close();
      w.document.title = "Lyffin_Return_Pickup_" + (project.clientName || "Client").replace(/[^a-zA-Z0-9]/g, "_");
      setTimeout(() => { try { w.print(); } catch (e) {} }, 800);
      closeReturnPickupModal();
      return;
    }
    printViaHiddenIframe(html);
    closeReturnPickupModal();
  } catch (err) {
    alert("Return pickup PDF error: " + err.message);
  }
};
