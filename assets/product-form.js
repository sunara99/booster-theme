import { Component } from '@theme/component';
import { fetchConfig, preloadImage, onAnimationEnd, yieldToMainThread } from '@theme/utilities';
import { ThemeEvents, CartAddEvent, CartErrorEvent, CartUpdateEvent, VariantUpdateEvent } from '@theme/events';
import { cartPerformance } from '@theme/performance';
import { morph } from '@theme/morph';

// Error message display duration - gives users time to read the message
const ERROR_MESSAGE_DISPLAY_DURATION = 10000;

// Button re-enable delay after error - prevents rapid repeat attempts
const ERROR_BUTTON_REENABLE_DELAY = 1000;

// Success message display duration for screen readers
const SUCCESS_MESSAGE_DISPLAY_DURATION = 5000;

/**
 * @typedef {HTMLElement & {
 *   source: Element,
 *   destination: Element,
 *   useSourceSize: string | boolean
 * }} FlyToCart
 */

/**
 * A custom element that manages an add to cart button.
 *
 * @typedef {object} AddToCartRefs
 * @property {HTMLButtonElement} addToCartButton - The add to cart button.
 * @extends Component<AddToCartRefs>
 */
export class AddToCartComponent extends Component {
  requiredRefs = ['addToCartButton'];

  /** @type {number[] | undefined} */
  #resetTimeouts = /** @type {number[]} */ ([]);

  connectedCallback() {
    super.connectedCallback();

    this.addEventListener('pointerenter', this.#preloadImage);
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    if (this.#resetTimeouts) {
      this.#resetTimeouts.forEach(/** @param {number} timeoutId */ (timeoutId) => clearTimeout(timeoutId));
    }
    this.removeEventListener('pointerenter', this.#preloadImage);
  }

  /**
   * Disables the add to cart button.
   */
  disable() {
    this.refs.addToCartButton.disabled = true;
  }

  /**
   * Enables the add to cart button.
   */
  enable() {
    this.refs.addToCartButton.disabled = false;
  }

  /**
   * Handles the click event for the add to cart button.
   * @param {MouseEvent & {target: HTMLElement}} event - The click event.
   */
  handleClick(event) {
    const form = this.closest('form');
    if (!form?.checkValidity()) return;

    // Check if adding would exceed max before animating
    const productForm = /** @type {ProductFormComponent | null} */ (this.closest('product-form-component'));
    const quantitySelector = productForm?.refs.quantitySelector;
    if (quantitySelector?.canAddToCart) {
      const validation = quantitySelector.canAddToCart();
      // Don't animate if it would exceed max
      if (!validation.canAdd) {
        return;
      }
    }
    if (this.refs.addToCartButton.dataset.puppet !== 'true') {
      const quantityBreaksEl = document.querySelector('[data-quantity-breaks-component]');
      const activeCard = quantityBreaksEl?.querySelector('.quantity-breaks__card--active');
      const hasDiscountCode = activeCard?.dataset?.discountCode?.trim?.();
      if (hasDiscountCode) {
        this.refs.addToCartButton.classList.add('loading');
        return;
      }
      const animationEnabled = this.dataset.addToCartAnimation === 'true';
      if (animationEnabled && !event.target.closest('.quick-add-modal')) {
        this.#animateFlyToCart();
      }
      this.animateAddToCart();
    }
  }

  #preloadImage = () => {
    const image = this.dataset.productVariantMedia;

    if (!image) return;

    preloadImage(image);
  };

  /**
   * Triggers the fly to cart animation (public for use when discount flow defers it).
   */
  triggerFlyToCart() {
    this.#animateFlyToCart();
  }

  /**
   * Animates the fly to cart animation.
   */
  #animateFlyToCart() {
    const { addToCartButton } = this.refs;
    const cartIcon = document.querySelector('.header-actions__cart-icon');

    const image = this.dataset.productVariantMedia;

    if (!cartIcon || !addToCartButton || !image) return;

    const flyToCartElement = /** @type {FlyToCart} */ (document.createElement('fly-to-cart'));

    let flyToCartClass = addToCartButton.classList.contains('quick-add__button')
      ? 'fly-to-cart--quick'
      : 'fly-to-cart--main';

    flyToCartElement.classList.add(flyToCartClass);
    flyToCartElement.style.setProperty('background-image', `url(${image})`);
    flyToCartElement.style.setProperty('--start-opacity', '0');
    flyToCartElement.source = addToCartButton;
    flyToCartElement.destination = cartIcon;

    document.body.appendChild(flyToCartElement);
  }

