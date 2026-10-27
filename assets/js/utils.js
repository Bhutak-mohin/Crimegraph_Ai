/* ============================================================
   CrimeGraph AI — Shared Utilities
   ============================================================ */

/* ── Toast ────────────────────────────────────────────────── */
let _toastTimer;
function showToast(msg, type='info') {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className = '';
  t.classList.add('show');
  if (type==='error')   t.style.borderColor = 'var(--risk-high)';
  else if (type==='ok') t.style.borderColor = 'var(--risk-low)';
  else                  t.style.borderColor = '';
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

/* ── Active Nav ───────────────────────────────────────────── */
function setActiveNav() {
  const page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-item').forEach(el => {
    const href = el.getAttribute('href') || '';
    const match = href.includes(page) || (page === 'dashboard.html' && href.includes('dashboard'));
    el.classList.toggle('active', match);
  });
}

/* ── Sidebar Builder ──────────────────────────────────────── */
function buildSidebar(currentPage) {
  const page = currentPage || (location.pathname.split('/').pop() || 'dashboard.html');
  const nav = [
    { href:'dashboard.html', icon:`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`, label:'Live Console', badge:null },
    { href:'cases.html',     icon:`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>`, label:'Cases', badge:'6' },
    { href:'reports.html',   icon:`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`, label:'Reports', badge:null },
  ];
  return `
  <div class="sidebar">
    <div class="sidebar-logo">
      <div class="mark">CG</div>
      <div class="brand-text">
        <div class="brand-name">CrimeGraph AI</div>
        <div class="brand-sub">Investigator Console</div>
      </div>
    </div>
    <nav class="sidebar-nav">
      <div class="nav-section-label">Investigation</div>
      ${nav.map(n=>`
        <a href="${n.href}" class="nav-item${page===n.href?' active':''}">
          ${n.icon}
          <span>${n.label}</span>
          ${n.badge?`<span class="nav-badge">${n.badge}</span>`:''}
        </a>`).join('')}
      <div class="nav-section-label" style="margin-top:10px">System</div>
      <a href="javascript:void(0)" class="nav-item" id="sidebar-settings-btn" onclick="openSettingsModal()">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93A10 10 0 1 0 4.93 19.07 10 10 0 0 0 19.07 4.93z"/></svg>
        Settings &amp; Diagnostics
      </a>
      <a href="javascript:void(0)" class="nav-item" onclick="openNlpIngestModal()">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        Ingest Case Data
      </a>
      <a href="index.html" class="nav-item">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        Sign Out
      </a>
    </nav>
    <div class="sidebar-footer">
      <div class="analyst-chip">
        <div class="analyst-avatar">IM</div>
        <div class="analyst-info">
          <div class="analyst-name">Insp. Mehra</div>
          <div class="analyst-role">Senior Analyst · MH-Cyber</div>
        </div>
      </div>
    </div>
  </div>`;
}

/* ── Topbar Builder ───────────────────────────────────────── */
function buildTopbar(title, searchId='topbar-search', extraRight='') {
  return `
  <div class="topbar">
    <span class="topbar-title">${title}</span>
    <div class="topbar-search">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input id="${searchId}" type="text" placeholder="Search entity, case or FIR no...">
    </div>
    <div class="topbar-right">
      <div class="badge badge-live" style="padding:5px 10px">
        <span class="dot dot-live"></span> Live
      </div>
      <div class="badge badge-muted">Sample Dataset · 24 Entities</div>
      ${extraRight}
      <div class="icon-btn" title="Notifications" onclick="showToast('No new alerts')">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
      </div>
    </div>
  </div>`;
}

/* ── Format Date ──────────────────────────────────────────── */
function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'});
}

