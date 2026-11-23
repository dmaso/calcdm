(() => {
  'use strict';

  // A working copy of Samsung Calculator (One UI 8.5 and 9) with the calcdm force built in.
  // Layout percentages, colours, limits and messages come from the app's own resources. The
  // force works as in the iPhone version: tap the history clock to save the number on screen,
  // read the specks, tap the marked operator twice, and every tap after that types the next
  // digit of the number that's needed.

  const $ = (id) => document.getElementById(id);
  const calcEl = $('calc');
  const probe = $('safeProbe');
  const keysEl = $('keys');
  const formulaBox = $('formulaBox');
  const formulaEl = $('formula');
  const formulaText = $('formulaText');
  const cursorEl = $('cursor');
  const previewBox = $('previewBox');
  const previewEl = $('preview');
  const historyBtn = $('historyBtn');
  const rulerBtn = $('rulerBtn');
  const sciBtn = $('sciBtn');
  const minuteHand = $('minuteHand');
  const bubble = $('bubble');
  const toastEl = $('toast');

  const HOLD_MS = 700;
  const MAX_SPECK_DIGITS = 9;
  const MAX_DIGITS = 15;
  const MAX_DECIMALS = 10;
  const MAX_CHARS = 200;
  const MAX_OPERATORS = 40;
  const P = 'scalc.';
  const store = {
    get(k) { try { return localStorage.getItem(P + k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(P + k, v); } catch (e) { /* private mode */ } },
    remove(k) { try { localStorage.removeItem(P + k); } catch (e) { /* ignore */ } },
  };

  // ---------- Number format from the phone's language and region ----------
  const LOCALE = (() => {
    let group = ',', decimal = '.';
    try {
      for (const p of new Intl.NumberFormat(navigator.language).formatToParts(12345.6)) {
        if (p.type === 'group') group = p.value;
        if (p.type === 'decimal') decimal = p.value;
      }
    } catch (e) { /* defaults */ }
    if (group === decimal || /\s/.test(group)) group = decimal === ',' ? '.' : ',';
    return { group, decimal };
  })();
  document.documentElement.lang = navigator.language || 'en';

  // ======================================================================
  // Keys
  // ======================================================================
  const BACKSPACE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"><path d="M8.6 5.5H19.3A2.2 2.2 0 0 1 21.5 7.7V16.3A2.2 2.2 0 0 1 19.3 18.5H8.6L2.8 12Z"/><path d="M10.9 9.4L16 14.6M16 9.4L10.9 14.6"/></svg>';

  // [key, class, label, size in dp at 360dp wide (the app's text sizes)]
  const STANDARD = [
    ['clear', 'fn red', 'C', 32], ['bs', 'fn red', null, 0], ['%', 'fn', '%', 29], ['/', 'op', '÷', 42],
    ['7', 'num', '7', 32], ['8', 'num', '8', 32], ['9', 'num', '9', 32], ['*', 'op', '×', 42],
    ['4', 'num', '4', 32], ['5', 'num', '5', 32], ['6', 'num', '6', 32], ['-', 'op', '−', 46],
    ['1', 'num', '1', 32], ['2', 'num', '2', 32], ['3', 'num', '3', 32], ['+', 'op', '+', 42],
    ['parens', 'fn paren', '( )', 24], ['0', 'num', '0', 32], ['.', 'num', LOCALE.decimal, 26], ['=', 'eq', '=', 44],
  ];
  const SCIENTIFIC = [
    ['swap', 'sci', '⇆', 19], ['rad', 'sci', 'Rad', 17], ['sqrt', 'sci', '√', 19], ['abs', 'sci', '|x|', 17],
    ['sin', 'sci', 'sin', 17], ['cos', 'sci', 'cos', 17], ['tan', 'sci', 'tan', 17], ['pi', 'sci', 'π', 19],
    ['ln', 'sci', 'ln', 17], ['log', 'sci', 'log', 17], ['recip', 'sci', '1/x', 17], ['e', 'sci', 'e', 19],
    ['exp', 'sci', 'eˣ', 17], ['sq', 'sci', 'x²', 17], ['pow', 'sci', 'xʸ', 17], ['negate', 'sci', '+/−', 17],
  ];
  const INVERSE_LABEL = { sin: 'sin⁻¹', cos: 'cos⁻¹', tan: 'tan⁻¹', ln: 'eˣ', log: '10ˣ', sqrt: 'x²' };

  const keyEl = {};
  const keySize = {};
  for (const [key, cls, label, size] of STANDARD.concat(SCIENTIFIC)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'key ' + cls;
    b.dataset.key = key;
    if (key === 'bs') {
      b.innerHTML = BACKSPACE_SVG;
      b.setAttribute('aria-label', 'Backspace');
    } else {
      b.innerHTML = '<span class="lbl"></span>';
      b.firstChild.textContent = label;
    }
    keysEl.appendChild(b);
    keyEl[key] = b;
    keySize[key] = size;
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
  // Layout (the app's percentages)
  // ======================================================================
  let sci = false;
  let geometry = { W: 0, H: 0, landscape: false, scale: 1 };
  const fontSizes = { steps: [38, 33, 23], preview: 23 };

  const place = (el, x, y, w, h) => {
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.width = w + 'px';
    el.style.height = h + 'px';
  };

  function sizeKey(key, x, y, w, h, scale) {
    const el = keyEl[key];
    place(el, x, y, w, h);
    el.classList.remove('hidden');
    el.style.setProperty('--ks', (Math.min(w, h) / 84.25).toFixed(3));
    if (key === 'bs') {
      const s = 30 * scale;
      el.firstChild.style.width = s + 'px';
      el.firstChild.style.height = s + 'px';
    } else {
      el.firstChild.style.fontSize = keySize[key] * scale + 'px';
    }
  }

  function layout() {
    const W = calcEl.clientWidth;
    const H = calcEl.clientHeight - (parseFloat(getComputedStyle(probe).paddingBottom) || 0);
    if (!W || !H) return;
    const landscape = W > H;
    for (const k in keyEl) keyEl[k].classList.add('hidden');

    if (!landscape) {
      // Top bar 10.184%, expression 20.934%, preview 7.355%, suggestion row 5.658%, keypad the rest.
      const bar = 0.10184 * H;
      const s = W / 360;
      // Icons centred below an 11.111% top padding, as in the app.
      const iconTop = 0.11111 * bar + (0.88889 * bar - 40) / 2;
      place(historyBtn, 24 * s - 8, iconTop, 40, 40);
      place(sciBtn, W - 24 * s - 32, iconTop, 40, 40);
      place(rulerBtn, W - 24 * s - 72, iconTop, 40, 40);
      const fTop = bar, fH = 0.20934 * H;
      place(formulaBox, 24 * s, fTop, W - 48 * s, fH);
      place(previewBox, 24 * s, fTop + fH, W - 48 * s, 0.07355 * H);
      const kTop = H * (0.10184 + 0.20934 + 0.07355 + 0.05658);
      const K = H - kTop;

      if (!sci) {
        // 4 x 5 round keys: margins 6.8%, gaps 4.7%, keys 18.075% of the width; vertically
        // 3.02% top, 3.16% gaps, 2.52% bottom of the keypad area.
        const D = Math.min(0.18075 * W, ((1 - 0.0302 - 0.0252 - 4 * 0.0316) * K) / 5);
        const first = kTop + 0.0302 * K + D / 2;
        const lastC = H - 0.0252 * K - D / 2;
        const scale = D / 65.07;
        STANDARD.forEach(([key], i) => {
          const r = Math.floor(i / 4), c = i % 4;
          const cx = W * (0.068 + 0.090375 + c * (0.18075 + 0.047));
          const cy = first + (r * (lastC - first)) / 4;
          sizeKey(key, cx - D / 2, cy - D / 2, D, D, scale);
        });
        geometry.scale = scale;
      } else {
        // Scientific: 4 x 9 pills, 57 x 32dp on a 360dp screen (15.8% of the width), 10dp gaps,
        // 19dp above and below, anchored to the bottom.
        const s2 = Math.min(W / 360, (H - bar - 0.2 * H) / 406);
        const kw = 0.158 * W, kh = 32 * s2, gap = 10 * s2;
        const top = H - 19 * s2 - 9 * kh - 8 * gap;
        const list = SCIENTIFIC.map((k) => k[0]).concat(STANDARD.map((k) => k[0]));
        list.forEach((key, i) => {
          const r = Math.floor(i / 4), c = i % 4;
          const x = W * (0.067 + c * (0.158 + 0.078));
          sizeKey(key, x, top + r * (kh + gap), kw, kh, s2 * 0.62);
        });
        geometry.scale = s2 * 0.62;
      }
      fontSizes.steps = [38, 33, 23].map((v) => v * s);
      fontSizes.preview = 23 * s;
    } else {
      // Sideways: the scientific keys on the left, the standard ones on the right, as pills.
      const s = H / 360;
      const bar = 0.16 * H;
      place(historyBtn, 24 * s, (bar - 40) / 2, 40, 40);
      place(sciBtn, W - 24 * s - 40, (bar - 40) / 2, 40, 40);
      place(rulerBtn, W - 24 * s - 80, (bar - 40) / 2, 40, 40);
      place(formulaBox, 40 * s, bar, W - 80 * s, 0.17 * H);
      place(previewBox, 40 * s, bar + 0.17 * H, W - 80 * s, 0.09 * H);
      const top = 0.44 * H, bottom = H - 11 * s;
      const rows = 5, gapY = 8 * s;
      const kh = (bottom - top - (rows - 1) * gapY) / rows;
      const side = 24 * s, gapX = 12 * s, mid = 40 * s;
      const kw = (W - 2 * side - mid - 6 * gapX) / 8;
      const sciKeys = SCIENTIFIC.map((k) => k[0]);
      sciKeys.forEach((key, i) => {
        const r = Math.floor(i / 4), c = i % 4;
        sizeKey(key, side + c * (kw + gapX), top + r * (kh + gapY), kw, kh, s * 0.75);
      });
      const right = side + 4 * kw + 3 * gapX + mid;
      STANDARD.forEach(([key], i) => {
        const r = Math.floor(i / 4), c = i % 4;
        sizeKey(key, right + c * (kw + gapX), top + r * (kh + gapY), kw, kh, Math.min(s, kh / 52) * 0.9);
      });
      fontSizes.steps = [32, 28, 22].map((v) => v * s);
      fontSizes.preview = 20 * s;
      geometry.scale = s;
    }
    geometry = { ...geometry, W, H, landscape };
    calcEl.classList.toggle('sci', sci || landscape);
    render();
  }

  // ======================================================================
  // Expression model and evaluation
  // ======================================================================
  // Tokens: {k:'num', s:'12.5'} {k:'op', v:'+-*/^'} {k:'neg'} {k:'lp'} {k:'rp'}
  //         {k:'fn', v:'sin'...} (opens a bracket) {k:'post', v:'%'} {k:'const', v:'π'|'e'}
  let tokens = [];
  let resultShown = false;
  let resultValue = 0;
  let repeat = null; // { op, operand } for pressing = again
  let inverse = false;
  let degrees = true; // Samsung starts in degrees; the key offers Rad
  let past = [];
  try { past = JSON.parse(store.get('history') || '[]'); } catch (e) { past = []; }
  if (!Array.isArray(past)) past = [];

  const last = () => tokens[tokens.length - 1];
  const canEnd = (t) => !!t && (t.k === 'num' || t.k === 'rp' || t.k === 'const' || t.k === 'post');
  const startsOperand = (t) => !!t && (t.k === 'num' || t.k === 'const' || t.k === 'lp' || t.k === 'fn');
  const openCount = (ts) => ts.reduce((n, t) => n + (t.k === 'lp' || t.k === 'fn' ? 1 : t.k === 'rp' ? -1 : 0), 0);
  const hasOperation = (ts) => ts.some((t, i) => t.k === 'op' || t.k === 'fn' || t.k === 'post' ||
    t.k === 'const' || (t.k === 'neg' && i > 1));

  class CalcError extends Error {}
  const DIV0 = "Can't divide by zero.";
  const UNDEF = "Can't show undefined result.";
  const RANGE = 'Calculation outside of accepted range.';
  const FORMAT = 'Invalid format used.';

  function evaluate(ts) {
    let i = 0;
    const peek = () => ts[i];
    const toRad = (x) => (degrees ? (x * Math.PI) / 180 : x);
    const fromRad = (x) => (degrees ? (x * 180) / Math.PI : x);
    const clean = (x) => (Math.abs(x) < 1e-15 ? 0 : x);

    function expr() {
      let v = term().v;
      while (peek() && peek().k === 'op' && (peek().v === '+' || peek().v === '-')) {
        const op = ts[i++].v;
        const right = term();
        const r = right.pct ? v * right.v : right.v; // 50+10% = 55
        v = op === '+' ? v + r : v - r;
      }
      return { v };
    }
    function term() {
      const f = unary();
      let v = f.v, count = 1;
      for (;;) {
        const t = peek();
        if (t && t.k === 'op' && (t.v === '*' || t.v === '/')) {
          i++;
          const r = unary().v;
          if (t.v === '/') {
            if (r === 0) throw new CalcError(v === 0 ? UNDEF : DIV0);
            v /= r;
          } else v *= r;
          count++;
        } else if (startsOperand(t)) {
          v *= unary().v;
          count++;
        } else break;
      }
      return { v, pct: count === 1 && f.pct };
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
      const base = postfix();
      if (peek() && peek().k === 'op' && peek().v === '^') {
        i++;
        const e = unary().v;
        const r = Math.pow(base.v, e);
        if (Number.isNaN(r)) throw new CalcError(FORMAT);
        return { v: r, pct: false };
      }
      return base;
    }
    function postfix() {
      const p = primary();
      let v = p.v, pct = false, first = true;
      while (peek() && peek().k === 'post') {
        i++;
        v /= 100;
        pct = first && p.literal;
        first = false;
      }
      return { v, pct };
    }
    function primary() {
      const t = ts[i++];
      if (!t) throw new CalcError(FORMAT);
      if (t.k === 'num') {
        if (t.s === '.') throw new CalcError(FORMAT);
        return { v: parseFloat(t.s), literal: true };
      }
      if (t.k === 'const') return { v: t.v === 'π' ? Math.PI : Math.E };
      if (t.k === 'lp') {
        const v = expr().v;
        if (peek() && peek().k === 'rp') i++;
        return { v };
      }
      if (t.k === 'fn') {
        const x = expr().v;
        if (peek() && peek().k === 'rp') i++;
        let v;
        switch (t.v) {
          case 'sin': v = clean(Math.sin(toRad(x))); break;
          case 'cos': v = clean(Math.cos(toRad(x))); break;
          case 'tan':
            if (Math.abs(Math.cos(toRad(x))) < 1e-15) throw new CalcError(FORMAT);
            v = clean(Math.tan(toRad(x))); break;
          case 'asin': if (Math.abs(x) > 1) throw new CalcError(FORMAT); v = fromRad(Math.asin(x)); break;
          case 'acos': if (Math.abs(x) > 1) throw new CalcError(FORMAT); v = fromRad(Math.acos(x)); break;
          case 'atan': v = fromRad(Math.atan(x)); break;
          case 'ln': if (x <= 0) throw new CalcError(FORMAT); v = Math.log(x); break;
          case 'log': if (x <= 0) throw new CalcError(FORMAT); v = Math.log10(x); break;
          case 'sqrt': if (x < 0) throw new CalcError(FORMAT); v = Math.sqrt(x); break;
          case 'abs': v = Math.abs(x); break;
          case 'exp': v = Math.exp(x); break;
          default: throw new CalcError(FORMAT);
        }
        return { v };
      }
      throw new CalcError(FORMAT);
    }

    if (!ts.length) throw new CalcError(FORMAT);
    const v = expr().v;
    if (i < ts.length) throw new CalcError(FORMAT);
    if (!Number.isFinite(v) || Math.abs(v) >= 1e100) throw new CalcError(RANGE);
    return v;
  }

  // Trailing operators are ignored and open brackets closed, for the preview and for =.
  function trimmed(ts) {
    const out = ts.slice();
    while (out.length && !canEnd(out[out.length - 1])) out.pop();
    return out;
  }
  function tryEval(ts) {
    try { return { v: evaluate(trimmed(ts)) }; } catch (e) { return { err: e instanceof CalcError ? e.message : FORMAT }; }
  }

  // ---------- Formatting ----------
  const MINUS = '−';
  const groupInt = (s) => s.replace(/\B(?=(\d{3})+(?!\d))/g, LOCALE.group);
  function formatTyped(s) {
    const [i, f] = s.split('.');
    return (i ? groupInt(i) : '') + (f !== undefined ? LOCALE.decimal + f : '');
  }
  const OP_TEXT = { '+': '+', '-': MINUS, '*': '×', '/': '÷', '^': '^' };
  const FN_TEXT = { sin: 'sin(', cos: 'cos(', tan: 'tan(', asin: 'sin⁻¹(', acos: 'cos⁻¹(', atan: 'tan⁻¹(',
    ln: 'ln(', log: 'log(', sqrt: '√(', abs: 'abs(', exp: 'e^(' };

  // Results: 15 significant digits at most, 10 decimal places at most, grouped, E notation
  // when huge or tiny.
  function formatValue(v) {
    if (v === 0 || Object.is(v, -0)) return '0';
    const r = Number(v.toPrecision(15));
    const abs = Math.abs(r);
    const sign = r < 0 ? MINUS : '';
    if (abs >= 1e15 || abs < 1e-6) {
      let [m, e] = abs.toExponential(8).split('e');
      m = m.replace(/0+$/, '').replace(/\.$/, '');
      const n = parseInt(e, 10);
      return sign + m.replace('.', LOCALE.decimal) + 'E' + (n < 0 ? MINUS + -n : '+' + n);
    }
    let s = abs.toFixed(MAX_DECIMALS);
    const intDigits = s.split('.')[0].length;
    s = abs.toFixed(Math.max(0, Math.min(MAX_DECIMALS, 15 - intDigits)));
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
      s = Math.abs(v).toFixed(10).replace(/0+$/, '').replace(/\.$/, '');
    }
    return (v < 0 ? '-' : '') + s;
  }

  function tokenText(t) {
    switch (t.k) {
      case 'num': return formatTyped(t.s);
      case 'op': return OP_TEXT[t.v];
      case 'neg': return MINUS;
      case 'lp': return '(';
      case 'rp': return ')';
      case 'fn': return FN_TEXT[t.v];
      case 'post': return '%';
      case 'const': return t.v;
    }
    return '';
  }
  const plainText = (ts) => ts.map(tokenText).join('');

  // The expression, with operators in the accent colour.
  function fillFormula(ts) {
    formulaText.textContent = '';
    for (const t of ts) {
      const txt = tokenText(t);
      if (t.k === 'op' || t.k === 'neg') {
        const s = document.createElement('span');
        s.className = 'o';
        s.textContent = txt;
        formulaText.appendChild(s);
      } else formulaText.appendChild(document.createTextNode(txt));
    }
  }

  // Large, then medium, then small; past that it wraps onto more lines.
  function fitFormula() {
    formulaEl.classList.remove('wrap');
    const avail = formulaBox.clientWidth - 4;
    for (const size of fontSizes.steps) {
      formulaEl.style.fontSize = size + 'px';
      if (formulaEl.scrollWidth <= avail) return;
    }
    formulaEl.classList.add('wrap');
  }

  function render() {
    if (resultShown) {
      formulaText.textContent = formatValue(resultValue);
      formulaEl.classList.add('result');
      cursorEl.classList.add('off');
      previewEl.textContent = '';
    } else {
      fillFormula(tokens);
      formulaEl.classList.remove('result');
      cursorEl.classList.remove('off');
      let text = '';
      if (hasOperation(tokens)) {
        const r = tryEval(tokens);
        if (!r.err && trimmed(tokens).length) text = formatValue(r.v);
      }
      previewEl.textContent = text;
    }
    fitFormula();
    previewEl.style.fontSize = fontSizes.preview + 'px';
    keyEl.rad.firstChild.textContent = degrees ? 'Rad' : 'Deg';
    for (const [k, , label] of SCIENTIFIC) {
      if (INVERSE_LABEL[k]) keyEl[k].firstChild.textContent = inverse ? INVERSE_LABEL[k] : label;
    }
    keyEl.sqrt.firstChild.textContent = inverse ? 'x²' : '√';
    keyEl.swap.classList.toggle('on', inverse);
    historyBtn.classList.toggle('off', past.length === 0);
    placeSpecks();
  }

  // ---------- Toasts ----------
  let toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    toastEl.style.bottom = Math.max(64, geometry.H * 0.08) + 'px';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2000);
  }

  // ======================================================================
  // Input (Samsung's rules)
  // ======================================================================
  function continueFromResult() {
    if (!resultShown) return;
    const s = plain(resultValue);
    tokens = s === null ? [] : s[0] === '-' ? [{ k: 'lp' }, { k: 'neg' }, { k: 'num', s: s.slice(1) }, { k: 'rp' }] : [{ k: 'num', s }];
    resultShown = false;
  }
  function freshFromResult() {
    if (!resultShown) return;
    tokens = [];
    resultShown = false;
  }
  const operatorCount = () => tokens.filter((t) => t.k === 'op').length;

  // forced: the force's own digits skip the limit toasts (they're within limits anyway).
  function typeDigit(d, forced) {
    freshFromResult();
    const t = last();
    if (!forced && plainText(tokens).length >= MAX_CHARS) { toast(`Can't enter more than ${MAX_CHARS} characters.`); return false; }
    if (t && t.k === 'num') {
      if (d === '.') {
        if (!t.s.includes('.')) t.s += '.';
        return true;
      }
      const [ip, fp] = t.s.split('.');
      if (!forced && (ip.replace(/^0+/, '').length + (fp || '').length) >= MAX_DIGITS) { toast(`Can't enter more than ${MAX_DIGITS} digits.`); return false; }
      if (!forced && fp !== undefined && fp.length >= MAX_DECIMALS) { toast(`Can't enter more than ${MAX_DECIMALS} digits after decimal point.`); return false; }
      if (t.s === '0') t.s = d;
      else t.s += d;
    } else {
      if (canEnd(t)) tokens.push({ k: 'op', v: '*' });
      tokens.push({ k: 'num', s: d === '.' ? '0.' : d });
    }
    return true;
  }

  function typeOperator(op) {
    continueFromResult();
    const t = last();
    if (!t) {
      if (op === '-') tokens.push({ k: 'lp' }, { k: 'neg' });
      return;
    }
    if (t.k === 'lp' || t.k === 'fn') {
      if (op === '-') tokens.push({ k: 'neg' });
      return;
    }
    if (t.k === 'op' || t.k === 'neg') {
      // − after × or ÷ starts a negative number in brackets: 5×(−
      if (op === '-' && t.k === 'op' && (t.v === '*' || t.v === '/')) { tokens.push({ k: 'lp' }, { k: 'neg' }); return; }
      if (t.k === 'neg') return;
      tokens[tokens.length - 1] = { k: 'op', v: op }; // a second operator replaces the first
      return;
    }
    if (operatorCount() >= MAX_OPERATORS) { toast(`Can't enter more than ${MAX_OPERATORS} operators.`); return; }
    tokens.push({ k: 'op', v: op });
  }

  // Smart brackets: after a number, ) or %, it closes an open bracket, or opens one with ×.
  function typeParens() {
    freshFromResult();
    const t = last();
    if (canEnd(t)) {
      if (openCount(tokens) > 0) tokens.push({ k: 'rp' });
      else tokens.push({ k: 'op', v: '*' }, { k: 'lp' });
    } else tokens.push({ k: 'lp' });
  }

  function typePercent() {
    continueFromResult();
    if (canEnd(last())) tokens.push({ k: 'post', v: '%' });
  }

  // +/−: wraps the number being typed as (−5, and back again.
  function negate() {
    continueFromResult();
    let i = tokens.length - 1;
    if (i >= 0 && tokens[i].k === 'num') {
      if (i >= 2 && tokens[i - 1].k === 'neg' && tokens[i - 2].k === 'lp') tokens.splice(i - 2, 2);
      else tokens.splice(i, 0, { k: 'lp' }, { k: 'neg' });
    } else if (!canEnd(last())) tokens.push({ k: 'lp' }, { k: 'neg' });
  }

  function typeFunction(fn) {
    freshFromResult();
    if (canEnd(last())) tokens.push({ k: 'op', v: '*' });
    tokens.push({ k: 'fn', v: fn });
  }

  function typeConstant(c) {
    freshFromResult();
    if (canEnd(last())) tokens.push({ k: 'op', v: '*' });
    tokens.push({ k: 'const', v: c });
  }

  function backspace() {
    if (resultShown) continueFromResult();
    const t = last();
    if (!t) return;
    if (t.k === 'num' && t.s.length > 1) {
      t.s = t.s.slice(0, -1);
      if (t.s === '0' && tokens.length === 1) tokens = [{ k: 'num', s: '0' }];
    } else tokens.pop();
  }

  function clearAll() {
    tokens = [];
    resultShown = false;
    repeat = null;
  }

  function errorFeedback(msg) {
    toast(msg);
    try { if (navigator.vibrate) navigator.vibrate([30, 60, 30]); } catch (e) { /* ignore */ }
  }

  function equals() {
    if (resultShown) {
      // = again repeats the last operation: 2+3 = 5, = 8
      if (!repeat) return;
      try { setResult(plainText([{ k: 'num', s: plain(resultValue) || '0' }, { k: 'op', v: repeat.op }, { k: 'num', s: repeat.operand }]), evaluate([{ k: 'num', s: plain(resultValue) || '0' }, { k: 'op', v: repeat.op }, { k: 'num', s: repeat.operand }])); } catch (e) { errorFeedback(e.message); }
      return;
    }
    if (!tokens.length) return;
    const ts = trimmed(tokens);
    if (!ts.length) return;
    if (!hasOperation(tokens)) return;
    let v;
    try { v = evaluate(ts); } catch (e) {
      errorFeedback(e instanceof CalcError ? e.message : FORMAT);
      return;
    }
    const n = ts.length;
    repeat = n >= 3 && ts[n - 1].k === 'num' && ts[n - 2].k === 'op' ? { op: ts[n - 2].v, operand: ts[n - 1].s } : null;
    setResult(plainText(ts), v);
  }

  function setResult(formula, v) {
    past.push({ f: formula, r: formatValue(v) });
    if (past.length > 100) past.shift();
    store.set('history', JSON.stringify(past));
    resultValue = v;
    resultShown = true;
  }

  // ======================================================================
  // The force
  // ======================================================================
  const force = { target: null, armed: false, seq: '', idx: 0 };
  let specksOn = store.get('specks') !== 'off';
  let speckGuide = null; // refreshed on = and operators only

  // The tell, on the history clock's minute hand: 3 o'clock nothing saved, 9 o'clock saved,
  // 6 o'clock every digit is in.
  function tell() {
    const done = force.armed && force.idx >= force.seq.length;
    minuteHand.setAttribute('d', done ? 'M12 13 V16.2' : force.target !== null ? 'M12 13 H8.8' : 'M12 13 H15.2');
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

  function prospective(op) {
    let base;
    if (resultShown) {
      const s = plain(resultValue);
      if (s === null) return null;
      base = s[0] === '-' ? [{ k: 'lp' }, { k: 'neg' }, { k: 'num', s: s.slice(1) }, { k: 'rp' }] : [{ k: 'num', s }];
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
    if (Math.abs(f2 - 2 * f1 + f0) > 1e-9 * Math.max(1, Math.abs(f2))) return NaN;
    return Number(((force.target - f0) / slope).toPrecision(12));
  }

  function guide() {
    if (force.target === null || force.armed) return null;
    const need = neededFor('+');
    if (!Number.isFinite(need) || need === 0) return null;
    const op = need > 0 ? '+' : '-';
    const seq = plain(Math.abs(need));
    if (!seq || !/^\d+(\.\d+)?$/.test(seq)) return null;
    const count = (seq.match(/\d/g) || []).length;
    if (count > MAX_SPECK_DIGITS) return null;
    let v;
    try { v = evaluate(prospective(op).concat([{ k: 'num', s: seq }])); } catch (e) { return null; }
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
    typeDigit(ch, true);
    render();
    tell();
    return ch;
  }

  function finishForce() {
    const ts = trimmed(tokens);
    repeat = null;
    setResult(plainText(ts), force.target);
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
    // The operator again with nothing typed arms the force, but only on the operator the speck
    // points to, so the sum always really reaches the force number.
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
      case '%': typePercent(); break;
      case '=': equals(); refreshSpecks(); break;
      case '+': case '-': case '*': case '/':
        typeOperator(key);
        refreshSpecks();
        break;
      case 'swap': inverse = !inverse; break;
      case 'rad': degrees = !degrees; break;
      case 'sqrt':
        if (inverse) { continueFromResult(); if (canEnd(last())) tokens.push({ k: 'op', v: '^' }, { k: 'lp' }, { k: 'num', s: '2' }, { k: 'rp' }); }
        else typeFunction('sqrt');
        break;
      case 'abs': typeFunction('abs'); break;
      case 'sin': case 'cos': case 'tan': typeFunction(inverse ? 'a' + key : key); break;
      case 'ln': typeFunction(inverse ? 'exp' : 'ln'); break;
      case 'log':
        if (inverse) { freshFromResult(); if (canEnd(last())) tokens.push({ k: 'op', v: '*' }); tokens.push({ k: 'num', s: '10' }, { k: 'op', v: '^' }, { k: 'lp' }); }
        else typeFunction('log');
        break;
      case 'recip': freshFromResult(); if (canEnd(last())) tokens.push({ k: 'op', v: '*' }); tokens.push({ k: 'num', s: '1' }, { k: 'op', v: '/' }); break;
      case 'exp': typeFunction('exp'); break;
      case 'sq': continueFromResult(); if (canEnd(last())) tokens.push({ k: 'op', v: '^' }, { k: 'lp' }, { k: 'num', s: '2' }, { k: 'rp' }); break;
      case 'pow': continueFromResult(); if (canEnd(last())) tokens.push({ k: 'op', v: '^' }, { k: 'lp' }); break;
      case 'negate': negate(); break;
      case 'pi': typeConstant('π'); break;
      case 'e': typeConstant('e'); break;
      default:
        if (/^[0-9.]$/.test(key)) typeDigit(key, false);
    }
    render();
  }

  // ---------- Touch handling ----------
  function vibrate() {
    try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) { /* ignore */ }
  }

  // While armed, every tap anywhere types the next digit: one digit per gesture however many
  // fingers land. The digit's own key glows; the key actually touched doesn't.
  const pointers = new Set();
  const forcedPointers = new Set();
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
    if (ch && keyEl[ch]) keyEl[ch].classList.add('pressed');
  }, { capture: true });
  const pointerGone = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size === 0) document.querySelectorAll('.pressed').forEach((k) => k.classList.remove('pressed'));
    setTimeout(() => forcedPointers.delete(e.pointerId), 0);
  };
  document.addEventListener('pointerup', pointerGone, { capture: true });
  document.addEventListener('pointercancel', pointerGone, { capture: true });
  document.addEventListener('visibilitychange', () => {
    pointers.clear();
    forcedPointers.clear();
    document.querySelectorAll('.pressed').forEach((k) => k.classList.remove('pressed'));
  });

  const keyOf = (e) => (e.target.closest ? e.target.closest('.key') : null);
  let downKey = null;
  keysEl.addEventListener('pointerdown', (e) => {
    const k = keyOf(e);
    if (!k || forcedPointers.has(e.pointerId)) return;
    downKey = { el: k, id: e.pointerId };
    k.classList.add('pressed');
    vibrate();
    startKeyHold(k, e);
  });
  keysEl.addEventListener('pointerup', (e) => {
    const k = keyOf(e);
    if (downKey) downKey.el.classList.remove('pressed');
    const wasDown = downKey && downKey.id === e.pointerId ? downKey.el : null;
    downKey = null;
    if (endKeyHold()) return;
    if (forcedPointers.has(e.pointerId)) return;
    if (k && k === wasDown) press(k.dataset.key);
  });
  keysEl.addEventListener('pointercancel', () => {
    if (downKey) downKey.el.classList.remove('pressed');
    downKey = null;
    endKeyHold();
  });

  // Secret holds (not while armed). Letting go never presses the key.
  //   Hold + − × ÷   show the number needed after it (negative on the wrong one)
  //   Hold .          peek at the force number
  //   Hold ⌫          complete reset, force number cleared
  //   Hold %          specks off / on (remembered)
  //   Hold ( )        the +/− bubble, as in the real app: letting go types +/−
  let holdTimer = null;
  let holdFired = false;
  let peeking = false;
  let onLetGo = null;
  function startKeyHold(k) {
    clearTimeout(holdTimer);
    holdFired = false;
    onLetGo = null;
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
      action = () => { clearTarget(); clearAll(); render(); };
    } else if (key === '%') {
      action = () => { specksOn = !specksOn; store.set('specks', specksOn ? 'on' : 'off'); placeSpecks(); };
    } else if (key === 'parens') {
      action = () => {
        const r = k.getBoundingClientRect();
        bubble.style.left = r.left + r.width / 2 + 'px';
        bubble.style.top = r.top - 8 + 'px';
        bubble.hidden = false;
        onLetGo = () => { bubble.hidden = true; negate(); render(); };
      };
    } else return;
    holdTimer = setTimeout(() => { holdFired = true; action(); }, HOLD_MS);
  }
  function endKeyHold() {
    clearTimeout(holdTimer);
    holdTimer = null;
    const fired = holdFired;
    holdFired = false;
    if (peeking) { peeking = false; render(); }
    if (onLetGo) { const f = onLetGo; onLetGo = null; if (fired) f(); }
    bubble.hidden = true;
    return fired;
  }
  function peek(v) {
    peeking = true;
    formulaText.textContent = Number.isFinite(v) ? formatValue(v) : 'Error';
    formulaEl.classList.remove('result');
    previewEl.textContent = '';
    fitFormula();
  }

  // ---------- Top bar ----------
  function valueOnScreen() {
    if (resultShown) return resultValue;
    if (!tokens.length) return null;
    const r = tryEval(tokens);
    return r.err ? null : r.v;
  }

  function onPress(el, { tap, hold }) {
    let timer = null, held = false, active = false;
    el.addEventListener('pointerdown', () => {
      active = true;
      held = false;
      el.classList.add('pressed');
      if (hold) timer = setTimeout(() => { held = true; hold(); }, HOLD_MS);
    });
    const end = (fire) => {
      if (!active) return;
      active = false;
      clearTimeout(timer);
      el.classList.remove('pressed');
      if (fire && !held && tap) tap();
    };
    el.addEventListener('pointerup', () => end(true));
    el.addEventListener('pointercancel', () => end(false));
    el.addEventListener('pointerleave', () => end(false));
  }

  // History clock: tap saves the number on screen as the force number and clears.
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

  // Ruler: hold sets the force number to the date and time (as the iPhone version's calculator
  // icon). A single digit 1 to 9 on screen means that many minutes ahead.
  onPress(rulerBtn, { hold: setDateTimeTarget });
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
    const dayFirst = !/^en-(US|CA|PH)/.test(navigator.language || 'en-US');
    const dm = dayFirst ? day + month : month + day;
    const withYear = dm + year + hh + mm;
    setTarget(Number(withYear.length <= 9 ? withYear : dm + hh + mm));
    clearAll();
    render();
  }

  // √ box: the scientific keys.
  onPress(sciBtn, { tap() { if (!force.armed) { sci = !sci; layout(); } } });

  // ======================================================================
  // Startup
  // ======================================================================
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });

  // Back gesture: each tap leaves one history entry behind, so one stray back swipe mid-routine
  // doesn't close the app. Chrome only allows this after a tap.
  document.addEventListener('pointerup', () => {
    if (!window.history.state || !window.history.state.calc) {
      try { window.history.pushState({ calc: 1 }, ''); } catch (e) { /* ignore */ }
    }
  }, { capture: true });
  window.addEventListener('popstate', () => { if (sci) { sci = false; layout(); } });

  // Keyboard, for testing on a computer.
  document.addEventListener('keydown', (e) => {
    const map = { Enter: '=', Backspace: 'bs', Escape: 'clear', x: '*', X: '*', '(': 'parens', ')': 'parens', ',': '.' };
    const key = map[e.key] || e.key;
    if (!/^[0-9.+\-*/=%]$/.test(key) && !['bs', 'clear', 'parens'].includes(key)) return;
    e.preventDefault();
    if (force.armed && !digitsComplete()) { feedDigit(); return; }
    press(key);
  });

  window.addEventListener('resize', layout);
  if (window.ResizeObserver) new ResizeObserver(layout).observe(calcEl);
  if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', render);

  // ?t=1234 presets the force number (handy from a shortcut).
  const params = new URLSearchParams(location.search);
  const saved = parseFloat(store.get('target'));
  if (Number.isFinite(saved)) force.target = saved;
  if (params.get('t')) setTarget(parseFloat(params.get('t')));
  if (params.toString()) window.history.replaceState(null, '', location.pathname);

  if ('serviceWorker' in navigator && location.protocol === 'https:' && !location.search.includes('nosw')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  tell();
  layout();
  if (document.fonts && document.fonts.load) document.fonts.load('300 32px RobotoW').then(layout).catch(() => {});

  // Test hooks (not reachable from the UI).
  window.__calc = {
    press, tap: feedDigit, setTarget, clearTarget, neededFor, guide, layout,
    state: () => ({ tokens: tokens.map((t) => ({ ...t })), formula: formulaText.textContent, preview: previewEl.textContent, resultShown, force: { ...force }, specks: speckGuide && { ...speckGuide } }),
  };
})();
