/**
 * ============================================================================
 * TourBuzz Travel Management System — Executive Dashboard & Two-Way Sync Engine
 * Company: TourBuzz Travel Services Ltd. | Exploring Happiness
 * ============================================================================
 * Capabilities:
 *   1. Executive "Dashboard" Tab: TourBuzz Navy & Orange hero banner, 6 live
 *      formula KPI cards, 8-module breakdown table, 2 embedded charts (Module
 *      Volume Column Chart + Collected vs. Due Donut Chart), and a live Recent
 *      Activity QUERY feed.
 *   2. Instant Auto-Automation on Sheet Edit (onEdit): Typing or editing any
 *      row directly in Google Sheets auto-fills Timestamp, Document No, Date,
 *      financial totals (Grand Total / Due / Status), styling, Raw JSON, and
 *      mirrors to All Activity Log so the website pulls it automatically!
 *   3. Full Two-Way Sync (doPost + doGet?action=pull): Preserves 100% of every
 *      document in a hidden "Raw JSON" column and syncs edits both ways.
 *   4. Polished Enterprise Styling: Brand tab colors, Poppins typography,
 *      dropdown validations, conditional status badges, zebra rows, frozen headers.
 *
 * Setup (2 Minutes):
 *   1. Open Google Sheets -> Extensions -> Apps Script -> paste this file -> Save
 *   2. Reload the Google Sheet -> click menu "TourBuzz TMS" ->
 *      "Initialize / Rebuild Dashboard & All Tabs"
 *   3. Click Deploy -> New deployment -> Web app (Execute as: Me, Access: Anyone)
 *   4. Paste the Web App URL into TourBuzz TMS -> Cloud & Settings -> Save
 */

const TB_NAVY = '#102542';
const TB_NAVY_LIGHT = '#1b365d';
const TB_ORANGE = '#f5820b';
const TB_GREEN = '#157f3d';
const TB_ZEBRA = '#f8fafc';
const TB_WHITE = '#ffffff';
const TB_BORDER = '#e2e8f0';
const TB_FONT = 'Poppins';

const DOC_TYPE_PREFIXES = {
  invoice: 'TB-INV',
  voucher: 'TB-VCH',
  receipt: 'TB-RCT',
  quotation: 'TB-QTN',
  ticket: 'TB-TKT',
  'ticket-invoice': 'TB-TIV',
  visa: 'TB-VIS',
  itinerary: 'TB-ITN'
};

const TAB_SCHEMAS = {
  invoice: {
    name: 'Invoices',
    tabColor: '#102542',
    headers: ['Timestamp', 'Document No', 'Date', 'Client Name', 'Phone', 'Currency', 'Subtotal', 'Tax %', 'Service Fee', 'Discount', 'Grand Total', 'Paid', 'Due', 'Status', 'Trip Ref', 'Raw JSON'],
    currencyCols: [7, 9, 10, 11, 12, 13],
    statusCol: 14,
    statusOptions: ['PAID', 'PARTIAL', 'UNPAID', 'CANCELLED'],
    currencyCol: 6,
    jsonCol: 16
  },
  voucher: {
    name: 'Vouchers',
    tabColor: '#0284c7',
    headers: ['Timestamp', 'Document No', 'Date', 'Lead Guest', 'Phone', 'Pax', 'Hotels Count', 'Primary Hotel', 'Check-In', 'Check-Out', 'Confirmation #', 'Status', 'Booking Ref', 'Raw JSON'],
    currencyCols: [],
    statusCol: 12,
    statusOptions: ['CONFIRMED', 'PENDING', 'CANCELLED'],
    jsonCol: 14
  },
  receipt: {
    name: 'Receipts',
    tabColor: '#157f3d',
    headers: ['Timestamp', 'Document No', 'Date', 'Received From', 'Phone', 'Currency', 'Amount', 'Payment Mode', 'Transaction Ref', 'Against Invoice', 'Purpose', 'Status', 'Raw JSON'],
    currencyCols: [7],
    statusCol: 12,
    statusOptions: ['PAID', 'PARTIAL', 'PENDING'],
    currencyCol: 6,
    paymentModeCol: 8,
    jsonCol: 13
  },
  quotation: {
    name: 'Quotations',
    tabColor: '#d97706',
    headers: ['Timestamp', 'Document No', 'Date', 'Client Name', 'Subject', 'Travel Dates', 'Pax', 'Valid Until', 'Currency', 'Total Estimate', 'Status', 'Raw JSON'],
    currencyCols: [10],
    statusCol: 11,
    statusOptions: ['OPEN', 'CONFIRMED', 'EXPIRED'],
    currencyCol: 9,
    jsonCol: 12
  },
  ticket: {
    name: 'Airline Tickets',
    tabColor: '#4f46e5',
    headers: ['Timestamp', 'Document No', 'Date', 'PNR', 'Client / Lead Pax', 'Pax Count', 'Airlines', 'Routing', 'Departure Date', 'Status', 'Raw JSON'],
    currencyCols: [],
    statusCol: 10,
    statusOptions: ['ISSUED', 'CONFIRMED', 'HOLD', 'CANCELLED'],
    jsonCol: 11
  },
  'ticket-invoice': {
    name: 'Airline Ticket Invoices',
    tabColor: '#1e3a8a',
    headers: ['Timestamp', 'Document No', 'Date', 'Client Name', 'PNR', 'Airline', 'Sector', 'Currency', 'Base Fare', 'Taxes', 'AIT/VAT', 'Service Charge', 'Discount', 'Grand Total', 'Paid', 'Due', 'Status', 'Raw JSON'],
    currencyCols: [9, 10, 11, 12, 13, 14, 15, 16],
    statusCol: 17,
    statusOptions: ['PAID', 'PARTIAL', 'UNPAID', 'CANCELLED'],
    currencyCol: 8,
    jsonCol: 18
  },
  visa: {
    name: 'Visa Documents',
    tabColor: '#475569',
    headers: ['Timestamp', 'Document No', 'Date', 'Applicant Name', 'Passport No', 'Nationality', 'Destination', 'Category', 'Entry Type', 'Duration', 'Docs Received', 'Status', 'Raw JSON'],
    currencyCols: [],
    statusCol: 12,
    statusOptions: ['PROCESSING', 'SUBMITTED', 'APPROVED', 'PENDING', 'REJECTED'],
    jsonCol: 13
  },
  itinerary: {
    name: 'Tour Itineraries',
    tabColor: '#0d9488',
    headers: ['Timestamp', 'Document No', 'Date', 'Client / Group', 'Trip Title', 'Destination', 'Travel Dates', 'Duration', 'Pax', 'Days Count', 'Status', 'Raw JSON'],
    currencyCols: [],
    statusCol: 11,
    statusOptions: ['CONFIRMED', 'PROPOSED', 'DRAFT'],
    jsonCol: 12
  },
  log: {
    name: 'All Activity Log',
    tabColor: '#1e293b',
    headers: ['Timestamp', 'Document No', 'Type', 'Date', 'Client / Pax', 'Currency', 'Amount / Total', 'Status', 'Cloud Synced', 'Staff'],
    currencyCols: [7],
    statusCol: 8,
    jsonCol: 0
  }
};