/* ── Number animate ───────────────────────────────────────── */
function animateNum(el, to, dur=800) {
  const from = 0;
  const start = performance.now();
  const update = t => {
    const p = Math.min((t-start)/dur, 1);
    const ease = 1 - Math.pow(1-p, 3);
    el.textContent = Math.round(from + (to-from)*ease);
    if (p < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}

/* ── Copy to clipboard ────────────────────────────────────── */
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(()=>showToast('Copied to clipboard','ok')).catch(()=>showToast('Copy failed','error'));
}

/* ── Settings Modal ───────────────────────────────────────── */
function openSettingsModal() {
  let overlay = document.getElementById('settings-modal-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'settings-modal-overlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
    <div class="modal" style="max-width:580px">
      <div class="modal-head">
        <h2>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93A10 10 0 1 0 4.93 19.07 10 10 0 0 0 19.07 4.93z"/></svg>
          System Diagnostics &amp; Settings
        </h2>
        <button class="icon-btn" onclick="closeSettingsModal()" title="Close">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="modal-body">
        <div>
          <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px">Connected Subsystems</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div style="padding:10px;background:var(--panel-2);border:1px solid var(--line);border-radius:var(--radius)">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
                <span style="font-size:12px;font-weight:600">Neo4j Graph Engine</span>
                <span class="badge badge-low" style="font-size:10px">Online</span>
              </div>
              <div style="font-size:11px;color:var(--text-dim)">bolt://localhost:7687 · 24 nodes</div>
            </div>
            <div style="padding:10px;background:var(--panel-2);border:1px solid var(--line);border-radius:var(--radius)">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
                <span style="font-size:12px;font-weight:600">GraphSAGE GNN</span>
                <span class="badge badge-low" style="font-size:10px">Active</span>
              </div>
              <div style="font-size:11px;color:var(--text-dim)">Accuracy: 94.2% · Latency 38ms</div>
            </div>
            <div style="padding:10px;background:var(--panel-2);border:1px solid var(--line);border-radius:var(--radius)">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
                <span style="font-size:12px;font-weight:600">CCTNS Kafka Pipe</span>
                <span class="badge badge-low" style="font-size:10px">Synced</span>
              </div>
              <div style="font-size:11px;color:var(--text-dim)">Last ingestion: 2 mins ago</div>
            </div>
            <div style="padding:10px;background:var(--panel-2);border:1px solid var(--line);border-radius:var(--radius)">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
                <span style="font-size:12px;font-weight:600">Legal-NLP Extractor</span>
                <span class="badge badge-low" style="font-size:10px">Ready</span>
              </div>
              <div style="font-size:11px;color:var(--text-dim)">spaCy + RoBERTa fine-tuned</div>
            </div>
          </div>
        </div>

        <div style="border-top:1px solid var(--line);padding-top:14px">
          <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.4px;margin-bottom:10px">Model Parameters</div>
          <div style="margin-bottom:12px">
            <label style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px">
              <span>Link Prediction Sensitivity</span>
              <span id="cfg-threshold-val" style="font-family:var(--mono);color:var(--accent)">0.75 (Balanced)</span>
            </label>
            <input type="range" class="field" style="padding:0;accent-color:var(--accent)" min="50" max="95" value="75" id="cfg-threshold" oninput="document.getElementById('cfg-threshold-val').textContent=(this.value/100)+' ('+(this.value>85?'Strict':this.value>70?'Balanced':'High Sensitivity')+')'">
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0">
            <div>
              <div style="font-size:12.5px;font-weight:500">BNSS / DPDP Anonymisation Mode</div>
              <div style="font-size:11px;color:var(--text-dim)">Mask Aadhaar, phone numbers and exact addresses in evidence exports</div>
            </div>
            <input type="checkbox" id="cfg-anon" checked style="accent-color:var(--accent);width:16px;height:16px">
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0">
            <div>
              <div style="font-size:12.5px;font-weight:500">Live Cluster Alert Notifications</div>
              <div style="font-size:11px;color:var(--text-dim)">Pop up high-priority alerts when cross-state gang links emerge</div>
            </div>
            <input type="checkbox" id="cfg-alerts" checked style="accent-color:var(--accent);width:16px;height:16px">
          </div>
        </div>

        <div style="display:flex;gap:8px;margin-top:10px">
          <button class="btn btn-sm w-full" onclick="saveSettings()">Save Configuration</button>
          <button class="btn ghost btn-sm" onclick="closeSettingsModal()">Cancel</button>
        </div>
      </div>
    </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeSettingsModal(); });
  }
  overlay.classList.add('show');
}

function closeSettingsModal() {
  const overlay = document.getElementById('settings-modal-overlay');
  if (overlay) overlay.classList.remove('show');
}

function saveSettings() {
  closeSettingsModal();
  showToast('Settings & model parameters successfully applied', 'ok');
}

/* ── NLP Data Ingestion Modal ─────────────────────────────── */
function openNlpIngestModal() {
  let overlay = document.getElementById('nlp-modal-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'nlp-modal-overlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
    <div class="modal" style="max-width:620px">
      <div class="modal-head">
        <h2>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          Multi-Source NLP Entity Extraction
        </h2>
        <button class="icon-btn" onclick="closeNlpIngestModal()" title="Close">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="modal-body">
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <span style="font-size:12px;font-weight:600">Sample FIR / Case Diary Input</span>
            <div style="display:flex;gap:4px">
              <button class="mini-btn" onclick="loadSampleFir(1)">Preset: Thane Dock</button>
              <button class="mini-btn" onclick="loadSampleFir(2)">Preset: Cyber Phishing</button>
            </div>
          </div>
          <textarea class="field" id="nlp-input" rows="4" style="resize:vertical;font-size:12.5px;line-height:1.5" placeholder="Paste unstructured FIR report, CCTNS narrative, or interrogation diary text here..."></textarea>
        </div>

        <button class="btn btn-sm" id="nlp-run-btn" onclick="runNlpExtraction()">⚡ Run AI Entity Resolution &amp; Linking</button>

        <div id="nlp-results" style="display:none;margin-top:4px">
          <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">Extracted Entities &amp; Identified Graph Links</div>
          <div id="nlp-entities-box" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px"></div>
          <div id="nlp-links-box" style="padding:10px;background:var(--panel-2);border:1px solid var(--line);border-radius:var(--radius);font-size:12px"></div>
          <div style="margin-top:14px;display:flex;gap:8px">
            <button class="btn btn-sm" style="flex:1" onclick="commitNlpIngest()">Ingest &amp; Update Live Knowledge Graph</button>
            <button class="btn ghost btn-sm" onclick="closeNlpIngestModal()">Close</button>
          </div>
        </div>
      </div>
    </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeNlpIngestModal(); });
  }
  overlay.classList.add('show');
  loadSampleFir(1);
}

