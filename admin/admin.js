/* Admin dashboard (vanilla JS single-page app). Talks to /api/auth and /api/admin. */
(function () {
  'use strict';
  const { esc, Icons, Theme } = window;
  const ic = (n, s) => Icons.svg(n, s || 18);
  const $ = (s, r) => (r || document).querySelector(s);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const app = document.getElementById('app');

  /* ---------- tiny DOM helper ---------- */
  function h(tag, attrs) {
    const n = document.createElement(tag);
    let value;
    const a = attrs || {};
    for (const k in a) {
      const v = a[k];
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'value') value = v;
      else if (k === 'checked') n.checked = !!v;
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const c of Array.prototype.slice.call(arguments, 2).flat(Infinity)) {
      if (c == null || c === false) continue;
      n.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
    if (value !== undefined) n.value = value;
    return n;
  }
  const raw = (html) => h('span', { html });

  function toast(msg, type) {
    const t = h('div', { class: 'toast ' + (type || ''), role: 'status' }, msg);
    $('#toasts').append(t);
    setTimeout(() => t.remove(), type === 'error' ? 6000 : 3500);
  }

  async function api(method, url, body) {
    const opt = { method, headers: { 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'same-origin' };
    if (body instanceof FormData) opt.body = body;
    else if (body !== undefined) {
      opt.headers['Content-Type'] = 'application/json';
      opt.body = JSON.stringify(body);
    }
    const r = await fetch(url, opt);
    let data = null;
    try { data = await r.json(); } catch (e) { /* not json */ }
    if (r.status === 401 && url.indexOf('/auth/login') === -1) {
      showLogin();
      throw new Error((data && data.error) || 'Please sign in.');
    }
    if (!r.ok) {
      const err = new Error((data && data.error) || 'Something went wrong. Please try again.');
      err.status = r.status;
      throw err;
    }
    return data;
  }

  function modal(title, body, opts) {
    opts = opts || {};
    const back = h('div', { class: 'modal-back' });
    const close = () => { back.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const box = h('div', { class: 'modal' + (opts.wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('div', { class: 'modal-head' }, h('h2', {}, title), h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close', onclick: close }, raw(ic('x')))),
      body, opts.foot || null);
    back.append(box);
    back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
    document.addEventListener('keydown', onKey);
    document.body.append(back);
    return { close, el: box };
  }

  function confirmBox(message, okLabel, danger) {
    return new Promise((resolve) => {
      let m;
      const done = (v) => { m.close(); resolve(v); };
      const foot = h('div', { class: 'modal-foot' },
        h('button', { class: 'btn', type: 'button', onclick: () => done(false) }, 'Cancel'),
        h('button', { class: 'btn ' + (danger === false ? 'btn-primary' : 'btn-danger'), type: 'button', onclick: () => done(true) }, okLabel || 'Delete'));
      m = modal('Please confirm', h('div', { class: 'modal-body' }, h('p', { style: 'margin:0' }, message)), { foot });
    });
  }

  const thumbUrl = (u, w) =>
    u && u.indexOf('res.cloudinary.com') > -1 && u.indexOf('/upload/') > -1 ? u.replace('/upload/', '/upload/f_auto,q_auto,c_fill,w_' + (w || 320) + ',h_' + Math.round((w || 320) * 0.75) + '/') : u;

  const fmtDate = (d, withTime) => new Date(d).toLocaleString('en-GB', withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' });

  /* ---------- state ---------- */
  let me = null;
  let settings = null;
  let draft = null;
  let dirty = false;

  const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  const setPath = (o, p, v) => {
    const ks = p.split('.');
    const last = ks.pop();
    ks.reduce((a, k) => a[k], o)[last] = v;
  };

  function markDirty() {
    dirty = true;
    const n = $('.dirty-note');
    if (n) n.classList.remove('hidden');
  }

  /* ---------- Browser notifications (Web Push) ---------- */
  const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = () => window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;

  async function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    try { await navigator.serviceWorker.register('/admin/sw.js', { scope: '/admin/' }); } catch (e) { console.warn('Service worker failed', e); }
  }
  const b64ToU8 = (b64) => {
    const s = (b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
    return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  };
  async function thisSub() {
    if (!pushSupported()) return null;
    const reg = await navigator.serviceWorker.ready;
    return reg.pushManager.getSubscription();
  }
  async function subscribeThisDevice() {
    const { publicKey, enabled } = await api('GET', '/api/admin/push/key');
    if (!enabled || !publicKey) throw new Error('Notifications are not set up on the server yet. Ask your developer to add the VAPID keys to the .env file.');
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      try {
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(publicKey) });
      } catch (e) {
        if (e && e.name === 'InvalidStateError') {
          const old = await reg.pushManager.getSubscription();
          if (old) await old.unsubscribe();
          sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(publicKey) });
        } else throw e;
      }
    }
    await api('POST', '/api/admin/push/subscribe', { subscription: sub.toJSON() });
  }
  async function enablePush() {
    if (!pushSupported()) throw new Error('This browser does not support notifications.');
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') throw new Error('Notifications are blocked for this site. Allow them in your browser’s site settings, then try again.');
    await subscribeThisDevice();
  }
  async function disablePush() {
    const sub = await thisSub();
    if (sub) {
      try { await api('POST', '/api/admin/push/unsubscribe', { endpoint: sub.endpoint }); } catch (e) { /* ignore */ }
      await sub.unsubscribe();
    }
  }
  // Keeps this device registered every time the dashboard opens, once permission was granted.
  async function syncPush() {
    if (!pushSupported() || Notification.permission !== 'granted') return;
    try { await subscribeThisDevice(); } catch (e) { console.warn('Push sync:', e.message); }
  }
  async function pushState() {
    if (!pushSupported()) return { supported: false, needsInstall: isIOS() && !isStandalone(), permission: 'unsupported', subscribed: false };
    let subscribed = false;
    try { subscribed = !!(await thisSub()); } catch (e) { /* ignore */ }
    return { supported: true, needsInstall: false, permission: Notification.permission, subscribed };
  }

  /* ---------- Field engine ---------- */
  const wrapField = (f, input) => h('label', { class: 'field' }, h('span', { class: 'lbl' }, f.label), input, f.hint ? h('span', { class: 'hint' }, f.hint) : null);

  function fieldEl(f, get, set, silent) {
    const change = (v) => { set(v); if (!silent) markDirty(); };
    switch (f.type) {
      case 'toggle':
        return h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked: !!get(), onchange: (e) => change(e.target.checked) }), h('span', { class: 'track' }), h('span', {}, f.label));
      case 'textarea':
        return wrapField(f, h('textarea', { rows: f.rows || 4, value: get() == null ? '' : get(), oninput: (e) => change(e.target.value) }));
      case 'lines':
        return wrapField(f, h('textarea', { rows: f.rows || 5, value: (get() || []).join('\n'), oninput: (e) => change(e.target.value.split('\n').map((s) => s.trim()).filter(Boolean)) }));
      case 'select':
        return wrapField(f, h('select', { value: get() == null ? '' : get(), onchange: (e) => change(e.target.value) },
          f.options.map((o) => (Array.isArray(o) ? h('option', { value: o[0] }, o[1]) : h('option', { value: o }, o)))));
      case 'image':
        return imageField(f, get, change);
      case 'list':
        return listField(f, get, set, silent);
      default: {
        const type = { email: 'email', tel: 'tel', url: 'url', date: 'date', number: 'number' }[f.type] || 'text';
        return wrapField(f, h('input', { type, value: get() == null ? '' : get(), placeholder: f.placeholder, maxlength: f.max, oninput: (e) => change(e.target.value) }));
      }
    }
  }

  function imageField(f, get, change) {
    const wrap = h('div', { class: 'field' });
    const render = () => {
      const url = get();
      wrap.replaceChildren(
        h('span', { class: 'lbl' }, f.label),
        h('div', { class: 'imgfield' },
          h('div', { class: 'thumb' }, url ? h('img', { src: thumbUrl(url, 240), alt: '' }) : raw(ic('image', 28))),
          h('div', { class: 'row' },
            h('button', { type: 'button', class: 'btn btn-sm', onclick: () => pickImage((u) => { change(u); render(); }) }, url ? 'Change image' : 'Choose image'),
            url ? h('button', { type: 'button', class: 'btn btn-sm btn-ghost', onclick: () => { change(''); render(); } }, 'Remove') : null)),
        f.hint ? h('span', { class: 'hint' }, f.hint) : null);
    };
    render();
    return wrap;
  }

  function blankItem(f) {
    const o = {};
    f.fields.forEach((sf) => {
      if (sf.type === 'toggle') o[sf.key] = false;
      else if (sf.type === 'lines') o[sf.key] = [];
      else if (sf.type === 'select') o[sf.key] = Array.isArray(sf.options[0]) ? sf.options[0][0] : sf.options[0];
      else o[sf.key] = '';
    });
    return Object.assign(o, f.newItem || {});
  }

  function listField(f, get, set, silent) {
    const wrap = h('div', { class: 'field' });
    const render = () => {
      let arr = get();
      if (!Array.isArray(arr)) { arr = []; set(arr); }
      const list = h('div', { class: 'list' });
      const touch = () => { if (!silent) markDirty(); };
      arr.forEach((item, i) => {
        const title = (f.titleKey && item[f.titleKey]) || (f.itemName || 'Item') + ' ' + (i + 1);
        const body = h('div', { class: 'item-body' }, f.fields.filter((sf) => !sf.showIf || sf.showIf(item)).map((sf) =>
          fieldEl(sf, () => item[sf.key], (v) => { item[sf.key] = v; if (sf.rerender) render(); }, silent)));
        list.append(h('div', { class: 'item' },
          h('div', { class: 'item-head' }, h('b', {}, title),
            h('button', { type: 'button', class: 'icon-btn', title: 'Move up', 'aria-label': 'Move up', disabled: i === 0, onclick: () => { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; touch(); render(); } }, raw(ic('up'))),
            h('button', { type: 'button', class: 'icon-btn', title: 'Move down', 'aria-label': 'Move down', disabled: i === arr.length - 1, onclick: () => { [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; touch(); render(); } }, raw(ic('down'))),
            h('button', { type: 'button', class: 'icon-btn danger', title: 'Remove', 'aria-label': 'Remove', onclick: () => { arr.splice(i, 1); touch(); render(); } }, raw(ic('trash')))),
          body));
      });
      wrap.replaceChildren(
        h('span', { class: 'lbl' }, f.label),
        f.hint ? h('span', { class: 'hint' }, f.hint) : null,
        list,
        h('div', null, h('button', { type: 'button', class: 'btn btn-sm', onclick: () => { arr.push(blankItem(f)); touch(); render(); } }, raw(ic('plus', 16)), f.addLabel || 'Add item')));
    };
    render();
    return wrap;
  }

  /* ---------- Image picker (centralised media library) ---------- */
  async function pickImage(onPick) {
    const grid = h('div', { class: 'picker' });
    const status = h('p', { class: 'hint', style: 'margin:0' });
    const file = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/gif,image/avif', class: 'hidden' });
    const body = h('div', { class: 'modal-body' },
      h('div', { class: 'row' }, h('button', { class: 'btn btn-primary', type: 'button', onclick: () => file.click() }, raw(ic('upload')), 'Upload new image'), status),
      file,
      h('div', null, h('h3', { style: 'font-size:1rem;margin-bottom:10px' }, 'Or choose an image you already uploaded'), grid));
    const m = modal('Choose an image', body, { wide: true });
    file.addEventListener('change', async () => {
      if (!file.files[0]) return;
      status.className = 'hint';
      status.textContent = 'Uploading…';
      try {
        const fd = new FormData();
        fd.append('file', file.files[0]);
        const r = await api('POST', '/api/admin/media', fd);
        m.close();
        onPick(r.item.url);
      } catch (e) { status.className = 'err-text'; status.textContent = e.message; }
    });
    try {
      const data = await api('GET', '/api/admin/media');
      const urls = [...new Set(data.items.map((x) => x.url).concat(data.gallery.map((x) => x.url)))];
      if (!urls.length) grid.replaceWith(h('p', { class: 'muted', style: 'margin:0' }, 'No images yet. Upload your first one above.'));
      urls.forEach((u) => grid.append(h('button', { type: 'button', 'aria-label': 'Use this image', onclick: () => { m.close(); onPick(u); } }, h('img', { src: thumbUrl(u, 240), alt: '', loading: 'lazy' }))));
    } catch (e) { status.className = 'err-text'; status.textContent = e.message; }
  }

  /* ---------- Settings page builder ---------- */
  const T = (path, label, o) => Object.assign({ type: 'text', path, label }, o);
  const TA = (path, label, o) => Object.assign({ type: 'textarea', path, label }, o);
  const IMG = (path, label, o) => Object.assign({ type: 'image', path, label }, o);
  const TG = (path, label) => ({ type: 'toggle', path, label });
  const LN = (path, label, o) => Object.assign({ type: 'lines', path, label }, o);
  const LIST = (path, label, fields, o) => Object.assign({ type: 'list', path, label, fields }, o);
  const sf = (key, label, type, o) => Object.assign({ key, label, type: type || 'text' }, o);
  const ICONS = ['book', 'shield', 'users', 'star', 'heart', 'globe', 'laptop', 'sun', 'leaf', 'trophy', 'bus', 'flask', 'palette', 'music', 'activity', 'utensils', 'cross', 'building', 'pencil', 'calculator'];
  const iconField = sf('icon', 'Icon', 'select', { options: ICONS });

  function groupsEl(groups) {
    return h('div', null, groups.map((g, i) =>
      h('details', { class: 'card', open: i === 0 }, h('summary', {}, g.title),
        h('div', { class: 'card-body' }, g.hint ? h('p', { class: 'hint', style: 'margin:0' }, g.hint) : null,
          g.fields.map((f) => fieldEl(f, () => getPath(draft, f.path), (v) => setPath(draft, f.path, v)))))));
  }

  async function rerender() {
    const y = window.scrollY;
    await route(true);
    window.scrollTo(0, y);
  }

  async function saveSections(names, btn) {
    btn.disabled = true;
    const label = btn.textContent;
    btn.textContent = 'Saving…';
    try {
      for (const s of names) {
        const r = await api('PUT', '/api/admin/settings/' + s, { value: draft[s] });
        settings[s] = r.value;
      }
      dirty = false;
      toast('Saved. The website is updated.', 'ok');
      await rerender();
    } catch (e) {
      toast(e.message, 'error');
      btn.disabled = false;
      btn.textContent = label;
    }
  }

  function settingsPage(root, groups, top) {
    draft = clone(settings);
    dirty = false;
    const sections = [...new Set(groups.flatMap((g) => g.fields).map((f) => f.path.split('.')[0]))];
    const save = h('button', { class: 'btn btn-primary', type: 'button', onclick: () => saveSections(sections, save) }, 'Save changes');
    root.append(top || '', groupsEl(groups), h('div', { class: 'savebar' }, save, h('span', { class: 'dirty-note hidden' }, 'You have unsaved changes')));
  }

  const tabsEl = (items, active) => h('nav', { class: 'tabs', 'aria-label': 'Sections' }, items.map(([k, label]) => h('a', { class: 'tab', href: '#/admissions' + (k ? '/' + k : ''), 'aria-current': k === active ? 'page' : null }, label)));

  /* ---------- Page schemas ---------- */
  const SCHEMA = {
    school: [
      { title: 'School identity', fields: [
        T('school.name', 'School name', { hint: 'Appears in the header, footer, page titles and emails. Change it here and it updates everywhere.' }),
        T('school.tagline', 'Tagline'),
        TA('school.description', 'School description', { hint: 'Used in search results and when the site is shared.' }),
        IMG('school.logo', 'School logo', { hint: 'A PNG with a transparent background works best.' }),
        IMG('school.favicon', 'Website favicon', { hint: 'A small square image shown in the browser tab.' }),
        T('school.websiteTitle', 'Website title (home page)', { hint: 'The title shown in the browser tab and in Google.' }),
        T('school.principalName', 'Principal or Headteacher name'),
        T('school.principalTitle', 'Principal title', { hint: 'For example: Headteacher, Principal.' }),
      ] },
      { title: 'Contact basics', hint: 'These are the same details as in Contact Information.', fields: [
        TA('contact.address', 'School address', { rows: 3 }),
        T('contact.phone', 'Phone number', { type: 'tel' }),
        T('contact.email', 'Email address', { type: 'email' }),
        TA('contact.openingHours', 'Opening hours', { rows: 3, hint: 'One line per entry.' }),
      ] },
    ],
    homepage: [
      { title: 'Hero (top of the page)', fields: [
        IMG('home.hero.image', 'Hero image', { hint: 'A wide photo, at least 1600 px across. A colour overlay keeps the text readable.' }),
        T('home.hero.headline', 'Headline'),
        TA('home.hero.description', 'Description'),
        T('home.hero.ctaText', 'Main button text'),
        T('home.hero.ctaLink', 'Main button link', { hint: 'A page such as /admissions#apply, or a full web address.' }),
        T('home.hero.secondaryCtaText', 'Second button text'),
        T('home.hero.secondaryCtaLink', 'Second button link'),
      ] },
      { title: 'Announcements section', hint: 'Add and publish announcements under Announcements.', fields: [TG('home.announcements.enabled', 'Show this section'), T('home.announcements.title', 'Section title')] },
      { title: 'Welcome message', fields: [TG('home.welcome.enabled', 'Show this section'), T('home.welcome.title', 'Title'), TA('home.welcome.message', 'Message', { rows: 6, hint: 'Leave a blank line between paragraphs.' }), IMG('home.welcome.image', 'Image')] },
      { title: 'Why choose us', fields: [TG('home.whyChooseUs.enabled', 'Show this section'), T('home.whyChooseUs.title', 'Title'), T('home.whyChooseUs.subtitle', 'Subtitle'),
        LIST('home.whyChooseUs.items', 'Reasons', [sf('title', 'Title'), sf('text', 'Description', 'textarea', { rows: 3 }), iconField], { titleKey: 'title', addLabel: 'Add a reason', newItem: { icon: 'star' } })] },
      { title: 'Academic programmes', fields: [TG('home.programmes.enabled', 'Show this section'), T('home.programmes.title', 'Title'), T('home.programmes.subtitle', 'Subtitle'),
        LIST('home.programmes.items', 'Programmes', [sf('title', 'Title'), sf('text', 'Description', 'textarea', { rows: 3 }), sf('image', 'Image', 'image')], { titleKey: 'title', addLabel: 'Add a programme' })] },
      { title: 'Facilities preview', fields: [TG('home.facilities.enabled', 'Show this section'), T('home.facilities.title', 'Title'), T('home.facilities.subtitle', 'Subtitle'),
        LIST('home.facilities.items', 'Facilities', [sf('title', 'Title'), sf('text', 'Description', 'textarea', { rows: 3 }), sf('image', 'Image', 'image')], { titleKey: 'title', addLabel: 'Add a facility' })] },
      { title: 'Extracurricular activities', fields: [TG('home.activities.enabled', 'Show this section'), T('home.activities.title', 'Title'), T('home.activities.subtitle', 'Subtitle'),
        LIST('home.activities.items', 'Activities', [sf('title', 'Title'), sf('text', 'Description', 'textarea', { rows: 2 })], { titleKey: 'title', addLabel: 'Add an activity' })] },
      { title: 'School values', fields: [TG('home.values.enabled', 'Show this section'), T('home.values.title', 'Title'),
        LIST('home.values.items', 'Values', [sf('title', 'Title'), sf('text', 'Description', 'textarea', { rows: 2 })], { titleKey: 'title', addLabel: 'Add a value' })] },
      { title: 'Gallery preview', hint: 'Photos come from the Gallery page automatically.', fields: [TG('home.gallery.enabled', 'Show this section'), T('home.gallery.title', 'Title'), T('home.gallery.subtitle', 'Subtitle')] },
      { title: 'Parent testimonials', fields: [TG('home.testimonials.enabled', 'Show this section'), T('home.testimonials.title', 'Title'),
        LIST('home.testimonials.items', 'Testimonials', [sf('name', 'Parent name'), sf('role', 'Description (for example: Parent of a Primary 3 pupil)'), sf('quote', 'Quote', 'textarea', { rows: 3 })], { titleKey: 'name', addLabel: 'Add a testimonial' })] },
      { title: 'Admission call to action', fields: [TG('home.admissionCta.enabled', 'Show this section'), T('home.admissionCta.title', 'Title'), TA('home.admissionCta.text', 'Text'), T('home.admissionCta.buttonText', 'Button text')] },
      { title: 'Contact call to action', fields: [TG('home.contactCta.enabled', 'Show this section'), T('home.contactCta.title', 'Title'), TA('home.contactCta.text', 'Text'), T('home.contactCta.buttonText', 'Button text')] },
    ],
    about: [
      { title: 'Page banner and introduction', fields: [IMG('about.bannerImage', 'Banner image (optional)'), T('about.intro.title', 'Title'), TA('about.intro.text', 'Text', { rows: 6 }), IMG('about.intro.image', 'Image')] },
      { title: 'School at a glance', fields: [T('about.overview.title', 'Title'), LIST('about.overview.stats', 'Figures', [sf('value', 'Figure (for example 25+)'), sf('label', 'Label')], { titleKey: 'label', addLabel: 'Add a figure' })] },
      { title: 'School history', fields: [T('about.history.title', 'Title'), TA('about.history.text', 'Text', { rows: 6 }), IMG('about.history.image', 'Image')] },
      { title: 'Mission and vision', fields: [T('about.mission.title', 'Mission title'), TA('about.mission.text', 'Mission'), T('about.vision.title', 'Vision title'), TA('about.vision.text', 'Vision')] },
      { title: 'Core values', fields: [T('about.values.title', 'Title'), LIST('about.values.items', 'Values', [sf('title', 'Title'), sf('text', 'Description', 'textarea', { rows: 2 })], { titleKey: 'title', addLabel: 'Add a value' })] },
      { title: 'Message from the Principal or Headteacher', hint: 'The name and title come from School Information.', fields: [T('about.principal.title', 'Title'), TA('about.principal.message', 'Message', { rows: 8 }), IMG('about.principal.image', 'Photo')] },
      { title: 'Teaching philosophy', fields: [T('about.philosophy.title', 'Title'), TA('about.philosophy.text', 'Text', { rows: 6 }), IMG('about.philosophy.image', 'Image')] },
    ],
    academics: [
      { title: 'Page banner and introduction', fields: [IMG('academics.bannerImage', 'Banner image (optional)'), T('academics.intro.title', 'Title'), TA('academics.intro.text', 'Text')] },
      { title: 'Early Years, Nursery and Primary', fields: [LIST('academics.levels', 'Levels', [sf('title', 'Name'), sf('ages', 'Age range'), sf('text', 'Description', 'textarea', { rows: 4 }), sf('image', 'Image', 'image')], { titleKey: 'title', addLabel: 'Add a level' })] },
      { title: 'Subjects and development areas', fields: [T('academics.subjects.title', 'Title'), T('academics.subjects.intro', 'Introduction'),
        LIST('academics.subjects.items', 'Subjects', [sf('title', 'Title'), sf('text', 'Description', 'textarea', { rows: 2 }), iconField], { titleKey: 'title', addLabel: 'Add a subject', newItem: { icon: 'book' } })] },
    ],
    facilities: [
      { title: 'Page banner and introduction', fields: [IMG('facilities.bannerImage', 'Banner image (optional)'), T('facilities.intro.title', 'Title'), TA('facilities.intro.text', 'Text')] },
      { title: 'Facilities', fields: [LIST('facilities.items', 'Facilities', [sf('title', 'Name'), sf('text', 'Description', 'textarea', { rows: 3 }), sf('image', 'Image', 'image'), sf('icon', 'Icon (shown when there is no image)', 'select', { options: ICONS })], { titleKey: 'title', addLabel: 'Add a facility', newItem: { icon: 'building' } })] },
    ],
    contact: [
      { title: 'Contact details', hint: 'Changes show on the Contact page, the footer and the home page straight away.', fields: [
        TA('contact.address', 'Physical address', { rows: 3 }),
        T('contact.phone', 'School phone number', { type: 'tel' }),
        T('contact.email', 'Email address', { type: 'email' }),
        T('contact.emergencyContact', 'Emergency contact number', { type: 'tel' }),
        TA('contact.openingHours', 'Opening hours', { rows: 3 }),
      ] },
      { title: 'Google Maps', fields: [T('contact.mapQuery', 'Map location', { hint: 'Type the address, or paste the link from Google Maps → Share → Embed a map. Leave empty to hide the map.' })] },
      { title: 'Form submissions', fields: [T('contact.recipientEmail', 'Email that receives admission applications and contact messages', { type: 'email', hint: 'If empty, the school email above is used.' })] },
      { title: 'Page text', fields: [IMG('contact.bannerImage', 'Banner image (optional)'), TA('contact.intro', 'Introduction')] },
    ],
    whatsapp: [
      { title: 'WhatsApp number', fields: [
        TG('whatsapp.enabled', 'Show WhatsApp buttons on the website'),
        T('whatsapp.number', 'WhatsApp number', { type: 'tel', hint: 'Include the country code, no plus sign or spaces. Example: 2348012345678. Every WhatsApp button on the site uses this number.' }),
        TA('whatsapp.defaultMessage', 'Default message', { rows: 2, hint: 'Used wherever a section has no message of its own.' }),
      ] },
      { title: 'Messages for each section', hint: 'Leave a box empty to use the default message.', fields: [
        TA('whatsapp.messages.header', 'Header button', { rows: 2 }), TA('whatsapp.messages.hero', 'Hero (top of home page)', { rows: 2 }),
        TA('whatsapp.messages.admission', 'Admissions', { rows: 2 }), TA('whatsapp.messages.visit', 'School visit', { rows: 2 }),
        TA('whatsapp.messages.contact', 'Contact page', { rows: 2 }), TA('whatsapp.messages.footer', 'Footer', { rows: 2 }), TA('whatsapp.messages.floating', 'Floating button', { rows: 2 }),
      ] },
      { title: 'Where buttons appear', fields: [
        TG('whatsapp.placements.header', 'Header'), TG('whatsapp.placements.hero', 'Hero section'), TG('whatsapp.placements.admission', 'Admission section'),
        TG('whatsapp.placements.contact', 'Contact section'), TG('whatsapp.placements.footer', 'Footer'), TG('whatsapp.placements.floating', 'Floating button'),
      ] },
    ],
    social: [
      { title: 'Social media accounts', hint: 'Paste the full web address of each page. Icons only appear for accounts you fill in.', fields: [
        T('social.facebook', 'Facebook', { type: 'url', placeholder: 'https://facebook.com/yourschool' }), T('social.instagram', 'Instagram', { type: 'url', placeholder: 'https://instagram.com/yourschool' }),
        T('social.tiktok', 'TikTok', { type: 'url' }), T('social.youtube', 'YouTube', { type: 'url' }), T('social.linkedin', 'LinkedIn', { type: 'url' }), T('social.twitter', 'X (Twitter)', { type: 'url' }),
      ] },
    ],
  };

  const TYPE_OPTIONS = [['text', 'Short text'], ['textarea', 'Long text'], ['email', 'Email'], ['tel', 'Phone number'], ['date', 'Date'], ['number', 'Number'], ['select', 'Dropdown list'], ['class', 'Class (from available classes)']];

  /* ---------- Pages ---------- */
  async function dashboardPage(root) {
    const s = await api('GET', '/api/admin/stats');
    const ps = await pushState();
    if (ps.needsInstall) {
      root.append(h('div', { class: 'banner info' }, h('div', null, h('b', null, 'Get notifications on this iPhone or iPad'), h('div', { class: 'muted' }, 'Tap Share, choose “Add to Home Screen”, then open the dashboard from your Home Screen and turn notifications on.'))));
    } else if (ps.supported && s.pushReady && !(ps.permission === 'granted' && ps.subscribed)) {
      const b = h('button', { class: 'btn btn-primary', type: 'button', onclick: async () => { b.disabled = true; try { await enablePush(); toast('Notifications are on for this device.', 'ok'); await rerender(); } catch (e) { toast(e.message, 'error'); b.disabled = false; } } }, raw(ic('bell')), 'Turn on notifications');
      root.append(h('div', { class: 'banner' }, h('div', null, h('b', null, 'Get alerted when someone applies'), h('div', { class: 'muted' }, 'Turn on notifications to see new applications on this device, even when this page is closed.')), b));
    } else if (!s.pushReady) {
      root.append(h('div', { class: 'banner info' }, h('div', null, h('b', null, 'Browser notifications are not set up yet'), h('div', { class: 'muted' }, 'Add the VAPID keys to the server’s .env file to switch them on.'))));
    }

    const card = (k, v, sub, sm) => h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' + (sm ? ' sm' : '') }, v), sub ? h('div', { class: 's' }, sub) : null);
    root.append(h('div', { class: 'stats' },
      card('Gallery images', String(s.galleryCount)),
      card('Admission applications', String(s.applications.total), s.applications.unread ? s.applications.unread + ' new' : 'No new applications'),
      card('Published announcements', String(s.announcementsPublished)),
      card('Website status', 'Online', s.admissionsOpen ? 'Admissions are open' : 'Admissions are closed', true),
      card('WhatsApp number', s.whatsappNumber ? '+' + s.whatsappNumber : 'Not set yet', null, true),
      card('Last website update', s.lastUpdate ? fmtDate(s.lastUpdate, true) : 'No changes yet', null, true)));

    const recent = h('div', { class: 'card' }, h('div', { class: 'row between card-pad', style: 'padding-bottom:12px' }, h('h2', { style: 'font-size:1.05rem' }, 'Recent applications'), h('a', { class: 'btn btn-sm', href: '#/admissions' }, 'View all')),
      s.recent.length ? h('div', { class: 'rows' }, s.recent.map((a) => h('a', { class: 'rowitem' + (a.read ? '' : ' unread'), href: '#/admissions/app/' + a._id },
        h('div', null, h('div', { class: 't' }, a.applicant || 'Applicant'), h('div', { class: 'm' }, [a.classApplied, fmtDate(a.createdAt, true)].filter(Boolean).join(' · '))), a.read ? null : h('span', { class: 'pill gold' }, 'New'))))
        : h('div', { class: 'empty' }, 'No applications yet. They will appear here as soon as parents submit the form.'));

    const c = s.checklist;
    const item = (ok, text, href) => h('li', null, h('span', { class: 'dot' + (ok ? ' done' : '') }, ok ? raw(ic('check', 12)) : null), href && !ok ? h('a', { href }, text) : h('span', null, text));
    const setup = h('div', { class: 'card card-pad' }, h('h2', { style: 'font-size:1.05rem;margin-bottom:12px' }, 'Setup checklist'),
      h('ul', { class: 'checklist' },
        item(c.logo, 'Upload your school logo', '#/school'), item(c.heroImage, 'Add a hero image on the homepage', '#/homepage'),
        item(c.address, 'Enter your school address', '#/contact'), item(c.phone, 'Add the school phone number', '#/contact'),
        item(c.email, 'Add the school email address', '#/contact'), item(c.recipient, 'Choose where applications are emailed', '#/contact'),
        item(c.whatsapp, 'Set the WhatsApp number', '#/whatsapp'), item(s.pushDevices > 0, 'Turn on notifications on a device', '#/settings')));
    root.append(h('div', { class: 'grid2', style: 'align-items:start' }, recent, setup),
      h('p', { style: 'margin-top:18px' }, h('a', { class: 'btn', href: '/', target: '_blank', rel: 'noopener' }, raw(ic('external', 16)), 'View the public website')));
  }

  /* Announcements */
  async function announcementsPage(root) {
    const { items } = await api('GET', '/api/admin/announcements');
    root.append(h('div', { class: 'row between', style: 'margin-bottom:16px' }, h('p', { class: 'muted', style: 'margin:0' }, 'Published announcements appear on the homepage automatically.'),
      h('button', { class: 'btn btn-primary', type: 'button', onclick: () => annForm(null) }, raw(ic('plus')), 'New announcement')));
    if (!items.length) { root.append(h('div', { class: 'card empty' }, 'No announcements yet. Create one, for example “Admissions are now open”.')); return; }
    root.append(h('div', { class: 'card' }, h('div', { class: 'rows' }, items.map((a) =>
      h('div', { class: 'rowitem' },
        h('div', null, h('div', { class: 't' }, a.title, ' ', a.important ? h('span', { class: 'pill gold' }, 'Important') : null, ' ', h('span', { class: 'pill ' + (a.published ? 'ok' : '') }, a.published ? 'Published' : 'Draft')),
          h('div', { class: 'm' }, fmtDate(a.date))),
        h('div', { class: 'row' },
          h('button', { class: 'btn btn-sm', type: 'button', onclick: async () => { try { await api('PUT', '/api/admin/announcements/' + a._id, Object.assign({}, a, { published: !a.published })); toast(a.published ? 'Unpublished' : 'Published', 'ok'); rerender(); } catch (e) { toast(e.message, 'error'); } } }, a.published ? 'Unpublish' : 'Publish'),
          h('button', { class: 'btn btn-sm', type: 'button', onclick: () => annForm(a) }, 'Edit'),
          h('button', { class: 'icon-btn danger', type: 'button', 'aria-label': 'Delete', onclick: async () => { if (await confirmBox('Delete “' + a.title + '”? This cannot be undone.')) { try { await api('DELETE', '/api/admin/announcements/' + a._id); toast('Deleted', 'ok'); rerender(); } catch (e) { toast(e.message, 'error'); } } } }, raw(ic('trash'))))))))); 
  }

  function annForm(item) {
    const d = { title: item ? item.title : '', description: item ? item.description : '', date: (item ? new Date(item.date) : new Date()).toISOString().slice(0, 10), image: item ? item.image : '', important: item ? !!item.important : false, published: item ? item.published !== false : true };
    const g = (k) => () => d[k];
    const s = (k) => (v) => { d[k] = v; };
    const err = h('p', { class: 'err-text', style: 'margin:0' });
    const save = h('button', { class: 'btn btn-primary', type: 'button', onclick: async () => {
      save.disabled = true; err.textContent = '';
      try { await (item ? api('PUT', '/api/admin/announcements/' + item._id, d) : api('POST', '/api/admin/announcements', d)); m.close(); toast('Saved. The homepage is updated.', 'ok'); rerender(); }
      catch (e) { err.textContent = e.message; save.disabled = false; }
    } }, 'Save announcement');
    const body = h('div', { class: 'modal-body' },
      fieldEl({ type: 'text', label: 'Title', max: 200, placeholder: '2026/2027 admission is now open' }, g('title'), s('title'), true),
      fieldEl({ type: 'textarea', label: 'Description', rows: 4 }, g('description'), s('description'), true),
      fieldEl({ type: 'date', label: 'Date' }, g('date'), s('date'), true),
      fieldEl({ type: 'image', label: 'Image (optional)' }, g('image'), s('image'), true),
      fieldEl({ type: 'toggle', label: 'Mark as important' }, g('important'), s('important'), true),
      fieldEl({ type: 'toggle', label: 'Published (visible on the website)' }, g('published'), s('published'), true), err);
    const m = modal(item ? 'Edit announcement' : 'New announcement', body, { foot: h('div', { class: 'modal-foot' }, h('button', { class: 'btn', type: 'button', onclick: () => m.close() }, 'Cancel'), save) });
  }

  /* Gallery */
  async function galleryPage(root) {
    const { items } = await api('GET', '/api/admin/gallery');
    draft = clone(settings);
    dirty = false;
    const cats = () => draft.gallery.categories;
    let files = [];
    const catSel = h('select', { class: 'input' }, cats().map((c) => h('option', { value: c }, c)));
    let published = true;
    const preview = h('div', { class: 'uploads' });
    const status = h('p', { class: 'hint', style: 'margin:10px 0 0;text-align:center' });
    const input = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/gif,image/avif', multiple: true, class: 'hidden' });
    const upBtn = h('button', { class: 'btn btn-primary', type: 'button', disabled: true, onclick: async () => {
      upBtn.disabled = true; status.className = 'hint'; status.textContent = 'Uploading ' + files.length + ' image(s)… please keep this page open.';
      try {
        const fd = new FormData();
        files.forEach((f) => fd.append('files', f));
        fd.append('category', catSel.value);
        fd.append('published', String(published));
        await api('POST', '/api/admin/gallery', fd);
        toast('Images uploaded. The gallery is updated.', 'ok');
        rerender();
      } catch (e) { status.className = 'err-text'; status.style.textAlign = 'center'; status.textContent = e.message; upBtn.disabled = false; }
    } }, raw(ic('upload')), 'Upload selected images');
    const setFiles = (list) => {
      files = Array.from(list).filter((f) => /^image\//.test(f.type)).slice(0, 20);
      preview.replaceChildren(...files.map((f) => h('img', { src: URL.createObjectURL(f), alt: '' })));
      upBtn.disabled = !files.length;
      status.textContent = files.length ? files.length + ' image(s) ready. Large photos are compressed automatically.' : '';
    };
    input.addEventListener('change', () => setFiles(input.files));
    const zone = h('div', { class: 'dropzone' }, h('p', { style: 'margin:0 0 10px' }, 'Drag photos here, or'),
      h('button', { class: 'btn', type: 'button', onclick: () => input.click() }, 'Choose photos'), input, preview, status);
    ['dragenter', 'dragover'].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.remove('drag'); }));
    zone.addEventListener('drop', (e) => setFiles(e.dataTransfer.files));

    root.append(h('div', { class: 'card card-pad' }, h('h2', { style: 'font-size:1.05rem;margin-bottom:12px' }, 'Upload photos'),
      h('div', { class: 'grid2', style: 'margin-bottom:14px' }, h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Category for these photos'), catSel),
        h('div', { style: 'align-self:end' }, fieldEl({ type: 'toggle', label: 'Publish immediately' }, () => published, (v) => { published = v; }, true))),
      zone, h('div', { style: 'margin-top:14px' }, upBtn)));

    const gal = clone(settings.gallery);
    const saveCats = h('button', { class: 'btn btn-primary', type: 'button', onclick: async () => { saveCats.disabled = true; try { const r = await api('PUT', '/api/admin/settings/gallery', { value: gal }); settings.gallery = r.value; toast('Saved', 'ok'); rerender(); } catch (e) { toast(e.message, 'error'); saveCats.disabled = false; } } }, 'Save gallery settings');
    root.append(h('details', { class: 'card' }, h('summary', {}, 'Gallery page settings and categories'),
      h('div', { class: 'card-body' }, fieldEl({ type: 'image', label: 'Banner image (optional)' }, () => gal.bannerImage, (v) => { gal.bannerImage = v; }, true),
        fieldEl({ type: 'textarea', label: 'Introduction', rows: 2 }, () => gal.intro, (v) => { gal.intro = v; }, true),
        fieldEl({ type: 'lines', label: 'Categories (one per line)', rows: 8 }, () => gal.categories, (v) => { gal.categories = v; }, true), h('div', null, saveCats))));

    root.append(h('h2', { style: 'font-size:1.05rem;margin:24px 0 12px' }, 'Your photos (' + items.length + ')'));
    if (!items.length) { root.append(h('div', { class: 'card empty' }, 'No photos yet. Upload your first photos above.')); return; }
    const put = async (it, patch, quiet) => { try { const r = await api('PUT', '/api/admin/gallery/' + it._id, patch); Object.assign(it, r.item); if (!quiet) toast('Saved', 'ok'); } catch (e) { toast(e.message, 'error'); } };
    root.append(h('div', { class: 'gal' }, items.map((it) => {
      const catList = settings.gallery.categories.includes(it.category) ? settings.gallery.categories : [it.category].concat(settings.gallery.categories);
      const rep = h('input', { type: 'file', accept: 'image/*', class: 'hidden', onchange: async (e) => { if (!e.target.files[0]) return; const fd = new FormData(); fd.append('file', e.target.files[0]); toast('Replacing image…'); try { await api('PUT', '/api/admin/gallery/' + it._id + '/replace', fd); toast('Image replaced', 'ok'); rerender(); } catch (er) { toast(er.message, 'error'); } } });
      return h('div', { class: 'gcard' }, h('img', { src: thumbUrl(it.url, 480), alt: '', loading: 'lazy' }),
        h('div', { class: 'gb' },
          h('input', { class: 'input', type: 'text', value: it.title, maxlength: 200, placeholder: 'Caption (optional)', 'aria-label': 'Caption', onchange: (e) => put(it, { title: e.target.value }) }),
          h('select', { class: 'input', value: it.category, 'aria-label': 'Category', onchange: (e) => put(it, { category: e.target.value }) }, catList.map((c) => h('option', { value: c }, c))),
          h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked: it.published, onchange: (e) => put(it, { published: e.target.checked }) }), h('span', { class: 'track' }), h('span', null, 'Published')),
          h('div', { class: 'row' }, h('button', { class: 'btn btn-sm', type: 'button', onclick: () => rep.click() }, 'Replace'), rep,
            h('button', { class: 'btn btn-sm btn-danger', type: 'button', onclick: async () => { if (await confirmBox('Delete this photo from the gallery?')) { try { await api('DELETE', '/api/admin/gallery/' + it._id); toast('Deleted', 'ok'); rerender(); } catch (e) { toast(e.message, 'error'); } } } }, 'Delete'))));
    })));
  }

  /* Admissions */
  async function admissionsPage(root, rest) {
    const sub = rest[0] || '';
    if (sub === 'app') return applicationDetail(root, rest[1]);
    root.append(tabsEl([['', 'Applications'], ['form', 'Form and settings'], ['content', 'Page content']], sub));
    if (sub === 'form') {
      return settingsPage(root, [
        { title: 'Applications', fields: [
          TG('admissions.enabled', 'Accept online applications'),
          LN('admissions.classes', 'Available classes (one per line)', { rows: 9 }),
          TA('admissions.instructions', 'Instructions shown above the form', { rows: 4 }),
          TA('admissions.successMessage', 'Message shown after a successful application', { rows: 3 }),
          TA('admissions.closedMessage', 'Message shown when applications are closed', { rows: 3 }),
        ] },
        { title: 'Form fields', hint: 'Add, remove, rename and reorder the questions parents answer. Changing a name does not affect applications already received.', fields: [
          T('admissions.formTitle', 'Form heading'),
          LIST('admissions.fields', 'Questions', [
            sf('label', 'Question (field name)'), sf('type', 'Answer type', 'select', { options: TYPE_OPTIONS, rerender: true }), sf('required', 'This question is required', 'toggle'),
            sf('options', 'Dropdown options (one per line)', 'lines', { rows: 4, showIf: (it) => it.type === 'select' }),
          ], { titleKey: 'label', itemName: 'Question', addLabel: 'Add a question', newItem: { type: 'text', key: '' } }),
        ] },
      ]);
    }
    if (sub === 'content') {
      return settingsPage(root, [
        { title: 'Introduction', fields: [IMG('admissions.bannerImage', 'Banner image (optional)'), T('admissions.intro.title', 'Title'), TA('admissions.intro.text', 'Text')] },
        { title: 'Admission process', fields: [LIST('admissions.process', 'Steps', [sf('title', 'Title'), sf('text', 'Description', 'textarea', { rows: 2 })], { titleKey: 'title', addLabel: 'Add a step' })] },
        { title: 'Requirements and important information', fields: [LN('admissions.requirements', 'Requirements (one per line)', { rows: 7 }), TA('admissions.importantInfo', 'Important information', { rows: 4 })] },
        { title: 'Frequently asked questions', fields: [LIST('admissions.faqs', 'Questions', [sf('q', 'Question'), sf('a', 'Answer', 'textarea', { rows: 3 })], { titleKey: 'q', addLabel: 'Add a question' })] },
      ]);
    }
    return applicationsList(root);
  }

  async function applicationsList(root) {
    let q = '', page = 1;
    const listBox = h('div');
    const search = h('input', { class: 'input', type: 'search', placeholder: 'Search by name, phone, email or reference', 'aria-label': 'Search applications', style: 'max-width:420px' });
    let timer;
    search.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { q = search.value.trim(); page = 1; load(); }, 300); });
    root.append(h('div', { class: 'row between', style: 'margin-bottom:14px' }, search, h('a', { class: 'btn', href: '/api/admin/applications/export.csv' }, 'Export to Excel (CSV)')), listBox);
    async function load() {
      try {
        const d = await api('GET', '/api/admin/applications?page=' + page + '&q=' + encodeURIComponent(q));
        if (!d.items.length) { listBox.replaceChildren(h('div', { class: 'card empty' }, q ? 'No applications match your search.' : 'No applications yet.')); return; }
        listBox.replaceChildren(
          h('div', { class: 'card' }, h('div', { class: 'rows' }, d.items.map((a) => h('a', { class: 'rowitem' + (a.read ? '' : ' unread'), href: '#/admissions/app/' + a._id },
            h('div', null, h('div', { class: 't' }, a.applicant || 'Applicant'), h('div', { class: 'm' }, [a.classApplied, a.ref, fmtDate(a.createdAt, true)].filter(Boolean).join(' · '))),
            a.read ? null : h('span', { class: 'pill gold' }, 'New'))))),
          d.pages > 1 ? h('div', { class: 'row between', style: 'margin-top:14px' }, h('button', { class: 'btn btn-sm', disabled: page <= 1, onclick: () => { page--; load(); } }, 'Previous'), h('span', { class: 'muted' }, 'Page ' + d.page + ' of ' + d.pages + ' (' + d.total + ' applications)'), h('button', { class: 'btn btn-sm', disabled: page >= d.pages, onclick: () => { page++; load(); } }, 'Next')) : null);
      } catch (e) { listBox.replaceChildren(h('p', { class: 'err-text' }, e.message)); }
    }
    load();
  }

  async function applicationDetail(root, id) {
    const { item } = await api('GET', '/api/admin/applications/' + id);
    refreshBadge();
    const email = item.answers.find((a) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(a.value));
    const emailLabel = { sent: ['ok', 'Emailed to the school'], failed: ['bad', 'Email failed to send'], not_configured: ['warn', 'Email not set up'], pending: ['', 'Sending…'] }[item.emailStatus] || ['', ''];
    root.append(h('div', { class: 'row between', style: 'margin-bottom:14px' }, h('a', { class: 'btn', href: '#/admissions' }, 'Back to applications'),
      h('div', { class: 'row' }, email ? h('a', { class: 'btn', href: 'mailto:' + email.value }, raw(ic('mail', 16)), 'Email parent') : null,
        h('button', { class: 'btn btn-danger', type: 'button', onclick: async () => { if (await confirmBox('Delete this application permanently?')) { try { await api('DELETE', '/api/admin/applications/' + item._id); toast('Application deleted', 'ok'); location.hash = '#/admissions'; } catch (e) { toast(e.message, 'error'); } } } }, 'Delete'))),
      h('div', { class: 'card' }, h('div', { class: 'card-pad row between', style: 'border-bottom:1px solid var(--line)' }, h('div', null, h('h2', { style: 'font-size:1.15rem' }, item.applicant || 'Applicant'), h('div', { class: 'muted' }, item.ref + ' · Received ' + fmtDate(item.createdAt, true))), h('span', { class: 'pill ' + emailLabel[0] }, emailLabel[1])),
        h('dl', { class: 'dl', style: 'margin:0' }, item.answers.map((a) => [h('dt', null, a.label), h('dd', null, a.value || '–')]))));
  }

  /* Appearance */
  async function appearancePage(root) {
    draft = clone(settings);
    dirty = false;
    const a = draft.appearance;
    const keys = [['primary', 'Primary colour', 'Buttons, headings, links, footer'], ['secondary', 'Secondary colour', 'Soft section backgrounds'], ['accent', 'Accent colour', 'Highlights and call-to-action buttons'], ['text', 'Text colour', 'Body text'], ['background', 'Background colour', 'Page background']];
    const presetBox = h('div', { class: 'presets' });
    const colorBox = h('div', { class: 'colors' });
    const probBox = h('div');
    const pv = h('div', { class: 'preview' });
    const save = h('button', { class: 'btn btn-primary', type: 'button', onclick: () => saveSections(['appearance', 'school'], save) }, 'Save changes');

    const refresh = (full) => {
      Theme.apply(a, pv);
      const probs = Theme.problems(a);
      probBox.replaceChildren(probs.length ? h('div', { class: 'card card-pad', style: 'border-color:#F0C4BF' }, h('b', { style: 'color:var(--danger)' }, 'These colours are hard to read, so they cannot be saved yet:'), h('ul', { class: 'problems' }, probs.map((p) => h('li', null, p)))) : h('p', { class: 'muted', style: 'margin:0' }, '✓ These colours are easy to read.'));
      save.disabled = probs.length > 0;
      if (full) {
        presetBox.replaceChildren(...Theme.presets.map((p) => h('button', { type: 'button', class: 'preset', 'aria-pressed': a.preset === p.id ? 'true' : 'false', onclick: () => { ['primary', 'secondary', 'accent', 'text', 'background'].forEach((k) => { a[k] = p[k]; }); a.preset = p.id; markDirty(); refresh(true); } },
          h('div', { class: 'swatches' }, ['primary', 'secondary', 'accent', 'text', 'background'].map((k) => h('i', { style: 'background:' + p[k] }))), h('b', null, p.name))));
        colorBox.replaceChildren(...keys.map(([k, label, hint]) => {
          const hex = h('input', { type: 'text', class: 'input', value: a[k], maxlength: 7, 'aria-label': label + ' hex code', onchange: (e) => { let v = e.target.value.trim(); if (v[0] !== '#') v = '#' + v; if (Theme.hexOk(v)) { a[k] = v.toUpperCase(); a.preset = 'custom'; markDirty(); refresh(true); } else { e.target.value = a[k]; toast('Use a six-digit colour code such as #0B2545', 'error'); } } });
          const pick = h('input', { type: 'color', value: a[k], 'aria-label': label, oninput: (e) => { a[k] = e.target.value.toUpperCase(); a.preset = 'custom'; hex.value = a[k]; markDirty(); refresh(false); presetBox.querySelectorAll('.preset').forEach((b) => b.setAttribute('aria-pressed', 'false')); } });
          return h('div', null, h('div', { style: 'font-weight:600;margin-bottom:2px' }, label), h('div', { class: 'hint', style: 'margin-bottom:6px' }, hint), h('div', { class: 'colorfield' }, pick, hex));
        }));
      }
    };
    pv.append(
      h('div', { class: 'pv-head' }, h('span', null, draft.school.name), h('span', { class: 'pv-btn', style: 'background:var(--primary);color:var(--on-primary);margin:0' }, 'Apply now')),
      h('div', { class: 'pv-hero' }, h('b', null, 'A place where every child is known'), h('div', null, 'Warm teaching, high expectations.'), h('span', { class: 'pv-btn', style: 'background:var(--accent);color:var(--on-accent)' }, 'Book a visit')),
      h('div', { class: 'pv-body' }, h('b', { style: 'color:var(--primary)' }, 'Why families choose us'), h('p', { style: 'margin:6px 0 0' }, 'Body text sits on the page background. ', h('a', { href: '#', style: 'color:var(--primary)', onclick: (e) => e.preventDefault() }, 'This is a link.'))),
      h('div', { class: 'pv-tint' }, 'Soft section background using the secondary colour.'));
    root.append(
      h('div', { class: 'card card-pad' }, h('h2', { style: 'font-size:1.05rem;margin-bottom:6px' }, 'Preset themes'), h('p', { class: 'hint', style: 'margin:0 0 12px' }, 'Pick a ready-made theme, or adjust the colours below.'), presetBox),
      h('div', { class: 'card card-pad' }, h('h2', { style: 'font-size:1.05rem;margin-bottom:12px' }, 'Custom colours'), colorBox, h('div', { style: 'margin-top:16px' }, probBox)),
      h('div', { class: 'card card-pad' }, h('h2', { style: 'font-size:1.05rem;margin-bottom:12px' }, 'Live preview'), pv),
      h('div', { class: 'card card-pad', style: 'display:grid;gap:16px' }, h('h2', { style: 'font-size:1.05rem' }, 'Logo and favicon'),
        fieldEl({ type: 'image', label: 'School logo', hint: 'A PNG with a transparent background works best.' }, () => draft.school.logo, (v) => { draft.school.logo = v; }),
        fieldEl({ type: 'image', label: 'Favicon', hint: 'A small square image shown in the browser tab.' }, () => draft.school.favicon, (v) => { draft.school.favicon = v; })),
      h('div', { class: 'savebar' }, save, h('span', { class: 'dirty-note hidden' }, 'You have unsaved changes')));
    refresh(true);
  }

  /* Media library */
  async function mediaPage(root) {
    const data = await api('GET', '/api/admin/media');
    const file = h('input', { type: 'file', accept: 'image/*', multiple: true, class: 'hidden', onchange: async (e) => {
      const list = Array.from(e.target.files);
      for (const f of list) { try { const fd = new FormData(); fd.append('file', f); await api('POST', '/api/admin/media', fd); } catch (er) { toast(f.name + ': ' + er.message, 'error'); } }
      toast('Upload finished', 'ok'); rerender();
    } });
    root.append(h('div', { class: 'row between', style: 'margin-bottom:14px' }, h('p', { class: 'muted', style: 'margin:0' }, 'Every image you upload for logos, banners and pages is kept here. Gallery photos are managed in Gallery.'),
      h('button', { class: 'btn btn-primary', type: 'button', onclick: () => file.click() }, raw(ic('upload')), 'Upload images'), file));
    if (!data.items.length) { root.append(h('div', { class: 'card empty' }, 'No images yet.')); return; }
    root.append(h('div', { class: 'gal' }, data.items.map((it) => h('div', { class: 'gcard' }, h('img', { src: thumbUrl(it.url, 480), alt: '', loading: 'lazy' }),
      h('div', { class: 'gb' }, h('div', { class: 'hint' }, fmtDate(it.createdAt) + (it.width ? ' · ' + it.width + '×' + it.height : '')),
        h('div', { class: 'row' }, h('a', { class: 'btn btn-sm', href: it.url, target: '_blank', rel: 'noopener' }, 'Preview'),
          h('button', { class: 'btn btn-sm btn-danger', type: 'button', onclick: async () => { if (await confirmBox('Delete this image?')) { try { await api('DELETE', '/api/admin/media/' + it._id); toast('Deleted', 'ok'); rerender(); } catch (e) { toast(e.message, 'error'); } } } }, 'Delete')))))));
  }

  /* Settings: account + notifications */
  async function settingsAccountPage(root) {
    const ps = await pushState();
    const info = await api('GET', '/api/admin/push/devices');
    const pushCard = h('div', { class: 'card card-pad', style: 'display:grid;gap:12px' }, h('h2', { style: 'font-size:1.05rem' }, 'Browser notifications'));
    const keyInfo = await api('GET', '/api/admin/push/key');
    if (!keyInfo.enabled) pushCard.append(h('p', { class: 'err-text', style: 'margin:0' }, 'Not set up on the server yet. Add VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY to the .env file (run “npm run vapid” to create them) and restart.'));
    else if (ps.needsInstall) pushCard.append(h('p', { style: 'margin:0' }, 'On iPhone or iPad, tap Share, choose “Add to Home Screen”, then open the dashboard from the Home Screen and come back here.'));
    else if (!ps.supported) pushCard.append(h('p', { style: 'margin:0' }, 'This browser does not support notifications. Try Chrome, Edge, Firefox or Safari.'));
    else {
      const on = ps.permission === 'granted' && ps.subscribed;
      pushCard.append(h('p', { style: 'margin:0' }, on ? '✓ Notifications are on for this device. You will be alerted about new applications even when this page is closed.' : ps.permission === 'denied' ? 'Notifications are blocked for this site in your browser. Allow them in the site settings, then come back.' : 'Notifications are off on this device.'),
        h('div', { class: 'row' }, on ? [h('button', { class: 'btn', type: 'button', onclick: async () => { await disablePush(); toast('Notifications turned off on this device', 'ok'); rerender(); } }, 'Turn off on this device'),
          h('button', { class: 'btn', type: 'button', onclick: async () => { try { const r = await api('POST', '/api/admin/push/test'); toast(r.delivered ? 'Test sent. Look for the notification.' : 'No device received it.', r.delivered ? 'ok' : 'error'); } catch (e) { toast(e.message, 'error'); } } }, 'Send a test')]
          : h('button', { class: 'btn btn-primary', type: 'button', onclick: async () => { try { await enablePush(); toast('Notifications are on for this device.', 'ok'); rerender(); } catch (e) { toast(e.message, 'error'); } } }, raw(ic('bell')), 'Turn on notifications')));
    }
    if (info.items.length) pushCard.append(h('div', null, h('b', { style: 'font-size:.92rem' }, 'Devices that receive alerts (' + info.items.length + ')'),
      h('div', { class: 'rows card', style: 'margin-top:8px' }, info.items.map((d) => h('div', { class: 'rowitem' }, h('div', null, h('div', { class: 't', style: 'font-size:.92rem' }, deviceName(d.userAgent)), h('div', { class: 'm' }, 'Added ' + fmtDate(d.createdAt))),
        h('button', { class: 'btn btn-sm btn-danger', type: 'button', onclick: async () => { await api('DELETE', '/api/admin/push/devices/' + d._id); toast('Device removed', 'ok'); rerender(); } }, 'Remove'))))));

    const cur = h('input', { type: 'password', autocomplete: 'current-password' });
    const nw = h('input', { type: 'password', autocomplete: 'new-password' });
    const perr = h('p', { class: 'err-text', style: 'margin:0' });
    const pbtn = h('button', { class: 'btn btn-primary', type: 'button', onclick: async () => {
      perr.textContent = ''; pbtn.disabled = true;
      try { await api('POST', '/api/auth/password', { current: cur.value, next: nw.value }); cur.value = ''; nw.value = ''; toast('Password changed. Other devices have been signed out.', 'ok'); }
      catch (e) { perr.textContent = e.message; }
      pbtn.disabled = false;
    } }, 'Change password');
    root.append(pushCard,
      h('div', { class: 'card card-pad', style: 'display:grid;gap:14px;max-width:520px' }, h('h2', { style: 'font-size:1.05rem' }, 'Change password'), h('p', { class: 'muted', style: 'margin:0' }, 'Signed in as ' + me.email),
        h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Current password'), cur), h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'New password'), nw, h('span', { class: 'hint' }, 'At least 10 characters.')), perr, h('div', null, pbtn)),
      h('div', { style: 'margin-top:16px' }, h('button', { class: 'btn', type: 'button', onclick: logout }, raw(ic('logout', 16)), 'Sign out')));
  }
  function deviceName(ua) {
    const browser = /edg\//i.test(ua) ? 'Edge' : /firefox/i.test(ua) ? 'Firefox' : /chrome|crios/i.test(ua) ? 'Chrome' : /safari/i.test(ua) ? 'Safari' : 'Browser';
    const os = /android/i.test(ua) ? 'Android' : /iphone|ipad/i.test(ua) ? 'iPhone / iPad' : /windows/i.test(ua) ? 'Windows' : /mac os/i.test(ua) ? 'Mac' : /linux/i.test(ua) ? 'Linux' : 'device';
    return browser + ' on ' + os;
  }

  /* ---------- Router and shell ---------- */
  const NAV = [
    ['dashboard', 'Dashboard', 'dashboard'], ['school', 'School Information', 'building'], ['homepage', 'Homepage', 'globe'], ['about', 'About', 'book'],
    ['academics', 'Academics', 'pencil'], ['facilities', 'Facilities', 'sun'], ['gallery', 'Gallery', 'image'], ['admissions', 'Admissions', 'inbox'],
    ['contact', 'Contact Information', 'phone'], ['announcements', 'Announcements', 'megaphone'], ['whatsapp', 'WhatsApp Settings', 'whatsapp'], ['social', 'Social Media', 'share'],
    ['appearance', 'Website Appearance', 'palette'], ['media', 'Media Library', 'file'], ['settings', 'Settings', 'settings'],
  ];
  const ROUTES = {
    dashboard: ['Dashboard', dashboardPage],
    school: ['School Information', (r) => settingsPage(r, SCHEMA.school)],
    homepage: ['Homepage', (r) => settingsPage(r, SCHEMA.homepage)],
    about: ['About page', (r) => settingsPage(r, SCHEMA.about)],
    academics: ['Academics page', (r) => settingsPage(r, SCHEMA.academics)],
    facilities: ['Facilities page', (r) => settingsPage(r, SCHEMA.facilities)],
    gallery: ['Gallery', galleryPage],
    admissions: ['Admissions', admissionsPage],
    contact: ['Contact Information', (r) => settingsPage(r, SCHEMA.contact)],
    announcements: ['Announcements', announcementsPage],
    whatsapp: ['WhatsApp Settings', (r) => {
      const n = settings.whatsapp.number;
      return settingsPage(r, SCHEMA.whatsapp, n ? h('p', { style: 'margin:0 0 14px' }, h('a', { href: 'https://wa.me/' + n, target: '_blank', rel: 'noopener' }, 'Open a test chat with +' + n)) : null);
    }],
    social: ['Social Media', (r) => settingsPage(r, SCHEMA.social)],
    appearance: ['Website Appearance', appearancePage],
    media: ['Media Library', mediaPage],
    settings: ['Settings', settingsAccountPage],
  };

  let lastHash = '';
  let guard = false;
  async function route(keepScroll) {
    const parts = location.hash.replace(/^#\/?/, '').split('/');
    const name = ROUTES[parts[0]] ? parts[0] : 'dashboard';
    const view = $('#view');
    if (!view) return;
    lastHash = location.hash;
    document.body.classList.remove('drawer-open');
    $('#pageTitle').textContent = ROUTES[name][0];
    document.title = ROUTES[name][0] + ' | School Admin';
    document.querySelectorAll('.nav-item').forEach((a) => a.setAttribute('aria-current', a.dataset.k === name ? 'page' : 'false'));
    view.replaceChildren(h('p', { class: 'muted' }, 'Loading…'));
    const body = h('div');
    try {
      dirty = false;
      await ROUTES[name][1](body, parts.slice(1));
      view.replaceChildren(body);
    } catch (e) {
      if (e.status === 401) return;
      view.replaceChildren(h('div', { class: 'card card-pad' }, h('p', { class: 'err-text' }, e.message), h('button', { class: 'btn', onclick: () => route() }, 'Try again')));
    }
    if (!keepScroll) window.scrollTo(0, 0);
  }

  async function refreshBadge() {
    try {
      const s = await api('GET', '/api/admin/stats');
      const a = $('.nav-item[data-k="admissions"]');
      if (!a) return;
      a.querySelector('.badge') && a.querySelector('.badge').remove();
      if (s.applications.unread) a.append(h('span', { class: 'badge' }, String(s.applications.unread)));
    } catch (e) { /* ignore */ }
  }

  function shell() {
    app.replaceChildren(h('div', { class: 'layout' },
      h('aside', { class: 'sidebar', id: 'sidebar', 'aria-label': 'Admin navigation' },
        h('div', { class: 'side-brand' }, h('span', { class: 'mark' }, raw(ic('book', 18))), h('span', null, settings.school.name || 'School Admin')),
        NAV.map(([k, label, icon]) => h('a', { class: 'nav-item', href: '#/' + k, 'data-k': k }, raw(ic(icon)), label)),
        h('div', { class: 'side-foot' }, h('a', { class: 'btn btn-light', href: '/', target: '_blank', rel: 'noopener', style: 'margin-bottom:8px' }, raw(ic('external', 16)), 'View website'), h('button', { class: 'btn btn-light', type: 'button', onclick: logout }, raw(ic('logout', 16)), 'Sign out'))),
      h('div', { class: 'scrim', onclick: () => document.body.classList.remove('drawer-open') }),
      h('div', { class: 'main' },
        h('header', { class: 'topbar' }, h('button', { class: 'icon-btn menu-btn', type: 'button', 'aria-label': 'Open menu', onclick: () => document.body.classList.toggle('drawer-open') }, raw(ic('menu', 22))), h('h1', { id: 'pageTitle' }, ''),
          h('div', { class: 'top-actions' }, h('span', { class: 'muted', style: 'font-size:.9rem' }, me.name))),
        h('main', { class: 'view', id: 'view' }))));
  }

  async function logout() {
    try { await api('POST', '/api/auth/logout'); } catch (e) { /* ignore */ }
    me = null;
    showLogin();
  }

  function showLogin() {
    document.body.classList.remove('drawer-open');
    const err = h('p', { class: 'err-text', style: 'margin:0', role: 'alert' });
    const login = h('input', { type: 'text', name: 'login', autocomplete: 'username', required: true, autocapitalize: 'none' });
    const pass = h('input', { type: 'password', name: 'password', autocomplete: 'current-password', required: true });
    const btn = h('button', { class: 'btn btn-primary', type: 'submit', style: 'width:100%' }, 'Sign in');
    const form = h('form', { style: 'display:grid;gap:16px', onsubmit: async (e) => {
      e.preventDefault(); err.textContent = ''; btn.disabled = true; btn.textContent = 'Signing in…';
      try {
        await api('POST', '/api/auth/login', { login: login.value, password: pass.value });
        // Still inside the click gesture, so the browser allows the notification prompt.
        if (pushSupported() && Notification.permission === 'default') { try { await enablePush(); } catch (er) { /* the dashboard banner offers it again */ } }
        await start();
      } catch (er) { err.textContent = er.message; btn.disabled = false; btn.textContent = 'Sign in'; }
    } },
      h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Email or username'), login), h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Password'), pass), err, btn);
    app.replaceChildren(h('div', { class: 'login-wrap' }, h('div', { class: 'login-card' }, h('h1', null, 'School admin'), h('p', null, 'Sign in to manage your website.'), form)));
    login.focus();
  }

  async function start() {
    try {
      me = (await api('GET', '/api/auth/me')).admin;
    } catch (e) { return; }
    const data = await api('GET', '/api/admin/settings');
    settings = data.settings;
    shell();
    if (!location.hash) location.hash = '#/dashboard';
    await route();
    refreshBadge();
    syncPush();
  }

  window.addEventListener('hashchange', () => {
    if (guard) { guard = false; return; }
    if (dirty && !window.confirm('You have unsaved changes. Leave this page without saving?')) {
      guard = true;
      location.hash = lastHash;
      return;
    }
    route();
  });
  window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && me) refreshBadge(); });

  registerSW().then(start);
})();
