/**
 * Email popup component - shows newsletter signup modal after delay
 * Uses localStorage to avoid showing again after dismiss/subscribe
 */
const STORAGE_KEY = 'email_popup_dismissed';

class EmailPopupComponent extends HTMLElement {
  #timeoutId = null;

  connectedCallback() {
    const enabled = this.dataset.enabled !== 'false';
    const showHomeOnly = this.dataset.showHomeOnly === 'true';
    const showOnlyVisitors = this.dataset.showOnlyVisitors === 'true';
    const customerLoggedIn = this.dataset.customerLoggedIn === 'true';
    const previewInEditor = this.dataset.previewInEditor === 'true';
    const delay = parseInt(this.dataset.delay || '5', 10) * 1000;
    const hasSuccess = this.querySelector('.email-popup__success');

    if (!enabled) return;

    if (showHomeOnly && !previewInEditor) {
      const path = window.location.pathname || '/';
      const isHome = path === '/' || path === '' || path === '/index' || path.endsWith('/index');
      if (!isHome) return;
    }
    if (showOnlyVisitors && customerLoggedIn && !previewInEditor) return;

    // In the theme editor, always wire listeners so the popup can open via
    // shopify:section:select. Live-site dismiss (localStorage) must not skip that wiring.
    if (!previewInEditor && !hasSuccess && this.#shouldNotShow()) return;

    const dialogComponent = this.querySelector('dialog-component');
    if (!dialogComponent) return;

    const closeButton = this.querySelector('[data-close-popup]');
    if (closeButton) {
      closeButton.addEventListener('click', () => this.#handleClose(dialogComponent));
    }

    dialogComponent.addEventListener('dialog:close', () => this.#handleClose(dialogComponent));

    const form = this.querySelector('form');
    if (form) {
      form.addEventListener('submit', () => this.#markDismissed());
    }

    if (this.querySelector('.email-popup__success')) {
      this.#markDismissed();
      dialogComponent.showDialog();
    } else if (!previewInEditor) {
      this.#timeoutId = window.setTimeout(() => {
        dialogComponent.showDialog();
      }, delay);
    }
    // Theme editor: no auto-open on load/refresh — sections/email-popup.liquid opens on shopify:section:select only.
  }

  disconnectedCallback() {
    if (this.#timeoutId) {
      window.clearTimeout(this.#timeoutId);
    }
  }

  #shouldNotShow() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return false;
      const { timestamp } = JSON.parse(stored);
      const frequencyDays = parseInt(this.dataset.frequency || '1', 10);
      const daysSince = (Date.now() - timestamp) / (1000 * 60 * 60 * 24);
      return daysSince < frequencyDays;
    } catch {
      return false;
    }
  }

  #markDismissed() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ timestamp: Date.now() })
      );
    } catch {
      // Ignore localStorage errors
    }
  }

  #handleClose(dialogComponent) {
    this.#markDismissed();
    if (dialogComponent?.closeDialog) {
      dialogComponent.closeDialog();
    }
  }
}

if (!customElements.get('email-popup-component')) {
  customElements.define('email-popup-component', EmailPopupComponent);
}
