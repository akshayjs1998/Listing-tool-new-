// Lyffin Listing Tool - Main Application Controller
var deferredPrompt = null;

// Service Worker & PWA Install
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.log('Service Worker registration skipped:', err);
    });
  });
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const bar = document.getElementById('install-bar');
  if (bar) bar.style.display = 'block';
});

const installBtn = document.getElementById('install-btn');
if (installBtn) {
  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    const bar = document.getElementById('install-bar');
    if (bar) bar.style.display = 'none';
  });
}

// Global Keyboard Shortcuts
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    if (typeof currentProjectId !== 'undefined' && currentProjectId) {
      if (typeof saveCurrentProject === 'function') {
        saveCurrentProject();
        if (typeof showToast === 'function') showToast('Project saved');
      }
    }
  }
});

// App Startup
async function initApp() {
  try {
    if (typeof window.initDB === 'function') {
      await window.initDB();
    } else if (typeof initDB === 'function') {
      await initDB();
    } else if (typeof openDB === 'function') {
      await openDB();
    }
    const rows = await dbGetAll();
    allProjects = {};
    rows.forEach(p => {
      if (p && p.id) allProjects[p.id] = p;
    });

    if (typeof renderHome === 'function') {
      renderHome();
    }
  } catch (err) {
    console.error('App initialization error:', err);
    const mainEl = document.getElementById('main');
    if (mainEl) {
      mainEl.innerHTML = `
        <div class="panel" style="text-align:center;padding:2rem;">
          <div style="font-size:16px;font-weight:600;margin-bottom:8px;color:var(--danger-text);">Storage Notice</div>
          <div style="font-size:13px;color:var(--text2);margin-bottom:1rem;">Could not initialize local database: ${err && err.message ? err.message : err}</div>
          <button class="btn primary" onclick="location.reload()">Reload</button>
        </div>
      `;
    }
  }
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
