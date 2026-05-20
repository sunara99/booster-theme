/**
 * Free Shipping Progress - Auto-add/remove free gift based on threshold
 * When a tier with reward type "free gift" is qualified, adds that product to the cart.
 * When threshold is no longer met, removes the free gift from the cart.
 */
import { CartAddEvent, CartUpdateEvent, ThemeEvents } from '@theme/events';
import { DialogOpenEvent } from '@theme/dialog';
import { morphSection, sectionRenderer } from '@theme/section-renderer';
import { fetchConfig } from '@theme/utilities';

let isModifyingGift = false;
let runAddGiftsScheduled = false;

/**
 * Resolve `/cart.js` with locale/markets prefix (`Shopify.routes.root`), matching `_upsell-product.liquid`.
 * `Theme.routes.cart_url` is the HTML cart page — never fetch it expecting JSON.
 */
function getCartJsUrl() {
  const root = window.Shopify?.routes?.root;
  if (typeof root === 'string' && root.length > 0) {
    return `${root.endsWith('/') ? root : `${root}/`}cart.js`;
  }
  const base = window.Theme?.routes?.cart_url;
  if (typeof base === 'string' && base.length > 0) {
    return base.replace(/\/?$/, '') + '.js';
  }
  return '/cart.js';
}

/** Liquid exposes `/cart/change`; Cart AJAX expects `.js`. Theme often mirrors `cart_add_url`. */
function getCartChangeJsUrl() {
  const raw = window.Theme?.routes?.cart_change_url ?? '/cart/change.js';
  const url = String(raw).trim();
  return url.includes('.js') ? url : url.replace(/\/?$/, '') + '.js';
}

function getCartAddJsUrl() {
  const raw = window.Theme?.routes?.cart_add_url ?? '/cart/add.js';
  const url = String(raw).trim();
  return url.includes('.js') ? url : url.replace(/\/?$/, '') + '.js';
}

/**
 * Wrong endpoints and password storefronts return HTML; avoid SyntaxError from `.json()`.
 * @param {Response} response
 * @param {string} label
 */
async function readCartApiJson(response, label) {
  const text = await response.text();
  const trimmed = text.trimStart();
  if (trimmed.startsWith('<')) {
    console.warn(
      `[free-shipping-progress] ${label}: expected JSON, got HTML (status ${response.status}).`,
      trimmed.slice(0, 160)
    );
    return null;
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    console.warn(`[free-shipping-progress] ${label}: JSON parse failed`, e);
    return null;
  }
}