/* ==========================================================================
   Custom Menu & One-Click Workspace Builder
   ========================================================================== */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('TourBuzz TMS')
    .addItem('Initialize / Rebuild Dashboard & All Tabs', 'initializeAllTourBuzzTabs')
    .addItem('Format & Sync All Manual Rows Now', 'formatAndSyncAllTabs')
    .addToUi();
}

function initializeAllTourBuzzTabs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(TAB_SCHEMAS).forEach(key => {
    getOrCreateFormattedSheet(ss, TAB_SCHEMAS[key]);
  });
  buildExecutiveDashboard(ss);
  // Remove default empty "Sheet1" if present and unused
  const sheet1 = ss.getSheetByName('Sheet1');
  if (sheet1 && ss.getSheets().length > 1 && sheet1.getLastRow() === 0) {
    ss.deleteSheet(sheet1);
  }
  ss.setActiveSheet(ss.getSheetByName('Dashboard'));
  SpreadsheetApp.getUi().alert('TourBuzz TMS Executive Dashboard & all 9 formatted tabs are ready! Any row you type or edit now auto-formats and syncs directly to the website.');
}

function formatAndSyncAllTabs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const docTypes = ['invoice', 'voucher', 'receipt', 'quotation', 'ticket', 'ticket-invoice', 'visa', 'itinerary'];
  let count = 0;
  docTypes.forEach(type => {
    const schema = TAB_SCHEMAS[type];
    const sheet = ss.getSheetByName(schema.name);
    if (!sheet || sheet.getLastRow() < 2) return;
    const lastRow = sheet.getLastRow();
    const numCols = schema.headers.length;
    const values = sheet.getRange(2, 1, lastRow - 1, numCols).getValues();
    values.forEach((row, i) => {
      if (row.slice(1, numCols - 1).some(v => String(v || '').trim() !== '')) {
        const doc = sheetRowToDoc(type, row, sheet, schema, i + 2, true);
        if (doc) {
          styleDataRow(sheet, schema, i + 2, row);
          mirrorToActivityLog(ss, doc, formatNowStr());
          count++;
        }
      }
    });
  });
  SpreadsheetApp.getUi().alert(`Formatted & synced ${count} row(s) across all TourBuzz tabs.`);
}

/* ==========================================================================
   AUTOMATIC onEdit TRIGGER: Instant Formatting, Auto-Math & Live Sync Prep
   Fires automatically whenever any staff member edits or types a row in Sheets!
   ========================================================================== */
function onEdit(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  const sheetName = sheet.getName();
  const rowNum = e.range.getRow();
  if (rowNum < 2 || sheetName === 'Dashboard' || sheetName === 'All Activity Log') return;

  const docType = Object.keys(TAB_SCHEMAS).find(k => TAB_SCHEMAS[k].name === sheetName);
  if (!docType) return;

  const schema = TAB_SCHEMAS[docType];
  // Ignore edits to Timestamp (Col 1) or Raw JSON column to prevent loops
  if (e.range.getColumn() === 1 || e.range.getColumn() === schema.jsonCol) return;

  const numCols = schema.headers.length;
  const row = sheet.getRange(rowNum, 1, 1, numCols).getValues()[0];
  const hasAnyData = row.slice(1, numCols - 1).some(v => String(v || '').trim() !== '');
  if (!hasAnyData) return;

  const nowStr = formatNowStr();
  // Stamp fresh Timestamp in Column A so Website immediately sees this Sheet edit as newest
  sheet.getRange(rowNum, 1).setValue(nowStr);
  row[0] = nowStr;

  // Auto-calculate invoice totals when edited directly in Google Sheets
  if (docType === 'invoice') {
    const sub = toNum(row[6]);
    const taxPct = toNum(row[7]);
    const srv = toNum(row[8]);
    const disc = toNum(row[9]);
    const grand = Math.max(0, sub + (sub * taxPct / 100) + srv - disc);
    const paid = toNum(row[11]);
    const due = Math.max(0, grand - paid);
    const autoStatus = grand > 0 ? (due <= 0.005 ? 'PAID' : (paid > 0 ? 'PARTIAL' : 'UNPAID')) : (String(row[13] || 'UNPAID').toUpperCase());
    if (sub > 0 || srv > 0) {
      sheet.getRange(rowNum, 11).setValue(grand);
      sheet.getRange(rowNum, 13).setValue(due);
      row[10] = grand;
      row[12] = due;
      if (e.range.getColumn() !== 14) {
        sheet.getRange(rowNum, 14).setValue(autoStatus);
        row[13] = autoStatus;
      }
    }
  } else if (docType === 'ticket-invoice') {
    const grand = Math.max(0, toNum(row[8]) + toNum(row[9]) + toNum(row[10]) + toNum(row[11]) - toNum(row[12]));
    const paid = toNum(row[14]);
    const due = Math.max(0, grand - paid);
    const autoStatus = grand > 0 ? (due <= 0.005 ? 'PAID' : (paid > 0 ? 'PARTIAL' : 'UNPAID')) : (String(row[16] || 'UNPAID').toUpperCase());
    if (grand > 0) {
      sheet.getRange(rowNum, 14).setValue(grand);
      sheet.getRange(rowNum, 16).setValue(due);
      row[13] = grand;
      row[15] = due;
      if (e.range.getColumn() !== 17) {
        sheet.getRange(rowNum, 17).setValue(autoStatus);
        row[16] = autoStatus;
      }
    }
  }

  // Rebuild Raw JSON + assign Doc No / Date if blank + style row + mirror to All Activity Log
  const doc = sheetRowToDoc(docType, row, sheet, schema, rowNum, true);
  styleDataRow(sheet, schema, rowNum, row);
  if (doc) {
    mirrorToActivityLog(e.source, doc, nowStr);
  }
}

/* ==========================================================================
   EXECUTIVE DASHBOARD BUILDER (Tab #1 — Live Formulas + Charts + Activity Feed)
   ========================================================================== */
