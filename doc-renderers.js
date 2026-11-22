/* ==========================================================================
   TourBuzz Travel Management System — Single Source of Truth A4 Renderers
   Renders exact printable A4 HTML .sheet templates for all 8 document types
   ========================================================================== */

(function () {
  'use strict';

  const esc = str => window.TourBuzzApp.escapeHtml(str);
  const fmtMoney = (amt, cur) => window.TourBuzzApp.formatMoney(amt, cur);
  const fmtDate = d => window.TourBuzzApp.formatDate(d);
  const toNum = v => window.TourBuzzApp.toNumber(v);
  const hasText = v => String(v || '').trim().length > 0;

  function statusClass(status) {
    const s = String(status || '').toUpperCase();
    if (['PAID', 'CONFIRMED', 'ISSUED', 'OK', 'APPROVED', 'COMPLETED'].includes(s)) return 'a4-status-green';
    if (['PARTIAL', 'PROCESSING', 'PENDING', 'SUBMITTED', 'DRAFT', 'PROPOSED'].includes(s)) return 'a4-status-amber';
    if (['UNPAID', 'DUE', 'CANCELLED', 'REJECTED'].includes(s)) return 'a4-status-red';
    return 'a4-status-navy';
  }

  function renderHeader(title, docNo, dateStr, status) {
    const c = CONFIG.COMPANY;
    return `
      <div class="a4-header">
        <div class="a4-brand">
          <img class="a4-logo" src="${c.LOGO_PATH}" alt="TourBuzz Logo" onerror="this.style.display='none'">
          <div>
            <h2 class="a4-company-name">TourBuzz Travel Services Ltd.</h2>
            <div class="a4-slogan">${esc(c.SLOGAN)}</div>
            <div class="a4-contact-line">
              ${esc(c.ADDRESS)}<br>
              Tel: ${esc(c.PHONE)} | Email: ${esc(c.EMAIL)} | Web: ${esc(c.WEBSITE)}
            </div>
          </div>
        </div>
        <div class="a4-doc-meta">
          <div class="a4-doc-type">${esc(title)}</div>
          <div class="a4-doc-no">${esc(docNo)}</div>
          ${hasText(dateStr) ? `<div class="a4-doc-date">Date: ${esc(fmtDate(dateStr))}</div>` : ''}
          ${hasText(status) ? `<div class="a4-status-pill ${statusClass(status)}">${esc(status)}</div>` : ''}
        </div>
      </div>
    `;
  }

  function renderSignatureBlock(extraStyle = '') {
    const sigSrc = (CONFIG.COMPANY && CONFIG.COMPANY.SIGNATURE_PATH) || 'signature.png';
    return `
      <div class="a4-sign-box" style="${extraStyle}">
        <img class="a4-sign-img" src="${sigSrc}" alt="Authorized Signature" onerror="this.style.display='none'">
        <div class="a4-sign-line">Authorized Signature</div>
        <div style="font-size:9.5px;color:#64748b;">${esc(CONFIG.COMPANY.NAME)}</div>
      </div>
    `;
  }

  function renderBankAndSignature(doc) {
    const rawBanks = (doc && Array.isArray(doc.bankDetails)) ? doc.bankDetails : (CONFIG.BANK_DETAILS || []);
    const banks = rawBanks.filter(b => hasText(b.bankName) || hasText(b.accountNumber));
    const bankHtml = banks.map(b => `
      <div style="margin-bottom:12px;">
        <strong>${esc(b.bankName)}</strong>${hasText(b.accountName) ? ` — ${esc(b.accountName)}` : ''}<br>
        ${hasText(b.accountNumber) ? `A/C: <span class="mono">${esc(b.accountNumber)}</span>` : ''}${hasText(b.branch) ? ` | ${esc(b.branch)}` : ''}${hasText(b.routingNo) ? ` | <span class="mono">${esc(b.routingNo)}</span>` : ''}
      </div>
    `).join('');

    if (!banks.length) {
      return `<div style="display:flex;justify-content:flex-end;margin-top:16px;">${renderSignatureBlock('width:220px;')}</div>`;
    }

    return `
      <div class="a4-bank-sign-grid">
        <div class="a4-box">
          <div class="a4-box-title">Bank &amp; Payment Details</div>
          <div style="font-size:11px;line-height:1.5;">${bankHtml}</div>
        </div>
        ${renderSignatureBlock()}
      </div>
    `;
  }

  function renderFooter() {
    const c = CONFIG.COMPANY;
    return `
      <div class="a4-footer">
        <img class="a4-footer-banner" src="${c.BANNER_PATH}" alt="TourBuzz Footer Banner" onerror="this.style.display='none'">
        <div class="a4-footer-note">
          ${esc(c.NAME)} · ${esc(c.WEBSITE)} · fb.com/${esc(c.FACEBOOK)} · Computer-generated official document.
        </div>
      </div>
    `;
  }

  /* ------------------------------------------------------------------------
     1. Commercial & Tour Invoice (Components only show when populated)
     ------------------------------------------------------------------------ */
  function renderInvoice(doc) {
    const cur = doc.currency || 'BDT';
    const rawItems = Array.isArray(doc.items) ? doc.items : [];
    const items = rawItems.filter(it => hasText(it.description) || hasText(it.details) || toNum(it.unitPrice) > 0);

    const subtotal = items.reduce((s, it) => s + (toNum(it.qty) * toNum(it.unitPrice)), 0);
    const taxPct = toNum(doc.taxPercent);
    const taxAmt = subtotal * (taxPct / 100);
    const serviceFee = toNum(doc.serviceFee);
    const discount = toNum(doc.discount);
    const grandTotal = Math.max(0, subtotal + taxAmt + serviceFee - discount);
    const paid = toNum(doc.paidAmount);
    const due = Math.max(0, grandTotal - paid);
    const status = doc.status || (grandTotal > 0 ? (due <= 0.005 ? 'PAID' : (paid > 0 ? 'PARTIAL' : 'UNPAID')) : '');

    // Build Billed To block only if any client field is filled
    const billedLines = [
      hasText(doc.clientName) ? `<div style="font-weight:700;font-size:13px;color:#102542;">${esc(doc.clientName)}</div>` : '',
      hasText(doc.clientCompany) ? `<div>${esc(doc.clientCompany)}</div>` : '',
      hasText(doc.clientPhone) ? `<div>Phone: ${esc(doc.clientPhone)}</div>` : '',
      hasText(doc.clientEmail) ? `<div>Email: ${esc(doc.clientEmail)}</div>` : '',
      hasText(doc.clientAddress) ? `<div>${esc(doc.clientAddress)}</div>` : ''
    ].filter(Boolean);

    // Build Reference block only for filled fields
    const refLines = [
      hasText(cur) ? `<div><strong>Currency:</strong> ${esc(cur)}</div>` : '',
      hasText(doc.dueDate) ? `<div><strong>Due Date:</strong> ${esc(fmtDate(doc.dueDate))}</div>` : '',
      hasText(doc.tripRef) ? `<div><strong>Trip / File Ref:</strong> ${esc(doc.tripRef)}</div>` : '',
      hasText(doc.preparedBy) ? `<div><strong>Prepared By:</strong> ${esc(doc.preparedBy)}</div>` : ''
    ].filter(Boolean);

    const infoBoxes = [];
    if (billedLines.length) {
      infoBoxes.push(`<div class="a4-box"><div class="a4-box-title">Billed To</div>${billedLines.join('')}</div>`);
    }
    if (refLines.length) {
      infoBoxes.push(`<div class="a4-box"><div class="a4-box-title">Invoice Reference</div>${refLines.join('')}</div>`);
    }

    const infoSection = infoBoxes.length
      ? `<div class="a4-info-grid" style="${infoBoxes.length === 1 ? 'grid-template-columns:1fr;' : ''}">${infoBoxes.join('')}</div>`
      : '';

    const itemsTable = items.length ? `
      <table class="a4-table">
        <thead>
          <tr>
            <th class="text-center" style="width:36px;">#</th>
            <th>Service Description</th>
            <th class="text-center" style="width:58px;">Qty</th>
            <th class="text-right" style="width:125px;">Unit Price</th>
            <th class="text-right" style="width:130px;">Line Total</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((it, idx) => {
            const lineTotal = toNum(it.qty) * toNum(it.unitPrice);
            return `<tr>
              <td class="text-center">${idx + 1}</td>
              <td><strong>${esc(it.description)}</strong>${hasText(it.details) ? `<div style="font-size:10.5px;color:#64748b;">${esc(it.details)}</div>` : ''}</td>
              <td class="text-center mono">${toNum(it.qty)}</td>
              <td class="text-right mono">${fmtMoney(it.unitPrice, cur)}</td>
              <td class="text-right mono"><strong>${fmtMoney(lineTotal, cur)}</strong></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    ` : '';

    const hasFinancials = grandTotal > 0 || paid > 0 || subtotal > 0 || serviceFee > 0 || discount > 0;
    const totalsRows = [];
    if (subtotal > 0) totalsRows.push(`<tr><td>Subtotal</td><td class="text-right mono">${fmtMoney(subtotal, cur)}</td></tr>`);
    if (taxAmt > 0) totalsRows.push(`<tr><td>Tax / VAT (${taxPct}%)</td><td class="text-right mono">${fmtMoney(taxAmt, cur)}</td></tr>`);
    if (serviceFee > 0) totalsRows.push(`<tr><td>Service Charge</td><td class="text-right mono">${fmtMoney(serviceFee, cur)}</td></tr>`);
    if (discount > 0) totalsRows.push(`<tr><td>Discount</td><td class="text-right mono">- ${fmtMoney(discount, cur)}</td></tr>`);
    if (grandTotal > 0) totalsRows.push(`<tr class="grand"><td>Grand Total</td><td class="text-right mono">${fmtMoney(grandTotal, cur)}</td></tr>`);
    if (paid > 0) totalsRows.push(`<tr><td>Paid Amount</td><td class="text-right mono">${fmtMoney(paid, cur)}</td></tr>`);
    if (grandTotal > 0 && (paid > 0 || due > 0)) {
      totalsRows.push(`<tr class="${due <= 0.005 ? 'paid-ok' : 'due'}"><td>Balance Due</td><td class="text-right mono">${fmtMoney(due, cur)}</td></tr>`);
    }

    const wordsBox = grandTotal > 0
      ? `<div class="a4-words-box"><div style="font-size:9.5px;font-weight:700;text-transform:uppercase;color:#f5820b;">Amount In Words</div><div style="font-weight:600;color:#102542;margin-top:2px;">${esc(window.TourBuzzApp.amountToWords(grandTotal, cur))}</div></div>`
      : '<div style="flex:1;"></div>';

    const totalsSection = hasFinancials ? `
      <div class="a4-totals-row">
        ${wordsBox}
        ${totalsRows.length ? `<table class="a4-totals-table">${totalsRows.join('')}</table>` : ''}
      </div>
    ` : '';

    const notesBelowBank = hasText(doc.notes) ? `
      <div class="a4-box" style="margin-top:16px;background:#fff7ed;border-color:#fed7aa;font-size:11px;color:#334155;">
        <strong>Notes:</strong> ${esc(doc.notes)}
      </div>
    ` : '';

    return `
      <div class="sheet" data-doc-type="invoice">
        <div class="sheet-body">
          ${renderHeader('INVOICE', doc.docNo, doc.date, status)}
          ${infoSection}
          ${itemsTable}
          ${totalsSection}
          <div class="a4-smart-spacer"></div>
          <div class="a4-bottom-block">
            ${renderBankAndSignature(doc)}
            ${notesBelowBank}
          </div>
        </div>
        ${renderFooter()}
      </div>
    `;
  }

  /* ------------------------------------------------------------------------
     2. Multi-Hotel & Land Service Voucher
     ------------------------------------------------------------------------ */
  function renderVoucher(doc) {
    const hotels = Array.isArray(doc.hotels) ? doc.hotels : [];
    const hotelCards = hotels.length ? hotels.map((h, idx) => {
      const nights = window.TourBuzzApp.calcNights(h.checkIn, h.checkOut);
      return `
        <div class="a4-box" style="margin-bottom:12px;background:#ffffff;border:1px solid #cbd5e1;">
          <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e2e8f0;padding-bottom:6px;margin-bottom:8px;">
            <div>
              <span style="background:#f5820b;color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:4px;margin-right:6px;">HOTEL ${idx + 1}</span>
              <strong style="font-size:13.5px;color:#102542;">${esc(h.hotelName || 'Hotel Name')}</strong>
            </div>
            <div class="mono" style="font-size:11px;font-weight:700;color:#157f3d;">Conf #: ${esc(h.confirmationNo || 'PENDING')}</div>
          </div>
          ${(hasText(h.hotelAddress) || hasText(h.hotelPhone)) ? `<div style="font-size:10.5px;color:#475569;margin-bottom:8px;">${hasText(h.hotelAddress) ? `📍 ${esc(h.hotelAddress)}` : ''} ${hasText(h.hotelPhone) ? ` · ☎ ${esc(h.hotelPhone)}` : ''}</div>` : ''}
          <table class="a4-table" style="margin-bottom:0;">
            <thead>
              <tr>
                <th>Check-In</th>
                <th>Check-Out</th>
                <th class="text-center">Nights</th>
                <th>Room Type &amp; Count</th>
                <th>Meal Plan</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="mono"><strong>${esc(fmtDate(h.checkIn))}</strong></td>
                <td class="mono"><strong>${esc(fmtDate(h.checkOut))}</strong></td>
                <td class="text-center mono"><strong>${nights}</strong></td>
                <td>${esc(h.roomType || 'Standard Room')} (${esc(h.rooms || 1)} Room)</td>
                <td><strong>${esc(h.mealPlan || 'BB')}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    }).join('') : `<div class="a4-box">No hotels added yet.</div>`;

    return `
      <div class="sheet" data-doc-type="voucher">
        <div class="sheet-body">
          ${renderHeader('Hotel & Service Voucher', doc.docNo, doc.date, doc.status || 'CONFIRMED')}
          <div class="a4-info-grid">
            <div class="a4-box">
              <div class="a4-box-title">Guest Information</div>
              <div style="font-weight:700;font-size:13px;color:#102542;">Lead Guest: ${esc(doc.clientName || '—')}</div>
              ${hasText(doc.accompanyingGuests) ? `<div style="margin-top:3px;"><strong>Accompanying:</strong> ${esc(doc.accompanyingGuests)}</div>` : ''}
              ${hasText(doc.guestPhone) ? `<div>Contact: ${esc(doc.guestPhone)}</div>` : ''}
            </div>
            <div class="a4-box">
              <div class="a4-box-title">Occupancy &amp; Reference</div>
              <div><strong>Pax Breakdown:</strong> ${toNum(doc.adults || 1)} Adult(s), ${toNum(doc.children || 0)} Child(ren), ${toNum(doc.infants || 0)} Infant(s)</div>
              <div><strong>Booking Ref:</strong> <span class="mono">${esc(doc.bookingRef || doc.docNo)}</span></div>
              <div><strong>Emergency 24/7:</strong> ${esc(CONFIG.COMPANY.PHONE)}</div>
            </div>
          </div>

          ${hotelCards}

          ${hasText(doc.landServices) ? `
            <div class="a4-box" style="margin-bottom:12px;">
              <div class="a4-box-title">Transfers &amp; Land Services Included</div>
              <div style="white-space:pre-line;font-size:11px;">${esc(doc.landServices)}</div>
            </div>
          ` : ''}

          <div class="a4-box" style="background:#fff7ed;border-color:#fed7aa;margin-bottom:12px;">
            <div class="a4-box-title">Special Requests &amp; Important Check-In Notes</div>
            <div style="white-space:pre-line;font-size:10.8px;color:#334155;">${esc(doc.remarks || 'Standard hotel check-in is 14:00 hrs and check-out is 12:00 hrs. Please present this voucher along with a valid passport / photo ID at reception. Incidental charges (minibar, laundry, etc.) are payable directly by the guest.')}</div>
          </div>

        </div>
        ${renderFooter()}
      </div>
    `;
  }

  /* ------------------------------------------------------------------------
     3. Official Money Receipt
     ------------------------------------------------------------------------ */
  function renderReceipt(doc) {
    const cur = doc.currency || 'BDT';
    const amt = toNum(doc.amount);
    return `
      <div class="sheet" data-doc-type="receipt">
        <div class="sheet-body">
          ${renderHeader('Official Money Receipt', doc.docNo, doc.date, doc.status || 'PAID')}

          <div style="border:2px solid #102542;border-radius:10px;padding:18px;background:#ffffff;margin-bottom:18px;">
            <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px dashed #cbd5e1;padding-bottom:12px;margin-bottom:14px;">
              <div>
                <div style="font-size:10px;text-transform:uppercase;color:#64748b;font-weight:700;">Received With Thanks From</div>
                <div style="font-size:17px;font-weight:800;color:#102542;margin-top:2px;">${esc(doc.clientName || '—')}</div>
                ${hasText(doc.clientPhone) ? `<div style="font-size:11px;color:#475569;">Contact: ${esc(doc.clientPhone)}</div>` : ''}
              </div>
              <div style="background:#102542;color:#ffffff;padding:10px 16px;border-radius:8px;text-align:right;">
                <div style="font-size:9.5px;text-transform:uppercase;color:#fdba74;letter-spacing:0.06em;">Amount Received</div>
                <div class="mono" style="font-size:19px;font-weight:800;">${fmtMoney(amt, cur)}</div>
              </div>
            </div>

            <div class="a4-words-box" style="margin-bottom:14px;">
              <div style="font-size:9.5px;font-weight:700;text-transform:uppercase;color:#f5820b;">Sum In Words</div>
              <div style="font-size:12.5px;font-weight:700;color:#102542;margin-top:2px;">${esc(window.TourBuzzApp.amountToWords(amt, cur))}</div>
            </div>

            <table class="a4-table" style="margin-bottom:0;">
              <tbody>
                <tr>
                  <td style="width:32%;font-weight:700;background:#f8fafc;">Payment Mode</td>
                  <td><strong>${esc(doc.paymentMode || 'Cash')}</strong></td>
                </tr>
                ${hasText(doc.txRef) ? `<tr><td style="font-weight:700;background:#f8fafc;">Cheque / Transaction Ref</td><td class="mono">${esc(doc.txRef)}</td></tr>` : ''}
                ${hasText(doc.againstInvoice) ? `<tr><td style="font-weight:700;background:#f8fafc;">Against Invoice / File #</td><td class="mono"><strong>${esc(doc.againstInvoice)}</strong></td></tr>` : ''}
                ${hasText(doc.purpose) ? `<tr><td style="font-weight:700;background:#f8fafc;">Purpose / Particulars</td><td>${esc(doc.purpose)}</td></tr>` : ''}
                ${hasText(doc.receivedBy) ? `<tr><td style="font-weight:700;background:#f8fafc;">Received By</td><td>${esc(doc.receivedBy)}</td></tr>` : ''}
              </tbody>
            </table>
          </div>

          <div style="display:flex;justify-content:flex-end;margin-top:18px;">
            ${renderSignatureBlock('width:220px;')}
          </div>

          <div style="margin-top:22px;font-size:10.5px;color:#64748b;text-align:center;">
            Note: Payments made by cheque are subject to realization. Please preserve this receipt for future reference.
          </div>
        </div>
        ${renderFooter()}
      </div>
    `;
  }

  /* ------------------------------------------------------------------------
     4. Tour & Package Quotation
     ------------------------------------------------------------------------ */
  function renderQuotation(doc) {
    const cur = doc.currency || 'BDT';
    const items = Array.isArray(doc.items) ? doc.items : [];
    const total = items.reduce((s, it) => s + (toNum(it.qty) * toNum(it.unitPrice)), 0);

    const rows = items.length ? items.map((it, idx) => `
      <tr>
        <td class="text-center">${idx + 1}</td>
        <td><strong>${esc(it.description || 'Package Component')}</strong></td>
        <td class="text-center mono">${toNum(it.qty)}</td>
        <td class="text-right mono">${fmtMoney(it.unitPrice, cur)}</td>
        <td class="text-right mono"><strong>${fmtMoney(toNum(it.qty) * toNum(it.unitPrice), cur)}</strong></td>
      </tr>
    `).join('') : `<tr><td colspan="5" class="text-center" style="color:#64748b;">No package items added yet.</td></tr>`;

    const bulletLines = text => {
      const lines = String(text || '').split('\n').map(l => l.trim()).filter(Boolean);
      if (!lines.length) return '<div style="color:#64748b;">—</div>';
      return `<ul style="margin:4px 0 0;padding-left:16px;font-size:10.8px;">${lines.map(l => `<li style="margin-bottom:3px;">${esc(l.replace(/^[-•*]\s*/, ''))}</li>`).join('')}</ul>`;
    };

    return `
      <div class="sheet" data-doc-type="quotation">
        <div class="sheet-body">
          ${renderHeader('Tour Quotation', doc.docNo, doc.date, doc.status || 'OPEN')}

          <div style="background:#102542;color:#ffffff;padding:10px 14px;border-radius:8px;margin-bottom:14px;">
            <div style="font-size:9.5px;text-transform:uppercase;color:#fdba74;letter-spacing:0.06em;">Proposal Subject</div>
            <div style="font-size:15px;font-weight:700;">${esc(doc.subject || 'Custom Tour Package Proposal')}</div>
          </div>

          <div class="a4-info-grid">
            <div class="a4-box">
              <div class="a4-box-title">Prepared For</div>
              <div style="font-weight:700;font-size:13px;color:#102542;">${esc(doc.clientName || '—')}</div>
              ${hasText(doc.clientPhone) ? `<div>Phone: ${esc(doc.clientPhone)}</div>` : ''}
              ${hasText(doc.clientEmail) ? `<div>Email: ${esc(doc.clientEmail)}</div>` : ''}
            </div>
            <div class="a4-box">
              <div class="a4-box-title">Trip Parameters</div>
              <div><strong>Travel Dates:</strong> ${esc(doc.travelDates || 'Flexible')}</div>
              <div><strong>Pax Count:</strong> ${esc(doc.paxCount || '2 Adults')}</div>
              <div><strong>Valid Until:</strong> <strong style="color:#dc2626;">${esc(fmtDate(doc.validUntil))}</strong></div>
            </div>
          </div>

          <table class="a4-table">
            <thead>
              <tr>
                <th class="text-center" style="width:36px;">#</th>
                <th>Package &amp; Pricing Breakdown</th>
                <th class="text-center" style="width:55px;">Qty</th>
                <th class="text-right" style="width:125px;">Rate</th>
                <th class="text-right" style="width:130px;">Total</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
            <tfoot>
              <tr style="background:#102542;color:#ffffff;font-weight:700;">
                <td colspan="4" class="text-right" style="padding:8.5px 10px;">ESTIMATED PACKAGE TOTAL (${esc(cur)})</td>
                <td class="text-right mono" style="padding:8.5px 10px;">${fmtMoney(total, cur)}</td>
              </tr>
            </tfoot>
          </table>

          <div class="a4-info-grid">
            <div class="a4-box" style="background:#f0fdf4;border-color:#bbf7d0;">
              <div class="a4-box-title" style="color:#157f3d;">✓ Package Inclusions</div>
              ${bulletLines(doc.inclusions)}
            </div>
            <div class="a4-box" style="background:#fef2f2;border-color:#fecaca;">
              <div class="a4-box-title" style="color:#dc2626;">✕ Package Exclusions</div>
              ${bulletLines(doc.exclusions)}
            </div>
          </div>

          ${hasText(doc.terms) ? `
            <div class="a4-box" style="margin-bottom:10px;">
              <div class="a4-box-title">Terms &amp; Conditions</div>
              <div style="white-space:pre-line;font-size:10.5px;color:#334155;">${esc(doc.terms)}</div>
            </div>
          ` : ''}
        </div>
        ${renderFooter()}
      </div>
    `;
  }

  /* ------------------------------------------------------------------------
     5. GDS-Style Airline E-Ticket (Resilient Multi-CDN Airline Logos + Barcode/QR)
     ------------------------------------------------------------------------ */
  function airlineFallbackSvg(iata) {
    const code = encodeURIComponent((iata || 'AIR').slice(0, 3).toUpperCase());
    return `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'><rect width='64' height='64' rx='10' fill='%23102542'/><text x='32' y='40' text-anchor='middle' font-family='sans-serif' font-size='22' font-weight='bold' fill='%23f5820b'>${code}</text></svg>`;
  }

  window.tbHandleAirlineLogoError = function (img) {
    const iata = (img.dataset.iata || 'AIR').toUpperCase();
    const step = parseInt(img.dataset.fallbackStep || '0', 10);
    if (step === 0) {
      img.dataset.fallbackStep = '1';
      img.src = `https://pics.avs.io/64/64/${encodeURIComponent(iata)}.png`;
    } else if (step === 1) {
      img.dataset.fallbackStep = '2';
      img.src = `https://content.airhex.com/content/logos/airlines_${encodeURIComponent(iata)}_64_64_s.png`;
    } else {
      img.onerror = null;
      img.src = airlineFallbackSvg(iata);
    }
  };

  function renderTicket(doc) {
    const passengers = Array.isArray(doc.passengers) ? doc.passengers : [];
    const segments = Array.isArray(doc.segments) ? doc.segments : [];
    const pnr = (doc.pnr || 'TB0000').toUpperCase();

    const paxRows = passengers.length ? passengers.map((p, idx) => `
      <tr>
        <td class="text-center">${idx + 1}</td>
        <td><strong>${esc((p.name || 'PASSENGER NAME').toUpperCase())}</strong></td>
        <td class="text-center"><span class="a4-status-pill a4-status-navy" style="margin:0;">${esc(p.type || 'ADT')}</span></td>
        <td class="mono"><strong>${esc(p.ticketNo || '000-0000000000')}</strong></td>
        <td class="text-center mono">${esc(p.seat || 'TBA')}</td>
      </tr>
    `).join('') : `<tr><td colspan="5" class="text-center" style="color:#64748b;">No passengers added.</td></tr>`;

    const segCards = segments.length ? segments.map((s, idx) => {
      const iata = (s.airlineIata || 'BG').toUpperCase().slice(0, 3);
      const logoUrl = `https://images.kiwi.com/airlines/64/${encodeURIComponent(iata)}.png`;
      return `
        <div class="gds-segment-card">
          <div class="gds-seg-head">
            <div class="gds-seg-airline">
              <img class="gds-airline-logo" src="${logoUrl}" data-iata="${esc(iata)}" data-fallback-step="0" alt="${esc(iata)}" onerror="window.tbHandleAirlineLogoError(this)">
              <span style="font-size:11.5px;">${esc(s.airlineName || iata)} · <span class="mono">${esc(s.flightNo || iata + '001')}</span></span>
            </div>
            <div>
              <span class="mono" style="margin-right:8px;font-size:10.5px;">Class: <strong>${esc(s.cabin || 'Economy (Y)')}</strong></span>
              <span class="a4-status-pill ${statusClass(s.status || 'CONFIRMED')}" style="margin:0;">${esc(s.status || 'CONFIRMED')}</span>
            </div>
          </div>
          <div class="gds-seg-body">
            <div>
              <div class="gds-iata">${esc((s.originIata || 'DAC').toUpperCase())}</div>
              <div class="gds-city">${esc(s.originCity || 'Dhaka')} ${hasText(s.originTerminal) ? `· T-${esc(s.originTerminal)}` : ''}</div>
              <div class="gds-time">${esc(fmtDate(s.depDate))} ${esc(s.depTime || '00:00')}</div>
            </div>
            <div class="gds-arrow">
              <div style="font-size:14px;">✈</div>
              <div style="font-size:9px;color:#64748b;">LEG ${idx + 1}</div>
            </div>
            <div>
              <div class="gds-iata">${esc((s.destIata || 'DXB').toUpperCase())}</div>
              <div class="gds-city">${esc(s.destCity || 'Dubai')} ${hasText(s.destTerminal) ? `· T-${esc(s.destTerminal)}` : ''}</div>
              <div class="gds-time">${esc(fmtDate(s.arrDate))} ${esc(s.arrTime || '00:00')}</div>
            </div>
            <div style="font-size:10.5px;border-left:1px solid #e2e8f0;padding-left:10px;">
              <div><strong>Baggage:</strong> ${esc(s.baggage || '30 KG')}</div>
              <div><strong>Fare Basis:</strong> <span class="mono">${esc(s.fareBasis || 'YOWBD')}</span></div>
            </div>
          </div>
        </div>
      `;
    }).join('') : `<div class="a4-box">No flight segments added.</div>`;

    return `
      <div class="sheet" data-doc-type="ticket">
        <div class="sheet-body">
          ${renderHeader('Electronic Ticket Itinerary', doc.docNo, doc.date, doc.status || 'ISSUED')}

          <div class="gds-top-strip">
            <div>
              <div style="font-size:9.5px;text-transform:uppercase;color:#cbd5e1;">Booking Reference (PNR)</div>
              <div class="gds-pnr-val">${esc(pnr)}</div>
            </div>
            <div>
              <div style="font-size:9.5px;text-transform:uppercase;color:#cbd5e1;">Airline Ref / GDS</div>
              <div class="mono" style="font-size:14px;font-weight:700;">${esc((doc.airlinePnr || pnr).toUpperCase())}</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:9.5px;text-transform:uppercase;color:#cbd5e1;">Issuing Office</div>
              <div style="font-size:12px;font-weight:600;">TourBuzz Travel Services Ltd. (DAC)</div>
            </div>
          </div>

          <table class="a4-table">
            <thead>
              <tr>
                <th class="text-center" style="width:32px;">#</th>
                <th>Passenger Name (As Per Passport)</th>
                <th class="text-center" style="width:65px;">Type</th>
                <th style="width:165px;">E-Ticket Number</th>
                <th class="text-center" style="width:65px;">Seat</th>
              </tr>
            </thead>
            <tbody>${paxRows}</tbody>
          </table>

          ${segCards}

          <div class="gds-codes-row">
            <div style="flex:1;">
              <div style="font-size:9.5px;font-weight:700;text-transform:uppercase;color:#102542;margin-bottom:4px;">CODE-128 PNR / E-Ticket Verification Barcode</div>
              <svg class="tb-barcode-svg" data-barcode-val="${esc(pnr)}"></svg>
              <div style="font-size:9.5px;color:#64748b;margin-top:4px;">
                Please report at the airport check-in counter at least 3 hours prior to international departure (1.5 hours for domestic). Carry valid passport, visa, and printed e-ticket.
              </div>
            </div>
            <div style="text-align:center;">
              <div class="gds-qr-box tb-qrcode-box"></div>
              <div style="font-size:9px;color:#64748b;margin-top:3px;">Scan Itinerary</div>
            </div>
          </div>
        </div>
        ${renderFooter()}
      </div>
    `;
  }

  /* ------------------------------------------------------------------------
     6. Air Ticket Invoice (Components only show when populated)
     ------------------------------------------------------------------------ */
  function renderTicketInvoice(doc) {
    const cur = doc.currency || 'BDT';
    const totalFare = doc.totalFare !== undefined ? toNum(doc.totalFare) : (toNum(doc.baseFare) + toNum(doc.taxes));
    const aitVat = toNum(doc.aitVat);
    const serviceCharge = toNum(doc.serviceCharge);
    const discount = toNum(doc.discount);
    const grandTotal = Math.max(0, totalFare + aitVat + serviceCharge - discount);
    const paid = toNum(doc.paidAmount);
    const due = Math.max(0, grandTotal - paid);
    const status = doc.status || (grandTotal > 0 ? (due <= 0.005 ? 'PAID' : (paid > 0 ? 'PARTIAL' : 'UNPAID')) : '');

    const billedLines = [
      hasText(doc.clientName) ? `<div style="font-weight:700;font-size:13px;color:#102542;">${esc(doc.clientName)}</div>` : '',
      hasText(doc.clientCompany) ? `<div>${esc(doc.clientCompany)}</div>` : '',
      hasText(doc.clientPhone) ? `<div>Phone: ${esc(doc.clientPhone)}</div>` : '',
      hasText(doc.clientEmail) ? `<div>Email: ${esc(doc.clientEmail)}</div>` : ''
    ].filter(Boolean);

    const flightLines = [
      hasText(doc.pnr) ? `<div><strong>PNR:</strong> <span class="mono" style="color:#f5820b;font-weight:700;">${esc(doc.pnr.toUpperCase())}</span></div>` : '',
      hasText(doc.airline) ? `<div><strong>Airline:</strong> ${esc(doc.airline)}</div>` : '',
      hasText(doc.sector) ? `<div><strong>Sector:</strong> <span class="mono">${esc(doc.sector)}</span></div>` : '',
      hasText(doc.travelDate) ? `<div><strong>Travel Date:</strong> ${esc(fmtDate(doc.travelDate))}</div>` : ''
    ].filter(Boolean);

    const infoBoxes = [];
    if (billedLines.length) infoBoxes.push(`<div class="a4-box"><div class="a4-box-title">Billed To</div>${billedLines.join('')}</div>`);
    if (flightLines.length) infoBoxes.push(`<div class="a4-box"><div class="a4-box-title">Flight &amp; Ticket Summary</div>${flightLines.join('')}</div>`);
    const infoSection = infoBoxes.length
      ? `<div class="a4-info-grid" style="${infoBoxes.length === 1 ? 'grid-template-columns:1fr;' : ''}">${infoBoxes.join('')}</div>`
      : '';

    const paxBox = hasText(doc.passengerList) ? `
      <div class="a4-box" style="margin-bottom:16px;">
        <div class="a4-box-title">Passenger(s) &amp; E-Ticket Numbers</div>
        <div style="white-space:pre-line;font-size:11.5px;font-weight:600;color:#102542;">${esc(doc.passengerList)}</div>
      </div>
    ` : '';

    const fareRows = [];
    if (totalFare > 0) fareRows.push(`<tr><td>Total Fare (inc. tax)</td><td class="text-right mono">${fmtMoney(totalFare, cur)}</td></tr>`);
    if (aitVat > 0) fareRows.push(`<tr><td>AIT / Government VAT</td><td class="text-right mono">${fmtMoney(aitVat, cur)}</td></tr>`);
    if (serviceCharge > 0) fareRows.push(`<tr><td>Agency Service Charge</td><td class="text-right mono">${fmtMoney(serviceCharge, cur)}</td></tr>`);
    if (discount > 0) fareRows.push(`<tr><td>Special Discount</td><td class="text-right mono" style="color:#157f3d;">- ${fmtMoney(discount, cur)}</td></tr>`);

    const fareTable = fareRows.length ? `
      <table class="a4-table">
        <thead>
          <tr>
            <th>Fare Component</th>
            <th class="text-right" style="width:170px;">Amount (${esc(cur)})</th>
          </tr>
        </thead>
        <tbody>${fareRows.join('')}</tbody>
      </table>
    ` : '';

    const totalsRows = [];
    if (grandTotal > 0) totalsRows.push(`<tr class="grand"><td>Grand Total</td><td class="text-right mono">${fmtMoney(grandTotal, cur)}</td></tr>`);
    if (paid > 0) totalsRows.push(`<tr><td>Paid Amount</td><td class="text-right mono">${fmtMoney(paid, cur)}</td></tr>`);
    if (grandTotal > 0 && (paid > 0 || due > 0)) {
      totalsRows.push(`<tr class="${due <= 0.005 ? 'paid-ok' : 'due'}"><td>Balance Due</td><td class="text-right mono">${fmtMoney(due, cur)}</td></tr>`);
    }

    const wordsBox = grandTotal > 0
      ? `<div class="a4-words-box"><div style="font-size:9.5px;font-weight:700;text-transform:uppercase;color:#f5820b;">Total Payable In Words</div><div style="font-weight:600;color:#102542;margin-top:2px;">${esc(window.TourBuzzApp.amountToWords(grandTotal, cur))}</div></div>`
      : '<div style="flex:1;"></div>';

    const totalsSection = totalsRows.length ? `
      <div class="a4-totals-row">
        ${wordsBox}
        <table class="a4-totals-table">${totalsRows.join('')}</table>
      </div>
    ` : '';

    const notesBelowBank = hasText(doc.notes) ? `
      <div class="a4-box" style="margin-top:16px;background:#fff7ed;border-color:#fed7aa;font-size:11px;color:#334155;">
        <strong>Notes:</strong> ${esc(doc.notes)}
      </div>
    ` : '';

    return `
      <div class="sheet" data-doc-type="ticket-invoice">
        <div class="sheet-body">
          ${renderHeader('Air Ticket Invoice', doc.docNo, doc.date, status)}
          ${infoSection}
          ${paxBox}
          ${fareTable}
          ${totalsSection}
          <div class="a4-smart-spacer"></div>
          <div class="a4-bottom-block">
            ${renderBankAndSignature(doc)}
            ${notesBelowBank}
          </div>
        </div>
        ${renderFooter()}
      </div>
    `;
  }

  /* ------------------------------------------------------------------------
     7. Visa Processing & Submitted-Documents Checklist Sheet
     ------------------------------------------------------------------------ */
  function renderVisa(doc) {
    const checklist = Array.isArray(doc.checklist) ? doc.checklist : [];
    const submittedCount = checklist.filter(c => c.checked).length;

    const itemsHtml = checklist.map(item => `
      <div class="visa-check-item ${item.checked ? 'checked' : ''}">
        <span style="font-size:13px;">${item.checked ? '☑' : '☐'}</span>
        <span>${esc(item.label)}</span>
      </div>
    `).join('');

    return `
      <div class="sheet" data-doc-type="visa">
        <div class="sheet-body">
          ${renderHeader('Visa File & Checklist', doc.docNo, doc.date, doc.status || 'PROCESSING')}

          <div class="a4-info-grid">
            <div class="a4-box">
              <div class="a4-box-title">Applicant Details</div>
              <div style="font-weight:700;font-size:13.5px;color:#102542;">${esc(doc.clientName || '—')}</div>
              <div><strong>Passport No:</strong> <span class="mono" style="font-weight:700;">${esc((doc.passportNo || '—').toUpperCase())}</span></div>
              <div><strong>Nationality:</strong> ${esc(doc.nationality || 'Bangladeshi')}</div>
              ${hasText(doc.clientPhone) ? `<div><strong>Contact:</strong> ${esc(doc.clientPhone)}</div>` : ''}
            </div>
            <div class="a4-box">
              <div class="a4-box-title">Visa Application Scope</div>
              <div><strong>Destination:</strong> <strong style="color:#f5820b;">${esc(doc.destination || '—')}</strong></div>
              <div><strong>Category:</strong> ${esc(doc.visaCategory || 'Tourist')}</div>
              <div><strong>Entry Type:</strong> ${esc(doc.entryType || 'Single Entry')}</div>
              <div><strong>Stay Duration:</strong> ${esc(doc.duration || '30 Days')}</div>
            </div>
          </div>

          <div class="a4-box" style="margin-bottom:14px;background:#ffffff;">
            <div class="a4-box-title" style="display:flex;justify-content:space-between;">
              <span>Submitted Documents Checklist</span>
              <span style="color:#157f3d;">${submittedCount} / ${checklist.length} Received</span>
            </div>
            <div class="visa-check-grid">${itemsHtml}</div>
          </div>

          <div class="a4-box" style="background:#fff7ed;border-color:#fed7aa;margin-bottom:14px;">
            <div class="a4-box-title">Embassy Remarks &amp; Declaration</div>
            <div style="white-space:pre-line;font-size:10.8px;color:#334155;">${esc(doc.remarks || 'All original documents received by TourBuzz Travel Services Ltd. are strictly for embassy / VFS visa submission. Visa approval, processing timeline, and validity rest solely at the discretion of the respective Embassy / Consulate. Visa fees are non-refundable once submitted.')}</div>
          </div>

        </div>
        ${renderFooter()}
      </div>
    `;
  }

  /* ------------------------------------------------------------------------
     8. Tour Itinerary (Multi-Page A4 Supported)
     ------------------------------------------------------------------------ */
  function renderItinerary(doc) {
    const days = Array.isArray(doc.days) ? doc.days : [];
    const bulletLines = text => {
      const lines = String(text || '').split('\n').map(l => l.trim()).filter(Boolean);
      if (!lines.length) return '';
      return `<ul style="margin:4px 0 0;padding-left:18px;font-size:11px;">${lines.map(l => `<li style="margin-bottom:3px;">${esc(l.replace(/^[-•*]\s*/, ''))}</li>`).join('')}</ul>`;
    };

    const dayCards = days.length ? days.map((d, idx) => `
      <div class="itn-day-card">
        <div class="itn-day-head">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <span class="itn-day-badge">DAY ${d.dayNo || idx + 1}</span>
            <strong style="font-size:13px;color:#102542;">${esc(d.title || 'Day Plan')}</strong>
          </div>
          <div style="font-size:10.5px;color:#475569;font-weight:600;">
            ${hasText(d.date) ? `<span class="mono">${esc(fmtDate(d.date))}</span>` : ''}
            ${hasText(d.meals) ? `<span style="margin-left:8px;color:#157f3d;">🍽 ${esc(d.meals)}</span>` : ''}
          </div>
        </div>
        ${hasText(d.details) ? `<div style="white-space:pre-line;font-size:11.5px;color:#1e293b;line-height:1.55;">${esc(d.details)}</div>` : ''}
        ${hasText(d.hotel) ? `<div style="margin-top:7px;padding-top:5px;border-top:1px dashed #e2e8f0;font-size:10.8px;color:#102542;"><strong>🏨 Overnight Stay:</strong> ${esc(d.hotel)}</div>` : ''}
      </div>
    `).join('') : `<div class="a4-box">Add days in the form to build your day-by-day tour itinerary.</div>`;

    const hasInc = hasText(doc.inclusions);
    const hasExc = hasText(doc.exclusions);
    const incExcHtml = (hasInc || hasExc) ? `
      <div class="a4-info-grid" style="${(hasInc && hasExc) ? '' : 'grid-template-columns:1fr;'}break-inside:avoid;page-break-inside:avoid;">
        ${hasInc ? `<div class="a4-box" style="background:#f0fdf4;border-color:#bbf7d0;"><div class="a4-box-title" style="color:#157f3d;">✓ Tour Inclusions</div>${bulletLines(doc.inclusions)}</div>` : ''}
        ${hasExc ? `<div class="a4-box" style="background:#fef2f2;border-color:#fecaca;"><div class="a4-box-title" style="color:#dc2626;">✕ Tour Exclusions</div>${bulletLines(doc.exclusions)}</div>` : ''}
      </div>
    ` : '';

    return `
      <div class="sheet sheet-multipage" data-doc-type="itinerary">
        <div class="sheet-body">
          ${renderHeader('Tour Itinerary', doc.docNo, doc.date, doc.status || 'CONFIRMED')}

          ${hasText(doc.title) ? `
            <div style="background:#102542;color:#ffffff;padding:12px 16px;border-radius:8px;margin-bottom:16px;">
              <div style="font-size:9.5px;text-transform:uppercase;color:#fdba74;letter-spacing:0.06em;">Curated Travel Plan</div>
              <div style="font-size:16px;font-weight:700;">${esc(doc.title)}</div>
            </div>
          ` : ''}

          <div class="a4-info-grid">
            <div class="a4-box">
              <div class="a4-box-title">Traveler / Group</div>
              <div style="font-weight:700;font-size:13px;color:#102542;">${esc(doc.clientName || '—')}</div>
              ${hasText(doc.destination) ? `<div><strong>Destination:</strong> ${esc(doc.destination)}</div>` : ''}
              ${hasText(doc.paxCount) ? `<div><strong>Pax:</strong> ${esc(doc.paxCount)}</div>` : ''}
            </div>
            <div class="a4-box">
              <div class="a4-box-title">Trip Schedule</div>
              ${hasText(doc.travelDates) ? `<div><strong>Travel Dates:</strong> ${esc(doc.travelDates)}</div>` : ''}
              ${hasText(doc.duration) ? `<div><strong>Duration:</strong> ${esc(doc.duration)}</div>` : ''}
              <div><strong>24/7 Tour Support:</strong> ${esc(CONFIG.COMPANY.PHONE)}</div>
            </div>
          </div>

          ${hasText(doc.summary) ? `
            <div class="a4-box" style="background:#fff7ed;border-color:#fed7aa;margin-bottom:16px;">
              <div class="a4-box-title">Trip Overview</div>
              <div style="white-space:pre-line;font-size:11.2px;color:#334155;">${esc(doc.summary)}</div>
            </div>
          ` : ''}

          ${dayCards}
          ${incExcHtml}

          ${hasText(doc.notes) ? `
            <div class="a4-box" style="margin-bottom:14px;break-inside:avoid;page-break-inside:avoid;">
              <div class="a4-box-title">Important Travel Notes</div>
              <div style="white-space:pre-line;font-size:11px;color:#334155;">${esc(doc.notes)}</div>
            </div>
          ` : ''}
        </div>
        ${renderFooter()}
      </div>
    `;
  }

  /* ------------------------------------------------------------------------
     Post-Render Hydration (JsBarcode CODE-128 + QRCode for E-Tickets)
     ------------------------------------------------------------------------ */
  function hydrateSheetWidgets(container, doc) {
    if (!container || !doc || doc.type !== 'ticket') return;

    const svgEl = container.querySelector('.tb-barcode-svg');
    if (svgEl) {
      const firstTkt = (doc.passengers && doc.passengers[0] && doc.passengers[0].ticketNo) || '';
      const codeVal = (doc.pnr || firstTkt || doc.docNo || 'TOURBUZZ').toUpperCase().replace(/[^A-Z0-9-]/g, '');
      if (typeof window.JsBarcode === 'function') {
        try {
          window.JsBarcode(svgEl, codeVal, {
            format: 'CODE128',
            width: 1.6,
            height: 40,
            displayValue: true,
            fontSize: 11,
            font: 'JetBrains Mono, monospace',
            margin: 2,
            background: '#f8fafc',
            lineColor: '#102542'
          });
        } catch (err) {
          console.warn('JsBarcode fallback:', err);
        }
      } else {
        svgEl.outerHTML = `<div class="mono" style="font-size:13px;font-weight:700;padding:8px;border:1px solid #102542;display:inline-block;">*${esc(codeVal)}*</div>`;
      }
    }

    const qrBox = container.querySelector('.tb-qrcode-box');
    if (qrBox) {
      qrBox.innerHTML = '';
      const segSummary = (doc.segments || []).map(s => `${s.flightNo || ''} ${s.originIata || ''}-${s.destIata || ''} ${s.depDate || ''}`).join(' | ');
      const paxSummary = (doc.passengers || []).map(p => p.name).filter(Boolean).join(', ');
      const qrText = `TourBuzz E-Ticket | PNR: ${doc.pnr || ''} | Pax: ${paxSummary} | ${segSummary}`.slice(0, 260);
      if (typeof window.QRCode === 'function') {
        try {
          new window.QRCode(qrBox, {
            text: qrText,
            width: 70,
            height: 70,
            colorDark: '#102542',
            colorLight: '#ffffff',
            correctLevel: window.QRCode.CorrectLevel ? window.QRCode.CorrectLevel.M : 0
          });
        } catch (err) {
          qrBox.innerHTML = `<span class="mono" style="font-size:9px;">${esc(doc.pnr || 'QR')}</span>`;
        }
      } else {
        qrBox.innerHTML = `<span class="mono" style="font-size:9px;font-weight:700;">${esc(doc.pnr || 'PNR')}</span>`;
      }
    }
  }

  /* Public API */
  window.TourBuzzRenderers = {
    renderDocument: function (doc) {
      switch (doc.type) {
        case 'invoice': return renderInvoice(doc);
        case 'voucher': return renderVoucher(doc);
        case 'receipt': return renderReceipt(doc);
        case 'quotation': return renderQuotation(doc);
        case 'ticket': return renderTicket(doc);
        case 'ticket-invoice': return renderTicketInvoice(doc);
        case 'visa': return renderVisa(doc);
        case 'itinerary': return renderItinerary(doc);
        default: return `<div class="sheet"><div class="sheet-body">Unsupported document type: ${esc(doc.type)}</div></div>`;
      }
    },
    fitSinglePageSheet: function (container) {
      const sheet = container && container.querySelector('.sheet');
      if (!sheet || sheet.classList.contains('sheet-multipage')) return;
      const body = sheet.querySelector('.sheet-body');
      if (!body) return;
      body.style.zoom = '';
      // If content exceeds the 1-page A4 body area, gently scale body so nothing (Bank Details, Notes, Signature) ever clips
      const avail = body.clientHeight;
      const needed = body.scrollHeight;
      if (avail > 0 && needed > avail + 2) {
        const ratio = Math.max(0.68, (avail - 4) / needed);
        body.style.zoom = ratio.toFixed(3);
      }
    },
    renderInto: function (container, doc) {
      if (!container) return;
      container.innerHTML = this.renderDocument(doc);
      hydrateSheetWidgets(container, doc);
      requestAnimationFrame(() => this.fitSinglePageSheet(container));
    }
  };
})();
