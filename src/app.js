// Sổ Thu Chi: the whole app. Everything the user writes lives in one object, D, saved on this phone.
// (Step 2 will sync D with Google; until then load() and save() are the only places that touch storage.)
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sfx = (n, o) => { if (window.SFX) SFX.play(n, o); };

  // category colors: [light, base]. The badge uses both, the pie chart uses the base.
  const COLORS = [
    ['#ffc978', '#f5a742'], ['#7fe6d1', '#2fc4a8'], ['#f6a8de', '#e879c9'], ['#94bfff', '#5b9bf5'],
    ['#b0e58a', '#7fce4f'], ['#ff9d92', '#f2695c'], ['#cdbcff', '#a78bfa'], ['#f8e68a', '#f0d54a'],
    ['#93e5f7', '#4fd1ee'], ['#fbbdd0', '#f590ae'], ['#d6e382', '#b7c94a'], ['#e0c5a3', '#c9a57a'],
  ];
  const WD = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  const svg = (p, s = 22, w = 2) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const IC = {
    left: svg('<path d="M15 5l-7 7 7 7"/>'),
    right: svg('<path d="M9 5l7 7-7 7"/>'),
    close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
    trash: svg('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5"/>'),
    up: svg('<path d="M12 19V5M6 11l6-6 6 6"/>', 16, 2.4),
    down: svg('<path d="M12 5v14M6 13l6 6 6-6"/>', 16, 2.4),
    cal: svg('<rect x="4" y="5.5" width="16" height="15" rx="3"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>', 20),
    del: svg('<path d="M9 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6-7z"/><path d="M12 10l4 4M16 10l-4 4"/>', 26),
    gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>', 22, 1.7),
  };

  /* ---------- small helpers ---------- */
  const pad2 = n => String(n).padStart(2, '0');
  const dkey = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const today = () => dkey(new Date());
  const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dkey(d); };
  const parse = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const money = n => String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const vnd = n => (n < 0 ? '−' : '') + money(n) + ' đ';
  const short = n => (Math.abs(n) >= 1e8 ? (Math.abs(n) / 1e6).toFixed(1).replace('.', ',') + ' tr' : money(n));
  const pct = p => (p < 1 ? '<1%' : p < 10 ? p.toFixed(1).replace('.', ',') + '%' : Math.round(p) + '%');
  const lenCls = (s, a, b) => (s.length > b ? ' xlong' : s.length > a ? ' long' : '');
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const lower = s => s.toLocaleLowerCase('vi');
  function dayLabel(k) {
    const d = parse(k), date = `${d.getDate()}/${d.getMonth() + 1}`;
    return k === today() ? ['Hôm nay', date] : k === yesterday() ? ['Hôm qua', date] : [WD[d.getDay()], date];
  }
  function dayShort(k) {
    if (k === today()) return 'Hôm nay';
    if (k === yesterday()) return 'Hôm qua';
    const d = parse(k);
    return `${WD[d.getDay()]}, ${d.getDate()}/${d.getMonth() + 1}` + (d.getFullYear() !== new Date().getFullYear() ? '/' + d.getFullYear() : '');
  }

  /* ---------- data ---------- */
  const DEMO = location.hash === '#demo'; // sample numbers for looking at the design; never saved
  const C = window.Cloud || { enabled: false };
  const CLOUD = !DEMO && C.enabled; // connected to Firebase: signing in with Google is required
  const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { } };
  const lsDel = k => { try { localStorage.removeItem(k); } catch { } };
  let KEY = 'stc.data'; // becomes stc.data.<account> once someone is signed in
  let stale = false;    // the book changed and the page behind a sheet needs redrawing
  // The first categories have fixed ids, so a fresh install and the copy in the account are the same ones.
  function seed() {
    const mk = (id, name, type, color) => ({ id, name, type, color, hidden: false, ts: 0, u: 0 });
    return {
      v: 2, tx: [], del: {}, delCats: {}, dirty: {}, synced: 0,
      cats: [mk('c1', 'Đồ ăn', 'chi', 0), mk('c2', 'Đi chợ', 'chi', 4), mk('c3', 'Điện nước', 'chi', 3), mk('c4', 'Đi lại', 'chi', 6), mk('c5', 'Sức khỏe', 'chi', 5), mk('c6', 'Tiền làm nụ', 'thu', 1), mk('c7', 'Lương', 'thu', 7)],
    };
  }
  function demo() {
    const d = seed(), id = n => d.cats.find(c => c.name === n).id;
    d.cats.push({ id: uid(), name: 'Mua sắm', type: 'chi', color: 2, hidden: false, ts: Date.now() }, { id: uid(), name: 'Hiếu hỉ', type: 'chi', color: 9, hidden: false, ts: Date.now() });
    const r = (a, b) => Math.round((a + Math.random() * (b - a)) / 1000) * 1000;
    const plan = [['Đồ ăn', .7, 30e3, 120e3], ['Đi chợ', .5, 80e3, 350e3], ['Đi lại', .3, 20e3, 60e3], ['Sức khỏe', .06, 100e3, 600e3], ['Mua sắm', .08, 150e3, 900e3], ['Hiếu hỉ', .04, 200e3, 500e3], ['Tiền làm nụ', .6, 200e3, 450e3]];
    for (let back = 260; back >= 0; back--) {
      const day = new Date(); day.setDate(day.getDate() - back);
      const add = (name, amt, note = '') => d.tx.push({ id: uid(), cat: id(name), amt, date: dkey(day), note, ts: day.getTime() - back * 1000 + d.tx.length });
      if (day.getDate() === 1) add('Lương', 6500e3);
      if (day.getDate() === 5) add('Điện nước', r(450e3, 900e3), 'Tiền điện và nước');
      for (const [name, p, a, b] of plan) if (Math.random() < p) add(name, r(a, b));
    }
    return d;
  }
  function load(key) {
    try {
      const d = JSON.parse(localStorage.getItem(key));
      if (d && Array.isArray(d.cats) && Array.isArray(d.tx)) return Object.assign({ del: {}, delCats: {}, dirty: {}, synced: 0 }, d);
    } catch { }
    return null;
  }
  function store() {
    if (DEMO) return;
    try { localStorage.setItem(KEY, JSON.stringify(D)); } catch { toast('Máy đã đầy, chưa lưu được.'); }
  }
  function save() { stale = true; store(); pushSoon(); }
  let D = DEMO ? demo() : load(KEY) || seed();

  // Every change gets a time (so the newer one wins when two copies meet) and marks its part of the book
  // as waiting to be backed up: 'meta' for categories, 'm-2026-11' for a month.
  let seq = Date.now();
  const mark = key => { D.dirty[key] = ++seq; };
  const markTx = t => { t.u = Date.now(); mark('m-' + t.date.slice(0, 7)); };
  const markCat = c => { c.u = Date.now(); mark('meta'); };
  function dropTx(t) { const m = t.date.slice(0, 7); (D.del[m] = D.del[m] || {})[t.id] = Date.now(); mark('m-' + m); }
  function undropTx(t) { const m = t.date.slice(0, 7); if (D.del[m]) delete D.del[m][t.id]; markTx(t); }

  const GHOST = { id: '?', name: 'Mục đã xóa', type: 'chi', color: 11, hidden: true };
  const cat = id => D.cats.find(c => c.id === id) || GHOST;
  const typeOf = t => cat(t.cat).type;
  // how often each category was used, and the amount written last time
  function usage() {
    const m = new Map();
    for (const t of D.tx) {
      const u = m.get(t.cat) || { n: 0, last: 0, ts: -1 };
      u.n++; if (t.ts >= u.ts) { u.ts = t.ts; u.last = t.amt; }
      m.set(t.cat, u);
    }
    return m;
  }
  function nextColor() {
    const n = COLORS.map(() => 0);
    for (const c of D.cats) if (!c.hidden) n[c.color]++;
    return n.indexOf(Math.min(...n));
  }
  const badge = (c, sm) => `<i class="cbadge${sm ? ' sm' : ''}" style="--c1:${COLORS[c.color][0]};--c2:${COLORS[c.color][1]}">${esc((c.name.trim()[0] || '?').toUpperCase())}</i>`;
  function sums(list) {
    let thu = 0, chi = 0;
    for (const t of list) { if (typeOf(t) === 'thu') thu += t.amt; else chi += t.amt; }
    return { thu, chi, left: thu - chi };
  }
  function byCat(list, type) {
    const m = new Map();
    for (const t of list) {
      if (typeOf(t) !== type) continue;
      const e = m.get(t.cat) || { cat: cat(t.cat), total: 0, n: 0 };
      e.total += t.amt; e.n++; m.set(t.cat, e);
    }
    return [...m.values()].sort((a, b) => b.total - a.total);
  }
  const newest = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.ts - a.ts);

  /* ---------- what is on screen ---------- */
  let tab = 'so', tkMode = 'thang', tkType = 'chi', sel = null, fresh = null, shown = null, PIE = null;
  const cur = () => { const n = new Date(); return { y: n.getFullYear(), m: n.getMonth() }; };
  let ym = cur();
  const mkey = p => `${p.y}-${pad2(p.m + 1)}`;
  const isCur = () => mkey(ym) === mkey(cur());
  const inMonth = p => D.tx.filter(t => t.date.startsWith(mkey(p)));
  const inYear = y => D.tx.filter(t => t.date.startsWith(y + '-'));
  const yearMode = () => tab === 'tk' && tkMode === 'nam';
  const period = () => (yearMode() ? inYear(ym.y) : inMonth(ym));

  function monthbar() {
    const year = yearMode(), c = cur();
    const end = year ? ym.y >= c.y : mkey(ym) >= mkey(c);
    return `<div class="monthbar">
      <h1 class="mlabel">${year ? 'Năm ' + ym.y : `Tháng ${ym.m + 1}<small>${ym.y}</small>`}</h1>
      <button class="iconbtn" data-act="prev" aria-label="${year ? 'Năm trước' : 'Tháng trước'}">${IC.left}</button>
      <button class="iconbtn" data-act="next" aria-label="${year ? 'Năm sau' : 'Tháng sau'}"${end ? ' disabled' : ''}>${IC.right}</button>
      <button class="iconbtn" data-act="settings" aria-label="Cài đặt">${IC.gear}</button>
    </div>`;
  }
  const io = s => `<div class="io">
    <div class="io-i thu"><span>${IC.up}Thu</span><b class="num${lenCls(vnd(s.thu), 12, 99)}">${vnd(s.thu)}</b></div>
    <div class="io-i chi"><span>${IC.down}Chi</span><b class="num${lenCls(vnd(s.chi), 12, 99)}">${vnd(s.chi)}</b></div>
  </div>`;

  /* ---------- tab: Sổ ---------- */
  function viewSo() {
    const list = inMonth(ym).sort(newest), s = sums(list), big = vnd(s.left);
    let h = `<section class="hero card${s.left < 0 ? ' neg' : ''}" style="--i:0">
      <p class="eyebrow">${s.left < 0 ? 'Chi nhiều hơn thu' : isCur() ? 'Còn lại tháng này' : 'Còn lại trong tháng'}</p>
      <p class="bignum num${lenCls(big, 11, 14)}" id="bignum" data-n="${s.left}">${big}</p>${io(s)}
    </section>`;
    if (!list.length) {
      return h + `<section class="blank card" style="--i:1"><b>Chưa có khoản nào</b><p>${isCur() ? 'Bấm nút + ở dưới để ghi khoản đầu tiên.' : 'Tháng này không có khoản nào được ghi.'}</p></section>`;
    }
    const days = new Map();
    for (const t of list) { if (!days.has(t.date)) days.set(t.date, []); days.get(t.date).push(t); }
    let i = 1;
    for (const [k, items] of days) {
      const [main, sub] = dayLabel(k), d = sums(items);
      const tot = [d.thu ? '+' + money(d.thu) : '', d.chi ? '−' + money(d.chi) : ''].filter(Boolean).join(' · ');
      h += `<section class="group card" style="--i:${i++}"><header><b>${main}</b><span>${sub}</span><em class="num">${tot}</em></header>${items.map(txRow).join('')}</section>`;
    }
    return h;
  }
  function txRow(t) {
    const c = cat(t.cat);
    return `<button class="tx${t.id === fresh ? ' fresh' : ''}" data-act="edit" data-id="${t.id}">${badge(c)}
      <span class="grow"><b class="nm">${esc(c.name)}</b>${t.note ? `<small>${esc(t.note)}</small>` : ''}</span>
      <span class="am num ${c.type}">${c.type === 'thu' ? '+' : '−'}${money(t.amt)} đ</span></button>`;
  }

  /* ---------- tab: Thống kê ---------- */
  const seg = (id, act, v, a, b) => `<div class="segctl" id="${id}" data-v="${v === a[0] ? 'a' : 'b'}">
    <button data-act="${act}" data-v="${a[0]}" class="${v === a[0] ? 'on' : ''}">${a[1]}</button>
    <button data-act="${act}" data-v="${b[0]}" class="${v === b[0] ? 'on' : ''}">${b[1]}</button></div>`;
  function setSeg(id, v, first) {
    const el = $('#' + id); if (!el) return;
    el.dataset.v = v === first ? 'a' : 'b';
    $$('button', el).forEach(b => b.classList.toggle('on', b.dataset.v === v));
  }
  function viewTk() {
    const year = yearMode(), list = period(), s = sums(list), left = vnd(s.left);
    let h = `<section class="kpi card" style="--i:0"><div class="kpi-top"><span class="eyebrow">Còn lại</span><b class="num${s.left < 0 ? ' neg' : ''}${lenCls(left, 13, 99)}">${left}</b></div>${io(s)}</section>`;
    if (year) h += yearCard();
    return h + `<section class="piecard card" style="--i:${year ? 2 : 1}">${seg('seg-type', 'tktype', tkType, ['chi', 'Tiền chi'], ['thu', 'Tiền thu'])}<div id="piebox">${pieBox(list)}</div></section>`;
  }
  function pieBox(list) {
    const items = byCat(list, tkType), total = items.reduce((a, e) => a + e.total, 0);
    PIE = { items, total };
    if (!items.length) return `<p class="none">Chưa có khoản ${tkType} nào trong ${yearMode() ? 'năm' : 'tháng'} này.</p>`;
    if (!items.some(e => e.cat.id === sel)) sel = null;
    let acc = 0;
    const gap = items.length > 1 ? .8 : 0;
    const slices = items.map(e => {
      const p = e.total / total * 100, len = Math.max(.5, p - gap);
      const c = `<circle class="sl${sel === e.cat.id ? ' on' : ''}" data-act="slice" data-id="${e.cat.id}" cx="100" cy="100" r="76" pathLength="100" stroke="${COLORS[e.cat.color][1]}" stroke-dasharray="${len.toFixed(3)} ${(100 - len).toFixed(3)}" stroke-dashoffset="${(-acc).toFixed(3)}"/>`;
      acc += p; return c;
    }).join('');
    const label = `Biểu đồ tròn tiền ${tkType}: ` + items.map(e => `${e.cat.name} ${pct(e.total / total * 100)}`).join(', ');
    return `<div class="piewrap">
      <svg class="pie${sel ? ' has-sel' : ''}" viewBox="0 0 200 200" role="img" aria-label="${esc(label)}">
        <defs><mask id="piemask" maskUnits="userSpaceOnUse" x="0" y="0" width="200" height="200"><circle class="sweep" cx="100" cy="100" r="76" fill="none" stroke="#fff" stroke-width="48" pathLength="100" stroke-dasharray="100 100"/></mask></defs>
        <circle cx="100" cy="100" r="76" fill="none" stroke="var(--surface-3)" stroke-width="30" opacity=".5"/>
        <g transform="rotate(-90 100 100)"><g mask="url(#piemask)">${slices}</g></g>
      </svg>
      <div class="piemid" id="piemid">${pieMid()}</div>
    </div>
    <div class="tbl">
      <div class="tbl-h"><span>Mục</span><span>Số tiền</span><span>%</span></div>
      ${items.map(e => `<button class="trow${sel === e.cat.id ? ' on' : ''}" data-act="catlist" data-id="${e.cat.id}">${badge(e.cat, true)}
        <span class="grow"><b class="nm">${esc(e.cat.name)}</b><small>${e.n} khoản</small></span>
        <span class="am num">${money(e.total)} đ</span><span class="pc num">${pct(e.total / total * 100)}</span></button>`).join('')}
      <div class="tbl-f"><span>Tổng ${tkType}</span><b class="num">${vnd(total)}</b><span class="num">100%</span></div>
    </div>`;
  }
  function pieMid() {
    const e = sel && PIE.items.find(x => x.cat.id === sel);
    const n = e ? e.total : PIE.total, s = Math.abs(n) >= 1e8 ? short(n) : vnd(n);
    return `<span>${e ? esc(e.cat.name) : 'Tổng ' + tkType}</span><b class="num${lenCls(s, 11, 99)}">${s}</b>${e ? `<em class="num">${pct(e.total / PIE.total * 100)}</em>` : ''}`;
  }
  function applySel() {
    const pie = $('.pie'); if (!pie) return;
    pie.classList.toggle('has-sel', !!sel);
    $$('.sl', pie).forEach(e => e.classList.toggle('on', e.dataset.id === sel));
    $$('.trow').forEach(e => e.classList.toggle('on', e.dataset.id === sel));
    $('#piemid').innerHTML = pieMid();
  }
  function yearCard() {
    const c = cur(), per = Array.from({ length: 12 }, (_, m) => sums(inMonth({ y: ym.y, m })));
    const max = Math.max(1, ...per.map(p => Math.max(p.thu, p.chi)));
    const ht = n => (n ? Math.max(3, n / max * 100).toFixed(1) : 0);
    const bars = per.map((p, m) => `<button class="ycol${ym.y === c.y && m === c.m ? ' cur' : ''}" data-act="gomonth" data-m="${m}" style="--i:${m}" aria-label="Tháng ${m + 1}: thu ${vnd(p.thu)}, chi ${vnd(p.chi)}">
      <span class="pair"><i class="${p.thu ? '' : 'zero'}" style="height:${ht(p.thu)}%"></i><i class="chi${p.chi ? '' : ' zero'}" style="height:${ht(p.chi)}%"></i></span>${m + 1}</button>`).join('');
    const rows = per.map((p, m) => (p.thu || p.chi ? `<button class="mrow" data-act="gomonth" data-m="${m}"><b>Tháng ${m + 1}</b><span class="am num ${p.left < 0 ? 'neg' : 'pos'}">${p.left < 0 ? '−' : '+'}${money(p.left)} đ</span><small class="num">Thu ${money(p.thu)}</small><small class="num">Chi ${money(p.chi)}</small></button>` : '')).join('');
    return `<section class="piecard card" style="--i:1"><p class="eyebrow">Từng tháng</p>
      <div class="legend"><span><i></i>Thu</span><span><i class="chi"></i>Chi</span></div>
      <div class="ybars">${bars}</div>
      ${rows ? `<div class="mtbl">${rows}</div>` : ''}
    </section>`;
  }

  /* ---------- drawing the page ---------- */
  function render(o = {}) {
    $('#view').innerHTML = `<div class="page${o.anim ? ' anim' : ''}"><div id="mb">${monthbar()}</div>
      ${tab === 'tk' ? seg('seg-mode', 'tkmode', tkMode, ['thang', 'Theo tháng'], ['nam', 'Cả năm']) : ''}
      <div id="main"></div></div>`;
    $$('.tab').forEach(b => { const on = b.dataset.v === tab; b.classList.toggle('on', on); b.setAttribute('aria-current', on ? 'page' : 'false'); });
    paint(o);
  }
  // redraw only the header and the content, so the sliding switches above keep their animation
  function paint(o = {}) {
    const main = $('#main');
    $('#mb').innerHTML = monthbar();
    main.className = 'swap';
    if (o.dir) { void main.offsetWidth; main.classList.add(o.dir > 0 ? 'fwd' : 'back'); }
    main.innerHTML = tab === 'so' ? viewSo() : viewTk();
    stale = false;
    const big = $('#bignum');
    if (big) countTo(big, +big.dataset.n);
    if (fresh) { const row = $('.tx.fresh'); if (row) row.scrollIntoView({ block: 'center', behavior: 'smooth' }); fresh = null; }
  }
  function countTo(el, to) {
    const from = shown == null ? to : shown; shown = to;
    if (from === to || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t0 = performance.now(), dur = 650;
    const step = now => {
      if (!el.isConnected) return;
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = vnd(Math.round((from + (to - from) * e) / 1000) * 1000);
      if (k < 1) requestAnimationFrame(step); else el.textContent = vnd(to);
    };
    requestAnimationFrame(step);
  }
  function shift(d) {
    const year = yearMode(), c = cur();
    const p = year ? { y: ym.y + d, m: ym.m } : { y: ym.y + Math.floor((ym.m + d) / 12), m: (ym.m + d + 12) % 12 };
    if (p.y < 2000 || (year ? p.y > c.y : mkey(p) > mkey(c))) return;
    if (mkey(p) > mkey(c)) p.m = c.m;
    ym = p; sel = null; sfx('tap'); paint({ dir: d });
    $('#view').scrollTop = 0;
  }

  /* ---------- layers (sheets). The phone's Back button closes the top one. ---------- */
  const stack = [];
  let quiet = false;
  function openLayer(html, onClose) {
    const el = document.createElement('div');
    el.className = 'layer'; el.innerHTML = html; el._close = onClose;
    $('#layers').appendChild(el); stack.push(el);
    history.pushState({ stc: stack.length }, '');
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
    setTimeout(() => el.classList.add('in'), 120); // in case no frame is drawn
    sfx('open');
    return el;
  }
  function closeLayer(silent) { if (!stack.length) return; quiet = !!silent; history.back(); }
  addEventListener('popstate', () => {
    const el = stack.pop(); if (!el) return;
    if (document.activeElement && el.contains(document.activeElement)) document.activeElement.blur();
    el.classList.remove('in'); el.classList.add('out');
    setTimeout(() => el.remove(), 340);
    if (!quiet) sfx('close'); quiet = false;
    if (el._close) el._close();
    if (CM && CM.el.isConnected) $('#cmlist', CM.el).innerHTML = cmList();
    if (stale) paint();
  });
  addEventListener('keydown', e => {
    if (e.key === 'Escape' && stack.length) closeLayer();
    if (e.key !== 'Enter' || !e.target.id) return;
    if (e.target.id === 'fname') ACT.savecat();
    else if (e.target.id === 'cmname') ACT.cmsave();
    else if (e.target.id === 'fnote') e.target.blur();
  });

  let toastT = 0, undoFn = null;
  function toast(msg, undo) {
    const el = $('#toast');
    undoFn = undo || null;
    el.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button data-act="undo">Hoàn tác</button>' : ''}`;
    el.classList.toggle('act', !!undo); el.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => { el.classList.remove('show', 'act'); undoFn = null; }, undo ? 6000 : 2600);
  }
  function shake(el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }

  /* ---------- Google account and backup ---------- */
  // The book on the phone is always the one the app works with. Backup runs behind it: a moment after each
  // change, when the app opens, and when the network comes back. D.dirty lists the parts still waiting.
  let user = null, syncing = false, syncT = 0, syncErr = false;
  const pending = () => Object.keys(D.dirty || {}).length;
  function absorb(parts) {
    const before = JSON.stringify([D.cats, D.tx]);
    C.apply(D, parts);
    if (JSON.stringify([D.cats, D.tx]) === before) return;
    stale = true;
    if (!stack.length && $('#main')) paint();
  }
  async function sync(full) {
    if (!CLOUD || !user || syncing) return;
    clearTimeout(syncT);
    if (!navigator.onLine) { syncErr = true; refreshAccount(); return; }
    syncing = true; refreshAccount();
    const snap = Object.assign({}, D.dirty);
    try {
      absorb(full ? await C.syncAll(D) : await C.pushKeys(D, Object.keys(snap)));
      for (const k in snap) if (D.dirty[k] === snap[k]) delete D.dirty[k]; // changed again meanwhile: keep waiting
      D.synced = Date.now(); syncErr = false; store();
    } catch (e) { syncErr = true; console.warn('Sao lưu chưa được:', e && (e.code || e.message)); }
    syncing = false; refreshAccount();
    if (pending()) syncT = setTimeout(() => sync(false), syncErr ? 30000 : 1500);
  }
  function pushSoon() { if (!CLOUD || !user) return; clearTimeout(syncT); syncT = setTimeout(() => sync(false), 1500); }
  addEventListener('online', () => sync(true));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (pending()) sync(false); }
    else if (Date.now() - (D.synced || 0) > 10 * 60e3) sync(true);
  });

  const GLOGO = '<svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';
  function gate(html, busy) {
    let g = $('#gate');
    if (g && g.classList.contains('out')) { g.remove(); g = null; } // still fading away from last time: start a new one
    if (!g) { g = document.createElement('div'); g.id = 'gate'; $('#app').appendChild(g); }
    g.className = busy ? 'busy' : '';
    g.innerHTML = `<div class="gate-in">${html}</div>`;
  }
  function showGate() {
    gate(`<svg class="gate-mark" width="84" height="84" viewBox="0 0 100 100" aria-hidden="true"><g fill="none" stroke-width="13" stroke-linecap="round" transform="rotate(-90 50 50)"><circle cx="50" cy="50" r="38" pathLength="100" stroke="#f5a742" stroke-dasharray="40 60"/><circle cx="50" cy="50" r="38" pathLength="100" stroke="#2fc4a8" stroke-dasharray="26 74" stroke-dashoffset="-47"/><circle cx="50" cy="50" r="38" pathLength="100" stroke="#e879c9" stroke-dasharray="14 86" stroke-dashoffset="-80"/></g></svg>
      <h1>Sổ Thu Chi</h1>
      <p>Đăng nhập một lần bằng tài khoản Google để sổ luôn được sao lưu. Đổi máy hay mất máy, sổ vẫn còn.</p>
      <button class="btn" data-act="signin">${GLOGO}Đăng nhập bằng Google</button>
      <p class="gate-err" id="gate-err" role="alert"></p>`);
  }
  function hideGate() { const g = $('#gate'); if (!g) return; g.classList.add('out'); setTimeout(() => g.remove(), 450); }
  const SIGNIN_ERR = {
    'auth/popup-closed-by-user': 'Chưa đăng nhập xong. Bấm lại để thử lần nữa.',
    'auth/cancelled-popup-request': 'Chưa đăng nhập xong. Bấm lại để thử lần nữa.',
    'auth/popup-blocked': 'Trình duyệt đã chặn cửa sổ đăng nhập. Hãy cho phép cửa sổ bật lên rồi bấm lại.',
    'auth/network-request-failed': 'Mạng đang yếu hoặc mất. Kiểm tra mạng rồi bấm lại.',
    'auth/unauthorized-domain': 'Địa chỉ trang này chưa được thêm vào mục Authorized domains trong Firebase.',
    'auth/operation-not-allowed': 'Đăng nhập bằng Google chưa được bật trong Firebase.',
  };
  // someone is signed in: open their book
  async function enter(u) {
    if (user && user.uid === u.uid) { user = u; return; }
    user = u;
    const key = 'stc.data.' + u.uid, had = load(key), shown = KEY === key && $('#main');
    KEY = key; lsSet('stc.uid', u.uid);
    if (had) { // this phone already holds the book: show it at once, back up behind
      if (!shown) { D = had; render({ anim: true }); }
      hideGate(); sync(true);
      return;
    }
    // first time on this phone: fetch the book before showing anything
    D = seed();
    const old = load('stc.data'); // written here before the app was connected to Google
    if (old && old.tx.length) { D = old; D.dirty = { meta: ++seq }; for (const t of D.tx) D.dirty['m-' + t.date.slice(0, 7)] = seq; lsDel('stc.data'); }
    gate('<div class="spin" aria-hidden="true"></div><p>Đang tải sổ từ tài khoản Google…</p>', true);
    await sync(true);
    store(); render({ anim: true }); hideGate();
    if (syncErr) toast('Chưa tải được sổ từ Google. Sẽ thử lại khi có mạng.');
  }
  function boot() {
    if (!CLOUD) { try { if (!DEMO && !localStorage.getItem(KEY)) store(); } catch { } render({ anim: true }); return; }
    const known = lsGet('stc.uid'), mine = known && load('stc.data.' + known);
    if (mine) { KEY = 'stc.data.' + known; D = mine; render({ anim: true }); } // opens at once, even with no network
    else showGate();
    C.onUser(u => {
      if (u) return enter(u);
      user = null; clearTimeout(syncT); lsDel('stc.uid');
      while (stack.length) { const el = stack.pop(); el.remove(); }
      $('#view').innerHTML = ''; // nobody is signed in: the book must not show through behind the sign-in screen
      showGate();
    });
  }
  const clock = ts => { const d = new Date(ts), hm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; return dkey(d) === today() ? hm : `${hm} ngày ${d.getDate()}/${d.getMonth() + 1}`; };
  function accountHTML() {
    if (!CLOUD || !user) return '';
    const st = syncing ? 'Đang sao lưu…'
      : pending() ? (navigator.onLine ? 'Có thay đổi đang chờ sao lưu' : 'Chưa có mạng. Sẽ sao lưu khi có mạng.')
        : D.synced ? 'Đã sao lưu lúc ' + clock(D.synced) : 'Chưa sao lưu';
    return `<p class="sec-label">Tài khoản Google</p>
      <div class="setrow"><span class="grow"><b class="acc-mail">${esc(user.email || user.name || 'Đã đăng nhập')}</b><small>${st}</small></span></div>
      <div class="stackbtns"><button class="btn ghost" data-act="syncnow"${syncing ? ' disabled' : ''}>Sao lưu ngay</button><button class="btn danger-ghost" data-act="signout">Đăng xuất</button></div>`;
  }
  function refreshAccount() { const el = $('#acc'); if (el) el.innerHTML = accountHTML(); }

  /* ---------- writing or changing an entry ---------- */
  // steps: 'cat' (pick a category) -> 'amt' (amount, date, note); 'name' adds a new category on the way
  let F = null;
  function openFlow(init) {
    F = Object.assign({ mode: 'new', id: null, type: 'chi', cat: null, amt: '', date: today(), note: '', step: 'cat' }, init);
    F.el = openLayer(`<div class="scrim" data-act="close"></div><div class="sheet tall flow"><div class="grab"></div><div class="flow-in"></div></div>`, () => { F = null; });
    drawFlow(0);
  }
  function drawFlow(d) {
    const box = $('.flow-in', F.el);
    box.className = 'flow-in';
    if (d) { void box.offsetWidth; box.classList.add(d > 0 ? 'fwd' : 'back'); }
    box.innerHTML = F.step === 'cat' ? flowCat() : F.step === 'name' ? flowName() : flowAmt();
    if (F.step === 'amt') showAmt();
    if (F.step === 'name') setTimeout(() => { const i = $('#fname'); if (i) i.focus(); }, 120);
  }
  function tiles() {
    const u = usage(), n = c => (u.get(c.id) || {}).n || 0;
    const list = D.cats.filter(c => c.type === F.type && !c.hidden).sort((a, b) => n(b) - n(a));
    return list.map((c, i) => {
      const last = (u.get(c.id) || {}).last;
      return `<button class="tile" data-act="pick" data-id="${c.id}" style="--i:${i}">${badge(c)}<span><b>${esc(c.name)}</b>${last ? `<small class="num">Lần trước ${money(last)} đ</small>` : ''}</span></button>`;
    }).join('') + `<button class="tile addcat" data-act="newcat" style="--i:${list.length}">+ Thêm mục</button>`;
  }
  const flowCat = () => `<div class="sh-head"><h2>${F.mode === 'edit' ? 'Đổi mục' : 'Ghi khoản mới'}</h2><button class="iconbtn" data-act="${F.mode === 'edit' ? 'fback' : 'close'}" aria-label="Đóng">${IC.close}</button></div>
    <div class="sheet-body">${seg('seg-ftype', 'ftype', F.type, ['chi', 'Tiền chi'], ['thu', 'Tiền thu'])}<div class="tiles" id="tiles">${tiles()}</div></div>`;
  const flowName = () => `<div class="sh-head"><button class="iconbtn" data-act="fback" aria-label="Quay lại">${IC.left}</button><h2>Thêm mục ${F.type}</h2></div>
    <div class="sheet-body"><input class="field" id="fname" maxlength="30" placeholder="Tên mục, ví dụ: Tiền học" autocomplete="off" enterkeyhint="done">
      <p class="hint">Gõ tên một lần. Những lần sau mục này có sẵn để chọn.</p></div>
    <div class="sheet-foot"><button class="btn" data-act="savecat">Lưu mục</button></div>`;
  function flowAmt() {
    const c = cat(F.cat), last = (usage().get(c.id) || {}).last;
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'del'];
    return `<div class="sh-head"><button class="iconbtn" data-act="fback" aria-label="Chọn mục khác">${IC.left}</button>
      <button class="catbtn" data-act="fback" aria-label="Mục ${esc(c.name)}, chạm để đổi">${badge(c, true)}<span>${esc(c.name)}</span></button>
      ${F.mode === 'edit' ? `<button class="iconbtn danger" data-act="del" aria-label="Xóa khoản này">${IC.trash}</button>` : ''}
      <button class="iconbtn" data-act="close" aria-label="Đóng">${IC.close}</button></div>
    <div class="sheet-body">
      <div class="amt zero" id="famt" aria-live="polite"><span class="num">0</span><i>đ</i></div>
      <div class="chips">${last && F.mode === 'new' ? `<button class="chip num" data-act="uselast">Lần trước: ${money(last)} đ</button>` : ''}
        <button class="chip" data-act="fdate" aria-label="Đổi ngày">${IC.cal}<span id="fdl">${dayShort(F.date)}</span></button>
        <input type="date" class="datein" id="fdate" value="${F.date}" max="${today()}" tabindex="-1" aria-hidden="true"></div>
      <input class="field" id="fnote" maxlength="60" placeholder="Ghi chú (không bắt buộc)" value="${esc(F.note)}" autocomplete="off" enterkeyhint="done">
    </div>
    <div class="pad">${keys.map(k => `<button class="key${k === '000' || k === 'del' ? ' soft' : ''}" data-act="key" data-k="${k}"${k === 'del' ? ' aria-label="Xóa một số"' : ''}>${k === 'del' ? IC.del : k}</button>`).join('')}</div>
    <div class="sheet-foot"><button class="btn" data-act="save" id="fsave" disabled>${F.mode === 'edit' ? 'Lưu thay đổi' : 'Xong'}</button></div>`;
  }
  function showAmt(bump) {
    const el = $('#famt'); if (!el) return;
    const n = +F.amt || 0, s = money(n);
    el.firstElementChild.textContent = s;
    el.className = 'amt' + (n ? '' : ' zero') + lenCls(s, 10, 13);
    if (bump) { void el.offsetWidth; el.classList.add('bump'); }
    $('#fsave').disabled = !n;
  }

  /* ---------- settings ---------- */
  const sw = (act, on, label) => `<button class="switch${on ? ' on' : ''}" data-act="${act}" role="switch" aria-checked="${on}" aria-label="${label}"></button>`;
  function settingsBody() {
    const sound = window.SFX && (SFX.on() || SFX.ambient());
    return `<p class="sec-label">Giao diện</p>
      <div class="thms">${FX.THEMES.map(t => `<button class="thm${FX.theme() === t.id ? ' on' : ''}" data-act="theme" data-id="${t.id}" style="--tb:${t.bg};--tg:${t.glow};--t1:${t.sw[0]};--t2:${t.sw[1]}"><i></i><b>${t.name}</b><small>${t.note}</small></button>`).join('')}</div>
      <p class="sec-label">Âm thanh và chuyển động</p>
      <div class="setrow"><span class="grow"><b>Âm thanh</b><small>Tiếng nền và tiếng bấm nút</small></span>${sw('sound', sound, 'Âm thanh')}</div>
      <div class="setrow"><b>Âm lượng</b><input type="range" id="vol" min="0" max="1" step="0.05" value="${window.SFX ? SFX.volume() : .45}" aria-label="Âm lượng"></div>
      <div class="setrow"><span class="grow"><b>Nền chuyển động</b><small>Tắt đi nếu máy bị chậm</small></span>${sw('motion', FX.motion(), 'Nền chuyển động')}</div>
      <p class="sec-label">Sổ</p>
      <button class="navrow" data-act="cats"><span class="grow">Các mục thu chi</span>${IC.right}</button>
      <div id="acc">${accountHTML()}</div>
      <p class="about">Sổ Thu Chi${DEMO ? ' · đang xem số liệu mẫu' : ''}</p>`;
  }
  let CM = null; // the category manager, while it is open
  function cmList() {
    const list = D.cats.filter(c => c.type === CM.type);
    const row = c => `<button class="catrow${c.hidden ? ' hid' : ''}" data-act="cmedit" data-id="${c.id}">${badge(c)}<span class="grow">${esc(c.name)}</span>${IC.right}</button>`;
    const hid = list.filter(c => c.hidden);
    return `<div>${list.filter(c => !c.hidden).map(row).join('') || '<p class="none">Chưa có mục nào.</p>'}</div>
      ${hid.length ? `<p class="sec-label">Đã ẩn</p><div>${hid.map(row).join('')}</div>` : ''}
      <p class="hint">Chạm vào một mục để đổi tên hoặc ẩn đi. Muốn thêm mục mới, bấm "+ Thêm mục" lúc ghi khoản.</p>`;
  }

  /* ---------- actions ---------- */
  const ACT = {
    tab(b) {
      const v = b.dataset.v; if (v === tab) return;
      tab = v; sel = null; sfx('tab');
      let done = false;
      const run = () => { if (done) return; done = true; render({ anim: true }); $('#view').scrollTop = 0; };
      if (!document.startViewTransition || document.hidden) return run();
      // the cross-fade waits for the next frame; if the screen is not drawing right now, switch anyway
      try { const vt = document.startViewTransition(run); for (const p of [vt.ready, vt.finished, vt.updateCallbackDone]) p.catch(() => { }); } catch { run(); }
      setTimeout(run, 300);
    },
    prev: () => shift(-1),
    next: () => shift(1),
    add: () => openFlow({}),
    close: () => closeLayer(),
    undo() { const f = undoFn; undoFn = null; $('#toast').classList.remove('show', 'act'); if (f) { f(); sfx('undo'); } },

    // statistics
    tkmode(b) { if (b.dataset.v === tkMode) return; tkMode = b.dataset.v; sel = null; setSeg('seg-mode', tkMode, 'thang'); sfx('tick'); paint({ dir: tkMode === 'nam' ? 1 : -1 }); },
    tktype(b) { if (b.dataset.v === tkType) return; tkType = b.dataset.v; sel = null; setSeg('seg-type', tkType, 'chi'); sfx('tick'); $('#piebox').innerHTML = pieBox(period()); },
    slice(b) { sel = sel === b.dataset.id ? null : b.dataset.id; sfx('tap'); applySel(); },
    gomonth(b) {
      const p = { y: ym.y, m: +b.dataset.m };
      if (mkey(p) > mkey(cur())) return;
      ym = p; tkMode = 'thang'; sel = null; sfx('tap'); setSeg('seg-mode', tkMode, 'thang'); paint({ dir: -1 }); $('#view').scrollTop = 0;
    },
    catlist(b) {
      const c = cat(b.dataset.id), list = period().filter(t => t.cat === c.id).sort(newest), total = list.reduce((a, t) => a + t.amt, 0);
      openLayer(`<div class="scrim" data-act="close"></div><div class="sheet"><div class="grab"></div>
        <div class="sh-head">${badge(c)}<h2>${esc(c.name)}</h2><button class="iconbtn" data-act="close" aria-label="Đóng">${IC.close}</button></div>
        <div class="sheet-body"><p class="hint num">${yearMode() ? 'Năm ' + ym.y : `Tháng ${ym.m + 1}, ${ym.y}`} · ${list.length} khoản · ${vnd(total)}</p>
          ${list.map(t => `<div class="tx flat"><span class="grow"><b class="nm">${dayShort(t.date)}</b>${t.note ? `<small>${esc(t.note)}</small>` : ''}</span><span class="am num ${c.type}">${money(t.amt)} đ</span></div>`).join('')}
        </div></div>`);
    },

    // writing an entry
    edit(b) {
      const t = D.tx.find(x => x.id === b.dataset.id); if (!t) return;
      openFlow({ mode: 'edit', id: t.id, type: typeOf(t), cat: t.cat, amt: String(t.amt), date: t.date, note: t.note || '', step: 'amt' });
    },
    ftype(b) { if (b.dataset.v === F.type) return; F.type = b.dataset.v; setSeg('seg-ftype', F.type, 'chi'); sfx('tick'); $('#tiles').innerHTML = tiles(); },
    pick(b) { F.cat = b.dataset.id; F.step = 'amt'; sfx('tap'); drawFlow(1); },
    newcat() { F.step = 'name'; sfx('tap'); drawFlow(1); },
    fback() {
      if (F.step === 'name') F.step = 'cat';
      else if (F.step === 'amt') F.step = 'cat';
      else if (F.cat) { F.type = cat(F.cat).type; F.step = 'amt'; }
      else return closeLayer();
      sfx('tap'); drawFlow(-1);
    },
    savecat() {
      const i = $('#fname'), name = i.value.trim().replace(/\s+/g, ' ');
      if (!name) { shake(i); sfx('error'); i.focus(); return; }
      let c = D.cats.find(x => x.type === F.type && lower(x.name) === lower(name));
      if (c) c.hidden = false;
      else { c = { id: uid(), name, type: F.type, color: nextColor(), hidden: false, ts: Date.now() }; D.cats.push(c); }
      markCat(c); save(); i.blur();
      F.cat = c.id; F.step = 'amt'; sfx('plus', { p: .6 }); drawFlow(1);
    },
    key(b) {
      const k = b.dataset.k; let a = F.amt;
      if (k === 'del') a = a.slice(0, -1);
      else if (a.length + k.length <= 12) a = (a + k).replace(/^0+/, '');
      else { sfx('error'); shake($('#famt')); return; }
      F.amt = a; sfx('tick'); showAmt(true);
    },
    uselast() { const u = usage().get(F.cat); if (!u) return; F.amt = String(u.last); sfx('plus', { p: .4 }); showAmt(true); },
    fdate() { const i = $('#fdate'); try { i.showPicker(); } catch { i.focus(); i.click(); } },
    save() {
      const amt = +F.amt; if (!amt) { sfx('error'); return; }
      const note = ($('#fnote') ? $('#fnote').value : F.note).trim(), edit = F.mode === 'edit';
      let t = edit && D.tx.find(x => x.id === F.id);
      if (t) {
        if (t.date.slice(0, 7) !== F.date.slice(0, 7)) dropTx(t); // moved to another month: remove it from the old one
        Object.assign(t, { cat: F.cat, amt, date: F.date, note });
      } else { t = { id: uid(), cat: F.cat, amt, date: F.date, note, ts: Date.now() }; D.tx.push(t); }
      markTx(t); save(); fresh = t.id;
      if (!yearMode()) { const d = parse(t.date); ym = { y: d.getFullYear(), m: d.getMonth() }; }
      const msg = `${edit ? 'Đã sửa' : 'Đã ghi'}: ${cat(F.cat).name} ${vnd(amt)}`;
      closeLayer(true); sfx('done'); toast(msg);
    },
    del() {
      const i = D.tx.findIndex(x => x.id === F.id); if (i < 0) return;
      const [t] = D.tx.splice(i, 1); dropTx(t); save();
      closeLayer();
      toast('Đã xóa khoản ' + vnd(t.amt), () => { if (!D.tx.some(x => x.id === t.id)) D.tx.push(t); undropTx(t); save(); fresh = t.id; paint(); });
    },

    // settings
    settings() {
      openLayer(`<div class="scrim" data-act="close"></div><div class="sheet tall"><div class="grab"></div>
        <div class="sh-head"><h2>Cài đặt</h2><button class="iconbtn" data-act="close" aria-label="Đóng">${IC.close}</button></div>
        <div class="sheet-body">${settingsBody()}</div></div>`);
    },
    theme(b) { FX.setTheme(b.dataset.id); if (window.SFX) SFX.theme(b.dataset.id); sfx('theme'); $$('.thm').forEach(e => e.classList.toggle('on', e === b)); },
    sound(b) {
      const on = !b.classList.contains('on');
      SFX.setOn(on); SFX.setAmbient(on);
      b.classList.toggle('on', on); b.setAttribute('aria-checked', on); if (on) sfx('tick');
    },
    motion(b) { const on = !FX.motion(); FX.setMotion(on); b.classList.toggle('on', on); b.setAttribute('aria-checked', on); sfx('tick'); },
    cats() {
      CM = { type: 'chi', id: null };
      CM.el = openLayer(`<div class="scrim" data-act="close"></div><div class="sheet tall"><div class="grab"></div>
        <div class="sh-head"><h2>Các mục thu chi</h2><button class="iconbtn" data-act="close" aria-label="Đóng">${IC.close}</button></div>
        <div class="sheet-body">${seg('seg-cm', 'cmtype', 'chi', ['chi', 'Mục chi'], ['thu', 'Mục thu'])}<div id="cmlist" style="margin-top:10px">${cmList()}</div></div></div>`, () => { CM = null; });
    },
    cmtype(b) { if (b.dataset.v === CM.type) return; CM.type = b.dataset.v; setSeg('seg-cm', CM.type, 'chi'); sfx('tick'); $('#cmlist').innerHTML = cmList(); },
    cmedit(b) {
      const c = cat(b.dataset.id), n = D.tx.filter(t => t.cat === c.id).length;
      CM.id = c.id;
      openLayer(`<div class="scrim" data-act="close"></div><div class="sheet"><div class="grab"></div>
        <div class="sh-head">${badge(c)}<h2>Sửa mục</h2><button class="iconbtn" data-act="close" aria-label="Đóng">${IC.close}</button></div>
        <div class="sheet-body"><input class="field" id="cmname" maxlength="30" value="${esc(c.name)}" aria-label="Tên mục" autocomplete="off" enterkeyhint="done">
          <p class="hint">${n ? `Mục này đang có ${n} khoản. Nếu ẩn đi, các khoản cũ vẫn được giữ trong thống kê.` : 'Mục này chưa có khoản nào nên có thể xóa hẳn.'}</p></div>
        <div class="sheet-foot"><button class="btn" data-act="cmsave">Lưu tên</button>
          ${c.hidden ? '<button class="btn ghost" data-act="cmshow">Hiện lại mục này</button>' : `<button class="btn danger-ghost" data-act="cmhide">${n ? 'Ẩn mục này' : 'Xóa mục này'}</button>`}</div></div>`);
    },
    cmsave() {
      const c = cat(CM.id), i = $('#cmname'), name = i.value.trim().replace(/\s+/g, ' ');
      if (!name) { shake(i); sfx('error'); return; }
      if (D.cats.some(x => x !== c && x.type === c.type && lower(x.name) === lower(name))) { shake(i); sfx('error'); toast('Đã có mục tên này rồi.'); return; }
      c.name = name; markCat(c); save(); closeLayer(); toast('Đã đổi tên mục.');
    },
    // Google account
    async signin(b) {
      const err = m => { const e = $('#gate-err'); if (e) e.textContent = m; };
      if (!navigator.onLine) return err('Cần có mạng để đăng nhập lần đầu.');
      b.disabled = true; err('');
      try { await C.signIn(); } catch (e) {
        const code = e && e.code;
        b.disabled = false; err(SIGNIN_ERR[code] || `Đăng nhập chưa được${code ? ' (' + code + ')' : ''}. Thử lại sau ít phút.`);
      }
    },
    syncnow() {
      if (!navigator.onLine) return toast('Chưa có mạng.');
      sync(true).then(() => toast(syncErr ? 'Sao lưu chưa được. Máy sẽ tự thử lại.' : 'Đã sao lưu xong.'));
    },
    signout() {
      const wait = pending() && !navigator.onLine;
      openLayer(`<div class="scrim" data-act="close"></div><div class="sheet"><div class="grab"></div>
        <div class="sh-head"><h2>Đăng xuất?</h2><button class="iconbtn" data-act="close" aria-label="Đóng">${IC.close}</button></div>
        <div class="sheet-body"><p class="hint">${wait ? 'Còn thay đổi chưa sao lưu vì máy chưa có mạng. Chúng vẫn nằm trên máy này và sẽ được sao lưu khi đăng nhập lại.' : 'Sổ vẫn được giữ trong tài khoản Google. Muốn xem lại thì đăng nhập lại.'}</p></div>
        <div class="sheet-foot"><button class="btn danger-ghost" data-act="signout2">Đăng xuất</button><button class="btn ghost" data-act="close">Ở lại</button></div></div>`);
    },
    async signout2(b) {
      b.disabled = true;
      if (pending() && navigator.onLine) await sync(false);
      try { await C.signOut(); } catch { b.disabled = false; toast('Đăng xuất chưa được. Thử lại.'); }
    },
    cmshow() { const c = cat(CM.id); c.hidden = false; markCat(c); save(); closeLayer(); toast(`Đã hiện lại mục ${c.name}.`); },
    cmhide() {
      const c = cat(CM.id), used = D.tx.some(t => t.cat === c.id), i = D.cats.indexOf(c);
      if (used) { c.hidden = true; markCat(c); } else { D.cats.splice(i, 1); D.delCats[c.id] = Date.now(); mark('meta'); }
      save(); closeLayer();
      const back = () => { // look the category up again: a backup may have replaced the objects meanwhile
        let cc = D.cats.find(x => x.id === c.id);
        if (!cc) { cc = c; D.cats.splice(Math.min(i, D.cats.length), 0, cc); }
        cc.hidden = false; delete D.delCats[c.id];
        markCat(cc); save(); if (CM) $('#cmlist').innerHTML = cmList(); if (!stack.length) paint();
      };
      toast(`Đã ${used ? 'ẩn' : 'xóa'} mục ${c.name}.`, back);
    },
  };

  /* ---------- wiring ---------- */
  $('#app').addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const f = ACT[b.dataset.act];
    if (f) f(b, e);
  });
  document.addEventListener('change', e => {
    if (e.target.id !== 'fdate' || !F) return;
    const v = e.target.value;
    F.date = v && v <= today() ? v : today();
    e.target.value = F.date; $('#fdl').textContent = dayShort(F.date); sfx('tick');
  });
  document.addEventListener('input', e => {
    if (e.target.id === 'vol' && window.SFX) SFX.setVolume(+e.target.value);
    if (e.target.id === 'fnote' && F) F.note = e.target.value;
  });
  // swipe sideways on the page to change month
  let sx = 0, sy = 0, st = 0;
  const view = $('#view');
  view.addEventListener('touchstart', e => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; st = e.touches.length === 1 ? Date.now() : 0; }, { passive: true });
  view.addEventListener('touchend', e => {
    if (!st) return;
    const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.abs(dx) > 70 && Math.abs(dy) < 45 && Date.now() - st < 600) shift(dx < 0 ? 1 : -1);
  }, { passive: true });

  boot();
  // offline copy of the app; skipped while developing on this computer so edits show up at once
  if ('serviceWorker' in navigator && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && location.protocol === 'https:') {
    navigator.serviceWorker.register('./sw.js').catch(() => { });
  }
})();