function closeNlpIngestModal() {
  const overlay = document.getElementById('nlp-modal-overlay');
  if (overlay) overlay.classList.remove('show');
}

function loadSampleFir(num) {
  const box = document.getElementById('nlp-input');
  if (num === 1) {
    box.value = "Thane Crime Branch Report FIR 882/2024: Confidential informant confirms Vikram S. ('Bhaiya') met with Imran W. ('Wolf') near Dockyard Gate 3 to coordinate contraband movement via truck MH-04 AB 7791. Consignment is financed through Nexus Logistics accounts.";
  } else {
    box.value = "Cyber Cell Special Report DL/2024/991: Interrogation of Sameer Q. revealed active WhatsApp and VoIP communication with Farhan T. routing mule accounts through Orbit Traders Pvt Ltd across Delhi NCR and Maharashtra.";
  }
  document.getElementById('nlp-results').style.display = 'none';
}

function runNlpExtraction() {
  const text = document.getElementById('nlp-input').value.trim();
  if (!text) { showToast('Please enter or select FIR text', 'error'); return; }
  const btn = document.getElementById('nlp-run-btn');
  btn.textContent = 'Processing with spaCy + Legal-RoBERTa…';
  btn.disabled = true;

  setTimeout(() => {
    btn.textContent = '⚡ Run AI Entity Resolution & Linking';
    btn.disabled = false;
    document.getElementById('nlp-results').style.display = 'block';

    const entBox = document.getElementById('nlp-entities-box');
    const linksBox = document.getElementById('nlp-links-box');

    if (text.includes('Vikram S.')) {
      entBox.innerHTML = `
        <span class="chip active" style="font-size:11px">👤 Vikram S. (PERSON · 99%)</span>
        <span class="chip active" style="font-size:11px">👤 Imran W. (PERSON · 98%)</span>
        <span class="chip active" style="font-size:11px">📍 Dockyard Gate 3 (LOC · 96%)</span>
        <span class="chip active" style="font-size:11px">🚚 MH-04 AB 7791 (VEHICLE · 97%)</span>
        <span class="chip active" style="font-size:11px">🏢 Nexus Logistics (ORG · 94%)</span>
      `;
      linksBox.innerHTML = `
        <div style="font-weight:600;margin-bottom:6px;color:var(--accent)">Cross-Jurisdiction Connections Detected:</div>
        <div>🔗 <strong>Vikram S.</strong> (Cluster 0, MH) ↔ <strong>Imran W.</strong> (Cluster 2, KA) via Dockyard Gate 3 [High-Confidence Bridge Link]</div>
        <div style="margin-top:4px">🔗 <strong>Nexus Logistics</strong> identified as corporate financial vehicle for consignment transport</div>
      `;
    } else {
      entBox.innerHTML = `
        <span class="chip active" style="font-size:11px">👤 Sameer Q. (PERSON · 99%)</span>
        <span class="chip active" style="font-size:11px">👤 Farhan T. (PERSON · 97%)</span>
        <span class="chip active" style="font-size:11px">🏢 Orbit Traders Pvt Ltd (ORG · 98%)</span>
        <span class="chip active" style="font-size:11px">📍 Delhi NCR (LOC · 95%)</span>
      `;
      linksBox.innerHTML = `
        <div style="font-weight:600;margin-bottom:6px;color:var(--accent)">Cyber Mule Syndicate Path Detected:</div>
        <div>🔗 <strong>Sameer Q.</strong> ↔ <strong>Farhan T.</strong> ↔ <strong>Orbit Traders Pvt Ltd</strong> [Layered Money Laundering Hub]</div>
      `;
    }
    showToast('NLP Entity Resolution completed with 96% confidence', 'ok');
  }, 700);
}

function commitNlpIngest() {
  closeNlpIngestModal();
  showToast('Entities and relationships ingested into knowledge graph!', 'ok');
  if (typeof sim !== 'undefined') {
    sim.alpha(0.4).restart();
  }
}