  /**
   * Animates the add to cart button.
   */
  animateAddToCart = async function () {
    const { addToCartButton } = this.refs;

    // Initialize the array if it doesn't exist
    if (!this.#resetTimeouts) {
      this.#resetTimeouts = [];
    }

    // Clear all existing timeouts
    this.#resetTimeouts.forEach(/** @param {number} timeoutId */ (timeoutId) => clearTimeout(timeoutId));
    this.#resetTimeouts = [];

    if (addToCartButton.dataset.added !== 'true') {
      addToCartButton.dataset.added = 'true';
    }

    // The onAnimationEnd can trigger a style recalculation so we yield to the main thread first.
    await yieldToMainThread();
    await onAnimationEnd(addToCartButton);

    // Create new timeout and store it in the array
    const timeoutId = setTimeout(() => {
      addToCartButton.removeAttribute('data-added');

      // Remove this timeout from the array
      const index = this.#resetTimeouts.indexOf(timeoutId);
      if (index > -1) {
        this.#resetTimeouts.splice(index, 1);
      }
    }, 800);

    this.#resetTimeouts.push(timeoutId);
  };
}

if (!customElements.get('add-to-cart-component')) {
  customElements.define('add-to-cart-component', AddToCartComponent);
}

/**
 * A custom element that manages a product form.
 *
 * @typedef {{items: Array<{quantity: number, variant_id: number}>}} Cart
 *
 * @typedef {object} ProductFormRefs
 * @property {HTMLInputElement} variantId - The form input for submitting the variant ID.
 * @property {AddToCartComponent | undefined} addToCartButtonContainer - The add to cart button container element.
 * @property {HTMLElement | undefined} addToCartTextError - The add to cart text error.
 * @property {HTMLElement | undefined} acceleratedCheckoutButtonContainer - The accelerated checkout button container element.
 * @property {HTMLElement} liveRegion - The live region.
 * @property {HTMLElement | undefined} quantityLabelCartCount - The quantity label cart count element.
 * @property {HTMLElement | undefined} quantityRules - The quantity rules element.
 * @property {HTMLElement | undefined} productFormButtons - The product form buttons container.
 * @property {HTMLElement | undefined} volumePricing - The volume pricing component.
 * @property {any | undefined} quantitySelector - The quantity selector component.
 * @property {HTMLElement | undefined} quantitySelectorWrapper - The quantity selector wrapper element.
 * @property {HTMLElement | undefined} quantityLabel - The quantity label element.
 * @property {HTMLElement | undefined} pricePerItem - The price per item component.
 *
 * @extends Component<ProductFormRefs>
 */
class ProductFormComponent extends Component {
  requiredRefs = ['variantId', 'liveRegion'];
  #abortController = new AbortController();

  /** @type {number | undefined} */
  #timeout;

