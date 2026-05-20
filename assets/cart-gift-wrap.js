/**
 * Cart Gift Wrap
 * Handles gift wrap checkbox in the cart drawer: adds/removes gift wrap product on toggle.
 * Supports preselect: auto-add gift wrap when cart drawer opens (if cart has items).
 */
import { CartAddEvent, CartUpdateEvent, ThemeEvents } from '@theme/events';
import { DialogOpenEvent } from '@theme/dialog';
import { morphSection, sectionRenderer } from '@theme/section-renderer';
import { fetchConfig } from '@theme/utilities';

function handlePreselect() {
  const wrapper = document.querySelector('.cart-gift-wrap[data-preselect="true"]');
  if (!wrapper) return;
  if (wrapper.dataset.line) return;

  const checkbox = wrapper.querySelector('.cart-gift-wrap__checkbox');
  const cartItemsComponent = wrapper.closest('cart-items-component');
  if (!checkbox || !cartItemsComponent || checkbox.checked || checkbox.disabled) return;

  const variantId = wrapper.dataset.variantId;
  const sectionId = cartItemsComponent.dataset.sectionId;
  if (!variantId || !sectionId) return;

  addGiftWrapToCart({ variantId, sectionId, wrapper, checkbox });
}

function handleGiftWrapChange(event) {
  const checkbox = event.target;
  if (!checkbox.classList.contains('cart-gift-wrap__checkbox')) return;

  const wrapper = checkbox.closest('.cart-gift-wrap');
  const cartItemsComponent = checkbox.closest('cart-items-component');
  if (!wrapper || !cartItemsComponent) return;

  const variantId = wrapper.dataset.variantId;
  const sectionId = cartItemsComponent.dataset.sectionId;
  if (!variantId || !sectionId) return;

  checkbox.disabled = true;

  if (checkbox.checked) {
    addGiftWrapToCart({ variantId, sectionId, wrapper, checkbox });
  } else {
    const line = wrapper.dataset.line;
    if (line) {
      removeGiftWrapFromCart({ line, sectionId, wrapper, checkbox });
    } else {
      checkbox.disabled = false;
    }
  }
}

async function addGiftWrapToCart({ variantId, sectionId, wrapper, checkbox }) {
  const cartItemsComponents = document.querySelectorAll('cart-items-component');
  const sectionIds = Array.from(cartItemsComponents)
    .map((el) => el.dataset.sectionId)
    .filter(Boolean);

  const formData = new FormData();
  formData.append('id', variantId);
  formData.append('quantity', '1');
  if (sectionIds.length > 0) {
    formData.append('sections', sectionIds.join(','));
  }

  try {
    const response = await fetch(window.Theme?.routes?.cart_add_url ?? '/cart/add.js', {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: formData,
    });

    const data = await response.json().catch(() => ({}));

    if (data.status || !response.ok) {
      throw new Error(data.message || 'Failed to add gift wrap');
    }

    let sections = data.sections || {};
    if (Object.keys(sections).length === 0 && sectionIds.length > 0) {
      sectionIds.forEach((id) => {
        sectionRenderer.renderSection(id, { cache: false });
      });
    } else if (sections[sectionId]) {
      morphSection(sectionId, sections[sectionId]);
    }

    const cartAddEvent = new CartAddEvent(
      {},
      'cart-gift-wrap',
      {
        source: 'cart-gift-wrap',
        itemCount: 1,
        variantId: String(variantId),
        productId: wrapper.dataset.productId,
        sections,
      }
    );
    document.dispatchEvent(cartAddEvent);
  } catch (err) {
    console.error('Gift wrap add error:', err);
    checkbox.checked = false;
  } finally {
    checkbox.disabled = false;
  }
}

async function removeGiftWrapFromCart({ line, sectionId, wrapper, checkbox }) {
  const cartItemsComponents = document.querySelectorAll('cart-items-component');
  const sectionIds = Array.from(cartItemsComponents)
    .map((el) => el.dataset.sectionId)
    .filter(Boolean);

  const body = JSON.stringify({
    line: parseInt(line, 10),
    quantity: 0,
    sections: sectionIds.join(','),
    sections_url: window.location.pathname,
  });

  try {
    const response = await fetch(
      window.Theme?.routes?.cart_change_url ?? '/cart/change.js',
      fetchConfig('json', { body })
    );

    const responseText = await response.text();
    const parsed = JSON.parse(responseText);

    if (parsed.errors) {
      throw new Error(parsed.errors);
    }

    let itemCount = parsed.item_count;
    if (parsed.sections?.[sectionId]) {
      morphSection(sectionId, parsed.sections[sectionId]);
      const doc = new DOMParser().parseFromString(parsed.sections[sectionId], 'text/html');
      const countEl = doc.querySelector('[ref="cartItemCount"]');
      if (countEl) itemCount = parseInt(countEl.textContent, 10) ?? itemCount;
    } else {
      await sectionRenderer.renderSection(sectionId, { cache: false });
    }

    const cartUpdateEvent = new CartUpdateEvent(parsed, sectionId, {
      source: 'cart-gift-wrap',
      itemCount,
      sections: parsed.sections,
    });
    document.dispatchEvent(cartUpdateEvent);
  } catch (err) {
    console.error('Gift wrap remove error:', err);
    checkbox.checked = true;
  } finally {
    checkbox.disabled = false;
  }
}

document.addEventListener('change', handleGiftWrapChange);

function handleCartUpdateRemoveGiftWrapIfAlone(event) {
  if (event.detail?.data?.source === 'cart-gift-wrap') return;

  const wrapper = document.querySelector('.cart-gift-wrap[data-preselect="true"]');
  if (!wrapper) return;

  const giftWrapVariantId = wrapper.dataset.variantId;
  const cartItemsComponent = wrapper.closest('cart-items-component');
  if (!giftWrapVariantId || !cartItemsComponent) return;

  const resource = event.detail?.resource;
  const items = resource?.items;
  if (!items || items.length !== 1) return;

  const onlyItem = items[0];
  if (String(onlyItem.variant_id) !== String(giftWrapVariantId)) return;

  const line = 1;
  const sectionId = cartItemsComponent.dataset.sectionId;
  const checkbox = wrapper.querySelector('.cart-gift-wrap__checkbox');
  removeGiftWrapFromCart({ line, sectionId, wrapper, checkbox });
}

function runPreselectWhenDrawerOpens() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => handlePreselect());
  });
}

document.addEventListener(DialogOpenEvent.eventName, runPreselectWhenDrawerOpens);

document.addEventListener(ThemeEvents.cartUpdate, (event) => {
  handleCartUpdateRemoveGiftWrapIfAlone(event);
  const drawer = document.querySelector('cart-drawer-component');
  const dialog = drawer?.querySelector?.('dialog');
  if (dialog?.open) runPreselectWhenDrawerOpens();
});

customElements.whenDefined('cart-drawer-component').then(() => {
  const drawer = document.querySelector('cart-drawer-component');
  if (!drawer) return;
  const dialog = drawer.querySelector('dialog');
  if (!dialog) return;
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.attributeName === 'open' && dialog.open) {
        runPreselectWhenDrawerOpens();
        break;
      }
    }
  });
  observer.observe(dialog, { attributes: true, attributeFilter: ['open'] });
});
