/* ==========================================================================
   TourBuzz Travel Management System — Intelligent Pattern & Sequence Parser
   Extracts structured data from pasted text or uploaded PDFs for all 8 doc types
   ========================================================================== */

(function () {
  'use strict';

  const Parser = {};

  /* ------------------------------------------------------------------------
     PDF.js Lazy Loader & Line-Preserving PDF Text Extractor
     ------------------------------------------------------------------------ */
  let pdfJsPromise = null;

  function loadPdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (pdfJsPromise) return pdfJsPromise;
    pdfJsPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      s.onload = () => {
        if (window.pdfjsLib) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          resolve(window.pdfjsLib);
        } else {
          reject(new Error('PDF.js failed to initialize.'));
        }
      };
      s.onerror = () => reject(new Error('Could not load PDF.js (check internet connection).'));
      document.head.appendChild(s);
    });
    return pdfJsPromise;
  }

  Parser.extractTextFromFile = async function (file) {
    if (!file) throw new Error('No file selected.');
    const name = (file.name || '').toLowerCase();
    if (name.endsWith('.txt') || name.endsWith('.json') || name.endsWith('.csv') || file.type === 'text/plain') {
      return await file.text();
    }
    if (name.endsWith('.pdf') || file.type === 'application/pdf') {
      const pdfjs = await loadPdfJs();
      const buf = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: buf }).promise;
      const pages = [];
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        const rows = [];
        content.items.forEach(item => {
          const str = (item.str || '').trim();
          if (!str) return;
          const y = Math.round(item.transform[5]);
          const x = Math.round(item.transform[4]);
          let row = rows.find(r => Math.abs(r.y - y) <= 4);
          if (!row) {
            row = { y, items: [] };
            rows.push(row);
          }
          row.items.push({ x, str });
        });
        rows.sort((a, b) => b.y - a.y);
        const pageText = rows.map(r => {
          r.items.sort((a, b) => a.x - b.x);
          return r.items.map(i => i.str).join(' ');
        }).join('\n');
        pages.push(pageText);
      }
      return pages.join('\n\n');
    }
    throw new Error('Unsupported file type. Please upload a PDF or TXT file.');
  };

  /* ------------------------------------------------------------------------
     Core Pattern Recognition Primitives (Dates, Money, Phones, Emails, Aviation)
     ------------------------------------------------------------------------ */
  const MONTHS = {
    jan: '01', january: '01', feb: '02', february: '02', mar: '03', march: '03',
    apr: '04', april: '04', may: '05', jun: '06', june: '06', jul: '07', july: '07',
    aug: '08', august: '08', sep: '09', sept: '09', september: '09',
    oct: '10', october: '10', nov: '11', november: '11', dec: '12', december: '12'
  };

  function toISODate(raw) {
    if (!raw) return '';
    const s = String(raw).trim();
    // YYYY-MM-DD
    let m = s.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
    if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    // DD-MM-YYYY or DD/MM/YYYY
    m = s.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    // DD Mon, YYYY or DD Mon YYYY or DDMonYY (supports "23 Dec, 2026")
    m = s.match(/\b(\d{1,2})\s*[-]?\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?,?\s*[-]?\s*(20\d{2}|\d{2})?\b/i);
    if (m) {
      const dd = m[1].padStart(2, '0');
      const mm = MONTHS[m[2].toLowerCase().slice(0, 3)];
      const yy = m[3] ? (m[3].length === 2 ? '20' + m[3] : m[3]) : String(new Date().getFullYear());
      return `${yy}-${mm}-${dd}`;
    }
    // Mon DD, YYYY
    m = s.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(20\d{2})\b/i);
    if (m) {
      const mm = MONTHS[m[1].toLowerCase().slice(0, 3)];
      const dd = m[2].padStart(2, '0');
      return `${m[3]}-${mm}-${dd}`;
    }
    return '';
  }

  function extractAllDates(text) {
    const regex = /\b(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]20\d{2}|\d{1,2}\s*[-]?\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?,?(?:\s*[-]?\s*(?:20\d{2}|\d{2}))?|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s*20\d{2})\b/gi;
    const found = [];
    let m;
    while ((m = regex.exec(text)) !== null) {
      const iso = toISODate(m[0]);
      if (iso) found.push(iso);
    }
    return found;
  }

  function to24hTime(raw) {
    if (!raw) return '';
    const m = String(raw).trim().match(/(\d{1,2})[:.](\d{2})\s*(am|pm)?/i);
    if (!m) return '';
    let h = parseInt(m[1], 10);
    const min = m[2];
    const ap = (m[3] || '').toLowerCase();
    if (ap === 'pm' && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    if (h > 23) return '';
    return `${String(h).padStart(2, '0')}:${min}`;
  }

  function parseNumber(raw) {
    if (raw === null || raw === undefined) return 0;
    const cleaned = String(raw).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
    return cleaned ? parseFloat(cleaned[0]) : 0;
  }

  function matchLabel(text, labels) {
    for (const lbl of labels) {
      const re = new RegExp(`(?:^|[\\n\\r|•])\\s*${lbl}\\s*[:\\-–=#]?\\s*([^\\n\\r]+)`, 'i');
      const m = text.match(re);
      if (m && m[1] && m[1].trim()) return m[1].trim();
    }
    return '';
  }

  function matchAmountByLabel(text, labels) {
    for (const lbl of labels) {
      const re = new RegExp(`${lbl}[^\\n\\r0-9]{0,20}(?:BDT|USD|EUR|GBP|AED|SAR|THB|MYR|SGD|INR|TK|৳|\\$)?\\s*([\\d,]+(?:\\.\\d{1,2})?)`, 'i');
      const m = text.match(re);
      if (m && m[1]) return parseNumber(m[1]);
    }
    return 0;
  }

  function detectCurrency(text) {
    const codes = ['BDT', 'USD', 'EUR', 'GBP', 'AED', 'SAR', 'THB', 'MYR', 'SGD', 'INR', 'CAD', 'AUD'];
    for (const c of codes) {
      if (new RegExp(`\\b${c}\\b`, 'i').test(text)) return c;
    }
    if (/[৳]|taka|\btk\.?\b/i.test(text)) return 'BDT';
    if (/\$/.test(text)) return 'USD';
    if (/€/.test(text)) return 'EUR';
    if (/£/.test(text)) return 'GBP';
    return '';
  }

  function detectPhone(text) {
    const m = text.match(/(?:\+?\d{1,3}[\s-]?)?(?:0?1[3-9]\d{2}[\s-]?\d{6}|\d{3,4}[\s-]\d{3,4}[\s-]\d{3,4})/);
    return m ? m[0].trim() : '';
  }

  function detectEmail(text) {
    const m = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    return m ? m[0].trim() : '';
  }

  function extractSection(text, startLabels, stopLabels) {
    const startRe = new RegExp(`(?:^|[\\n\\r])\\s*(?:${startLabels.join('|')})\\s*[:\\-]?\\s*[\\n\\r]+`, 'i');
    const sm = startRe.exec(text);
    if (!sm) return '';
    const rest = text.slice(sm.index + sm[0].length);
    const stopRe = new RegExp(`(?:^|[\\n\\r])\\s*(?:${stopLabels.join('|')})\\s*[:\\-]?`, 'i');
    const em = stopRe.exec(rest);
    return (em ? rest.slice(0, em.index) : rest).trim();
  }

  function getAirlineByIata(code) {
    if (!window.AVIATION_DATA) return null;
    const up = String(code || '').toUpperCase();
    return window.AVIATION_DATA.AIRLINES.find(a => a.iata.toUpperCase() === up) || null;
  }

  function findAirlineInText(chunk) {
    if (!window.AVIATION_DATA || !chunk) return null;
    const lower = chunk.toLowerCase();
    // Match longest airline name first for accuracy (e.g. "Air India Express" before "Air India")
    const sorted = [...window.AVIATION_DATA.AIRLINES].sort((a, b) => b.name.length - a.name.length);
    for (const a of sorted) {
      const cleanName = a.name.replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
      if (cleanName.length >= 4 && lower.includes(cleanName)) return a;
    }
    return null;
  }

  function getAirportByIata(code) {
    if (!window.AVIATION_DATA) return null;
    const up = String(code || '').toUpperCase();
    return window.AVIATION_DATA.AIRPORTS.find(a => a.iata.toUpperCase() === up) || null;
  }

  const PNR_STOPWORDS = new Set([
    'TICKET', 'NUMBER', 'STATUS', 'FLIGHT', 'AIRLINE', 'DETAILS', 'BOOKING',
    'CONFIRMED', 'ISSUED', 'PASSENGER', 'ECONOMY', 'BUSINESS', 'TERMINAL',
    'BAGGAGE', 'DEPARTS', 'ARRIVAL', 'AIRCRAFT', 'BOEING', 'AIRBUS', 'FEMALE',
    'ADULT', 'CHILD', 'INFANT', 'DHAKA', 'MODEL', 'CARRIER', 'NOTICE', 'REPORT'
  ]);

  function isLikelyPnr(token) {
    if (!token) return false;
    const up = token.trim().toUpperCase();
    if (!/^[A-Z0-9]{5,7}$/.test(up)) return false;
    if (/^\d+$/.test(up)) return false; // pure digits aren't GDS PNRs
    if (PNR_STOPWORDS.has(up)) return false;
    return true;
  }

  /* ------------------------------------------------------------------------
     1. Airline E-Ticket Parser (GDS + B2B/OTA Table PDFs + WhatsApp)
     ------------------------------------------------------------------------ */
  function parseTicket(text, base) {
    const out = { ...base };
    let hits = 0;

    // 1. Reservation PNR
    const pnrPatterns = [
      /(?:Reservation\s*PNR|Booking\s*Ref(?:erence)?|Record\s*Locator|Reservation\s*Code|PNR)\s*[:\-–#]+\s*([A-Z0-9]{5,7})\b/i,
      /\bPNR\s+([A-Z0-9]{5,7})\b/i
    ];
    for (const re of pnrPatterns) {
      const m = text.match(re);
      if (m && isLikelyPnr(m[1])) {
        out.pnr = m[1].toUpperCase();
        hits++;
        break;
      }
    }

    // 2. Airline PNR (inline OR tabular row beneath Passenger Details)
    const inlineAirPnr = text.match(/(?:Airline\s*PNR|Airline\s*Ref(?:erence)?|Carrier\s*Ref|GDS\s*Ref)\s*[:\-–#]+\s*([A-Z0-9]{5,7})\b/i);
    if (inlineAirPnr && isLikelyPnr(inlineAirPnr[1])) {
      out.airlinePnr = inlineAirPnr[1].toUpperCase();
      hits++;
    } else {
      // Look inside the Passenger section for a standalone 5-7 char PNR line first (e.g. "WSVGLA")
      const paxBlockMatch = text.match(/Passenger[\s\S]*?(?=Flight\s*Details|Itinerary|Segment|$)/i);
      if (paxBlockMatch) {
        const standalone = paxBlockMatch[0].match(/^\s*([A-Z0-9]{5,7})\s*$/gm) || [];
        for (const rawC of standalone) {
          const code = rawC.trim();
          if (isLikelyPnr(code) && code !== out.pnr) {
            out.airlinePnr = code;
            hits++;
            break;
          }
        }
      }
    }

    // Status
    if (/\bConfirmed\b/i.test(text.slice(0, 400))) out.status = 'CONFIRMED';
    else if (/\bIssued\b/i.test(text.slice(0, 400))) out.status = 'ISSUED';

    // 3. 13-digit E-Ticket Numbers
    const tktNumbers = [];
    const tktRe = /\b(\d{3}[-\s]?\d{10})\b/g;
    let tm;
    while ((tm = tktRe.exec(text)) !== null) {
      const clean = tm[1].replace(/\s+/g, '');
      const formatted = clean.includes('-') ? clean : `${clean.slice(0, 3)}-${clean.slice(3)}`;
      if (!tktNumbers.includes(formatted)) tktNumbers.push(formatted);
    }

    // 4. Passengers (Supports OTA tables "01 Mr BADHON ROY Adult", GDS "RAHMAN/ANIK MR", and "Passenger: ...")
    const passengers = [];
    const lines = text.split(/\r?\n/);

    // Pattern A: Prefix-title tabular rows (e.g. "01 Mr BADHON ROY Adult → Male 9973980156404")
    const titlePaxRe = /(?:^|\s)(?:\d{1,2}\s+)?(Mr|Mrs|Ms|Miss|Mstr|Dr)\.?\s+([A-Z][A-Za-z\s.'-]{2,48}?)(?=\s+(?:Adult|Child|Infant|ADT|CHD|INF|Male|Female|\d{3}[-\s]?\d{10})|$)/gm;
    let pm;
    while ((pm = titlePaxRe.exec(text)) !== null) {
      const title = pm[1].toUpperCase();
      const rawName = pm[2].trim().replace(/\s+/g, ' ').toUpperCase();
      if (rawName.length < 3 || PNR_STOPWORDS.has(rawName)) continue;
      const fullName = `${title} ${rawName}`;
      // Inspect the full line where this passenger appears for Adult/Child/Infant
      const lineMatch = lines.find(l => l.toUpperCase().includes(rawName)) || '';
      const type = /\b(?:Child|CHD|MSTR)\b/i.test(lineMatch) ? 'CHD'
        : (/\b(?:Infant|INF)\b/i.test(lineMatch) ? 'INF' : 'ADT');
      if (!passengers.some(p => p.name === fullName)) {
        passengers.push({ name: fullName, type, ticketNo: '', seat: 'TBA' });
      }
    }

    // Pattern B: GDS SURNAME/GIVENNAME MR
    if (!passengers.length) {
      const gdsNameRe = /\b([A-Z]{2,24}\/[A-Z][A-Z\s]{1,28}(?:\s+(?:MR|MRS|MS|MISS|MSTR|DR))?)\b/g;
      let nm;
      while ((nm = gdsNameRe.exec(text)) !== null) {
        const full = nm[1].trim().replace(/\s+/g, ' ');
        if (full.includes('HTTP') || full.includes('AIRPORT') || full.includes('SIZE')) continue;
        if (!passengers.some(p => p.name === full)) {
          const type = /\bMSTR\b|\bCHD\b/i.test(full) ? 'CHD' : (/\bINF\b/i.test(full) ? 'INF' : 'ADT');
          passengers.push({ name: full, type, ticketNo: '', seat: 'TBA' });
        }
      }
    }

    // Pattern C: Labeled Passenger lines
    if (!passengers.length) {
      lines.filter(l => /(?:Passenger|Pax\s*Name|Traveller)\s*[:\-]/i.test(l)).forEach(line => {
        const cleaned = line.replace(/^.*?(?:Passenger|Pax\s*Name|Traveller)\s*[:\-]\s*/i, '')
          .replace(/(?:Ticket|E-Ticket|PNR|Seat|ADT|CHD|INF).*$/i, '').trim().toUpperCase();
        if (cleaned.length >= 3) {
          const type = /\bCHD\b|\bChild\b/i.test(line) ? 'CHD' : (/\bINF\b|\bInfant\b/i.test(line) ? 'INF' : 'ADT');
          passengers.push({ name: cleaned, type, ticketNo: '', seat: 'TBA' });
        }
      });
    }

    const seats = (text.match(/\bSeat[\s:#-]*(\d{1,2}[A-K])\b/gi) || []).map(s => s.replace(/^.*?(?=\d)/, '').toUpperCase());
    passengers.forEach((p, idx) => {
      if (tktNumbers[idx]) p.ticketNo = tktNumbers[idx];
      if (seats[idx]) p.seat = seats[idx];
    });
    if (!passengers.length && tktNumbers.length) {
      tktNumbers.forEach(num => passengers.push({ name: 'PASSENGER', type: 'ADT', ticketNo: num, seat: 'TBA' }));
    }
    if (passengers.length) {
      out.passengers = passengers;
      out.clientName = passengers[0].name;
      hits += passengers.length;
    }

    // 5. Flight Segments Sequence Recognition
    const segments = [];
    const airlineSet = new Set((window.AVIATION_DATA ? window.AVIATION_DATA.AIRLINES : []).map(a => a.iata.toUpperCase()));
    const airportSet = new Set((window.AVIATION_DATA ? window.AVIATION_DATA.AIRPORTS : []).map(a => a.iata.toUpperCase()));

    // Restrict flight parsing to before "Important Notice" so notice text (7 kg, 1 hour) doesn't pollute segments
    const flightArea = text.split(/Important\s*Notice|Carry-on\s*Baggage|Terms\s*&?\s*Conditions/i)[0] || text;

    // Strategy A: Route-Header / "Flight No -" Block Splitting (OTA / B2B E-Ticket PDFs)
    const routeHeaderRe = /(?:^|\n)([^\n]*?\(([A-Z]{3})\)\s*(?:→|->|to|—|–|-)\s*[^\n]*?\(([A-Z]{3})\))/gi;
    const routeMatches = [];
    let rm;
    while ((rm = routeHeaderRe.exec(flightArea)) !== null) {
      const oCode = rm[2].toUpperCase();
      const dCode = rm[3].toUpperCase();
      if (airportSet.has(oCode) && airportSet.has(dCode)) {
        routeMatches.push({ index: rm.index, orig: oCode, dest: dCode });
      }
    }

    if (routeMatches.length) {
      for (let i = 0; i < routeMatches.length; i++) {
        const start = routeMatches[i].index;
        const end = (i + 1 < routeMatches.length) ? routeMatches[i + 1].index : flightArea.length;
        const blk = flightArea.slice(start, end);

        const origIata = routeMatches[i].orig;
        const destIata = routeMatches[i].dest;
        const origObj = getAirportByIata(origIata);
        const destObj = getAirportByIata(destIata);

        // Airline by full name or IATA code
        let airlineObj = findAirlineInText(blk);
        const fltNoMatch = blk.match(/Flight\s*No\.?\s*[:\-–]*\s*([A-Z0-9]{0,2}\s*-?\s*\d{2,4})\b/i);
        let iata = airlineObj ? airlineObj.iata : '';
        let flightNo = '';
        if (fltNoMatch) {
          const rawFlt = fltNoMatch[1].trim().toUpperCase();
          const prefM = rawFlt.match(/^([A-Z0-9]{2})\s*-?\s*(\d{2,4})$/);
          if (prefM && airlineSet.has(prefM[1])) {
            iata = prefM[1];
            airlineObj = getAirlineByIata(iata) || airlineObj;
            flightNo = `${iata} ${prefM[2]}`;
          } else {
            const digits = rawFlt.replace(/\D+/g, '');
            flightNo = iata ? `${iata} ${digits}` : digits;
          }
        }
        if (!iata) {
          const anyCode = blk.match(/\b([A-Z0-9]{2})\s?-?\s?(\d{2,4})\b/);
          if (anyCode && airlineSet.has(anyCode[1].toUpperCase())) {
            iata = anyCode[1].toUpperCase();
            airlineObj = getAirlineByIata(iata);
            flightNo = `${iata} ${anyCode[2]}`;
          }
        }

        const segDates = extractAllDates(blk);
        const segTimes = (blk.match(/\b\d{1,2}[:.]\d{2}(?:\s*(?:am|pm))?\b/gi) || []).map(to24hTime).filter(Boolean);

        // Terminals (supports "Terminal: 2", "Terminal: I", and wrapped table cells like "Terminal: (K) ...\n2")
        const termRe = /Terminal\s*[:\-]?\s*([^\n]*)/gi;
        const terms = [];
        let tmatch;
        while ((tmatch = termRe.exec(blk)) !== null) {
          const rest = (tmatch[1] || '').trim();
          const direct = rest.match(/^([A-Z0-9]{1,2})(?:\s|$|\|)/i);
          if (direct) {
            terms.push(direct[1].toUpperCase());
          } else {
            // Check next 2 lines for a standalone 1-2 char terminal code (e.g. "2" or "I")
            const after = blk.slice(tmatch.index + tmatch[0].length).split(/\r?\n/).slice(1, 4);
            const wrapped = after.find(l => /^\s*([1-9][A-Z]?|I|D|T[1-9])\s*$/i.test(l));
            terms.push(wrapped ? wrapped.trim().toUpperCase() : '');
          }
        }

        // Cabin + optional single-letter booking class even across newlines (e.g. "Economy ... (B)")
        const cabinWordM = blk.match(/\b(Premium\s*Economy|Economy|Business|First)\b/i);
        const classLetterM = blk.match(/\(([A-Z])\)/);
        const cabin = cabinWordM
          ? `${cabinWordM[1]}${classLetterM ? ' (' + classLetterM[1] + ')' : ''}`
          : 'Economy (Y)';

        // Baggage (supports "20.0 Kilograms", "30 KG", "2 PC", and wrapped "ADT → 20.0 ... Kilograms")
        const bagM = blk.match(/(\d+(?:\.\d+)?)\s*(Kilograms?|Kgs?|Kg|Pieces?|Pcs?|Pc)\b/i);
        const adtBagM = blk.match(/ADT\s*(?:→|->|:|-)?\s*(\d+(?:\.\d+)?)/i);
        let baggage = '30 KG';
        if (bagM) {
          const val = parseFloat(bagM[1]);
          const unit = /piece|pc/i.test(bagM[2]) ? 'PC' : 'KG';
          baggage = `${Number.isInteger(val) ? val : val} ${unit}`;
        } else if (adtBagM) {
          const val = parseFloat(adtBagM[1]);
          const unit = /piece|pc/i.test(blk) ? 'PC' : 'KG';
          baggage = `${Number.isInteger(val) ? val : val} ${unit}`;
        }

        segments.push({
          airlineIata: iata || 'BG',
          airlineName: airlineObj ? airlineObj.name : (iata || 'Airline'),
          flightNo: flightNo || `${iata || 'FL'} 001`,
          originIata: origIata,
          originCity: origObj ? origObj.city : origIata,
          originTerminal: terms[0] || '',
          destIata: destIata,
          destCity: destObj ? destObj.city : destIata,
          destTerminal: terms[1] || '',
          depDate: segDates[0] || base.date || window.TourBuzzApp.todayISO(),
          depTime: segTimes[0] || '09:00',
          arrDate: segDates[1] || segDates[0] || base.date || window.TourBuzzApp.todayISO(),
          arrTime: segTimes[1] || '12:00',
          cabin,
          fareBasis: classLetterM ? `${classLetterM[1]}OWBD` : 'YOWBD',
          baggage,
          status: /\bOK\b/.test(blk) ? 'OK' : 'CONFIRMED'
        });
      }
    }

    // Strategy B: GDS Line-Scan Fallback (e.g. "Flight BG 347 DAC to DXB 15 Dec 2026 19:45 - 23:15")
    if (!segments.length) {
      const fLines = flightArea.split(/\r?\n/);
      const flightRe = /\b([A-Z0-9]{2})\s?-?\s?(\d{2,4})\b/g;
      const seenFlights = new Set();

      fLines.forEach((line, lineIdx) => {
        let fm;
        flightRe.lastIndex = 0;
        while ((fm = flightRe.exec(line)) !== null) {
          const iata = fm[1].toUpperCase();
          if (!airlineSet.has(iata)) continue;
          const flightNo = `${iata} ${fm[2]}`;
          if (seenFlights.has(flightNo)) continue;

          const windowText = fLines.slice(Math.max(0, lineIdx - 1), Math.min(fLines.length, lineIdx + 4)).join(' | ');
          const iataTokens = (windowText.match(/\b[A-Z]{3}\b/g) || []).filter(c => airportSet.has(c));
          const uniquePair = [];
          for (const code of iataTokens) {
            if (uniquePair.length === 0 || uniquePair[uniquePair.length - 1] !== code) uniquePair.push(code);
            if (uniquePair.length === 2) break;
          }
          if (uniquePair.length < 2) continue;

          seenFlights.add(flightNo);
          const airlineObj = getAirlineByIata(iata);
          const origObj = getAirportByIata(uniquePair[0]);
          const destObj = getAirportByIata(uniquePair[1]);
          const segDates = extractAllDates(windowText);
          const segTimes = (windowText.match(/\b\d{1,2}[:.]\d{2}(?:\s*(?:am|pm))?\b/gi) || []).map(to24hTime).filter(Boolean);
          const bagMatch = windowText.match(/(\d+(?:\.\d+)?)\s*(Kilograms?|Kgs?|Kg|Pieces?|Pcs?|Pc)\b/i);
          const cabinMatch = windowText.match(/\b(Premium\s*Economy|Economy|Business|First)(?:\s*\([A-Z]\))?\b/i);
          const termMatches = windowText.match(/\b(?:Terminal|Term|T)[-\s:]*([A-Z0-9]{1,2})\b/gi) || [];

          let baggage = '30 KG';
          if (bagMatch) {
            const val = parseFloat(bagMatch[1]);
            const unit = /piece|pc/i.test(bagMatch[2]) ? 'PC' : 'KG';
            baggage = `${Number.isInteger(val) ? val : val} ${unit}`;
          }

          segments.push({
            airlineIata: iata,
            airlineName: airlineObj ? airlineObj.name : iata,
            flightNo,
            originIata: uniquePair[0],
            originCity: origObj ? origObj.city : uniquePair[0],
            originTerminal: termMatches[0] ? termMatches[0].replace(/^.*?(?=[A-Z0-9]{1,2}$)/i, '') : '',
            destIata: uniquePair[1],
            destCity: destObj ? destObj.city : uniquePair[1],
            destTerminal: termMatches[1] ? termMatches[1].replace(/^.*?(?=[A-Z0-9]{1,2}$)/i, '') : '',
            depDate: segDates[0] || base.date || window.TourBuzzApp.todayISO(),
            depTime: segTimes[0] || '09:00',
            arrDate: segDates[1] || segDates[0] || base.date || window.TourBuzzApp.todayISO(),
            arrTime: segTimes[1] || '12:00',
            cabin: cabinMatch ? cabinMatch[0] : 'Economy (Y)',
            fareBasis: 'YOWBD',
            baggage,
            status: /\bOK\b/.test(windowText) ? 'OK' : 'CONFIRMED'
          });
        }
      });
    }

    if (segments.length) {
      out.segments = segments;
      hits += segments.length * 2;
    }

    return {
      doc: out,
      summary: `Recognized ${hits} ticket signals (${(out.passengers || []).length} pax, ${(out.segments || []).length} segment(s), PNR: ${out.pnr || '—'}${out.airlinePnr ? ' / ' + out.airlinePnr : ''})`
    };
  }

  /* ------------------------------------------------------------------------
     2. Hotel Voucher Parser
     ------------------------------------------------------------------------ */
  function parseVoucher(text, base) {
    const out = { ...base };
    let hits = 0;

    const guest = matchLabel(text, ['Lead\\s*Guest', 'Guest\\s*Name', 'Primary\\s*Guest', 'Customer\\s*Name', 'Name', 'Passenger']);
    if (guest) { out.clientName = guest; hits++; }

    const acc = matchLabel(text, ['Accompanying\\s*Guests?', 'Additional\\s*Guests?', 'Other\\s*Guests?']);
    if (acc) { out.accompanyingGuests = acc; hits++; }

    const phone = detectPhone(text);
    if (phone) { out.guestPhone = phone; hits++; }

    const ref = matchLabel(text, ['Booking\\s*(?:Ref|Reference|ID|No|#)', 'Voucher\\s*No', 'Reservation\\s*(?:ID|No)']);
    if (ref) { out.bookingRef = ref.split(/\s+/)[0]; hits++; }

    const adtM = text.match(/(\d+)\s*Adults?/i);
    const chdM = text.match(/(\d+)\s*Child(?:ren)?/i);
    const infM = text.match(/(\d+)\s*Infants?/i);
    if (adtM) { out.adults = parseInt(adtM[1], 10); hits++; }
    if (chdM) { out.children = parseInt(chdM[1], 10); hits++; }
    if (infM) { out.infants = parseInt(infM[1], 10); hits++; }

    const hotelBlocks = text.split(/(?=(?:^|\n)\s*(?:Hotel\s*\d+|Hotel\s*Name|Property\s*Name)\s*[:\-])/i).filter(b => b.trim().length > 12);
    const hotels = [];

    const blocksToScan = hotelBlocks.length ? hotelBlocks : [text];
    blocksToScan.forEach(blk => {
      const hName = matchLabel(blk, ['Hotel\\s*\\d*', 'Hotel\\s*Name', 'Property\\s*Name', 'Resort\\s*Name', 'Accommodation']);
      const hAddr = matchLabel(blk, ['Hotel\\s*Address', 'Address', 'Location']);
      const hPhone = matchLabel(blk, ['Hotel\\s*Phone', 'Hotel\\s*Tel', 'Property\\s*Phone']);
      const conf = matchLabel(blk, ['Confirmation\\s*(?:No|Number|#)', 'Hotel\\s*Conf(?:irmation)?', 'Supplier\\s*Ref', 'PIN']);
      const room = matchLabel(blk, ['Room\\s*Type', 'Room\\s*Category', 'Room']);
      const roomsM = blk.match(/(\d+)\s*Rooms?\b/i);

      const inRaw = matchLabel(blk, ['Check[\\s-]*In', 'Arrival\\s*Date']);
      const outRaw = matchLabel(blk, ['Check[\\s-]*Out', 'Departure\\s*Date']);
      const blkDates = extractAllDates(blk);
      const checkIn = toISODate(inRaw) || blkDates[0] || '';
      const checkOut = toISODate(outRaw) || blkDates[1] || '';

      let mealPlan = 'BB (Bed & Breakfast)';
      if (/\b(?:AI|All\s*Inclusive)\b/i.test(blk)) mealPlan = 'AI (All Inclusive)';
      else if (/\b(?:FB|Full\s*Board)\b/i.test(blk)) mealPlan = 'FB (Full Board)';
      else if (/\b(?:HB|Half\s*Board)\b/i.test(blk)) mealPlan = 'HB (Half Board)';
      else if (/\b(?:RO|Room\s*Only|No\s*Meals?)\b/i.test(blk)) mealPlan = 'RO (Room Only)';
      else if (/\b(?:BB|Bed\s*&?\s*Breakfast|Breakfast\s*Included)\b/i.test(blk)) mealPlan = 'BB (Bed & Breakfast)';

      if (hName || checkIn || conf) {
        hotels.push({
          hotelName: hName || 'Hotel Stay',
          hotelAddress: hAddr,
          hotelPhone: hPhone,
          checkIn: checkIn || window.TourBuzzApp.todayISO(),
          checkOut: checkOut || '',
          roomType: room || 'Deluxe Room',
          rooms: roomsM ? parseInt(roomsM[1], 10) : 1,
          mealPlan,
          confirmationNo: conf ? conf.split(/\s+/)[0] : ''
        });
        hits += 2;
      }
    });

    if (hotels.length) out.hotels = hotels;

    const land = extractSection(text, ['Transfers?\\s*&?\\s*Land\\s*Services?', 'Land\\s*Services?', 'Transfers?'], ['Remarks?', 'Special\\s*Requests?', 'Notes?']);
    if (land) { out.landServices = land; hits++; }

    const remarks = matchLabel(text, ['Special\\s*Requests?', 'Remarks?', 'Notes?']);
    if (remarks) { out.remarks = remarks; hits++; }

    return { doc: out, summary: `Recognized ${hits} voucher fields & ${hotels.length} hotel stay(s)` };
  }

  /* ------------------------------------------------------------------------
     3. Commercial Invoice Parser
     ------------------------------------------------------------------------ */
  function parseInvoice(text, base) {
    const out = { ...base };
    let hits = 0;

    const client = matchLabel(text, ['Client\\s*Name', 'Billed?\\s*To', 'Customer', 'Name', 'Passenger']);
    if (client) { out.clientName = client; hits++; }
    const company = matchLabel(text, ['Company', 'Organization', 'Corporate']);
    if (company) { out.clientCompany = company; hits++; }
    const phone = detectPhone(text);
    if (phone) { out.clientPhone = phone; hits++; }
    const email = detectEmail(text);
    if (email) { out.clientEmail = email; hits++; }
    const addr = matchLabel(text, ['Address', 'Location']);
    if (addr) { out.clientAddress = addr; hits++; }
    const tripRef = matchLabel(text, ['Trip\\s*Ref', 'File\\s*Ref', 'Reference', 'Tour\\s*Code']);
    if (tripRef) { out.tripRef = tripRef; hits++; }

    const cur = detectCurrency(text);
    if (cur) { out.currency = cur; hits++; }

    const dueRaw = matchLabel(text, ['Due\\s*Date', 'Payment\\s*Due']);
    if (toISODate(dueRaw)) { out.dueDate = toISODate(dueRaw); hits++; }

    const items = [];
    const skipLineRe = /^(?:subtotal|total|grand\s*total|tax|vat|service\s*(?:fee|charge)|discount|paid|due|balance|client|name|phone|email|address|date|due\s*date|currency|notes?|invoice)/i;
    text.split(/\r?\n/).forEach(line => {
      const l = line.trim();
      if (!l || skipLineRe.test(l)) return;
      let m = l.match(/^[-•*\d.)\s]*(.+?)\s*[-|:@]\s*(\d+)\s*[xX×*]\s*(?:BDT|USD|EUR|GBP|AED|TK|৳|\$)?\s*([\d,]+(?:\.\d{1,2})?)/);
      if (m) {
        items.push({ description: m[1].trim(), details: '', qty: parseInt(m[2], 10), unitPrice: parseNumber(m[3]) });
        return;
      }
      m = l.match(/^[-•*\d.)\s]*([A-Za-z][^-|:\n]{3,80}?)\s*[-|:–=]\s*(?:BDT|USD|EUR|GBP|AED|SAR|THB|TK|৳|\$)?\s*([\d,]+(?:\.\d{1,2})?)\s*(?:BDT|USD|TK)?$/i);
      if (m && parseNumber(m[2]) > 0) {
        items.push({ description: m[1].trim(), details: '', qty: 1, unitPrice: parseNumber(m[2]) });
      }
    });

    if (items.length) { out.items = items; hits += items.length; }

    const taxPct = matchAmountByLabel(text, ['Tax\\s*%', 'VAT\\s*%', 'Tax\\s*/\\s*VAT']);
    const srv = matchAmountByLabel(text, ['Service\\s*(?:Fee|Charge)']);
    const disc = matchAmountByLabel(text, ['Discount']);
    const paid = matchAmountByLabel(text, ['Paid\\s*(?:Amount)?', 'Advance\\s*Paid', 'Received']);
    if (taxPct > 0 && taxPct <= 50) { out.taxPercent = taxPct; hits++; }
    if (srv > 0) { out.serviceFee = srv; hits++; }
    if (disc > 0) { out.discount = disc; hits++; }
    if (paid > 0) { out.paidAmount = paid; hits++; }

    const notes = matchLabel(text, ['Notes?', 'Remarks?', 'Terms']);
    if (notes) { out.notes = notes; hits++; }

    return { doc: out, summary: `Recognized ${hits} invoice fields & ${items.length} line item(s)` };
  }

  /* ------------------------------------------------------------------------
     4. Air Ticket Invoice Parser
     ------------------------------------------------------------------------ */
  function parseTicketInvoice(text, base) {
    const out = { ...base };
    let hits = 0;

    const tktParsed = parseTicket(text, {}).doc;
    if (tktParsed.pnr) { out.pnr = tktParsed.pnr; hits++; }
    if (tktParsed.segments && tktParsed.segments.length) {
      const s0 = tktParsed.segments[0];
      out.airline = `${s0.airlineName} (${s0.airlineIata})`;
      out.sector = tktParsed.segments.map(s => `${s.originIata}-${s.destIata}`).join(' / ');
      out.travelDate = s0.depDate || out.travelDate;
      hits += 3;
    }
    if (tktParsed.passengers && tktParsed.passengers.length) {
      out.passengerList = tktParsed.passengers.map((p, i) => `${i + 1}. ${p.name} (${p.type})${p.ticketNo ? ' — ' + p.ticketNo : ''}`).join('\n');
      if (!out.clientName) out.clientName = tktParsed.passengers[0].name;
      hits++;
    }

    const client = matchLabel(text, ['Client\\s*Name', 'Billed?\\s*To', 'Customer', 'Agency']);
    if (client) { out.clientName = client; hits++; }
    const phone = detectPhone(text);
    if (phone) { out.clientPhone = phone; hits++; }
    const email = detectEmail(text);
    if (email) { out.clientEmail = email; hits++; }
    const cur = detectCurrency(text);
    if (cur) { out.currency = cur; hits++; }

    const baseFare = matchAmountByLabel(text, ['Base\\s*(?:Air\\s*)?Fare', 'Net\\s*Fare', 'Air\\s*Fare']);
    const taxes = matchAmountByLabel(text, ['(?:Airline\\s*)?Taxes?', 'Tax(?:es)?\\s*&?\\s*Surcharges?', 'YQ']);
    const ait = matchAmountByLabel(text, ['AIT', 'VAT', 'AIT\\s*/\\s*VAT']);
    const service = matchAmountByLabel(text, ['(?:Agency\\s*)?Service\\s*(?:Charge|Fee)']);
    const discount = matchAmountByLabel(text, ['Discount']);
    const paid = matchAmountByLabel(text, ['Paid\\s*(?:Amount)?', 'Advance', 'Received']);

    const directTotalFare = matchAmountByLabel(text, ['Total\s*Fare(?:\s*\(inc\.?\s*tax\))?', 'Gross\s*Fare']);
    const combinedFare = directTotalFare || (baseFare + taxes);
    if (combinedFare > 0) { out.totalFare = combinedFare; out.baseFare = combinedFare; out.taxes = 0; hits++; }
    if (ait > 0) { out.aitVat = ait; hits++; }
    if (service > 0) { out.serviceCharge = service; hits++; }
    if (discount > 0) { out.discount = discount; hits++; }
    if (paid > 0) { out.paidAmount = paid; hits++; }

    return { doc: out, summary: `Recognized ${hits} air ticket billing fields (PNR: ${out.pnr || '—'})` };
  }

  /* ------------------------------------------------------------------------
     5. Money Receipt Parser
     ------------------------------------------------------------------------ */
  function parseReceipt(text, base) {
    const out = { ...base };
    let hits = 0;

    const client = matchLabel(text, ['Received\\s*From', 'Payer', 'Client\\s*Name', 'From', 'Name']);
    if (client) { out.clientName = client; hits++; }
    const phone = detectPhone(text);
    if (phone) { out.clientPhone = phone; hits++; }
    const cur = detectCurrency(text);
    if (cur) { out.currency = cur; hits++; }

    const amt = matchAmountByLabel(text, ['Amount\\s*(?:Received)?', 'Received\\s*Amount', 'Total\\s*Paid', 'Paid', 'BDT', 'Tk']);
    if (amt > 0) { out.amount = amt; hits++; }

    if (/\b(?:bKash|Nagad|Rocket|MFS)\b/i.test(text)) { out.paymentMode = 'bKash / Nagad'; hits++; }
    else if (/\b(?:Bank\s*Transfer|BEFTN|NPSB|RTGS|EFT|Wire|Account)\b/i.test(text)) { out.paymentMode = 'Bank Transfer'; hits++; }
    else if (/\bCheque|Check\b/i.test(text)) { out.paymentMode = 'Cheque'; hits++; }
    else if (/\b(?:Card|POS|Visa|Mastercard|Amex)\b/i.test(text)) { out.paymentMode = 'Card / POS'; hits++; }
    else if (/\bCash\b/i.test(text)) { out.paymentMode = 'Cash'; hits++; }

    const tx = matchLabel(text, ['Trx\\s*ID', 'Transaction\\s*(?:ID|Ref|No)', 'Cheque\\s*(?:No|#)', 'Ref(?:erence)?']);
    if (tx) { out.txRef = tx.split(/\s+/)[0]; hits++; }

    const invM = text.match(/\b(TB-(?:INV|TIV)-\d{6}-\d{4})\b/i) || [null, matchLabel(text, ['Against\\s*Invoice', 'Invoice\\s*(?:No|#)', 'File\\s*Ref'])];
    if (invM && invM[1]) { out.againstInvoice = invM[1].trim(); hits++; }

    const purpose = matchLabel(text, ['Purpose', 'Particulars', 'For', 'Description']);
    if (purpose) { out.purpose = purpose; hits++; }

    return { doc: out, summary: `Recognized ${hits} receipt fields (${out.paymentMode || 'Payment'})` };
  }

  /* ------------------------------------------------------------------------
     6. Tour Quotation Parser
     ------------------------------------------------------------------------ */
  function parseQuotation(text, base) {
    const out = { ...base };
    let hits = 0;

    const subject = matchLabel(text, ['Subject', 'Package\\s*(?:Name|Title)', 'Tour\\s*Title', 'Proposal']);
    if (subject) { out.subject = subject; hits++; }
    const client = matchLabel(text, ['Client\\s*Name', 'Prepared\\s*For', 'To', 'Customer']);
    if (client) { out.clientName = client; hits++; }
    const phone = detectPhone(text);
    if (phone) { out.clientPhone = phone; hits++; }
    const email = detectEmail(text);
    if (email) { out.clientEmail = email; hits++; }
    const dates = matchLabel(text, ['Travel\\s*Dates?', 'Tour\\s*Dates?', 'Dates?']);
    if (dates) { out.travelDates = dates; hits++; }
    const pax = matchLabel(text, ['Pax(?:\\s*Count)?', 'Travelers?', 'Guests?']);
    if (pax) { out.paxCount = pax; hits++; }
    const validRaw = matchLabel(text, ['Valid\\s*(?:Until|Till|Upto)', 'Validity']);
    if (toISODate(validRaw)) { out.validUntil = toISODate(validRaw); hits++; }
    const cur = detectCurrency(text);
    if (cur) { out.currency = cur; hits++; }

    const invRes = parseInvoice(text, {});
    if (invRes.doc.items && invRes.doc.items.length) {
      out.items = invRes.doc.items;
      hits += out.items.length;
    }

    const inc = extractSection(text, ['Package\\s*Inclusions?', 'Inclusions?', 'Includes?'], ['Package\\s*Exclusions?', 'Exclusions?', 'Excludes?', 'Terms']);
    if (inc) { out.inclusions = inc; hits++; }
    const exc = extractSection(text, ['Package\\s*Exclusions?', 'Exclusions?', 'Excludes?'], ['Terms', 'Notes?', 'Payment']);
    if (exc) { out.exclusions = exc; hits++; }
    const terms = extractSection(text, ['Terms\\s*&?\\s*Conditions?', 'Terms'], ['END_OF_DOC_SENTINEL']);
    if (terms) { out.terms = terms; hits++; }

    return { doc: out, summary: `Recognized ${hits} quotation fields` };
  }

  /* ------------------------------------------------------------------------
     7. Visa Checklist Parser
     ------------------------------------------------------------------------ */
  function parseVisa(text, base) {
    const out = { ...base };
    let hits = 0;

    const name = matchLabel(text, ['Applicant(?:\\s*Full)?\\s*Name', 'Full\\s*Name', 'Name', 'Passenger']);
    if (name) { out.clientName = name; hits++; }

    const ppM = text.match(/(?:Passport\s*(?:No|Number|#)?[\s:#-]*)([A-Z]{1,2}\d{7,8})\b/i) || text.match(/\b([A-Z]\d{8})\b/);
    if (ppM) { out.passportNo = ppM[1].toUpperCase(); hits++; }

    const nat = matchLabel(text, ['Nationality', 'Citizenship']);
    if (nat) { out.nationality = nat; hits++; }
    const phone = detectPhone(text);
    if (phone) { out.clientPhone = phone; hits++; }
    const dest = matchLabel(text, ['Destination(?:\\s*Country)?', 'Country', 'Visa\\s*For']);
    if (dest) { out.destination = dest; hits++; }

    if (/\bBusiness\b/i.test(text)) { out.visaCategory = 'Business'; hits++; }
    else if (/\bMedical\b/i.test(text)) { out.visaCategory = 'Medical'; hits++; }
    else if (/\bStudent\b/i.test(text)) { out.visaCategory = 'Student'; hits++; }
    else if (/\bWork\b/i.test(text)) { out.visaCategory = 'Work'; hits++; }
    else if (/\bUmrah\b/i.test(text)) { out.visaCategory = 'Umrah / Religious'; hits++; }
    else if (/\bTourist\b/i.test(text)) { out.visaCategory = 'Tourist'; hits++; }

    if (/\bMultiple\s*Entry\b/i.test(text)) { out.entryType = 'Multiple Entry'; hits++; }
    else if (/\bDouble\s*Entry\b/i.test(text)) { out.entryType = 'Double Entry'; hits++; }
    else if (/\bSingle\s*Entry\b/i.test(text)) { out.entryType = 'Single Entry'; hits++; }

    const dur = matchLabel(text, ['Duration', 'Stay\\s*Duration', 'Validity']) || (text.match(/\b(\d+\s*(?:Days?|Months?|Years?))\b/i) || [])[1];
    if (dur) { out.duration = dur; hits++; }

    if (Array.isArray(out.checklist)) {
      const checks = [
        { kw: /original\s*passport|passport/i, idx: 0 },
        { kw: /old\s*passport|previous\s*passport/i, idx: 1 },
        { kw: /photo|picture/i, idx: 2 },
        { kw: /bank\s*statement|solvency/i, idx: 3 },
        { kw: /\bnoc\b|leave\s*letter|job\s*letter/i, idx: 4 },
        { kw: /trade\s*license|\btin\b/i, idx: 5 },
        { kw: /visiting\s*card|business\s*card/i, idx: 6 },
        { kw: /\bnid\b|national\s*id|smart\s*card/i, idx: 7 },
        { kw: /marriage|nikahnama/i, idx: 8 },
        { kw: /invitation|sponsor/i, idx: 9 },
        { kw: /flight|ticket|hotel\s*booking/i, idx: 10 },
        { kw: /insurance/i, idx: 11 }
      ];
      let checkedHits = 0;
      checks.forEach(c => {
        if (out.checklist[c.idx] && c.kw.test(text)) {
          out.checklist[c.idx].checked = true;
          checkedHits++;
        }
      });
      hits += checkedHits;
    }

    return { doc: out, summary: `Recognized ${hits} visa fields & checklist items` };
  }

  /* ------------------------------------------------------------------------
     8. Tour Itinerary Parser
     ------------------------------------------------------------------------ */
  function parseItinerary(text, base) {
    const out = { ...base };
    let hits = 0;

    const title = matchLabel(text, ['Tour\\s*Title', 'Trip\\s*Title', 'Itinerary\\s*Title', 'Package\\s*Name', 'Subject']);
    if (title) { out.title = title; hits++; }
    const client = matchLabel(text, ['Client(?:\\s*/\\s*Group)?\\s*Name', 'Group\\s*Name', 'Prepared\\s*For', 'Traveler']);
    if (client) { out.clientName = client; hits++; }
    const dest = matchLabel(text, ['Destination(?:s)?', 'Countries', 'Cities']);
    if (dest) { out.destination = dest; hits++; }
    const dates = matchLabel(text, ['Travel\\s*Dates?', 'Tour\\s*Dates?', 'Dates?']);
    if (dates) { out.travelDates = dates; hits++; }
    const dur = matchLabel(text, ['Duration']) || (text.match(/\b(\d+\s*Days?\s*\/?\s*\d*\s*Nights?)\b/i) || [])[1];
    if (dur) { out.duration = dur; hits++; }
    const pax = matchLabel(text, ['Pax(?:\\s*Count)?', 'Travelers?', 'Group\\s*Size']);
    if (pax) { out.paxCount = pax; hits++; }

    const dayRegex = /(?:^|\n)\s*Day\s*(\d{1,2})\s*(?:[:\-–|]\s*([^\n]*))?\n([\s\S]*?)(?=(?:\n\s*Day\s*\d{1,2}\b|\n\s*(?:Tour\s*)?Inclusions?\s*:|\n\s*(?:Tour\s*)?Exclusions?\s*:|\n\s*(?:Important\s*)?Notes?\s*:|$))/gi;
    const days = [];
    let dm;
    while ((dm = dayRegex.exec(text)) !== null) {
      const dayNo = parseInt(dm[1], 10);
      const rawHead = (dm[2] || '').trim();
      const body = (dm[3] || '').trim();
      const dayDate = toISODate(rawHead) || toISODate(body);
      const mealsMatch = body.match(/(?:Meals?\s*[:\-]\s*)([^\n]+)/i);
      const hotelMatch = body.match(/(?:Overnight(?:\s*Stay)?|Hotel)\s*[:\-]\s*([^\n]+)/i);

      const cleanDetails = body
        .replace(/^.*?(?:Meals?\s*[:\-]\s*[^\n]+)\n?/im, '')
        .replace(/^.*?(?:Overnight(?:\s*Stay)?|Hotel)\s*[:\-]\s*[^\n]+\n?/im, '')
        .trim();

      days.push({
        dayNo,
        date: dayDate,
        title: rawHead || `Day ${dayNo} Program`,
        meals: mealsMatch ? mealsMatch[1].trim() : '',
        hotel: hotelMatch ? hotelMatch[1].trim() : '',
        details: cleanDetails || body
      });
    }

    if (days.length) {
      out.days = days;
      if (!out.duration) out.duration = `${days.length} Days / ${Math.max(1, days.length - 1)} Nights`;
      hits += days.length * 2;
    }

    const inc = extractSection(text, ['Tour\\s*Inclusions?', 'Inclusions?'], ['Tour\\s*Exclusions?', 'Exclusions?', 'Important\\s*Notes?', 'Notes?']);
    if (inc) { out.inclusions = inc; hits++; }
    const exc = extractSection(text, ['Tour\\s*Exclusions?', 'Exclusions?'], ['Important\\s*Notes?', 'Notes?']);
    if (exc) { out.exclusions = exc; hits++; }
    const notes = extractSection(text, ['Important\\s*Travel\\s*Notes?', 'Important\\s*Notes?', 'Notes?'], ['END_OF_DOC_SENTINEL']);
    if (notes) { out.notes = notes; hits++; }

    return { doc: out, summary: `Recognized ${hits} itinerary signals & ${days.length} day block(s)` };
  }

  /* ------------------------------------------------------------------------
     Unified Entry Point
     ------------------------------------------------------------------------ */
  Parser.parse = function (docType, rawText, currentDoc) {
    const text = String(rawText || '').trim();
    if (!text) return { doc: currentDoc, summary: 'No text provided.' };
    const base = structuredClone(currentDoc || { type: docType });

    switch (docType) {
      case 'ticket': return parseTicket(text, base);
      case 'voucher': return parseVoucher(text, base);
      case 'invoice': return parseInvoice(text, base);
      case 'ticket-invoice': return parseTicketInvoice(text, base);
      case 'receipt': return parseReceipt(text, base);
      case 'quotation': return parseQuotation(text, base);
      case 'visa': return parseVisa(text, base);
      case 'itinerary': return parseItinerary(text, base);
      default: return { doc: base, summary: 'Unsupported document type.' };
    }
  };

  window.TourBuzzSmartParser = Parser;
})();
