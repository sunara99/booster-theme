import { ThemeEvents, VariantUpdateEvent } from '@theme/events';

/**
 * A custom element that displays a product price.
 * This component listens for variant update events and updates the price display accordingly.
 * It handles price updates from two different sources:
 * 1. Variant picker (in quick add modal or product page)
 * 2. Swatches variant picker (in product cards)
 */
class ProductPrice extends HTMLElement {
  /**
   * Format cents as money string using theme format or Intl.
   * @param {number} cents
   * @returns {string}
   */
  static formatMoneyCents(cents) {
    const amount = cents / 100;
    const moneyFormat = typeof window.Theme !== 'undefined' && window.Theme.moneyFormat;
    if (moneyFormat) {
      const formatted = amount.toFixed(2);
      return moneyFormat.replace(/\{\{\s*amount\s*\}\}/g, formatted).replace(/<[^>]+>/g, '').trim();
    }
    const currency = typeof window.Theme !== 'undefined' && window.Theme.currency ? window.Theme.currency : 'USD';
    return new Intl.NumberFormat(document.documentElement.lang || 'en', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  connectedCallback() {
    const closestSection = this.closest('.shopify-section, dialog');
    if (!closestSection) return;
    closestSection.addEventListener(ThemeEvents.variantUpdate, this.updatePrice);
    
    // Set up quantity breaks price listener
    this.setupQuantityBreaksListener();
    
    // Check for quantity breaks price on initial load
    setTimeout(() => this.updatePriceFromQuantityBreaks(), 100);
  }

  disconnectedCallback() {
    const closestSection = this.closest('.shopify-section, dialog');
    if (!closestSection) return;
    closestSection.removeEventListener(ThemeEvents.variantUpdate, this.updatePrice);
    
    // Clean up quantity breaks listeners
    if (this.quantityBreaksClickHandler) {
      document.removeEventListener('click', this.quantityBreaksClickHandler);
    }
    if (this.quantityBreaksObserver) {
      this.quantityBreaksObserver.disconnect();
    }
  }

  /**
   * Sets up listener for quantity breaks card selection
   */
  setupQuantityBreaksListener() {
    // Listen for clicks on quantity break cards
    this.quantityBreaksClickHandler = (event) => {
      const clickedCard = event.target.closest('.quantity-breaks__card');
      if (clickedCard) {
        // Check if the clicked card is in the same section as this price component
        const closestSection = this.closest('.shopify-section, dialog');
        const cardSection = clickedCard.closest('.shopify-section, dialog');
        if (closestSection && cardSection && closestSection === cardSection) {
          setTimeout(() => this.updatePriceFromQuantityBreaks(), 50);
        }
      }
    };
    document.addEventListener('click', this.quantityBreaksClickHandler);
    
    // Watch for active class changes on quantity break cards within the same section
    const closestSection = this.closest('.shopify-section, dialog');
    if (closestSection) {
      const quantityBreaksComponent = closestSection.querySelector('[data-quantity-breaks-component]');
      if (quantityBreaksComponent) {
        this.quantityBreaksObserver = new MutationObserver((mutations) => {
          // Only trigger if the mutation is related to active class changes on cards
          const shouldUpdate = mutations.some(mutation => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
              const target = mutation.target;
              if (target.classList.contains('quantity-breaks__card')) {
                return target.classList.contains('quantity-breaks__card--active') || 
                       !target.classList.contains('quantity-breaks__card--active');
              }
            }
            return false;
          });
          
          if (shouldUpdate) {
            this.updatePriceFromQuantityBreaks();
          }
        });
        
        this.quantityBreaksObserver.observe(quantityBreaksComponent, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['class']
        });
      }
    }
  }

  /**
   * Updates price from quantity breaks if block is present and a card is selected
   */
  updatePriceFromQuantityBreaks() {
    // Debounce to prevent rapid successive calls
    if (this._updatingPrice) return;
    this._updatingPrice = true;
    
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      try {
        // Find quantity breaks component within the same section only
        const closestSection = this.closest('.shopify-section, dialog');
        if (!closestSection) {
          this._updatingPrice = false;
          return;
        }
        
        const quantityBreaksComponent = closestSection.querySelector('[data-quantity-breaks-component]');
        if (!quantityBreaksComponent) {
          this._updatingPrice = false;
          return;
        }

        // Check if price override is enabled
        const overrideEnabled = quantityBreaksComponent.dataset.overrideProductPrice === 'true';
        if (!overrideEnabled) {
          this._updatingPrice = false;
          return;
        }

        const activeCard = quantityBreaksComponent.querySelector('.quantity-breaks__card--active');
        if (!activeCard) {
          this._updatingPrice = false;
          return;
        }

        const quantityPriceElement = activeCard.querySelector('.quantity-breaks__price');
        const quantityComparePriceElement = activeCard.querySelector('.quantity-breaks__original-price');
        
        if (!quantityPriceElement) {
          this._updatingPrice = false;
          return;
        }

        const currentPriceElement = this.querySelector('[ref="priceContainer"]');
        if (!currentPriceElement) {
          this._updatingPrice = false;
          return;
        }

        // Get show_sale_price_first setting
        const showSalePriceFirst = this.dataset.showSalePriceFirst === 'true';

        let currentPriceSpan = currentPriceElement.querySelector('.price');
        
        // Find ALL compare price elements to handle duplicates
        // Search within the product-price element (not just priceContainer) since compare prices
        // might be added as siblings to priceContainer
        const allComparePriceSpans = this.querySelectorAll('.compare-at-price');
        
        if (currentPriceSpan) {
          // When product has no compare price, the sale price is a bare <span class="price">.
          // Ensure override sale price is inside <span role="group"> for consistent structure.
          if (!currentPriceSpan.closest('[role="group"]')) {
            const salePriceGroup = document.createElement('span');
            salePriceGroup.setAttribute('role', 'group');
            currentPriceSpan.parentNode.insertBefore(salePriceGroup, currentPriceSpan);
            salePriceGroup.appendChild(currentPriceSpan);
          }

          const priceClone = quantityPriceElement.cloneNode(true);
          priceClone.querySelectorAll('.quantity-breaks__per-unit-text').forEach((el) => el.remove());
          currentPriceSpan.innerHTML = priceClone.innerHTML.trim();
          if (!quantityComparePriceElement) {
            currentPriceSpan.style.marginLeft = '';
          }
        }

        if (quantityComparePriceElement) {
          // Remove all existing compare price elements to prevent duplicates
          // This handles the case where multiple compare prices were created in previous calls
          // Also remove any groups that only contain compare prices
          allComparePriceSpans.forEach(compareSpan => {
            const comparePriceGroup = compareSpan.closest('[role="group"]');
            if (comparePriceGroup && comparePriceGroup.children.length === 1 && comparePriceGroup.querySelector('.compare-at-price')) {
              // Remove the entire group if it only contains the compare price
              comparePriceGroup.remove();
            } else {
              // Remove just the compare price span
              compareSpan.remove();
            }
          });

          // Now create a single compare price element
          const priceGroup = currentPriceSpan?.closest('[role="group"]') || currentPriceSpan?.parentElement;
          const comparePriceGroup = document.createElement('span');
          comparePriceGroup.setAttribute('role', 'group');
          const comparePriceSpan = document.createElement('span');
          comparePriceSpan.className = 'compare-at-price';
          const compareClone = quantityComparePriceElement.cloneNode(true);
          compareClone.querySelectorAll('.quantity-breaks__per-unit-text').forEach((el) => el.remove());
          comparePriceSpan.innerHTML = compareClone.innerHTML.trim();
          
          // Set margin based on show_sale_price_first setting
          if (showSalePriceFirst) {
            comparePriceSpan.style.marginLeft = 'var(--margin-xs, 0.5rem)';
          } else {
            comparePriceSpan.style.marginLeft = '';
            if (currentPriceSpan) {
              currentPriceSpan.style.marginLeft = 'var(--margin-xs, 0.5rem)';
            }
          }
          comparePriceGroup.appendChild(comparePriceSpan);
          
          // Insert the compare price in the correct position
          if (currentPriceSpan && priceGroup) {
            // Respect show_sale_price_first setting for positioning
            if (showSalePriceFirst) {
              // Sale price first: price comes before compare price
              priceGroup.insertAdjacentElement('afterend', comparePriceGroup);
            } else {
              // Compare price first: compare price comes before price
              priceGroup.insertAdjacentElement('beforebegin', comparePriceGroup);
            }
          } else if (currentPriceSpan) {
            // Respect show_sale_price_first setting for positioning
            if (showSalePriceFirst) {
              currentPriceSpan.insertAdjacentElement('afterend', comparePriceGroup);
            } else {
              currentPriceSpan.insertAdjacentElement('beforebegin', comparePriceGroup);
            }
          } else {
            currentPriceElement.appendChild(comparePriceGroup);
          }
        } else {
          // If compare price doesn't exist in quantity breaks but exists in product price, remove all of them
          // Also remove any groups that only contain compare prices
          allComparePriceSpans.forEach(compareSpan => {
            const comparePriceGroup = compareSpan.closest('[role="group"]');
            if (comparePriceGroup && comparePriceGroup.children.length === 1 && comparePriceGroup.querySelector('.compare-at-price')) {
              // Remove the entire group if it only contains the compare price
              comparePriceGroup.remove();
            } else {
              // Remove just the compare price span
              compareSpan.remove();
            }
          });
          
          // Reset margin on price span when compare price is removed
          if (currentPriceSpan) {
            currentPriceSpan.style.marginLeft = '';
          }
        }
      } finally {
        // Reset flag after a short delay to allow DOM updates to complete
        setTimeout(() => {
          this._updatingPrice = false;
        }, 100);
      }
    });
  }

  /**
   * Updates the price and volume pricing note.
   * @param {VariantUpdateEvent} event - The variant update event.
   */
  updatePrice = (event) => {
    if (event.detail.data.newProduct) {
      this.dataset.productId = event.detail.data.newProduct.id;
    } else if (event.target instanceof HTMLElement && event.target.dataset.productId !== this.dataset.productId) {
      return;
    }

    // Check if quantity breaks block is present and has an active card
    // If so, use price from quantity breaks instead of variant price (only if override is enabled)
    // Only check within the same section
    const closestSection = this.closest('.shopify-section, dialog');
    if (closestSection) {
      const quantityBreaksComponent = closestSection.querySelector('[data-quantity-breaks-component]');
      if (quantityBreaksComponent) {
        const overrideEnabled = quantityBreaksComponent.dataset.overrideProductPrice === 'true';
        if (overrideEnabled) {
          const activeCard = quantityBreaksComponent.querySelector('.quantity-breaks__card--active');
          if (activeCard) {
            this.updatePriceFromQuantityBreaks();
            const newProductPrice = event.detail.data.html.querySelector(`product-price[data-block-id="${this.dataset.blockId}"]`);
            if (newProductPrice) {
              const newBadge = newProductPrice.querySelector('.sale-badge');
              const currentBadge = this.querySelector('.sale-badge');
              if (!newBadge) {
                currentBadge?.remove();
              } else if (!currentBadge) {
                this.querySelector('[ref="priceContainer"]')?.insertAdjacentElement('afterend', /** @type {Element} */ (newBadge.cloneNode(true)));
              } else {
                currentBadge.replaceWith(newBadge.cloneNode(true));
              }
            }
            return;
          }
        }
      }
    }

    // Find the new product-price element in the updated HTML
    const newProductPrice = event.detail.data.html.querySelector(`product-price[data-block-id="${this.dataset.blockId}"]`);
    if (!newProductPrice) return;

    // Update price container
    const newPrice = newProductPrice.querySelector('[ref="priceContainer"]');
    const currentPrice = this.querySelector('[ref="priceContainer"]');
    if (newPrice && currentPrice) currentPrice.replaceWith(newPrice);

    // Update volume pricing note
    const currentNote = this.querySelector('.volume-pricing-note');
    const newNote = newProductPrice.querySelector('.volume-pricing-note');

    if (!newNote) {
      currentNote?.remove();
    } else if (!currentNote) {
      this.querySelector('[ref="priceContainer"]')?.insertAdjacentElement('afterend', /** @type {Element} */ (newNote.cloneNode(true)));
    } else {
      currentNote.replaceWith(newNote);
    }
  };
}

if (!customElements.get('product-price')) {
  customElements.define('product-price', ProductPrice);
}
