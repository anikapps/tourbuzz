/* ==========================================================================
   TourBuzz Travel Management System — Core Engine, Team Collaboration & Sync
   Layer 1: localStorage + Outbox | Layer 2: GitHub API v3 | Layer 3: Sheets
   ========================================================================== */

(function () {
  'use strict';

  const TB = {};

  /* ------------------------------------------------------------------------
     Utilities: Formatting, Escaping, Desk-Code IDs, Amount in Words, Toasts
     ------------------------------------------------------------------------ */
  TB.escapeHtml = function (str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  TB.toNumber = function (val) {
    const n = parseFloat(val);
    return Number.isFinite(n) ? n : 0;
  };

  TB.getCurrency = function (code) {
    const list = (window.CONFIG && window.CONFIG.CURRENCIES) || [];
    return list.find(c => c.code === code) || { code: code || 'BDT', symbol: (code || 'BDT') + ' ', name: code || 'BDT', minor: 'Cents' };
  };

  TB.formatMoney = function (amount, currencyCode = 'BDT') {
    const num = TB.toNumber(amount);
    const formatted = num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${currencyCode} ${formatted}`;
  };

  TB.todayISO = function () {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  TB.formatDate = function (isoStr) {
    if (!isoStr) return '—';
    const d = new Date(isoStr.length === 10 ? isoStr + 'T00:00:00' : isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  TB.calcNights = function (checkIn, checkOut) {
    if (!checkIn || !checkOut) return 0;
    const d1 = new Date(checkIn + 'T00:00:00');
    const d2 = new Date(checkOut + 'T00:00:00');
    const diff = Math.round((d2 - d1) / 86400000);
    return diff > 0 ? diff : 0;
  };

  TB.getStaffName = function () {
    return (CONFIG.STAFF && CONFIG.STAFF.NAME && CONFIG.STAFF.NAME.trim()) || 'TourBuzz Staff';
  };

  TB.getDeskCode = function () {
    const raw = (CONFIG.STAFF && CONFIG.STAFF.DESK_CODE) || '';
    return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
  };

  // Zero-collision numbering: TB-INV-202611-AN-0001 (when Desk Code is set) or TB-INV-202611-0001
  TB.generateDocNumber = function (type) {
    const meta = CONFIG.DOC_TYPES[type] || { prefix: 'TB-DOC' };
    const now = new Date();
    const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const desk = TB.getDeskCode();
    const basePrefix = desk ? `${meta.prefix}-${ym}-${desk}-` : `${meta.prefix}-${ym}-`;

    const existing = TB.getAllDocs().filter(d => d.type === type && String(d.docNo || '').startsWith(basePrefix));
    let maxSeq = 0;
    existing.forEach(d => {
      const parts = String(d.docNo).split('-');
      const seq = parseInt(parts[parts.length - 1], 10);
      if (Number.isFinite(seq) && seq > maxSeq) maxSeq = seq;
    });
    return `${basePrefix}${String(maxSeq + 1).padStart(4, '0')}`;
  };

  TB.amountToWords = function (amount, currencyCode = 'BDT') {
    const cur = TB.getCurrency(currencyCode);
    const num = Math.abs(TB.toNumber(amount));
    const whole = Math.floor(num);
    const frac = Math.round((num - whole) * 100);

    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
      'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const scales = ['', 'Thousand', 'Million', 'Billion', 'Trillion'];

    function chunkToWords(n) {
      let str = '';
      if (n >= 100) {
        str += ones[Math.floor(n / 100)] + ' Hundred';
        n %= 100;
        if (n > 0) str += ' ';
      }
      if (n >= 20) {
        str += tens[Math.floor(n / 10)];
        n %= 10;
        if (n > 0) str += ' ' + ones[n];
      } else if (n > 0) {
        str += ones[n];
      }
      return str;
    }

    function intToWords(n) {
      if (n === 0) return 'Zero';
      const parts = [];
      let scaleIdx = 0;
      while (n > 0 && scaleIdx < scales.length) {
        const chunk = n % 1000;
        if (chunk > 0) {
          const w = chunkToWords(chunk);
          parts.unshift(scales[scaleIdx] ? `${w} ${scales[scaleIdx]}` : w);
        }
        n = Math.floor(n / 1000);
        scaleIdx++;
      }
      return parts.join(' ');
    }

    let result = `${cur.name} ${intToWords(whole)}`;
    if (frac > 0) result += ` and ${intToWords(frac)} ${cur.minor}`;
    return result + ' Only';
  };

  TB.toast = function (message, type = 'info') {
    let container = document.getElementById('tb-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'tb-toast-container';
      container.className = 'toast-container no-print';
      document.body.appendChild(container);
    }
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(8px)';
      el.style.transition = 'all 0.2s ease';
      setTimeout(() => el.remove(), 220);
    }, 3600);
  };

  /* ------------------------------------------------------------------------
     Theme Management
     ------------------------------------------------------------------------ */
  TB.initTheme = function () {
    const saved = localStorage.getItem(CONFIG.STORAGE_KEYS.THEME) || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    return saved;
  };

  TB.toggleTheme = function () {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(CONFIG.STORAGE_KEYS.THEME, next);
    const btn = document.getElementById('tb-theme-toggle');
    if (btn) btn.innerHTML = next === 'dark' ? '☀️ Light' : '🌙 Dark';
    return next;
  };

  /* ------------------------------------------------------------------------
     Layer 1: Local Vault, Offline Outbox Queue & Shared Client Directory
     ------------------------------------------------------------------------ */
  TB.getAllDocs = function () {
    try {
      const raw = localStorage.getItem(CONFIG.STORAGE_KEYS.DOCS);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)) : [];
    } catch (e) {
      return [];
    }
  };

  TB.saveAllDocs = function (docs) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.DOCS, JSON.stringify(docs));
  };

  TB.getDoc = function (docNo) {
    return TB.getAllDocs().find(d => d.docNo === docNo) || null;
  };

  TB.saveLocalDoc = function (doc) {
    const docs = TB.getAllDocs();
    const now = new Date().toISOString();
    const staffName = TB.getStaffName();
    const deskCode = TB.getDeskCode();
    const idx = docs.findIndex(d => d.docNo === doc.docNo);
    const existing = idx >= 0 ? docs[idx] : null;
    const record = {
      ...existing,
      ...doc,
      createdBy: (existing && existing.createdBy) || doc.createdBy || staffName,
      updatedBy: doc.updatedBy || staffName,
      deskCode: deskCode || (existing && existing.deskCode) || '',
      createdAt: (existing && existing.createdAt) || doc.createdAt || now,
      updatedAt: now
    };
    if (idx >= 0) docs[idx] = record;
    else docs.unshift(record);
    TB.saveAllDocs(docs);
    TB.learnClientFromDoc(record);
    return record;
  };

  TB.deleteLocalDoc = function (docNo) {
    const docs = TB.getAllDocs().filter(d => d.docNo !== docNo);
    TB.saveAllDocs(docs);
    TB.removeFromOutbox(docNo);
  };

  /* Offline Outbox Queue */
  TB.getOutbox = function () {
    try {
      const raw = localStorage.getItem(CONFIG.STORAGE_KEYS.OUTBOX);
      return raw ? JSON.parse(raw) : [];
    } catch (_) { return []; }
  };

  TB.addToOutbox = function (docNo) {
    if (!docNo) return;
    const q = TB.getOutbox();
    if (!q.includes(docNo)) {
      q.push(docNo);
      localStorage.setItem(CONFIG.STORAGE_KEYS.OUTBOX, JSON.stringify(q));
    }
    TB.refreshSyncPillDefault();
  };

  TB.removeFromOutbox = function (docNo) {
    const q = TB.getOutbox().filter(id => id !== docNo);
    localStorage.setItem(CONFIG.STORAGE_KEYS.OUTBOX, JSON.stringify(q));
    TB.refreshSyncPillDefault();
  };

  /* Shared Client & Passenger Directory */
  TB.getClients = function () {
    try {
      const raw = localStorage.getItem(CONFIG.STORAGE_KEYS.CLIENTS);
      return raw ? JSON.parse(raw) : [];
    } catch (_) { return []; }
  };

  TB.saveClients = function (list) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.CLIENTS, JSON.stringify(list));
  };

  TB.learnClientFromDoc = function (doc) {
    const name = (doc && doc.clientName || '').trim();
    if (!name || name.length < 2 || name.toUpperCase() === 'PASSENGER') return;
    const clients = TB.getClients();
    const key = name.toLowerCase();
    const idx = clients.findIndex(c => c.name.toLowerCase() === key);
    const prev = idx >= 0 ? clients[idx] : {};
    const entry = {
      name,
      company: doc.clientCompany || prev.company || '',
      phone: doc.clientPhone || doc.guestPhone || prev.phone || '',
      email: doc.clientEmail || prev.email || '',
      address: doc.clientAddress || prev.address || '',
      passportNo: doc.passportNo || prev.passportNo || '',
      nationality: doc.nationality || prev.nationality || '',
      updatedAt: new Date().toISOString()
    };
    if (idx >= 0) clients[idx] = entry;
    else clients.unshift(entry);
    TB.saveClients(clients.slice(0, 500));
  };

  TB.rebuildClientsFromDocs = function () {
    const docs = TB.getAllDocs();
    docs.forEach(d => TB.learnClientFromDoc(d));
    return TB.getClients().length;
  };

  TB.mergeClients = function (localList, remoteList) {
    const map = new Map();
    [...(localList || []), ...(remoteList || [])].forEach(c => {
      if (!c || !c.name) return;
      const k = c.name.toLowerCase();
      const prev = map.get(k);
      if (!prev || new Date(c.updatedAt || 0) >= new Date(prev.updatedAt || 0)) {
        map.set(k, { ...prev, ...c });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  };

  TB.exportBackupJSON = function () {
    const payload = {
      app: 'TourBuzz Travel Management System',
      company: CONFIG.COMPANY.NAME,
      exportedAt: new Date().toISOString(),
      count: TB.getAllDocs().length,
      documents: TB.getAllDocs(),
      clients: TB.getClients()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TourBuzz_TMS_Backup_${TB.todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  TB.importBackupJSON = function (jsonText) {
    const parsed = JSON.parse(jsonText);
    const incoming = Array.isArray(parsed) ? parsed : (parsed.documents || []);
    if (!Array.isArray(incoming)) throw new Error('Invalid backup format');
    const merged = TB.mergeRecords(TB.getAllDocs(), incoming);
    TB.saveAllDocs(merged);
    if (Array.isArray(parsed.clients)) {
      TB.saveClients(TB.mergeClients(TB.getClients(), parsed.clients));
    }
    return incoming.length;
  };

  TB.mergeRecords = function (localList, remoteList) {
    const map = new Map();
    localList.forEach(d => { if (d && d.docNo) map.set(d.docNo, d); });
    remoteList.forEach(r => {
      if (!r || !r.docNo) return;
      const existing = map.get(r.docNo);
      if (!existing) {
        map.set(r.docNo, r);
      } else {
        const tLocal = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
        const tRemote = new Date(r.updatedAt || r.createdAt || 0).getTime();
        if (tRemote >= tLocal) {
          map.set(r.docNo, { ...existing, ...r, githubSha: r.githubSha || existing.githubSha, cloudSynced: true });
        } else {
          map.set(r.docNo, { ...existing, githubSha: r.githubSha || existing.githubSha });
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
  };

  /* ------------------------------------------------------------------------
     Layer 2: GitHub Contents API v3 (Conflict Guard, Outbox, Cloud Delete, Clients)
     ------------------------------------------------------------------------ */
  TB.isGitHubConfigured = function () {
    return Boolean(CONFIG.GITHUB_OWNER && CONFIG.GITHUB_REPO && CONFIG.GITHUB_TOKEN);
  };

  TB.isSheetsConfigured = function () {
    return Boolean(CONFIG.APPS_SCRIPT_URL && CONFIG.APPS_SCRIPT_URL.trim().startsWith('http'));
  };

  TB.getGitHubPath = function (doc) {
    const meta = CONFIG.DOC_TYPES[doc.type] || { folder: 'Other' };
    const refDate = new Date(doc.date || doc.createdAt || Date.now());
    const yyyy = isNaN(refDate.getTime()) ? new Date().getFullYear() : refDate.getFullYear();
    const mm = String((isNaN(refDate.getTime()) ? new Date().getMonth() : refDate.getMonth()) + 1).padStart(2, '0');
    const safeNo = String(doc.docNo || 'UNNAMED').replace(/[^a-zA-Z0-9_-]/g, '_');
    return `Documents/${meta.folder}/${yyyy}/${mm}/${safeNo}.json`;
  };

  function utf8ToBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    bytes.forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin);
  }

  function base64ToUtf8(b64) {
    const clean = b64.replace(/\s/g, '');
    const bin = atob(clean);
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  function ghHeaders() {
    return {
      'Authorization': `Bearer ${CONFIG.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json'
    };
  }

  TB.pushToGitHub = async function (doc, opts = {}) {
    if (!TB.isGitHubConfigured()) return { ok: false, skipped: true, reason: 'GitHub not configured' };

    const path = doc.githubPath || TB.getGitHubPath(doc);
    const branch = CONFIG.GITHUB_BRANCH || 'main';
    const baseUrl = `https://api.github.com/repos/${encodeURIComponent(CONFIG.GITHUB_OWNER)}/${encodeURIComponent(CONFIG.GITHUB_REPO)}/contents/${path}`;

    TB.updateSyncPill('syncing', 'Syncing to GitHub...');

    let sha = doc.githubSha || undefined;
    try {
      const checkResp = await fetch(`${baseUrl}?ref=${encodeURIComponent(branch)}`, { headers: ghHeaders() });
      if (checkResp.ok) {
        const existingMeta = await checkResp.json();
        if (existingMeta && existingMeta.sha) {
          sha = existingMeta.sha;
          // Smart Conflict Guard: warn if teammate modified this doc after we opened it
          if (!opts.force && doc._loadedAt && existingMeta.content) {
            try {
              const remoteDoc = JSON.parse(base64ToUtf8(existingMeta.content));
              const remoteTs = new Date(remoteDoc.updatedAt || 0).getTime();
              const loadedTs = new Date(doc._loadedAt).getTime();
              if (remoteTs > loadedTs + 2000 && remoteDoc.updatedBy && remoteDoc.updatedBy !== TB.getStaffName()) {
                const proceed = confirm(
                  `Conflict Warning for ${doc.docNo}:\n\n` +
                  `Teammate "${remoteDoc.updatedBy}" updated this document at ${new Date(remoteDoc.updatedAt).toLocaleString()} after you opened it.\n\n` +
                  `Click OK to overwrite with your version, or Cancel to keep your copy locally and pull theirs first.`
                );
                if (!proceed) {
                  TB.refreshSyncPillDefault();
                  return { ok: false, conflictAborted: true };
                }
              }
            } catch (_) {}
          }
        }
      }
    } catch (_) {}

    const cleanPayload = { ...doc, githubPath: path, cloudSynced: true, lastSyncedAt: new Date().toISOString() };
    delete cleanPayload._loadedAt;

    const body = {
      message: `TourBuzz TMS (${TB.getStaffName()}): Save ${doc.docNo} (${doc.clientName || doc.type})`,
      content: utf8ToBase64(JSON.stringify(cleanPayload, null, 2)),
      branch
    };
    if (sha) body.sha = sha;

    const putResp = await fetch(baseUrl, { method: 'PUT', headers: ghHeaders(), body: JSON.stringify(body) });
    if (!putResp.ok) {
      const errText = await putResp.text();
      TB.addToOutbox(doc.docNo);
      TB.updateSyncPill('error', 'Queued Offline · Retry Ready');
      throw new Error(`GitHub PUT ${putResp.status}: ${errText.slice(0, 160)}`);
    }

    const putData = await putResp.json();
    const newSha = putData && putData.content && putData.content.sha;
    TB.saveLocalDoc({ ...cleanPayload, githubSha: newSha || sha, githubPath: path, cloudSynced: true });
    TB.removeFromOutbox(doc.docNo);
    localStorage.setItem(CONFIG.STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
    TB.refreshSyncPillDefault();
    return { ok: true, sha: newSha, path };
  };

  /* Cloud-Synced Delete on GitHub */
  TB.deleteDocWithCloud = async function (docNo, deleteFromCloud = false) {
    const doc = TB.getDoc(docNo);
    TB.deleteLocalDoc(docNo);

    if (deleteFromCloud && doc && TB.isSheetsConfigured()) {
      TB.pushToGoogleSheets({ action: 'delete', type: doc.type, docNo: doc.docNo });
    }
    if (deleteFromCloud && doc && TB.isGitHubConfigured()) {
      const path = doc.githubPath || TB.getGitHubPath(doc);
      const branch = CONFIG.GITHUB_BRANCH || 'main';
      const baseUrl = `https://api.github.com/repos/${encodeURIComponent(CONFIG.GITHUB_OWNER)}/${encodeURIComponent(CONFIG.GITHUB_REPO)}/contents/${path}`;
      try {
        let sha = doc.githubSha;
        const checkResp = await fetch(`${baseUrl}?ref=${encodeURIComponent(branch)}`, { headers: ghHeaders() });
        if (checkResp.ok) {
          const meta = await checkResp.json();
          sha = meta.sha || sha;
        }
        if (sha) {
          await fetch(baseUrl, {
            method: 'DELETE',
            headers: ghHeaders(),
            body: JSON.stringify({
              message: `TourBuzz TMS (${TB.getStaffName()}): Delete ${docNo}`,
              sha,
              branch
            })
          });
        }
      } catch (err) {
        console.warn('Cloud delete warning:', err);
      }
    }
  };

  /* Sync Shared Client Directory (Documents/_Directory/Clients.json) */
  TB.syncClientsToGitHub = async function () {
    if (!TB.isGitHubConfigured()) return;
    const path = 'Documents/_Directory/Clients.json';
    const branch = CONFIG.GITHUB_BRANCH || 'main';
    const url = `https://api.github.com/repos/${encodeURIComponent(CONFIG.GITHUB_OWNER)}/${encodeURIComponent(CONFIG.GITHUB_REPO)}/contents/${path}`;
    try {
      let sha;
      let merged = TB.getClients();
      const resp = await fetch(`${url}?ref=${encodeURIComponent(branch)}`, { headers: ghHeaders() });
      if (resp.ok) {
        const meta = await resp.json();
        sha = meta.sha;
        const remote = JSON.parse(base64ToUtf8(meta.content || ''));
        if (Array.isArray(remote)) merged = TB.mergeClients(merged, remote);
      }
      TB.saveClients(merged);
      const body = {
        message: `TourBuzz TMS (${TB.getStaffName()}): Sync Client Directory (${merged.length})`,
        content: utf8ToBase64(JSON.stringify(merged, null, 2)),
        branch
      };
      if (sha) body.sha = sha;
      await fetch(url, { method: 'PUT', headers: ghHeaders(), body: JSON.stringify(body) });
    } catch (_) {}
  };

  /* Flush Offline Outbox automatically on reconnect or Sync Now */
  TB.flushOutbox = async function (silent = true) {
    if (!TB.isGitHubConfigured() || !navigator.onLine) return 0;
    const queue = TB.getOutbox();
    if (!queue.length) return 0;
    let pushed = 0;
    for (const docNo of queue) {
      const doc = TB.getDoc(docNo);
      if (!doc) { TB.removeFromOutbox(docNo); continue; }
      try {
        const r = await TB.pushToGitHub(doc, { force: false });
        if (r.ok) pushed++;
      } catch (_) {}
    }
    if (pushed > 0 && !silent) TB.toast(`Pushed ${pushed} queued offline document(s) to GitHub.`, 'success');
    return pushed;
  };

  TB.pullFromGitHub = async function (silent = false) {
    if (!TB.isGitHubConfigured()) {
      TB.refreshSyncPillDefault();
      return { ok: false, skipped: true, count: 0 };
    }

    // Flush any queued offline saves first
    await TB.flushOutbox(true);

    TB.updateSyncPill('syncing', 'Pulling Cloud Vault...');
    const branch = CONFIG.GITHUB_BRANCH || 'main';
    const treeUrl = `https://api.github.com/repos/${encodeURIComponent(CONFIG.GITHUB_OWNER)}/${encodeURIComponent(CONFIG.GITHUB_REPO)}/git/trees/${encodeURIComponent(branch)}?recursive=1`;

    try {
      const treeResp = await fetch(treeUrl, { headers: ghHeaders() });
      if (!treeResp.ok) {
        if (treeResp.status === 404 || treeResp.status === 409) {
          TB.refreshSyncPillDefault();
          return { ok: true, count: 0 };
        }
        throw new Error(`GitHub Tree ${treeResp.status}`);
      }
      const treeData = await treeResp.json();
      const allNodes = treeData.tree || [];

      // Pull Shared Client Directory if present
      const clientsNode = allNodes.find(i => i.path === 'Documents/_Directory/Clients.json');
      if (clientsNode) {
        try {
          const cResp = await fetch(`https://api.github.com/repos/${encodeURIComponent(CONFIG.GITHUB_OWNER)}/${encodeURIComponent(CONFIG.GITHUB_REPO)}/git/blobs/${clientsNode.sha}`, { headers: ghHeaders() });
          if (cResp.ok) {
            const cBlob = await cResp.json();
            const remoteClients = JSON.parse(base64ToUtf8(cBlob.content || ''));
            if (Array.isArray(remoteClients)) TB.saveClients(TB.mergeClients(TB.getClients(), remoteClients));
          }
        } catch (_) {}
      }

      const jsonNodes = allNodes.filter(item =>
        item.type === 'blob' && item.path.startsWith('Documents/') && !item.path.startsWith('Documents/_Directory/') && item.path.endsWith('.json')
      );

      const localMap = new Map(TB.getAllDocs().map(d => [d.githubPath, d]));
      const fetched = [];
      const toFetch = jsonNodes.filter(node => {
        const local = localMap.get(node.path);
        return !local || local.githubSha !== node.sha;
      });

      const batchSize = 6;
      for (let i = 0; i < toFetch.length; i += batchSize) {
        const slice = toFetch.slice(i, i + batchSize);
        const results = await Promise.all(slice.map(async node => {
          try {
            const blobUrl = `https://api.github.com/repos/${encodeURIComponent(CONFIG.GITHUB_OWNER)}/${encodeURIComponent(CONFIG.GITHUB_REPO)}/git/blobs/${node.sha}`;
            const resp = await fetch(blobUrl, { headers: ghHeaders() });
            if (!resp.ok) return null;
            const blob = await resp.json();
            const parsed = JSON.parse(base64ToUtf8(blob.content || ''));
            return { ...parsed, githubSha: node.sha, githubPath: node.path, cloudSynced: true };
          } catch (_) { return null; }
        }));
        results.forEach(r => { if (r) fetched.push(r); });
      }

      if (fetched.length > 0) {
        const merged = TB.mergeRecords(TB.getAllDocs(), fetched);
        TB.saveAllDocs(merged);
      }

      localStorage.setItem(CONFIG.STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
      TB.refreshSyncPillDefault();
      window.dispatchEvent(new CustomEvent('tourbuzz:synced', { detail: { fetched: fetched.length, totalRemote: jsonNodes.length } }));
      if (!silent) {
        TB.toast(`Cloud sync complete (${fetched.length} updated, ${jsonNodes.length} in GitHub vault).`, 'success');
      }
      return { ok: true, count: fetched.length, totalRemote: jsonNodes.length };
    } catch (err) {
      TB.updateSyncPill('error', 'Sync Failed · Local Mode');
      if (!silent) TB.toast(`GitHub sync error: ${err.message}`, 'error');
      return { ok: false, error: err.message };
    }
  };

  TB.testGitHubConnection = async function () {
    if (!TB.isGitHubConfigured()) throw new Error('Please enter GitHub Owner, Repository, and Personal Access Token.');
    const url = `https://api.github.com/repos/${encodeURIComponent(CONFIG.GITHUB_OWNER)}/${encodeURIComponent(CONFIG.GITHUB_REPO)}`;
    const resp = await fetch(url, { headers: ghHeaders() });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} — Check repo name and PAT contents:write scope.`);
    return await resp.json();
  };

  /* ------------------------------------------------------------------------
     Layer 3: Google Sheets Webhook & Auto-Settle Receipt -> Invoice
     ------------------------------------------------------------------------ */
  TB.pullFromGoogleSheets = async function (silent = false) {
    if (!TB.isSheetsConfigured()) return { ok: false, skipped: true, count: 0 };
    TB.updateSyncPill('syncing', 'Syncing Google Sheets...');
    try {
      const sep = CONFIG.APPS_SCRIPT_URL.includes('?') ? '&' : '?';
      const url = `${CONFIG.APPS_SCRIPT_URL}${sep}action=pull&_t=${Date.now()}`;
      const resp = await fetch(url, { method: 'GET', redirect: 'follow' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const incoming = Array.isArray(data.documents) ? data.documents : [];
      if (incoming.length > 0) {
        const merged = TB.mergeRecords(TB.getAllDocs(), incoming);
        TB.saveAllDocs(merged);
        incoming.forEach(d => TB.learnClientFromDoc(d));
      }
      localStorage.setItem(CONFIG.STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
      TB.refreshSyncPillDefault();
      window.dispatchEvent(new CustomEvent('tourbuzz:synced', { detail: { source: 'sheets', count: incoming.length } }));
      if (!silent) TB.toast(`Google Sheets synced (${incoming.length} records loaded).`, 'success');
      return { ok: true, count: incoming.length };
    } catch (err) {
      console.warn('Google Sheets pull error:', err);
      TB.refreshSyncPillDefault();
      if (!silent) TB.toast(`Sheets pull error: ${err.message}`, 'warn');
      return { ok: false, error: err.message };
    }
  };

  TB.syncAll = async function (silent = false) {
    const tasks = [];
    if (TB.isSheetsConfigured()) tasks.push(TB.pullFromGoogleSheets(silent));
    if (TB.isGitHubConfigured()) tasks.push(TB.pullFromGitHub(silent));
    if (!tasks.length) {
      if (!silent) TB.toast('Configure Google Sheets URL or GitHub PAT in Settings to sync online.', 'warn');
      return;
    }
    await Promise.all(tasks);
  };

  TB.pushToGoogleSheets = async function (doc) {
    if (!CONFIG.APPS_SCRIPT_URL) return { ok: false, skipped: true };
    try {
      await fetch(CONFIG.APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(doc)
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  };

  TB.testSheetsWebhook = async function () {
    if (!CONFIG.APPS_SCRIPT_URL) throw new Error('Please enter your deployed Google Apps Script Web App URL.');
    await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        type: 'ping',
        docNo: 'PING-TEST',
        clientName: 'TourBuzz Connection Test',
        date: TB.todayISO(),
        status: 'CONFIRMED',
        updatedBy: TB.getStaffName(),
        updatedAt: new Date().toISOString()
      })
    });
    return { ok: true };
  };

  /* Auto-Settle Linked Invoice when Money Receipt is Saved */
  TB.autoSettleInvoiceFromReceipt = async function (receiptDoc) {
    if (!receiptDoc || receiptDoc.type !== 'receipt' || !receiptDoc.againstInvoice) return null;
    const inv = TB.getDoc(receiptDoc.againstInvoice.trim());
    if (!inv || (inv.type !== 'invoice' && inv.type !== 'ticket-invoice')) return null;

    const applied = Array.isArray(inv.appliedReceipts) ? [...inv.appliedReceipts] : [];
    const rctAmt = TB.toNumber(receiptDoc.amount);
    if (rctAmt <= 0 || applied.includes(receiptDoc.docNo)) return null;

    const newPaid = TB.toNumber(inv.paidAmount) + rctAmt;
    const grand = TB.toNumber(inv.grandTotal);
    const newDue = Math.max(0, grand - newPaid);
    const newStatus = newDue <= 0.005 && grand > 0 ? 'PAID' : (newPaid > 0 ? 'PARTIAL' : 'UNPAID');

    applied.push(receiptDoc.docNo);
    const updatedInv = TB.saveLocalDoc({
      ...inv,
      paidAmount: newPaid,
      dueAmount: newDue,
      status: newStatus,
      appliedReceipts: applied
    });

    TB.pushToGoogleSheets(updatedInv);
    if (TB.isGitHubConfigured()) {
      try { await TB.pushToGitHub(updatedInv, { force: true }); } catch (_) { TB.addToOutbox(updatedInv.docNo); }
    }
    return updatedInv;
  };

  /* Unified Tri-Layer Save */
  TB.saveAndSync = async function (doc) {
    const saved = TB.saveLocalDoc(doc);
    const sheetsPromise = TB.pushToGoogleSheets(saved);

    let ghResult = { ok: false, skipped: true };
    if (TB.isGitHubConfigured()) {
      if (!navigator.onLine) {
        TB.addToOutbox(saved.docNo);
        TB.toast(`${saved.docNo} saved offline — queued for auto-sync when online.`, 'warn');
      } else {
        try {
          ghResult = await TB.pushToGitHub(saved);
          if (ghResult.ok) TB.syncClientsToGitHub();
        } catch (err) {
          TB.addToOutbox(saved.docNo);
          TB.toast(`Saved locally & queued for retry. (${err.message})`, 'warn');
        }
      }
    }

    // Auto-settle linked invoice if this is a Money Receipt
    let settledInv = null;
    if (saved.type === 'receipt' && saved.againstInvoice) {
      settledInv = await TB.autoSettleInvoiceFromReceipt(saved);
    }

    await sheetsPromise;
    if (ghResult.ok) {
      TB.toast(`${saved.docNo} synced to GitHub Cloud.${settledInv ? ` Linked ${settledInv.docNo} updated to ${settledInv.status}.` : ''}`, 'success');
    } else if (ghResult.skipped) {
      TB.toast(`${saved.docNo} saved locally.${settledInv ? ` Linked ${settledInv.docNo} updated to ${settledInv.status}.` : ''}`, 'success');
    }
    return saved;
  };

  /* ------------------------------------------------------------------------
     Workflow Accelerators: Clone, Quotation -> Invoice, WhatsApp Share, Team Setup Code
     ------------------------------------------------------------------------ */
  TB.cloneDocument = function (docNo) {
    const orig = TB.getDoc(docNo);
    if (!orig) return TB.toast('Document not found.', 'error');
    const meta = CONFIG.DOC_TYPES[orig.type];
    if (!meta) return;
    const cloned = structuredClone(orig);
    cloned.docNo = TB.generateDocNumber(orig.type);
    cloned.date = TB.todayISO();
    delete cloned.githubSha;
    delete cloned.githubPath;
    delete cloned.cloudSynced;
    delete cloned.appliedReceipts;
    sessionStorage.setItem(CONFIG.STORAGE_KEYS.EDIT_BUFFER, JSON.stringify(cloned));
    window.location.href = `${meta.page}?edit=${encodeURIComponent(cloned.docNo)}`;
  };

  TB.convertQuotationToInvoice = function (docNo) {
    const qtn = TB.getDoc(docNo);
    if (!qtn || qtn.type !== 'quotation') return TB.toast('Quotation not found.', 'error');
    const invDocNo = TB.generateDocNumber('invoice');
    const inv = {
      type: 'invoice',
      docNo: invDocNo,
      date: TB.todayISO(),
      dueDate: TB.todayISO(),
      currency: qtn.currency || 'BDT',
      tripRef: qtn.docNo,
      preparedBy: TB.getStaffName(),
      clientName: qtn.clientName || '',
      clientPhone: qtn.clientPhone || '',
      clientEmail: qtn.clientEmail || '',
      items: Array.isArray(qtn.items) ? structuredClone(qtn.items) : [],
      taxPercent: 0,
      serviceFee: 0,
      discount: 0,
      paidAmount: 0,
      notes: `Converted from Quotation ${qtn.docNo}${qtn.subject ? ' — ' + qtn.subject : ''}. Thank you for choosing TourBuzz Travel Services Ltd.`
    };
    sessionStorage.setItem(CONFIG.STORAGE_KEYS.EDIT_BUFFER, JSON.stringify(inv));
    window.location.href = `invoice.html?edit=${encodeURIComponent(invDocNo)}`;
  };

  TB.buildWhatsAppSummary = function (doc) {
    const c = CONFIG.COMPANY;
    const header = `*${c.NAME}*`;
    switch (doc.type) {
      case 'ticket': {
        const pax = (doc.passengers || []).map((p, i) => `${i + 1}. ${p.name} (${p.ticketNo || 'TBA'})`).join('\n');
        const segs = (doc.segments || []).map(s => `✈️ ${s.flightNo}: ${s.originIata} → ${s.destIata} | ${TB.formatDate(s.depDate)} ${s.depTime}–${s.arrTime} (${s.baggage})`).join('\n');
        return `${header}\n*E-Ticket Issued* | PNR: *${doc.pnr || '—'}*\n\n*Passenger(s):*\n${pax}\n\n*Flights:*\n${segs}\n\nSupport: ${c.PHONE}`;
      }
      case 'voucher': {
        const hotels = (doc.hotels || []).map(h => `🏨 *${h.hotelName}*\nCheck-In: ${TB.formatDate(h.checkIn)} | Check-Out: ${TB.formatDate(h.checkOut)}\nRoom: ${h.roomType} (${h.mealPlan}) | Conf #: *${h.confirmationNo || 'TBA'}*`).join('\n\n');
        return `${header}\n*Hotel Voucher* (${doc.docNo})\nGuest: *${doc.clientName || '—'}*\n\n${hotels}\n\n24/7 Support: ${c.PHONE}`;
      }
      case 'invoice':
      case 'ticket-invoice':
        return `${header}\n*${doc.type === 'invoice' ? 'INVOICE' : 'Air Ticket Invoice'}* (${doc.docNo})\nClient: *${doc.clientName || '—'}*${doc.pnr ? `\nPNR: *${doc.pnr}* (${doc.sector || ''})` : ''}\nTotal: *${TB.formatMoney(doc.grandTotal, doc.currency)}*\nPaid: ${TB.formatMoney(doc.paidAmount, doc.currency)}\nBalance Due: *${TB.formatMoney(doc.dueAmount, doc.currency)}*\nStatus: ${doc.status || 'UNPAID'}\n\nThank you for traveling with us!`;
      case 'receipt':
        return `${header}\n*Official Money Receipt* (${doc.docNo})\nReceived From: *${doc.clientName || '—'}*\nAmount: *${TB.formatMoney(doc.amount, doc.currency)}*\nMode: ${doc.paymentMode || 'Cash'}${doc.againstInvoice ? `\nAgainst: ${doc.againstInvoice}` : ''}\n\nThank you for your payment!`;
      case 'quotation':
        return `${header}\n*Tour Quotation* (${doc.docNo})\nPackage: *${doc.subject || 'Custom Tour'}*\nClient: ${doc.clientName || '—'} | Pax: ${doc.paxCount || '—'}\nEstimate: *${TB.formatMoney(doc.grandTotal, doc.currency)}*\nValid Until: ${TB.formatDate(doc.validUntil)}\n\nContact: ${c.PHONE}`;
      case 'visa':
        return `${header}\n*Visa File Update* (${doc.docNo})\nApplicant: *${doc.clientName || '—'}* (PP: ${doc.passportNo || '—'})\nDestination: *${doc.destination || '—'}* (${doc.visaCategory || 'Tourist'})\nStatus: *${doc.status || 'PROCESSING'}*`;
      case 'itinerary':
        return `${header}\n*Tour Itinerary* (${doc.docNo})\nTrip: *${doc.title || 'Curated Tour'}*\nDestination: ${doc.destination || '—'} | ${doc.duration || ''}\nDays Planned: ${(doc.days || []).length}\n\n24/7 Tour Support: ${c.PHONE}`;
      default:
        return `${header} — Document ${doc.docNo}`;
    }
  };

  TB.shareToWhatsApp = function (doc) {
    const msg = TB.buildWhatsAppSummary(doc);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(msg).catch(() => {});
    }
    const rawPhone = (doc.clientPhone || doc.guestPhone || '').replace(/[^\d]/g, '');
    const waUrl = rawPhone
      ? `https://wa.me/${rawPhone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    TB.toast('WhatsApp summary copied & opening WhatsApp...', 'success');
    window.open(waUrl, '_blank', 'noopener');
  };

  /* 10-Second Team Setup Code (XOR + UTF8 Base64 so it works on file:// AND https://) */
  function xorCipher(bytes, keyStr) {
    const key = new TextEncoder().encode(keyStr || 'TourBuzzTeam2026');
    return bytes.map((b, i) => b ^ key[i % key.length]);
  }

  TB.exportTeamSetupCode = function (passphrase) {
    const payload = {
      v: 1,
      GITHUB_OWNER: CONFIG.GITHUB_OWNER,
      GITHUB_REPO: CONFIG.GITHUB_REPO,
      GITHUB_BRANCH: CONFIG.GITHUB_BRANCH,
      GITHUB_TOKEN: CONFIG.GITHUB_TOKEN,
      APPS_SCRIPT_URL: CONFIG.APPS_SCRIPT_URL,
      BANK_DETAILS: CONFIG.BANK_DETAILS
    };
    const rawBytes = new TextEncoder().encode(JSON.stringify(payload));
    const enc = xorCipher(rawBytes, passphrase);
    let bin = '';
    enc.forEach(b => { bin += String.fromCharCode(b); });
    return 'TB-TEAM-' + btoa(bin);
  };

  TB.importTeamSetupCode = function (code, passphrase) {
    const clean = String(code || '').trim();
    if (!clean.startsWith('TB-TEAM-')) throw new Error('Invalid code format (must start with TB-TEAM-).');
    const bin = atob(clean.slice(8));
    const enc = Uint8Array.from(bin, c => c.charCodeAt(0));
    const dec = xorCipher(enc, passphrase);
    const parsed = JSON.parse(new TextDecoder().decode(dec));
    if (!parsed || parsed.v !== 1) throw new Error('Wrong passphrase or corrupted setup code.');
    const existing = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.SETTINGS) || '{}');
    const merged = { ...existing, ...parsed };
    delete merged.v;
    localStorage.setItem(CONFIG.STORAGE_KEYS.SETTINGS, JSON.stringify(merged));
    window.reloadTourBuzzConfig();
    return merged;
  };

  /* ------------------------------------------------------------------------
     Print & Retina A4 PDF Export
     ------------------------------------------------------------------------ */
  TB.printSheet = function () { window.print(); };

  TB.exportPDF = async function (sheetEl, filename) {
    if (!sheetEl) return TB.toast('No preview sheet found to save.', 'error');
    const cleanTitle = String(filename || document.title || 'TourBuzz Document')
      .replace(/\.pdf$/i, '')
      .replace(/[\/:*?"<>|]/g, '')
      .trim();
    const prevTitle = document.title;
    document.title = cleanTitle;
    TB.toast(`Choose "Save as PDF" — filename preset to "${cleanTitle}.pdf"`, 'info');
    setTimeout(() => {
      window.print();
      setTimeout(() => { document.title = prevTitle; }, 1000);
    }, 80);
  };

  /* ------------------------------------------------------------------------
     Keyboard-Navigable Autocomplete (Aviation + Shared Client Directory)
     ------------------------------------------------------------------------ */
  TB.attachAviationAutocomplete = function (inputEl, datasetType, onSelect) {
    if (!inputEl || !window.AVIATION_DATA) return;
    const list = datasetType === 'airline' ? window.AVIATION_DATA.AIRLINES : window.AVIATION_DATA.AIRPORTS;

    let wrap = inputEl.parentElement;
    if (!wrap.classList.contains('ac-wrap')) {
      wrap = document.createElement('div');
      wrap.className = 'ac-wrap';
      inputEl.parentNode.insertBefore(wrap, inputEl);
      wrap.appendChild(inputEl);
    }
    let dropdown = wrap.querySelector('.ac-list');
    if (!dropdown) {
      dropdown = document.createElement('div');
      dropdown.className = 'ac-list';
      wrap.appendChild(dropdown);
    }

    let matches = [];
    let activeIdx = -1;

    function render(query) {
      const q = (query || '').trim().toLowerCase();
      matches = !q ? list.slice(0, 12) : list.filter(item => {
        const hay = datasetType === 'airline'
          ? `${item.iata} ${item.icao} ${item.name} ${item.country}`.toLowerCase()
          : `${item.iata} ${item.icao} ${item.city} ${item.name} ${item.country}`.toLowerCase();
        return hay.includes(q);
      }).slice(0, 14);
      activeIdx = matches.length ? 0 : -1;
      if (!matches.length) { dropdown.classList.remove('open'); dropdown.innerHTML = ''; return; }
      dropdown.innerHTML = matches.map((item, idx) => {
        const sub = datasetType === 'airline'
          ? `${TB.escapeHtml(item.name)} · ${TB.escapeHtml(item.country)}`
          : `${TB.escapeHtml(item.city)}, ${TB.escapeHtml(item.country)} — ${TB.escapeHtml(item.name)}`;
        return `<div class="ac-item ${idx === activeIdx ? 'active' : ''}" data-idx="${idx}">
          <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${sub}</span>
          <span class="ac-code">${TB.escapeHtml(item.iata)} / ${TB.escapeHtml(item.icao)}</span>
        </div>`;
      }).join('');
      dropdown.classList.add('open');
    }

    function pick(idx) {
      const item = matches[idx];
      if (!item) return;
      dropdown.classList.remove('open');
      if (typeof onSelect === 'function') onSelect(item);
    }

    inputEl.addEventListener('focus', () => render(inputEl.value));
    inputEl.addEventListener('input', () => render(inputEl.value));
    inputEl.addEventListener('keydown', e => {
      if (!dropdown.classList.contains('open')) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); activeIdx = (activeIdx + 1) % matches.length; updateH(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); activeIdx = (activeIdx - 1 + matches.length) % matches.length; updateH(); }
      else if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); pick(activeIdx); }
      else if (e.key === 'Escape') dropdown.classList.remove('open');
    });
    function updateH() {
      const items = dropdown.querySelectorAll('.ac-item');
      items.forEach((el, i) => el.classList.toggle('active', i === activeIdx));
      if (items[activeIdx]) items[activeIdx].scrollIntoView({ block: 'nearest' });
    }
    dropdown.addEventListener('mousedown', e => {
      const itemEl = e.target.closest('.ac-item');
      if (itemEl) { e.preventDefault(); pick(parseInt(itemEl.dataset.idx, 10)); }
    });
    document.addEventListener('click', e => { if (!wrap.contains(e.target)) dropdown.classList.remove('open'); });
  };

  TB.attachClientAutocomplete = function (inputEl, onSelect) {
    if (!inputEl) return;
    let wrap = inputEl.parentElement;
    if (!wrap.classList.contains('ac-wrap')) {
      wrap = document.createElement('div');
      wrap.className = 'ac-wrap';
      inputEl.parentNode.insertBefore(wrap, inputEl);
      wrap.appendChild(inputEl);
    }
    let dropdown = wrap.querySelector('.ac-list');
    if (!dropdown) {
      dropdown = document.createElement('div');
      dropdown.className = 'ac-list';
      wrap.appendChild(dropdown);
    }

    let matches = [];
    let activeIdx = -1;

    function render(query) {
      const clients = TB.getClients();
      if (!clients.length) return;
      const q = (query || '').trim().toLowerCase();
      if (!q) { dropdown.classList.remove('open'); return; }
      matches = clients.filter(c =>
        `${c.name} ${c.phone} ${c.company} ${c.passportNo}`.toLowerCase().includes(q)
      ).slice(0, 8);
      activeIdx = matches.length ? 0 : -1;
      if (!matches.length) { dropdown.classList.remove('open'); return; }
      dropdown.innerHTML = matches.map((c, idx) => `
        <div class="ac-item ${idx === activeIdx ? 'active' : ''}" data-idx="${idx}">
          <span><strong>${TB.escapeHtml(c.name)}</strong>${c.company ? ` · ${TB.escapeHtml(c.company)}` : ''}</span>
          <span class="ac-code">${TB.escapeHtml(c.phone || c.passportNo || 'Saved')}</span>
        </div>
      `).join('');
      dropdown.classList.add('open');
    }

    function pick(idx) {
      const item = matches[idx];
      if (!item) return;
      dropdown.classList.remove('open');
      if (typeof onSelect === 'function') onSelect(item);
    }

    inputEl.addEventListener('input', () => render(inputEl.value));
    inputEl.addEventListener('keydown', e => {
      if (!dropdown.classList.contains('open')) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); activeIdx = (activeIdx + 1) % matches.length; }
      else if (e.key === 'ArrowUp') { e.preventDefault(); activeIdx = (activeIdx - 1 + matches.length) % matches.length; }
      else if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); pick(activeIdx); }
      else if (e.key === 'Escape') dropdown.classList.remove('open');
    });
    dropdown.addEventListener('mousedown', e => {
      const itemEl = e.target.closest('.ac-item');
      if (itemEl) { e.preventDefault(); pick(parseInt(itemEl.dataset.idx, 10)); }
    });
    document.addEventListener('click', e => { if (!wrap.contains(e.target)) dropdown.classList.remove('open'); });
  };

  /* ------------------------------------------------------------------------
     Shared Enterprise Navigation Shell
     ------------------------------------------------------------------------ */
  TB.updateSyncPill = function (state, text) {
    const pill = document.getElementById('tb-sync-pill');
    if (!pill) return;
    pill.className = `sync-pill ${state}`;
    const label = pill.querySelector('.sync-label');
    if (label) label.textContent = text;
  };

  TB.refreshSyncPillDefault = function () {
    const qLen = TB.getOutbox().length;
    const hasGH = TB.isGitHubConfigured();
    const hasGS = TB.isSheetsConfigured();
    if (!hasGH && !hasGS) {
      TB.updateSyncPill('offline', 'Local Offline Mode');
    } else if (qLen > 0) {
      TB.updateSyncPill('offline', `Queued (${qLen}) · Pending Push`);
    } else {
      const desk = TB.getDeskCode();
      const mode = (hasGH && hasGS) ? 'Cloud + Sheets' : (hasGS ? 'Sheets Live' : 'GitHub Live');
      TB.updateSyncPill('online', desk ? `${mode} · ${desk}` : `Online · ${mode}`);
    }
  };

  TB.initShell = function (activeFile, pageTitle) {
    const theme = TB.initTheme();

    const navGroups = [
      {
        label: 'Overview',
        items: [
          { href: 'index.html', label: 'Executive Dashboard', icon: '📊' },
          { href: 'documents.html', label: 'Master Vault', icon: '🗄️' },
          { href: 'clients.html', label: 'Client Directory', icon: '👥' }
        ]
      },
      {
        label: 'Document Makers',
        items: [
          { href: 'invoice.html', label: 'Invoice', icon: '🧾' },
          { href: 'voucher.html', label: 'Hotel Voucher', icon: '🏨' },
          { href: 'receipt.html', label: 'Money Receipt', icon: '💵' },
          { href: 'quotation.html', label: 'Tour Quotation', icon: '📋' },
          { href: 'ticket.html', label: 'Airline E-Ticket', icon: '✈️' },
          { href: 'ticket-invoice.html', label: 'Air Ticket Invoice', icon: '🎫' },
          { href: 'visa.html', label: 'Visa Checklist Sheet', icon: '🛂' },
          { href: 'itinerary.html', label: 'Tour Itinerary', icon: '🗺️' }
        ]
      },
      {
        label: 'System',
        items: [
          { href: 'settings.html', label: 'Cloud & Settings', icon: '⚙️' }
        ]
      }
    ];

    const navHtml = navGroups.map(group => `
      <div class="sidebar-group-label">${group.label}</div>
      ${group.items.map(item => `
        <a class="sidebar-link ${item.href === activeFile ? 'active' : ''}" href="${item.href}">
          <span class="nav-icon">${item.icon}</span>
          <span>${item.label}</span>
        </a>
      `).join('')}
    `).join('');

    const sidebarEl = document.getElementById('tb-sidebar');
    if (sidebarEl) {
      sidebarEl.innerHTML = `
        <div class="sidebar-brand">
          <img src="${CONFIG.COMPANY.LOGO_PATH}" alt="TourBuzz Logo" onerror="this.style.display='none'">
          <div class="sidebar-brand-text">
            <div class="sidebar-brand-name">Tour<span>Buzz</span> TMS</div>
            <div class="sidebar-brand-sub">${TB.escapeHtml(CONFIG.STAFF.NAME || CONFIG.COMPANY.SLOGAN)}</div>
          </div>
        </div>
        <nav class="sidebar-nav">${navHtml}</nav>
        <div class="sidebar-footer">
          <div id="tb-sync-pill" class="sync-pill offline">
            <span class="sync-dot"></span>
            <span class="sync-label">Checking...</span>
          </div>
        </div>
      `;
      TB.refreshSyncPillDefault();
    }

    const headerEl = document.getElementById('tb-header');
    if (headerEl) {
      headerEl.innerHTML = `
        <div class="header-left">
          <button type="button" class="mobile-menu-btn" id="tb-mobile-menu" aria-label="Menu">☰</button>
          <h1 class="page-title">${TB.escapeHtml(pageTitle)}</h1>
        </div>
        <div class="header-search">
          <span class="search-icon">🔍</span>
          <input type="search" id="tb-global-search" placeholder="Search doc #, PNR, client, staff... (Enter)">
        </div>
        <div class="header-actions">
          <button type="button" class="btn btn-outline btn-sm" id="tb-sync-now">🔄 Sync Now</button>
          <button type="button" class="btn btn-outline btn-sm" id="tb-theme-toggle">${theme === 'dark' ? '☀️ Light' : '🌙 Dark'}</button>
        </div>
      `;

      const menuBtn = document.getElementById('tb-mobile-menu');
      if (menuBtn && sidebarEl) menuBtn.addEventListener('click', () => sidebarEl.classList.toggle('open'));

      const searchInput = document.getElementById('tb-global-search');
      if (searchInput) {
        searchInput.addEventListener('keydown', e => {
          if (e.key === 'Enter' && searchInput.value.trim()) {
            window.location.href = `documents.html?q=${encodeURIComponent(searchInput.value.trim())}`;
          }
        });
      }

      const syncBtn = document.getElementById('tb-sync-now');
      if (syncBtn) {
        syncBtn.addEventListener('click', async () => {
          syncBtn.disabled = true;
          await TB.syncAll(false);
          syncBtn.disabled = false;
        });
      }

      const themeBtn = document.getElementById('tb-theme-toggle');
      if (themeBtn) themeBtn.addEventListener('click', TB.toggleTheme);
    }

    // Auto-push queued offline saves the moment internet reconnects
    window.addEventListener('online', () => {
      TB.flushOutbox(false);
    });

    // Simultaneous live auto-sync: pull when returning to tab & every 30s
    window.addEventListener('focus', () => {
      if (TB.isSheetsConfigured() || TB.isGitHubConfigured()) TB.syncAll(true);
    });
    if ((TB.isSheetsConfigured() || TB.isGitHubConfigured()) && CONFIG.SYNC_INTERVAL_MS > 0) {
      setInterval(() => TB.syncAll(true), CONFIG.SYNC_INTERVAL_MS);
    }
  };

  TB.openForEdit = function (docNo) {
    const doc = TB.getDoc(docNo);
    if (!doc) return TB.toast('Document not found in vault.', 'error');
    const meta = CONFIG.DOC_TYPES[doc.type];
    if (!meta) return;
    sessionStorage.setItem(CONFIG.STORAGE_KEYS.EDIT_BUFFER, JSON.stringify(doc));
    window.location.href = `${meta.page}?edit=${encodeURIComponent(doc.docNo)}`;
  };

  window.TourBuzzApp = TB;
})();
