'use strict';
const crypto = require('crypto');
const express = require('express');
const rateLimit = require('express-rate-limit');
const { Announcement, GalleryImage, Application } = require('../models');
const { getSettings, publicView } = require('../settings');
const { sendMail } = require('../mail');
const { notifyAdmins } = require('../push');
const { isObj, isEmail, escapeHtml, bad } = require('../util');

const router = express.Router();

const formLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'You have sent several messages recently. Please try again later, or call or WhatsApp the school.' },
});

router.get('/site', async (req, res, next) => {
  try {
    const [settings, announcements] = await Promise.all([
      getSettings(),
      Announcement.find({ published: true })
        .sort({ important: -1, date: -1 })
        .limit(12)
        .select('title description date image important')
        .lean(),
    ]);
    res.set('Cache-Control', 'public, max-age=30');
    res.json({ settings: publicView(settings), announcements });
  } catch (err) {
    next(err);
  }
});

router.get('/gallery', async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 200, 200);
    const images = await GalleryImage.find({ published: true })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('url title category')
      .lean();
    res.set('Cache-Control', 'public, max-age=30');
    res.json({ images });
  } catch (err) {
    next(err);
  }
});

const makeRef = () => `APP-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

function validateAnswer(f, v, classes) {
  if (f.required && !v) return 'This field is required.';
  if (!v) return null;
  if (f.type === 'email' && !isEmail(v)) return 'Enter a valid email address.';
  if (f.type === 'tel' && !/^[+\d][\d\s().-]{5,24}$/.test(v)) return 'Enter a valid phone number.';
  if (f.type === 'date' && Number.isNaN(Date.parse(v))) return 'Enter a valid date.';
  if (f.type === 'number' && Number.isNaN(Number(v))) return 'Enter a number.';
  if (f.type === 'select' && !f.options.includes(v)) return 'Choose one of the options.';
  if (f.type === 'class' && !classes.includes(v)) return 'Choose one of the available classes.';
  return null;
}

const rowsHtml = (rows) =>
  rows
    .map(
      (r) =>
        `<tr><td style="padding:8px 14px 8px 0;color:#555;vertical-align:top;white-space:nowrap">${escapeHtml(r.label)}</td>` +
        `<td style="padding:8px 0;color:#111">${escapeHtml(r.value || '-').replace(/\n/g, '<br>')}</td></tr>`
    )
    .join('');

router.post('/admissions', formLimiter, async (req, res, next) => {
  try {
    const s = await getSettings();
    const a = s.admissions;
    if (req.body.hp) return res.json({ ok: true, message: a.successMessage }); // bots fill the hidden field
    if (!a.enabled) throw bad(a.closedMessage, 403);

    const input = isObj(req.body.answers) ? req.body.answers : {};
    const answers = [];
    const fieldErrors = {};
    for (const f of a.fields) {
      const v = input[f.key] == null ? '' : String(input[f.key]).trim().slice(0, 2000);
      const err = validateAnswer(f, v, a.classes);
      if (err) fieldErrors[f.key] = err;
      answers.push({ key: f.key, label: f.label, value: v });
    }
    if (Object.keys(fieldErrors).length) {
      return res.status(422).json({ error: 'Please check the highlighted fields.', fields: fieldErrors });
    }

    const classField = a.fields.find((f) => f.type === 'class');
    const classValue = classField ? answers.find((x) => x.key === classField.key).value : '';
    const doc = await Application.create({
      ref: makeRef(),
      applicant: answers[0] ? answers[0].value : '',
      classApplied: classValue,
      answers,
      searchText: answers.map((x) => x.value).join(' ').toLowerCase(),
    });

    res.json({ ok: true, message: a.successMessage, ref: doc.ref });

    // Everything below happens after the parent has their confirmation.
    const base = process.env.SITE_URL || '';
    const emailAnswer = answers.find((x) => isEmail(x.value));
    const to = s.contact.recipientEmail || s.contact.email || process.env.SCHOOL_EMAIL;
    sendMail({
      to,
      replyTo: emailAnswer ? emailAnswer.value : undefined,
      subject: `New admission application ${doc.ref}${doc.applicant ? ' – ' + doc.applicant : ''}`,
      text:
        `A new admission application was submitted on ${s.school.name}'s website.\n\nReference: ${doc.ref}\n\n` +
        answers.map((x) => `${x.label}: ${x.value || '-'}`).join('\n') +
        (base ? `\n\nView it in the dashboard: ${base}/admin/#/admissions/app/${doc._id}` : ''),
      html:
        `<div style="font-family:Arial,sans-serif;max-width:640px"><h2 style="margin:0 0 4px;color:#0B2545">New admission application</h2>` +
        `<p style="margin:0 0 16px;color:#555">Reference <strong>${escapeHtml(doc.ref)}</strong></p>` +
        `<table style="border-collapse:collapse;font-size:15px">${rowsHtml(answers)}</table>` +
        (base ? `<p style="margin-top:20px"><a href="${escapeHtml(base)}/admin/#/admissions/app/${doc._id}">Open in the admin dashboard</a></p>` : '') +
        `</div>`,
    })
      .then((status) => Application.updateOne({ _id: doc._id }, { emailStatus: status }))
      .catch((e) => console.error('[mail] status update failed', e.message));

    notifyAdmins({
      title: 'New admission application',
      body: `${doc.applicant || 'A new applicant'}${classValue ? ' – ' + classValue : ''}`,
      url: `/admin/#/admissions/app/${doc._id}`,
      tag: `application-${doc._id}`,
      icon: s.school.logo || undefined,
    }).catch((e) => console.error('[push] notify failed', e.message));
  } catch (err) {
    next(err);
  }
});

router.post('/contact', formLimiter, async (req, res, next) => {
  try {
    if (req.body.hp) return res.json({ ok: true });
    const s = await getSettings();
    const name = String(req.body.name || '').trim().slice(0, 120);
    const email = String(req.body.email || '').trim().slice(0, 160);
    const phone = String(req.body.phone || '').trim().slice(0, 40);
    const message = String(req.body.message || '').trim().slice(0, 4000);
    if (!name) throw bad('Please enter your name.');
    if (!isEmail(email)) throw bad('Please enter a valid email address.');
    if (message.length < 5) throw bad('Please write a short message.');

    const to = s.contact.recipientEmail || s.contact.email || process.env.SCHOOL_EMAIL;
    const status = await sendMail({
      to,
      replyTo: email,
      subject: `Website message from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\nPhone: ${phone || '-'}\n\n${message}`,
      html:
        `<div style="font-family:Arial,sans-serif;max-width:640px"><h2 style="margin:0 0 12px;color:#0B2545">New website message</h2>` +
        `<table style="border-collapse:collapse;font-size:15px">${rowsHtml([
          { label: 'Name', value: name },
          { label: 'Email', value: email },
          { label: 'Phone', value: phone },
          { label: 'Message', value: message },
        ])}</table></div>`,
    });
    if (status !== 'sent') {
      throw bad('Your message could not be sent right now. Please call or WhatsApp the school instead.', 503);
    }
    res.json({ ok: true, message: 'Thank you. Your message has been sent and we will reply soon.' });
    notifyAdmins({
      title: 'New website message',
      body: `${name}: ${message.slice(0, 90)}`,
      url: '/admin/#/dashboard',
      tag: `message-${Date.now()}`,
      icon: s.school.logo || undefined,
    }).catch(() => {});
  } catch (err) {
    next(err);
  }
});

module.exports = router;
