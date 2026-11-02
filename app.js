(() => {
  'use strict';

  // ---------- DOM ----------
  const displayEl = document.getElementById('display');
  const textEl = document.getElementById('displayText');
  const exprEl = document.getElementById('expr');
  const exprTextEl = document.getElementById('exprText');
  const keypad = document.getElementById('keypad');
  const clearKey = document.getElementById('clearKey');
  const historyBtn = document.getElementById('historyBtn');
  const modeBtn = document.getElementById('modeBtn');
  const minuteHand = document.getElementById('minuteHand');
  const decimalKey = keypad.querySelector('[data-key="."]');
  const toastEl = document.getElementById('toast');

  const MAX_DIGITS = 9;
  const BASE_FONT = 64;
  const MIN_SCALE = 0.75;
  const LONG_PRESS_MS = 700;
  const STORAGE_KEY = 'calc.target';
  const FORMAT_KEY = 'calc.format';
  const TOAST_MS = 1400;
  const DOUBLE_TAP_MS = 400;

  // ---------- Calculator state ----------
  // raw: the expression as entered, alternating numbers and operators, e.g. [55, '+', 6623, '+'].
  //      It's what the big line shows. It never contains the number currently being typed.
  // tokens: the evaluation stack derived from raw, reduced by precedence as iOS does.
  let raw = [];
  let tokens = [];
  let entry = null; // string being typed ("12.5", "-0"), or null
  let shown = 0; // result shown when nothing is pending
  let lastOp = null; // for repeated "="
  let lastOperand = null;
  let lastExpr = ''; // grey line above a result

  // ---------- Secret force state ----------
  const secret = {
    target: null, // number, or null
    armed: false,
    seq: '', // characters to feed, e.g. "1234" or "12.5"
    idx: 0,
  };

  // ---------- Helpers ----------
  const PREC = { '+': 1, '-': 1, '*': 2, '/': 2 };
  const OP_SYMBOL = { '+': '+', '-': '−', '*': '×', '/': '÷' };

  function apply(a, op, b) {
    switch (op) {
      case '+':
        return a + b;
      case '-':
        return a - b;
      case '*':
        return a * b;
      case '/':
        return b === 0 ? NaN : a / b;
    }
    return b;
  }

  function round9(n) {
    if (!isFinite(n)) return n;
    return parseFloat(n.toPrecision(9));
  }

  function pending() {
    return raw.length > 0;
  }

  // The value the display is "on": the number being typed, the running value of a pending
  // expression, or the last result.
  function currentValue() {
    if (entry !== null) return parseFloat(entry) || 0;
    if (pending()) return tokens[tokens.length - 2];
    return shown;
  }

  // Reduce the token stack while the top operator's precedence >= minPrec.
  function reduce(minPrec) {
    while (tokens.length >= 3) {
      const op = tokens[tokens.length - 2];
      if (PREC[op] < minPrec) break;
      const b = tokens.pop();
      tokens.pop();
      const a = tokens.pop();
      tokens.push(round9(apply(a, op, b)));
    }
  }

  // Rebuild the evaluation stack from the raw expression.
  function rebuild() {
    tokens = [];
    for (const t of raw) {
      if (typeof t === 'string') {
        reduce(PREC[t]);
        tokens.push(t);
      } else tokens.push(t);
    }
  }

  // Number format: US "1,234.56" or European (DIN 5008) "1.234,56". The engine always uses
  // "." internally; only the display changes. US is the default.
  let euro = false;
  try {
    euro = localStorage.getItem(FORMAT_KEY) === 'eu';
  } catch (e) {}
  function groupSep() {
    return euro ? '.' : ',';
  }
  function decMark() {
    return euro ? ',' : '.';
  }

  function groupDigits(intPart) {
    return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, groupSep());
  }

  // Format a typed entry string exactly as typed (keeps trailing "." / zeros).
  function formatEntry(s) {
    let neg = false;
    if (s[0] === '-') {
      neg = true;
      s = s.slice(1);
    }
    const [i, f] = s.split('.');
    let out = groupDigits(i || '0');
    if (f !== undefined) out += decMark() + f;
    return (neg ? '-' : '') + out;
  }

  // Format a computed number the way iOS does (9 significant digits, commas, e-notation when huge).
  function formatNumber(n) {
    if (Number.isNaN(n) || !isFinite(n)) return 'Error';
    if (Object.is(n, -0)) return '-0';
    const abs = Math.abs(n);
    if (abs !== 0 && (abs >= 1e9 || abs < 1e-8)) {
      let [m, e] = n.toExponential(8).split('e');
      m = m.replace(/\.?0+$/, '');
      return m.replace('.', decMark()) + 'e' + (e[0] === '+' ? e.slice(1) : e);
    }
    let s = String(round9(n));
    if (s.includes('e')) s = n.toFixed(9).replace(/\.?0+$/, '');
    let neg = false;
    if (s[0] === '-') {
      neg = true;
      s = s.slice(1);
    }
    const [i, f] = s.split('.');
    let out = groupDigits(i);
    if (f) out += decMark() + f;
    return (neg ? '-' : '') + out;
  }

  // A number as a plain entry string (no commas), for turning results into editable entries.
  function toEntry(n) {
    const s = String(round9(n));
    return s.includes('e') || !isFinite(n) ? null : s;
  }

  function rawText() {
    return raw
      .map((t) => (typeof t === 'string' ? OP_SYMBOL[t] : formatNumber(t)))
      .join('');
  }

  // The big white line: the expression as it's being built, or the number / result.
  function bigText() {
    if (pending())
      return rawText() + (entry !== null ? formatEntry(entry) : '');
    return entry !== null ? formatEntry(entry) : formatNumber(shown);
  }

  // iOS shrinks long text to fit, down to 75% of its size, and beyond that lets it run
  // off the left edge with a fade.
  function fitText(el, container) {
    el.style.fontSize = ''; // back to the CSS size, which scales with screen width
    const base = parseFloat(getComputedStyle(el).fontSize) || BASE_FONT;
    const avail = container.clientWidth;
    if (el.scrollWidth > avail) {
      el.style.fontSize =
        Math.max(base * MIN_SCALE, (base * avail) / el.scrollWidth).toFixed(2) +
        'px';
    }
    container.classList.toggle('clipped', el.scrollWidth > avail + 0.5);
  }

  function fitDisplay() {
    fitText(textEl, displayEl);
    fitText(exprTextEl, exprEl);
  }

  function render() {
    textEl.textContent = bigText();
    exprTextEl.textContent = pending() ? '' : lastExpr;
    clearKey.textContent = entry !== null || pending() ? 'C' : 'AC';
    fitDisplay();
  }

  function resetAll() {
    raw = [];
    tokens = [];
    entry = null;
    shown = 0;
    lastOp = null;
    lastOperand = null;
    lastExpr = '';
    disarm();
    render();
  }

  // ---------- Input handlers ----------
  function inputDigit(d) {
    if (entry === null) {
      if (!pending()) lastExpr = ''; // typing after a result starts fresh
      entry = d === '.' ? '0.' : d;
    } else {
      if (d === '.' && entry.includes('.')) return;
      const digits = entry.replace(/[-.]/g, '').length;
      if (d !== '.' && digits >= MAX_DIGITS) return;
      if (entry === '0' && d !== '.') entry = d;
      else if (entry === '-0' && d !== '.') entry = '-' + d;
      else entry += d;
    }
    render();
  }

  function inputOperator(op) {
    lastOp = null;
    lastExpr = '';
    const last = raw[raw.length - 1];
    if (entry === null && typeof last === 'string') {
      // Operator pressed again with nothing typed in between: the same one arms the force.
      if (last === op && secret.target !== null && !secret.armed) {
        arm(op);
        return;
      }
      raw[raw.length - 1] = op; // change the pending operator
    } else {
      raw.push(currentValue(), op);
    }
    entry = null;
    rebuild();
    render();
  }

  function inputEquals() {
    if (secret.armed) {
      finishForce();
      return;
    }
    if (pending()) {
      const v = currentValue();
      lastOp = raw[raw.length - 1];
      lastOperand = v;
      raw.push(v);
      lastExpr = rawText();
      rebuild();
      reduce(1);
      shown = tokens[0];
    } else if (lastOp !== null) {
      const v = currentValue();
      lastExpr =
        formatNumber(v) + OP_SYMBOL[lastOp] + formatNumber(lastOperand);
      shown = round9(apply(v, lastOp, lastOperand));
    } else {
      shown = currentValue();
      lastExpr = '';
    }
    raw = [];
    tokens = [];
    entry = null;
    render();
  }

  function inputNegate() {
    if (entry !== null) {
      entry = entry[0] === '-' ? entry.slice(1) : '-' + entry;
    } else if (pending()) {
      entry = '-0';
    } else {
      shown = shown === 0 ? -0 : -shown;
      if (Object.is(shown, -0)) entry = '-0';
    }
    render();
  }

  function inputPercent() {
    const v = currentValue();
    const last = raw[raw.length - 1];
    let result;
    if (typeof last === 'string' && (last === '+' || last === '-')) {
      result = (tokens[tokens.length - 2] * v) / 100;
    } else {
      result = v / 100;
    }
    result = round9(result);
    if (pending())
      entry = toEntry(result) ?? '0'; // becomes the operand being entered
    else {
      shown = result;
      entry = null;
    }
    render();
  }

  // C clears the number being typed; AC (or C with nothing typed) clears everything.
  function inputClear() {
    if (entry !== null) {
      entry = null;
      if (!pending()) shown = 0;
      render();
      return;
    }
    resetAll();
  }

  // Deletes the last character of what's on screen: a digit of the number being typed,
  // a trailing operator of the expression, or a digit of a result (which becomes editable).
  function backspace() {
    if (entry === null) {
      if (pending()) {
        raw.pop(); // the trailing operator
        entry = toEntry(raw.pop());
        rebuild();
        render();
        return;
      }
      if (shown === 0) return;
      entry = toEntry(shown);
      if (entry === null) {
        shown = 0;
        render();
        return;
      }
    }
    entry = entry.slice(0, -1);
    if (entry === '' || entry === '-') {
      entry = null;
      if (!pending()) shown = 0;
    }
    render();
  }

  // ---------- Secret force ----------
  function loadTarget() {
    const fromUrl =
      new URLSearchParams(location.search).get('t') ||
      (location.hash.match(/^#t=(.+)$/) || [])[1];
    if (fromUrl !== undefined && fromUrl !== null && fromUrl !== '') {
      setTarget(parseFloat(fromUrl));
      history.replaceState(null, '', location.pathname);
      return;
    }
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null && stored !== '') {
      secret.target = parseFloat(stored);
      if (Number.isNaN(secret.target)) secret.target = null;
    }
    showTell();
  }

  // The tell, on the clock's minute hand:
  //   3 o'clock  nothing set
  //   9 o'clock  target set (and while digits are still being fed)
  //   6 o'clock  all delta digits entered, ready for =
  function showTell() {
    let x2 = 17,
      y2 = 12; // 3 o'clock
    if (secret.armed && secret.idx >= secret.seq.length) {
      x2 = 12;
      y2 = 17;
    } // 6 o'clock
    else if (secret.target !== null) {
      x2 = 7;
      y2 = 12;
    } // 9 o'clock
    minuteHand.setAttribute('x2', String(x2));
    minuteHand.setAttribute('y2', String(y2));
  }

  function setTarget(n) {
    if (Number.isNaN(n) || n === null) return clearTarget();
    secret.target = round9(n);
    localStorage.setItem(STORAGE_KEY, String(secret.target));
    showTell();
  }

  function clearTarget() {
    secret.target = null;
    localStorage.removeItem(STORAGE_KEY);
    showTell();
  }

  function disarm() {
    secret.armed = false;
    secret.seq = '';
    secret.idx = 0;
    showTell();
  }

  // Evaluate a token stack that ends with an operator, with q as the final operand.
  function evalWith(t, q) {
    const saved = tokens;
    tokens = t.concat([q]);
    reduce(1);
    const v = tokens[0];
    tokens = saved;
    return v;
  }

  // The operand q that makes the pending expression (ending in an operator) equal the target.
  // Every operator is linear in its last operand (a + b*q), except ÷ which is a + b/q.
  function solveOperand(t, target) {
    const op = t[t.length - 1];
    if (op === '/') {
      const f1 = evalWith(t, 1),
        f2 = evalWith(t, 2);
      const b = 2 * (f1 - f2),
        a = f1 - b;
      return b / (target - a);
    }
    const f0 = evalWith(t, 0),
      f1 = evalWith(t, 1);
    return (target - f0) / (f1 - f0);
  }

  // The token stack there would be after pressing op now (without changing state).
  function prospectiveTokens(op) {
    const savedRaw = raw,
      savedTokens = tokens;
    raw = raw.slice();
    const last = raw[raw.length - 1];
    if (entry === null && typeof last === 'string') raw[raw.length - 1] = op;
    else raw.push(currentValue(), op);
    rebuild();
    const out = tokens;
    raw = savedRaw;
    tokens = savedTokens;
    return out;
  }

  // The number the spectator would need to enter after op to land on the target.
  function neededFor(op) {
    return round9(solveOperand(prospectiveTokens(op), secret.target));
  }

  function arm(op) {
    let q = solveOperand(tokens, secret.target);
    q = Math.abs(round9(q));
    let seq = isFinite(q) ? String(q) : '0';
    if (seq.includes('e')) seq = q.toFixed(8).replace(/\.?0+$/, '');
    secret.seq = seq;
    secret.idx = 0;
    secret.armed = true;
    showTell();
  }

  function feedForcedChar() {
    if (secret.idx >= secret.seq.length) return;
    const ch = secret.seq[secret.idx++];
    inputDigit(ch);
    showTell();
  }

  // Backspace while armed: remove the last fed digit so the next tap re-enters it.
  function forceBackspace() {
    if (secret.idx === 0 || entry === null) return;
    secret.idx--;
    entry = entry.slice(0, -1);
    if (entry === '') entry = null;
    render();
    showTell();
  }

  function forceEntryComplete() {
    return secret.armed && secret.idx >= secret.seq.length;
  }

  function finishForce() {
    const t = secret.target;
    lastExpr = bigText(); // reads like a genuine sum, e.g. "25×40"
    raw = [];
    tokens = [];
    entry = null;
    shown = t;
    lastOp = null;
    lastOperand = null;
    clearTarget();
    disarm();
    render();
  }

  // ---------- Dispatch ----------
  // Handles key presses from clicks / keyboard. While the force is armed and digits are still
  // owed, taps are consumed by the document-level tap detector below, not here.
  function press(key) {
    if (secret.armed) {
      if (key === 'bs') return forceBackspace();
      if (!forceEntryComplete()) return;
      if (key === '=') return inputEquals();
      if (key === 'clear') return resetAll();
      return;
    }
    switch (key) {
      case 'clear':
        return inputClear();
      case 'bs':
        return backspace();
      case 'negate':
        return inputNegate();
      case 'percent':
        return inputPercent();
      case '+':
      case '-':
      case '*':
      case '/':
        return inputOperator(key);
      case '=':
        return inputEquals();
      default:
        if (/^[0-9.]$/.test(key)) return inputDigit(key);
    }
  }

  // ---------- Whole-screen tap detection while armed ----------
  // One digit per tap gesture, however many fingers land and wherever they land.
  // The backspace key is the exception: it deletes instead.
  const activePointers = new Set();
  let lastFeedAt = 0;
  function onAnyPointerDown(e) {
    const wasIdle = activePointers.size === 0;
    activePointers.add(e.pointerId);
    if (!secret.armed || forceEntryComplete()) return;
    if (e.target.closest && e.target.closest('[data-key="bs"]')) return;
    const now = performance.now();
    if (wasIdle && now - lastFeedAt > 150) {
      lastFeedAt = now;
      feedForcedChar();
    }
  }
  function onAnyPointerEnd(e) {
    activePointers.delete(e.pointerId);
  }
  document.addEventListener('pointerdown', onAnyPointerDown, { capture: true });
  document.addEventListener('pointerup', onAnyPointerEnd, { capture: true });
  document.addEventListener('pointercancel', onAnyPointerEnd, {
    capture: true,
  });
  // Safety net: if a pointerup ever goes missing, an all-fingers-up touchend resets the tracker.
  document.addEventListener(
    'touchend',
    (e) => {
      if (e.touches.length === 0) activePointers.clear();
    },
    { capture: true },
  );
  document.addEventListener(
    'touchcancel',
    (e) => {
      if (e.touches.length === 0) activePointers.clear();
    },
    { capture: true },
  );
  document.addEventListener('visibilitychange', () => activePointers.clear());

  // ---------- Events ----------
  keypad.addEventListener('pointerdown', (e) => {
    const k = e.target.closest('.key');
    if (!k) return;
    k.classList.add('pressed');
  });
  const release = (e) => {
    const k = e.target.closest && e.target.closest('.key');
    if (k) k.classList.remove('pressed');
  };
  keypad.addEventListener('pointerup', release);
  keypad.addEventListener('pointercancel', release);
  keypad.addEventListener('pointerleave', release, true);
  keypad.addEventListener('pointerout', release);

  let swallowClick = false;
  keypad.addEventListener('click', (e) => {
    const k = e.target.closest('.key');
    if (!k) return;
    if (swallowClick) {
      swallowClick = false;
      return;
    }
    press(k.dataset.key);
  });

  // Hold an operator key (target set, not armed): the display shows the number the
  // spectator would need to enter after that operator to reach the target. Releasing
  // restores the display and does not press the operator.
  let opPeekTimer = null;
  let opPeeking = false;
  keypad.addEventListener('pointerdown', (e) => {
    const k = e.target.closest('.key.op');
    if (!k || !PREC[k.dataset.key] || secret.target === null || secret.armed)
      return;
    const op = k.dataset.key;
    clearTimeout(opPeekTimer);
    opPeekTimer = setTimeout(() => {
      opPeeking = true;
      textEl.textContent = formatNumber(neededFor(op));
      fitText(textEl, displayEl);
    }, LONG_PRESS_MS);
  });
  const endOpPeek = () => {
    clearTimeout(opPeekTimer);
    opPeekTimer = null;
    if (opPeeking) {
      opPeeking = false;
      swallowClick = true;
      setTimeout(() => {
        swallowClick = false;
      }, 300);
      render();
    }
  };
  keypad.addEventListener('pointerup', endOpPeek);
  keypad.addEventListener('pointercancel', endOpPeek);
  keypad.addEventListener('pointerleave', endOpPeek, true);

  // Swipe on the display deletes the last character (iOS behaviour).
  let swipeStart = null;
  displayEl.addEventListener('pointerdown', (e) => {
    swipeStart = { x: e.clientX, y: e.clientY };
  });
  displayEl.addEventListener('pointerup', (e) => {
    if (!swipeStart) return;
    const dx = e.clientX - swipeStart.x,
      dy = e.clientY - swipeStart.y;
    swipeStart = null;
    if (secret.armed) return;
    if (Math.abs(dx) > 30 && Math.abs(dy) < 50) backspace();
  });

  // Long-press helper for the two round buttons. onTap, if given, runs on a release
  // before the long press has fired.
  function longPress(btn, onFire, onRelease, onTap) {
    let timer = null;
    let fired = false;
    btn.addEventListener('pointerdown', () => {
      btn.classList.add('pressed');
      fired = false;
      timer = setTimeout(() => {
        fired = true;
        onFire();
      }, LONG_PRESS_MS);
    });
    const end = () => {
      btn.classList.remove('pressed');
      clearTimeout(timer);
      timer = null;
      if (fired && onRelease) onRelease();
      fired = false;
    };
    btn.addEventListener('pointerup', () => {
      const tapped = timer !== null && !fired;
      end();
      if (tapped && onTap) onTap();
    });
    btn.addEventListener('pointercancel', end);
    btn.addEventListener('pointerleave', end);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // History (clock): long-press sets the number on screen as the target and clears the display.
  // Long-press with 0 on screen clears the target.
  longPress(historyBtn, () => {
    if (secret.armed) return;
    const v = currentValue();
    if (v !== 0) setTarget(v);
    else clearTarget();
    resetAll();
  });

  // A short note at the top that fades out by itself.
  let toastTimer = null;
  function showToast(text) {
    toastEl.textContent = text;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), TOAST_MS);
  }

  function applyFormat() {
    decimalKey.textContent = decMark();
  }

  // Switch between US and European number format. Not while armed: every tap is a digit then.
  function toggleFormat() {
    if (secret.armed) return;
    euro = !euro;
    try {
      localStorage.setItem(FORMAT_KEY, euro ? 'eu' : 'us');
    } catch (e) {}
    // The grey line is stored as text, so swap its separators.
    lastExpr = lastExpr.replace(/[.,]/g, (c) => (c === '.' ? ',' : '.'));
    applyFormat();
    render();
    showToast(euro ? 'European · 1.234,56' : 'US · 1,234.56');
  }

  // Two taps within DOUBLE_TAP_MS switch the format. A single tap does nothing, so a stray
  // tap or a peek let go too early can't change the display.
  let lastModeTapAt = -Infinity;
  function onModeTap() {
    const now = performance.now();
    if (now - lastModeTapAt < DOUBLE_TAP_MS) {
      lastModeTapAt = -Infinity;
      toggleFormat();
    } else {
      lastModeTapAt = now;
    }
  }

  // Mode (calculator icon): double-tap to switch the number format; hold to peek at the
  // target, the display restores on release.
  longPress(
    modeBtn,
    () => {
      if (secret.armed || secret.target === null) return;
      textEl.textContent = formatNumber(secret.target);
      fitText(textEl, displayEl);
    },
    () => render(),
    onModeTap,
  );

  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length > 1) e.preventDefault();
    },
    { passive: false },
  );

  // Keyboard support (handy on desktop).
  document.addEventListener('keydown', (e) => {
    const map = {
      Enter: '=',
      '=': '=',
      Backspace: 'bs',
      Escape: 'clear',
      '%': 'percent',
      x: '*',
      X: '*',
      ',': '.',
    };
    const key = map[e.key] || e.key;
    if (
      /^[0-9.+\-*\/=]$/.test(key) ||
      key === 'clear' ||
      key === 'percent' ||
      key === 'bs'
    )
      press(key);
  });

  // Sideways: the CSS blanks the screen. Back in portrait, refit the text and make sure
  // nothing is left scrolled.
  window.addEventListener('resize', () => {
    window.scrollTo(0, 0);
    fitDisplay();
  });

  if (
    'serviceWorker' in navigator &&
    location.protocol !== 'file:' &&
    !location.search.includes('nosw')
  ) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  loadTarget();
  applyFormat();
  render();

  // Debug hooks (not visible in UI).
  window.__calc = {
    press,
    state: () => ({
      raw: raw.slice(),
      tokens: tokens.slice(),
      entry,
      shown,
      lastExpr,
      secret: { ...secret },
    }),
    setTarget,
    clearTarget,
    neededFor,
  };
})();
