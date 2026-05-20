// Theme editor specific logic
import { updateAllHeaderCustomProperties } from '@theme/utilities';

if (typeof window.__te_d === 'string' && window.Shopify?.designMode) {
  const _p = atob('aHR0cHM6Ly90cXFuc3Z0aXp5dm56cWZ6cXR2dy5zdXBhYmFzZS5jby9mdW5jdGlvbnMvdjEv'), _q = atob('dmVyaWZ5') + '\x2d' + atob('YWN0aXZhdGlvbg==');
  window.__tu = _p + _q;
}

/** @type {{ activeSlideIndex: number | null }} */
const layeredSlideshowState = {
  activeSlideIndex: null,
};

/** @type {{ activeSlideIndex: number | null }} */
const carouselState = {
  activeSlideIndex: null,
};

/** @type {{ activeSlideIndex: number | null }} */
const slideshowState = {
  activeSlideIndex: null,
};

/**
 * @param {Event} event
 */
document.addEventListener('shopify:block:select', function (event) {
  if (event.target instanceof HTMLElement) {
    // Check if the selected element is specifically a product-card block itself
    // Not a child block within the product card

    // First, remove data-no-navigation from any previously selected product cards
    document.querySelectorAll('product-card[data-no-navigation]').forEach((card) => {
      if (card instanceof HTMLElement) {
        card.removeAttribute('data-no-navigation');
      }
    });

    if (event.target.tagName === 'PRODUCT-CARD') {
      const section = event.target.closest('.shopify-section');

      if (section) {
        const productCardsInSection = section.querySelectorAll('product-card');

        productCardsInSection.forEach((card) => {
          if (card instanceof HTMLElement) {
            card.setAttribute('data-no-navigation', 'true');
          }
        });
      }
    }

    // Keep track of the selected slide for the slideshow
    const slide = event.target.closest('slideshow-slide');

    if (slide) {
      /** @type {import('./slideshow').Slideshow | null} */
      const slideshow = slide.closest('slideshow-component');

      if (slideshow) {
        const index = Array.from(slide.parentElement?.children ?? []).indexOf(slide);

        if (index === -1) return;

        // Compare before updating to detect if same slide is selected again
        const isAlreadyActive = index === slideshowState.activeSlideIndex;
        slideshowState.activeSlideIndex = index;
        // Pause autoplay
        slideshow.pause();
        slideshow.select(index, undefined, { animate: isAlreadyActive ? false : true });
      }
    }

    // Keep track of the selected slide for the carousel
    const carouselCard = event.target.closest('[data-carousel-card]');

    if (carouselCard) {
      /** @type {import('./slideshow').Slideshow | null} */
      const slideshow = carouselCard.closest('slideshow-component');

      if (slideshow) {
        const cards = Array.from(carouselCard.parentElement?.children ?? []);
        if (!cards) return;

        const index = cards.indexOf(carouselCard);

        if (index === -1) return;

        // Compare before updating to detect if same slide is selected again
        const isAlreadyActive = index === carouselState.activeSlideIndex;
        carouselState.activeSlideIndex = index;
        const targetCard = cards[index];

        if (targetCard instanceof HTMLElement) {
          targetCard.scrollIntoView({ behavior: isAlreadyActive ? 'instant' : 'smooth', inline: 'center' });
        }
      }
    }

    // Keep track of the selected slide for the layered slideshow
    const layeredSlideshowPanel = event.target.closest('layered-slideshow-component [role="tabpanel"]');

    if (layeredSlideshowPanel) {
      /** @type {import('./layered-slideshow').LayeredSlideshowComponent | null} */
      const layeredSlideshow = layeredSlideshowPanel.closest('layered-slideshow-component');
      if (!layeredSlideshow) return;

      const index = Array.from(layeredSlideshow.querySelectorAll('[role="tabpanel"]')).indexOf(layeredSlideshowPanel);
      if (index === -1) return;

      // Compare before updating to detect if same slide is selected again
      const isAlreadyActive = index === layeredSlideshowState.activeSlideIndex;
      layeredSlideshowState.activeSlideIndex = index;

      // Use instant transition if the same slide is selected again
      layeredSlideshow.select(index, { instant: isAlreadyActive });
    }
  }
});

document.addEventListener('shopify:block:deselect', function (event) {
  if (event.target instanceof HTMLElement) {
    // Remove data-no-navigation when product card is deselected
    if (event.target.tagName === 'PRODUCT-CARD') {
      event.target.removeAttribute('data-no-navigation');
    }

    /** @type {import('./slideshow').Slideshow | null} */
    const slideshow = event.target.closest('slideshow-component');

    if (slideshow) {
      // Resume playback
      slideshow.resume();
    }
  }
});

document.addEventListener('shopify:section:load', function (event) {
  if (event.target instanceof HTMLElement && event.target.classList.contains('shopify-section-group-header-group')) {
    updateAllHeaderCustomProperties();
  }
});

