// Lyffin Listing Tool - Ops Platform Synchronization
const OPS_CONFIG = {
  apiKey:            "AIzaSyC0aoUyBCHn63-WkJnPFbDJLF0x1GFMyxU",
  authDomain:        "lyffin-platform.firebaseapp.com",
  projectId:         "lyffin-platform",
  storageBucket:     "lyffin-platform.firebasestorage.app",
  messagingSenderId: "618920465280",
  appId:             "1:618920465280:web:11ba5583ff3f2b778a2765"
};

let opsDb = null;
let opsProjects = [];
let opsAuthed = false;
const OPS_SERVICE_EMAIL = 'listing-tool@lyffin-platform.local';

async function compressForOpsThumbnail(dataURL) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      const maxDim = 560;
      if (w > maxDim || h > maxDim) {
        if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
        else { w = Math.round(w * maxDim / h); h = maxDim; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      res(canvas.toDataURL('image/jpeg', 0.78));
    };
    img.onerror = () => rej(new Error('Could not process image for thumbnail'));
    img.src = dataURL;
  });
}

async function ensureOpsAuth() {
  if (opsAuthed) return true;
  try {
    const { getAuth, signInWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js');
    const { getApps, initializeApp } = await import('https://www.gstatic.com/firebasejs/11.9.0/firebase-app.js');
    const existing = getApps().find(a => a.name === 'ops');
    const opsApp = existing || initializeApp(OPS_CONFIG, 'ops');
    const auth = getAuth(opsApp);
    const password = prompt('Enter the Ops push password:');
    if (!password) return false;
    await signInWithEmailAndPassword(auth, OPS_SERVICE_EMAIL, password);
    opsAuthed = true;
    return true;
  } catch (e) {
    alert('Incorrect password or connection error — could not connect to Ops.');
    return false;
  }
}

async function initOpsFirebase() {
  try {
    const sel = document.getElementById('ops-project-select');
    if (!sel) return;

    const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/11.9.0/firebase-app.js');
    const { getFirestore, collection, getDocs } = await import('https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js');

    const existing = getApps().find(a => a.name === 'ops');
    const opsApp = existing || initializeApp(OPS_CONFIG, 'ops');
    opsDb = getFirestore(opsApp);

    const snap = await getDocs(collection(opsDb, 'projects'));
    opsProjects = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (opsProjects.length === 0) {
      sel.innerHTML = '<option value="">No projects in Ops yet</option>';
    } else {
      sel.innerHTML = '<option value="">Select Ops project to link…</option>' +
        opsProjects.map(p => {
          const name = p.projectName || p.clientName || p.name || p.id;
          const loc = p.location || '';
          return `<option value="${p.id}">${name}${loc ? ' · ' + loc : ''}</option>`;
        }).join('');

      const clientLower = (project.clientName || '').toLowerCase();
      const match = opsProjects.find(p => {
        const n = (p.projectName || p.clientName || p.name || '').toLowerCase();
        return n.includes(clientLower) || (clientLower && clientLower.includes(n));
      });
      if (match) sel.value = match.id;
    }
  } catch (e) {
    console.warn('Ops Firebase notice:', e);
    const sel = document.getElementById('ops-project-select');
    if (sel) sel.innerHTML = '<option value="">Connect to Ops on push</option>';
  }
}

async function pushToOps() {
  const sel = document.getElementById('ops-project-select');
  const statusEl = document.getElementById('ops-push-status');
  const btn = document.getElementById('push-ops-btn');

  if (!sel || !sel.value) {
    if (statusEl) statusEl.textContent = '⚠ Please select an Ops project first.';
    return;
  }

  const okAuth = await ensureOpsAuth();
  if (!okAuth) {
    if (statusEl) statusEl.textContent = '⚠ Not connected to Ops — password required.';
    return;
  }

  const opsProjectId = sel.value;
  btn.disabled = true;
  btn.textContent = 'Checking for changes…';
  if (statusEl) statusEl.textContent = '';

  try {
    const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js');
    const existingSnap = await getDocs(collection(opsDb, 'projects', opsProjectId, 'items'));
    const existingIds = new Set(existingSnap.docs.map(d => d.id));
    const existingById = {};
    existingSnap.docs.forEach(d => { existingById[d.id] = d.data(); });

    function diffProduct(existing, p) {
      const changes = [];
      if ((existing.name || '') !== (p.name || '')) changes.push('Name: "' + (existing.name || '—') + '" → "' + (p.name || '—') + '"');
      const oldQty = existing.qty || 1, newQty = parseInt(p.qty) || 1;
      if (oldQty !== newQty) changes.push('Qty: ' + oldQty + ' → ' + newQty);
      if ((existing.area || '') !== (p.area || '')) changes.push('Area: "' + (existing.area || '—') + '" → "' + (p.area || '—') + '"');
      if ((existing.dimensions || '') !== (p.dimensions || '')) changes.push('Dimensions changed');
      const oldFin = (existing.finishes || []).filter(Boolean).join(', '), newFin = (p.finishes || []).filter(Boolean).join(', ');
      if (oldFin !== newFin) changes.push('Finish changed');
      const oldUph = (existing.upholstery || []).filter(Boolean).join(', '), newUph = (p.upholstery || []).filter(Boolean).join(', ');
      if (oldUph !== newUph) changes.push('Upholstery changed');
      return changes;
    }

    const newItems = [], updatedItems = [], unchangedCount = { n: 0 };
    products.forEach(p => {
      if (!existingIds.has(p.id)) {
        newItems.push(p);
      } else {
        const changes = diffProduct(existingById[p.id], p);
        if (changes.length) updatedItems.push({ product: p, changes });
        else unchangedCount.n++;
      }
    });
    const currentIds = new Set(products.map(p => p.id));
    const removedItems = existingSnap.docs
      .filter(d => !currentIds.has(d.id) && !d.data().removed)
      .map(d => ({ id: d.id, name: d.data().name || 'Unnamed product' }));

    btn.disabled = false;
    btn.textContent = '🚀 Push to Ops';

    if (!newItems.length && !updatedItems.length && !removedItems.length) {
      if (statusEl) statusEl.textContent = 'Nothing has changed since the last push — already up to date.';
      return;
    }

    showPushConfirmModal(opsProjectId, newItems, updatedItems, removedItems, unchangedCount.n);
  } catch (e) {
    console.error('Push to Ops error:', e);
    btn.disabled = false;
    btn.textContent = '🚀 Push to Ops';
    if (statusEl) statusEl.textContent = "Couldn't check for changes: " + e.message;
  }
}

function showPushConfirmModal(opsProjectId, newItems, updatedItems, removedItems, unchangedCount) {
  let m = document.getElementById('push-confirm-modal');
  if (!m) {
    m = document.createElement('div');
    m.id = 'push-confirm-modal';
    m.style.cssText = 'position:fixed;inset:0;z-index:500;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:20px;';
    document.body.appendChild(m);
  }
  window._pendingPush = { opsProjectId, newItems, updatedItems, removedItems };

  let body = '';
  if (newItems.length) {
    body += '<div style="font-size:11px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:.04em;margin:12px 0 4px;">' + newItems.length + ' new item' + (newItems.length === 1 ? '' : 's') + '</div>';
    body += newItems.map(p => '<div style="padding:5px 0;font-size:13px;color:#1a1a18;">+ ' + esc(p.name || 'Unnamed product') + (p.qty > 1 ? ' ×' + p.qty : '') + '</div>').join('');
  }
  if (updatedItems.length) {
    body += '<div style="font-size:11px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:.04em;margin:12px 0 4px;">' + updatedItems.length + ' item' + (updatedItems.length === 1 ? '' : 's') + ' changed</div>';
    body += updatedItems.map(u => '<div style="padding:5px 0;border-bottom:1px solid #f0f0f0;"><div style="font-size:13px;font-weight:600;color:#1a1a18;">' + esc(u.product.name || 'Unnamed product') + '</div><div style="font-size:12px;color:#666;margin-top:2px;">' + u.changes.map(esc).join(' · ') + '</div></div>').join('');
  }
  if (removedItems.length) {
    body += '<div style="font-size:11px;font-weight:600;color:#c0392b;text-transform:uppercase;letter-spacing:.04em;margin:12px 0 4px;">' + removedItems.length + ' item' + (removedItems.length === 1 ? '' : 's') + ' no longer in this listing</div>';
    body += removedItems.map(r => '<div style="padding:5px 0;font-size:13px;color:#c0392b;">− ' + esc(r.name) + '</div>').join('');
    body += '<div style="font-size:11.5px;color:#888;margin-top:4px;">These will be flagged as removed in Ops and moved out of active production.</div>';
  }
  if (unchangedCount) {
    body += '<div style="font-size:12px;color:#999;margin-top:12px;">' + unchangedCount + ' item' + (unchangedCount === 1 ? '' : 's') + ' unchanged.</div>';
  }

  m.innerHTML = '<div style="background:#fff;border-radius:10px;max-width:480px;width:100%;max-height:80vh;overflow-y:auto;padding:22px 24px;">' +
    '<div style="font-size:17px;font-weight:700;color:#1a1a18;margin-bottom:4px;">Review before pushing</div>' +
    '<div style="font-size:12.5px;color:#888;">Here\'s what will be updated in Ops.</div>' +
    body +
    '<div style="display:flex;gap:8px;margin-top:20px;justify-content:flex-end;">' +
      '<button class="btn" onclick="closePushConfirmModal()" style="background:#f0f0f0;color:#1a1a18;">Cancel</button>' +
      '<button class="btn" id="confirm-push-btn" onclick="confirmPushToOps()" style="background:#b89a6a;color:#1a1a18;font-weight:600;">Confirm & Push</button>' +
    '</div>' +
  '</div>';
  m.style.display = 'flex';
}

window.closePushConfirmModal = function() {
  const m = document.getElementById('push-confirm-modal');
  if (m) m.style.display = 'none';
};

window.confirmPushToOps = async function() {
  const pending = window._pendingPush;
  if (!pending) return;
  const { opsProjectId, newItems, updatedItems, removedItems } = pending;
  const btn = document.getElementById('confirm-push-btn');
  const statusEl = document.getElementById('ops-push-status');
  btn.disabled = true;
  btn.textContent = 'Pushing…';

  try {
    const { doc, collection, writeBatch, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js');

    const toPush = newItems.concat(updatedItems.map(u => u.product));
    const thumbnails = {};
    await Promise.all(toPush.map(async p => {
      const source = p.annotatedImage || p.productImage || null;
      if (!source) return;
      try { thumbnails[p.id] = await compressForOpsThumbnail(source); }
      catch (e) {}
    }));

    const batch = writeBatch(opsDb);
    const newIds = new Set(newItems.map(p => p.id));

    toPush.forEach(p => {
      const itemRef = doc(collection(opsDb, 'projects', opsProjectId, 'items'), p.id);
      const data = {
        productNo:    p.productNo || '',
        name:         p.name || 'Unnamed product',
        qty:          parseInt(p.qty) || 1,
        area:         p.area || '',
        dimensions:   p.dimensions || '',
        details:      p.details || '',
        finishes:     (p.finishes || []).filter(Boolean),
        upholstery:   (p.upholstery || []).filter(Boolean),
        thumbnail:    thumbnails[p.id] || null,
        pushedAt:     serverTimestamp(),
        pushedFrom:   'factory-listing-tool',
        listingProjectId: currentProjectId,
      };
      if (newIds.has(p.id)) {
        data.carpentryStatus  = 'pending';
        data.polishStatus     = 'pending';
        data.upholsteryStatus = 'pending';
        data.packingStatus    = 'pending';
        data.overallStatus    = 'Structure';
      }
      batch.set(itemRef, data, { merge: true });
    });

    removedItems.forEach(r => {
      batch.set(doc(collection(opsDb, 'projects', opsProjectId, 'items'), r.id), {
        removed: true,
        removedAt: serverTimestamp(),
        removedFrom: 'factory-listing-tool',
      }, { merge: true });
    });

    await batch.commit();

    closePushConfirmModal();
    const mainBtn = document.getElementById('push-ops-btn');
    mainBtn.textContent = '✓ Pushed!';
    mainBtn.style.background = '#27ae60';
    if (statusEl) statusEl.textContent = `✓ ${newItems.length} new, ${updatedItems.length} updated${removedItems.length ? `, ${removedItems.length} removed` : ''} — pushed to Ops.`;
    setTimeout(() => {
      mainBtn.disabled = false;
      mainBtn.textContent = '🚀 Push to Ops';
      mainBtn.style.background = '#b89a6a';
    }, 3000);
  } catch (e) {
    console.error('Confirm push error:', e);
    if (statusEl) statusEl.textContent = '✗ Push failed: ' + e.message;
    closePushConfirmModal();
    const mainBtn = document.getElementById('push-ops-btn');
    mainBtn.disabled = false;
    mainBtn.textContent = '🚀 Push to Ops';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Confirm & Push';
  }
};
