// Themes: the app's background colors plus a quiet animated scene drawn behind the content.
// One canvas, at most 30 frames a second, a few dozen simple shapes, glows drawn from cached sprites
// (no shadowBlur), stopped while the app is hidden. With "Moving background" off or reduced motion,
// the scene is drawn once and stays still.
(() => {
  const THEMES = [
    { id: 'night', name: 'Đêm', fx: 'dust', bg: '#0b0a09', glow: '#191510', s: ['#151311', '#1e1b18', '#2a2622'], tint: '255,236,214', sw: ['#ffb45e', '#f59be6'], note: 'Bụi sáng trôi' },
    { id: 'ocean', name: 'Biển', fx: 'ocean', bg: '#040910', glow: '#0b2643', s: ['#0e1620', '#141e2a', '#1d2a3a'], tint: '195,228,255', sw: ['#86ecfb', '#1c6fe0'], note: 'Cá và bong bóng' },
    { id: 'forest', name: 'Rừng', fx: 'leaves', bg: '#060b08', glow: '#10261a', s: ['#111813', '#18211a', '#222e25'], tint: '215,240,205', sw: ['#d3f58a', '#2f9e55'], note: 'Lá bay trong gió' },
    { id: 'dawn', name: 'Bình minh', fx: 'dawn', bg: '#0a0a12', glow: '#2c1c30', s: ['#15141c', '#1d1b25', '#292633'], tint: '255,222,220', sw: ['#ffd9a8', '#c77dba'], note: 'Mặt trời lên, chim bay' },
    { id: 'moonlight', name: 'Trăng', fx: 'moonlight', bg: '#05080d', glow: '#15212f', s: ['#0f141b', '#151b24', '#1f2733'], tint: '215,228,250', sw: ['#eef3ff', '#5f7fb0'], note: 'Mây trôi qua trăng' },
  ];
  const TK = { theme: 'stc.theme', motion: 'stc.fx' };
  const get = k => { try { return localStorage.getItem(k); } catch { return null; } };
  const put = (k, v) => { try { localStorage.setItem(k, v); } catch { } };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let theme = THEMES.find(t => t.id === get(TK.theme)) || THEMES[0];
  let motion = get(TK.motion) !== '0';

  /* ---------- colors ---------- */
  function paint(t) {
    const r = document.documentElement.style;
    r.setProperty('--bg', t.bg); r.setProperty('--bg-glow', t.glow);
    r.setProperty('--surface', t.s[0]); r.setProperty('--surface-2', t.s[1]); r.setProperty('--surface-3', t.s[2]);
    r.setProperty('--line', `rgba(${t.tint},.08)`); r.setProperty('--line-2', `rgba(${t.tint},.15)`);
    const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = t.bg;
  }
  paint(theme);

  /* ---------- helpers ---------- */
  const R = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const TAU = Math.PI * 2;
  const sprites = new Map();
  // a soft round glow, drawn once per color and size, then stamped with drawImage
  function glow(color, r) {
    const k = color + r;
    if (sprites.has(k)) return sprites.get(k);
    const c = document.createElement('canvas'); c.width = c.height = r * 2;
    const g = c.getContext('2d'), gr = g.createRadialGradient(r, r, 0, r, r, r);
    gr.addColorStop(0, color); gr.addColorStop(.25, color.replace(/[\d.]+\)$/, m => (parseFloat(m) * .45) + ')')); gr.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
    g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2);
    sprites.set(k, c); return c;
  }
  const stamp = (ctx, spr, x, y, a = 1, scale = 1) => {
    ctx.globalAlpha = a; const w = spr.width * scale; ctx.drawImage(spr, x - w / 2, y - w / 2, w, w); ctx.globalAlpha = 1;
  };
  const wrap = (v, lo, hi) => (v < lo ? hi : v > hi ? lo : v);

  /* ---------- scenes ---------- */
  // Each scene: make(W, H) -> state, draw(ctx, state, t, dt, W, H)
  const SCENES = {
    dust: {
      make: (W, H) => ({ p: Array.from({ length: 26 }, () => ({ x: R(0, W), y: R(0, H), vx: R(-4, 4), vy: R(-7, -2), r: R(.6, 1.6), ph: R(0, TAU), sp: R(.4, 1.1) })) }),
      draw(ctx, s, t, dt, W, H) {
        const spr = glow('rgba(255,214,170,1)', 6);
        for (const p of s.p) {
          p.x = wrap(p.x + (p.vx + Math.sin(t * .3 + p.ph) * 3) * dt, -10, W + 10); p.y = wrap(p.y + p.vy * dt, -10, H + 10);
          stamp(ctx, spr, p.x, p.y, (.18 + .2 * Math.sin(t * p.sp + p.ph)) * p.r, p.r * .9);
        }
      },
    },
    leaves: {
      make: (W, H) => ({
        p: Array.from({ length: 24 }, () => leaf(W, H, true)),
        g: Array.from({ length: Math.ceil(W / 7) }, (_, i) => ({ x: i * 7 + R(-3, 3), h: R(16, 58), c: pick(['#1f5a33', '#2a7040', '#357f44', '#24603a']), ph: R(0, TAU) })),
      }),
      draw(ctx, s, t, dt, W, H) {
        const wind = Math.sin(t * .35) * .6 + Math.sin(t * .13 + 1) * .4; // gusts, -1..1
        for (const p of s.p) {
          p.y += p.vy * dt; p.x += (wind * 34 + Math.sin(t * p.f + p.ph) * p.a) * dt; p.rot += (p.vr + wind * .8) * dt;
          if (p.y > H + 30 || p.x < -40 || p.x > W + 40) Object.assign(p, leaf(W, H));
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(1, .55 + .45 * Math.abs(Math.cos(t * p.f + p.ph)));
          ctx.globalAlpha = .75; ctx.fillStyle = p.c;
          ctx.beginPath(); ctx.moveTo(0, -p.s); ctx.quadraticCurveTo(p.s * .75, 0, 0, p.s); ctx.quadraticCurveTo(-p.s * .75, 0, 0, -p.s); ctx.fill();
          ctx.globalAlpha = .35; ctx.strokeStyle = '#0d2414'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(0, -p.s * .8); ctx.lineTo(0, p.s * 1.15); ctx.stroke();
          ctx.restore();
        }
        ctx.globalAlpha = .55; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
        for (const b of s.g) {
          const bend = (wind * 12 + Math.sin(t * 2.1 + b.ph + b.x * .03) * 4) * (b.h / 50);
          ctx.strokeStyle = b.c; ctx.beginPath(); ctx.moveTo(b.x, H + 2);
          ctx.quadraticCurveTo(b.x + bend * .3, H - b.h * .55, b.x + bend, H - b.h); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      },
    },
    ocean: {
      make: (W, H) => ({
        fish: Array.from({ length: 9 }, () => fish(W, H, true)),
        b: Array.from({ length: 22 }, () => ({ x: R(0, W), y: R(0, H), r: R(1.2, 3.6), vy: R(-38, -16), ph: R(0, TAU) })),
        weed: Array.from({ length: Math.max(5, Math.round(W / 55)) }, (_, i) => ({ x: (i + R(.1, .9)) * (W / Math.max(5, Math.round(W / 55))), h: R(60, 150), ph: R(0, TAU), c: pick(['#14593f', '#1b6b4a', '#0f4a3a']) })),
      }),
      draw(ctx, s, t, dt, W, H) {
        // light from the surface
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 4; i++) {
          const x = W * (.15 + i * .25) + Math.sin(t * .25 + i * 1.7) * 30;
          const g = ctx.createLinearGradient(0, 0, 0, H * .8); g.addColorStop(0, 'rgba(120,200,255,.07)'); g.addColorStop(1, 'rgba(120,200,255,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - 18, 0); ctx.lineTo(x + 22, 0); ctx.lineTo(x + 90, H * .8); ctx.lineTo(x + 10, H * .8); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
        // seaweed
        ctx.lineCap = 'round';
        for (const w of s.weed) {
          ctx.strokeStyle = w.c; ctx.globalAlpha = .7; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(w.x, H + 4);
          for (let k = 1; k <= 6; k++) { const y = H - w.h * k / 6; ctx.lineTo(w.x + Math.sin(t * 1.1 + w.ph + k * .7) * k * 2.6, y); }
          ctx.stroke();
        }
        // fish
        for (const f of s.fish) {
          f.x += f.v * f.dir * dt; f.y += Math.sin(t * .6 + f.ph) * 6 * dt;
          if ((f.dir > 0 && f.x > W + 60) || (f.dir < 0 && f.x < -60)) Object.assign(f, fish(W, H));
          const L = f.L, wig = Math.sin(t * f.w + f.ph) * L * .22;
          ctx.save(); ctx.translate(f.x, f.y); ctx.scale(f.dir, 1); ctx.globalAlpha = .62; ctx.fillStyle = f.c;
          ctx.beginPath(); ctx.ellipse(0, 0, L * .5, L * .22, 0, 0, TAU); ctx.fill();
          ctx.beginPath(); ctx.moveTo(-L * .42, 0); ctx.lineTo(-L * .78, -L * .2 + wig); ctx.lineTo(-L * .78, L * .2 + wig); ctx.closePath(); ctx.fill();
          ctx.globalAlpha = .8; ctx.fillStyle = '#04101c'; ctx.beginPath(); ctx.arc(L * .3, -L * .04, Math.max(1, L * .045), 0, TAU); ctx.fill();
          ctx.restore();
        }
        // bubbles
        ctx.strokeStyle = 'rgba(190,235,255,.45)'; ctx.lineWidth = 1;
        for (const b of s.b) {
          b.y += b.vy * dt; b.x += Math.sin(t * 2 + b.ph) * 10 * dt;
          if (b.y < -10) { b.y = H + R(0, 40); b.x = R(0, W); }
          ctx.globalAlpha = .7; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      },
    },
    dawn: {
      make: (W, H) => ({ birds: Array.from({ length: 5 }, () => bird(W, H, true)), mist: [0, 1, 2].map(i => ({ x: R(0, W), y: H * (.6 + i * .08), w: R(160, 260), v: R(4, 10) })) }),
      draw(ctx, s, t, dt, W, H) {
        sky(ctx, s, H, W, [[0, 'rgba(40,50,120,0)'], [.5, 'rgba(120,80,150,.16)'], [.82, 'rgba(255,150,130,.30)'], [1, 'rgba(255,200,140,.40)']]);
        const sy = H * .84 - Math.sin(t * .05) * 8;
        ctx.globalCompositeOperation = 'lighter';
        stamp(ctx, glow('rgba(255,190,140,1)', 120), W * .62, sy, .45, 1.6);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = .7; ctx.fillStyle = '#ffe2b8'; ctx.beginPath(); ctx.arc(W * .62, sy, 26, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
        hills(ctx, W, H, 70, 26, .006, '#2a1a33', .85, t * 0); hills(ctx, W, H, 34, 14, .011, '#1a1222', .95, 2);
        for (const m of s.mist) { m.x += m.v * dt; if (m.x - m.w > W) m.x = -m.w; stamp(ctx, glow('rgba(255,215,220,1)', 60), m.x, m.y, .1, m.w / 60); }
        flock(ctx, s.birds, t, dt, W, H, '#2a1830');
      },
    },
    moonlight: {
      make: (W, H) => ({ st: Array.from({ length: 50 }, () => ({ x: R(0, W), y: R(0, H * .75), r: R(.4, 1.3), ph: R(0, TAU) })), cl: Array.from({ length: 5 }, () => cloud(W, H, true)), sh: Array.from({ length: 22 }, () => ({ dy: R(6, H * .14), w: R(8, 30), ph: R(0, TAU) })) }),
      draw(ctx, s, t, dt, W, H) {
        const hz = H * .82, mx = W * .8, my = H * .2;
        sky(ctx, s, H, W, [[0, 'rgba(20,40,70,0)'], [.6, 'rgba(40,70,110,.16)'], [.82, 'rgba(80,110,150,.22)'], [.83, 'rgba(10,20,35,.45)'], [1, 'rgba(5,10,20,.55)']]);
        ctx.fillStyle = '#fff';
        for (const p of s.st) { ctx.globalAlpha = .2 + .3 * Math.sin(t * .8 + p.ph); ctx.fillRect(p.x, p.y, p.r, p.r); }
        ctx.globalCompositeOperation = 'lighter'; stamp(ctx, glow('rgba(200,220,255,1)', 90), mx, my, .4, 1.6); ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = .95; ctx.fillStyle = '#eef3ff'; ctx.beginPath(); ctx.arc(mx, my, 28, 0, TAU); ctx.fill();
        ctx.globalAlpha = .12; ctx.fillStyle = '#7d8aa6'; [[-8, -6, 7], [9, 5, 5], [-2, 11, 4]].forEach(([a, b, r]) => { ctx.beginPath(); ctx.arc(mx + a, my + b, r, 0, TAU); ctx.fill(); });
        for (const c of s.cl) {
          c.x += c.v * dt; if (c.x - c.w * 1.5 > W) Object.assign(c, cloud(W, H));
          for (const [ox, oy, r] of c.parts) stamp(ctx, glow('rgba(120,135,165,1)', 40), c.x + ox, c.y + oy, .28, r / 40);
        }
        ctx.strokeStyle = '#dfe8ff'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
        for (const r of s.sh) {
          const k = r.dy / (H * .14), w = r.w * (1 - k * .5), x = mx + Math.sin(t * 1.1 + r.ph) * 5;
          ctx.globalAlpha = (.5 - k * .4) * (.5 + .5 * Math.sin(t * 1.8 + r.ph));
          ctx.beginPath(); ctx.moveTo(x - w / 2, hz + r.dy); ctx.lineTo(x + w / 2, hz + r.dy); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      },
    },
  };
  // sky scenes: a tall gradient (cached per state), hills, mountains, birds, clouds, a crescent moon
  function sky(ctx, s, H, W, stops) {
    if (!s.sky) { const g = ctx.createLinearGradient(0, 0, 0, H); for (const [o, c] of stops) g.addColorStop(o, c); s.sky = g; }
    ctx.fillStyle = s.sky; ctx.fillRect(0, 0, W, H);
  }
  function hills(ctx, W, H, base, amp, k, color, a, ph) {
    ctx.globalAlpha = a; ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W + 20; x += 20) ctx.lineTo(x, H - base - Math.sin(x * k + ph) * amp - Math.sin(x * k * 2.7 + ph * 2) * amp * .3);
    ctx.lineTo(W, H); ctx.fill(); ctx.globalAlpha = 1;
  }
  function mountains(ctx, W, H, base, color, a, seed) {
    ctx.globalAlpha = a; ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W + 24; x += 24) {
      const n = Math.sin(x * .013 + seed) * .6 + Math.sin(x * .031 + seed * 2) * .3 + Math.abs(Math.sin(x * .007 + seed)) * .7;
      ctx.lineTo(x, H - base - n * 46);
    }
    ctx.lineTo(W, H); ctx.fill(); ctx.globalAlpha = 1;
  }
  function bird(W, H, any) { const dir = Math.random() < .5 ? 1 : -1; return { dir, x: any ? R(0, W) : dir > 0 ? -30 : W + 30, y: R(H * .25, H * .62), v: R(16, 30), s: R(5, 9), f: R(5, 8), ph: R(0, TAU) }; }
  function flock(ctx, birds, t, dt, W, H, color) {
    ctx.strokeStyle = color; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalAlpha = .85;
    for (const b of birds) {
      b.x += b.v * b.dir * dt; b.y += Math.sin(t * .7 + b.ph) * 4 * dt;
      if ((b.dir > 0 && b.x > W + 40) || (b.dir < 0 && b.x < -40)) Object.assign(b, bird(W, H));
      const w = Math.sin(t * b.f + b.ph) * b.s * .55;
      ctx.beginPath(); ctx.moveTo(b.x - b.s, b.y - w); ctx.quadraticCurveTo(b.x - b.s * .4, b.y - w * .3 - 1, b.x, b.y);
      ctx.quadraticCurveTo(b.x + b.s * .4, b.y - w * .3 - 1, b.x + b.s, b.y - w); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  function cloud(W, H, any) { const w = R(50, 110); return { x: any ? R(-w, W) : -w * 1.5, y: R(H * .15, H * .5), w, v: R(5, 11), parts: Array.from({ length: 4 }, (_, i) => [(i - 1.5) * w * .4, R(-8, 8), R(w * .35, w * .55)]) }; }
  let moonSpr = null;
  function crescent() {
    if (moonSpr) return moonSpr;
    const c = document.createElement('canvas'); c.width = c.height = 48; const g = c.getContext('2d');
    g.fillStyle = '#f3efff'; g.beginPath(); g.arc(24, 24, 20, 0, TAU); g.fill();
    g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(33, 18, 18, 0, TAU); g.fill();
    return (moonSpr = c);
  }
  function leaf(W, H, any) { return { x: R(-20, W), y: any ? R(-20, H) : R(-60, -20), s: R(7, 14), vy: R(18, 38), a: R(20, 50), f: R(.6, 1.4), ph: R(0, TAU), rot: R(0, TAU), vr: R(-1.2, 1.2), c: pick(['#6fbf55', '#9fd65a', '#3f9e4f', '#c9d65a', '#d9a441']) }; }
  function fish(W, H, any) { const dir = Math.random() < .5 ? 1 : -1; return { dir, x: any ? R(0, W) : dir > 0 ? -50 : W + 50, y: R(H * .12, H * .78), L: R(14, 34), v: R(18, 46), w: R(6, 10), ph: R(0, TAU), c: pick(['#ffb45e', '#86ecfb', '#f59be6', '#ffe38a', '#7fd3ff', '#ff8a6b']) }; }

  /* ---------- engine ---------- */
  let cv, ctx, W = 0, H = 0, dpr = 1, state = null, raf = 0, last = 0, t0 = performance.now();
  const moving = () => motion && !reduce.matches && !document.hidden;
  function size() {
    if (!cv) return;
    const box = cv.parentElement.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    W = Math.max(1, box.width); H = Math.max(1, box.height);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    state = SCENES[theme.fx].make(W, H);
    frame(performance.now(), true);
  }
  function frame(now, force) {
    raf = 0;
    if (!ctx || !state) return;
    if (!force && now - last < 32) { schedule(); return; } // about 30 frames a second
    const dt = Math.min(.05, (now - (last || now)) / 1000); last = now;
    const t = (now - t0) / 1000;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    SCENES[theme.fx].draw(ctx, state, t, force && !moving() ? 0 : dt, W, H);
    schedule();
  }
  function schedule() { if (!raf && moving()) raf = requestAnimationFrame(frame); }
  function restart() { if (raf) cancelAnimationFrame(raf); raf = 0; last = 0; if (!state) return; if (moving()) schedule(); else frame(performance.now(), true); }
  function start() {
    cv = document.getElementById('fx'); if (!cv) return;
    ctx = cv.getContext('2d');
    size();
    if ('ResizeObserver' in window) new ResizeObserver(() => size()).observe(cv.parentElement); else addEventListener('resize', size);
    document.addEventListener('visibilitychange', restart);
    reduce.addEventListener && reduce.addEventListener('change', restart);
    // a still scene keeps a little life on screen while the moving one is off: pre-run it a few seconds
    if (!moving()) { for (let i = 0; i < 90; i++) SCENES[theme.fx].draw(ctx, state, i / 30, 1 / 30, W, H); frame(performance.now(), true); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  window.FX = {
    THEMES,
    theme: () => theme.id,
    setTheme(id) {
      const t = THEMES.find(x => x.id === id); if (!t) return;
      theme = t; put(TK.theme, id); paint(t);
      if (ctx) { state = SCENES[t.fx].make(W, H); if (!moving()) for (let i = 0; i < 90; i++) SCENES[t.fx].draw(ctx, state, i / 30, 1 / 30, W, H); restart(); }
    },
    motion: () => motion,
    setMotion(on) { motion = !!on; put(TK.motion, on ? '1' : '0'); restart(); },
  };
})();
