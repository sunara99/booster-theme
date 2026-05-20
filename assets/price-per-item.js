import { Component } from '@theme/component';
import { ThemeEvents } from '@theme/events';

/**
 * Displays dynamic per-item pricing based on quantity and volume pricing tiers.
 * Updates automatically when quantity changes or cart is updated.
 *
 * @typedef {Object} PriceBreak
 * @property {number} quantity - Minimum quantity for this price tier
 * @property {string} price - Formatted price string (e.g., "$9.50 USD")
 * @property {number | null} cents - Amount in store cents for split display
 *
 * @typedef {Object} PricePerItemRefs
 * @property {HTMLElement} [pricePerItemText] - The text element displaying the price
 *
 * @extends {Component<PricePerItemRefs>}
 */
class PricePerItemComponent extends Component {
  /** @type {PriceBreak[]} */
  #priceBreaks = [];
  #abortController = new AbortController();

  connectedCallback() {
    super.connectedCallback();
    this.#parsePriceBreaks();
    this.#attachEventListeners();
    this.#updatePriceDisplay();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#abortController.abort();
  }

  /**
   * Parses price breaks from data attributes
   */
  #parsePriceBreaks() {
    const minQuantity = parseInt(this.dataset.minQuantity || '') || 1;
    const { variantPrice, variantPriceCents, priceBreaks: priceBreaksData } = this.dataset;

    const baseCents =
      variantPriceCents !== undefined && variantPriceCents !== ''
        ? parseInt(variantPriceCents, 10)
        : null;

    if (variantPrice) {
      this.#priceBreaks.push({
        quantity: minQuantity,
        price: variantPrice,
        cents: baseCents,
      });
    }

    if (priceBreaksData) {
      const breaks = JSON.parse(priceBreaksData);
      for (const row of breaks) {
        const { quantity, price, cents } = row;
        if (quantity && price) {
          this.#priceBreaks.push({
            quantity: parseInt(quantity, 10),
            price,
            cents: cents != null ? parseInt(String(cents), 10) : null,
          });
        }
      }
    }

    this.#priceBreaks.sort((a, b) => b.quantity - a.quantity);
  }

  #priceHtml(pb) {
    const useCurrency = this.dataset.currencyCodeEnabled === 'true';
    if (
      typeof Theme !== 'undefined' &&
      Theme.formatPriceSplitHTML &&
      pb.cents != null &&
      !Number.isNaN(pb.cents)
    ) {
      return Theme.formatPriceSplitHTML(pb.cents, useCurrency, 'product_page');
    }
    return pb.price;
  }

  /**
   * Attaches event listeners for quantity and cart updates
   */
  #attachEventListeners() {
    const { signal } = this.#abortController;

    document.addEventListener(ThemeEvents.quantitySelectorUpdate, this.#handleQuantityUpdate, { signal });
    document.addEventListener(ThemeEvents.cartUpdate, this.#handleCartUpdate, { signal });
  }

  /**
   * Handles quantity selector updates
   * @param {Event} event
   */
  #handleQuantityUpdate = (event) => {
    const form = this.closest('product-form-component');
    if (!form || !(event.target instanceof Node) || !form.contains(event.target)) return;

    this.#updatePriceDisplay();
  };

  /**
   * Handles cart updates by refreshing display
   */
  #handleCartUpdate = () => {
    this.#updatePriceDisplay();
  };

  /**
   * Gets the total quantity (cart + current input value)
   * @returns {number}
   */
  #getCurrentQuantity() {
    const form = this.closest('product-form-component');
    const quantityInput = /** @type {HTMLInputElement | null} */ (form?.querySelector('input[name="quantity"]'));
    if (!quantityInput) return 1;

    const cartQty = parseInt(quantityInput.getAttribute('data-cart-quantity') || '0') || 0;
    const inputQty = parseInt(quantityInput.value) || 1;

    return cartQty + inputQty;
  }

  /**
   * Updates the price display based on current quantity
   */
  updatePriceDisplay() {
    if (!this.#priceBreaks.length || !this.refs.pricePerItemText) return;

    const quantity = this.#getCurrentQuantity();

    const priceBreak =
      this.#priceBreaks.find((pb) => quantity >= pb.quantity) ?? this.#priceBreaks[this.#priceBreaks.length - 1];

    if (priceBreak) {
      this.refs.pricePerItemText.innerHTML = `${this.dataset.atText} ${this.#priceHtml(priceBreak)}/${this.dataset.eachText}`;
    }
  }

  /**
   * Private wrapper for event handlers
   */
  #updatePriceDisplay = () => {
    this.updatePriceDisplay();
  };
}

if (!customElements.get('price-per-item')) {
  customElements.define('price-per-item', PricePerItemComponent);
}
