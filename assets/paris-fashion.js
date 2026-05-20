/* ============================================================
   PARIS FASHION — JavaScript
   File: assets/paris-fashion.js
   Vanilla JS only — no external dependencies
   ============================================================ */

(function () {
  'use strict';

  /* ----------------------------------------------------------
     ANNOUNCEMENT BAR CLOSE
  ---------------------------------------------------------- */
  document.querySelectorAll('.paris-announcement-bar__close').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var bar = btn.closest('.paris-announcement-bar');
      if (bar) {
        bar.style.height = bar.offsetHeight + 'px';
        requestAnimationFrame(function () {
          bar.style.transition = 'height 0.3s ease, padding 0.3s ease, opacity 0.3s ease';
          bar.style.height = '0';
          bar.style.paddingTop = '0';
          bar.style.paddingBottom = '0';
          bar.style.overflow = 'hidden';
          bar.style.opacity = '0';
        });
        bar.addEventListener('transitionend', function () { bar.remove(); }, { once: true });
      }
    });
  });

  /* ----------------------------------------------------------
     ACCORDION (FAQ + Product description)
  ---------------------------------------------------------- */
  document.querySelectorAll('.paris-accordion__trigger').forEach(function (trigger) {
    trigger.setAttribute('aria-expanded', 'false');

    trigger.addEventListener('click', function () {
      var item = trigger.closest('.paris-accordion__item');
      var panel = item.querySelector('.paris-accordion__panel');
      var inner = panel ? panel.querySelector('.paris-accordion__panel-inner') : null;
      var isOpen = item.classList.contains('is-open');

      // Close siblings
      var accordion = item.closest('.paris-accordion');
      if (accordion) {
        accordion.querySelectorAll('.paris-accordion__item.is-open').forEach(function (openItem) {
          if (openItem !== item) {
            openItem.classList.remove('is-open');
            var op = openItem.querySelector('.paris-accordion__panel');
            if (op) op.style.height = '0';
            var ot = openItem.querySelector('.paris-accordion__trigger');
            if (ot) ot.setAttribute('aria-expanded', 'false');
          }
        });
      }

      if (isOpen) {
        item.classList.remove('is-open');
        if (panel) panel.style.height = '0';
        trigger.setAttribute('aria-expanded', 'false');
      } else {
        item.classList.add('is-open');
        if (panel && inner) panel.style.height = inner.offsetHeight + 'px';
        trigger.setAttribute('aria-expanded', 'true');
      }
    });

    trigger.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); trigger.click(); }
    });
  });

  /* ----------------------------------------------------------
     PRODUCT GALLERY THUMBNAILS
  ---------------------------------------------------------- */
  document.querySelectorAll('.paris-gallery').forEach(function (gallery) {
    var mainImg = gallery.querySelector('.paris-gallery__main-img');
    var thumbs = gallery.querySelectorAll('.paris-gallery__thumb');

    thumbs.forEach(function (thumb) {
      thumb.addEventListener('click', function () {
        var src = thumb.getAttribute('data-src');
        var alt = thumb.getAttribute('data-alt') || '';
        if (mainImg && src) {
          mainImg.style.opacity = '0';
          setTimeout(function () {
            mainImg.src = src;
            mainImg.alt = alt;
            mainImg.style.opacity = '1';
          }, 150);
        }
        thumbs.forEach(function (t) { t.classList.remove('is-active'); });
        thumb.classList.add('is-active');
      });
    });
  });

  /* ----------------------------------------------------------
     QUANTITY SELECTOR
  ---------------------------------------------------------- */
  document.querySelectorAll('.paris-quantity-selector').forEach(function (el) {
    var input = el.querySelector('.paris-quantity-input');
    var btnMinus = el.querySelector('[data-qty-minus]');
    var btnPlus = el.querySelector('[data-qty-plus]');
    if (!input) return;

    if (btnMinus) {
      btnMinus.addEventListener('click', function () {
        var v = parseInt(input.value, 10) || 1;
        if (v > 1) { input.value = v - 1; input.dispatchEvent(new Event('change', { bubbles: true })); }
      });
    }
    if (btnPlus) {
      btnPlus.addEventListener('click', function () {
        var v = parseInt(input.value, 10) || 1;
        var max = parseInt(input.getAttribute('max'), 10) || 999;
        if (v < max) { input.value = v + 1; input.dispatchEvent(new Event('change', { bubbles: true })); }
      });
    }
  });

  /* ----------------------------------------------------------
     VARIANT PICKER
  ---------------------------------------------------------- */
  document.querySelectorAll('[data-paris-variant-form]').forEach(function (form) {
    var variantsRaw = form.getAttribute('data-variants');
    if (!variantsRaw) return;

    var variants;
    try { variants = JSON.parse(variantsRaw); }
    catch (e) { return; }

    var variantInput = form.querySelector('[data-variant-id]');
    var priceEl = form.querySelector('[data-paris-price]');
    var compareEl = form.querySelector('[data-paris-compare-price]');
    var atcBtn = form.querySelector('.paris-btn--atc');
    var optionGroups = form.querySelectorAll('[data-option-index]');
    var selectedOptions = [];

    // Initialise from active state
    optionGroups.forEach(function (group) {
      var idx = parseInt(group.getAttribute('data-option-index'), 10);
      var active = group.querySelector('.paris-option-btn.is-active');
      selectedOptions[idx] = active ? active.getAttribute('data-value') : null;
    });

    function findVariant(opts) {
      return variants.find(function (v) {
        return opts.every(function (o, i) { return v['option' + (i + 1)] === o; });
      });
    }

    function formatMoney(cents) {
      if (isNaN(cents)) return '';
      return (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
    }

    function updateUI() {
      var variant = findVariant(selectedOptions);

      if (variant) {
        if (variantInput) variantInput.value = variant.id;

        // Update URL without reload
        try {
          var url = new URL(window.location.href);
          url.searchParams.set('variant', variant.id);
          history.replaceState({}, '', url.toString());
        } catch (e) {}

        // Price
        if (priceEl) {
          priceEl.textContent = formatMoney(variant.price);
          priceEl.classList.toggle('on-sale', !!(variant.compare_at_price && variant.compare_at_price > variant.price));
        }
        if (compareEl) {
          if (variant.compare_at_price && variant.compare_at_price > variant.price) {
            compareEl.textContent = formatMoney(variant.compare_at_price);
            compareEl.style.display = '';
          } else {
            compareEl.textContent = '';
            compareEl.style.display = 'none';
          }
        }

        // ATC state
        if (atcBtn) {
          atcBtn.disabled = !variant.available;
          atcBtn.textContent = variant.available
            ? (atcBtn.getAttribute('data-text-add') || 'Ajouter au panier')
            : (atcBtn.getAttribute('data-text-soldout') || 'Épuisé');
        }

        // Sticky price
        var stickyPrice = document.querySelector('.paris-sticky-atc__price');
        if (stickyPrice) stickyPrice.textContent = formatMoney(variant.price);
      } else {
        if (atcBtn) { atcBtn.disabled = true; atcBtn.textContent = 'Non disponible'; }
      }

      markUnavailable();
    }

    function markUnavailable() {
      optionGroups.forEach(function (group) {
        var idx = parseInt(group.getAttribute('data-option-index'), 10);
        group.querySelectorAll('.paris-option-btn').forEach(function (btn) {
          var test = selectedOptions.slice();
          test[idx] = btn.getAttribute('data-value');
          var exists = variants.some(function (v) {
            return test.every(function (o, i) { return o === null || v['option' + (i + 1)] === o; }) && v.available;
          });
          btn.classList.toggle('is-disabled', !exists);
        });
      });
    }

    optionGroups.forEach(function (group) {
      var idx = parseInt(group.getAttribute('data-option-index'), 10);
      var btns = group.querySelectorAll('.paris-option-btn');
      var selectedSpan = group.querySelector('.paris-selected-value');

      btns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (btn.classList.contains('is-disabled')) return;
          btns.forEach(function (b) { b.classList.remove('is-active'); b.setAttribute('aria-checked', 'false'); });
          btn.classList.add('is-active');
          btn.setAttribute('aria-checked', 'true');
          selectedOptions[idx] = btn.getAttribute('data-value');
          if (selectedSpan) selectedSpan.textContent = btn.getAttribute('data-value');
          updateUI();
        });
      });
    });

    updateUI();
  });

  /* ----------------------------------------------------------
     CAROUSEL (Featured Collection)
  ---------------------------------------------------------- */
  document.querySelectorAll('[data-paris-carousel]').forEach(function (root) {
    var wrapper = root.querySelector('[data-carousel-wrapper]');
    var track = root.querySelector('[data-carousel-track]');
    var btnPrev = root.querySelector('[data-carousel-prev]');
    var btnNext = root.querySelector('[data-carousel-next]');
    var dots = root.querySelectorAll('[data-carousel-dot]');
    if (!track) return;

    var idx = 0;

    function itemWidth() {
      var first = track.children[0];
      if (!first) return 0;
      var gap = parseFloat(getComputedStyle(track).gap) || 0;
      return first.offsetWidth + gap;
    }

    function maxIdx() {
      if (!wrapper) return 0;
      var visible = Math.floor(wrapper.offsetWidth / itemWidth()) || 1;
      return Math.max(0, track.children.length - visible);
    }

    function goTo(n) {
      idx = Math.max(0, Math.min(n, maxIdx()));
      track.style.transform = 'translateX(-' + (idx * itemWidth()) + 'px)';
      dots.forEach(function (d, i) { d.classList.toggle('is-active', i === idx); });
    }

    if (btnPrev) btnPrev.addEventListener('click', function () { goTo(idx - 1); });
    if (btnNext) btnNext.addEventListener('click', function () { goTo(idx + 1); });
    dots.forEach(function (d, i) { d.addEventListener('click', function () { goTo(i); }); });

    // Touch swipe
    var startX = 0;
    track.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; }, { passive: true });
    track.addEventListener('touchend', function (e) {
      var diff = startX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 50) goTo(idx + (diff > 0 ? 1 : -1));
    });

    window.addEventListener('resize', function () { goTo(idx); });
    goTo(0);
  });

  /* ----------------------------------------------------------
     STICKY MOBILE ATC
  ---------------------------------------------------------- */
  var stickyAtc = document.querySelector('.paris-sticky-atc');
  var atcTrigger = document.querySelector('.paris-product-atc');

  if (stickyAtc && atcTrigger && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      stickyAtc.classList.toggle('is-visible', !entries[0].isIntersecting);
    }, { threshold: 0 });
    io.observe(atcTrigger);

    var stickyBtn = stickyAtc.querySelector('.paris-sticky-atc__btn');
    if (stickyBtn) {
      stickyBtn.addEventListener('click', function () {
        var form = document.querySelector('[data-paris-variant-form]');
        if (!form) return;
        var atcBtn = form.querySelector('.paris-btn--atc');
        if (atcBtn && !atcBtn.disabled) atcBtn.click();
      });
    }
  }

  /* ----------------------------------------------------------
     SIZE GUIDE MODAL
  ---------------------------------------------------------- */
  function openSizeGuide() {
    var modal = document.querySelector('.paris-size-guide-modal');
    if (!modal) return;
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    var closeBtn = modal.querySelector('[data-size-guide-close]');
    if (closeBtn) closeBtn.focus();
  }
  function closeSizeGuide() {
    var modal = document.querySelector('.paris-size-guide-modal');
    if (!modal) return;
    modal.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  document.querySelectorAll('[data-size-guide-open]').forEach(function (btn) {
    btn.addEventListener('click', openSizeGuide);
  });
  document.querySelectorAll('[data-size-guide-close]').forEach(function (btn) {
    btn.addEventListener('click', closeSizeGuide);
  });
  document.querySelectorAll('.paris-size-guide-modal__backdrop').forEach(function (el) {
    el.addEventListener('click', closeSizeGuide);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeSizeGuide();
  });

  /* ----------------------------------------------------------
     NEWSLETTER FORM
  ---------------------------------------------------------- */
  document.querySelectorAll('.paris-newsletter__form').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      var input = form.querySelector('.paris-newsletter__input');
      var success = form.closest('.paris-newsletter__inner')
        ? form.closest('.paris-newsletter__inner').querySelector('.paris-newsletter__success')
        : null;
      if (!input || !input.value.trim()) { e.preventDefault(); return; }
      // Shopify handles the actual submission; we just show feedback
      if (success) {
        form.addEventListener('submit', function handler() {
          setTimeout(function () {
            form.style.display = 'none';
            if (success) success.style.display = 'block';
          }, 400);
          form.removeEventListener('submit', handler);
        });
      }
    });
  });

})();