async function syncFreeGifts() {
  const progressEl = document.querySelector('.free-shipping-progress[data-gift-variant-ids]');
  if (!progressEl) return;

  const giftVariantIdsStr = progressEl.dataset.giftVariantIds;
  const giftThresholdsStr = progressEl.dataset.giftThresholds;
  if (!giftVariantIdsStr || !giftThresholdsStr) return;

  const cartItemsComponent = progressEl.closest('cart-items-component');
  const sectionId = cartItemsComponent?.dataset?.sectionId;
  if (!sectionId) return;

  if (isModifyingGift) return;

  const variantIds = giftVariantIdsStr.split(',').map((id) => id.trim()).filter(Boolean);
  const thresholdParts = giftThresholdsStr.split(',').map((t) => parseInt(t.trim(), 10) || 0);
  if (variantIds.length === 0 || variantIds.length !== thresholdParts.length) return;

  const giftConfig = variantIds.map((vid, i) => ({
    variantId: vid,
    thresholdCents: thresholdParts[i] || 0,
  }));

  isModifyingGift = true;
  try {
    const cartRes = await fetch(getCartJsUrl(), {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    const cart = await readCartApiJson(cartRes, 'GET cart.js');
    if (!cart || typeof cart !== 'object') return;
    const currentTotal = cart.total_price || 0;
    const cartItems = cart.items || [];

    const cartItemsComponents = document.querySelectorAll('cart-items-component');
    const sectionIds = Array.from(cartItemsComponents)
      .map((el) => el.dataset.sectionId)
      .filter(Boolean);

    const toRemove = [];
    for (let i = 0; i < cartItems.length; i++) {
      const item = cartItems[i];
      const vid = String(item.variant_id);
      const config = giftConfig.find((g) => g.variantId === vid);
      if (config && config.thresholdCents > 0 && currentTotal < config.thresholdCents) {
        toRemove.push({ line: i + 1, variantId: vid });
      }
    }

    if (toRemove.length > 0) {
      toRemove.sort((a, b) => b.line - a.line);
      for (const { line } of toRemove) {
        const body = JSON.stringify({
          line,
          quantity: 0,
          sections: sectionIds.join(','),
          sections_url: window.location.pathname,
        });
        const response = await fetch(getCartChangeJsUrl(), fetchConfig('json', { body }));
        const data = (await readCartApiJson(response, 'POST cart/change.js')) ?? {};
        if (data.errors) {
          console.warn('Free gift remove:', data.errors);
          continue;
        }
        if (data.sections?.[sectionId]) {
          morphSection(sectionId, data.sections[sectionId]);
        } else if (sectionIds.length > 0) {
          sectionRenderer.renderSection(sectionId, { cache: false });
        }
        const itemCount = data.item_count ?? 0;
        document.dispatchEvent(
          new CartUpdateEvent(data, sectionId, {
            source: 'free-shipping-progress',
            itemCount,
            sections: data.sections,
          })
        );
      }
      return;
    }

    const cartVariantIds = new Set(cartItems.map((item) => String(item.variant_id)));
    const toAdd = giftConfig.filter(
      (g) =>
        g.thresholdCents > 0 &&
        !cartVariantIds.has(g.variantId) &&
        currentTotal >= g.thresholdCents
    );
    if (toAdd.length === 0) return;

    for (const { variantId: vid } of toAdd) {
      const formData = new FormData();
      formData.append('id', vid);
      formData.append('quantity', '1');
      if (sectionIds.length > 0) {
        formData.append('sections', sectionIds.join(','));
        formData.append('sections_url', window.location.pathname);
      }

      const response = await fetch(getCartAddJsUrl(), {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: formData,
      });

      const data = (await readCartApiJson(response, 'POST cart/add.js')) ?? {};

      if (data.status || !response.ok) {
        console.warn('Free gift add:', data.message || 'Failed to add');
        continue;
      }

      const sections = data.sections || {};
      if (Object.keys(sections).length === 0 && sectionIds.length > 0) {
        sectionIds.forEach((id) => {
          sectionRenderer.renderSection(id, { cache: false });
        });
      } else if (sections[sectionId]) {
        morphSection(sectionId, sections[sectionId]);
      }

      document.dispatchEvent(
        new CartAddEvent(
          {},
          'free-shipping-progress',
          {
            source: 'free-shipping-progress',
            itemCount: 1,
            variantId: String(vid),
            sections,
          }
        )
      );
    }
  } catch (err) {
    console.error('Free shipping progress gift sync error:', err);
  } finally {
    isModifyingGift = false;
  }
}

function runSyncGifts() {
  if (runAddGiftsScheduled) return;
  runAddGiftsScheduled = true;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      runAddGiftsScheduled = false;
      syncFreeGifts();
    });
  });
}

document.addEventListener(ThemeEvents.cartUpdate, (event) => {
  if (event.detail?.data?.source === 'free-shipping-progress') return;
  runSyncGifts();
});

document.addEventListener(DialogOpenEvent.eventName, runSyncGifts);

customElements.whenDefined('cart-items-component').then(() => {
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.addedNodes.length) {
        runSyncGifts();
        break;
      }
    }
  });

  const cartDrawer = document.querySelector('cart-drawer-component');
  if (cartDrawer) {
    const dialog = cartDrawer.querySelector('dialog');
    if (dialog) {
      observer.observe(dialog, { childList: true, subtree: true });
      dialog.addEventListener('open', runSyncGifts);
    }
  }

  runSyncGifts();
});
