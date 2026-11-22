/* ==========================================================================
   TourBuzz Travel Management System — Corporate, Team & Sync Configuration
   ========================================================================== */

const DEFAULT_CONFIG = {
  COMPANY: {
    NAME: 'TourBuzz Travel Services Ltd.',
    GROUP_TAGLINE: 'a concern of TourBuzz Group — beyond journeys',
    SLOGAN: 'Exploring Happiness',
    ADDRESS: 'HI Khan Trade Center (Brac Bank Building), Level-9, Tajmahal Road, Mohammadpur, Dhaka, Bangladesh - 1207',
    PHONE: '+880 1933-128801',
    EMAIL: 'tourbuzzrsupport@gmail.com',
    WEBSITE: 'tourbuzz.com.bd',
    FACEBOOK: 'tourbuzzbd',
    LOGO_PATH: 'logo.png',
    BANNER_PATH: 'banner.png',
    SIGNATURE_PATH: 'signature.png'
  },

  STAFF: {
    NAME: '',
    DESK_CODE: ''
  },

  BRAND: {
    PRIMARY: '#f5820b',
    SECONDARY: '#102542',
    SUCCESS: '#157f3d'
  },

  BANK_DETAILS: [
    {
      bankName: 'EASTERN BANK PLC',
      accountName: 'TourBuzz Travel Services Limited',
      accountNumber: '1331070272040',
      branch: 'Gulshan Avenue Branch',
      routingNo: '095261733'
    },
    {
      bankName: 'bKash / Nagad Merchant',
      accountName: 'TourBuzz Travel Services Ltd.',
      accountNumber: '01933-128801',
      branch: 'Digital Payment',
      routingNo: 'Reference: Invoice / File No'
    }
  ],

  CURRENCIES: [
    { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka', minor: 'Paisa' },
    { code: 'USD', symbol: '$', name: 'US Dollar', minor: 'Cents' },
    { code: 'EUR', symbol: '€', name: 'Euro', minor: 'Cents' },
    { code: 'GBP', symbol: '£', name: 'British Pound', minor: 'Pence' },
    { code: 'AED', symbol: 'AED ', name: 'UAE Dirham', minor: 'Fils' },
    { code: 'SAR', symbol: 'SAR ', name: 'Saudi Riyal', minor: 'Halala' },
    { code: 'THB', symbol: '฿', name: 'Thai Baht', minor: 'Satang' },
    { code: 'MYR', symbol: 'RM ', name: 'Malaysian Ringgit', minor: 'Sen' },
    { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', minor: 'Cents' },
    { code: 'INR', symbol: '₹', name: 'Indian Rupee', minor: 'Paise' },
    { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', minor: 'Cents' },
    { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', minor: 'Cents' }
  ],

  DOC_TYPES: {
    invoice: { label: 'INVOICE', folder: 'Invoices', prefix: 'TB-INV', page: 'invoice.html' },
    voucher: { label: 'Hotel Voucher', folder: 'Vouchers', prefix: 'TB-VCH', page: 'voucher.html' },
    receipt: { label: 'Money Receipt', folder: 'Receipts', prefix: 'TB-RCT', page: 'receipt.html' },
    quotation: { label: 'Tour Quotation', folder: 'Quotations', prefix: 'TB-QTN', page: 'quotation.html' },
    ticket: { label: 'Airline E-Ticket', folder: 'Airline_Tickets', prefix: 'TB-TKT', page: 'ticket.html' },
    'ticket-invoice': { label: 'Air Ticket Invoice', folder: 'Airline_Ticket_Invoices', prefix: 'TB-TIV', page: 'ticket-invoice.html' },
    visa: { label: 'Visa Document', folder: 'Visa_Documents', prefix: 'TB-VIS', page: 'visa.html' },
    itinerary: { label: 'Tour Itinerary', folder: 'Tour_Itineraries', prefix: 'TB-ITN', page: 'itinerary.html' }
  },

  GITHUB_OWNER: 'anikapps',
  GITHUB_REPO: 'tourbuzz-vault',
  GITHUB_BRANCH: 'main',
  GITHUB_TOKEN: '',
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbw9RvShP7iuUq49ql67JlOhlAZL2SLH8SwWmXwdqgEzpQwyk_3RfEPkavocKOQfN4dG/exec',

  SYNC_INTERVAL_MS: 30000,
  STORAGE_KEYS: {
    DOCS: 'tourbuzz_tms_docs_v1',
    SETTINGS: 'tourbuzz_tms_settings_v1',
    THEME: 'tourbuzz_tms_theme_v1',
    LAST_SYNC: 'tourbuzz_tms_last_sync_v1',
    EDIT_BUFFER: 'tourbuzz_tms_edit_buffer_v1',
    CLIENTS: 'tourbuzz_tms_clients_v1',
    OUTBOX: 'tourbuzz_tms_outbox_v1'
  }
};

function loadRuntimeConfig() {
  try {
    const raw = localStorage.getItem(DEFAULT_CONFIG.STORAGE_KEYS.SETTINGS);
    if (!raw) return structuredClone(DEFAULT_CONFIG);
    const saved = JSON.parse(raw);
    return {
      ...structuredClone(DEFAULT_CONFIG),
      GITHUB_OWNER: saved.GITHUB_OWNER || DEFAULT_CONFIG.GITHUB_OWNER,
      GITHUB_REPO: saved.GITHUB_REPO || DEFAULT_CONFIG.GITHUB_REPO,
      GITHUB_BRANCH: saved.GITHUB_BRANCH || DEFAULT_CONFIG.GITHUB_BRANCH,
      GITHUB_TOKEN: saved.GITHUB_TOKEN || DEFAULT_CONFIG.GITHUB_TOKEN,
      APPS_SCRIPT_URL: saved.APPS_SCRIPT_URL || DEFAULT_CONFIG.APPS_SCRIPT_URL,
      STAFF: { ...DEFAULT_CONFIG.STAFF, ...(saved.STAFF || {}) },
      COMPANY: { ...DEFAULT_CONFIG.COMPANY, ...(saved.COMPANY || {}) },
      BANK_DETAILS: (Array.isArray(saved.BANK_DETAILS) && saved.BANK_DETAILS.length && saved.BANK_DETAILS[0].accountNumber !== '2051204891001')
        ? saved.BANK_DETAILS
        : structuredClone(DEFAULT_CONFIG.BANK_DETAILS)
    };
  } catch (e) {
    console.warn('TourBuzz Config load fallback:', e);
    return structuredClone(DEFAULT_CONFIG);
  }
}

window.CONFIG = loadRuntimeConfig();
window.reloadTourBuzzConfig = function () {
  window.CONFIG = loadRuntimeConfig();
  return window.CONFIG;
};