  connectedCallback() {
    super.connectedCallback();

    const { signal } = this.#abortController;
    const target = this.closest('.shopify-section, dialog, product-card');
    target?.addEventListener(ThemeEvents.variantUpdate, this.#onVariantUpdate, { signal });
    target?.addEventListener(ThemeEvents.variantSelected, this.#onVariantSelected, { signal });

    // Listen for cart updates to sync data-cart-quantity
    document.addEventListener(ThemeEvents.cartUpdate, this.#onCartUpdate, { signal });
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    this.#abortController.abort();
  }

  /**
   * Updates quantity selector with cart data for current variant
   * @param {Cart} cart - The cart object with items array
   * @returns {number} The cart quantity for the current variant
   */
  #updateCartQuantityFromData(cart) {
    const variantIdInput = /** @type {HTMLInputElement | null} */ (this.querySelector('input[name="id"]'));
    if (!variantIdInput?.value || !cart?.items) return 0;

    const cartItem = cart.items.find((item) => item.variant_id.toString() === variantIdInput.value.toString());
    const cartQty = cartItem ? cartItem.quantity : 0;

    // Use public API to update quantity selector
    const quantitySelector = /** @type {any | undefined} */ (this.querySelector('quantity-selector-component'));
    if (quantitySelector?.setCartQuantity) {
      quantitySelector.setCartQuantity(cartQty);
    }

    // Update quantity label if it exists
    this.#updateQuantityLabel(cartQty);

    return cartQty;
  }

  /**
   * Fetches cart and updates quantity selector for current variant
   * @returns {Promise<number>} The cart quantity for the current variant
   */
  async #fetchAndUpdateCartQuantity() {
    const variantIdInput = /** @type {HTMLInputElement | null} */ (this.querySelector('input[name="id"]'));
    if (!variantIdInput?.value) return 0;

    try {
      const response = await fetch('/cart.js');
      const cart = await response.json();

      return this.#updateCartQuantityFromData(cart);
    } catch (error) {
      console.error('Failed to fetch cart quantity:', error);
      return 0;
    }
  }

  /**
   * Updates data-cart-quantity when cart is updated from elsewhere
   * @param {CartUpdateEvent|CartAddEvent} event
   */
  #onCartUpdate = async (event) => {
    // Skip if this event came from this component
    if (event.detail?.sourceId === this.id || event.detail?.data?.source === 'product-form-component') return;

    const cart = /** @type {Cart} */ (event.detail?.resource);
    if (cart?.items) {
      this.#updateCartQuantityFromData(cart);
    } else {
      await this.#fetchAndUpdateCartQuantity();
    }
  };

