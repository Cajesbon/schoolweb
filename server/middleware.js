'use strict';
const jwt = require('jsonwebtoken');
const { Admin } = require('./models');

// Blocks cross-site form posts: the dashboard always sends this header.
function csrfHeader(req, res, next) {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('x-requested-with') !== 'XMLHttpRequest') {
    return res.status(403).json({ error: 'Request blocked.' });
  }
  next();
}

async function requireAuth(req, res, next) {
  try {
    const token = req.cookies && req.cookies.token;
    if (!token) return res.status(401).json({ error: 'Please sign in.' });
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    }
    const admin = await Admin.findById(payload.id);
    if (!admin || admin.tokenVersion !== payload.v) return res.status(401).json({ error: 'Please sign in again.' });
    req.admin = admin;
    csrfHeader(req, res, next);
  } catch (err) {
    next(err);
  }
}

module.exports = { requireAuth, csrfHeader };
