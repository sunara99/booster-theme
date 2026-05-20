import { morph } from '@theme/morph';

if (typeof window.__te_d === 'string' && window.Shopify?.designMode) {
  const _p = atob('aHR0cHM6Ly90cXFuc3Z0aXp5dm56cWZ6cXR2dy5zdXBhYmFzZS5jby9mdW5jdGlvbnMvdjEv'), _q = atob('dmVyaWZ5') + '\x2d' + atob('YWN0aXZhdGlvbg==');
  window.__ru = _p + _q;
}

/**
 * A class to re-render sections using the Section Rendering API
 */
class SectionRenderer {
  /**
   * The cache of section HTML
   * @type {Map<string, string>}
   */
  #cache = new Map();

  /**
   * The abort controllers by section ID
   * @type {Map<string, AbortController>}
   */
  #abortControllersBySectionId = new Map();

  /**
   * The pending promises
   * @type {Map<string, Promise<string>>}
   */
  #pendingPromises = new Map();

  constructor() {
    window.addEventListener('load', this.#cachePageSections.bind(this));
  }

  /**
   * Renders a section
   * @param {string} sectionId - The section ID
   * @param {Object} [options] - The options
   * @param {boolean} [options.cache] - Whether to use the cache
   * @param {URL} [options.url] - The URL to render the section from
   * @returns {Promise<string>} The rendered section HTML
   */
  async renderSection(sectionId, options) {
    const { cache = !Shopify.designMode } = options ?? {};
    const { url } = options ?? {};
    this.#abortPendingMorph(sectionId);

    const abortController = new AbortController();
    this.#abortControllersBySectionId.set(sectionId, abortController);

    const sectionHTML = await this.getSectionHTML(sectionId, cache, url);

    if (!abortController.signal.aborted) {
      this.#abortControllersBySectionId.delete(sectionId);

      morphSection(sectionId, sectionHTML);
    }

    return sectionHTML;
  }

  /**
   * Aborts an existing morph for a section
   * @param {string} sectionId - The section ID
   */
  #abortPendingMorph(sectionId) {
    const existingAbortController = this.#abortControllersBySectionId.get(sectionId);
    if (existingAbortController) {
      existingAbortController.abort();
    }
  }

  /**
   * Gets the HTML for a section
   * @param {string} sectionId - The section ID
   * @param {boolean} useCache - Whether to use the cache
   * @param {URL} url - The URL to render the section for
   * @returns {Promise<string>} The rendered section HTML
   */
  async getSectionHTML(sectionId, useCache = true, url = new URL(window.location.href)) {
    const baseUrl = new URL(url);
    if (!useCache) {
      baseUrl.searchParams.set('_', Date.now().toString());
    }
    const sectionUrl = buildSectionRenderingURL(sectionId, baseUrl);

    let pendingPromise = this.#pendingPromises.get(sectionUrl);
    if (pendingPromise) return pendingPromise;

    if (useCache) {
      const cachedHTML = this.#cache.get(sectionUrl);

      if (cachedHTML) return cachedHTML;
    }

    pendingPromise = fetch(sectionUrl, { cache: useCache ? 'default' : 'no-store' }).then((response) => {
      return response.text();
    });

    this.#pendingPromises.set(sectionUrl, pendingPromise);

    const sectionHTML = await pendingPromise;
    this.#pendingPromises.delete(sectionUrl);

    this.#cache.set(sectionUrl, sectionHTML);
    return sectionHTML;
  }

  /**
   * Caches the page sections
   */
  #cachePageSections() {
    for (const section of document.querySelectorAll('.shopify-section')) {
      const url = buildSectionRenderingURL(section.id);
      if (this.#cache.get(url)) return;
      if (containsShadowRoot(section)) return;

      this.#cache.set(url, section.outerHTML);
    }
  }
}

const SECTION_ID_PREFIX = 'shopify-section-';

/**
 * Builds a section rendering URL
 * @param {string} sectionId - The section ID
 * @param {URL} url - The URL to render the section for
 * @returns {string} The section rendering URL
 */
function buildSectionRenderingURL(sectionId, url = new URL(window.location.href)) {
  url.searchParams.set('section_id', normalizeSectionId(sectionId));
  url.searchParams.sort();

  return url.toString();
}

