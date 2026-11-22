(() => {
  'use strict';

  // A working copy of Google Calculator (Pixel, version 9.x) with the calcdm force built in.
  // Layout, colour roles and behaviour follow the app's own resources and the AOSP
  // ExactCalculator it descends from. The force works as in the iPhone version: tap the
  // history button to save the number on screen, read the specks, tap the marked operator
  // twice, and every tap after that types the next digit of the number that's needed.

  const $ = (id) => document.getElementById(id);
  const calcEl = $('calc');
  const probe = $('safeProbe');
  const keysEl = $('keys');
  const formulaBox = $('formulaBox');
  const formulaEl = $('formula');
  const cursorEl = $('cursor');
  const previewBox = $('previewBox');
  const previewEl = $('preview');
  const historyBtn = $('historyBtn');
  const menuBtn = $('menuBtn');
  const chevron = $('chevron');
  const hands = $('hands');

  const HOLD_MS = 700;
  const MAX_SPECK_DIGITS = 9;
  const P = 'gcalc.';
  const store = {
    get(k) { try { return localStorage.getItem(P + k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(P + k, v); } catch (e) { /* private mode */ } },
    remove(k) { try { localStorage.removeItem(P + k); } catch (e) { /* ignore */ } },
  };

  // ---------- Number format from the phone's language and region, as the real app ----------
  const LOCALE = (() => {
    let group = ',', decimal = '.';
    try {
      const parts = new Intl.NumberFormat(navigator.language).formatToParts(12345.6);
      for (const p of parts) {
        if (p.type === 'group') group = p.value;
        if (p.type === 'decimal') decimal = p.value;
      }
    } catch (e) { /* defaults */ }
    if (group === decimal) group = decimal === ',' ? '.' : ',';
    return { group, decimal };
  })();
  document.documentElement.lang = navigator.language || 'en';

  // ======================================================================
  // Palettes. The keys use Material colour roles; Pixels fill them from the wallpaper. The
  // defaults are Google's own palette for when dynamic colour is off. Import a screenshot of
  // the real app (hold the chevron) to copy the phone's colours exactly.
  // ======================================================================
  const DEFAULTS = {
    dark: {
      bg: '#131314', digitBg: '#333537', digitFg: '#e3e3e3', opBg: '#004a77', opFg: '#c2e7ff',
      acBg: '#0842a0', acFg: '#d3e3fd', eqBg: '#6dd58c', eqFg: '#0a3818', icon: '#c4c7c5',
      outline: '#8e918f', panel: '#1e1f20', menuBg: '#333537', cursor: '#a8c7fa', error: '#f2b8b5',
    },
    light: {
      bg: '#ffffff', digitBg: '#dde3ea', digitFg: '#1f1f1f', opBg: '#c2e7ff', opFg: '#004a77',
      acBg: '#d3e3fd', acFg: '#0842a0', eqBg: '#146c2e', eqFg: '#ffffff', icon: '#444746',
      outline: '#747775', panel: '#f0f4f9', menuBg: '#e9eef6', cursor: '#0b57d0', error: '#b3261e',
    },
  };
  const VAR = {
    bg: '--bg', digitBg: '--digit-bg', digitFg: '--digit-fg', opBg: '--op-bg', opFg: '--op-fg',
    acBg: '--ac-bg', acFg: '--ac-fg', eqBg: '--eq-bg', eqFg: '--eq-fg', icon: '--icon',
    outline: '--outline', panel: '--panel', menuBg: '--menu-bg', cursor: '--cursor', error: '--error',
  };
  let themeSetting = store.get('theme') || 'system'; // 'light' | 'dark' | 'system'
  const darkQuery = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;

  function scheme() {
    if (themeSetting === 'light' || themeSetting === 'dark') return themeSetting;
    return darkQuery && darkQuery.matches ? 'dark' : 'light';
  }

  function paletteFor(s) {
    let imported = null;
    try { imported = JSON.parse(store.get('palette.' + s) || 'null'); } catch (e) { imported = null; }
    return Object.assign({}, DEFAULTS[s], imported || {});
  }

  function applyPalette() {
    const p = paletteFor(scheme());
    for (const k in VAR) document.documentElement.style.setProperty(VAR[k], p[k]);
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', p.bg));
  }
  if (darkQuery && darkQuery.addEventListener) darkQuery.addEventListener('change', applyPalette);

  // ======================================================================
  // Keys
  // ======================================================================
  // Operator glyphs, drawn on the 176 x 352.52 box the app's own glyphs use, so they scale the
  // same way: the box is fitted to the key height, then scaled by the key's factor.
  const OPS_SVG = {
    '+': '<path d="M41 184.56H135M88 135.9V233.2"/>',
    '-': '<path d="M41 184.56H135"/>',
    '*': '<path d="M45.6 141.7L130.4 227.4M130.4 141.7L45.6 227.4"/>',
    '/': '<path d="M41 184.56H135"/><circle cx="88" cy="140.3" r="13.2" fill="currentColor" stroke="none"/><circle cx="88" cy="228.8" r="13.2" fill="currentColor" stroke="none"/>',
    '=': '<path d="M41 160.38H135M41 208.75H135"/>',
  };
  const OP_FACTOR = { '+': 0.86, '-': 0.78, '*': 0.86, '/': 0.84, '=': 0.86 };
  const BACKSPACE_SVG = '<svg viewBox="100 -800 780 640"><path fill="currentColor" d="m560-424 76 76q11 11 28 11t28-11q11-11 11-28t-11-28l-76-76 76-76q11-11 11-28t-11-28q-11-11-28-11t-28 11l-76 76-76-76q-11-11-28-11t-28 11q-11 11-11 28t11 28l76 76-76 76q-11 11-11 28t11 28q11 11 28 11t28-11l76-76ZM360-160q-19 0-36-8.5T296-192L116-432q-16-21-16-48t16-48l180-240q11-15 28-23.5t36-8.5h440q33 0 56.5 23.5T880-720v480q0 33-23.5 56.5T800-160H360Zm0-80h440v-480H360L180-480l180 240Zm130-240Z"/></svg>';

  // [key, kind, label]. Standard pad 4 x 5 in reading order, then the scientific pad 4 x 3.
  const STANDARD = [
    ['clear', 'ac', 'AC'], ['parens', 'op', '( )'], ['%', 'op', '%'], ['/', 'op', null],
    ['7', 'digit', '7'], ['8', 'digit', '8'], ['9', 'digit', '9'], ['*', 'op', null],
    ['4', 'digit', '4'], ['5', 'digit', '5'], ['6', 'digit', '6'], ['-', 'op', null],
    ['1', 'digit', '1'], ['2', 'digit', '2'], ['3', 'digit', '3'], ['+', 'op', null],
    ['0', 'digit', '0'], ['.', 'digit', LOCALE.decimal], ['bs', 'digit', null], ['=', 'eq', null],
  ];
  const SCIENTIFIC = [
    ['sqrt', 'sci', '√'], ['pi', 'sci', 'π'], ['^', 'sci', '^'], ['!', 'sci', '!'],
    ['deg', 'sci', 'Deg'], ['sin', 'sci', 'sin'], ['cos', 'sci', 'cos'], ['tan', 'sci', 'tan'],
    ['inv', 'sci', 'Inv'], ['e', 'sci', 'e'], ['ln', 'sci', 'ln'], ['log', 'sci', 'log'],
  ];
  const INVERSE_LABEL = { sqrt: 'x²', sin: 'sin⁻¹', cos: 'cos⁻¹', tan: 'tan⁻¹', ln: 'eˣ', log: '10ˣ' };
  // Landscape: standard pad 5 x 4, scientific 3 x 4 to its left.
  const STANDARD_LAND = ['7', '8', '9', 'clear', '*', '4', '5', '6', 'parens', '-', '1', '2', '3', '%', '+', '0', '.', 'bs', '/', '='];
  const SCIENTIFIC_LAND = ['sqrt', 'deg', 'inv', 'pi', 'sin', 'e', '^', 'cos', 'ln', '!', 'tan', 'log'];

  const keyEl = {};
  for (const [key, kind, label] of STANDARD.concat(SCIENTIFIC)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'key ' + (kind === 'sci' ? 'op sci' : kind);
    b.dataset.key = key;
    if (OPS_SVG[key]) {
      b.innerHTML = '<svg viewBox="0 0 176 352.52" fill="none" stroke="currentColor" stroke-width="14" stroke-linecap="round">' + OPS_SVG[key] + '</svg>';
    } else if (key === 'bs') {
      b.innerHTML = BACKSPACE_SVG;
      b.setAttribute('aria-label', 'Backspace');
    } else {
      b.innerHTML = '<span class="lbl"></span>';
      b.firstChild.textContent = label;
    }
    if (kind === 'sci') b.classList.add('hidden');
    keysEl.appendChild(b);
    keyEl[key] = b;
  }

  // Each hint key's speck: below the symbol, a little right of centre, with its own spot, size and
  // shape, picked once per launch so it doesn't move between presses (as in the iPhone version).
  const between = (a, b) => a + Math.random() * (b - a);
  for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '-']) {
    const corner = () => between(35, 65).toFixed(0) + '%';
    const s = keyEl[k].style;
    s.setProperty('--speck-dx', between(4.2, 10.1).toFixed(1));
    s.setProperty('--speck-dy', between(23.6, 27.8).toFixed(1));
    s.setProperty('--speck-size', between(1.4, 1.9).toFixed(2));
    s.setProperty('--speck-shape', [corner(), corner(), corner(), corner()].join(' '));
    s.setProperty('--speck-rot', between(0, 180).toFixed(0) + 'deg');
  }

  // ======================================================================
  // Layout, from the app's resource fractions (portrait and landscape)
  // ======================================================================
  let expanded = false;
  let capRatio = 0.716; // cap height of the digits / font size, measured once the font loads

  function measureCapRatio() {
    try {
      const c = document.createElement('canvas').getContext('2d');
      c.font = '400 100px GSF';
      const m = c.measureText('7');
      if (m.actualBoundingBoxAscent > 30) capRatio = m.actualBoundingBoxAscent / 100;
    } catch (e) { /* keep the default */ }
  }

  function insets() {
    const cs = getComputedStyle(probe);
    return { bottom: parseFloat(cs.paddingBottom) || 0, top: parseFloat(cs.paddingTop) || 0 };
  }

  const place = (el, x, y, w, h) => {
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.width = w + 'px';
    el.style.height = h + 'px';
  };

  // The label scale grows on screens narrower than 411dp, as in the app.
  const narrowBoost = (W) => Math.max(0, (411 - W) / 411);

  function styleKey(key, w, h, W, sci) {
    const el = keyEl[key];
    place(el, 0, 0, w, h);
    el.style.transform = '';
    el.style.setProperty('--ks', (h / 84.25).toFixed(3));
    const boost = narrowBoost(W);
    if (OPS_SVG[key]) {
      const f = Math.min(1, OP_FACTOR[key] + boost);
      const svg = el.firstChild;
      svg.style.height = h * f + 'px';
      svg.style.width = (h * f * 176) / 352.52 + 'px';
    } else if (key === 'bs') {
      const f = Math.min(1, 0.6 + boost) / 0.6;
      el.firstChild.style.height = 0.299 * h * f + 'px';
      el.firstChild.style.width = 0.366 * h * f + 'px';
    } else if (sci) {
      el.firstChild.style.fontSize = (0.3 * h) / capRatio + 'px';
    } else {
      const f = Math.min(1, 0.6 + boost);
      el.firstChild.style.fontSize = (0.519 * h * f) / capRatio + 'px';
    }
  }

  function gridKeys(list, x0, y0, totalW, keyH, cols, gapY, W, sci) {
    // 4dp outer margins, 2dp around every key, so 4dp gaps.
    const keyW = (totalW - 4 * 2 - (cols - 1) * 4) / cols;
    list.forEach((key, i) => {
      const r = Math.floor(i / cols), c = i % cols;
      styleKey(key, keyW, keyH, W, sci);
      const el = keyEl[key];
      el.style.left = x0 + 4 + c * (keyW + 4) + 'px';
      el.style.top = y0 + r * (keyH + gapY) + 'px';
    });
  }

  let geometry = { W: 0, H: 0, landscape: false };

  function layout() {
    const W = calcEl.clientWidth;
    const H = calcEl.clientHeight - insets().bottom;
    if (!W || !H) return;
    const landscape = W > H;
    geometry = { W, H, landscape };

    if (!landscape) {
      // Toolbar 0 to 8.3%, display to 32%, chevron row to 41%, keys below.
      const tb = 0.083 * H;
      place(historyBtn, 12, (tb - 48) / 2, 48, 48);
      place(menuBtn, W - 46.7, 8, 48, 48);
      const dTop = tb, dH = 0.32 * H - tb;
      place(formulaBox, 0, dTop, W, dH * 0.6);
      place(previewBox, 0, dTop + dH * 0.6, W, dH * 0.4);
      place(chevron, 13, (0.32 * H + 0.41 * H) / 2 - 24, 48, 48);
      chevron.style.display = '';

      const std = STANDARD.map((k) => k[0]);
      if (!expanded) {
        const top = 0.41 * H + 4;
        const keyH = (0.59 * H - 22) / 5;
        gridKeys(std, 0, top, W, keyH, 4, 4, W, false);
      } else {
        const sTop = 0.41 * H + 4;
        const sH = (0.22125 * H - 18) / 3;
        gridKeys(SCIENTIFIC.map((k) => k[0]), 0, sTop, W, sH, 4, 4, W, true);
        const top = 0.63125 * H + 4;
        const keyH = (0.36875 * H - 22) / 5;
        gridKeys(std, 0, top, W, keyH, 4, 4, W, false);
      }
      fontSizes.formulaMax = 80; fontSizes.formulaMin = 28;
      fontSizes.previewMax = 36; fontSizes.previewMin = 20;
    } else {
      // Toolbar 0 to 16%, display 16 to 32%, keys 47% down. Standard pad 5 x 4 on the right,
      // scientific 3 x 4 on the left (1% wide when collapsed).
      const tb = 0.16 * H;
      place(historyBtn, 14, (tb - 48) / 2, 48, 48);
      place(menuBtn, W - 46.7, (tb - 48) / 2, 48, 48);
      place(formulaBox, 0, tb, W, 0.16 * H);
      place(previewBox, 0, 0.32 * H, W, 0.13 * H);
      place(chevron, 14, 0.32 * H + (0.15 * H - 48) / 2, 48, 48);
      const top = 0.47 * H + 4;
      const keyH = (0.53 * H - 4 - 3 * 4 - 2) / 4;
      const split = expanded ? 0.3676 * W : 0.01 * W;
      if (expanded) gridKeys(SCIENTIFIC_LAND, 0, top, split, keyH, 3, 4, W, true);
      gridKeys(STANDARD_LAND, split, top, W - split, keyH, 5, 4, W, false);
      fontSizes.formulaMax = 0.16 * H * 0.62; fontSizes.formulaMin = 20;
      fontSizes.previewMax = 0.13 * H * 0.55; fontSizes.previewMin = 16;
    }
    const pad = 21;
    formulaBox.style.paddingRight = pad + 'px';
    previewBox.style.paddingRight = pad + 'px';
    formulaBox.style.paddingLeft = pad + 'px';
    previewBox.style.paddingLeft = pad + 'px';
    for (const [k] of SCIENTIFIC) keyEl[k].classList.toggle('hidden', !expanded);
    placeChevron();
    if (historyOpen) placeHistory();
    render();
  }

  const fontSizes = { formulaMax: 80, formulaMin: 28, previewMax: 36, previewMin: 20 };

  function placeChevron() {
    // Collapsed: chevrons point apart (expand). Expanded: they point together.
    $('chevTop').setAttribute('points', expanded ? '8,4 12,8 16,4' : '8,8 12,4 16,8');
    $('chevBottom').setAttribute('points', expanded ? '8,20 12,16 16,20' : '8,16 12,20 16,16');
    chevron.setAttribute('aria-label', expanded ? 'Collapse' : 'Expand');
  }

  // ======================================================================
  // Expression model and evaluation (AOSP precedence and percent rules)
  // ======================================================================
  // Tokens: {k:'num', s:'12.5'} {k:'op', v:'+-*/^'} {k:'neg'} {k:'lp'} {k:'rp'}
  //         {k:'fn', v:'sin'...} (opens a bracket) {k:'sqrt'} {k:'post', v:'%'|'!'|'²'} {k:'const', v:'π'|'e'}
  let tokens = [];
  let resultShown = false;
  let resultValue = 0;
  let resultText = '';
  let errorText = '';
  let inverse = false;
  let degrees = false;
  let past = [];
  try { past = JSON.parse(store.get('history') || '[]'); } catch (e) { past = []; }
  if (!Array.isArray(past)) past = [];

  const last = () => tokens[tokens.length - 1];
  const canEnd = (t) => !!t && (t.k === 'num' || t.k === 'rp' || t.k === 'const' || t.k === 'post');
  const startsOperand = (t) => !!t && (t.k === 'num' || t.k === 'const' || t.k === 'lp' || t.k === 'fn' || t.k === 'sqrt');
  const openCount = (ts) => ts.reduce((n, t) => n + (t.k === 'lp' || t.k === 'fn' ? 1 : t.k === 'rp' ? -1 : 0), 0);
  const interesting = (ts) => ts.some((t, i) => t.k === 'op' || t.k === 'fn' || t.k === 'sqrt' || t.k === 'post' ||
    t.k === 'const' || t.k === 'lp' || (t.k === 'neg' && i > 0));

  class CalcError extends Error {}

  function factorial(n) {
    if (n < 0 || !Number.isInteger(n)) throw new CalcError('Domain error');
    if (n > 170) throw new CalcError('Value too large');
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
  }

  function evaluate(ts) {
    let i = 0;
    const peek = () => ts[i];
    const toRad = (x) => (degrees ? (x * Math.PI) / 180 : x);
    const fromRad = (x) => (degrees ? (x * 180) / Math.PI : x);
    const clean = (x) => (Math.abs(x) < 1e-15 ? 0 : x);

    function expr() {
      let left = term();
      let v = left.v;
      while (peek() && peek().k === 'op' && (peek().v === '+' || peek().v === '-')) {
        const op = ts[i++].v;
        const right = term();
        // A + B% is A × (1 + B/100), A − B% is A × (1 − B/100)
        const r = right.pct ? v * right.v : right.v;
        v = op === '+' ? v + r : v - r;
      }
      return v;
    }
    function term() {
      let f = unary();
      let v = f.v, count = 1, pct = f.pct;
      for (;;) {
        const t = peek();
        if (t && t.k === 'op' && (t.v === '*' || t.v === '/')) {
          i++;
          const r = unary().v;
          if (t.v === '/') {
            if (r === 0) throw new CalcError(v === 0 ? 'Undefined' : "Can't divide by 0");
            v /= r;
          } else v *= r;
          count++;
        } else if (startsOperand(t) || (t && t.k === 'neg' && false)) {
          v *= unary().v; // implied multiplication: 2(3), 2π
          count++;
        } else break;
      }
      return { v, pct: count === 1 && pct };
    }
    function unary() {
      if (peek() && peek().k === 'neg') {
        i++;
        const r = unary();
        return { v: -r.v, pct: r.pct };
      }
      return power();
    }
    function power() {
      const base = sqrt();
      if (peek() && peek().k === 'op' && peek().v === '^') {
        i++;
        const e = unary().v;
        if (base.v === 0 && e === 0) throw new CalcError('0⁰ is ambiguous');
        const r = Math.pow(base.v, e);
        if (Number.isNaN(r)) throw new CalcError('Domain error');
        return { v: r, pct: false };
      }
      return base;
    }
    function sqrt() {
      if (peek() && peek().k === 'sqrt') {
        i++;
        const r = sqrt().v;
        if (r < 0) throw new CalcError('Keep it real');
        return { v: Math.sqrt(r), pct: false };
      }
      return postfix();
    }
    function postfix() {
      const p = primary();
      let v = p.v, pct = false, first = true;
      while (peek() && peek().k === 'post') {
        const op = ts[i++].v;
        if (op === '%') { v /= 100; pct = first && p.literal; }
        else if (op === '!') { v = factorial(v); pct = false; }
        else { v = v * v; pct = false; }
        first = false;
      }
      return { v, pct };
    }
    function primary() {
      const t = ts[i++];
      if (!t) throw new CalcError('Format error');
      if (t.k === 'num') {
        if (t.s === '.') throw new CalcError('Format error');
        return { v: parseFloat(t.s), literal: true };
      }
      if (t.k === 'const') return { v: t.v === 'π' ? Math.PI : Math.E };
      if (t.k === 'lp') {
        const v = expr();
        if (peek() && peek().k === 'rp') i++;
        return { v };
      }
      if (t.k === 'fn') {
        const x = expr();
        if (peek() && peek().k === 'rp') i++;
        let v;
        switch (t.v) {
          case 'sin': v = clean(Math.sin(toRad(x))); break;
          case 'cos': v = clean(Math.cos(toRad(x))); break;
          case 'tan':
            if (Math.abs(Math.cos(toRad(x))) < 1e-15) throw new CalcError('Undefined');
            v = clean(Math.tan(toRad(x))); break;
          case 'asin': if (Math.abs(x) > 1) throw new CalcError('Domain error'); v = fromRad(Math.asin(x)); break;
          case 'acos': if (Math.abs(x) > 1) throw new CalcError('Domain error'); v = fromRad(Math.acos(x)); break;
          case 'atan': v = fromRad(Math.atan(x)); break;
          case 'ln': if (x <= 0) throw new CalcError('Domain error'); v = Math.log(x); break;
          case 'log': if (x <= 0) throw new CalcError('Domain error'); v = Math.log10(x); break;
          case 'exp': v = Math.exp(x); break;
          default: throw new CalcError('Format error');
        }
        return { v };
      }
      throw new CalcError('Format error');
    }

    if (!ts.length) throw new CalcError('Format error');
    const v = expr();
    if (i < ts.length) throw new CalcError('Format error');
    if (!Number.isFinite(v)) throw new CalcError('Value too large');
    return v;
  }

  // The live preview ignores trailing operators and closes open brackets.
  function trimmed(ts) {
    const out = ts.slice();
    while (out.length && !canEnd(out[out.length - 1])) out.pop();
    return out;
  }

  function tryEval(ts) {
    try { return { v: evaluate(trimmed(ts)) }; } catch (e) { return { err: e instanceof CalcError ? e.message : 'Format error' }; }
  }

  // ---------- Formatting ----------
  const MINUS = '−';
  function groupInt(s) {
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, LOCALE.group);
  }
  function formatTyped(s) {
    const [i, f] = s.split('.');
    return (i ? groupInt(i) : '') + (f !== undefined ? LOCALE.decimal + f : '');
  }
  const OP_TEXT = { '+': '+', '-': MINUS, '*': '×', '/': '÷', '^': '^' };
  const FN_TEXT = { sin: 'sin(', cos: 'cos(', tan: 'tan(', asin: 'sin⁻¹(', acos: 'cos⁻¹(', atan: 'tan⁻¹(', ln: 'ln(', log: 'log(', exp: 'exp(' };
  function tokenText(t) {
    switch (t.k) {
      case 'num': return formatTyped(t.s);
      case 'op': return OP_TEXT[t.v];
      case 'neg': return MINUS;
      case 'lp': return '(';
      case 'rp': return ')';
      case 'fn': return FN_TEXT[t.v];
      case 'sqrt': return '√';
      case 'post': return t.v;
      case 'const': return t.v;
    }
    return '';
  }
  const formulaText = (ts) => ts.map(tokenText).join('');

  // A computed value, the way the app shows it: as many digits as fit, E notation when huge
  // or tiny, grouped, never with float noise (0.1 + 0.2 shows 0.3).
  function formatValue(v, maxChars = 16) {
    if (v === 0 || Object.is(v, -0)) return '0';
    const r = Number(v.toPrecision(13));
    const neg = r < 0;
    const abs = Math.abs(r);
    const sign = neg ? MINUS : '';
    const intDigits = abs >= 1 ? Math.floor(Math.log10(abs)) + 1 : 1;
    const groupedLen = intDigits + Math.floor((intDigits - 1) / 3);
    if (intDigits > 15 || groupedLen + (neg ? 1 : 0) > maxChars || abs < 1e-6) {
      for (let d = 10; d >= 0; d--) {
        let [m, e] = abs.toExponential(d).split('e');
        if (m.includes('.')) m = m.replace(/0+$/, '').replace(/\.$/, '');
        const s = sign + m.replace('.', LOCALE.decimal) + 'E' + (e[0] === '+' ? e.slice(1) : e.replace('-', MINUS));
        if (s.length <= maxChars || d === 0) return s;
      }
    }
    const room = maxChars - groupedLen - (neg ? 1 : 0) - 1;
    const decimals = Math.max(0, Math.min(13 - intDigits, room));
    let s = abs.toFixed(decimals);
    if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
    const [i, f] = s.split('.');
    return sign + groupInt(i) + (f ? LOCALE.decimal + f : '');
  }

  // A value as a plain digit string to type, e.g. "1234" or "0.25", or null.
  function plain(v) {
    if (!Number.isFinite(v)) return null;
    let s = String(Number(Math.abs(v).toPrecision(12)));
    if (s.includes('e')) {
      if (Math.abs(v) >= 1e15) return null;
      s = Math.abs(v).toFixed(12).replace(/0+$/, '').replace(/\.$/, '');
    }
    return (v < 0 ? '-' : '') + s;
  }

  // Shrink text to fit, between max and min sizes; past that it's cut at the left.
  function fit(el, box, max, min) {
    el.style.fontSize = max + 'px';
    const avail = box.clientWidth - parseFloat(box.style.paddingLeft || 0) - parseFloat(box.style.paddingRight || 0) - 4;
    const w = el.scrollWidth;
    if (w > avail) el.style.fontSize = Math.max(min, (max * avail) / w) + 'px';
  }

  function render() {
    previewEl.classList.remove('error');
    if (resultShown) {
      formulaEl.textContent = resultText;
      formulaEl.classList.add('result');
      cursorEl.classList.add('off');
      previewEl.textContent = '';
    } else {
      formulaEl.textContent = formulaText(tokens);
      formulaEl.classList.remove('result');
      cursorEl.classList.remove('off');
      if (errorText) {
        previewEl.textContent = errorText;
        previewEl.classList.add('error');
      } else if (interesting(tokens)) {
        const r = tryEval(tokens);
        previewEl.textContent = r.err || trimmed(tokens).length === 0 ? '' : formatValue(r.v);
      } else previewEl.textContent = '';
    }
    fit(formulaEl, formulaBox, fontSizes.formulaMax, fontSizes.formulaMin);
    cursorEl.style.height = parseFloat(formulaEl.style.fontSize) * 1.25 + 'px';
    fit(previewEl, previewBox, fontSizes.previewMax, fontSizes.previewMin);
    keyEl.deg.firstChild.textContent = degrees ? 'Rad' : 'Deg';
    for (const [k, , label] of SCIENTIFIC) {
      if (INVERSE_LABEL[k]) keyEl[k].firstChild.textContent = inverse ? INVERSE_LABEL[k] : label;
    }
    keyEl.inv.classList.toggle('on', inverse);
    placeSpecks();
  }

  // ======================================================================
  // Input (AOSP rules)
  // ======================================================================
  // After =, an operator, %, ! or ² carries on from the result; anything else starts afresh.
  function continueFromResult() {
    if (!resultShown) return;
    const s = plain(resultValue);
    tokens = s === null ? [] : s[0] === '-' ? [{ k: 'neg' }, { k: 'num', s: s.slice(1) }] : [{ k: 'num', s }];
    resultShown = false;
  }
  function freshFromResult() {
    if (!resultShown) return;
    tokens = [];
    resultShown = false;
  }

  function typeDigit(d) {
    freshFromResult();
    errorText = '';
    const t = last();
    if (t && t.k === 'num') {
      if (d === '.') { if (!t.s.includes('.')) t.s += '.'; }
      else if (t.s === '0') t.s = d;
      else t.s += d;
    } else {
      if (canEnd(t)) tokens.push({ k: 'op', v: '*' });
      tokens.push({ k: 'num', s: d });
    }
  }

  function typeOperator(op) {
    continueFromResult();
    errorText = '';
    const t = last();
    if (!t || t.k === 'lp' || t.k === 'fn' || t.k === 'sqrt') {
      if (op === '-') tokens.push({ k: 'neg' });
      return;
    }
    if (t.k === 'op' || t.k === 'neg') {
      if (op === '-' && t.k === 'op' && (t.v === '*' || t.v === '/' || t.v === '^')) { tokens.push({ k: 'neg' }); return; }
      while (last() && (last().k === 'op' || last().k === 'neg')) tokens.pop();
      const before = last();
      if (!before || before.k === 'lp' || before.k === 'fn' || before.k === 'sqrt') {
        if (op === '-') tokens.push({ k: 'neg' });
        return;
      }
    }
    tokens.push({ k: 'op', v: op });
  }

  function typeParens() {
    freshFromResult();
    errorText = '';
    const t = last();
    if (openCount(tokens) > 0 && canEnd(t)) tokens.push({ k: 'rp' });
    else tokens.push({ k: 'lp' });
  }

  function typePostfix(p) {
    continueFromResult();
    errorText = '';
    if (canEnd(last())) tokens.push({ k: 'post', v: p });
  }

  function typeFunction(fn) {
    freshFromResult();
    errorText = '';
    if (fn === 'sqrt') tokens.push({ k: 'sqrt' });
    else tokens.push({ k: 'fn', v: fn });
  }

  function typeConstant(c) {
    freshFromResult();
    errorText = '';
    tokens.push({ k: 'const', v: c });
  }

  function backspace() {
    errorText = '';
    if (resultShown) continueFromResult();
    const t = last();
    if (!t) return;
    if (t.k === 'num' && t.s.length > 1) t.s = t.s.slice(0, -1);
    else tokens.pop();
  }

  function clearAll() {
    tokens = [];
    resultShown = false;
    errorText = '';
  }

  function equals() {
    if (resultShown || !interesting(tokens)) return;
    const ts = trimmed(tokens);
    if (!ts.length) return;
    let v;
    try { v = evaluate(ts); } catch (e) {
      errorText = e instanceof CalcError ? e.message : 'Format error';
      return;
    }
    showResult(formulaText(tokens), v);
  }

  function showResult(formula, v) {
    past.push({ f: formula, r: formatValue(v) });
    if (past.length > 100) past.shift();
    store.set('history', JSON.stringify(past));
    resultValue = v;
    resultText = formatValue(v, 14);
    resultShown = true;
    errorText = '';
  }

  // ======================================================================
  // The force
  // ======================================================================
  const force = { target: null, armed: false, seq: '', idx: 0 };
  let specksOn = store.get('specks') !== 'off';
  let speckGuide = null; // what the specks show; refreshed on = and operators only

  // The tell, on the history icon's minute hand: as drawn (about half past four) when nothing
  // is set, half past seven when a force number is set, six o'clock when every digit is in.
  function tell() {
    const done = force.armed && force.idx >= force.seq.length;
    const end = done ? '480,-282' : force.target !== null ? '340,-340' : '620,-340';
    hands.setAttribute('points', '480,-680 480,-480 ' + end);
  }

  function setTarget(v) {
    if (!Number.isFinite(v) || v === 0) return;
    force.target = Number(v.toPrecision(12));
    store.set('target', String(force.target));
    speckGuide = null;
    tell();
  }

  function clearTarget() {
    force.target = null;
    store.remove('target');
    speckGuide = null;
    disarm();
  }

  function disarm() {
    force.armed = false;
    force.seq = '';
    force.idx = 0;
    tell();
  }

  // The expression there would be after pressing op now.
  function prospective(op) {
    let base;
    if (resultShown) {
      const s = plain(resultValue);
      if (s === null) return null;
      base = s[0] === '-' ? [{ k: 'neg' }, { k: 'num', s: s.slice(1) }] : [{ k: 'num', s }];
    } else {
      base = tokens.map((t) => ({ ...t }));
      while (base.length && (base[base.length - 1].k === 'op' || base[base.length - 1].k === 'neg')) base.pop();
      if (!canEnd(base[base.length - 1])) return null;
    }
    return base.concat([{ k: 'op', v: op }]);
  }

  // The number that, typed after op, lands on the force number (signed), or NaN.
  function neededFor(op) {
    const ts = prospective(op);
    if (!ts || force.target === null) return NaN;
    const f = (q) => { try { return evaluate(ts.concat([{ k: 'num', s: String(q) }])); } catch (e) { return NaN; } };
    const f0 = f(0), f1 = f(1), f2 = f(2);
    const slope = f1 - f0;
    if (!Number.isFinite(slope) || slope === 0) return NaN;
    if (Math.abs(f2 - 2 * f1 + f0) > 1e-9 * Math.max(1, Math.abs(f2))) return NaN; // not linear
    return Number(((force.target - f0) / slope).toPrecision(12));
  }

  // Which of + or − reaches the force number, and the digits to type after it.
  function guide() {
    if (force.target === null || force.armed) return null;
    const need = neededFor('+');
    if (!Number.isFinite(need) || need === 0) return null;
    const op = need > 0 ? '+' : '-';
    const seq = plain(Math.abs(need));
    if (!seq || !/^\d+(\.\d+)?$/.test(seq)) return null;
    const count = (seq.match(/\d/g) || []).length;
    if (count > MAX_SPECK_DIGITS) return null;
    // Typing it must really land on the force number, as the app would show it.
    const ts = prospective(op);
    let v;
    try { v = evaluate(ts.concat([{ k: 'num', s: seq }])); } catch (e) { return null; }
    if (formatValue(v) !== formatValue(force.target) || Math.abs(v - force.target) > 1e-9 * Math.max(1, Math.abs(force.target))) return null;
    return { op, seq, count };
  }

  function refreshSpecks() { speckGuide = guide(); }

  function placeSpecks() {
    keysEl.querySelectorAll('.speck-on').forEach((k) => k.classList.remove('speck-on'));
    const g = speckGuide;
    if (!g || !specksOn || force.armed || force.target === null) return;
    keyEl[g.op].classList.add('speck-on');
    if (keyEl[String(g.count)]) keyEl[String(g.count)].classList.add('speck-on');
  }

  function arm(seq) {
    speckGuide = null;
    force.seq = seq;
    force.idx = 0;
    force.armed = true;
    tell();
  }

  const digitsComplete = () => force.armed && force.idx >= force.seq.length;

  function feedDigit() {
    if (digitsComplete()) return null;
    const ch = force.seq[force.idx++];
    typeDigit(ch);
    render();
    tell();
    return ch;
  }

  function finishForce() {
    const t = force.target;
    showResult(formulaText(tokens), t);
    clearTarget();
    render();
  }

  // ======================================================================
  // Key dispatch
  // ======================================================================
  function press(key) {
    if (force.armed) {
      if (digitsComplete() && key === '=') finishForce();
      return;
    }
    // Pressing the operator again with nothing typed arms the force, but only on the operator
    // the speck points to, so the sum always really reaches the force number.
    if ((key === '+' || key === '-') && !resultShown && force.target !== null) {
      const t = last();
      if (t && t.k === 'op' && t.v === key) {
        const saved = tokens;
        tokens = tokens.slice(0, -1);
        const g = guide();
        tokens = saved;
        if (g && g.op === key) { arm(g.seq); render(); return; }
      }
    }
    switch (key) {
      case 'clear': clearAll(); break;
      case 'bs': backspace(); break;
      case 'parens': typeParens(); break;
      case '%': typePostfix('%'); break;
      case '!': typePostfix('!'); break;
      case '=': equals(); refreshSpecks(); break;
      case '+': case '-': case '*': case '/': case '^':
        typeOperator(key);
        refreshSpecks();
        break;
      case 'sqrt': if (inverse) typePostfix('²'); else typeFunction('sqrt'); break;
      case 'sin': case 'cos': case 'tan': typeFunction(inverse ? 'a' + key : key); break;
      case 'ln': typeFunction(inverse ? 'exp' : 'ln'); break;
      case 'log':
        if (inverse) { typeDigit('1'); typeDigit('0'); typeOperator('^'); } else typeFunction('log');
        break;
      case 'pi': typeConstant('π'); break;
      case 'e': typeConstant('e'); break;
      case 'inv': inverse = !inverse; break;
      case 'deg': degrees = !degrees; break;
      default:
        if (/^[0-9.]$/.test(key)) typeDigit(key);
    }
    render();
  }

  // ---------- Touch handling ----------
  function vibrate() {
    try { if (navigator.vibrate) navigator.vibrate(10); } catch (e) { /* ignore */ }
  }

  function ripple(key, x, y) {
    const r = key.getBoundingClientRect();
    const size = Math.hypot(Math.max(x - r.left, r.right - x), Math.max(y - r.top, r.bottom - y)) * 2;
    const s = document.createElement('span');
    s.className = 'ripple';
    s.style.width = s.style.height = size + 'px';
    s.style.left = x - r.left - size / 2 + 'px';
    s.style.top = y - r.top - size / 2 + 'px';
    key.appendChild(s);
    return s;
  }
  function endRipples(key) {
    key.classList.remove('pressed');
    key.querySelectorAll('.ripple:not(.out)').forEach((s) => {
      s.classList.add('out');
      setTimeout(() => s.remove(), 300);
    });
  }

  // While armed, every tap anywhere types the next digit: one digit per gesture however many
  // fingers land. The digit's own key shows the press; the key actually touched doesn't.
  const pointers = new Set();
  const forcedPointers = new Set();
  let litKey = null;
  let lastFeedAt = -Infinity;
  document.addEventListener('pointerdown', (e) => {
    const idle = pointers.size === 0;
    pointers.add(e.pointerId);
    if (!force.armed || digitsComplete()) return;
    forcedPointers.add(e.pointerId);
    if (!idle) return;
    const now = performance.now();
    if (now - lastFeedAt < 60) return;
    lastFeedAt = now;
    vibrate();
    const ch = feedDigit();
    const k = ch && keyEl[ch];
    if (k) {
      const r = k.getBoundingClientRect();
      k.classList.add('pressed');
      ripple(k, r.left + r.width / 2, r.top + r.height / 2);
      litKey = k;
    }
  }, { capture: true });
  const pointerGone = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size === 0) {
      litKey = null;
      // Every finger is up, so no key or button should still look pressed.
      document.querySelectorAll('.key.pressed, .icon-btn.pressed').forEach(endRipples);
      document.querySelectorAll('.ripple:not(.out)').forEach((s) => endRipples(s.parentNode));
    }
    setTimeout(() => forcedPointers.delete(e.pointerId), 0);
  };
  document.addEventListener('pointerup', pointerGone, { capture: true });
  document.addEventListener('pointercancel', pointerGone, { capture: true });
  const resetPointers = () => {
    pointers.clear();
    forcedPointers.clear();
    if (litKey) { endRipples(litKey); litKey = null; }
  };
  document.addEventListener('visibilitychange', resetPointers);

  const keyOf = (e) => (e.target.closest ? e.target.closest('.key') : null);
  let downKey = null;
  keysEl.addEventListener('pointerdown', (e) => {
    const k = keyOf(e);
    if (!k || forcedPointers.has(e.pointerId)) return;
    downKey = { el: k, id: e.pointerId };
    k.classList.add('pressed');
    ripple(k, e.clientX, e.clientY);
    vibrate();
    startKeyHold(k);
  });
  keysEl.addEventListener('pointerup', (e) => {
    const k = keyOf(e);
    if (downKey) endRipples(downKey.el);
    const wasDown = downKey && downKey.id === e.pointerId ? downKey.el : null;
    downKey = null;
    if (endKeyHold()) return;
    if (forcedPointers.has(e.pointerId)) return;
    if (k && k === wasDown) press(k.dataset.key);
  });
  keysEl.addEventListener('pointercancel', () => {
    if (downKey) endRipples(downKey.el);
    downKey = null;
    endKeyHold();
  });
  keysEl.addEventListener('pointerleave', () => { if (downKey) endRipples(downKey.el); downKey = null; endKeyHold(); }, true);

  // Secret holds (not while armed). Letting go never presses the key.
  //   Hold + − × ÷   show the number needed after it (negative on the wrong one)
  //   Hold .          peek at the force number
  //   Hold ⌫          complete reset, force number cleared
  //   Hold %          specks off / on (remembered)
  let holdTimer = null;
  let holdFired = false;
  let peeking = false;
  function startKeyHold(k) {
    clearTimeout(holdTimer);
    holdFired = false;
    if (force.armed) return;
    const key = k.dataset.key;
    let action = null;
    if (['+', '-', '*', '/'].includes(key)) {
      if (force.target === null) return;
      action = () => peek(neededFor(key));
    } else if (key === '.') {
      if (force.target === null) return;
      action = () => peek(force.target);
    } else if (key === 'bs') {
      action = () => { clearTarget(); clearAll(); speckGuide = null; render(); };
    } else if (key === '%') {
      action = () => { specksOn = !specksOn; store.set('specks', specksOn ? 'on' : 'off'); placeSpecks(); };
    } else return;
    holdTimer = setTimeout(() => { holdFired = true; action(); }, HOLD_MS);
  }
  function endKeyHold() {
    clearTimeout(holdTimer);
    holdTimer = null;
    const fired = holdFired;
    holdFired = false;
    if (peeking) { peeking = false; render(); }
    return fired;
  }
  function peek(v) {
    peeking = true;
    formulaEl.textContent = Number.isFinite(v) ? formatValue(v) : 'Error';
    formulaEl.classList.remove('result');
    previewEl.textContent = '';
    fit(formulaEl, formulaBox, fontSizes.formulaMax, fontSizes.formulaMin);
  }

  // ---------- Toolbar ----------
  // The value on screen: a result, a typed number, or what the expression comes to.
  function valueOnScreen() {
    if (resultShown) return resultValue;
    if (!tokens.length) return null;
    const r = tryEval(tokens);
    return r.err ? null : r.v;
  }

  function onPress(el, { tap, hold }) {
    let timer = null, held = false, active = false;
    el.addEventListener('pointerdown', (e) => {
      active = true;
      held = false;
      el.classList.add('pressed');
      const s = ripple(el, e.clientX, e.clientY);
      s.style.opacity = '0.1';
      if (hold) timer = setTimeout(() => { held = true; hold(); }, HOLD_MS);
    });
    const end = (fire) => {
      if (!active) return;
      active = false;
      clearTimeout(timer);
      endRipples(el);
      if (fire && !held && tap) tap();
    };
    el.addEventListener('pointerup', () => end(true));
    el.addEventListener('pointercancel', () => end(false));
    el.addEventListener('pointerleave', () => end(false));
  }

  // History button: tap saves the number on screen as the force number and clears.
  onPress(historyBtn, {
    tap() {
      if (force.armed) return;
      const v = valueOnScreen();
      if (v === null || v === 0) return;
      setTarget(v);
      clearAll();
      render();
    },
  });

  // ⋮: tap for the menu; hold sets the force number to the date and time (as the iPhone
  // version's calculator icon). A single digit 1 to 9 on screen means that many minutes ahead.
  onPress(menuBtn, { tap: openMenu, hold: setDateTimeTarget });

  function setDateTimeTarget() {
    if (force.armed || resultShown) return;
    let ahead = 0;
    if (tokens.length) {
      if (tokens.length === 1 && tokens[0].k === 'num' && /^[1-9]$/.test(tokens[0].s)) ahead = Number(tokens[0].s);
      else return;
    }
    const d = new Date();
    d.setMinutes(d.getMinutes() + ahead);
    const day = String(d.getDate());
    const month = String(d.getMonth() + 1);
    const year = String(d.getFullYear()).slice(-2);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const dayFirst = !/^en-US|^en-CA|^en-PH/.test(navigator.language || 'en-US') ? true : false;
    const dm = dayFirst ? day + month : month + day;
    const withYear = dm + year + hh + mm;
    setTarget(Number(withYear.length <= 9 ? withYear : dm + hh + mm));
    clearAll();
    render();
  }

  // Chevron: tap expands the scientific keys; hold opens the colour setup.
  onPress(chevron, {
    tap() { expanded = !expanded; layout(); },
    hold: openSetup,
  });

  // ---------- Menu and theme dialog ----------
  const menu = $('menu');
  const menuScrim = $('menuScrim');
  function openMenu() {
    menu.hidden = false;
    menuScrim.hidden = false;
    const W = geometry.W;
    menu.style.right = Math.max(8, W - (W - 12.9)) + 'px';
    menu.style.top = (geometry.landscape ? 0.16 * geometry.H : 0.083 * geometry.H) - 12 + 'px';
  }
  function closeMenu() { menu.hidden = true; menuScrim.hidden = true; }
  menuScrim.addEventListener('pointerup', closeMenu);
  menu.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    closeMenu();
    if (b.dataset.menu === 'clear') { past = []; store.set('history', '[]'); }
    if (b.dataset.menu === 'theme') openThemeDialog();
  });

  const dialog = $('themeDialog');
  const dialogScrim = $('dialogScrim');
  function openThemeDialog() {
    dialog.querySelectorAll('input').forEach((i) => { i.checked = i.value === themeSetting; });
    dialog.hidden = false;
    dialogScrim.hidden = false;
  }
  function closeThemeDialog() { dialog.hidden = true; dialogScrim.hidden = true; }
  $('themeCancel').addEventListener('click', closeThemeDialog);
  dialogScrim.addEventListener('click', closeThemeDialog);
  $('themeOk').addEventListener('click', () => {
    const c = dialog.querySelector('input:checked');
    if (c) { themeSetting = c.value; store.set('theme', themeSetting); applyPalette(); }
    closeThemeDialog();
  });

  // ---------- History panel (swipe down on the display) ----------
  const historyEl = $('history');
  const historyList = $('historyList');
  let historyOpen = false;
  function placeHistory() {
    const top = geometry.landscape ? 0.47 * geometry.H : 0.41 * geometry.H;
    historyEl.style.height = top + 'px';
  }
  function openHistory() {
    historyList.innerHTML = '';
    if (!past.length) {
      const d = document.createElement('div');
      d.className = 'history-empty';
      d.textContent = 'No history';
      historyList.appendChild(d);
    }
    for (const h of past.slice(-30)) {
      const d = document.createElement('div');
      d.className = 'history-item';
      const f = document.createElement('div'); f.className = 'f'; f.textContent = h.f;
      const r = document.createElement('div'); r.className = 'r'; r.textContent = h.r;
      d.append(f, r);
      historyList.appendChild(d);
    }
    historyOpen = true;
    placeHistory();
    historyEl.hidden = false;
    historyList.scrollTop = historyList.scrollHeight;
  }
  function closeHistory() { historyOpen = false; historyEl.hidden = true; }
  let swipe = null;
  $('display').addEventListener('pointerdown', (e) => { swipe = { x: e.clientX, y: e.clientY }; });
  document.addEventListener('pointerup', (e) => {
    if (!swipe) return;
    const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
    swipe = null;
    if (force.armed) return;
    if (dy > 60 && Math.abs(dx) < dy) openHistory();
  });
  let hSwipe = null;
  historyEl.addEventListener('pointerdown', (e) => { hSwipe = e.clientY; });
  historyEl.addEventListener('pointerup', (e) => {
    if (hSwipe !== null && (hSwipe - e.clientY > 40 || e.target.closest('#historyHandle'))) closeHistory();
    hSwipe = null;
  });

  // ======================================================================
  // Colour setup: read the phone's colours from a screenshot of the real app
  // ======================================================================
  const setupEl = $('setup');
  function openSetup() {
    if (force.armed) return;
    setupEl.hidden = false;
    $('setupNote').textContent = '';
    drawSwatches();
  }
  $('setupDone').addEventListener('click', () => { setupEl.hidden = true; applyPalette(); render(); });
  function drawSwatches() {
    for (const row of setupEl.querySelectorAll('.setup-row')) {
      const p = paletteFor(row.dataset.scheme);
      const sw = row.querySelector('.swatches');
      sw.innerHTML = '';
      for (const k of ['bg', 'digitBg', 'opBg', 'acBg', 'digitFg', 'opFg', 'acFg', 'eqBg']) {
        const s = document.createElement('span');
        s.style.background = p[k];
        sw.appendChild(s);
      }
    }
  }
  for (const row of setupEl.querySelectorAll('.setup-row')) {
    const s = row.dataset.scheme;
    row.querySelector('[data-reset]').addEventListener('click', () => {
      store.remove('palette.' + s);
      drawSwatches();
      applyPalette();
    });
    row.querySelector('input[type=file]').addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!file) return;
      try {
        const p = await paletteFromScreenshot(file);
        const lum = luminance(p.bg);
        const got = lum < 0.5 ? 'dark' : 'light';
        store.set('palette.' + got, JSON.stringify(p));
        $('setupNote').textContent = got === s ? '' : 'That screenshot is in ' + got + ' mode, so it was saved as the ' + got + ' colours.';
        drawSwatches();
        applyPalette();
      } catch (err) {
        $('setupNote').textContent = "Couldn't read the keys in that screenshot. Use a full-screen screenshot of the real Calculator, upright, with the scientific keys closed.";
      }
    });
  }

  const hex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  function luminance(h) {
    const n = parseInt(h.slice(1), 16);
    return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  }

  async function paletteFromScreenshot(file) {
    const img = await createImageBitmap(file);
    const W = img.width, H = img.height;
    if (H < W) throw new Error('landscape');
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const data = g.getImageData(0, 0, W, H).data;
    const px = (x, y) => {
      const i = (Math.round(y) * W + Math.round(x)) * 4;
      return [data[i], data[i + 1], data[i + 2]];
    };
    const avg = (x0, y0, x1, y1) => {
      const acc = [0, 0, 0]; let n = 0;
      for (let y = y0; y <= y1; y += 2) for (let x = x0; x <= x1; x += 2) { const p = px(x, y); acc[0] += p[0]; acc[1] += p[1]; acc[2] += p[2]; n++; }
      return acc.map((v) => v / n);
    };

    // Background: the empty middle of the chevron row.
    const bg = avg(W * 0.45, H * 0.35, W * 0.55, H * 0.37);

    // Key rows: runs that differ from the background, going up the first column from the
    // bottom. The lowest five are the standard pad.
    const x = W * 0.125;
    const rows = [];
    let runEnd = null;
    for (let y = Math.floor(H * 0.995); y > H * 0.3; y--) {
      const on = dist(px(x, y), bg) > 14;
      if (on && runEnd === null) runEnd = y;
      if (!on && runEnd !== null) {
        if (runEnd - y > H * 0.03) rows.push([y + 1, runEnd]);
        runEnd = null;
        if (rows.length === 5) break;
      }
    }
    if (rows.length < 5) throw new Error('no keys');
    rows.reverse(); // top to bottom: AC row, 7 row, 4 row, 1 row, 0 row

    const keyW = W * 0.235;
    function keyColours(row, col) {
      const [y0, y1] = rows[row];
      const yc = (y0 + y1) / 2, h = y1 - y0;
      const xc = W * (0.125 + 0.25 * col);
      const fill = avg(xc - keyW * 0.36, yc - h * 0.04, xc - keyW * 0.3, yc + h * 0.04);
      // The glyph: the pixels furthest from the fill, near the middle of the key.
      let best = 0;
      const cand = [];
      for (let y = y0 + h * 0.25; y <= y1 - h * 0.25; y += 1) {
        for (let xx = xc - keyW * 0.22; xx <= xc + keyW * 0.22; xx += 1) {
          const p = px(xx, y);
          const d = dist(p, fill);
          if (d > best) best = d;
          cand.push([d, p]);
        }
      }
      const core = cand.filter(([d]) => d >= best * 0.85).map(([, p]) => p);
      const fg = core.reduce((a, p) => [a[0] + p[0], a[1] + p[1], a[2] + p[2]], [0, 0, 0]).map((v) => v / core.length);
      return { fill, fg };
    }
    const ac = keyColours(0, 0), op = keyColours(0, 3), digit = keyColours(1, 0), eq = keyColours(4, 3);

    // History icon colour: furthest from the background in the top-left, under the status bar.
    let icon = digit.fg, far = 0;
    for (let y = H * 0.05; y < H * 0.12; y += 1) {
      for (let xx = W * 0.03; xx < W * 0.16; xx += 1) {
        const p = px(xx, y);
        const d = dist(p, bg);
        if (d > far) { far = d; icon = p; }
      }
    }
    const dark = luminance(hex(bg)) < 0.5;
    return {
      bg: hex(bg),
      digitBg: hex(digit.fill), digitFg: hex(digit.fg),
      opBg: hex(op.fill), opFg: hex(op.fg),
      acBg: hex(ac.fill), acFg: hex(ac.fg),
      eqBg: hex(eq.fill), eqFg: hex(eq.fg),
      icon: hex(icon),
      outline: hex(mix(digit.fg, bg, 0.45)),
      panel: hex(mix(bg, digit.fill, 0.35)),
      menuBg: hex(digit.fill),
      cursor: hex(ac.fg),
      error: dark ? '#f2b8b5' : '#b3261e',
    };
  }

  // ======================================================================
  // Startup
  // ======================================================================
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });

  // Back gesture: each tap leaves one history entry behind, so a stray back swipe mid-routine
  // closes the menu or history instead of the app. Chrome only allows this after a tap.
  document.addEventListener('pointerup', () => {
    if (!window.history.state || !window.history.state.calc) {
      try { window.history.pushState({ calc: 1 }, ''); } catch (e) { /* ignore */ }
    }
  }, { capture: true });
  window.addEventListener('popstate', () => {
    closeMenu();
    closeThemeDialog();
    closeHistory();
    setupEl.hidden = true;
  });

  // Keyboard, for testing on a computer.
  document.addEventListener('keydown', (e) => {
    const map = { Enter: '=', Backspace: 'bs', Escape: 'clear', x: '*', X: '*', '(': 'parens', ')': 'parens', ',': '.' };
    const key = map[e.key] || e.key;
    if (!/^[0-9.+\-*/=%^!]$/.test(key) && !['bs', 'clear', 'parens'].includes(key)) return;
    e.preventDefault();
    if (force.armed && !digitsComplete()) { feedDigit(); return; }
    press(key);
  });

  window.addEventListener('resize', layout);
  if (window.ResizeObserver) new ResizeObserver(layout).observe(calcEl);

  // ?t=1234 presets the force number (handy from a shortcut). ?setup=1 opens the colour setup.
  const params = new URLSearchParams(location.search);
  const saved = parseFloat(store.get('target'));
  if (Number.isFinite(saved)) force.target = saved;
  if (params.get('t')) setTarget(parseFloat(params.get('t')));
  const wantSetup = params.has('setup');
  if (params.toString()) window.history.replaceState(null, '', location.pathname);

  if ('serviceWorker' in navigator && location.protocol === 'https:' && !location.search.includes('nosw')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  applyPalette();
  tell();
  layout();
  if (wantSetup) openSetup();
  if (document.fonts && document.fonts.load) {
    document.fonts.load('400 40px GSF').then(() => { measureCapRatio(); layout(); }).catch(() => {});
  }

  // Test hooks (not reachable from the UI).
  window.__calc = {
    press, tap: feedDigit, setTarget, clearTarget, neededFor, guide, layout,
    paletteFromScreenshot, applyPalette,
    state: () => ({ tokens: tokens.map((t) => ({ ...t })), formula: formulaEl.textContent, preview: previewEl.textContent, resultShown, force: { ...force }, specks: speckGuide && { ...speckGuide } }),
  };
})();