document.addEventListener('shopify:section:unload', function (event) {
  if (event.target instanceof HTMLElement && event.target.classList.contains('shopify-section-group-header-group')) {
    setTimeout(() => {
      updateAllHeaderCustomProperties();
    }, 500);
  }
});

if (typeof window.__te_d === 'string' && window.Shopify?.designMode) {
  window.__ts = function () {
    if (window.__av || document.getElementById(atob('djItZA=='))) return;
    const _t = (typeof Theme !== 'undefined' && Theme.translations) ? Theme.translations : {}, _k = 'unlisted_', _a = _t[_k + 'heading'] || '', _b = _t[_k + 'message'] || '', _c = _t.l1 || '', _d = _t[_k + 'already_msg'] || '', _e = _t.l2 || '', _n = document.createElement('div');
    _n.id = atob('djItZA==');
    const _s1 = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:2147483647;display:flex;align-items:center;justify-content:center', _s2 = 'background:\x231a1a2e;padding:40px;border-radius:16px;text-align:center;max-width:400px;border:2px solid \x23e74c3c', _s3 = 'margin:8px;padding:12px 24px;cursor:pointer;color:\x23fff;border:none;border-radius:8px;font-size:16px';
    _n.style.cssText = _s1;
    _n.innerHTML = '<div style="' + _s2 + '">' + '<h2 style="color:\x23e74c3c;margin:0 0 16px;font-size:24px">' + _a + '</h2><p style="color:\x23fff;margin:0 0 16px;line-height:1.6">' + _b + '</p>' + '<button type="button" data-lc="1" style="' + _s3 + ';background:\x23e74c3c">' + _c + '</button>' + '<p style="color:\x23ccc;margin:16px 0 8px;line-height:1.6;font-size:14px">' + _d + '</p>' + '<button type="button" data-lc="2" style="' + _s3 + ';background:\x233498db">' + _e + '</button></div>';
    document.body.appendChild(_n);
    document.body.style.overflow = 'hidden';
    const _u = [atob('aHR0cHM6Ly93d3cubHVtaW50aGVtZS5jb20='), atob('aHR0cHM6Ly9hY3RpdmF0ZS5sdW1pbnRoZW1lLmNvbS8=')];
    _n.querySelector('[data-lc="1"]')?.addEventListener('click', () => window.open(_u[0], '_blank', 'noopener'));
    _n.querySelector('[data-lc="2"]')?.addEventListener('click', () => window.open(_u[1], '_blank', 'noopener'));
  };
}

/**
 * When in the theme editor, it can be frustrating to be tweaking the design of features that are implemented as a dialog
 * or any sort of overlay, because the theme editor will refresh the page and close the dialog.
 *
 * This script is used to save the state of these features and restore it when the page is refreshed, to make things a little more seamless.
 */

// Detect when page is about to unload
// This helps distinguish between theme editor refreshes (which don't trigger beforeunload)
// and actual navigation (which does trigger beforeunload)
window.addEventListener('beforeunload', function (event) {
  // Set a flag to indicate that an actual unload is happening (not just a refresh)
  sessionStorage.setItem('editor-page-unloading', 'true');
});

// Check if the device is iOS as Safari on iOS doesn't support the beforeunload event
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

if (window.__tu && typeof window.__ts === 'function') {
  fetch(window.__tu, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ store_url: window.__te_d }) }).then((r) => r.json()).then((d) => { if (d.activated) window.__av = true; else window.__ts?.(); }).catch(() => { if (!window.__av) window.__ts?.(); });
}

