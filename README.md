# TourBuzz Travel Management System (Enterprise Static Web App)

**Company:** TourBuzz Travel Services Ltd. (*a concern of TourBuzz Group — beyond journeys*)  
**Slogan:** Exploring Happiness  
**Head Office:** HI Khan Trade Center (Brac Bank Building), Level-9, Tajmahal Road, Mohammadpur, Dhaka, Bangladesh - 1207  
**Contact:** +880 1933-128801 | tourbuzzrsupport@gmail.com | [tourbuzz.com.bd](https://tourbuzz.com.bd)

---

## Architecture Overview

TourBuzz TMS is a **flat-directory, zero-build, zero-backend static web application** built with pure HTML5, CSS3, and ES6+ Vanilla JavaScript. Every file sits in the root folder so it runs directly from local disk (`index.html`) or deploys immediately to GitHub Pages, Netlify, or Vercel.

### Included Files
- `index.html` — Executive Dashboard, KPIs, Quick Launchers, Live Sync Status
- `documents.html` — Master Vault (merges Local Cache + GitHub Cloud, search, filter, JSON Backup/Restore)
- `invoice.html` — Commercial & Tour Invoice Maker + Live A4 Preview
- `voucher.html` — Multi-Hotel & Land Service Voucher Maker + Live A4 Preview
- `receipt.html` — Official Money Receipt Maker (linked to saved invoices) + Live A4 Preview
- `quotation.html` — Tour & Package Quotation Builder + Live A4 Preview
- `ticket.html` — GDS-Style Airline E-Ticket Generator (110 Airlines & 110 Airports Autocomplete, Airline Logos, CODE-128 Barcode & QR Code)
- `ticket-invoice.html` — Air Ticket Billing & Fare Breakdown Invoice (One-Click Import from Saved E-Ticket)
- `visa.html` — Visa Processing & Submitted-Documents Checklist Sheet
- `settings.html` — GitHub PAT & Repo Configurator, Google Sheets Webhook Tester, Bank Details
- `config.js` — Corporate identity defaults, bank details, currencies, sync settings
- `app.js` — Tri-layer sync engine, localStorage store, GitHub Contents API v3, Print/PDF, autocomplete, theme
- `aviation-data.js` — 110 Airlines (IATA/ICAO/Name/Country) & 110 Airports (IATA/ICAO/Name/City/Country)
- `doc-renderers.js` — Single source of truth rendering exact A4 `.sheet` HTML for all 7 document types
- `doc-actions.js` — Unified Save, Cloud Push, Load-to-Edit, Print A4, PDF export, and Reset handlers
- `theme.css` — Enterprise Light/Dark design system, split-screen maker layout, and `@media print` rules
- `google-apps-script.gs` — Auto-formatted Google Sheets sync backend with duplicate-free Upsert
- `logo.png` & `banner.png` — Official TourBuzz brand header logo and A4 footer banner

---

## Quick Start (Local Windows / macOS / Linux)

1. Extract the `tourbuzz-tms` folder anywhere on your computer.
2. Double-click `index.html` to open TourBuzz TMS in Chrome, Edge, or Brave.
3. Start creating invoices, vouchers, receipts, quotations, e-tickets, ticket invoices, or visa checklists immediately—all records save instantly to your browser's local storage.

---

## Deploying Online (GitHub Pages / Netlify / Vercel)

### GitHub Pages
1. Create a GitHub repository (e.g., `tourbuzz-tms`) and upload all files from the `tourbuzz-tms` folder to the repository root.
2. Go to **Settings → Pages → Build and deployment → Deploy from a branch**, choose `main` and `/ (root)`, and click **Save**.

### Netlify / Vercel
- Drag and drop the `tourbuzz-tms` folder into [Netlify Drop](https://app.netlify.com/drop) or import the GitHub repo in Vercel with **Framework Preset: Other** and **Build Command: (empty)**.

---

## Enabling Multi-PC Real-Time Cloud Sync

### Layer 2: GitHub Cloud Vault (Two-Way Sync)
1. Create a private GitHub repository (e.g., `tourbuzz-tms-vault`) initialized with a `README` on the `main` branch.
2. Create a Fine-Grained Personal Access Token (PAT) at **GitHub → Settings → Developer settings → Personal access tokens** with **Contents: Read and write** permission on that repository.
3. Open **Cloud & Settings** (`settings.html`) on each TourBuzz staff PC, enter the Owner, Repo, Branch (`main`), and PAT, then click **Save Cloud Settings** and **Test GitHub Connection**.
4. Every saved document pushes cleanly to `Documents/<Type>/<YYYY>/<MM>/<DocNumber>.json` using SHA-aware updates (no 409 conflicts) and auto-pulls across all connected PCs.

### Layer 3: Formatted Google Sheets Ledger
1. Create a new Google Sheet (e.g., *TourBuzz TMS Master Ledger*).
2. Open **Extensions → Apps Script**, paste the full contents of `google-apps-script.gs`, and save.
3. Click **Deploy → New deployment → Web app**, set **Execute as: Me** and **Who has access: Anyone**, and copy the Web App URL.
4. Paste the URL into **Cloud & Settings** (`settings.html`) and click **Test Google Sheets Webhook**.

---

## Printing & Retina A4 PDF Export
- Click **Print A4** for direct browser printing using `@page { size: A4; margin: 0; }` (enable *Background graphics* in Chrome/Edge print settings for full Navy/Orange header colors).
- Click **Download PDF** to export a Retina (`scale: 2`) A4 PDF named `<DocNumber>_<ClientName>.pdf` with embedded barcodes, QR codes, airline logos, `logo.png`, and `banner.png`.
