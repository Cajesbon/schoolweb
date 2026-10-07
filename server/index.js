'use strict';
require('dotenv').config();
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');

const { Admin } = require('./models');
const { requireAuth } = require('./middleware');
const push = require('./push');

for (const k of ['MONGODB_URI', 'JWT_SECRET']) {
  if (!process.env[k]) {
    console.error(`Missing ${k}. Copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
}
if (process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET must be at least 32 characters long.');
  process.exit(1);
}

const isProd = process.env.NODE_ENV === 'production';
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com'],
        frameSrc: ['https://www.google.com', 'https://maps.google.com'],
        connectSrc: ["'self'"],
        workerSrc: ["'self'"],
        manifestSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: isProd ? [] : null,
      },
    },
  })
);
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/public', require('./routes/public'));
app.use('/api/admin', requireAuth, require('./routes/admin'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

// Admin dashboard (never indexed by search engines)
app.use(
  '/admin',
  (req, res, next) => {
    res.set('X-Robots-Tag', 'noindex, nofollow');
    next();
  },
  express.static(path.join(__dirname, '..', 'admin'), {
    setHeaders: (res, file) => {
      if (/sw\.js$|index\.html$/.test(file)) res.set('Cache-Control', 'no-cache');
    },
  })
);

// Public website
app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'], maxAge: isProd ? '1h' : 0 }));
app.use((req, res) => res.status(404).sendFile(path.join(__dirname, '..', 'public', 'index.html')));

// Errors
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'That image is larger than 10 MB. Please choose a smaller file.' });
  if (err.code === 'LIMIT_FILE_COUNT') return res.status(400).json({ error: 'You can upload up to 20 images at a time.' });
  if (err.name === 'CastError') return res.status(404).json({ error: 'Not found.' });
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Something went wrong on our side. Please try again.' : err.message });
});

async function seedAdmin() {
  if (await Admin.countDocuments()) return;
  const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_USERNAME, ADMIN_NAME } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD || ADMIN_PASSWORD.length < 10) {
    console.warn('No administrator exists. Set ADMIN_EMAIL and ADMIN_PASSWORD (10+ characters) in .env and restart.');
    return;
  }
  await Admin.create({
    email: ADMIN_EMAIL,
    username: ADMIN_USERNAME || undefined,
    name: ADMIN_NAME || 'Administrator',
    passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 12),
  });
  console.log(`Administrator created: ${ADMIN_EMAIL}. You can now remove ADMIN_PASSWORD from .env.`);
}

mongoose
  .connect(process.env.MONGODB_URI)
  .then(async () => {
    await seedAdmin();
    push.init();
    const port = process.env.PORT || 3000;
    app.listen(port, () => console.log(`School website running on port ${port}`));
  })
  .catch((err) => {
    console.error('Could not connect to MongoDB:', err.message);
    process.exit(1);
  });