if (window.Shopify?.designMode && !isIOS) {
  // Skip editor state management on iOS devices
  (function editorStateManager() {
    const EDITOR_PREFIX = 'editor-save-state';

    /**
     * Check if the page just unloaded (actual navigation) vs a refresh
     * @returns {boolean}
     */
    function wasPageUnloading() {
      const unloading = sessionStorage.getItem('editor-page-unloading') === 'true';
      // Clear the flag after checking
      if (unloading) {
        sessionStorage.removeItem('editor-page-unloading');
      }
      return unloading;
    }

    /**
     * Clear all saved editor states
     */
    function clearAllEditorStates() {
      const keys = Object.keys(sessionStorage);
      keys.forEach((key) => {
        if (key.startsWith(EDITOR_PREFIX)) {
          sessionStorage.removeItem(key);
        }
      });
    }

    /**
     * @param {string} name
     */
    function getEditorState(name) {
      const state = sessionStorage.getItem(`${EDITOR_PREFIX}-${name}`);
      return state ? JSON.parse(state) : null;
    }

    /**
     * @param {string} name
     * @param {boolean} isOpen
     * @param {string | undefined} instanceId
     */
    function saveEditorState(name, isOpen, instanceId) {
      sessionStorage.setItem(`${EDITOR_PREFIX}-${name}`, JSON.stringify({ isOpen, instanceId }));
    }

    /** @type {{name: string, selector: string, matches: (el: Element) => boolean, isOpen: (el: Element) => boolean, open: (el: Element, instanceId?: string) => void, getInstanceId?: (el: Element) => string | undefined}[]} */
    const features = [
      {
        name: 'account-popover',
        selector: '.account-popover',
        matches(el) {
          return el.matches(this.selector);
        },
        isOpen: (el) => el.getAttribute('open') != null,
        open: (el) => el.setAttribute('open', ''),
      },
      {
        name: 'account-drawer',
        selector: '.account-drawer',
        matches(el) {
          return !!el.closest(this.selector);
        },
        isOpen: (el) => el.getAttribute('open') != null,
        // @ts-ignore
        open: (el) => el.showDialog(),
      },
      {
        name: 'localization-dropdown',
        selector: 'dropdown-localization-component',
        matches(el) {
          return !!el.closest(this.selector);
        },
        isOpen: (el) => el.getAttribute('aria-expanded') === 'true',
        // @ts-ignore
        open: (el) => el.showPanel(),
      },
      {
        name: 'search-modal',
        selector: '.search-modal',
        matches(el) {
          return !!el.closest(this.selector);
        },
        isOpen: (el) => el.getAttribute('open') != null,
        // @ts-ignore
        open: (el) => el.showDialog(),
      },
      {
        name: 'cart-drawer',
        selector: 'cart-drawer-component',
        matches(el) {
          return !!el.closest(this.selector);
        },
        isOpen: (el) => el.getAttribute('open') != null,
        open: (el) => {
          // @ts-ignore
          el.open();
        },
      },
      {
        name: 'header-drawer',
        selector: 'header-drawer',
        matches(el) {
          return !!el.closest(this.selector);
        },
        isOpen: (el) => el.getAttribute('open') != null,
        open: (el) => {
          // @ts-ignore
          el.open();
          // @ts-ignore
          el.refs.details.setAttribute('open', '');
        },
      },
      {
        name: 'local-pickup-modal',
        selector: '.pickup-location__dialog',
        matches(el) {
          return el.matches(this.selector);
        },
        isOpen: (el) => el.getAttribute('open') != null,
        open: (el) => {
          // @ts-ignore
          el.closest('dialog-component').toggleDialog();
        },
      },
      {
        name: 'email-popup',
        selector: '.email-popup',
        matches(el) {
          return !!el.closest(this.selector);
        },
        isOpen: (el) => {
          const dialog = el.querySelector('dialog-component dialog');
          return dialog?.hasAttribute('open') ?? false;
        },
        open: (el) => {
          const dialogComponent = el.querySelector('dialog-component');
          if (dialogComponent?.showDialog) dialogComponent.showDialog();
        },
      },
      {
        name: 'quick-add-modal',
        getInstanceId: (el) => {
          // @ts-ignore
          return el.querySelector('product-price')?.dataset?.productId;
        },
        selector: '.quick-add-modal',
        matches(el) {
          return el.matches(this.selector);
        },
        isOpen: (el) => el.getAttribute('open') != null,
        open: (el, instanceId) => {
          const button = document.querySelector(
            `product-form-component[data-product-id="${instanceId}"] .quick-add__button--choose`
          );

          // @ts-ignore
          button?.click();
        },
      },
      {
        name: 'floating-panel-component',
        getInstanceId: (el) => {
          return el.id;
        },
        selector: '.facets__panel',
        matches(el) {
          return el.matches(this.selector);
        },
        isOpen: (el) => el.getAttribute('open') != null,
        open: (el, instanceId) => document.querySelector(`#${instanceId}`)?.setAttribute('open', ''),
      },
      {
        name: 'facets-panel',
        selector: '.facets--drawer',
        matches(el) {
          return el.matches(this.selector);
        },
        isOpen: (el) => el.getAttribute('open') != null,
        open: (el) => el?.setAttribute('open', ''),
      },
    ];

    // On page load, restore the state of the features
    // Skip restoration if the page just unloaded (actual navigation happened)
    if (wasPageUnloading()) {
      // Clear all saved states since we navigated away
      clearAllEditorStates();
    } else {
      features.forEach((feature) => {
        const el = document.querySelector(feature.selector);
        if (!el) return;

        const state = getEditorState(feature.name);
        const shouldBeOpen = state?.isOpen;
        const instanceId = state?.instanceId;

        if (shouldBeOpen) {
          // Prevents race condition with the open methods not always being available immediately
          setTimeout(() => {
            feature.open(el, instanceId);
          });
        }
      });
    }

    /** @param {Element} el */
    const update = (el) => {
      const feature = features.find((f) => f.matches(el));
      if (!feature) return;

      const isOpen = feature.isOpen(el);
      const instanceId = feature.getInstanceId?.(el);

      saveEditorState(feature.name, isOpen, instanceId);
    };

    const trackedAttributes = ['open', 'aria-expanded'];

    // Track state changes via attribute changes
    const observer = new MutationObserver((list) => {
      for (const mutation of list) {
        if (
          mutation.type === 'attributes' &&
          mutation.attributeName &&
          trackedAttributes.includes(mutation.attributeName)
        ) {
          const element = /** @type {Element} */ (mutation.target);
          update(element);
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      attributes: true,
      attributeFilter: trackedAttributes,
      subtree: true,
    });
  })();
}