function buildExecutiveDashboard(ss) {
  let dash = ss.getSheetByName('Dashboard');
  if (dash) {
    dash.clear();
    dash.getCharts().forEach(c => dash.removeChart(c));
  } else {
    dash = ss.insertSheet('Dashboard', 0);
  }

  // Move Dashboard to position 1 & style tab
  ss.setActiveSheet(dash);
  ss.moveActiveSheet(1);
  dash.setTabColor(TB_ORANGE);
  dash.setHiddenGridlines(true);

  // Set balanced column widths (Columns A to M)
  const colWidths = [24, 180, 120, 120, 120, 140, 24, 150, 140, 140, 140, 130, 24];
  colWidths.forEach((w, idx) => dash.setColumnWidth(idx + 1, w));

  // Hero Header Banner (Rows 2–3)
  dash.setRowHeight(1, 14);
  dash.setRowHeight(2, 42);
  dash.setRowHeight(3, 24);
  dash.setRowHeight(4, 6);

  dash.getRange('B2:L2').merge()
    .setValue('TOURBUZZ TRAVEL SERVICES LTD.  —  EXECUTIVE COMMAND DASHBOARD')
    .setBackground(TB_NAVY).setFontColor('#ffffff').setFontFamily(TB_FONT)
    .setFontWeight('bold').setFontSize(16).setVerticalAlignment('middle').setHorizontalAlignment('left');

  dash.getRange('B3:L3').merge()
    .setValue('Exploring Happiness  ·  Live Two-Way Sync with TourBuzz TMS  ·  HI Khan Trade Center, Level-9, Mohammadpur, Dhaka')
    .setBackground(TB_NAVY_LIGHT).setFontColor('#e2e8f0').setFontFamily(TB_FONT)
    .setFontSize(9.5).setVerticalAlignment('middle').setHorizontalAlignment('left');

  dash.getRange('B4:L4').merge().setBackground(TB_ORANGE);
  dash.setRowHeight(5, 16);

  // Row 6–8: 6 Live Executive KPI Cards
  dash.setRowHeight(6, 22);
  dash.setRowHeight(7, 36);
  dash.setRowHeight(8, 20);

  const kpis = [
    {
      range: 'B6:C8', titleCell: 'B6:C6', valCell: 'B7:C7', subCell: 'B8:C8', accent: TB_ORANGE,
      title: 'TOTAL DOCUMENTS',
      formula: '=COUNTA(Invoices!B2:B)+COUNTA(Vouchers!B2:B)+COUNTA(Receipts!B2:B)+COUNTA(Quotations!B2:B)+COUNTA(\'Airline Tickets\'!B2:B)+COUNTA(\'Airline Ticket Invoices\'!B2:B)+COUNTA(\'Visa Documents\'!B2:B)+COUNTA(\'Tour Itineraries\'!B2:B)',
      fmt: '#,##0', sub: 'All 8 Modules Combined'
    },
    {
      range: 'D6:E8', titleCell: 'D6:E6', valCell: 'D7:E7', subCell: 'D8:E8', accent: TB_NAVY,
      title: 'TOTAL INVOICED (BDT)',
      formula: '=SUMIF(Invoices!F2:F,"BDT",Invoices!K2:K)+SUMIF(\'Airline Ticket Invoices\'!H2:H,"BDT",\'Airline Ticket Invoices\'!N2:N)',
      fmt: '"৳"#,##0.00', sub: 'Invoices + Air Ticket Invoices'
    },
    {
      range: 'F6:G8', titleCell: 'F6:G6', valCell: 'F7:G7', subCell: 'F8:G8', accent: TB_GREEN,
      title: 'TOTAL COLLECTED (BDT)',
      formula: '=SUMIF(Invoices!F2:F,"BDT",Invoices!L2:L)+SUMIF(\'Airline Ticket Invoices\'!H2:H,"BDT",\'Airline Ticket Invoices\'!O2:O)',
      fmt: '"৳"#,##0.00', sub: 'Settled Payments'
    },
    {
      range: 'H6:I8', titleCell: 'H6:I6', valCell: 'H7:I7', subCell: 'H8:I8', accent: '#dc2626',
      title: 'OUTSTANDING DUE (BDT)',
      formula: '=SUMIF(Invoices!F2:F,"BDT",Invoices!M2:M)+SUMIF(\'Airline Ticket Invoices\'!H2:H,"BDT",\'Airline Ticket Invoices\'!P2:P)',
      fmt: '"৳"#,##0.00', sub: 'Receivable Balance'
    },
    {
      range: 'J6:J8', titleCell: 'J6:J6', valCell: 'J7:J7', subCell: 'J8:J8', accent: '#0284c7',
      title: 'COLLECTION %',
      formula: '=IFERROR(F7/D7, 0)',
      fmt: '0.0%', sub: 'Paid / Invoiced'
    },
    {
      range: 'K6:L8', titleCell: 'K6:L6', valCell: 'K7:L7', subCell: 'K8:L8', accent: '#4f46e5',
      title: 'TICKETS & VISAS',
      formula: '=COUNTA(\'Airline Tickets\'!B2:B)+COUNTA(\'Visa Documents\'!B2:B)',
      fmt: '#,##0', sub: 'Issued Tickets + Visa Files'
    }
  ];

  kpis.forEach(k => {
    dash.getRange(k.titleCell).merge().setValue(k.title)
      .setBackground('#f8fafc').setFontColor('#475569').setFontFamily(TB_FONT).setFontWeight('bold').setFontSize(8.5)
      .setHorizontalAlignment('center').setVerticalAlignment('bottom');
    dash.getRange(k.valCell).merge().setFormula(k.formula).setNumberFormat(k.fmt)
      .setBackground('#ffffff').setFontColor(k.accent).setFontFamily(TB_FONT).setFontWeight('bold').setFontSize(15)
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
    dash.getRange(k.subCell).merge().setValue(k.sub)
      .setBackground('#ffffff').setFontColor('#64748b').setFontFamily(TB_FONT).setFontSize(8)
      .setHorizontalAlignment('center').setVerticalAlignment('top');
    dash.getRange(k.range).setBorder(true, true, true, true, false, false, TB_BORDER, SpreadsheetApp.BorderStyle.SOLID);
    dash.getRange(k.titleCell).setBorder(true, null, null, null, null, null, k.accent, SpreadsheetApp.BorderStyle.SOLID_THICK);
  });

  dash.setRowHeight(9, 18);

  // Module Breakdown Table (Rows 10–19, Columns B–F)
  dash.setRowHeight(10, 28);
  dash.getRange('B10:F10').merge().setValue('MODULE BREAKDOWN & VOLUME (LIVE)')
    .setBackground(TB_NAVY).setFontColor('#ffffff').setFontFamily(TB_FONT).setFontWeight('bold').setFontSize(10).setVerticalAlignment('middle');

  dash.setRowHeight(11, 26);
  dash.getRange('B11:F11').setValues([['Module', 'Total Docs', 'Paid / Confirmed', 'Pending / Due', 'Volume (BDT)']])
    .setBackground('#e2e8f0').setFontColor(TB_NAVY).setFontFamily(TB_FONT).setFontWeight('bold').setFontSize(9).setVerticalAlignment('middle');

  const moduleRows = [
    ['Invoices', '=COUNTA(Invoices!B2:B)', '=COUNTIF(Invoices!N2:N,"PAID")', '=COUNTIF(Invoices!N2:N,"UNPAID")+COUNTIF(Invoices!N2:N,"PARTIAL")', '=SUMIF(Invoices!F2:F,"BDT",Invoices!K2:K)'],
    ['Air Ticket Invoices', '=COUNTA(\'Airline Ticket Invoices\'!B2:B)', '=COUNTIF(\'Airline Ticket Invoices\'!Q2:Q,"PAID")', '=COUNTIF(\'Airline Ticket Invoices\'!Q2:Q,"UNPAID")+COUNTIF(\'Airline Ticket Invoices\'!Q2:Q,"PARTIAL")', '=SUMIF(\'Airline Ticket Invoices\'!H2:H,"BDT",\'Airline Ticket Invoices\'!N2:N)'],
    ['Money Receipts', '=COUNTA(Receipts!B2:B)', '=COUNTIF(Receipts!L2:L,"PAID")', '=COUNTIF(Receipts!L2:L,"PENDING")+COUNTIF(Receipts!L2:L,"PARTIAL")', '=SUMIF(Receipts!F2:F,"BDT",Receipts!G2:G)'],
    ['Tour Quotations', '=COUNTA(Quotations!B2:B)', '=COUNTIF(Quotations!K2:K,"CONFIRMED")', '=COUNTIF(Quotations!K2:K,"OPEN")', '=SUMIF(Quotations!I2:I,"BDT",Quotations!J2:J)'],
    ['Hotel Vouchers', '=COUNTA(Vouchers!B2:B)', '=COUNTIF(Vouchers!L2:L,"CONFIRMED")', '=COUNTIF(Vouchers!L2:L,"PENDING")', 0],
    ['Airline Tickets', '=COUNTA(\'Airline Tickets\'!B2:B)', '=COUNTIF(\'Airline Tickets\'!J2:J,"ISSUED")+COUNTIF(\'Airline Tickets\'!J2:J,"CONFIRMED")', '=COUNTIF(\'Airline Tickets\'!J2:J,"HOLD")', 0],
    ['Visa Documents', '=COUNTA(\'Visa Documents\'!B2:B)', '=COUNTIF(\'Visa Documents\'!L2:L,"APPROVED")', '=COUNTIF(\'Visa Documents\'!L2:L,"PROCESSING")+COUNTIF(\'Visa Documents\'!L2:L,"PENDING")+COUNTIF(\'Visa Documents\'!L2:L,"SUBMITTED")', 0],
    ['Tour Itineraries', '=COUNTA(\'Tour Itineraries\'!B2:B)', '=COUNTIF(\'Tour Itineraries\'!K2:K,"CONFIRMED")', '=COUNTIF(\'Tour Itineraries\'!K2:K,"PROPOSED")+COUNTIF(\'Tour Itineraries\'!K2:K,"DRAFT")', 0]
  ];

  dash.getRange(12, 2, moduleRows.length, 5).setValues(moduleRows)
    .setFontFamily(TB_FONT).setFontSize(9.5).setVerticalAlignment('middle');
  for (let r = 12; r < 12 + moduleRows.length; r++) {
    dash.setRowHeight(r, 25);
    dash.getRange(r, 2, 1, 5).setBackground(r % 2 === 0 ? TB_WHITE : TB_ZEBRA);
  }
  dash.getRange('C12:E19').setHorizontalAlignment('center').setNumberFormat('#,##0');
  dash.getRange('F12:F19').setHorizontalAlignment('right').setNumberFormat('"৳"#,##0.00');
  dash.getRange('B10:F19').setBorder(true, true, true, true, true, true, TB_BORDER, SpreadsheetApp.BorderStyle.SOLID);

  // Small Helper Table for Financial Pie Chart (Rows 21–23, Columns B–C, styled cleanly)
  dash.getRange('B21:C21').setValues([['Financial Breakdown', 'Amount (BDT)']])
    .setBackground(TB_NAVY).setFontColor('#ffffff').setFontFamily(TB_FONT).setFontWeight('bold').setFontSize(9);
  dash.getRange('B22:C23').setValues([
    ['Collected (BDT)', '=F7'],
    ['Outstanding Due (BDT)', '=H7']
  ]).setFontFamily(TB_FONT).setFontSize(9.5).setBackground(TB_WHITE);
  dash.getRange('C22:C23').setNumberFormat('"৳"#,##0.00');
  dash.getRange('B21:C23').setBorder(true, true, true, true, true, true, TB_BORDER, SpreadsheetApp.BorderStyle.SOLID);

  // Chart 1: Document Volume by Module (Column Chart placed at H10)
  const barChart = dash.newChart()
    .setChartType(Charts.ChartType.COLUMN)
    .addRange(dash.getRange('B11:C19'))
    .setPosition(10, 8, 0, 0)
    .setOption('title', 'Documents Created by Module')
    .setOption('colors', [TB_ORANGE])
    .setOption('legend', { position: 'none' })
    .setOption('fontName', TB_FONT)
    .setOption('width', 470)
    .setOption('height', 250)
    .build();
  dash.insertChart(barChart);

  // Chart 2: Collected vs. Outstanding Due Donut Chart (placed at H22)
  const pieChart = dash.newChart()
    .setChartType(Charts.ChartType.PIE)
    .addRange(dash.getRange('B21:C23'))
    .setPosition(22, 8, 0, 0)
    .setOption('title', 'BDT Receivables: Collected vs. Due')
    .setOption('pieHole', 0.48)
    .setOption('colors', [TB_GREEN, '#dc2626'])
    .setOption('fontName', TB_FONT)
    .setOption('width', 470)
    .setOption('height', 220)
    .build();
  dash.insertChart(pieChart);

  // Live Recent Activity Feed (Row 25–36, Columns B–F)
  dash.setRowHeight(25, 28);
  dash.getRange('B25:F25').merge().setValue('LIVE RECENT ACTIVITY (LAST 10 UPDATES)')
    .setBackground(TB_NAVY).setFontColor('#ffffff').setFontFamily(TB_FONT).setFontWeight('bold').setFontSize(10).setVerticalAlignment('middle');
  dash.setRowHeight(26, 24);
  dash.getRange('B26:F26').setValues([['Document No', 'Type', 'Client / Pax', 'Amount', 'Status']])
    .setBackground('#e2e8f0').setFontColor(TB_NAVY).setFontFamily(TB_FONT).setFontWeight('bold').setFontSize(9);

  dash.getRange('B27').setFormula('=IFERROR(QUERY(\'All Activity Log\'!A2:J, "SELECT B, C, E, G, H WHERE B IS NOT NULL ORDER BY A DESC LIMIT 10", 0), "No activity logged yet.")');
  dash.getRange('B27:F36').setFontFamily(TB_FONT).setFontSize(9).setVerticalAlignment('middle');
  dash.getRange('E27:E36').setNumberFormat('#,##0.00').setHorizontalAlignment('right');
  dash.getRange('B25:F36').setBorder(true, true, true, true, true, true, TB_BORDER, SpreadsheetApp.BorderStyle.SOLID);
}

