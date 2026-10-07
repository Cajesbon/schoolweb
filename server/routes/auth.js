'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { Admin } = require('../models');
const { requireAuth, csrfHeader } = require('../middleware');
const { bad } = require('../util');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Please wait 15 minutes and try again.' },
});

const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
});

function issueCookie(res, admin) {
  const token = jwt.sign({ id: admin._id, v: admin.tokenVersion }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.cookie('token', token, cookieOptions());
}

const profile = (a) => ({ id: a._id, email: a.email, name: a.name });

router.post('/login', csrfHeader, loginLimiter, async (req, res, next) => {
  try {
    const id = String(req.body.login || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!id || !password) throw bad('Enter your email or username and your password.');
    const admin = await Admin.findOne({ $or: [{ email: id }, { username: id }] });
    const ok = await bcrypt.compare(password, admin ? admin.passwordHash : DUMMY_HASH);
    if (!admin || !ok) throw bad('Those details do not match an administrator account.', 401);
    issueCookie(res, admin);
    res.json({ admin: profile(admin) });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', csrfHeader, (req, res) => {
  res.clearCookie('token', { ...cookieOptions(), maxAge: undefined });
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => res.json({ admin: profile(req.admin) }));

router.post('/password', requireAuth, async (req, res, next) => {
  try {
    const current = String(req.body.current || '');
    const next_ = String(req.body.next || '');
    if (!(await bcrypt.compare(current, req.admin.passwordHash))) throw bad('Your current password is not correct.');
    if (next_.length < 10) throw bad('Use at least 10 characters for the new password.');
    if (next_ === current) throw bad('Choose a password different from the current one.');
    req.admin.passwordHash = await bcrypt.hash(next_, 12);
    req.admin.tokenVersion += 1; // signs out every other session
    await req.admin.save();
    issueCookie(res, req.admin);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
