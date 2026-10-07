'use strict';
const express = require('express');
const multer = require('multer');
const { Setting, Announcement, GalleryImage, Media, Application, PushSub } = require('../models');
const { getSettings, saveSection, clone, invalidate } = require('../settings');
const { uploadBuffer, destroy } = require('../cloud');
const { notifyAdmins, isReady } = require('../push');
const { bad, escapeRegex, safeUrl, isObj } = require('../util');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 20 },
  fileFilter: (req, file, cb) =>
    /^image\/(jpeg|png|webp|gif|avif)$/.test(file.mimetype)
      ? cb(null, true)
      : cb(bad('Only JPG, PNG, WebP, GIF or AVIF images can be uploaded.')),
});

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

/* ---------- Dashboard ---------- */

router.get('/stats', wrap(async (req, res) => {
  const [s, galleryCount, appTotal, appNew, annPublished, lastSetting, lastAnn, lastImg, devices, recent] = await Promise.all([
    getSettings(),
    GalleryImage.countDocuments(),
    Application.countDocuments(),
    Application.countDocuments({ read: false }),
    Announcement.countDocuments({ published: true }),
    Setting.findOne({ key: 'site' }).select('updatedAt').lean(),
    Announcement.findOne().sort({ updatedAt: -1 }).select('updatedAt').lean(),
    GalleryImage.findOne().sort({ updatedAt: -1 }).select('updatedAt').lean(),
    PushSub.countDocuments(),
    Application.find().sort({ createdAt: -1 }).limit(5).select('ref applicant classApplied createdAt read').lean(),
  ]);
  const dates = [lastSetting, lastAnn, lastImg].filter(Boolean).map((d) => new Date(d.updatedAt).getTime());
  res.json({
    galleryCount,
    applications: { total: appTotal, unread: appNew },
    announcementsPublished: annPublished,
    admissionsOpen: s.admissions.enabled,
    whatsappNumber: s.whatsapp.number,
    lastUpdate: dates.length ? new Date(Math.max(...dates)) : null,
    pushReady: isReady(),
    pushDevices: devices,
    recent,
    checklist: {
      logo: !!s.school.logo,
      heroImage: !!s.home.hero.image,
      phone: !!s.contact.phone,
      email: !!s.contact.email,
      recipient: !!(s.contact.recipientEmail || s.contact.email),
      whatsapp: !!s.whatsapp.number,
      address: s.contact.address !== '12 School Lane, Your City',
    },
  });
}));

/* ---------- Settings (all sections) ---------- */

router.get('/settings', wrap(async (req, res) => {
  invalidate();
  res.json({ settings: clone(await getSettings()) });
}));

router.put('/settings/:section', wrap(async (req, res) => {
  const value = await saveSection(req.params.section, req.body.value);
  res.json({ value });
}));

/* ---------- Announcements ---------- */

function annFromBody(b) {
  const title = String(b.title || '').trim().slice(0, 200);
  if (!title) throw bad('Give the announcement a title.');
  const date = b.date ? new Date(b.date) : new Date();
  if (Number.isNaN(date.getTime())) throw bad('Enter a valid date.');
  return {
    title,
    description: String(b.description || '').trim().slice(0, 4000),
    date,
    image: safeUrl(b.image),
    important: b.important === true,
    published: b.published !== false,
  };
}

router.get('/announcements', wrap(async (req, res) => {
  res.json({ items: await Announcement.find().sort({ date: -1 }).lean() });
}));
router.post('/announcements', wrap(async (req, res) => {
  res.json({ item: await Announcement.create(annFromBody(req.body)) });
}));
router.put('/announcements/:id', wrap(async (req, res) => {
  const item = await Announcement.findByIdAndUpdate(req.params.id, annFromBody(req.body), { new: true });
  if (!item) throw bad('Announcement not found.', 404);
  res.json({ item });
}));
router.delete('/announcements/:id', wrap(async (req, res) => {
  await Announcement.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
}));

/* ---------- Media library ---------- */

async function isInUse(url) {
  invalidate();
  if (JSON.stringify(await getSettings()).includes(url)) return true;
  if (await Announcement.exists({ image: url })) return true;
  if (await GalleryImage.exists({ url })) return true;
  return false;
}

router.get('/media', wrap(async (req, res) => {
  const [media, gallery] = await Promise.all([
    Media.find().sort({ createdAt: -1 }).limit(300).lean(),
    GalleryImage.find().sort({ createdAt: -1 }).limit(300).select('url title').lean(),
  ]);
  res.json({ items: media.map((m) => ({ ...m, source: 'media' })), gallery });
}));

router.post('/media', upload.single('file'), wrap(async (req, res) => {
  if (!req.file) throw bad('Choose an image to upload.');
  const r = await uploadBuffer(req.file.buffer, 'media');
  const item = await Media.create({
    url: r.secure_url,
    publicId: r.public_id,
    width: r.width,
    height: r.height,
    label: String(req.body.label || '').slice(0, 120),
  });
  res.json({ item });
}));

router.delete('/media/:id', wrap(async (req, res) => {
  const m = await Media.findById(req.params.id);
  if (!m) throw bad('Image not found.', 404);
  if (await isInUse(m.url)) throw bad('This image is used on the website. Replace it there first, then delete it here.', 409);
  await destroy(m.publicId);
  await m.deleteOne();
  res.json({ ok: true });
}));

/* ---------- Gallery ---------- */

router.get('/gallery', wrap(async (req, res) => {
  res.json({ items: await GalleryImage.find().sort({ createdAt: -1 }).lean() });
}));

