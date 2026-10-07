'use strict';
const { Setting } = require('./models');
const defaults = require('./defaults');
const { deepMerge, clean, bad, isEmail, slug, HEX, appearanceProblems } = require('./util');

let cache = null;
let cacheAt = 0;

async function getSettings() {
  if (cache && Date.now() - cacheAt < 15000) return cache;
  const doc = await Setting.findOne({ key: 'site' }).lean();
  cache = deepMerge(defaults, (doc && doc.data) || {});
  cacheAt = Date.now();
  return cache;
}

function invalidate() {
  cache = null;
}

const clone = (o) => JSON.parse(JSON.stringify(o));

// What visitors may see (never expose the private recipient inbox).
function publicView(s) {
  const c = clone(s);
  delete c.contact.recipientEmail;
  return c;
}

const FIELD_TYPES = ['text', 'textarea', 'email', 'tel', 'date', 'number', 'select', 'class'];

const validators = {
  school(v) {
    if (!v.name) throw bad('School name is required.');
    return v;
  },
  contact(v) {
    if (v.email && !isEmail(v.email)) throw bad('Enter a valid school email address.');
    if (v.recipientEmail && !isEmail(v.recipientEmail)) throw bad('Enter a valid email address for form submissions.');
    if (/^https?:/i.test(v.mapQuery) && !/^https:\/\/(www\.google\.com\/maps\/embed|maps\.google\.com\/)/i.test(v.mapQuery)) {
      throw bad('For the map, type the address or paste the Google Maps “Embed a map” link (it starts with https://www.google.com/maps/embed).');
    }
    return v;
  },
  whatsapp(v) {
    v.number = String(v.number).replace(/\D/g, '');
    if (v.number && (v.number.length < 7 || v.number.length > 15)) {
      throw bad('Enter the WhatsApp number with its country code and digits only, for example 2348012345678.');
    }
    return v;
  },
  social(v) {
    for (const k of Object.keys(v)) {
      if (v[k] && !/^https?:\/\//i.test(v[k])) throw bad(`The ${k} link must start with https://`);
    }
    return v;
  },
  appearance(v) {
    for (const k of ['primary', 'secondary', 'accent', 'text', 'background']) {
      if (!HEX.test(v[k])) throw bad('Colours must be valid hex values such as #0B2545.');
      v[k] = v[k].toUpperCase();
    }
    const problems = appearanceProblems(v);
    if (problems.length) throw bad(problems[0]);
    return v;
  },
  admissions(v) {
    const seen = new Set();
    v.fields = v.fields
      .filter((f) => f.label)
      .map((f) => {
        const base = slug(f.key || f.label) || 'field';
        let key = base;
        let i = 2;
        while (seen.has(key)) key = `${base}_${i++}`;
        seen.add(key);
        const type = FIELD_TYPES.includes(f.type) ? f.type : 'text';
        if (type === 'select' && f.options.length === 0) throw bad(`Add at least one option to “${f.label}”.`);
        return { ...f, key, type, options: type === 'select' ? f.options : [] };
      });
    if (v.fields.length === 0) throw bad('The admission form needs at least one field.');
    if (v.fields.some((f) => f.type === 'class') && v.classes.length === 0) throw bad('Add at least one available class.');
    return v;
  },
};

async function saveSection(name, input) {
  if (!Object.prototype.hasOwnProperty.call(defaults, name)) throw bad('Unknown section.', 404);
  let value = clean(input, defaults[name]);
  if (validators[name]) value = validators[name](value);
  await Setting.findOneAndUpdate(
    { key: 'site' },
    { $set: { ['data.' + name]: value } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  invalidate();
  return value;
}

module.exports = { getSettings, invalidate, publicView, saveSection, clone };
