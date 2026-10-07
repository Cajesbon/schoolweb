'use strict';
const webpush = require('web-push');
const { PushSub } = require('./models');

let ready = false;

function init() {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    console.warn('[push] VAPID keys missing. Run "npm run vapid" and add them to .env to enable browser notifications.');
    return;
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:' + (process.env.SCHOOL_EMAIL || 'admin@example.com'),
    pub,
    priv
  );
  ready = true;
}

const isReady = () => ready;

// Sends to every device an administrator has enabled notifications on.
async function notifyAdmins(payload) {
  if (!ready) return 0;
  const subs = await PushSub.find().lean();
  const body = JSON.stringify(payload);
  let delivered = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, body, { TTL: 60 * 60 * 24, urgency: 'high' });
        delivered++;
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) await PushSub.deleteOne({ _id: s._id });
        else console.error('[push] send failed:', err.statusCode || err.message);
      }
    })
  );
  return delivered;
}

module.exports = { init, isReady, notifyAdmins };
