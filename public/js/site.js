/* Public website renderer. All content comes from /api/public/site, managed in the admin dashboard. */
(function () {
  'use strict';
  document.documentElement.classList.add('js');

  const { esc, Icons, Theme } = window;
  const I = (n, s) => Icons.svg(n, s);
  const page = document.body.dataset.page;
  const app = document.getElementById('app');
  let S = null;
  let ANN = [];

  /* ---------- helpers ---------- */
  const img = (url, w) =>
    url && url.indexOf('res.cloudinary.com') > -1 && url.indexOf('/upload/') > -1
      ? url.replace('/upload/', '/upload/f_auto,q_auto,w_' + (w || 1200) + '/')
      : url || '';
  const paras = (t) =>
    String(t || '')
      .split(/\n{2,}/)
      .filter((p) => p.trim())
      .map((p) => '<p>' + esc(p.trim()).replace(/\n/g, '<br>') + '</p>')
      .join('');
  const telHref = (s) => 'tel:' + String(s).replace(/[^\d+]/g, '');
  const attrUrl = (u) => esc(u || '');
  const fmtDate = (d) => {
    const dt = new Date(d);
    return {
      day: dt.toLocaleDateString('en-GB', { day: 'numeric' }),
      mon: dt.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }),
    };
  };
  const getJSON = async (url) => {
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error('Request failed');
    return r.json();
  };

  /* ---------- WhatsApp ---------- */
  function waUrl(placement, msgKey) {
    const w = S.whatsapp;
    if (!w.enabled || !w.number || w.placements[placement] === false) return '';
    const msg = w.messages[msgKey || placement] || w.defaultMessage;
    return 'https://wa.me/' + w.number + '?text=' + encodeURIComponent(msg);
  }
  const waBtn = (placement, msgKey, label, cls) => {
    const u = waUrl(placement, msgKey);
    return u ? '<a class="btn btn-wa ' + (cls || '') + '" href="' + esc(u) + '" target="_blank" rel="noopener noreferrer">' + I('whatsapp', 18) + esc(label) + '</a>' : '';
  };
  const btn = (href, text, cls) => (href && text ? '<a class="btn ' + cls + '" href="' + attrUrl(href) + '">' + esc(text) + '</a>' : '');

  /* ---------- layout pieces ---------- */
  const NAV = [
    ['/', 'Home', 'home'], ['/about', 'About', 'about'], ['/academics', 'Academics', 'academics'],
    ['/facilities', 'Facilities', 'facilities'], ['/gallery', 'Gallery', 'gallery'],
    ['/admissions', 'Admissions', 'admissions'], ['/contact', 'Contact', 'contact'],
  ];

  function header() {
    const s = S.school;
    return (
      '<header class="site-header"><div class="container header-inner">' +
      '<a class="brand" href="/" aria-label="' + esc(s.name) + ' home">' +
      (s.logo ? '<img src="' + attrUrl(img(s.logo, 300)) + '" alt="">' : '') +
      '<span class="brand-name">' + esc(s.name) + '</span></a>' +
      '<button class="nav-toggle" type="button" aria-expanded="false" aria-controls="nav" aria-label="Open menu">' + I('menu') + '</button>' +
      '<nav class="nav" id="nav" aria-label="Main">' +
      NAV.map((n) => '<a class="nav-link" href="' + n[0] + '"' + (n[2] === page ? ' aria-current="page"' : '') + '>' + n[1] + '</a>').join('') +
      '<div class="header-actions">' + btn('/admissions#apply', 'Apply now', 'btn-primary btn-sm') + waBtn('header', 'header', 'WhatsApp', 'btn-sm') + '</div>' +
      '</nav></div></header>'
    );
  }

  function footer() {
    const s = S.school, c = S.contact, so = S.social;
    const socials = ['facebook', 'instagram', 'tiktok', 'youtube', 'linkedin', 'twitter']
      .filter((k) => so[k])
      .map((k) => '<a href="' + attrUrl(so[k]) + '" target="_blank" rel="noopener noreferrer" aria-label="' + (k === 'twitter' ? 'X (Twitter)' : k[0].toUpperCase() + k.slice(1)) + '">' + I(k, 18) + '</a>')
      .join('');
    const rows = [];
    if (c.address) rows.push('<li>' + esc(c.address) + '</li>');
    if (c.phone) rows.push('<li><a href="' + telHref(c.phone) + '">' + esc(c.phone) + '</a></li>');
    if (c.email) rows.push('<li><a href="mailto:' + attrUrl(c.email) + '">' + esc(c.email) + '</a></li>');
    return (
      '<footer class="site-footer"><div class="container"><div class="footer-grid">' +
      '<div><div class="footer-brand-row">' + (s.logo ? '<img src="' + attrUrl(img(s.logo, 200)) + '" alt="">' : '') + '<div class="footer-brand">' + esc(s.name) + '</div></div>' +
      '<p>' + esc(s.tagline) + '</p>' + (socials ? '<div class="socials">' + socials + '</div>' : '') + '</div>' +
      '<div><h3>Explore</h3><ul>' + NAV.map((n) => '<li><a href="' + n[0] + '">' + n[1] + '</a></li>').join('') + '</ul></div>' +
      '<div><h3>Contact</h3><ul>' + rows.join('') + '</ul></div>' +
      '<div><h3>Opening hours</h3><p class="pre">' + esc(c.openingHours) + '</p>' + waBtn('footer', 'footer', 'Chat on WhatsApp', 'btn-sm') + '</div>' +
      '</div><div class="footer-bottom"><span>© ' + new Date().getFullYear() + ' ' + esc(s.name) + '. All rights reserved.</span></div></div></footer>'
    );
  }

  const floatingWa = () => {
    const u = waUrl('floating', 'floating');
    return u ? '<a class="wa-float" href="' + esc(u) + '" target="_blank" rel="noopener noreferrer" aria-label="Chat with us on WhatsApp">' + I('whatsapp', 28) + '</a>' : '';
  };

  const banner = (title, text, image) =>
    '<section class="page-banner' + (image ? ' has-image' : '') + '">' + (image ? '<div class="banner-img" data-bg="' + attrUrl(img(image, 1920)) + '"></div>' : '') +
    '<div class="container"><h1>' + esc(title) + '</h1>' + (text ? '<p>' + esc(text) + '</p>' : '') + '</div></section>';

  let alt = false;
  const sec = (inner, o) => {
    o = o || {};
    if (o.dark) return '<section class="section dark reveal"><div class="container">' + inner + '</div></section>';
    alt = !alt;
    return '<section class="section' + (alt ? '' : ' tint') + ' reveal"' + (o.id ? ' id="' + o.id + '"' : '') + '><div class="container">' + inner + '</div></section>';
  };
  const head = (title, sub) => '<div class="section-head"><h2>' + esc(title) + '</h2><hr class="rule">' + (sub ? '<p>' + esc(sub) + '</p>' : '') + '</div>';
  const media = (url, icon, w) => (url ? '<img src="' + attrUrl(img(url, w || 900)) + '" alt="" loading="lazy" decoding="async">' : '<div class="ph">' + I(icon || 'book', 44) + '</div>');

  function split(title, text, image, o) {
    o = o || {};
    const body = '<div class="prose"><h2>' + esc(title) + '</h2><hr class="rule">' + paras(text) + (o.extra || '') + '</div>';
    if (!image) return '<div class="prose">' + '<h2>' + esc(title) + '</h2><hr class="rule">' + paras(text) + (o.extra || '') + '</div>';
    return '<div class="split' + (o.flip ? ' flip' : '') + '">' + body + '<div class="split-media"><div class="framed">' + media(image, 'building', 1000) + '</div></div></div>';
  }

  /* ---------- Home ---------- */
  function homeHero() {
    const h = S.home.hero;
    return (
      '<section class="hero' + (h.image ? ' has-image' : '') + '">' + (h.image ? '<div class="hero-bg" data-bg="' + attrUrl(img(h.image, 1920)) + '"></div>' : '') +
      '<div class="container"><div class="hero-inner"><div class="hero-rule"></div><h1>' + esc(h.headline) + '</h1><p>' + esc(h.description) + '</p>' +
      '<div class="btn-row">' + btn(h.ctaLink, h.ctaText, 'btn-accent') + btn(h.secondaryCtaLink, h.secondaryCtaText, 'btn-light') + waBtn('hero', 'hero', 'WhatsApp us') + '</div></div></div></section>'
    );
  }

  function noticesSection() {
    const a = S.home.announcements;
    if (!a.enabled || !ANN.length) return '';
    const items = ANN.map((n) => {
      const d = fmtDate(n.date);
      return (
        '<article class="notice' + (n.important ? ' important' : '') + '"><div class="notice-date"><b>' + esc(d.day) + '</b><span>' + esc(d.mon) + '</span></div>' +
        '<div><h3>' + esc(n.title) + (n.important ? '<span class="tag">Important</span>' : '') + '</h3>' + (n.description ? '<p>' + esc(n.description).replace(/\n/g, '<br>') + '</p>' : '') + '</div>' +
        (n.image ? '<img src="' + attrUrl(img(n.image, 400)) + '" alt="" loading="lazy">' : '<span></span>') + '</article>'
      );
    }).join('');
    return sec(head(a.title) + '<div class="notices">' + items + '</div>');
  }

  function homeSections(gallery) {
    const h = S.home;
    const out = [];
    out.push(homeHero());
    alt = false;
    out.push(noticesSection());
    if (h.welcome.enabled) out.push(sec(split(h.welcome.title, h.welcome.message, h.welcome.image)));
    if (h.whyChooseUs.enabled && h.whyChooseUs.items.length)
      out.push(sec(head(h.whyChooseUs.title, h.whyChooseUs.subtitle) + '<div class="reasons">' + h.whyChooseUs.items.map((i) => '<div class="reason">' + I(i.icon, 30) + '<h3>' + esc(i.title) + '</h3><p>' + esc(i.text) + '</p></div>').join('') + '</div>'));
    if (h.programmes.enabled && h.programmes.items.length)
      out.push(sec(head(h.programmes.title, h.programmes.subtitle) + '<div class="cards">' + h.programmes.items.map((i) => '<article class="card"><div class="card-media">' + media(i.image, 'book', 800) + '</div><div class="card-body"><h3>' + esc(i.title) + '</h3><p>' + esc(i.text) + '</p></div></article>').join('') + '</div><p style="margin-top:32px"><a class="btn btn-outline" href="/academics">Explore our academics</a></p>'));
    if (h.facilities.enabled && h.facilities.items.length)
      out.push(sec(head(h.facilities.title, h.facilities.subtitle) + '<div class="tiles">' + h.facilities.items.map((i) => '<article class="tile">' + media(i.image, 'building', 800) + '<div class="tile-body"><h3>' + esc(i.title) + '</h3><p>' + esc(i.text) + '</p></div></article>').join('') + '</div><p style="margin-top:32px"><a class="btn btn-outline" href="/facilities">See all facilities</a></p>'));
    if (h.activities.enabled && h.activities.items.length)
      out.push(sec(head(h.activities.title, h.activities.subtitle) + '<div class="activity-list">' + h.activities.items.map((i) => '<div class="activity">' + I('check', 22) + '<div><h3>' + esc(i.title) + '</h3><p>' + esc(i.text) + '</p></div></div>').join('') + '</div>'));
    if (h.values.enabled && h.values.items.length)
      out.push(sec(head(h.values.title) + '<div class="values" style="--n:' + Math.min(h.values.items.length, 5) + '">' + h.values.items.map((i) => '<div class="value"><h3>' + esc(i.title) + '</h3><p>' + esc(i.text) + '</p></div>').join('') + '</div>', { dark: true }));
    if (h.gallery.enabled && gallery.length) {
      const g = gallery.slice(0, 5);
      out.push(sec(head(h.gallery.title, h.gallery.subtitle) + '<div class="gallery-grid">' + g.map((x, n) => '<button class="g" type="button" data-lb="' + n + '" aria-label="Open photo' + (x.title ? ': ' + esc(x.title) : '') + '"><img src="' + attrUrl(img(x.url, n === 0 ? 1000 : 600)) + '" alt="' + esc(x.title) + '" loading="lazy" decoding="async"></button>').join('') + '</div><p style="margin-top:32px"><a class="btn btn-outline" href="/gallery">View the full gallery</a></p>'));
    }
    if (h.testimonials.enabled && h.testimonials.items.length)
      out.push(sec(head(h.testimonials.title) + '<div class="quotes">' + h.testimonials.items.map((t) => '<blockquote class="quote"><p>' + esc(t.quote) + '</p><footer><b>' + esc(t.name) + '</b><span>' + esc(t.role) + '</span></footer></blockquote>').join('') + '</div>'));
    const a = h.admissionCta, c = h.contactCta;
    if (a.enabled || c.enabled) {
      const solo = a.enabled && c.enabled ? '' : ' cta-solo';
      out.push(
        '<section class="cta-split reveal">' +
        (a.enabled ? '<div class="cta-panel primary' + solo + '"><h2>' + esc(a.title) + '</h2><p>' + esc(a.text) + '</p><div class="btn-row">' + btn('/admissions#apply', a.buttonText, 'btn-accent') + waBtn('admission', 'admission', 'Ask on WhatsApp') + '</div></div>' : '') +
        (c.enabled ? '<div class="cta-panel light' + solo + '"><h2>' + esc(c.title) + '</h2><p>' + esc(c.text) + '</p><div class="btn-row">' + btn('/contact', c.buttonText, 'btn-primary') + waBtn('contact', 'visit', 'Book a visit on WhatsApp') + '</div></div>' : '') +
        '</section>'
      );
    }
    return out.join('');
  }

  /* ---------- About ---------- */
  function aboutPage() {
    const a = S.about;
    alt = false;
    let h = banner('About us', S.school.tagline, a.bannerImage);
    h += sec(split(a.intro.title, a.intro.text, a.intro.image));
    if (a.overview.stats.length) h += sec(head(a.overview.title) + '<div class="stats">' + a.overview.stats.map((s) => '<div class="stat"><b>' + esc(s.value) + '</b><span>' + esc(s.label) + '</span></div>').join('') + '</div>');
    h += sec(split(a.history.title, a.history.text, a.history.image, { flip: true }));
    h += sec('<div class="duo"><div class="prose"><h2>' + esc(a.mission.title) + '</h2>' + paras(a.mission.text) + '</div><div class="prose"><h2>' + esc(a.vision.title) + '</h2>' + paras(a.vision.text) + '</div></div>');
    if (a.values.items.length) h += sec(head(a.values.title) + '<div class="reasons">' + a.values.items.map((i) => '<div class="reason"><h3>' + esc(i.title) + '</h3><p>' + esc(i.text) + '</p></div>').join('') + '</div>');
    const p = a.principal, s = S.school;
    h += sec('<div class="principal"><figure style="margin:0">' + (p.image ? '<img src="' + attrUrl(img(p.image, 700)) + '" alt="' + esc(s.principalName) + '" loading="lazy">' : '<div class="ph">' + I('users', 56) + '</div>') + '</figure><div class="prose"><h2>' + esc(p.title) + '</h2><hr class="rule">' + paras(p.message) + '<p class="sign">' + esc(s.principalName) + '</p><p class="role">' + esc(s.principalTitle) + '</p></div></div>');
    h += sec(split(a.philosophy.title, a.philosophy.text, a.philosophy.image, { flip: true }));
    return h + ctaBand();
  }

  function ctaBand() {
    const a = S.home.admissionCta;
    return (
      '<section class="cta-split reveal"><div class="cta-panel primary cta-solo"><h2>' + esc(a.title) + '</h2><p>' + esc(a.text) + '</p><div class="btn-row">' +
      (S.admissions.enabled ? btn('/admissions#apply', a.buttonText, 'btn-accent') : btn('/contact', 'Contact the school', 'btn-accent')) + waBtn('admission', 'admission', 'Ask on WhatsApp') + '</div></div></section>'
    );
  }

  /* ---------- Academics ---------- */
  function academicsPage() {
    const a = S.academics;
    alt = false;
    let h = banner('Academics', a.intro.text, a.bannerImage);
    h += sec(head(a.intro.title) + a.levels.map((l) => '<article class="level"><div class="level-media">' + media(l.image, 'book', 900) + '</div><div class="prose"><h2>' + esc(l.title) + '</h2>' + (l.ages ? '<p class="card-meta">' + esc(l.ages) + '</p>' : '') + '<hr class="rule">' + paras(l.text) + '</div></article>').join(''));
    h += sec(head(a.subjects.title, a.subjects.intro) + '<div class="subjects">' + a.subjects.items.map((i) => '<div class="reason">' + I(i.icon, 30) + '<h3>' + esc(i.title) + '</h3><p>' + esc(i.text) + '</p></div>').join('') + '</div>');
    return h + ctaBand();
  }

  /* ---------- Facilities ---------- */
  function facilitiesPage() {
    const f = S.facilities;
    alt = false;
    let h = banner('Facilities', f.intro.text, f.bannerImage);
    h += sec(head(f.intro.title) + '<div class="tiles">' + f.items.map((i) => '<article class="tile">' + media(i.image, i.icon || 'building', 800) + '<div class="tile-body"><h3>' + esc(i.title) + '</h3><p>' + esc(i.text) + '</p></div></article>').join('') + '</div>');
    return h + ctaBand();
  }

  /* ---------- Gallery ---------- */
  function galleryPage(images) {
    const g = S.gallery;
    alt = false;
    const present = [...new Set(images.map((i) => i.category))];
    const cats = g.categories.filter((c) => present.includes(c)).concat(present.filter((c) => !g.categories.includes(c)));
    let h = banner('Gallery', g.intro, g.bannerImage);
    if (!images.length) return h + sec('<div class="empty">Photos will appear here soon.</div>');
    h += sec(
      (cats.length > 1 ? '<div class="filters" role="group" aria-label="Filter photos by category"><button class="filter" type="button" data-cat="" aria-pressed="true">All</button>' + cats.map((c) => '<button class="filter" type="button" data-cat="' + esc(c) + '" aria-pressed="false">' + esc(c) + '</button>').join('') + '</div>' : '') +
      '<div class="masonry" id="masonry"></div>'
    );
    return h;
  }

  function wireGallery(images) {
    const box = document.getElementById('masonry');
    if (!box) return;
    let list = images;
    const draw = () => {
      box.innerHTML = list.map((x, n) => '<button class="m" type="button" data-lb="' + n + '" aria-label="Open photo' + (x.title ? ': ' + esc(x.title) : '') + '"><img src="' + attrUrl(img(x.url, 800)) + '" alt="' + esc(x.title) + '" loading="lazy" decoding="async">' + (x.title ? '<span class="cap">' + esc(x.title) + '</span>' : '') + '</button>').join('');
    };
    draw();
    bindLightbox(box, () => list);
    document.querySelectorAll('.filter').forEach((b) =>
      b.addEventListener('click', () => {
        document.querySelectorAll('.filter').forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
        list = b.dataset.cat ? images.filter((i) => i.category === b.dataset.cat) : images;
        draw();
      })
    );
  }

  /* Lightbox */
  let lb = null, lbList = [], lbIndex = 0, lbOpener = null;
  function ensureLightbox() {
    if (lb) return;
    lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', 'Photo viewer');
    lb.innerHTML = '<button class="lb-btn lb-close" type="button" aria-label="Close">' + I('x') + '</button><button class="lb-btn lb-prev" type="button" aria-label="Previous photo">' + I('chevron') + '</button><figure><img alt=""><figcaption></figcaption></figure><button class="lb-btn lb-next" type="button" aria-label="Next photo">' + I('chevron') + '</button>';
    document.body.appendChild(lb);
    lb.querySelector('.lb-close').addEventListener('click', closeLb);
    lb.querySelector('.lb-prev').addEventListener('click', () => stepLb(-1));
    lb.querySelector('.lb-next').addEventListener('click', () => stepLb(1));
    lb.addEventListener('click', (e) => { if (e.target === lb) closeLb(); });
    document.addEventListener('keydown', (e) => {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'Escape') closeLb();
      if (e.key === 'ArrowLeft') stepLb(-1);
      if (e.key === 'ArrowRight') stepLb(1);
    });
  }
  function showLb() {
    const x = lbList[lbIndex];
    lb.querySelector('img').src = img(x.url, 1800);
    lb.querySelector('img').alt = x.title || '';
    lb.querySelector('figcaption').textContent = x.title || '';
    const multi = lbList.length > 1;
    lb.querySelector('.lb-prev').style.display = multi ? '' : 'none';
    lb.querySelector('.lb-next').style.display = multi ? '' : 'none';
  }
  function stepLb(d) { lbIndex = (lbIndex + d + lbList.length) % lbList.length; showLb(); }
  function closeLb() { lb.classList.remove('open'); document.body.style.overflow = ''; if (lbOpener) lbOpener.focus(); }
  function bindLightbox(root, getList) {
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-lb]');
      if (!b) return;
      ensureLightbox();
      lbList = getList();
      lbIndex = Number(b.dataset.lb);
      lbOpener = b;
      showLb();
      lb.classList.add('open');
      document.body.style.overflow = 'hidden';
      lb.querySelector('.lb-close').focus();
    });
  }

  /* ---------- Forms ---------- */
  function fieldHtml(f, classes) {
    const id = 'f_' + f.key;
    const req = f.required ? ' required' : '';
    let input;
    if (f.type === 'textarea') input = '<textarea id="' + id + '" name="' + esc(f.key) + '"' + req + '></textarea>';
    else if (f.type === 'select' || f.type === 'class') {
      const opts = f.type === 'class' ? classes : f.options;
      input = '<select id="' + id + '" name="' + esc(f.key) + '"' + req + '><option value="">Select…</option>' + opts.map((o) => '<option>' + esc(o) + '</option>').join('') + '</select>';
    } else {
      const t = { email: 'email', tel: 'tel', date: 'date', number: 'number' }[f.type] || 'text';
      input = '<input id="' + id + '" name="' + esc(f.key) + '" type="' + t + '"' + req + (f.type === 'tel' ? ' autocomplete="tel"' : '') + (f.type === 'email' ? ' autocomplete="email"' : '') + '>';
    }
    return '<div class="field' + (f.type === 'textarea' ? ' full' : '') + '" data-key="' + esc(f.key) + '"><label for="' + id + '">' + esc(f.label) + (f.required ? '<span class="req" aria-hidden="true">*</span>' : '') + '</label>' + input + '<div class="err" role="alert"></div></div>';
  }

  function wireForm(form, url, buildBody, onSuccess) {
    const status = form.querySelector('.form-status');
    const submit = form.querySelector('button[type=submit]');
    const setErr = (key, msg) => {
      const f = form.querySelector('.field[data-key="' + key + '"]');
      if (!f) return;
      f.classList.toggle('invalid', !!msg);
      f.querySelector('.err').textContent = msg || '';
    };
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      status.hidden = true;
      form.querySelectorAll('.field').forEach((f) => setErr(f.dataset.key, ''));
      let first = null;
      form.querySelectorAll('.field').forEach((f) => {
        const el = f.querySelector('input,select,textarea');
        if (el.required && !el.value.trim()) { setErr(f.dataset.key, 'This field is required.'); first = first || el; }
        else if (el.type === 'email' && el.value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(el.value)) { setErr(f.dataset.key, 'Enter a valid email address.'); first = first || el; }
      });
      if (first) return first.focus();
      submit.disabled = true;
      const label = submit.textContent;
      submit.textContent = 'Sending…';
      try {
        const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(buildBody(form)) });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          if (data.fields) {
            let firstKey = null;
            Object.keys(data.fields).forEach((k) => { setErr(k, data.fields[k]); firstKey = firstKey || k; });
            const el = firstKey && form.querySelector('.field[data-key="' + firstKey + '"] input,.field[data-key="' + firstKey + '"] select,.field[data-key="' + firstKey + '"] textarea');
            if (el) el.focus();
          }
          throw new Error(data.error || 'Something went wrong. Please try again.');
        }
        onSuccess(data);
      } catch (err) {
        status.textContent = err.message;
        status.hidden = false;
      } finally {
        submit.disabled = false;
        submit.textContent = label;
      }
    });
  }

  /* ---------- Admissions ---------- */
  function admissionsPage() {
    const a = S.admissions;
    alt = false;
    let h = banner('Admissions', a.intro.text, a.bannerImage);
    h += sec(head(a.intro.title) + '<h3>' + esc('How to apply') + '</h3><ol class="steps">' + a.process.map((p) => '<li><h3>' + esc(p.title) + '</h3><p>' + esc(p.text) + '</p></li>').join('') + '</ol>');
    h += sec(
      '<div class="duo"><div><h2>Classes available</h2><ul class="checklist">' + a.classes.map((c) => '<li>' + I('check', 20) + '<span>' + esc(c) + '</span></li>').join('') + '</ul></div>' +
      '<div><h2>What you will need</h2><ul class="checklist">' + a.requirements.map((c) => '<li>' + I('check', 20) + '<span>' + esc(c) + '</span></li>').join('') + '</ul></div></div>'
    );
    if (a.importantInfo || a.instructions)
      h += sec('<div class="duo">' + (a.instructions ? '<div class="prose"><h2>Application instructions</h2>' + paras(a.instructions) + '</div>' : '<div></div>') + (a.importantInfo ? '<div class="notice-box prose"><h3>Important information</h3>' + paras(a.importantInfo) + '</div>' : '') + '</div>');
    if (a.faqs.length) h += sec(head('Frequently asked questions') + '<div class="faq">' + a.faqs.map((f) => '<details><summary>' + esc(f.q) + '</summary><div class="answer">' + paras(f.a) + '</div></details>').join('') + '</div>');
    h += sec(
      head(a.formTitle) +
      (a.enabled
        ? '<div id="formHost"><form class="form" id="admForm" novalidate><div class="form-grid">' + a.fields.map((f) => fieldHtml(f, a.classes)).join('') + '</div><div class="hp" aria-hidden="true"><label>Leave this empty<input name="hp" tabindex="-1" autocomplete="off"></label></div><div class="form-status error" role="alert" hidden></div><div class="btn-row"><button class="btn btn-primary" type="submit">Submit application</button>' + waBtn('admission', 'admission', 'Ask on WhatsApp first') + '</div></form></div>'
        : '<div class="notice-box"><p>' + esc(a.closedMessage) + '</p></div><p style="margin-top:20px" class="btn-row"><a class="btn btn-primary" href="/contact">Contact the school</a>' + waBtn('admission', 'admission', 'Ask on WhatsApp') + '</p>'),
      { id: 'apply' }
    );
    return h;
  }
  function wireAdmissions() {
    const form = document.getElementById('admForm');
    if (!form) return;
    wireForm(
      form,
      '/api/public/admissions',
      (f) => {
        const answers = {};
        S.admissions.fields.forEach((fl) => { const el = f.querySelector('[name="' + fl.key + '"]'); answers[fl.key] = el ? el.value : ''; });
        return { answers, hp: f.elements.hp.value };
      },
      (data) => {
        document.getElementById('formHost').innerHTML = '<div class="success-panel" tabindex="-1"><h3>Application received</h3><p>' + esc(data.message) + '</p>' + (data.ref ? '<p class="muted">Your reference: <strong>' + esc(data.ref) + '</strong></p>' : '') + '</div>';
        const p = document.querySelector('.success-panel');
        p.focus();
        p.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    );
  }

  /* ---------- Contact ---------- */
  function contactPage() {
    const c = S.contact;
    alt = false;
    const rows = [];
    if (c.address) rows.push('<li>' + I('pin') + '<div><h3>Address</h3><p>' + esc(c.address) + '</p></div></li>');
    if (c.phone) rows.push('<li>' + I('phone') + '<div><h3>Phone</h3><p><a href="' + telHref(c.phone) + '">' + esc(c.phone) + '</a></p></div></li>');
    const wa = waUrl('contact', 'contact');
    if (wa) rows.push('<li>' + I('whatsapp') + '<div><h3>WhatsApp</h3><p><a href="' + esc(wa) + '" target="_blank" rel="noopener noreferrer">Message us on WhatsApp</a></p></div></li>');
    if (c.email) rows.push('<li>' + I('mail') + '<div><h3>Email</h3><p><a href="mailto:' + attrUrl(c.email) + '">' + esc(c.email) + '</a></p></div></li>');
    if (c.openingHours) rows.push('<li>' + I('clock') + '<div><h3>Opening hours</h3><p class="pre">' + esc(c.openingHours) + '</p></div></li>');
    if (c.emergencyContact) rows.push('<li>' + I('phone') + '<div><h3>Emergency contact</h3><p><a href="' + telHref(c.emergencyContact) + '">' + esc(c.emergencyContact) + '</a></p></div></li>');

    const q = c.mapQuery;
    const isEmbed = /^https:\/\//i.test(q);
    const mapSrc = q ? (isEmbed ? q : 'https://maps.google.com/maps?q=' + encodeURIComponent(q) + '&output=embed') : '';
    const dest = !q || isEmbed ? c.address : q;
    const directions = dest ? 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(dest) : '';

    let h = banner('Contact us', c.intro, c.bannerImage);
    h += sec(
      '<div class="contact-grid"><div><h2>Get in touch</h2><hr class="rule"><ul class="info-list">' + rows.join('') + '</ul>' +
      '<div class="btn-row" style="margin-top:24px">' + (directions ? '<a class="btn btn-primary" href="' + esc(directions) + '" target="_blank" rel="noopener noreferrer">Get directions</a>' : '') + waBtn('contact', 'visit', 'Book a visit') + '</div></div>' +
      '<div><h2>Send us a message</h2><hr class="rule"><form class="form" id="contactForm" novalidate>' +
      '<div class="form-grid">' +
      '<div class="field" data-key="name"><label for="c_name">Your name<span class="req" aria-hidden="true">*</span></label><input id="c_name" name="name" required autocomplete="name"><div class="err" role="alert"></div></div>' +
      '<div class="field" data-key="phone"><label for="c_phone">Phone</label><input id="c_phone" name="phone" type="tel" autocomplete="tel"><div class="err" role="alert"></div></div>' +
      '<div class="field full" data-key="email"><label for="c_email">Email<span class="req" aria-hidden="true">*</span></label><input id="c_email" name="email" type="email" required autocomplete="email"><div class="err" role="alert"></div></div>' +
      '<div class="field full" data-key="message"><label for="c_msg">Message<span class="req" aria-hidden="true">*</span></label><textarea id="c_msg" name="message" required></textarea><div class="err" role="alert"></div></div></div>' +
      '<div class="hp" aria-hidden="true"><label>Leave this empty<input name="hp" tabindex="-1" autocomplete="off"></label></div><div class="form-status error" role="alert" hidden></div>' +
      '<div><button class="btn btn-primary" type="submit">Send message</button></div></form></div></div>' +
      (mapSrc ? '<div class="map"><iframe title="Map showing the school location" src="' + esc(mapSrc) + '" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe></div>' : '')
    );
    return h;
  }
  function wireContact() {
    const form = document.getElementById('contactForm');
    if (!form) return;
    wireForm(
      form,
      '/api/public/contact',
      (f) => ({ name: f.elements.name.value, email: f.elements.email.value, phone: f.elements.phone.value, message: f.elements.message.value, hp: f.elements.hp.value }),
      (data) => {
        form.outerHTML = '<div class="success-panel" tabindex="-1"><h3>Message sent</h3><p>' + esc(data.message) + '</p></div>';
        document.querySelector('.success-panel').focus();
      }
    );
  }

  /* ---------- boot ---------- */
  function applyBackgrounds() {
    document.querySelectorAll('[data-bg]').forEach((el) => { el.style.backgroundImage = 'url("' + el.dataset.bg.replace(/"/g, '%22') + '")'; });
  }
  function reveal() {
    const els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) return els.forEach((e) => e.classList.add('in'));
    const io = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    els.forEach((e) => io.observe(e));
  }
  function setMeta() {
    const s = S.school;
    const titles = { home: s.websiteTitle || s.name, about: 'About us', academics: 'Academics', facilities: 'Facilities', gallery: 'Gallery', admissions: 'Admissions', contact: 'Contact' };
    document.title = page === 'home' ? titles.home : titles[page] + ' | ' + s.name;
    let d = document.querySelector('meta[name=description]');
    if (!d) { d = document.createElement('meta'); d.name = 'description'; document.head.appendChild(d); }
    d.content = s.description || s.tagline || '';
    if (s.favicon) {
      let l = document.querySelector('link[rel~=icon]');
      if (!l) { l = document.createElement('link'); l.rel = 'icon'; document.head.appendChild(l); }
      l.href = img(s.favicon, 96);
    }
  }

  async function boot() {
    try {
      const data = await getJSON('/api/public/site');
      S = data.settings;
      ANN = data.announcements || [];
      Theme.apply(S.appearance);
      setMeta();

      let gallery = [];
      if (page === 'gallery') gallery = (await getJSON('/api/public/gallery')).images;
      else if (page === 'home' && S.home.gallery.enabled) gallery = (await getJSON('/api/public/gallery?limit=5')).images;

      let main = '';
      if (page === 'home') main = homeSections(gallery);
      else if (page === 'about') main = aboutPage();
      else if (page === 'academics') main = academicsPage();
      else if (page === 'facilities') main = facilitiesPage();
      else if (page === 'gallery') main = galleryPage(gallery);
      else if (page === 'admissions') main = admissionsPage();
      else if (page === 'contact') main = contactPage();

      app.innerHTML = '<a class="skip" href="#main">Skip to content</a>' + header() + '<main id="main">' + main + '</main>' + footer() + floatingWa();
      applyBackgrounds();

      const toggle = app.querySelector('.nav-toggle');
      toggle.addEventListener('click', () => {
        const open = document.body.classList.toggle('nav-open');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      });
      app.querySelectorAll('.nav a').forEach((a) => a.addEventListener('click', () => document.body.classList.remove('nav-open')));

      if (page === 'home') bindLightbox(app.querySelector('.gallery-grid') || document.body, () => gallery);
      if (page === 'gallery') wireGallery(gallery);
      if (page === 'admissions') wireAdmissions();
      if (page === 'contact') wireContact();
      reveal();

      if (location.hash) {
        const t = document.getElementById(location.hash.slice(1));
        if (t) setTimeout(() => t.scrollIntoView(), 50);
      }
    } catch (err) {
      console.error(err);
      app.innerHTML = '<div class="error-state"><h1>We couldn’t load this page</h1><p>Please check your connection and refresh. If the problem continues, try again in a few minutes.</p></div>';
    }
  }

  boot();
})();