  /**
   * Handles the submit event for the product form.
   *
   * @param {Event} event - The submit event.
   */
  handleSubmit(event) {
    const { addToCartTextError } = this.refs;
    // Stop default behaviour from the browser
    event.preventDefault();

    if (this.#timeout) clearTimeout(this.#timeout);

    // Query for ALL add-to-cart components
    const allAddToCartContainers = /** @type {NodeListOf<AddToCartComponent>} */ (
      this.querySelectorAll('add-to-cart-component')
    );

    // Check if ANY add to cart button is disabled and do an early return if it is
    const anyButtonDisabled = Array.from(allAddToCartContainers).some(
      (container) => container.refs.addToCartButton?.disabled
    );
    if (anyButtonDisabled) return;

    // Send the add to cart information to the cart
    const form = this.querySelector('form');

    if (!form) throw new Error('Product form element missing');

    if (this.refs.quantitySelector?.canAddToCart) {
      const validation = this.refs.quantitySelector.canAddToCart();

      if (!validation.canAdd) {
        // Disable ALL add-to-cart buttons
        for (const container of allAddToCartContainers) {
          container.disable();
        }

        const errorTemplate = this.dataset.quantityErrorMax || '';
        const errorMessage = errorTemplate.replace('{{ maximum }}', validation.maxQuantity?.toString() || '');
        if (addToCartTextError) {
          addToCartTextError.classList.remove('hidden');

          const textNode = addToCartTextError.childNodes[2];
          if (textNode) {
            textNode.textContent = errorMessage;
          } else {
            const newTextNode = document.createTextNode(errorMessage);
            addToCartTextError.appendChild(newTextNode);
          }

          this.#setLiveRegionText(errorMessage);

          if (this.#timeout) clearTimeout(this.#timeout);
          this.#timeout = setTimeout(() => {
            if (!addToCartTextError) return;
            addToCartTextError.classList.add('hidden');
            this.#clearLiveRegionText();
          }, ERROR_MESSAGE_DISPLAY_DURATION);
        }

        setTimeout(() => {
          // Re-enable ALL add-to-cart buttons
          for (const container of allAddToCartContainers) {
            container.enable();
          }
        }, ERROR_BUTTON_REENABLE_DELAY);

        return;
      }
    }

    const formData = new FormData(form);
    const quantityBreaksEl = document.querySelector('[data-quantity-breaks-component]');
    const activeCard = quantityBreaksEl?.querySelector('.quantity-breaks__card--active');
    const freeGiftsEl = quantityBreaksEl?.querySelector('[data-free-gifts]');
    const discountCode = activeCard?.dataset?.discountCode?.trim?.() || '';
    const hasDiscountCode = !!discountCode;

    const enabledGiftCards = quantityBreaksEl?.querySelectorAll?.('.quantity-breaks-gift-card--enabled[data-variant-id]') || [];
    const hasGifts = enabledGiftCards.length > 0;
    const giftDiscountCode = freeGiftsEl?.dataset?.giftDiscountCode?.trim?.() || '';
    const hasGiftDiscountCode = hasGifts && !!giftDiscountCode && freeGiftsEl?.dataset?.giftDiscountEnabled === 'true';
    const hasAnyDiscountToApply = hasDiscountCode || hasGiftDiscountCode;

    const cartItemsComponents = document.querySelectorAll('cart-items-component');
    const cartItemComponentsSectionIds = [];
    cartItemsComponents.forEach((item) => {
      if (item instanceof HTMLElement && item.dataset.sectionId) {
        cartItemComponentsSectionIds.push(item.dataset.sectionId);
      }
    });

    const mainVariantId = activeCard?.dataset?.variantId?.trim?.()
      || this.refs?.variantId?.value
      || formData.get('id');
    const mainId = Number(mainVariantId);

    const hasVariantPickers = activeCard?.dataset?.hasVariantPickers === 'true';
    const variantIdsStr = hasVariantPickers ? (activeCard?.dataset?.variantIds?.trim?.() || '') : '';
    const variantIds = variantIdsStr ? variantIdsStr.split(',').map((s) => Number(s.trim())).filter((n) => n > 0) : [];

    const seenGiftIds = new Set();
    const mainIdsForGiftExclusion = new Set([mainId, ...variantIds]);

    const giftItems = Array.from(enabledGiftCards)
      .map((card) => {
        const vid = card.dataset.variantId?.trim?.();
        if (!vid) return null;
        const variantId = Number(vid);
        if (mainIdsForGiftExclusion.has(variantId) || seenGiftIds.has(variantId)) return null;
        seenGiftIds.add(variantId);
        return { id: variantId, quantity: 1 };
      })
      .filter(Boolean);

    // Shopify native subscription app: get selling plan ID when "Subscribe and save" is selected
    const subscriptionRadio =
      this.querySelector('.shopify_subscriptions_app_block input[data-radio-type="selling_plan"]:checked') ||
      document.querySelector('.shopify_subscriptions_app_block input[data-radio-type="selling_plan"]:checked');
    const sellingPlanIdStr = subscriptionRadio?.dataset?.sellingPlanId?.trim?.();
    const sellingPlanId = sellingPlanIdStr ? Number(sellingPlanIdStr) : null;

    let addPayload;
    let useJsonPayload = (hasGifts && mainId > 0) || (hasVariantPickers && variantIds.length > 0);

    const addSellingPlanToItem = (item) => {
      if (sellingPlanId) item.selling_plan = sellingPlanId;
      return item;
    };

    if (hasVariantPickers && variantIds.length > 0) {
      const qtyByVariant = {};
      variantIds.forEach((vid) => {
        qtyByVariant[vid] = (qtyByVariant[vid] || 0) + 1;
      });
      const mainItems = Object.entries(qtyByVariant).map(([id, qty]) =>
        addSellingPlanToItem({ id: Number(id), quantity: qty })
      );
      addPayload = {
        items: [...mainItems, ...giftItems],
        sections: cartItemComponentsSectionIds.join(',') || undefined,
        sections_url: window.location.pathname,
      };
    } else if (hasGifts && mainId > 0) {
      const mainQty = activeCard
        ? Number(activeCard.dataset.quantity) || 1
        : Number(formData.get('quantity')) || Number(this.dataset.quantityDefault) || 1;
      const mainItem = addSellingPlanToItem({ id: mainId, quantity: mainQty });
      addPayload = {
        items: [mainItem, ...giftItems],
        sections: cartItemComponentsSectionIds.join(',') || undefined,
        sections_url: window.location.pathname,
      };
    } else if (activeCard && !formData.has('quantity') && mainId > 0) {
      // Quantity block is hidden but quantity-breaks has a selected card - use its quantity
      const mainQty = Number(activeCard.dataset.quantity) || 1;
      const mainItem = addSellingPlanToItem({ id: mainId, quantity: mainQty });
      addPayload = {
        items: [mainItem],
        sections: cartItemComponentsSectionIds.join(',') || undefined,
        sections_url: window.location.pathname,
      };
      useJsonPayload = true;
    } else {
      addPayload = formData;
      if (sellingPlanId && !formData.has('selling_plan')) {
        addPayload.append('selling_plan', sellingPlanId);
      }
    }

    if (hasAnyDiscountToApply) {
      for (const container of allAddToCartContainers) {
        container.refs.addToCartButton?.classList.add('loading');
      }
    }

    const fetchCfg = useJsonPayload
      ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(addPayload) }
      : fetchConfig('javascript', { body: addPayload });