router.post('/gallery', upload.array('files', 20), wrap(async (req, res) => {
  if (!req.files || !req.files.length) throw bad('Choose at least one image.');
  const category = String(req.body.category || 'School').slice(0, 80);
  const published = req.body.published !== 'false';
  const title = req.files.length === 1 ? String(req.body.title || '').slice(0, 200) : '';
  const items = [];
  for (const f of req.files) {
    const r = await uploadBuffer(f.buffer, 'gallery');
    items.push(await GalleryImage.create({ url: r.secure_url, publicId: r.public_id, category, published, title }));
  }
  res.json({ items });
}));

router.put('/gallery/:id', wrap(async (req, res) => {
  const patch = {};
  if (req.body.title !== undefined) patch.title = String(req.body.title).slice(0, 200);
  if (req.body.category !== undefined) patch.category = String(req.body.category).slice(0, 80);
  if (req.body.published !== undefined) patch.published = req.body.published === true;
  const item = await GalleryImage.findByIdAndUpdate(req.params.id, patch, { new: true });
  if (!item) throw bad('Image not found.', 404);
  res.json({ item });
}));

router.put('/gallery/:id/replace', upload.single('file'), wrap(async (req, res) => {
  if (!req.file) throw bad('Choose an image to upload.');
  const item = await GalleryImage.findById(req.params.id);
  if (!item) throw bad('Image not found.', 404);
  const r = await uploadBuffer(req.file.buffer, 'gallery');
  const old = item.publicId;
  item.url = r.secure_url;
  item.publicId = r.public_id;
  await item.save();
  await destroy(old);
  res.json({ item });
}));

router.delete('/gallery/:id', wrap(async (req, res) => {
  const item = await GalleryImage.findById(req.params.id);
  if (item) {
    await destroy(item.publicId);
    await item.deleteOne();
  }
  res.json({ ok: true });
}));

/* ---------- Admission applications ---------- */

router.get('/applications', wrap(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = 20;
  const q = String(req.query.q || '').trim().toLowerCase().slice(0, 100);
  const filter = q ? { $or: [{ searchText: { $regex: escapeRegex(q) } }, { ref: { $regex: escapeRegex(q), $options: 'i' } }] } : {};
  const [items, total] = await Promise.all([
    Application.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('ref applicant classApplied createdAt read emailStatus')
      .lean(),
    Application.countDocuments(filter),
  ]);
  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
}));

const csvCell = (v) => {
  let s = String(v ?? '');
  if (/^[=+\-@]/.test(s)) s = "'" + s; // stops spreadsheet formula injection
  return `"${s.replace(/"/g, '""')}"`;
};

router.get('/applications/export.csv', wrap(async (req, res) => {
  const apps = await Application.find().sort({ createdAt: -1 }).lean();
  const labels = [];
  apps.forEach((a) => a.answers.forEach((x) => { if (!labels.includes(x.label)) labels.push(x.label); }));
  const lines = [['Reference', 'Submitted', ...labels].map(csvCell).join(',')];
  for (const a of apps) {
    const map = Object.fromEntries(a.answers.map((x) => [x.label, x.value]));
    lines.push([a.ref, new Date(a.createdAt).toISOString(), ...labels.map((l) => map[l] || '')].map(csvCell).join(','));
  }
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="applications.csv"' });
  res.send('\ufeff' + lines.join('\r\n'));
}));

router.get('/applications/:id', wrap(async (req, res) => {
  const item = await Application.findById(req.params.id);
  if (!item) throw bad('Application not found.', 404);
  if (!item.read) {
    item.read = true;
    await item.save();
  }
  res.json({ item });
}));

router.delete('/applications/:id', wrap(async (req, res) => {
  await Application.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
}));

/* ---------- Browser notifications ---------- */

router.get('/push/key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || '', enabled: isReady() });
});

router.post('/push/subscribe', wrap(async (req, res) => {
  const sub = req.body.subscription;
  if (!isObj(sub) || !sub.endpoint || !isObj(sub.keys) || !sub.keys.p256dh || !sub.keys.auth) throw bad('Invalid subscription.');
  if (!/^https:\/\//.test(sub.endpoint)) throw bad('Invalid subscription.');
  await PushSub.findOneAndUpdate(
    { endpoint: sub.endpoint },
    { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth }, admin: req.admin._id, userAgent: String(req.get('user-agent') || '').slice(0, 250) },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  res.json({ ok: true, devices: await PushSub.countDocuments() });
}));

router.post('/push/unsubscribe', wrap(async (req, res) => {
  if (req.body.endpoint) await PushSub.deleteOne({ endpoint: String(req.body.endpoint) });
  res.json({ ok: true, devices: await PushSub.countDocuments() });
}));

router.get('/push/devices', wrap(async (req, res) => {
  res.json({ items: await PushSub.find().sort({ createdAt: -1 }).select('userAgent createdAt').lean() });
}));

router.delete('/push/devices/:id', wrap(async (req, res) => {
  await PushSub.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
}));

router.post('/push/test', wrap(async (req, res) => {
  if (!isReady()) throw bad('Notifications are not set up on the server yet. Add the VAPID keys to the .env file.');
  const s = await getSettings();
  const n = await notifyAdmins({
    title: 'Test notification',
    body: 'Notifications are working on this device.',
    url: '/admin/#/dashboard',
    tag: 'test',
    icon: s.school.logo || undefined,
  });
  res.json({ delivered: n });
}));

module.exports = router;
