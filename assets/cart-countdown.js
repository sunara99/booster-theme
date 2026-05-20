import { DialogOpenEvent } from '@theme/dialog';
import { ThemeEvents } from '@theme/events';

const STORAGE_KEY = 'theme:cartPromoCountdown:v1';
/** Same-tab morph recovery after “show message”; cleared on full navigation via pageshow. */
const SHOW_MESSAGE_SESSION_KEY = 'theme:cartTimerShowMessage:v1';

/**
 * @typedef {{ end?: number; durationMin?: number; frozenShowMessage?: boolean }} CountdownStorage
 */

/** @type {WeakMap<Element, () => void>} */
const stopTimers = new WeakMap();

/** @type {WeakSet<Element>} */
const drawersMutationObserved = new WeakSet();

window.addEventListener('pageshow', () => {
  try {
    sessionStorage.removeItem(SHOW_MESSAGE_SESSION_KEY);
  } catch {
    /* ignore */
  }
});

/**
 * @returns {CountdownStorage | null}
 */
function readCountdownStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? /** @type {CountdownStorage} */ (data) : null;
  } catch {
    return null;
  }
}

/**
 * @param {CountdownStorage} data
 */
function writeCountdownStorage(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/**
 * After “show text” ends we freeze storage so cart morph/re-activation cannot mint a new deadline.
 * @param {number} durationMin
 * @param {number} [endTime]
 */
function freezeShowMessage(durationMin, endTime) {
  const parsed = readCountdownStorage() || {};
  const end =
    typeof endTime === 'number'
      ? endTime
      : typeof parsed.end === 'number'
        ? parsed.end
        : Date.now();
  writeCountdownStorage({ ...parsed, end, durationMin, frozenShowMessage: true });
}

function stripFrozenShowMessage() {
  const parsed = readCountdownStorage();
  if (!parsed?.frozenShowMessage) return;
  const { frozenShowMessage: _f, ...rest } = parsed;
  writeCountdownStorage(rest);
}

/**
 * @param {Element} rootEl
 * @returns {'show_message' | 'repeat'}
 */
function readTimerEndMode(rootEl) {
  const raw =
    rootEl.getAttribute('data-timer-on-end') ||
    rootEl.getAttribute('data-cart-countdown-on-end') ||
    '';
  return raw.trim() === 'show_message' ? 'show_message' : 'repeat';
}

/**
 * @param {HTMLElement} rootEl
 * @returns {number}
 */
function parseDuration(rootEl) {
  const raw = parseInt(rootEl.dataset.cartCountdownMinutes ?? '', 10);
  if (Number.isNaN(raw)) return 15;
  return Math.min(50, Math.max(3, raw));
}

/**
 * @param {number} durationMin
 * @param {'show_message' | 'repeat'} mode
 * @returns {number}
 */
function getOrCreateDeadline(durationMin, mode) {
  const now = Date.now();
  const parsed = readCountdownStorage();

  if (
    mode === 'show_message' &&
    parsed?.frozenShowMessage === true &&
    parsed.durationMin === durationMin &&
    typeof parsed.end === 'number'
  ) {
    return parsed.end;
  }

  if (
    parsed &&
    typeof parsed.end === 'number' &&
    parsed.durationMin === durationMin &&
    parsed.end > now
  ) {
    return parsed.end;
  }

  // Same duration, timer already expired: “show text” must not start a new countdown.
  if (
    mode === 'show_message' &&
    parsed &&
    typeof parsed.end === 'number' &&
    parsed.durationMin === durationMin &&
    parsed.end <= now
  ) {
    freezeShowMessage(durationMin, parsed.end);
    return parsed.end;
  }

  const end = now + durationMin * 60 * 1000;
  writeCountdownStorage({ end, durationMin });
  return end;
}

/**
 * Forces a new deadline from now (used when countdown repeats in-session).
 * @param {number} durationMin
 * @returns {number}
 */
function resetDeadline(durationMin) {
  const end = Date.now() + durationMin * 60 * 1000;
  writeCountdownStorage({ end, durationMin });
  return end;
}

/**
 * @param {number} ms
 * @returns {string}
 */
function formatRemaining(ms) {
  if (ms <= 0) return '0:00';
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Replaces all content inside `.cart-timer__inner` with the end-message HTML.
 * @param {HTMLElement} rootEl
 */
function replaceCountdownWithEndMessage(rootEl) {
  const tmpl = rootEl.querySelector('template[data-cart-countdown-end-template]');
  const inner = rootEl.querySelector('.cart-timer__inner');
  if (!tmpl || !(inner instanceof HTMLElement)) return;

  let html = tmpl.innerHTML.trim();
  if (!html) html = '<p>This offer has ended.</p>';

  inner.setAttribute('aria-live', 'polite');
  inner.classList.add('cart-timer__inner--ended');
  inner.innerHTML = html;

  tmpl.remove();

  try {
    sessionStorage.setItem(SHOW_MESSAGE_SESSION_KEY, '1');
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * @param {number} endTime
 * @param {Element} rootEl
 */
function bindDisplay(endTime, rootEl) {
  stopTimers.get(rootEl)?.();

  const displays = rootEl.querySelectorAll('[data-cart-countdown-display]');
  if (!displays.length) return;

  const root = /** @type {HTMLElement} */ (rootEl);

  /** @type {ReturnType<typeof setInterval> | undefined} */
  let intervalId;

  const tick = () => {
    const left = endTime - Date.now();
    const onEndMode = readTimerEndMode(rootEl);

    if (left <= 0) {
      if (intervalId != null) {
        clearInterval(intervalId);
        intervalId = undefined;
      }
      stopTimers.delete(rootEl);

      if (onEndMode === 'repeat') {
        const durationMin = parseDuration(root);
        const newEnd = resetDeadline(durationMin);
        bindDisplay(newEnd, rootEl);
      } else if (onEndMode === 'show_message') {
        freezeShowMessage(parseDuration(root), endTime);
        replaceCountdownWithEndMessage(root);
      }
      return;
    }

    const text = formatRemaining(left);
    displays.forEach((d) => {
      d.textContent = text;
    });
  };

  tick();

  if (endTime <= Date.now()) {
    return;
  }

  intervalId = setInterval(tick, 1000);
  stopTimers.set(rootEl, () => {
    if (intervalId != null) clearInterval(intervalId);
    stopTimers.delete(rootEl);
  });
}

/**
 * @param {HTMLElement} rootEl
 */
function activate(rootEl) {
  const mode = readTimerEndMode(rootEl);
  const durationMin = parseDuration(rootEl);
  const parsed = readCountdownStorage();

  if (mode === 'repeat') {
    try {
      sessionStorage.removeItem(SHOW_MESSAGE_SESSION_KEY);
    } catch {
      /* ignore */
    }
    stripFrozenShowMessage();
  }

  if (
    mode === 'show_message' &&
    parsed?.frozenShowMessage === true &&
    parsed.durationMin === durationMin
  ) {
    replaceCountdownWithEndMessage(rootEl);
    return;
  }

  if (
    mode === 'show_message' &&
    sessionStorage.getItem(SHOW_MESSAGE_SESSION_KEY) === '1' &&
    rootEl.querySelector('[data-cart-countdown-display]')
  ) {
    freezeShowMessage(durationMin);
    replaceCountdownWithEndMessage(rootEl);
    return;
  }

  if (!rootEl.querySelector('[data-cart-countdown-display]')) return;

  const endTime = getOrCreateDeadline(durationMin, mode);
  bindDisplay(endTime, rootEl);
}

function syncPageRoots() {
  document.querySelectorAll('[data-cart-countdown-context="page"][data-cart-countdown-root]').forEach((el) => {
    if (el instanceof HTMLElement) activate(el);
  });
}

/**
 * Activates drawer countdown roots while the cart drawer dialog is open.
 */
function activateOpenDrawerCountdowns() {
  const host = document.querySelector('cart-drawer-component dialog[open]')?.closest('cart-drawer-component');
  if (!host) return;
  host.querySelectorAll('[data-cart-countdown-context="drawer"][data-cart-countdown-root]').forEach((el) => {
    if (el instanceof HTMLElement) activate(el);
  });
}

/**
 * First cart add often hydrates drawer markup asynchronously (section render without morph).
 * Retry across frames and timeouts so activation runs after the countdown nodes exist.
 */
function scheduleDrawerCountdownActivation() {
  activateOpenDrawerCountdowns();

  requestAnimationFrame(() => {
    activateOpenDrawerCountdowns();
    requestAnimationFrame(() => {
      activateOpenDrawerCountdowns();
      requestAnimationFrame(() => activateOpenDrawerCountdowns());
    });
  });

  window.setTimeout(activateOpenDrawerCountdowns, 60);
  window.setTimeout(activateOpenDrawerCountdowns, 180);
  window.setTimeout(activateOpenDrawerCountdowns, 400);
  window.setTimeout(activateOpenDrawerCountdowns, 800);
}

/**
 * @param {Event} event
 */
function syncDrawerRoots(event) {
  const t = event.target;
  if (!(t instanceof Element)) return;
  if (!t.closest('cart-drawer-component')) return;
  scheduleDrawerCountdownActivation();
}

function observeCartDrawerMorph() {
  const host = document.querySelector('cart-drawer-component');
  if (!host || drawersMutationObserved.has(host)) return;
  drawersMutationObserved.add(host);

  let debounceTimer = 0;
  const onMutate = () => {
    if (!host.querySelector('dialog[open]')) return;
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => activateOpenDrawerCountdowns(), 24);
  };

  new MutationObserver(onMutate).observe(host, { childList: true, subtree: true });
}

syncPageRoots();
observeCartDrawerMorph();

document.addEventListener(DialogOpenEvent.eventName, syncDrawerRoots, { capture: true });

document.addEventListener(ThemeEvents.cartUpdate, () => {
  syncPageRoots();
  scheduleDrawerCountdownActivation();
});