    fetch(Theme.routes.cart_add_url, {
      ...fetchCfg,
      headers: {
        ...(fetchCfg.headers || {}),
        Accept: 'application/json',
      },
    })
      .then((response) => response.json())
      .then(async (response) => {
        if (response.status) {
          this.dispatchEvent(
            new CartErrorEvent(form.getAttribute('id') || '', response.message, response.description, response.errors)
          );

          if (!addToCartTextError) return;
          addToCartTextError.classList.remove('hidden');

          // Reuse the text node if the user is spam-clicking
          const textNode = addToCartTextError.childNodes[2];
          if (textNode) {
            textNode.textContent = response.message;
          } else {
            const newTextNode = document.createTextNode(response.message);
            addToCartTextError.appendChild(newTextNode);
          }

          // Create or get existing error live region for screen readers
          this.#setLiveRegionText(response.message);

          this.#timeout = setTimeout(() => {
            if (!addToCartTextError) return;
            addToCartTextError.classList.add('hidden');

            // Clear the announcement
            this.#clearLiveRegionText();
          }, ERROR_MESSAGE_DISPLAY_DURATION);

          // When we add more than the maximum amount of items to the cart, we need to dispatch a cart update event
          // because our back-end still adds the max allowed amount to the cart.
          const errorItemCount = activeCard && !formData.has('quantity')
            ? Number(activeCard.dataset.quantity) || 1
            : Number(formData.get('quantity')) || Number(this.dataset.quantityDefault);
          this.dispatchEvent(
            new CartAddEvent({}, this.id, {
              didError: true,
              source: 'product-form-component',
              itemCount: errorItemCount,
              productId: this.dataset.productId,
            })
          );

          if (hasAnyDiscountToApply) {
            for (const container of allAddToCartContainers) {
              container.refs.addToCartButton?.classList.remove('loading');
            }
          }
          return;
        } else {
          const id = (hasVariantPickers && variantIds[0] > 0 ? variantIds[0] : formData.get('id'));

          if (addToCartTextError) {
            addToCartTextError.classList.add('hidden');
            addToCartTextError.removeAttribute('aria-live');
          }

          if (!id) throw new Error('Form ID is required');

          // Add aria-live region to inform screen readers that the item was added
          // Get the added text from any add-to-cart button
          const anyAddToCartButton = allAddToCartContainers[0]?.refs.addToCartButton;
          if (anyAddToCartButton) {
            const addedTextElement = anyAddToCartButton.querySelector('.add-to-cart-text--added');
            const addedText = addedTextElement?.textContent?.trim() || Theme.translations.added;

            this.#setLiveRegionText(addedText);

            setTimeout(() => {
              this.#clearLiveRegionText();
            }, SUCCESS_MESSAGE_DISPLAY_DURATION);
          }

          let cartPayload = response;

          if (hasAnyDiscountToApply) {
            try {
              const cartUrl = ((Theme?.routes?.cart_url) || '/cart').replace(/\/?$/, '') + '.js';
              const sectionIds = [];
              document.querySelectorAll('cart-items-component').forEach((c) => {
                if (c instanceof HTMLElement && c.dataset.sectionId) sectionIds.push(c.dataset.sectionId);
              });

              const cartRes = await fetch(cartUrl, { cache: 'no-store' });
              const cartData = await cartRes.json();
              this.#updateCartQuantityFromData(cartData);

              const existingCodes = (cartData.discount_codes || []).map((d) => d.code);
              const addCodeIfNew = (codes, code) => {
                if (!code) return codes;
                const lower = code.toLowerCase();
                return codes.some((c) => c.toLowerCase() === lower) ? codes : [...codes, code];
              };
              let codesToApply = existingCodes;
              codesToApply = addCodeIfNew(codesToApply, discountCode);
              codesToApply = addCodeIfNew(codesToApply, giftDiscountCode);

              const applyDiscount = async () => {
                const updateRes = await fetch(Theme?.routes?.cart_update_url || '/cart/update.js', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  cache: 'no-store',
                  body: JSON.stringify({
                    discount: codesToApply.join(','),
                    sections: sectionIds.join(','),
                    sections_url: window.location.pathname,
                  }),
                });
                const updateData = await updateRes.json();
                const ourCodes = [discountCode, giftDiscountCode].filter(Boolean);
                const applied = ourCodes.length > 0 && updateData.discount_codes?.some(
                  (d) => d.applicable && ourCodes.some((c) => c.toLowerCase() === d.code.toLowerCase())
                );
                return { applied, updateData };
              };

              let result = await applyDiscount();
              if (!result.applied && result.updateData?.discount_codes && codesToApply.length > 0) {
                await new Promise((r) => setTimeout(r, 50));
                result = await applyDiscount();
              }
              if (result.applied && result.updateData) {
                cartPayload = result.updateData;
              }
            } catch (e) {
              console.warn('Quantity breaks discount application failed:', e);
              await this.#fetchAndUpdateCartQuantity();
            }
          } else {
            await this.#fetchAndUpdateCartQuantity();
          }