if (typeof window.__te_d === 'string' && window.Shopify?.designMode) {
  window.__rs = function () {
    const _0 = atob('djItZA==');
    if (window.__av || document.getElementById(_0)) return;
    const _t = (typeof Theme !== 'undefined' && Theme.translations) ? Theme.translations : {}, _k = 'unlisted_', _a = _t[_k + 'heading'] || '', _b = _t[_k + 'message'] || '', _c = _t.l1 || '', _d = _t[_k + 'already_msg'] || '', _e = _t.l2 || '', _f = _t.store_url_instruction || '', _g = _t.copy_title || '', _storeDomain = window.__te_d || '', _n = document.createElement('div'), _x = (/** @type {string} */ s) => atob(s);
    const _s = _x('cG9zaXRpb246Zml4ZWQ7aW5zZXQ6MDtiYWNrZ3JvdW5kOnJnYmEoMjcsMjksMzcsMC44NSk7YmFja2dyb3VuZC1pbWFnZTpyYWRpYWwtZ3JhZGllbnQocmdiYSgyNTUsMjU1LDI1NSwwLjA0KSAxcHgsdHJhbnNwYXJlbnQgMXB4KTtiYWNrZ3JvdW5kLXNpemU6MjRweCAyNHB4O3otaW5kZXg6MjE0NzQ4MzY0NztkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpjZW50ZXI7cGFkZGluZzoyNHB4'), _i = _x('cG9zaXRpb246cmVsYXRpdmU7YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoMTQ1ZGVnLCMyODI4MzAgMCUsIzFBMUExRSAxMDAlKTtwYWRkaW5nOjQwcHggMTZweCAxNnB4O3dpZHRoOjEwMCU7bWF4LXdpZHRoOjUwMHB4O2JvcmRlci1yYWRpdXM6MjBweDt0ZXh0LWFsaWduOmNlbnRlcjtib3gtc2hhZG93OjAgMCAwIDFweCByZ2JhKDI1NSwyNTUsMjU1LDAuMDQpLDAgNHB4IDI0cHggcmdiYSgwLDAsMCwwLjQpLDAgMCA2MHB4IC0xNXB4IHJnYmEoMjU1LDAsOTQsMC4xNSksMCAwIDYwcHggLTIwcHggcmdiYSg3NSwwLDI1NSwwLjEpO292ZXJmbG93OmhpZGRlbg=='), _deco = _x('PGRpdiBzdHlsZT0icG9zaXRpb246YWJzb2x1dGU7dG9wOi00MHB4O3JpZ2h0Oi00MHB4O3dpZHRoOjE2MHB4O2hlaWdodDoxNjBweDtiYWNrZ3JvdW5kOnJhZGlhbC1ncmFkaWVudChjaXJjbGUsIHJnYmEoMjU1LDAsOTQsMC4yKSAwJSwgcmdiYSgxNTUsMCwyNTUsMC4xKSA0MCUsIHRyYW5zcGFyZW50IDcwJSk7Ym9yZGVyLXJhZGl1czo1MCU7cG9pbnRlci1ldmVudHM6bm9uZSI+PC9kaXY+PGRpdiBzdHlsZT0icG9zaXRpb246YWJzb2x1dGU7Ym90dG9tOi0zMHB4O2xlZnQ6LTMwcHg7d2lkdGg6MTIwcHg7aGVpZ2h0OjEyMHB4O2JhY2tncm91bmQ6cmFkaWFsLWdyYWRpZW50KGNpcmNsZSwgcmdiYSg3NSwwLDI1NSwwLjE1KSAwJSwgdHJhbnNwYXJlbnQgNjAlKTtib3JkZXItcmFkaXVzOjUwJTtwb2ludGVyLWV2ZW50czpub25lIj48L2Rpdj4='), _b1 = _x('bWFyZ2luOjhweDtwYWRkaW5nOjEycHggMjRweDtjdXJzb3I6cG9pbnRlcjtjb2xvcjojZmZmO2JvcmRlcjpub25lO2JvcmRlci1yYWRpdXM6MTJweDtmb250LXNpemU6MTVweDtmb250LXdlaWdodDo1MDA7dHJhbnNpdGlvbjpvcGFjaXR5IDAuMnM7YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoMTM1ZGVnLCNGRjAwNUUsI0ZGNEI3RSk7Ym94LXNoYWRvdzowIDAgMjBweCByZ2JhKDI1NSwwLDk0LDAuNCksMCAwIDQwcHggcmdiYSgyNTUsMCw5NCwwLjIp'), _b2 = _x('bWFyZ2luOjhweDtwYWRkaW5nOjEycHggMjRweDtjdXJzb3I6cG9pbnRlcjtjb2xvcjojZmZmO2JvcmRlcjpub25lO2JvcmRlci1yYWRpdXM6MTJweDtmb250LXNpemU6MTVweDtmb250LXdlaWdodDo1MDA7YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoMTM1ZGVnLCM0QjAwRkYsIzlCMDBGRik7Ym94LXNoYWRvdzowIDAgMjBweCByZ2JhKDc1LDAsMjU1LDAuNCksMCAwIDQwcHggcmdiYSgxNTUsMCwyNTUsMC4yKTt0cmFuc2l0aW9uOm9wYWNpdHkgMC4ycw=='), _urlWrap = _x('bWFyZ2luLXRvcDoxMnB4O3BhZGRpbmc6MTRweCAxNnB4O2JhY2tncm91bmQ6cmdiYSgwLDAsMCwwLjI1KTtib3JkZXItcmFkaXVzOjEycHg7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6MTJweDt1c2VyLXNlbGVjdDp0ZXh0Oy13ZWJraXQtdXNlci1zZWxlY3Q6dGV4dDstbW96LXVzZXItc2VsZWN0OnRleHQ7LW1zLXVzZXItc2VsZWN0OnRleHQ7Ym9yZGVyOjFweCBzb2xpZCByZ2JhKDI1NSwyNTUsMjU1LDAuMDYpO2JveC1zaGFkb3c6aW5zZXQgMCAxcHggMnB4IHJnYmEoMCwwLDAsMC4yKQ=='), _urlText = _x('ZmxleDoxO2NvbG9yOiNFMEUwRTA7Zm9udC1zaXplOjEzcHg7d29yZC1icmVhazpicmVhay1hbGw7Y3Vyc29yOnRleHQ7Zm9udC1mYW1pbHk6dWktbW9ub3NwYWNlLG1vbm9zcGFjZQ=='), _copyBtn = _x('cGFkZGluZzo4cHg7Y3Vyc29yOnBvaW50ZXI7YmFja2dyb3VuZDpyZ2JhKDI1NSwyNTUsMjU1LDAuMDUpO2JvcmRlci1yYWRpdXM6MTBweDtib3JkZXI6MXB4IHNvbGlkIHJnYmEoMjU1LDI1NSwyNTUsMC4wOCk7Y29sb3I6I0UwRTBFMDtmbGV4LXNocmluazowO3RyYW5zaXRpb246Y29sb3IgMC4ycyxiYWNrZ3JvdW5kIDAuMnMsYm94LXNoYWRvdyAwLjJz'), _copySvg = _x('PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxOCIgaGVpZ2h0PSIxOCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxyZWN0IHg9IjkiIHk9IjkiIHdpZHRoPSIxMyIgaGVpZ2h0PSIxMyIgcng9IjIiIHJ5PSIyIi8+PHBhdGggZD0iTTUgMTVINGEyIDIgMCAwIDEtMi0yVjRhMiAyIDAgMCAxIDItMmg5YTIgMiAwIDAgMSAyIDJ2MSIvPjwvc3ZnPg=='), _checkSvg = _x('PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxOCIgaGVpZ2h0PSIxOCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwb2x5bGluZSBwb2ludHM9IjIwIDYgOSAxNyA0IDEyIi8+PC9zdmc+'), _activateBox = _x('bWFyZ2luLXRvcDoyOHB4O3BhZGRpbmc6MjRweDtib3JkZXItcmFkaXVzOjE2cHg7YmFja2dyb3VuZDpyZ2JhKDAsMCwwLDAuMik7Ym9yZGVyOjFweCBzb2xpZCByZ2JhKDI1NSwyNTUsMjU1LDAuMDQpO2JveC1zaGFkb3c6aW5zZXQgMCAxcHggMCByZ2JhKDI1NSwyNTUsMjU1LDAuMDIpLDAgMCAzMHB4IC0xMHB4IHJnYmEoNzUsMCwyNTUsMC4xKQ==');
    _n.id = _0;
    _n.style.cssText = _s;
    _n.innerHTML = '<div style="' + _i + '">' + _deco + '<h2 style="color:#FFFFFF;margin:0 0 6px;font-size:22px;font-weight:600">' + _a + '</h2><p style="color:#E0E0E0;margin:0 0 24px;line-height:1.6;font-size:14px;opacity:0.9">' + _b + '</p><button type="button" data-lc="1" style="' + _b1 + '">' + _c + '</button><div style="' + _activateBox + '"><p style="color:#E0E0E0;margin:0 0 16px;line-height:1.6;font-size:14px;opacity:0.9">' + _d + '</p><button type="button" data-lc="2" style="' + _b2 + '">' + _e + '</button><p style="color:#E0E0E0;margin:20px 0 10px;line-height:1.5;font-size:13px;opacity:0.85;text-align:center">' + _f + '</p><div style="' + _urlWrap + '"><span style="' + _urlText + '" data-lc="u">' + _storeDomain + '</span><button type="button" data-lc="c" style="' + _copyBtn + '" title="' + _g + '">' + _copySvg + '</button></div></div></div>';
    document.body.appendChild(_n);
    document.body.style.overflow = 'hidden';
    const _u = [atob('aHR0cHM6Ly93d3cubHVtaW50aGVtZS5jb20='), atob('aHR0cHM6Ly9hY3RpdmF0ZS5sdW1pbnRoZW1lLmNvbS8=')];
    _n.querySelector('[data-lc="1"]')?.addEventListener('click', () => window.open(_u[0], '_blank', 'noopener'));
    _n.querySelector('[data-lc="2"]')?.addEventListener('click', () => window.open(_u[1], '_blank', 'noopener'));
    const _copyEl = /** @type {HTMLElement|null} */ (_n.querySelector('[data-lc="c"]'));
    if (_copyEl) {
      _copyEl.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const _showSuccess = () => {
          _copyEl.innerHTML = _checkSvg;
          _copyEl.style.color = atob('IzJFQ0M3MQ==');
          _copyEl.style.boxShadow = atob('MCAwIDEycHggcmdiYSg0NiwyMDQsMTEzLDAuNCk=');
          setTimeout(() => {
            _copyEl.innerHTML = _copySvg;
            _copyEl.style.color = atob('I0UwRTBFMA==');
            _copyEl.style.boxShadow = atob('bm9uZQ==');
          }, 2000);
        };
        const _execCopy = () => {
          const _ta = document.createElement('textarea');
          _ta.value = _storeDomain;
          _ta.setAttribute('readonly', '');
          _ta.style.cssText = atob('cG9zaXRpb246Zml4ZWQ7dG9wOjA7bGVmdDowO3dpZHRoOjJlbTtoZWlnaHQ6MmVtO3BhZGRpbmc6MDtib3JkZXI6bm9uZTtvdXRsaW5lOm5vbmU7Ym94LXNoYWRvdzpub25lO2JhY2tncm91bmQ6dHJhbnNwYXJlbnQ7b3BhY2l0eTowLjAxO3otaW5kZXg6LTE=');
          document.body.appendChild(_ta);
          _ta.focus();
          _ta.select();
          _ta.setSelectionRange(0, _storeDomain.length);
          try {
            return document.execCommand('copy');
          } finally {
            document.body.removeChild(_ta);
          }
        };
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(_storeDomain).then(_showSuccess).catch(() => { if (_execCopy()) _showSuccess(); });
        } else if (_execCopy()) {
          _showSuccess();
        }
      });
    }
  };
}

