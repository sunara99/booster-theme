/**
 * Quantity breaks – card selection, quantity sync, variant price/image updates.
 * Uses event delegation and defers init for faster load.
 */
(function() {
  const MAX_RETRIES = 3;

  function updateQuantity(quantity, variantId, retryCount = 0) {
    const qs = document.querySelector('quantity-selector-component');
    const input = qs?.refs?.quantityInput
      ? qs.refs.quantityInput
      : document.querySelector('input[name="quantity"]');
    if (input) {
      input.value = quantity;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new Event('blur', { bubbles: true }));
    } else if (retryCount < MAX_RETRIES) {
      setTimeout(() => updateQuantity(quantity, variantId, retryCount + 1), 100);
      return;
    }

    const variantInput = document.querySelector('input[name="id"][ref="variantId"]');
    if (variantInput && variantId && variantInput.value !== String(variantId)) {
      variantInput.value = variantId;
      variantInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function formatPriceDisplay(cents, showCurrency = false, component = null) {
    if (typeof Theme !== 'undefined' && Theme.formatPriceSplitHTML) {
      return Theme.formatPriceSplitHTML(cents, showCurrency === true, 'quantity_breaks');
    }
    return formatMoney(cents, showCurrency, component);
  }

  function formatMoney(cents, showCurrency = false, component = null) {
    const amount = cents / 100;
    const moneyFormat = component?.dataset?.moneyFormat || (typeof window.Theme !== 'undefined' && window.Theme.moneyFormat);
    const currency = component?.dataset?.currency || (typeof window.Theme !== 'undefined' && window.Theme.currency) || 'USD';
    let result;
    if (moneyFormat) {
      const formatted = amount.toFixed(2);
      const rounded = String(Math.round(amount));
      const withComma = amount.toFixed(2).replace('.', ',');
      result = moneyFormat
        .replace(/\{\{\s*amount\s*\}\}/g, formatted)
        .replace(/\{\{\s*amount_no_decimals\s*\}\}/g, rounded)
        .replace(/\{\{\s*amount_with_comma_separator\s*\}\}/g, withComma)
        .replace(/\{\{\s*amount_no_decimals_with_comma_separator\s*\}\}/g, rounded)
        .replace(/\{\{\s*amount_with_space_separator\s*\}\}/g, withComma)
        .replace(/\{\{\s*amount_with_apostrophe_separator\s*\}\}/g, formatted.replace('.', "'"))
        .replace(/\{\{\s*amount_no_decimals_with_space_separator\s*\}\}/g, rounded)
        .replace(/\{\{\s*amount_with_period_and_space_separator\s*\}\}/g, formatted);
      // Strip any HTML from shop money format (e.g. <span class="money">) so we output plain text only
      result = result.replace(/<[^>]+>/g, '').trim();
    } else {
      result = new Intl.NumberFormat(document.documentElement.lang || 'en', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(amount);
    }
    return result;
  }

  function updateFreeGiftsState(component) {
    const freeGifts = component.querySelector('[data-free-gifts]');
    if (!freeGifts) return;
    const activeCard = component.querySelector('.quantity-breaks__card--active');
    const selectedIndex = activeCard ? parseInt(activeCard.dataset.optionIndex || '1', 10) : 1;
    freeGifts.querySelectorAll('[data-gift-card]').forEach(giftCard => {
      const unlockIndex = parseInt(giftCard.dataset.unlockIndex || '2', 10);
      const enabled = selectedIndex >= unlockIndex;
      giftCard.classList.toggle('quantity-breaks-gift-card--enabled', enabled);
      giftCard.classList.toggle('quantity-breaks-gift-card--locked', !enabled);
      const variantSelect = giftCard.querySelector('[data-variant-select]');
      if (variantSelect) {
        variantSelect.disabled = !enabled;
      }
      if (enabled) {
        const opt = variantSelect?.options[variantSelect?.selectedIndex];
        if (opt) {
          giftCard.dataset.variantId = opt.value;
        }
      }
    });
  }

  function updateGiftCardPriceBadge(giftCard, priceCents) {
    const qb = document.querySelector('[data-quantity-breaks-component]');
    const discountEnabled = giftCard.dataset.giftDiscountEnabled === 'true';
    let displayPrice = priceCents;
    let originalPrice = priceCents;
    if (discountEnabled) {
      const discountType = giftCard.dataset.giftDiscountType || 'percentage';
      const discountValue = parseFloat(giftCard.dataset.giftDiscountValue) || 0;
      const discountAmount = parseFloat(giftCard.dataset.giftDiscountAmount) || 0;
      if (discountType === 'percentage') {
        displayPrice = Math.round(priceCents * (100 - discountValue) / 100);
      } else {
        displayPrice = Math.max(0, priceCents - discountAmount);
      }
    }
    const badge = giftCard.querySelector('.quantity-breaks-gift-card__price-badge');
    if (!badge || !qb) return;
    const fmt = (c) => formatPriceDisplay(c, false, qb);
    if (discountEnabled && displayPrice < originalPrice) {
      badge.innerHTML = '<span class="quantity-breaks-gift-card__original-price">' + fmt(originalPrice) + '</span><span class="quantity-breaks-gift-card__discounted-price">' + fmt(displayPrice) + '</span>';
    } else {
      badge.innerHTML = fmt(originalPrice);
    }
  }

  function initFreeGiftsVariantSelects(component) {
    const freeGifts = component.querySelector('[data-free-gifts]');
    if (!freeGifts) return;
    freeGifts.querySelectorAll('[data-variant-select]').forEach(select => {
      select.addEventListener('change', function() {
        const giftCard = this.closest('[data-gift-card]');
        if (giftCard && this.options[this.selectedIndex]) {
          const opt = this.options[this.selectedIndex];
          giftCard.dataset.variantId = opt.value;
          const price = parseInt(opt.dataset?.price || opt.getAttribute('data-price') || '0', 10);
          if (price) updateGiftCardPriceBadge(giftCard, price);
        }
      });
    });
  }

  function syncVariantPickersToCard(card) {
    if (!card?.dataset?.hasVariantPickers) return;
    const pickersContainer = card.querySelector('[data-quantity-breaks-variant-pickers]');
    if (!pickersContainer) return;
    const selects = pickersContainer.querySelectorAll('[data-variant-select]');
    const ids = [];
    selects.forEach((sel) => {
      if (sel?.options[sel.selectedIndex]) {
        ids.push(sel.options[sel.selectedIndex].value);
      }
    });
    if (ids.length) card.dataset.variantIds = ids.join(',');
  }

  function updateVariantSwatch(select) {
    const wrapper = select.closest('.quantity-breaks__variant-picker-select-wrapper');
    const swatchEl = wrapper?.querySelector('[data-variant-swatch]');
    if (!swatchEl) return;
    const opt = select?.options[select?.selectedIndex];
    const bg = opt?.dataset?.swatchBackground || opt?.getAttribute('data-swatch-background');
    if (bg) {
      swatchEl.style.setProperty('--swatch-background', bg);
      swatchEl.style.display = '';
    } else {
      swatchEl.style.display = 'none';
    }
  }

  function resizeVariantSelectToContent(select) {
    const opt = select?.options[select?.selectedIndex];
    if (!opt) return;
    const text = opt.textContent.replace(/\s*-\s*Unavailable$/i, '').trim() || ' ';
    const cs = getComputedStyle(select);
    const measure = document.createElement('span');
    measure.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;pointer-events:none;';
    measure.style.font = cs.font;
    measure.style.fontSize = cs.fontSize;
    measure.style.fontFamily = cs.fontFamily;
    measure.style.fontWeight = cs.fontWeight;
    measure.style.letterSpacing = cs.letterSpacing;
    measure.textContent = text;
    document.body.appendChild(measure);
    const textWidth = measure.offsetWidth;
    document.body.removeChild(measure);
    const padding = parseInt(cs.paddingLeft || 0, 10) + parseInt(cs.paddingRight || 0, 10);
    const arrowSpace = 28;
    select.style.width = Math.max(textWidth + padding + arrowSpace, 60) + 'px';
  }

  function initQuantityBreaksVariantSelects(component) {
    component.querySelectorAll('[data-quantity-breaks-variant-pickers] [data-variant-select]').forEach(select => {
      resizeVariantSelectToContent(select);
      updateVariantSwatch(select);
      select.addEventListener('change', function() {
        const card = this.closest('.quantity-breaks__card');
        if (!card || !this.options[this.selectedIndex]) return;
        const opt = this.options[this.selectedIndex];
        const variantId = opt.value;
        const price = parseInt(opt.dataset?.price || opt.getAttribute('data-price') || '0', 10);
        const compareAtPrice = parseInt(opt.dataset?.compareAtPrice || opt.getAttribute('data-compare-at-price') || price, 10);
        const imageUrl = opt.dataset?.imageUrl || opt.getAttribute('data-image-url');

        syncVariantPickersToCard(card);
        card.dataset.variantId = variantId;

        const isActive = card.classList.contains('quantity-breaks__card--active');
        if (isActive) {
          const quantity = parseInt(this.dataset.quantity || card.dataset.quantity || '2', 10);
          updateQuantity(quantity, variantId);
        }

        const variantResource = {
          id: parseInt(variantId, 10),
          price: price,
          compare_at_price: compareAtPrice,
          featured_media: imageUrl ? { preview_image: { src: imageUrl } } : null,
          featured_image: imageUrl
        };
        document.dispatchEvent(new CustomEvent('variant:update', { detail: { resource: variantResource } }));
        resizeVariantSelectToContent(this);
        updateVariantSwatch(this);
      });
    });
  }

  function preselectRecommendedCard(component) {
    let recommended = component.querySelector('.quantity-breaks__card--recommended:not(.quantity-breaks__card--sold-out)');
    if (!recommended) {
      recommended = component.querySelector('.quantity-breaks__card:not(.quantity-breaks__card--sold-out)');
    }
    if (!recommended) return;
    syncVariantPickersToCard(recommended);
    const quantity = parseInt(recommended.dataset.quantity, 10);
    const variantId = recommended.dataset.variantId;
    updateQuantity(quantity, variantId);
    component.querySelectorAll('.quantity-breaks__card').forEach(c => {
      c.classList.remove('quantity-breaks__card--active');
    });
    recommended.classList.add('quantity-breaks__card--active');
    recommended.classList.remove('quantity-breaks__card--unselected');
    updateFreeGiftsState(component);
    recommended.querySelectorAll('[data-variant-select]').forEach(sel => {
      resizeVariantSelectToContent(sel);
      updateVariantSwatch(sel);
    });
  }

  function getCardVariantTotal(card) {
    if (card?.dataset?.hasVariantPickers !== 'true') return null;
    const pickers = card.querySelector('[data-quantity-breaks-variant-pickers]');
    if (!pickers) return null;
    const selects = pickers.querySelectorAll('[data-variant-select]');
    let totalPrice = 0;
    let totalCompare = 0;
    selects.forEach((sel) => {
      const opt = sel?.options[sel?.selectedIndex];
      if (opt) {
        totalPrice += parseInt(opt.dataset?.price || opt.getAttribute('data-price') || '0', 10);
        totalCompare += parseInt(opt.dataset?.compareAtPrice || opt.getAttribute('data-compare-at-price') || opt.dataset?.price || opt.getAttribute('data-price') || '0', 10);
      }
    });
    return selects.length > 0 ? { total: totalPrice, compare: totalCompare } : null;
  }

  function updateVariantPrices(event) {
    const component = document.querySelector('[data-quantity-breaks-component]');
    if (!component) return;
    const variant = event.detail?.resource;
    if (!variant?.price) return;

    const basePrice = variant.price;
    const baseCompareAtPrice = variant.compare_at_price || variant.price;
    const variantId = variant.id;
    const showCurrency = component.dataset.currencyCodeEnabled === 'true';
    const perUnitText = component.dataset.perUnitText || '/Pcs';
    const comparePriceType = component.dataset.comparePriceType || 'calculated';
    const cards = component.querySelectorAll('.quantity-breaks__card');

    cards.forEach(card => {
      const pickerTotal = getCardVariantTotal(card);
      if (pickerTotal) {
        syncVariantPickersToCard(card);
      }
      const firstPickerSelect = card.querySelector('[data-variant-select]');
      const cardVariantId = firstPickerSelect?.options[firstPickerSelect?.selectedIndex]?.value || variantId;
      if (cardVariantId) card.dataset.variantId = cardVariantId;

      const quantity = parseInt(card.dataset.quantity, 10) || 1;
      const discountType = card.dataset.discountType || 'percentage';
      const discount = parseFloat(card.dataset.discount) || 0;
      const discountAmountFixed = parseFloat(card.dataset.discountAmount) || 0;
      const showPerUnit = card.dataset.showPerUnit === 'true';

      let total;
      let baseCompareForCompare;
      if (pickerTotal) {
        total = pickerTotal.total;
        baseCompareForCompare = pickerTotal.compare;
      } else {
        total = basePrice * quantity;
        baseCompareForCompare = baseCompareAtPrice * quantity;
      }
      const discountAmount = discountType === 'fixed' ? discountAmountFixed : total * discount / 100;
      const discountAmountFloored = discountType === 'fixed' ? discountAmountFixed : Math.floor(discountAmount);
      let finalPrice = total - discountAmountFloored;
      if (discountType !== 'fixed' && discountAmount % 1 > 0) {
        finalPrice += 1;
      }
      const effectiveDiscount = total > 0 ? Math.round((discountAmount / total) * 100) : 0;
      const discountAmountRounded = discountType === 'fixed' ? discountAmountFixed : Math.round(discountAmount);
      const comparePrice = comparePriceType === 'original' ? baseCompareForCompare : total;
      const shouldShowCompare = effectiveDiscount > 0 || (discountType === 'fixed' && discountAmountRounded > 0) || (comparePriceType === 'original' && baseCompareForCompare > total) || baseCompareForCompare > finalPrice;

      const finalPriceRounded = Math.round(finalPrice);
      card.dataset.finalPriceCents = String(finalPriceRounded);
      card.dataset.comparePriceCents = String(Math.round(comparePrice));

      const priceContainer = card.querySelector('.quantity-breaks__price-container');
      if (!priceContainer) return;
      const finalFormatted = formatPriceDisplay(finalPriceRounded, showCurrency, component);
      const compareFormatted = formatPriceDisplay(Math.round(comparePrice), showCurrency, component);

      if (showPerUnit) {
        const perUnitPrice = Math.round(finalPriceRounded / quantity);
        let perUnitCompare = Math.round(comparePrice / quantity);
        if (comparePriceType === 'calculated' && baseCompareForCompare > finalPrice) {
          perUnitCompare = Math.round(baseCompareForCompare / quantity);
        }
        const priceEl = priceContainer.querySelector('.quantity-breaks__price');
        const compareEl = priceContainer.querySelector('.quantity-breaks__original-price');
        if (priceEl) {
          priceEl.innerHTML = formatPriceDisplay(perUnitPrice, showCurrency, component) + ' <span class="quantity-breaks__per-unit-text">' + perUnitText + '</span>';
        }
        if (shouldShowCompare) {
          const html = formatPriceDisplay(perUnitCompare, showCurrency, component) + ' <span class="quantity-breaks__per-unit-text">' + perUnitText + '</span>';
          if (compareEl) {
            compareEl.innerHTML = html;
            compareEl.style.display = '';
          } else if (priceEl) {
            const span = document.createElement('span');
            span.className = 'quantity-breaks__original-price';
            span.innerHTML = html;
            priceContainer.appendChild(span);
          }
        } else if (compareEl) compareEl.remove();
      } else {
        const priceEl = priceContainer.querySelector('.quantity-breaks__price');
        const compareEl = priceContainer.querySelector('.quantity-breaks__original-price');
        if (priceEl) priceEl.innerHTML = finalFormatted;
        if (shouldShowCompare) {
          if (compareEl) {
            compareEl.innerHTML = compareFormatted;
            compareEl.style.display = '';
          } else if (priceEl) {
            const span = document.createElement('span');
            span.className = 'quantity-breaks__original-price';
            span.innerHTML = compareFormatted;
            priceContainer.appendChild(span);
          }
        } else if (compareEl) compareEl.remove();
      }
    });
  }

  function updateVariantImages(event) {
    const component = document.querySelector('[data-quantity-breaks-component]');
    if (!component) return;
    const variant = event.detail?.resource;
    if (!variant) return;

    let url = variant.featured_media?.preview_image?.src || variant.featured_image;
    if (!url && event.detail?.data?.html) {
      const el = event.detail.data.html.querySelector('[data-product-variant-media]');
      if (el) url = (el.getAttribute('data-product-variant-media') || '').split('&width=')[0].split('?width=')[0];
    }
    if (!url) return;

    const imageSize = parseInt(getComputedStyle(component).getPropertyValue('--image-size') || '60', 10) * 2;
    component.querySelectorAll('img[data-option-image]').forEach(img => {
      if (img.dataset.customImage === 'true') return;
      try {
        const u = new URL(url, window.location.origin);
        u.searchParams.set('width', String(imageSize));
        img.src = u.toString();
      } catch (_) {
        img.src = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'width=' + imageSize;
      }
    });
  }

  function handleVariantUpdate(event) {
    updateVariantImages(event);
    updateVariantPrices(event);
  }

  function initQuantityBreaks(componentEl) {
    const component = componentEl || document.querySelector('[data-quantity-breaks-component]');
    if (!component) return;

    if (!component.dataset.initialized) {
      component.dataset.initialized = '1';
      // Event delegation: one listener on container instead of per card
      component.addEventListener('click', function(e) {
        const card = e.target.closest('.quantity-breaks__card');
        if (!card || card.classList.contains('quantity-breaks__card--sold-out')) return;
        if (!card.classList.contains('quantity-breaks__card--recommended')) {
          component.dataset.userHasSelectedOther = 'true';
        }
        syncVariantPickersToCard(card);
        const quantity = parseInt(card.dataset.quantity, 10);
        const variantId = card.dataset.variantId;
        updateQuantity(quantity, variantId);
        component.querySelectorAll('.quantity-breaks__card').forEach(c => {
          c.classList.remove('quantity-breaks__card--active');
          if (c !== card && c.classList.contains('quantity-breaks__card--recommended')) {
            c.classList.add('quantity-breaks__card--unselected');
          }
        });
        card.classList.add('quantity-breaks__card--active');
        card.classList.remove('quantity-breaks__card--unselected');
        updateFreeGiftsState(component);
        card.querySelectorAll('[data-variant-select]').forEach(sel => {
          resizeVariantSelectToContent(sel);
          updateVariantSwatch(sel);
        });
        const buy = document.querySelector('.buy-buttons-block');
        if (buy) setTimeout(() => buy.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
      });
    }

    initFreeGiftsVariantSelects(component);
    initQuantityBreaksVariantSelects(component);
    setTimeout(() => {
      preselectRecommendedCard(component);
      if (!component.querySelector('.quantity-breaks__card--recommended')) {
        updateFreeGiftsState(component);
      }
    }, 50);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initQuantityBreaks());
  } else {
    initQuantityBreaks();
  }

  document.addEventListener('variant:update', handleVariantUpdate);
  document.addEventListener('shopify:section:load', function(ev) {
    const comp = ev.detail?.querySelector?.('[data-quantity-breaks-component]');
    if (comp) {
      delete comp.dataset.initialized;
      initQuantityBreaks(comp);
    }
  });
})();
