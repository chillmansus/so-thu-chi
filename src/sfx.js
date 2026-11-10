// Sound: short UI sounds and an ambient soundscape for each theme, all made live with Web Audio
// (no sound files, works offline). Nothing plays until the first tap, as browsers require.
// Ambient sound is on by default (one switch in settings turns all sound off) and stops whenever the app is hidden.
(() => {
  const AC = window.AudioContext || window.webkitAudioContext;
  const K = { fx: 'stc.sfx', amb: 'stc.amb', vol: 'stc.vol' };
  const get = k => { try { return localStorage.getItem(k); } catch { return null; } };
  const put = (k, v) => { try { localStorage.setItem(k, v); } catch { } };
  let fxOn = get(K.fx) !== '0', ambOn = get(K.amb) !== '0';
  let vol = Math.min(1, Math.max(0, parseFloat(get(K.vol) ?? '0.45')));
  if (!Number.isFinite(vol)) vol = .45;
  let themeId = (window.FX && FX.theme()) || 'night';

  let ac = null, master, uiBus, ambBus, white, brown, scene = null;
  function init() {
    if (ac || !AC) return !!ac;
    try {
      ac = new AC();
      const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
      master = ac.createGain(); master.gain.value = vol; master.connect(comp).connect(ac.destination);
      uiBus = ac.createGain(); uiBus.gain.value = .9; uiBus.connect(master);
      ambBus = ac.createGain(); ambBus.gain.value = 0; ambBus.connect(master);
      const n = ac.sampleRate * 2;
      white = ac.createBuffer(1, n, ac.sampleRate); brown = ac.createBuffer(1, n, ac.sampleRate);
      const w = white.getChannelData(0), b = brown.getChannelData(0); let last = 0;
      for (let i = 0; i < n; i++) { w[i] = Math.random() * 2 - 1; last = (last + .02 * w[i]) / 1.02; b[i] = last * 3.5; }
      return true;
    } catch { ac = null; return false; }
  }
  const ready = () => ac && ac.state === 'running';
  function wake() {
    if (!init()) return;
    if (ac.state !== 'running') ac.resume().then(() => syncAmbient()).catch(() => { });
    else syncAmbient();
  }
  addEventListener('pointerdown', wake, { capture: true, passive: true });
  addEventListener('keydown', wake, { capture: true });
  document.addEventListener('visibilitychange', () => {
    if (!ac) return;
    if (document.hidden) { stopScene(true); ac.suspend().catch(() => { }); }
    else ac.resume().then(() => syncAmbient()).catch(() => { });
  });

  /* ---------- building blocks ---------- */
  const now = () => ac.currentTime;
  const R = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  // one enveloped oscillator note
  function note(f, { at = 0, dur = .3, type = 'sine', v = .2, a = .005, to = null, out = uiBus, detune = 0 } = {}) {
    const t = now() + at, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = detune;
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g).connect(out); o.start(t); o.stop(t + dur + .05);
    return o;
  }
  // a soft bell: base tone plus a quiet bright partial
  function bell(f, at = 0, v = .14, dur = 1.1, out = uiBus) {
    note(f, { at, dur, v, out }); note(f * 2.76, { at, dur: dur * .45, v: v * .25, out }); note(f * 5.4, { at, dur: dur * .2, v: v * .08, out });
  }
  // a wooden pluck (marimba-like)
  function pluck(f, at = 0, v = .18, out = uiBus) { note(f, { at, dur: .35, v, out, type: 'sine' }); note(f * 4, { at, dur: .06, v: v * .35, out }); }
  // a burst of filtered noise
  function hiss({ at = 0, dur = .2, v = .1, type = 'bandpass', f = 1000, to = null, q = 1, buf = 'white', out = uiBus, a = .01 } = {}) {
    const t = now() + at, s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = buf === 'brown' ? brown : white; s.loop = true;
    fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q; if (to) fl.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(fl).connect(g).connect(out); s.start(t, R(0, 1.8)); s.stop(t + dur + .05);
  }
  const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5]; // C major pentatonic

  /* ---------- UI sounds ---------- */
  const UI = {
    tap: () => note(880, { dur: .05, v: .05, to: 660 }),
    tick: () => note(1760, { dur: .035, v: .035, type: 'triangle' }),
    tab: () => { note(520, { dur: .09, v: .06, to: 600 }); },
    open: () => hiss({ dur: .22, v: .035, type: 'lowpass', f: 300, to: 1400 }),
    close: () => hiss({ dur: .2, v: .03, type: 'lowpass', f: 1400, to: 300 }),
    plus: o => pluck(PENTA[Math.min(PENTA.length - 1, Math.floor((o && o.p || 0) * 5))], 0, .17),
    minus: () => pluck(392, 0, .13),
    done: () => { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => bell(f, i * .07, .11, 1.2)); hiss({ at: .2, dur: .6, v: .025, type: 'highpass', f: 6000 }); },
    held: () => { note(130.8, { dur: .5, v: .16, to: 98 }); [659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => bell(f, .05 + i * .06, .1, 1.3)); },
    undo: () => { pluck(659.25, 0, .12); pluck(523.25, .08, .12); },
    page: () => { [261.6, 329.6, 392].forEach(f => note(f, { dur: 1.6, v: .05, a: .15, type: 'triangle' })); bell(1046.5, .25, .08, 1.5); },
    milestone: () => {
      [261.6, 329.6, 392, 523.25].forEach(f => note(f, { dur: 2.2, v: .05, a: .2, type: 'triangle' }));
      [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568].forEach((f, i) => bell(f, .1 + i * .09, .1, 1.4));
      hiss({ at: .5, dur: 1.2, v: .03, type: 'highpass', f: 7000 });
    },
    nudge: () => { hiss({ dur: .35, v: .08, f: 500, to: 3000, q: 2 }); pluck(880, .25, .15); },
    paired: () => { bell(659.25, 0, .12); bell(987.8, .14, .12); },
    theme: () => { [3, 4, 5, 6, 7].forEach((k, i) => bell(PENTA[k], i * .05, .05, .8)); },
    start: () => { pluck(392, 0, .14); pluck(587.33, .09, .14); },
    error: () => note(180, { dur: .18, v: .08, type: 'triangle', to: 140 }),
  };

  /* ---------- ambient scenes ---------- */
  // A scene returns nothing; it registers nodes and timers through `S` so they can be stopped together.
  function bed(S, { buf = 'white', type = 'lowpass', f = 800, q = .7, v = .2, lfoRate = 0, lfoDepth = 0, fLfoRate = 0, fLfoDepth = 0 } = {}) {
    const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = buf === 'brown' ? brown : white; s.loop = true; fl.type = type; fl.frequency.value = f; fl.Q.value = q; g.gain.value = v;
    s.connect(fl).connect(g).connect(ambBus); s.start(0, R(0, 1.9)); S.nodes.push(s);
    if (lfoRate) S.nodes.push(lfo(g.gain, lfoRate, lfoDepth));
    if (fLfoRate) S.nodes.push(lfo(fl.frequency, fLfoRate, fLfoDepth));
    return g;
  }
  function lfo(param, rate, depth) { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = rate; g.gain.value = depth; o.connect(g).connect(param); o.start(); return o; }
  function every(S, min, max, fn) {
    const slot = S.timers.push(0) - 1; // one reused slot per repeating sound, so the list never grows
    const loop = () => { S.timers[slot] = setTimeout(() => { if (S.dead) return; try { fn(); } catch { } loop(); }, R(min, max)); };
    loop();
  }
  const chirp = (v = .05) => {
    const base = R(2600, 4200), n = Math.floor(R(2, 6));
    for (let i = 0; i < n; i++) note(base * R(.9, 1.1), { at: i * R(.07, .12), dur: R(.05, .1), v, to: base * R(1.15, 1.5), out: ambBus });
  };
  const crickets = (v = .025) => {
    const f = R(4200, 4800), n = Math.floor(R(3, 7));
    for (let i = 0; i < n; i++) note(f, { at: i * .045, dur: .03, v, out: ambBus, type: 'triangle' });
  };
  const bubble = (v = .04) => note(R(250, 500), { dur: .08, v, to: R(700, 1200), out: ambBus });
  const chimeA = (v = .035) => bell(pick(PENTA) * pick([1, 2]), 0, v, 2.4, ambBus);
  const owl = () => { note(380, { dur: .35, v: .05, to: 360, out: ambBus }); note(380, { at: .55, dur: .6, v: .045, to: 340, out: ambBus }); };
  const wind = (S, v = .12, f = 500) => bed(S, { buf: 'brown', type: 'bandpass', f, q: .6, v, lfoRate: .07, lfoDepth: v * .7, fLfoRate: .05, fLfoDepth: f * .5 });
  const waves = (S, v = .3) => bed(S, { buf: 'brown', type: 'lowpass', f: 700, v, lfoRate: .13, lfoDepth: v * .85, fLfoRate: .13, fLfoDepth: 300 });

  const SCENES = {
    night: S => { bed(S, { buf: 'brown', f: 260, v: .16 }); every(S, 6000, 14000, () => chimeA(.02)); },
    forest: S => { wind(S, .12, 600); every(S, 1800, 5500, () => chirp()); every(S, 3000, 8000, () => hiss({ dur: .8, v: .03, type: 'highpass', f: 3000, out: ambBus, a: .3 })); },
    ocean: S => { waves(S, .32); every(S, 600, 2600, () => bubble()); },
    dawn: S => { wind(S, .06, 500); every(S, 700, 2600, () => chirp(.045)); },
    moonlight: S => { waves(S, .1); every(S, 600, 2200, () => crickets(.015)); every(S, 12000, 26000, () => owl()); },
  };

  function stopScene(quick) {
    if (!scene) return;
    const s = scene; scene = null; s.dead = true; s.timers.forEach(clearTimeout);
    const t = now();
    ambBus.gain.cancelScheduledValues(t); ambBus.gain.setValueAtTime(ambBus.gain.value, t); ambBus.gain.linearRampToValueAtTime(0, t + (quick ? .05 : .6));
    setTimeout(() => s.nodes.forEach(n => { try { n.stop(); } catch { } try { n.disconnect(); } catch { } }), quick ? 100 : 700);
  }
  function syncAmbient() {
    if (!ready()) return;
    const want = ambOn && !document.hidden && SCENES[themeId];
    if (scene && (!want || scene.id !== themeId)) stopScene();
    if (!want || scene) return;
    const S = { id: themeId, nodes: [], timers: [], dead: false };
    const start = () => {
      if (S.dead || scene !== S) return;
      try { SCENES[themeId](S); } catch { }
      const t = now(); ambBus.gain.cancelScheduledValues(t); ambBus.gain.setValueAtTime(0, t); ambBus.gain.linearRampToValueAtTime(.6, t + 1.5);
    };
    scene = S;
    setTimeout(start, 750); // let the old scene fade out first
  }

  window.SFX = {
    play(name, opt) { if (!fxOn || !UI[name]) return; if (!init()) return; if (ac.state !== 'running') { ac.resume().catch(() => { }); return; } try { UI[name](opt); } catch { } },
    // rising tone while a card is held; returns a function that stops it
    charge(ms) {
      if (!fxOn || !ready()) return () => { };
      const t = now(), o = ac.createOscillator(), g = ac.createGain();
      o.type = 'triangle'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(660, t + ms / 1000);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.06, t + ms / 1000);
      o.connect(g).connect(uiBus); o.start(t);
      return () => { try { const t2 = now(); g.gain.cancelScheduledValues(t2); g.gain.setValueAtTime(g.gain.value, t2); g.gain.linearRampToValueAtTime(0, t2 + .06); o.stop(t2 + .08); } catch { } };
    },
    on: () => fxOn, setOn(v) { fxOn = !!v; put(K.fx, v ? '1' : '0'); },
    ambient: () => ambOn, setAmbient(v) { ambOn = !!v; put(K.amb, v ? '1' : '0'); wake(); if (!v) stopScene(); },
    volume: () => vol, setVolume(v) { vol = Math.min(1, Math.max(0, +v || 0)); put(K.vol, String(vol)); if (master) master.gain.setTargetAtTime(vol, now(), .05); },
    theme(id) { themeId = id; syncAmbient(); },
    supported: !!AC,
    // for checks: build one scene or play one sound and report an error instead of swallowing it
    _state: () => ({ ctx: ac && ac.state, scene: scene && { id: scene.id, nodes: scene.nodes.length, timers: scene.timers.length, dead: scene.dead }, amb: ambBus && +ambBus.gain.value.toFixed(3), ambOn, themeId }),
    _check() {
      if (!init()) return ['no audio'];
      const errs = [];
      for (const n of Object.keys(UI)) { try { UI[n]({ p: .5 }); } catch (e) { errs.push(n + ': ' + e.message); } }
      for (const id of Object.keys(SCENES)) {
        const S = { id, nodes: [], timers: [], dead: false };
        try { SCENES[id](S); } catch (e) { errs.push(id + ': ' + e.message); }
        S.dead = true; S.timers.forEach(clearTimeout); S.nodes.forEach(n => { try { n.stop(); } catch { } try { n.disconnect(); } catch { } });
      }
      return errs;
    },
  };
})();