/* ==========================================================================
   GET Endpoint: Two-Way Pull (Google Sheets -> Website)
   ========================================================================== */
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) ? String(e.parameter.action).toLowerCase() : 'status';

  if (action === 'pull') {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const docs = [];
    const docTypes = ['invoice', 'voucher', 'receipt', 'quotation', 'ticket', 'ticket-invoice', 'visa', 'itinerary'];

    docTypes.forEach(type => {
      const schema = TAB_SCHEMAS[type];
      const sheet = ss.getSheetByName(schema.name);
      if (!sheet || sheet.getLastRow() < 2) return;

      const lastRow = sheet.getLastRow();
      const numCols = schema.headers.length;
      const values = sheet.getRange(2, 1, lastRow - 1, numCols).getValues();

      values.forEach((row, idx) => {
        const rowNum = idx + 2;
        const hasAnyData = row.slice(1, numCols - 1).some(v => String(v || '').trim() !== '');
        if (!hasAnyData) return;

        const doc = sheetRowToDoc(type, row, sheet, schema, rowNum, false);
        if (doc && doc.docNo) docs.push(doc);
      });
    });

    return ContentService
      .createTextOutput(JSON.stringify({
        ok: true,
        count: docs.length,
        documents: docs,
        syncedAt: new Date().toISOString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService
    .createTextOutput(JSON.stringify({
      ok: true,
      status: 'online',
      service: 'TourBuzz Travel Management System — Executive Dashboard & Two-Way Sync',
      company: 'TourBuzz Travel Services Ltd.',
      timestamp: new Date().toISOString()
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ==========================================================================
   POST Endpoint: Website -> Google Sheets (Upsert + Full JSON Preservation)
   ========================================================================== */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    const doc = JSON.parse(raw);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const now = formatNowStr();

    if (doc.action === 'delete' && doc.docNo && doc.type && TAB_SCHEMAS[doc.type]) {
      const sheet = ss.getSheetByName(TAB_SCHEMAS[doc.type].name);
      if (sheet) deleteRowByDocNo(sheet, doc.docNo);
      return ContentService.createTextOutput(JSON.stringify({ ok: true, deleted: doc.docNo })).setMimeType(ContentService.MimeType.JSON);
    }

    if (doc.type && TAB_SCHEMAS[doc.type]) {
      const schema = TAB_SCHEMAS[doc.type];
      const sheet = getOrCreateFormattedSheet(ss, schema);
      const rowValues = buildRowForType(doc, now);
      upsertRowByDocNo(sheet, schema, doc.docNo || doc.pnr || '', rowValues);
    }

    mirrorToActivityLog(ss, doc, now);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, docNo: doc.docNo || '' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

/* ==========================================================================
   Row <-> JSON Synchronization Helpers
   ========================================================================== */
function formatNowStr() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Dhaka', 'yyyy-MM-dd HH:mm:ss');
}

function toNum(v) {
  const n = parseFloat(String(v || '0').replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

function formatCellDate(val) {
  if (!val) return '';
  if (val instanceof Date && !isNaN(val.getTime())) {
    return Utilities.formatDate(val, Session.getScriptTimeZone() || 'Asia/Dhaka', 'yyyy-MM-dd');
  }
  return String(val).trim();
}

function parseTimestampIso(tsVal) {
  if (!tsVal) return '';
  if (tsVal instanceof Date && !isNaN(tsVal.getTime())) return tsVal.toISOString();
  const s = String(tsVal).trim();
  const d = new Date(s.replace(' ', 'T'));
  return isNaN(d.getTime()) ? '' : d.toISOString();
}

function mirrorToActivityLog(ss, doc, now) {
  const logSchema = TAB_SCHEMAS.log;
  const logSheet = getOrCreateFormattedSheet(ss, logSchema);
  const amountVal = Number(doc.grandTotal !== undefined ? doc.grandTotal : (doc.amount || 0));
  const logRow = [
    now,
    doc.docNo || doc.pnr || 'N/A',
    doc.type || 'unknown',
    doc.date || '',
    doc.clientName || '',
    doc.currency || 'BDT',
    amountVal,
    String(doc.status || 'SAVED').toUpperCase(),
    doc.cloudSynced ? 'YES' : 'SHEETS',
    doc.updatedBy || doc.createdBy || 'Google Sheets'
  ];
  upsertRowByDocNo(logSheet, logSchema, doc.docNo || doc.pnr || '', logRow);
}

function sheetRowToDoc(type, row, sheet, schema, rowNum, forceWriteJson) {
  const tz = Session.getScriptTimeZone() || 'Asia/Dhaka';
  const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const nowIso = new Date().toISOString();

  let base = null;
  const rawJson = schema.jsonCol ? String(row[schema.jsonCol - 1] || '').trim() : '';
  if (rawJson && rawJson.startsWith('{')) {
    try { base = JSON.parse(rawJson); } catch (_) { base = null; }
  }

  let docNo = String(row[1] || '').trim();
  let mutatedSheet = false;
  if (!docNo) {
    const ym = Utilities.formatDate(new Date(), tz, 'yyyyMM');
    const prefix = DOC_TYPE_PREFIXES[type] || 'TB-DOC';
    docNo = `${prefix}-${ym}-GS-${String(rowNum - 1).padStart(4, '0')}`;
    sheet.getRange(rowNum, 2).setValue(docNo);
    row[1] = docNo;
    mutatedSheet = true;
  }

  let docDate = formatCellDate(row[2]);
  if (!docDate) {
    docDate = (base && base.date) || today;
    sheet.getRange(rowNum, 3).setValue(docDate);
    row[2] = docDate;
    mutatedSheet = true;
  }

  const tsIso = parseTimestampIso(row[0]);
  const updatedAt = forceWriteJson ? nowIso : (tsIso || (base && base.updatedAt) || nowIso);
  if (!row[0]) {
    const nowStr = formatNowStr();
    sheet.getRange(rowNum, 1).setValue(nowStr);
    row[0] = nowStr;
    mutatedSheet = true;
  }

  let merged = base ? Object.assign({}, base) : {
    type: type,
    createdBy: 'Google Sheets',
    createdAt: updatedAt
  };
  merged.type = type;
  merged.docNo = docNo;
  merged.date = docDate;
  merged.updatedAt = updatedAt;
  merged.sheetsSynced = true;
  merged.cloudSynced = true;

  switch (type) {
    case 'invoice': {
      merged.clientName = String(row[3] || merged.clientName || '').trim();
      merged.clientPhone = String(row[4] || merged.clientPhone || '').trim();
      merged.currency = String(row[5] || merged.currency || 'BDT').trim().toUpperCase();
      const sub = toNum(row[6]);
      const taxPct = toNum(row[7]);
      const srv = toNum(row[8]);
      const disc = toNum(row[9]);
      const grand = toNum(row[10]) || Math.max(0, sub + (sub * taxPct / 100) + srv - disc);
      const paid = toNum(row[11]);
      const due = Math.max(0, grand - paid);
      merged.subtotal = sub || grand;
      merged.taxPercent = taxPct;
      merged.serviceFee = srv;
      merged.discount = disc;
      merged.grandTotal = grand;
      merged.paidAmount = paid;
      merged.dueAmount = due;
      merged.status = String(row[13] || (due <= 0.005 && grand > 0 ? 'PAID' : (paid > 0 ? 'PARTIAL' : 'UNPAID'))).toUpperCase();
      merged.tripRef = String(row[14] || merged.tripRef || '').trim();
      if (!Array.isArray(merged.items) || !merged.items.length) {
        merged.items = [{ description: merged.tripRef || 'Travel & Tour Services', details: '', qty: 1, unitPrice: merged.subtotal || grand }];
      }
      break;
    }
    case 'voucher': {
      merged.clientName = String(row[3] || merged.clientName || '').trim();
      merged.guestPhone = String(row[4] || merged.guestPhone || '').trim();
      const hotelName = String(row[7] || '').trim();
      const checkIn = formatCellDate(row[8]);
      const checkOut = formatCellDate(row[9]);
      const confNo = String(row[10] || '').trim();
      merged.status = String(row[11] || merged.status || 'CONFIRMED').toUpperCase();
      merged.bookingRef = String(row[12] || merged.bookingRef || docNo).trim();
      if (!Array.isArray(merged.hotels) || !merged.hotels.length) {
        merged.adults = merged.adults || 2;
        merged.children = merged.children || 0;
        merged.infants = merged.infants || 0;
        merged.hotels = [{
          hotelName: hotelName || 'Hotel Stay',
          hotelAddress: '', hotelPhone: '',
          checkIn: checkIn || today, checkOut: checkOut || today,
          roomType: 'Deluxe Room', rooms: 1, mealPlan: 'BB (Bed & Breakfast)', confirmationNo: confNo
        }];
      } else {
        if (hotelName) merged.hotels[0].hotelName = hotelName;
        if (checkIn) merged.hotels[0].checkIn = checkIn;
        if (checkOut) merged.hotels[0].checkOut = checkOut;
        if (confNo) merged.hotels[0].confirmationNo = confNo;
      }
      break;
    }
    case 'receipt': {
      merged.clientName = String(row[3] || merged.clientName || '').trim();
      merged.clientPhone = String(row[4] || merged.clientPhone || '').trim();
      merged.currency = String(row[5] || merged.currency || 'BDT').trim().toUpperCase();
      merged.amount = toNum(row[6]);
      merged.paymentMode = String(row[7] || merged.paymentMode || 'Cash').trim();
      merged.txRef = String(row[8] || merged.txRef || '').trim();
      merged.againstInvoice = String(row[9] || merged.againstInvoice || '').trim();
      merged.purpose = String(row[10] || merged.purpose || 'Travel & Tourism Services').trim();
      merged.status = String(row[11] || merged.status || 'PAID').toUpperCase();
      break;
    }
    case 'quotation': {
      merged.clientName = String(row[3] || merged.clientName || '').trim();
      merged.subject = String(row[4] || merged.subject || 'Tour Package Proposal').trim();
      merged.travelDates = String(row[5] || merged.travelDates || '').trim();
      merged.paxCount = String(row[6] || merged.paxCount || '2 Adults').trim();
      merged.validUntil = formatCellDate(row[7]) || merged.validUntil || today;
      merged.currency = String(row[8] || merged.currency || 'BDT').trim().toUpperCase();
      merged.grandTotal = toNum(row[9]);
      merged.status = String(row[10] || merged.status || 'OPEN').toUpperCase();
      if (!Array.isArray(merged.items) || !merged.items.length) {
        merged.items = [{ description: merged.subject, qty: 1, unitPrice: merged.grandTotal }];
      }
      break;
    }
    case 'ticket': {
      merged.pnr = String(row[3] || merged.pnr || '').trim().toUpperCase();
      merged.clientName = String(row[4] || merged.clientName || '').trim();
      const airlines = String(row[6] || 'BG').trim().toUpperCase();
      const routing = String(row[7] || 'DAC-DXB').trim().toUpperCase();
      const depDate = formatCellDate(row[8]) || today;
      merged.status = String(row[9] || merged.status || 'ISSUED').toUpperCase();
      if (!Array.isArray(merged.passengers) || !merged.passengers.length) {
        merged.passengers = [{ name: (merged.clientName || 'PASSENGER').toUpperCase(), type: 'ADT', ticketNo: '', seat: 'TBA' }];
      }
      if (!Array.isArray(merged.segments) || !merged.segments.length) {
        const parts = routing.split(/[-/\s]+/).filter(Boolean);
        merged.segments = [{
          airlineIata: airlines.slice(0, 2) || 'BG', airlineName: airlines.slice(0, 2) || 'Airline',
          flightNo: `${airlines.slice(0, 2) || 'BG'} 001`,
          originIata: parts[0] || 'DAC', originCity: parts[0] || 'DAC', originTerminal: '',
          destIata: parts[1] || 'DXB', destCity: parts[1] || 'DXB', destTerminal: '',
          depDate: depDate, depTime: '09:00', arrDate: depDate, arrTime: '12:00',
          cabin: 'Economy (Y)', fareBasis: 'YOWBD', baggage: '30 KG', status: 'CONFIRMED'
        }];
      }
      break;
    }
    case 'ticket-invoice': {
      merged.clientName = String(row[3] || merged.clientName || '').trim();
      merged.pnr = String(row[4] || merged.pnr || '').trim().toUpperCase();
      merged.airline = String(row[5] || merged.airline || '').trim();
      merged.sector = String(row[6] || merged.sector || '').trim().toUpperCase();
      merged.currency = String(row[7] || merged.currency || 'BDT').trim().toUpperCase();
      merged.baseFare = toNum(row[8]);
      merged.taxes = toNum(row[9]);
      merged.aitVat = toNum(row[10]);
      merged.serviceCharge = toNum(row[11]);
      merged.discount = toNum(row[12]);
      const grand = toNum(row[13]) || Math.max(0, merged.baseFare + merged.taxes + merged.aitVat + merged.serviceCharge - merged.discount);
      const paid = toNum(row[14]);
      const due = Math.max(0, grand - paid);
      merged.grandTotal = grand;
      merged.paidAmount = paid;
      merged.dueAmount = due;
      merged.status = String(row[16] || (due <= 0.005 && grand > 0 ? 'PAID' : (paid > 0 ? 'PARTIAL' : 'UNPAID'))).toUpperCase();
      break;
    }
    case 'visa': {
      merged.clientName = String(row[3] || merged.clientName || '').trim();
      merged.passportNo = String(row[4] || merged.passportNo || '').trim().toUpperCase();
      merged.nationality = String(row[5] || merged.nationality || 'Bangladeshi').trim();
      merged.destination = String(row[6] || merged.destination || '').trim();
      merged.visaCategory = String(row[7] || merged.visaCategory || 'Tourist').trim();
      merged.entryType = String(row[8] || merged.entryType || 'Single Entry').trim();
      merged.duration = String(row[9] || merged.duration || '30 Days').trim();
      merged.status = String(row[11] || merged.status || 'PROCESSING').toUpperCase();
      if (!Array.isArray(merged.checklist)) merged.checklist = [];
      break;
    }
    case 'itinerary': {
      merged.clientName = String(row[3] || merged.clientName || '').trim();
      merged.title = String(row[4] || merged.title || 'Tour Itinerary').trim();
      merged.destination = String(row[5] || merged.destination || '').trim();
      merged.travelDates = String(row[6] || merged.travelDates || '').trim();
      merged.duration = String(row[7] || merged.duration || '').trim();
      merged.paxCount = String(row[8] || merged.paxCount || '').trim();
      merged.status = String(row[10] || merged.status || 'CONFIRMED').toUpperCase();
      if (!Array.isArray(merged.days) || !merged.days.length) {
        merged.days = [{ dayNo: 1, date: docDate, title: 'Day 1 Arrival', meals: '', hotel: '', details: '' }];
      }
      break;
    }
  }

  if (forceWriteJson || !base || mutatedSheet) {
    merged.updatedBy = forceWriteJson ? 'Google Sheets' : (merged.updatedBy || 'Google Sheets');
    if (schema.jsonCol) {
      sheet.getRange(rowNum, schema.jsonCol).setValue(JSON.stringify(merged));
    }
  }

  return merged;
}

/* ==========================================================================
   Sheet Design System: Tab Colors, Validations, Conditional Badges & Upsert
   ========================================================================== */
function getOrCreateFormattedSheet(ss, schema) {
  let sheet = ss.getSheetByName(schema.name);
  const cols = schema.headers.length;

  if (!sheet) {
    sheet = ss.insertSheet(schema.name);
    sheet.getRange(1, 1, 1, cols).setValues([schema.headers]);
    applySheetHeaderAndRules(sheet, schema);
  } else if (schema.jsonCol && sheet.getLastColumn() < cols) {
    sheet.getRange(1, 1, 1, cols).setValues([schema.headers]);
    applySheetHeaderAndRules(sheet, schema);
  }
  return sheet;
}

function applySheetHeaderAndRules(sheet, schema) {
  const cols = schema.headers.length;
  if (schema.tabColor) sheet.setTabColor(schema.tabColor);

  const headerRange = sheet.getRange(1, 1, 1, cols);
  headerRange
    .setBackground(TB_NAVY)
    .setFontColor('#ffffff')
    .setFontFamily(TB_FONT)
    .setFontWeight('bold')
    .setFontSize(10)
    .setVerticalAlignment('middle')
    .setHorizontalAlignment('left')
    .setWrap(true);

  sheet.setRowHeight(1, 38);
  sheet.setFrozenRows(1);
  if (!sheet.getFilter()) sheet.getRange(1, 1, 1, cols).createFilter();

  for (let c = 1; c <= cols; c++) {
    sheet.autoResizeColumn(c);
    sheet.setColumnWidth(c, Math.max(sheet.getColumnWidth(c) + 28, 120));
  }

  // Dropdown validations for easy manual editing in Sheets
  if (schema.statusCol && schema.statusOptions) {
    const rule = SpreadsheetApp.newDataValidation().requireValueInList(schema.statusOptions, true).setAllowInvalid(true).build();
    sheet.getRange(2, schema.statusCol, 500, 1).setDataValidation(rule);
  }
  if (schema.currencyCol) {
    const curRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['BDT', 'USD', 'EUR', 'GBP', 'AED', 'SAR', 'THB', 'MYR', 'SGD', 'INR'], true)
      .setAllowInvalid(true).build();
    sheet.getRange(2, schema.currencyCol, 500, 1).setDataValidation(curRule);
  }
  if (schema.paymentModeCol) {
    const modeRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['Cash', 'Bank Transfer', 'Cheque', 'bKash / Nagad', 'Card / POS'], true)
      .setAllowInvalid(true).build();
    sheet.getRange(2, schema.paymentModeCol, 500, 1).setDataValidation(modeRule);
  }

  // Native Conditional Formatting Rules on Status Column
  if (schema.statusCol) {
    const stRange = sheet.getRange(2, schema.statusCol, 500, 1);
    const rules = [
      SpreadsheetApp.newConditionalFormatRule().whenTextContains('PAID').setBackground('#dcfce7').setFontColor('#166534').setBold(true).setRanges([stRange]).build(),
      SpreadsheetApp.newConditionalFormatRule().whenTextContains('CONFIRMED').setBackground('#dcfce7').setFontColor('#166534').setBold(true).setRanges([stRange]).build(),
      SpreadsheetApp.newConditionalFormatRule().whenTextContains('ISSUED').setBackground('#dcfce7').setFontColor('#166534').setBold(true).setRanges([stRange]).build(),
      SpreadsheetApp.newConditionalFormatRule().whenTextContains('APPROVED').setBackground('#dcfce7').setFontColor('#166534').setBold(true).setRanges([stRange]).build(),
      SpreadsheetApp.newConditionalFormatRule().whenTextContains('PARTIAL').setBackground('#fef3c7').setFontColor('#92400e').setBold(true).setRanges([stRange]).build(),
      SpreadsheetApp.newConditionalFormatRule().whenTextContains('PROCESSING').setBackground('#fef3c7').setFontColor('#92400e').setBold(true).setRanges([stRange]).build(),
      SpreadsheetApp.newConditionalFormatRule().whenTextContains('PENDING').setBackground('#fef3c7').setFontColor('#92400e').setBold(true).setRanges([stRange]).build(),
      SpreadsheetApp.newConditionalFormatRule().whenTextContains('OPEN').setBackground('#fef3c7').setFontColor('#92400e').setBold(true).setRanges([stRange]).build(),
      SpreadsheetApp.newConditionalFormatRule().whenTextContains('UNPAID').setBackground('#fee2e2').setFontColor('#991b1b').setBold(true).setRanges([stRange]).build(),
      SpreadsheetApp.newConditionalFormatRule().whenTextContains('DUE').setBackground('#fee2e2').setFontColor('#991b1b').setBold(true).setRanges([stRange]).build(),
      SpreadsheetApp.newConditionalFormatRule().whenTextContains('CANCELLED').setBackground('#fee2e2').setFontColor('#991b1b').setBold(true).setRanges([stRange]).build(),
      SpreadsheetApp.newConditionalFormatRule().whenTextContains('REJECTED').setBackground('#fee2e2').setFontColor('#991b1b').setBold(true).setRanges([stRange]).build()
    ];
    sheet.setConditionalFormatRules(rules);
  }

  // Hide Raw JSON column so sheet remains clean for staff
  if (schema.jsonCol) sheet.hideColumns(schema.jsonCol);
}

function styleDataRow(sheet, schema, targetRow, rowValues) {
  const cols = schema.headers.length;
  const rowRange = sheet.getRange(targetRow, 1, 1, cols);
  const bg = (targetRow % 2 === 0) ? TB_WHITE : TB_ZEBRA;

  rowRange
    .setBackground(bg)
    .setFontFamily(TB_FONT)
    .setFontSize(9.5)
    .setFontColor('#0f172a')
    .setVerticalAlignment('middle')
    .setWrap(true)
    .setBorder(null, null, true, null, null, null, TB_BORDER, SpreadsheetApp.BorderStyle.SOLID);

  sheet.setRowHeight(targetRow, 30);

  (schema.currencyCols || []).forEach(colIdx => {
    sheet.getRange(targetRow, colIdx).setNumberFormat('#,##0.00').setHorizontalAlignment('right');
  });

  if (schema.statusCol) {
    const statusCell = sheet.getRange(targetRow, schema.statusCol);
    const val = String((rowValues && rowValues[schema.statusCol - 1]) || statusCell.getValue() || '').toUpperCase();
    statusCell.setFontWeight('bold').setHorizontalAlignment('center');
    if (['PAID', 'CONFIRMED', 'ISSUED', 'OK', 'APPROVED', 'COMPLETED'].indexOf(val) >= 0) {
      statusCell.setBackground('#dcfce7').setFontColor('#166534');
    } else if (['PARTIAL', 'PROCESSING', 'PENDING', 'OPEN', 'SUBMITTED', 'PROPOSED'].indexOf(val) >= 0) {
      statusCell.setBackground('#fef3c7').setFontColor('#92400e');
    } else if (['UNPAID', 'DUE', 'CANCELLED', 'REJECTED', 'EXPIRED'].indexOf(val) >= 0) {
      statusCell.setBackground('#fee2e2').setFontColor('#991b1b');
    }
  }
}

function deleteRowByDocNo(sheet, keyVal) {
  const lastRow = sheet.getLastRow();
  if (!keyVal || lastRow < 2) return;
  const colB = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
  for (let i = colB.length - 1; i >= 0; i--) {
    if (String(colB[i][0]).trim() === String(keyVal).trim()) {
      sheet.deleteRow(i + 2);
      break;
    }
  }
}

function upsertRowByDocNo(sheet, schema, keyVal, rowValues) {
  const lastRow = sheet.getLastRow();
  let targetRow = lastRow + 1;

  if (keyVal && lastRow >= 2) {
    const colB = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
    for (let i = 0; i < colB.length; i++) {
      if (String(colB[i][0]).trim() === String(keyVal).trim()) {
        targetRow = i + 2;
        break;
      }
    }
  }

  const cols = schema.headers.length;
  sheet.getRange(targetRow, 1, 1, cols).setValues([rowValues]);
  styleDataRow(sheet, schema, targetRow, rowValues);
}

function buildRowForType(doc, now) {
  const jsonStr = JSON.stringify(doc);
  switch (doc.type) {
    case 'invoice':
      return [
        now, doc.docNo || '', doc.date || '', doc.clientName || '', doc.clientPhone || '',
        doc.currency || 'BDT', Number(doc.subtotal || 0), Number(doc.taxPercent || 0),
        Number(doc.serviceFee || 0), Number(doc.discount || 0), Number(doc.grandTotal || 0),
        Number(doc.paidAmount || 0), Number(doc.dueAmount || 0), String(doc.status || 'UNPAID').toUpperCase(),
        doc.tripRef || '', jsonStr
      ];
    case 'voucher': {
      const hotels = Array.isArray(doc.hotels) ? doc.hotels : [];
      const h0 = hotels[0] || {};
      return [
        now, doc.docNo || '', doc.date || '', doc.clientName || '', doc.guestPhone || '',
        `${doc.adults || 1}A / ${doc.children || 0}C / ${doc.infants || 0}I`, hotels.length,
        h0.hotelName || '', h0.checkIn || '', h0.checkOut || '', h0.confirmationNo || '',
        String(doc.status || 'CONFIRMED').toUpperCase(), doc.bookingRef || '', jsonStr
      ];
    }
    case 'receipt':
      return [
        now, doc.docNo || '', doc.date || '', doc.clientName || '', doc.clientPhone || '',
        doc.currency || 'BDT', Number(doc.amount || 0), doc.paymentMode || '', doc.txRef || '',
        doc.againstInvoice || '', doc.purpose || '', String(doc.status || 'PAID').toUpperCase(), jsonStr
      ];
    case 'quotation':
      return [
        now, doc.docNo || '', doc.date || '', doc.clientName || '', doc.subject || '',
        doc.travelDates || '', doc.paxCount || '', doc.validUntil || '',
        doc.currency || 'BDT', Number(doc.grandTotal || 0), String(doc.status || 'OPEN').toUpperCase(), jsonStr
      ];
    case 'ticket': {
      const segs = Array.isArray(doc.segments) ? doc.segments : [];
      const pax = Array.isArray(doc.passengers) ? doc.passengers : [];
      return [
        now, doc.docNo || '', doc.date || '', doc.pnr || '', doc.clientName || '', pax.length,
        Array.from(new Set(segs.map(s => s.airlineIata).filter(Boolean))).join(', '),
        segs.map(s => `${s.originIata || ''}-${s.destIata || ''}`).join(' / '),
        segs[0] ? (segs[0].depDate || '') : '', String(doc.status || 'ISSUED').toUpperCase(), jsonStr
      ];
    }
    case 'ticket-invoice':
      return [
        now, doc.docNo || '', doc.date || '', doc.clientName || '', doc.pnr || '',
        doc.airline || '', doc.sector || '', doc.currency || 'BDT',
        Number(doc.baseFare || 0), Number(doc.taxes || 0), Number(doc.aitVat || 0),
        Number(doc.serviceCharge || 0), Number(doc.discount || 0), Number(doc.grandTotal || 0),
        Number(doc.paidAmount || 0), Number(doc.dueAmount || 0), String(doc.status || 'UNPAID').toUpperCase(), jsonStr
      ];
    case 'visa': {
      const list = Array.isArray(doc.checklist) ? doc.checklist : [];
      return [
        now, doc.docNo || '', doc.date || '', doc.clientName || '', doc.passportNo || '',
        doc.nationality || '', doc.destination || '', doc.visaCategory || '', doc.entryType || '',
        doc.duration || '', `${list.filter(i => i.checked).length}/${list.length}`,
        String(doc.status || 'PROCESSING').toUpperCase(), jsonStr
      ];
    }
    case 'itinerary': {
      const days = Array.isArray(doc.days) ? doc.days : [];
      return [
        now, doc.docNo || '', doc.date || '', doc.clientName || '', doc.title || '',
        doc.destination || '', doc.travelDates || '', doc.duration || '', doc.paxCount || '',
        days.length, String(doc.status || 'CONFIRMED').toUpperCase(), jsonStr
      ];
    }
    default:
      return [now, doc.docNo || '', doc.date || '', doc.clientName || '', jsonStr];
  }
}
