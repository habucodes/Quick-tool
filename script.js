// ============================================================================
// QR Code Generator — main script
//
// Everything here is vanilla JS + DOM APIs. The only dependency is the
// `qrcode` library, imported as an ES module so it's bundled at build time
// (no CDN fetch at runtime) — the page keeps working with no network access.
// ============================================================================

import QRCode from 'qrcode';

// ---- DOM references --------------------------------------------------------
const urlInput = document.getElementById('url-input');
const generateBtn = document.getElementById('generate-btn');
const clearBtn = document.getElementById('clear-btn');
const errorMessage = document.getElementById('error-message');
const resultCard = document.getElementById('result-card');
const qrCanvas = document.getElementById('qr-canvas');
const resultUrl = document.getElementById('result-url');
const downloadBtn = document.getElementById('download-btn');
const copyBtn = document.getElementById('copy-btn');
const themeToggle = document.getElementById('theme-toggle');
const toast = document.getElementById('toast');

// Holds the last successfully-generated URL, used for download/copy.
let currentUrl = '';
let toastTimer = null;

// ---- Theme handling ---------------------------------------------------------
// Respect a saved preference; otherwise fall back to the OS-level setting.
const THEME_KEY = 'qr-generator-theme';

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'light' || saved === 'dark') {
    applyTheme(saved);
    return;
  }
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(prefersDark ? 'dark' : 'light');
}

themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
});

initTheme();

// ---- URL validation ----------------------------------------------------------
/**
 * Validates a raw string as a usable URL.
 *
 * Accepts URLs typed without a protocol (e.g. "example.com") by trying an
 * "https://" prefix as a fallback — but still rejects anything that isn't a
 * plausible web address (must have a host with at least one dot, or be
 * "localhost").
 *
 * @param {string} raw
 * @returns {{ valid: true, url: string } | { valid: false, reason: string }}
 */
function validateUrl(raw) {
  const trimmed = raw.trim();

  if (!trimmed) {
    return { valid: false, reason: 'Please enter a URL first.' };
  }

  const candidates = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)
    ? [trimmed]
    : [`https://${trimmed}`];

  for (const candidate of candidates) {
    try {
      const parsed = new URL(candidate);
      const isHttp = parsed.protocol === 'http:' || parsed.protocol === 'https:';
      const hasPlausibleHost =
        parsed.hostname === 'localhost' || parsed.hostname.includes('.');

      if (isHttp && hasPlausibleHost) {
        return { valid: true, url: parsed.toString() };
      }
    } catch {
      // Fall through and try the next candidate / report invalid below.
    }
  }

  return { valid: false, reason: 'That doesn\'t look like a valid URL. Try something like https://example.com' };
}

// ---- Error UI helpers ----------------------------------------------------------
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
  urlInput.classList.add('invalid');
}

function clearError() {
  errorMessage.hidden = true;
  errorMessage.textContent = '';
  urlInput.classList.remove('invalid');
}

// ---- Toast helper ----------------------------------------------------------------
function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 2200);
}

// ---- QR generation ----------------------------------------------------------------
async function generateQrCode() {
  const { valid, url, reason } = validateUrl(urlInput.value);

  if (!valid) {
    showError(reason);
    resultCard.hidden = true;
    return;
  }

  clearError();

  try {
    // Read the current accent/background colors so the QR code matches
    // whichever theme is active.
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    await QRCode.toCanvas(qrCanvas, url, {
      width: 480,
      margin: 2,
      color: {
        dark: isDark ? '#10111d' : '#14162b',
        light: '#ffffff',
      },
    });

    currentUrl = url;
    resultUrl.textContent = url;
    resultCard.hidden = false;
    resultCard.classList.remove('result-card');
    // Re-trigger the pop-in animation on every generation.
    void resultCard.offsetWidth;
    resultCard.classList.add('result-card');
  } catch (err) {
    showError('Something went wrong generating the QR code. Please try again.');
    resultCard.hidden = true;
    // eslint-disable-next-line no-console
    console.error('QR generation failed:', err);
  }
}

// ---- Download as PNG ----------------------------------------------------------------
function downloadQrCode() {
  if (!currentUrl) return;

  const link = document.createElement('a');
  link.download = 'qr-code.png';
  link.href = qrCanvas.toDataURL('image/png');
  document.body.appendChild(link);
  link.click();
  link.remove();
  showToast('QR code downloaded');
}

// ---- Copy link ----------------------------------------------------------------------
async function copyLink() {
  const value = currentUrl || urlInput.value.trim();

  if (!value) {
    showToast('Nothing to copy yet');
    return;
  }

  try {
    await navigator.clipboard.writeText(value);
    showToast('Link copied to clipboard');
  } catch {
    // Fallback for browsers/contexts without Clipboard API access.
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
    showToast('Link copied to clipboard');
  }
}

// ---- Clear everything ----------------------------------------------------------------
function clearAll() {
  urlInput.value = '';
  currentUrl = '';
  clearError();
  resultCard.hidden = true;
  const ctx = qrCanvas.getContext('2d');
  ctx?.clearRect(0, 0, qrCanvas.width, qrCanvas.height);
  urlInput.focus();
}

// ---- Event wiring ----------------------------------------------------------------------
generateBtn.addEventListener('click', generateQrCode);
clearBtn.addEventListener('click', clearAll);
downloadBtn.addEventListener('click', downloadQrCode);
copyBtn.addEventListener('click', copyLink);

urlInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    generateQrCode();
  }
});

urlInput.addEventListener('input', () => {
  if (!errorMessage.hidden) {
    clearError();
  }
});
