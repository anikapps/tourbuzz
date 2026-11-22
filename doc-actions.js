/* ==========================================================================
   TourBuzz Travel Management System — Unified Document Maker Actions
   Live Preview, Save & Sync, Conflict Tracking, Client Autocomplete,
   WhatsApp Share, Clone, Print A4, PDF Export, and Smart Auto-Fill
   ========================================================================== */

(function () {
  'use strict';

  window.TourBuzzDocActions = {
    bindMaker: function (opts) {
      const previewContainer = document.querySelector(opts.previewSelector || '#a4-preview');
      let renderTimer = null;
      let loadedAtTimestamp = null;
      let allowDraftSave = false;

      const params = new URLSearchParams(window.location.search);
      const editDocNo = params.get('edit');
      const draftKey = editDocNo
        ? `tourbuzz_tms_draft_edit_${editDocNo}`
        : `tourbuzz_tms_draft_${opts.type}`;

      function saveDraft(doc) {
        if (!allowDraftSave || !doc) return;
        try {
          localStorage.setItem(draftKey, JSON.stringify({ savedAt: Date.now(), doc }));
        } catch (_) {}
      }

      function loadDraft() {
        try {
          const raw = localStorage.getItem(draftKey);
          if (!raw) return null;
          const parsed = JSON.parse(raw);
          return (parsed && parsed.doc && parsed.doc.type === opts.type) ? parsed.doc : null;
        } catch (_) {
          return null;
        }
      }

      function clearDraft() {
        try { localStorage.removeItem(draftKey); } catch (_) {}
      }

      function getExportTitle(doc) {
        const meta = (CONFIG.DOC_TYPES && CONFIG.DOC_TYPES[doc.type]) || { label: 'TourBuzz Document' };
        const idPart = (doc.type === 'ticket' && doc.pnr && doc.pnr.trim())
          ? doc.pnr.trim().toUpperCase()
          : (doc.docNo || 'DRAFT');
        return `${meta.label} — ${idPart}`;
      }

      function renderNow() {
        const doc = opts.collectData();
        document.title = getExportTitle(doc);
        window.TourBuzzRenderers.renderInto(previewContainer, doc);
        saveDraft(doc);
        return doc;
      }

      function scheduleRender() {
        clearTimeout(renderTimer);
        renderTimer = setTimeout(renderNow, 60);
      }

      // Check for Load-to-Edit (?edit=DOCNO) or Auto-Saved Draft in localStorage
      let loadedDoc = null;
      const existingDraft = loadDraft();

      if (editDocNo) {
        loadedDoc = window.TourBuzzApp.getDoc(editDocNo);
        if (!loadedDoc) {
          try {
            const buf = sessionStorage.getItem(CONFIG.STORAGE_KEYS.EDIT_BUFFER);
            if (buf) {
              const parsed = JSON.parse(buf);
              if (parsed && parsed.docNo === editDocNo) loadedDoc = parsed;
            }
          } catch (_) {}
        }
      }

      if (existingDraft) {
        loadedAtTimestamp = (loadedDoc && loadedDoc.updatedAt) || existingDraft.updatedAt || null;
        opts.populateForm(existingDraft);
        window.TourBuzzApp.toast('Restored your unsaved draft automatically.', 'info');
      } else if (loadedDoc && loadedDoc.type === opts.type) {
        loadedAtTimestamp = loadedDoc.updatedAt || new Date().toISOString();
        opts.populateForm(loadedDoc);
        window.TourBuzzApp.toast(`Loaded ${loadedDoc.docNo} for editing.`, 'info');
      } else {
        opts.resetDefaults();
      }

      renderNow();
      allowDraftSave = true;

      // Also capture final state right before reload/navigation
      window.addEventListener('beforeunload', () => {
        if (allowDraftSave) {
          try { saveDraft(opts.collectData()); } catch (_) {}
        }
      });

      // Auto-wire Shared Client Directory Autocomplete on primary client input
      const clientInputIds = [
        { name: 'inv-client-name', company: 'inv-client-company', phone: 'inv-client-phone', email: 'inv-client-email', address: 'inv-client-address' },
        { name: 'vch-guest', phone: 'vch-phone' },
        { name: 'rct-client', phone: 'rct-phone' },
        { name: 'qtn-client', phone: 'qtn-phone', email: 'qtn-email' },
        { name: 'tiv-client', company: 'tiv-company', phone: 'tiv-phone', email: 'tiv-email' },
        { name: 'vis-name', phone: 'vis-phone', passport: 'vis-passport', nationality: 'vis-nationality' },
        { name: 'itn-client' }
      ];
      clientInputIds.forEach(map => {
        const el = document.getElementById(map.name);
        if (!el || !window.TourBuzzApp.attachClientAutocomplete) return;
        window.TourBuzzApp.attachClientAutocomplete(el, client => {
          el.value = client.name || '';
          if (map.company && client.company && document.getElementById(map.company)) document.getElementById(map.company).value = client.company;
          if (map.phone && client.phone && document.getElementById(map.phone)) document.getElementById(map.phone).value = client.phone;
          if (map.email && client.email && document.getElementById(map.email)) document.getElementById(map.email).value = client.email;
          if (map.address && client.address && document.getElementById(map.address)) document.getElementById(map.address).value = client.address;
          if (map.passport && client.passportNo && document.getElementById(map.passport)) document.getElementById(map.passport).value = client.passportNo;
          if (map.nationality && client.nationality && document.getElementById(map.nationality)) document.getElementById(map.nationality).value = client.nationality;
          renderNow();
        });
      });

      // Bind form events
      const formPanel = document.querySelector('.form-panel');
      if (formPanel) {
        formPanel.addEventListener('input', e => {
          if (e.target && e.target.closest('.smart-fill-card')) return;
          scheduleRender();
        });
        formPanel.addEventListener('change', e => {
          if (e.target && e.target.closest('.smart-fill-card')) return;
          scheduleRender();
        });
      }

      // Inject WhatsApp Share button into action bar
      const actionGroup = document.querySelector('.maker-action-group');
      if (actionGroup) {
        const waBtn = document.createElement('button');
        waBtn.type = 'button';
        waBtn.className = 'btn btn-outline btn-sm';
        waBtn.innerHTML = '💬 WhatsApp';
        waBtn.addEventListener('click', () => {
          const doc = renderNow();
          window.TourBuzzApp.shareToWhatsApp(doc);
        });
        actionGroup.appendChild(waBtn);
      }

      // Inject Smart Auto-Fill Panel below form sections
      if (formPanel && window.TourBuzzSmartParser) {
        const smartCard = document.createElement('div');
        smartCard.className = 'form-section smart-fill-card';
        smartCard.id = 'tb-smart-fill-panel';
        smartCard.innerHTML = `
          <div class="form-section-title" style="color:var(--tb-orange);">
            <span>⚡ Smart Auto-Fill — Paste Text or Upload PDF</span>
            <span class="badge badge-orange">Pattern Engine</span>
          </div>
          <p style="font-size:12px;color:var(--text-secondary);margin:0 0 10px;">
            Paste a GDS itinerary, WhatsApp booking message, supplier confirmation, or upload a PDF/TXT file below, then click <strong>Insert &amp; Auto-Fill</strong> to populate every matching box automatically.
          </p>
          <div class="smart-dropzone" id="tb-smart-dropzone">
            <label style="cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;font-weight:600;font-size:12.5px;color:var(--text-primary);">
              <span>📄 Click to Upload PDF / TXT (or drag &amp; drop here)</span>
              <input type="file" id="tb-smart-file" accept=".pdf,.txt,.csv" style="display:none;">
            </label>
            <div id="tb-smart-filename" style="font-size:11px;color:var(--text-muted);margin-top:4px;"></div>
          </div>
          <div class="form-group full" style="margin-top:10px;">
            <label>Or Paste Raw Booking / Invoice / Ticket / Itinerary Text</label>
            <textarea id="tb-smart-text" class="form-control mono" rows="6" placeholder="Paste raw text here... (PNRs, flight legs, hotel dates, amounts, passenger names, Day 1 / Day 2 schedules, etc.)"></textarea>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:12px;flex-wrap:wrap;">
            <div style="display:flex;gap:8px;">
              <button type="button" class="btn btn-primary" id="tb-smart-insert">⚡ Insert &amp; Auto-Fill Form</button>
              <button type="button" class="btn btn-outline btn-sm" id="tb-smart-clear">Clear</button>
            </div>
            <div id="tb-smart-status" style="font-size:12px;color:var(--tb-green);font-weight:600;"></div>
          </div>
        `;
        formPanel.appendChild(smartCard);

        if (actionGroup) {
          const jumpBtn = document.createElement('button');
          jumpBtn.type = 'button';
          jumpBtn.className = 'btn btn-outline btn-sm';
          jumpBtn.innerHTML = '⚡ Smart Fill';
          jumpBtn.addEventListener('click', () => {
            smartCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const ta = document.getElementById('tb-smart-text');
            if (ta) setTimeout(() => ta.focus(), 350);
          });
          actionGroup.prepend(jumpBtn);
        }

        const fileInput = document.getElementById('tb-smart-file');
        const dropzone = document.getElementById('tb-smart-dropzone');
        const fileNameEl = document.getElementById('tb-smart-filename');
        const textArea = document.getElementById('tb-smart-text');
        const statusEl = document.getElementById('tb-smart-status');
        const insertBtn = document.getElementById('tb-smart-insert');
        const clearBtn = document.getElementById('tb-smart-clear');

        async function handleFile(file) {
          if (!file) return;
          fileNameEl.textContent = `Reading ${file.name}...`;
          statusEl.textContent = '';
          try {
            const extracted = await window.TourBuzzSmartParser.extractTextFromFile(file);
            textArea.value = extracted;
            fileNameEl.textContent = `✓ Loaded: ${file.name} (${extracted.length} chars) — Click "Insert & Auto-Fill Form"`;
            window.TourBuzzApp.toast(`Extracted text from ${file.name}. Click Insert to fill form.`, 'success');
          } catch (err) {
            fileNameEl.textContent = `✕ ${err.message}`;
            window.TourBuzzApp.toast(err.message, 'error');
          }
        }

        fileInput.addEventListener('change', e => handleFile(e.target.files[0]));
        dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('dragover'); });
        dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
        dropzone.addEventListener('drop', e => {
          e.preventDefault();
          dropzone.classList.remove('dragover');
          if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
        });

        insertBtn.addEventListener('click', () => {
          const raw = textArea.value.trim();
          if (!raw) return window.TourBuzzApp.toast('Paste text or upload a PDF first.', 'warn');
          const current = opts.collectData();
          const result = window.TourBuzzSmartParser.parse(opts.type, raw, current);
          opts.populateForm(result.doc);
          renderNow();
          statusEl.textContent = `✓ ${result.summary}`;
          window.TourBuzzApp.toast(`Auto-filled! ${result.summary}`, 'success');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        clearBtn.addEventListener('click', () => {
          textArea.value = '';
          fileInput.value = '';
          fileNameEl.textContent = '';
          statusEl.textContent = '';
        });
      }

      // Sticky Action Bar Buttons
      const btnSave = document.getElementById('btn-save-sync');
      const btnPrint = document.getElementById('btn-print-a4');
      const btnPdf = document.getElementById('btn-download-pdf');
      const btnReset = document.getElementById('btn-reset-form');

      if (btnSave) {
        btnSave.addEventListener('click', async () => {
          btnSave.disabled = true;
          const originalText = btnSave.innerHTML;
          btnSave.innerHTML = '⏳ Saving...';
          try {
            const doc = renderNow();
            if (loadedAtTimestamp) doc._loadedAt = loadedAtTimestamp;
            const saved = await window.TourBuzzApp.saveAndSync(doc);
            loadedAtTimestamp = saved.updatedAt;
            clearDraft();
          } finally {
            btnSave.disabled = false;
            btnSave.innerHTML = originalText;
          }
        });
      }

      if (btnPrint) {
        btnPrint.addEventListener('click', () => {
          const doc = renderNow();
          document.title = getExportTitle(doc);
          window.TourBuzzApp.printSheet();
        });
      }

      if (btnPdf) {
        btnPdf.addEventListener('click', async () => {
          const doc = renderNow();
          const sheetEl = previewContainer.querySelector('.sheet');
          const filename = `${getExportTitle(doc)}.pdf`;
          btnPdf.disabled = true;
          try {
            await window.TourBuzzApp.exportPDF(sheetEl, filename);
          } finally {
            btnPdf.disabled = false;
          }
        });
      }

      if (btnReset) {
        btnReset.addEventListener('click', () => {
          if (!confirm('Reset form and generate a fresh document number?')) return;
          if (window.location.search.includes('edit=')) {
            window.history.replaceState({}, '', window.location.pathname);
          }
          loadedAtTimestamp = null;
          clearDraft();
          allowDraftSave = false;
          opts.resetDefaults();
          renderNow();
          allowDraftSave = true;
          window.TourBuzzApp.toast('Form reset to new document.', 'info');
        });
      }

      return { renderNow, scheduleRender };
    }
  };
})();