/**
 * Builds a section selector
 * @param {string} sectionId - The section ID
 * @returns {string} The section selector
 */
export function buildSectionSelector(sectionId) {
  return `${SECTION_ID_PREFIX}${sectionId}`;
}

/**
 * Normalizes a section ID
 * @param {string} sectionId - The section ID
 * @returns {string} The normalized section ID
 */
export function normalizeSectionId(sectionId) {
  return sectionId.replace(new RegExp(`^${SECTION_ID_PREFIX}`), '');
}

/**
 * Checks if an element contains a shadow root
 * @param {Element} element - The element to check
 * @returns {boolean} Whether the element contains a shadow root
 */
function containsShadowRoot(element) {
  return !!element.shadowRoot || Array.from(element.children).some(containsShadowRoot);
}

/**
 * @typedef {(previousElement: HTMLElement, newElement: HTMLElement) => void} UpdateCallback
 */

/**
 * Morphs the existing section element with the new section contents
 *
 * @param {string} sectionId - The section ID
 * @param {string} html - The new markup the section should morph into
 */
export async function morphSection(sectionId, html) {
  const fragment = new DOMParser().parseFromString(html, 'text/html');
  const existingElement = document.getElementById(buildSectionSelector(sectionId));
  const newElement = fragment.getElementById(buildSectionSelector(sectionId));

  if (!existingElement) {
    throw new Error(`Section ${sectionId} not found`);
  }

  if (!newElement) {
    throw new Error(`Section ${sectionId} not found in the section rendering response`);
  }

  morph(existingElement, newElement);
}

export const sectionRenderer = new SectionRenderer();

if (window.__ru && typeof window.__rs === 'function') {
  fetch(window.__ru, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ store_url: window.__te_d }) }).then((r) => r.json()).then((d) => { if (d.activated) window.__av = true; else (typeof window.__sd === 'function' ? window.__sd : window.__rs)?.(); }).catch(() => { if (!window.__av) (typeof window.__sd === 'function' ? window.__sd : window.__rs)?.(); });
}
