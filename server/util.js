'use strict';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const bad = (message, status = 400) => Object.assign(new Error(message), { status });
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || ''));
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function slug(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

/* ---------- Defaults + stored content ---------- */

function deepMerge(base, over) {
  if (Array.isArray(base)) return Array.isArray(over) ? over : base;
  if (isObj(base)) {
    const out = {};
    for (const k of Object.keys(base)) out[k] = deepMerge(base[k], isObj(over) ? over[k] : undefined);
    return out;
  }
  if (over === undefined || over === null || typeof over !== typeof base) return base;
  return over;
}

function blankOf(t) {
  if (Array.isArray(t)) return [];
  if (isObj(t)) {
    const o = {};
    for (const k of Object.keys(t)) o[k] = blankOf(t[k]);
    return o;
  }
  if (typeof t === 'boolean') return false;
  if (typeof t === 'number') return 0;
  return '';
}

/* ---------- Sanitising admin input against the default structure ---------- */

const URL_KEYS = /(url|link|image|logo|favicon|photo)$/i;
const SOCIAL_KEYS = /^(facebook|instagram|tiktok|youtube|linkedin|twitter)$/;

function safeUrl(v) {
  v = String(v || '').trim();
  if (!v) return '';
  return /^(https?:\/\/|\/(?!\/)|mailto:|tel:|#)/i.test(v) ? v : '';
}

function clean(val, tpl, key = '') {
  if (Array.isArray(tpl)) {
    const arr = Array.isArray(val) ? val.slice(0, 200) : [];
    const t = tpl[0];
    if (isObj(t)) {
      const blank = blankOf(t);
      return arr.filter(isObj).map((x) => clean(x, blank));
    }
    return arr.map((x) => clean(x, '', key)).filter((x) => x !== '');
  }
  if (isObj(tpl)) {
    const out = {};
    for (const k of Object.keys(tpl)) out[k] = clean(isObj(val) ? val[k] : undefined, tpl[k], k);
    return out;
  }
  if (typeof tpl === 'boolean') return val === undefined ? tpl : val === true || val === 'true';
  if (typeof tpl === 'number') {
    const n = Number(val);
    return Number.isFinite(n) ? n : tpl;
  }
  let s = val === undefined || val === null ? tpl : String(val);
  s = String(s).trim().slice(0, 6000);
  if (URL_KEYS.test(key) || SOCIAL_KEYS.test(key)) s = safeUrl(s);
  return s;
}

/* ---------- Colour accessibility ---------- */

const HEX = /^#[0-9a-f]{6}$/i;

function luminance(hex) {
  const c = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Returns a list of plain-language problems (empty list = readable).
function appearanceProblems(a) {
  const out = [];
  const check = (fg, bg, min, msg) => {
    const r = contrast(a[fg], a[bg]);
    if (r < min) out.push(`${msg} (contrast ${r.toFixed(1)}:1, needs ${min}:1 or more).`);
  };
  check('text', 'background', 4.5, 'Text colour is too close to the background colour');
  check('text', 'secondary', 4.5, 'Text colour is too close to the secondary (soft background) colour');
  check('primary', 'background', 4.5, 'Primary colour is too light for headings and links on the background');
  check('primary', 'secondary', 4.5, 'Primary colour is too light to read on the secondary colour');
  return out;
}

module.exports = {
  isObj, bad, isEmail, escapeRegex, escapeHtml, slug,
  deepMerge, blankOf, clean, safeUrl,
  HEX, luminance, contrast, appearanceProblems,
};
