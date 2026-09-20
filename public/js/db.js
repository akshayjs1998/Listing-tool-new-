// Lyffin Listing Tool - Database & State Management
var DB_NAME = "LyffinDB", DB_VER = 1, DB_STORE = "projects";
var db = null;
var allProjects = {};
var currentProjectId = null;
var step = 0;
var project = {
  clientName: "", quoteNo: "", projectName: "",
  date: new Date().toISOString().split("T")[0],
  dueDate: "", preparedBy: "", revision: "1",
  clientAddress: "", clientPhone: "",
  revisionHistory: [], bufferDays: 5
};
var products = [];
var selectedId = null;
var usedAreas = [];

function openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore(DB_STORE, { keyPath: "id" });
    };
    req.onsuccess = e => { db = e.target.result; res(db); };
    req.onerror = rej;
  });
}

function initDB() {
  return openDB();
}

function dbPut(obj) {
  return new Promise((res, rej) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).put(obj).onsuccess = () => res();
    tx.onerror = rej;
  });
}

function dbGetAll() {
  return new Promise((res, rej) => {
    const tx = db.transaction(DB_STORE, "readonly");
    const r = tx.objectStore(DB_STORE).getAll();
    r.onsuccess = e => res(e.target.result || []);
    r.onerror = rej;
  });
}

function dbDelete(id) {
  return new Promise((res, rej) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).delete(id).onsuccess = () => res();
    tx.onerror = rej;
  });
}

async function loadAllProjects() {
  await openDB();
  const rows = await dbGetAll();
  allProjects = {};
  rows.forEach(r => allProjects[r.id] = r);
}

async function saveAllProjects() {
  if (currentProjectId && allProjects[currentProjectId]) {
    try {
      await dbPut(allProjects[currentProjectId]);
    } catch (e) {
      alert("Save error: " + e.message);
    }
  }
}

function showToast(msg) {
  let t = document.getElementById('listing-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'listing-toast';
    t.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#1a1a18;color:#fff;padding:10px 16px;border-radius:6px;font-size:13px;z-index:999;opacity:0;transition:opacity .25s;pointer-events:none;';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(t._to);
  t._to = setTimeout(() => { t.style.opacity = '0'; }, 2200);
}

function checkDuplicateProduct(id) {
  const p = products.find(x => x.id === id);
  if (!p || !p.name || !p.name.trim()) return;
  const dupe = products.find(x => x.id !== id && (x.name || '').trim().toLowerCase() === p.name.trim().toLowerCase() && (x.area || '') === (p.area || ''));
  if (dupe) showToast('⚠ "' + p.name + '" already exists' + (p.area ? ' in ' + p.area : '') + ' — check this isn\'t a duplicate entry');
}

async function saveCurrentProject() {
  if (!currentProjectId) return;
  usedAreas = [...new Set(products.map(p => p.area).filter(Boolean))];
  allProjects[currentProjectId] = {
    id: currentProjectId,
    name: project.clientName || "Untitled",
    meta: `${project.quoteNo || ""}${project.quoteNo && project.dueDate ? " · " : ""}${project.dueDate ? "Due: " + project.dueDate : ""}`,
    updatedAt: new Date().toISOString(),
    project, products, usedAreas
  };
  await saveAllProjects();
  const b = document.getElementById("save-badge");
  if (b) {
    b.style.display = "inline";
    setTimeout(() => b.style.display = "none", 1800);
  }
}

let _autosaveTimer = null;
function autosaveProject() {
  clearTimeout(_autosaveTimer);
  _autosaveTimer = setTimeout(() => saveCurrentProject(), 600);
}

function uid() {
  return "p_" + Math.random().toString(36).slice(2, 9);
}

function blank() {
  return {
    id: uid(),
    productNo: "",
    name: "",
    qty: 1,
    area: "",
    dimensions: "",
    details: "",
    material: "",
    finishes: [""],
    upholstery: [],
    productImage: null,
    annotatedImage: null,
    swatchImages: [null, null, null, null],
    drawings: []
  };
}

function readFile(f) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = e => res(e.target.result);
    r.onerror = rej;
    r.readAsDataURL(f);
  });
}

function compressImage(dataURL, maxDim = 1200, quality = 0.82) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
        else { w = Math.round(w * maxDim / h); h = maxDim; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      res(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      console.error("compressImage: failed to load image");
      rej(new Error("Could not load image — file may be corrupt or an unsupported format."));
    };
    img.src = dataURL;
  });
}

async function compressSwatch(dataURL) {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      const maxDim = 1600;
      if (w > maxDim || h > maxDim) {
        if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
        else { w = Math.round(w * maxDim / h); h = maxDim; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, w, h);
      const png = canvas.toDataURL('image/png');
      res(png.length > 700000 ? canvas.toDataURL('image/jpeg', 0.97) : png);
    };
    img.src = dataURL;
  });
}

function esc(s) {
  return (s || "").toString().replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function escNL(s) {
  return esc(s).replace(/\n/g, "<br/>");
}

function getProd() {
  return products.find(p => p.id === selectedId) || null;
}

function totalPieces() {
  return products.reduce((s, p) => s + (parseInt(p.qty) || 0), 0);
}

function imgDone() {
  return products.filter(p => p.productImage).length;
}

function uphPending() {
  return products.filter(p => !(p.upholstery || []).some(u => u)).length;
}

window.initDB = initDB;
window.openDB = openDB;
window.dbPut = dbPut;
window.dbGetAll = dbGetAll;
window.dbDelete = dbDelete;
window.loadAllProjects = loadAllProjects;
window.saveAllProjects = saveAllProjects;
window.saveCurrentProject = saveCurrentProject;
window.autosaveProject = autosaveProject;
window.showToast = showToast;
window.checkDuplicateProduct = checkDuplicateProduct;
window.uid = uid;
window.blank = blank;
window.readFile = readFile;
window.compressImage = compressImage;
window.compressSwatch = compressSwatch;
window.esc = esc;
window.escNL = escNL;
window.getProd = getProd;
window.totalPieces = totalPieces;
window.imgDone = imgDone;
window.uphPending = uphPending;