          const itemCount = hasVariantPickers && variantIds.length > 0
            ? variantIds.length
            : (activeCard && !formData.has('quantity') ? Number(activeCard.dataset.quantity) || 1 : (Number(formData.get('quantity')) || Number(this.dataset.quantityDefault)));
          const cartAddEvent = new CartAddEvent(cartPayload?.items ? cartPayload : {}, String(id), {
            source: 'product-form-component',
            itemCount,
            productId: this.dataset.productId,
            sections: cartPayload?.sections ?? response.sections,
            deferDrawerOpen: hasAnyDiscountToApply,
          });
          document.dispatchEvent(cartAddEvent);

          if (Theme?.cart?.type === 'page' && Theme?.cart?.auto_open_page) {
            window.location.href = Theme.routes?.cart_url || '/cart';
            return;
          }

          if (hasAnyDiscountToApply) {
            const mainAddToCart = allAddToCartContainers[0];
            if (mainAddToCart) {
              mainAddToCart.refs.addToCartButton?.classList.remove('loading');
              mainAddToCart.animateAddToCart();
              if (mainAddToCart.dataset.addToCartAnimation === 'true') {
                mainAddToCart.triggerFlyToCart();
              }
            }
            if (Theme?.cart?.type === 'drawer' && Theme?.cart?.auto_open_drawer) {
              const drawer = document.querySelector('cart-drawer-component');
              if (drawer?.open) {
                setTimeout(() => drawer.open(), 1000);
              }
            }
          } else if (Theme?.cart?.type === 'drawer' && Theme?.cart?.auto_open_drawer) {
            const drawer = document.querySelector('cart-drawer-component');
            if (drawer?.open) drawer.open();
          }
        }
      })
      .catch((error) => {
        console.error(error);
        if (hasDiscountCode) {
          for (const container of allAddToCartContainers) {
            container.refs.addToCartButton?.classList.remove('loading');
          }
        }
      })
      .finally(() => {
        cartPerformance.measureFromEvent('add:user-action', event);
      });
  }

  /**
   * Updates the quantity label with the current cart quantity
   * @param {number} cartQty - The quantity in cart
   */
  #updateQuantityLabel(cartQty) {
    const quantityLabel = this.refs.quantityLabelCartCount;
    if (quantityLabel) {
      const inCartText = quantityLabel.textContent?.match(/\((\d+)\s+(.+)\)/);
      if (inCartText && inCartText[2]) {
        quantityLabel.textContent = `(${cartQty} ${inCartText[2]})`;
      }

      // Show/hide based on quantity
      quantityLabel.classList.toggle('hidden', cartQty === 0);
    }
  }

  /**
   * @param {*} text
   */
  #setLiveRegionText(text) {
    const liveRegion = this.refs.liveRegion;
    liveRegion.textContent = text;
  }

  #clearLiveRegionText() {
    const liveRegion = this.refs.liveRegion;
    liveRegion.textContent = '';
  }

  /**
   * Morphs or removes/adds an element based on current and new element states
   * @param {Element | null | undefined} currentElement - The current element in the DOM
   * @param {Element | null | undefined} newElement - The new element from the server response
   * @param {Element | null} [insertReferenceElement] - Element to insert before if adding new element
   */
  #morphOrUpdateElement(currentElement, newElement, insertReferenceElement = null) {
    if (currentElement && newElement) {
      morph(currentElement, newElement);
    } else if (currentElement && !newElement) {
      currentElement.remove();
    } else if (!currentElement && newElement && insertReferenceElement) {
      insertReferenceElement.insertAdjacentElement('beforebegin', /** @type {Element} */ (newElement.cloneNode(true)));
    }
  }

  /**
   * @param {VariantUpdateEvent} event
   */
  #onVariantUpdate = async (event) => {
    if (event.detail.data.newProduct) {
      this.dataset.productId = event.detail.data.newProduct.id;
    } else if (event.detail.data.productId !== this.dataset.productId) {
      return;
    }

    const { variantId } = this.refs;

    // Update the variant ID
    variantId.value = event.detail.resource?.id ?? '';
    const { addToCartButtonContainer: currentAddToCartButtonContainer, acceleratedCheckoutButtonContainer } = this.refs;
    const currentAddToCartButton = currentAddToCartButtonContainer?.refs.addToCartButton;

    // Update state and text for add-to-cart button
    if (!currentAddToCartButtonContainer || (!currentAddToCartButton && !acceleratedCheckoutButtonContainer)) return;

    // Update the button state
    if (event.detail.resource == null || event.detail.resource.available == false) {
      currentAddToCartButtonContainer.disable();
    } else {
      currentAddToCartButtonContainer.enable();
    }

    const newAddToCartButton = event.detail.data.html.querySelector('product-form-component [ref="addToCartButton"]');
    if (newAddToCartButton && currentAddToCartButton) {
      morph(currentAddToCartButton, newAddToCartButton);
    }

    if (acceleratedCheckoutButtonContainer) {
      if (event.detail.resource == null || event.detail.resource.available == false) {
        acceleratedCheckoutButtonContainer?.setAttribute('hidden', 'true');
      } else {
        acceleratedCheckoutButtonContainer?.removeAttribute('hidden');
      }
    }

    // Set the data attribute for the product variant media if it exists
    if (event.detail.resource) {
      const productVariantMedia = event.detail.resource.featured_media?.preview_image?.src;
      if (productVariantMedia) {
        this.refs.addToCartButtonContainer?.setAttribute(
          'data-product-variant-media',
          productVariantMedia + '&width=100'
        );
      }
    }

    // Check if quantity rules, price-per-item, or add-to-cart are appearing/disappearing (causes layout shift)
    const {
      quantityRules,
      pricePerItem,
      quantitySelector,
      productFormButtons,
      quantityLabel,
      quantitySelectorWrapper,
    } = this.refs;

    // Update quantity selector's min/max/step attributes and cart quantity for the new variant
    const newQuantityInput = /** @type {HTMLInputElement | null} */ (
      event.detail.data.html.querySelector('quantity-selector-component input[ref="quantityInput"]')
    );

    if (quantitySelector?.updateConstraints && newQuantityInput) {
      quantitySelector.updateConstraints(newQuantityInput.min, newQuantityInput.max || null, newQuantityInput.step);
    }

    const newQuantityRules = event.detail.data.html.querySelector('.quantity-rules');
    const isQuantityRulesChanging = !!quantityRules !== !!newQuantityRules;

    const newPricePerItem = event.detail.data.html.querySelector('price-per-item');
    const isPricePerItemChanging = !!pricePerItem !== !!newPricePerItem;

    if ((isQuantityRulesChanging || isPricePerItemChanging) && quantitySelector) {
      // Store quantity value before morphing entire container
      const currentQuantityValue = quantitySelector.getValue?.();

      const newProductFormButtons = event.detail.data.html.querySelector('.product-form-buttons');

      if (productFormButtons && newProductFormButtons) {
        morph(productFormButtons, newProductFormButtons);

        // Get the NEW quantity selector after morphing and update its constraints
        const newQuantityInputElement = /** @type {HTMLInputElement | null} */ (
          event.detail.data.html.querySelector('quantity-selector-component input[ref="quantityInput"]')
        );

        if (this.refs.quantitySelector?.updateConstraints && newQuantityInputElement && currentQuantityValue) {
          // Temporarily set the old value so updateConstraints can snap it properly
          this.refs.quantitySelector.setValue(currentQuantityValue);
          // updateConstraints will snap to valid increment if needed
          this.refs.quantitySelector.updateConstraints(
            newQuantityInputElement.min,
            newQuantityInputElement.max || null,
            newQuantityInputElement.step
          );
        }
      }
    } else {
      // Update elements individually when layout isn't changing
      /** @type {Array<[string, HTMLElement | undefined, HTMLElement | undefined]>} */
      const morphTargets = [
        ['.quantity-label', quantityLabel, quantitySelector],
        ['.quantity-rules', quantityRules, this.refs.productFormButtons],
        ['price-per-item', pricePerItem, quantitySelectorWrapper],
      ];

      for (const [selector, currentElement, fallback] of morphTargets) {
        this.#morphOrUpdateElement(currentElement, event.detail.data.html.querySelector(selector), fallback);
      }
    }

    // Morph volume pricing if it exists
    const currentVolumePricing = this.refs.volumePricing;
    const newVolumePricing = event.detail.data.html.querySelector('volume-pricing');
    this.#morphOrUpdateElement(currentVolumePricing, newVolumePricing, this.refs.productFormButtons);

    const hasB2BFeatures =
      quantityRules || newQuantityRules || pricePerItem || newPricePerItem || currentVolumePricing || newVolumePricing;

    if (!hasB2BFeatures) return;

    // Fetch and update cart quantity for the new variant
    await this.#fetchAndUpdateCartQuantity();
  };

  /**
   * Disable the add to cart button while the UI is updating before #onVariantUpdate is called.
   * Accelerated checkout button is also disabled via its own event listener not exposed to the theme.
   */
  #onVariantSelected = () => {
    this.refs.addToCartButtonContainer?.disable();
  };
}

if (!customElements.get('product-form-component')) {
  customElements.define('product-form-component', ProductFormComponent);
}
