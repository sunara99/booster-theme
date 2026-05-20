/**
 * Cart Upsell Component
 * Handles fetching and displaying upsell products in the cart drawer
 */
import { CartAddEvent, ThemeEvents } from '@theme/events';
import { sectionRenderer } from '@theme/section-renderer';

class CartUpsellComponent extends HTMLElement {
  get #cartJsUrl() {
    return (typeof Theme !== 'undefined' && Theme?.routes?.cart_url)
      ? Theme.routes.cart_url.replace(/\/?$/, '') + '.js'
      : '/cart.js';
  }

  constructor() {
    super();
    // Use event delegation - bind once, works for all buttons
    this.handleButtonClick = this.handleButtonClick.bind(this);
    this.swiperInstance = null;
    this._isLoading = false;
    this._isInitialized = false;
    this._initQueued = false;
    this._dynamicReloadQueued = false;
    this._wasDisconnected = false;
  }

  connectedCallback() {
    // Reset initialization flag when reconnected (e.g., after section morphing)
    // This ensures the component can properly re-initialize after cart updates
    if (this._wasDisconnected) {
      this._isInitialized = false;
      this._isLoading = false;
      this._wasDisconnected = false;
    }
    
    this.queueInit();
    
    // Listen for cart updates to re-setup buttons if needed
    document.addEventListener(ThemeEvents.cartUpdate, this.handleCartUpdate);

    this.observeDynamicUpsellMorphs();
    
    // After a delay, check if we're stuck in loading state and force a reload
    // This is a safety net for cases where init() didn't properly trigger loading
    setTimeout(() => {
      this.checkAndFixLoadingState();
    }, 1000);
  }

  queueInit() {
    if (this._initQueued) return;

    this._initQueued = true;
    requestAnimationFrame(() => {
      this._initQueued = false;
      if (this.isConnected) {
        this.init();
      }
    });
  }
  
  checkAndFixLoadingState() {
    if (!this.isConnected || this._isLoading) {
      return;
    }
    
    const hasProducts = this.querySelectorAll('.cart-upsell-product-card').length > 0;
    const hasLoadingState = this.querySelector('[ref="loadingState"]') !== null;
    const intent = this.dataset.intent;
    const manualProducts = this.dataset.manualProducts;
    
    // If we have loading state but no products, we need to load them
    if (hasLoadingState && !hasProducts && !manualProducts && intent) {
      // Get product ID - try dataset first, then cart API
      const getProductId = async () => {
        let productId = this.dataset.productId;
        
        if (!productId) {
          // Try to get from cart API
          try {
            const response = await fetch(this.#cartJsUrl);
            const cartData = await response.json();
            if (cartData.items && cartData.items.length > 0) {
              productId = cartData.items[0].product_id?.toString();
              // Update dataset for future use
              if (productId) {
                this.dataset.productId = productId;
              }
            }
          } catch (error) {
            console.warn('Could not fetch cart for product ID:', error);
          }
        }
        
        return productId;
      };
      
      getProductId().then((productId) => {
        if (this.isConnected && productId && !this._isLoading) {
          const maxProducts = parseInt(this.dataset.maxProducts || '4', 10);
          this.loadRecommendations(productId, intent, maxProducts);
        }
      });
    }
  }

  observeDynamicUpsellMorphs() {
    if (this.dataset.manualProducts || this._dynamicMorphObserver) return;

    this._dynamicMorphObserver = new MutationObserver(() => {
      this.queueDynamicUpsellReload();
    });

    this._dynamicMorphObserver.observe(this, {
      childList: true,
      subtree: true,
    });
  }

  queueDynamicUpsellReload() {
    if (this.dataset.manualProducts || this._dynamicReloadQueued || this._isLoading) return;

    this._dynamicReloadQueued = true;
    requestAnimationFrame(() => {
      this._dynamicReloadQueued = false;
      if (!this.isConnected || this.dataset.manualProducts || this._isLoading) return;

      const hasProducts = this.querySelectorAll('.cart-upsell-product-card').length > 0;
      const hasContainer =
        this.querySelector('[ref="productsContainer"]') ||
        this.querySelector('.cart-upsell__products') ||
        this.querySelector('.swiper-wrapper');
      const productId = this.dataset.productId;
      const intent = this.dataset.intent;

      if (!hasProducts && hasContainer && productId && intent) {
        const maxProducts = parseInt(this.dataset.maxProducts || '4', 10);
        this.loadRecommendations(productId, intent, maxProducts).finally(() => {
          this._isInitialized = true;
        });
      }
    });
  }

  disconnectedCallback() {
    document.removeEventListener(ThemeEvents.cartUpdate, this.handleCartUpdate);
    // Clean up event listeners
    if (this._productsContainer) {
      this._productsContainer.removeEventListener('click', this.handleButtonClick);
      this._productsContainer.removeEventListener('change', this.handleVariantChange);
      this._productsContainer = null;
    }
    // Destroy Swiper instance
    if (this.swiperInstance) {
      this.swiperInstance.destroy(true, true);
      this.swiperInstance = null;
    }
    if (this._dynamicMorphObserver) {
      this._dynamicMorphObserver.disconnect();
      this._dynamicMorphObserver = null;
    }
    // Reset initialization flags so component can re-initialize when reconnected
    this._isInitialized = false;
    this._isLoading = false;
    this._initQueued = false;
    this._dynamicReloadQueued = false;
    // Mark that component was disconnected so we know to reset on reconnect
    this._wasDisconnected = true;
  }

  handleCartUpdate = async (event) => {
    // If this component triggered the update, restore button states based on cart
    if (event.target === this || event.detail?.sourceId === this.id) {
      // After we add a product, verify button states match what's actually in cart
      // Wait a bit for cart to fully update
      setTimeout(() => {
        if (this.isConnected) {
          this.syncButtonStatesWithCart();
        }
      }, 300);
      return;
    }
    // Don't re-setup if component is being destroyed
    if (!this.isConnected) {
      return;
    }

    // When free-shipping-progress removes a gift, morph may leave cart-upsell in loading state.
    // Force re-init so recommendations load correctly.
    if (event.detail?.data?.source === 'free-shipping-progress') {
      this._isInitialized = false;
      this._isLoading = false;
      setTimeout(() => {
        if (this.isConnected && !this._isInitialized) {
          this.init();
        }
      }, 100);
    }
    
    // Get current cart item count only when the event includes it.
    const itemCount = event.detail?.data?.itemCount ?? event.detail?.resource?.item_count;
    
    // If cart is confirmed empty, hide the component.
    if (itemCount === 0) {
      this.style.display = 'none';
      this.setAttribute('hidden', '');
      this.classList.add('cart-upsell--hidden');
      this.updateCartItemsWrapperVisibility(true);
      return;
    }
    
    // Re-setup buttons after cart updates in case DOM changed
    // Use a longer delay to ensure DOM is stable
    setTimeout(() => {
      if (this.isConnected) {
        this.setupAddToCartButtons();
        // Sync button states with what's actually in cart
        this.syncButtonStatesWithCart();
        this.queueDynamicUpsellReload();
      }
    }, 300);
    
    // Check and fix loading state after cart update (important for removal case)
    // This ensures products are loaded even if the component got stuck
    setTimeout(() => {
      this.checkAndFixLoadingState();
    }, 500);
    
    // Update cart items wrapper visibility only when cart count is known.
    if (typeof itemCount === 'number') {
      this.updateCartItemsWrapperVisibility(itemCount === 0);
    }
  }
  
  async updateProductIdIfNeeded() {
    // For complementary/related products, update the product ID based on the first cart item
    const intent = this.dataset.intent;
    if (intent === 'complementary' || intent === 'related') {
      // Try to get the first cart item's product ID from DOM first (synchronous)
      const firstCartItem = document.querySelector('cart-items-component [data-product-id]');
      if (firstCartItem) {
        const newProductId = firstCartItem.dataset.productId;
        if (newProductId && newProductId !== this.dataset.productId) {
          this.dataset.productId = newProductId;
          // Reset initialization flag so component can reload with new product ID
          this._isInitialized = false;
          return newProductId;
        }
        return this.dataset.productId;
      } else {
        // If DOM doesn't have cart items yet, try fetching from cart API
        try {
          const response = await fetch(this.#cartJsUrl);
          const cartData = await response.json();
          if (cartData.items && cartData.items.length > 0) {
            const firstItem = cartData.items[0];
            const newProductId = firstItem.product_id?.toString();
            if (newProductId && newProductId !== this.dataset.productId) {
              this.dataset.productId = newProductId;
              // Reset initialization flag so component can reload with new product ID
              this._isInitialized = false;
              return newProductId;
            }
            return this.dataset.productId;
          }
        } catch (error) {
          // Silently fail - we'll try again later
          console.warn('Could not fetch cart data for product ID update:', error);
        }
      }
    }
    return this.dataset.productId;
  }

  async syncButtonStatesWithCart() {
    if (!this.isConnected) return;

    // Dynamic recommendation upsells should stay stable after render. The
    // recommendation API already filters from the current cart item context,
    // and this sync path can hide freshly rendered cards during cart morphs.
    if (!this.dataset.manualProducts) {
      this.style.display = '';
      this.removeAttribute('hidden');
      this.classList.remove('cart-upsell--hidden');
      return;
    }

    let cartProductIds = new Set();

    try {
      const cartResponse = await fetch(this.#cartJsUrl);
      if (!this.isConnected) return;
      if (cartResponse.ok) {
        const cartData = await cartResponse.json();
        if (!this.isConnected) return;
        if (cartData.items && Array.isArray(cartData.items)) {
          cartProductIds = new Set(
            cartData.items.map(item => item.product_id?.toString()).filter(Boolean)
          );
        }
      }
    } catch (error) {
      if (this.isConnected) console.warn('Could not fetch cart data:', error);
      return;
    }

    if (!this.isConnected) return;

    // Check each button and sync its state with cart
    const allButtons = this.querySelectorAll('.cart-upsell-product-card__button');
    let hasAvailableProducts = false;
    
    // Also check for manual products data attribute to see what products should be shown
    const manualProducts = this.dataset.manualProducts;
    const manualProductIds = manualProducts ? manualProducts.split(',').filter(Boolean) : [];
    
    // For slider mode, also check slides
    const swiperWrapper = this.querySelector('.swiper-wrapper');
    const slides = swiperWrapper ? swiperWrapper.querySelectorAll('.swiper-slide') : [];
    
    allButtons.forEach(button => {
      const productId = button.dataset.productId?.toString();
      if (!productId) return;
      
      const isInCart = cartProductIds.has(productId);
      
      if (isInCart) {
        // Product is in cart - mark as added
        button.disabled = true;
        button.classList.add('added');
        button.dataset.added = 'true';
        if (!button.innerHTML.includes('Added')) {
          button.innerHTML = 'Added!';
        }
        const productCard = button.closest('.cart-upsell-product-card');
        if (productCard) {
          productCard.classList.add('product-added');
        }
        
        // Hide the slide in slider mode
        if (this._sliderEnabled) {
          const slide = productCard?.closest('.swiper-slide');
          if (slide) {
            // Hide the slide completely
            slide.style.display = 'none';
            slide.style.visibility = 'hidden';
            // Mark that slides have changed
            this._slidesChanged = true;
            // Update Swiper after hiding slide
            if (this.swiperInstance) {
              this.swiperInstance.update();
            }
          }
        }
      } else {
        // Product is NOT in cart - ensure button is enabled and reset state
        hasAvailableProducts = true; // Mark that we have at least one available product
        button.disabled = false;
        button.classList.remove('processing', 'added');
        delete button.dataset.processing;
        delete button.dataset.added;
        
        // Restore original button HTML if it was modified
        if (button.innerHTML === 'Added!' || button.innerHTML.includes('Added')) {
          button.innerHTML = `
            <span class="svg-wrapper">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" width="16" height="16">
                <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="var(--icon-stroke-width, 1.5)" d="M16.608 9.421V6.906H3.392v8.016c0 .567.224 1.112.624 1.513.4.402.941.627 1.506.627H8.63M8.818 3h2.333c.618 0 1.212.247 1.649.686a2.35 2.35 0 0 1 .683 1.658v1.562H6.486V5.344c0-.622.246-1.218.683-1.658A2.33 2.33 0 0 1 8.82 3"/>
                <path stroke="currentColor" stroke-linecap="round" stroke-width="var(--icon-stroke-width, 1.5)" d="M14.608 12.563v5m2.5-2.5h-5"/>
              </svg>
            </span>
            <span class="is-visually-hidden-mobile">Add</span>
          `;
        }
        
        // Remove product-added class
        const productCard = button.closest('.cart-upsell-product-card');
        if (productCard) {
          productCard.classList.remove('product-added');
        }
        
        // Show the slide in slider mode
        if (this._sliderEnabled) {
          const slide = productCard?.closest('.swiper-slide');
          if (slide) {
            // Remove inline display style to show the slide
            slide.style.display = '';
            slide.style.visibility = '';
            slide.style.opacity = '';
            
            // Mark that slides have changed and need reconnection
            this._slidesChanged = true;
            
            // Update Swiper after showing slide
            if (this.swiperInstance) {
              this.swiperInstance.update();
            }
          }
        }
      }
    });

    // For slider mode, if slides were shown/hidden, reconnect arrows and update Swiper
    if (this._slidesChanged && this._sliderEnabled) {
      // Reset the flag
      this._slidesChanged = false;
      // Reconnect arrows and update Swiper after slides are restored
      // Use longer delay to ensure Swiper is ready
      setTimeout(() => {
        this.initSwiper();
      }, 250);
    }

    // For slider mode, check if any visible slides remain
    if (this._sliderEnabled) {
      const swiperElement = this.querySelector('.cart-upsell-swiper');
      if (swiperElement) {
        const slides = swiperElement.querySelectorAll('.swiper-slide');
        const visibleSlides = Array.from(slides).filter(slide => {
          // A slide is visible if it's not explicitly hidden via style.display
          return slide.style.display !== 'none';
        });
        if (visibleSlides.length === 0) {
          hasAvailableProducts = false;
        } else {
          // If we have visible slides but no available products from buttons, check slides
          if (!hasAvailableProducts) {
            // Check if any visible slide has a product not in cart
            const hasVisibleProduct = visibleSlides.some(slide => {
              const button = slide.querySelector('.cart-upsell-product-card__button');
              if (!button) return false;
              const productId = button.dataset.productId?.toString();
              return productId && !cartProductIds.has(productId);
            });
            if (hasVisibleProduct) {
              hasAvailableProducts = true;
            }
          }
        }
      }
    }

    // Show/hide heading and section based on whether there are available products
    const heading = this.querySelector('.cart-upsell__heading');
    const header = this.querySelector('.cart-upsell__header');
    if (heading) {
      if (hasAvailableProducts) {
        heading.style.display = '';
      } else {
        heading.style.display = 'none';
      }
    }
    if (header) {
      if (hasAvailableProducts) {
        header.style.display = '';
      } else {
        header.style.display = 'none';
      }
    }

    // Check if all manual products are in cart (even if no buttons rendered)
    let allManualProductsInCart = false;
    if (manualProductIds.length > 0) {
      allManualProductsInCart = manualProductIds.every(productId => 
        cartProductIds.has(productId.toString())
      );
    }
    
    // Count products NOT in cart from buttons
    let productsNotInCart = 0;
    allButtons.forEach(button => {
      const productId = button.dataset.productId?.toString();
      if (productId && !cartProductIds.has(productId)) {
        productsNotInCart++;
      }
    });
    
    // Determine if we should hide the component
    // Hide if all products that should be shown are in cart
    let shouldHide = false;
    
    if (manualProductIds.length > 0) {
      // For manual products: hide if all manual products are in cart
      shouldHide = allManualProductsInCart;
    }
    
    if (shouldHide) {
      // All upsell products are in cart - hide the entire component
      this.style.display = 'none';
      this.setAttribute('hidden', '');
      this.classList.add('cart-upsell--hidden');
    } else {
      // Show the component
      this.style.display = '';
      this.removeAttribute('hidden');
      this.classList.remove('cart-upsell--hidden');
      
      // Reconnect slider arrows if slider is enabled and section is now visible
      if (this._sliderEnabled) {
        // Small delay to ensure DOM is updated and Swiper is ready
        setTimeout(() => {
          // Reinitialize Swiper
          this.initSwiper();
        }, 200);
      }
      
      // Also reconnect if slides were changed during this sync
      if (this._slidesChanged && this._sliderEnabled) {
        setTimeout(() => {
          this.initSwiper();
        }, 300);
      }
    }
    
    // Hide cart-items__wrapper when cart is empty (no products left)
    this.updateCartItemsWrapperVisibility(cartProductIds.size === 0);
  }

  updateCartItemsWrapperVisibility(isEmpty) {
    const cartItemsWrapper = document.querySelector('.cart-items__wrapper');
    if (cartItemsWrapper) {
      if (isEmpty) {
        cartItemsWrapper.style.display = 'none';
      } else {
        cartItemsWrapper.style.display = '';
      }
    }
  }

  init() {
    const hasExpectedMarkup =
      this.dataset.manualProducts ||
      this.querySelector('[ref="productsContainer"]') ||
      this.querySelector('.cart-upsell__products') ||
      this.querySelector('.cart-upsell-swiper') ||
      this.querySelector('.swiper-wrapper') ||
      this.querySelector('.cart-upsell-product-card');

    if (!hasExpectedMarkup) {
      this.queueInit();
      return;
    }

    // Check if cart is empty first
    const cartItems = document.querySelectorAll('cart-items-component [data-product-id]');
    if (cartItems.length === 0) {
      // Try to check via cart API
      fetch(this.#cartJsUrl)
        .then((response) => (this.isConnected ? response.json() : Promise.reject(new Error('disconnected'))))
        .then((cartData) => {
          if (!this.isConnected) return;
          if (!cartData.items || cartData.items.length === 0) {
            this.style.display = 'none';
            this.setAttribute('hidden', '');
            this.classList.add('cart-upsell--hidden');
            return;
          }
          this._doInit();
        })
        .catch(() => {
          if (this.isConnected) this._doInit();
        });
    } else {
      this._doInit();
    }
  }
  
  _doInit() {
    // Prevent multiple simultaneous initializations
    if (this._isInitialized && this._isLoading) {
      return;
    }
    
    const productId = this.dataset.productId;
    const intent = this.dataset.intent;
    const manualProducts = this.dataset.manualProducts;
    const maxProducts = parseInt(this.dataset.maxProducts || '4', 10);
    const sliderEnabled = this.dataset.sliderEnabled === 'true';

    // Set slider mode flag
    this._sliderEnabled = sliderEnabled;

    // Set up event delegation for add to cart buttons
    this.setupAddToCartButtons();

    // Connect slider arrows if slider is enabled
    if (sliderEnabled) {
      this.connectSliderArrows();
    }

    // Handle manual products
    if (manualProducts) {
      this.loadManualProducts(manualProducts.split(','), maxProducts);
      // Sync button states on initial load for manual products
      setTimeout(() => {
        this.connectSliderArrows();
        this.syncButtonStatesWithCart();
        // Double-check to ensure component is hidden if all products in cart
        setTimeout(() => {
          this.syncButtonStatesWithCart();
        }, 200);
      }, 300);
      this._isInitialized = true;
      return;
    }

    // Handle complementary or related products
    if (productId && intent) {
      // Update product ID based on current cart state (important after cart changes)
      // This is async, so we need to wait for it
      this.updateProductIdIfNeeded().then((currentProductId) => {
        if (!this.isConnected) {
          this._isInitialized = true;
          return;
        }
        
        if (!currentProductId) {
          // No product ID means cart might be empty or component shouldn't show
          this.style.display = 'none';
          this.setAttribute('hidden', '');
          this._isInitialized = true;
          return;
        }
        
        // Check if products are already loaded
        const hasProducts = this.querySelectorAll('.cart-upsell-product-card').length > 0;
        const hasLoadingState = this.querySelector('[ref="loadingState"]') !== null;
        
        // If product ID changed, we need to reload
        const productIdChanged = currentProductId !== productId;
        
        // Only load if we have loading state and no products, or if product ID changed
        if ((hasLoadingState && !hasProducts) || (productIdChanged && !hasProducts)) {
          this.loadRecommendations(currentProductId, intent, maxProducts).finally(() => {
            this._isInitialized = true;
          });
        } else if (!hasProducts && !hasLoadingState) {
          this.loadRecommendations(currentProductId, intent, maxProducts).finally(() => {
            this._isInitialized = true;
          });
        } else {
          // Products are already loaded or component is in a good state
          this._isInitialized = true;
        }
      }).catch(() => {
        // If update fails, try to load with original product ID
        if (this.isConnected && productId) {
          const hasProducts = this.querySelectorAll('.cart-upsell-product-card').length > 0;
          const hasLoadingState = this.querySelector('[ref="loadingState"]') !== null;
          if ((hasLoadingState && !hasProducts) || (!hasProducts && !hasLoadingState)) {
            this.loadRecommendations(productId, intent, maxProducts).finally(() => {
              this._isInitialized = true;
            });
          } else {
            this._isInitialized = true;
          }
        } else {
          this._isInitialized = true;
        }
      });
    } else {
      // Not complementary/related products, mark as initialized
      this._isInitialized = true;
    }
    
    if (manualProducts) {
      setTimeout(() => {
        this.syncButtonStatesWithCart();
      }, 500);
    }
  }

  initSwiper() {
    // Wait for Swiper to be available
    if (typeof Swiper === 'undefined') {
      setTimeout(() => {
        if (this.isConnected) {
          this.initSwiper();
        }
      }, 100);
      return;
    }

    const swiperElement = this.querySelector('.cart-upsell-swiper');
    if (!swiperElement) {
      return;
    }

    // Destroy existing instance if any
    if (this.swiperInstance) {
      this.swiperInstance.destroy(true, true);
      this.swiperInstance = null;
    }

    // Find navigation buttons
    const prevButton = this.querySelector('[data-slider-nav="previous"]');
    const nextButton = this.querySelector('[data-slider-nav="next"]');

    // Swiper configuration
    const swiperConfig = {
      slidesPerView: 'auto',
      spaceBetween: 16,
      speed: 300,
      loop: false,
      freeMode: false,
      navigation: {
        nextEl: nextButton,
        prevEl: prevButton,
      },
      on: {
        init: () => {
          // Update button states after initialization
          this.updateSwiperButtonStates();
        },
        slideChange: () => {
          this.updateSwiperButtonStates();
        },
        update: () => {
          // Update button states when slides are added/removed
          this.updateSwiperButtonStates();
        }
      }
    };

    // Initialize Swiper
    this.swiperInstance = new Swiper(swiperElement, swiperConfig);
    
    // Update button states
    this.updateSwiperButtonStates();
  }

  updateSwiperButtonStates() {
    if (!this.swiperInstance) return;

    const prevButton = this.querySelector('[data-slider-nav="previous"]');
    const nextButton = this.querySelector('[data-slider-nav="next"]');

    if (prevButton) {
      prevButton.disabled = this.swiperInstance.isBeginning;
    }
    if (nextButton) {
      nextButton.disabled = this.swiperInstance.isEnd;
    }
  }

  connectSliderArrows() {
    // For Swiper, we use initSwiper instead
    this.initSwiper();
  }

  async loadRecommendations(productId, intent, maxProducts) {
    // Prevent multiple simultaneous loads
    if (this._isLoading) {
      return;
    }
    
    this._isLoading = true;
    const hadProductsBeforeLoad = this.querySelectorAll('.cart-upsell-product-card').length > 0;
    const loadingState = this.querySelector('[ref="loadingState"]');
    const productsContainer = this.querySelector('[ref="productsContainer"]') || 
                              this.querySelector('.cart-upsell__products') ||
                              this.querySelector('.swiper-wrapper') ||
                              this;

    try {
      // Use Shopify's recommendations API
      const url = `/recommendations/products.json?product_id=${productId}&limit=${maxProducts}&intent=${intent}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!response.ok) {
        throw new Error(`Failed to fetch recommendations: ${response.status}`);
      }

      const data = await response.json();
      
      // Only proceed if component is still connected
      if (!this.isConnected) {
        this._isLoading = false;
        return;
      }
      
      if (loadingState) {
        loadingState.remove();
      }

      if (data.products && data.products.length > 0) {
        await this.renderProducts(data.products, productsContainer);
      } else {
        if (hadProductsBeforeLoad) return;
        if (productsContainer) {
          productsContainer.innerHTML = '';
        }
        this.style.display = 'none';
        this.setAttribute('hidden', '');
      }
    } catch (error) {
      console.error('Error loading cart upsell recommendations:', error);
      // Only update UI if component is still connected
      if (this.isConnected) {
        if (hadProductsBeforeLoad) return;
        if (loadingState) {
          loadingState.remove();
        }
        if (productsContainer) {
          productsContainer.innerHTML = '';
        }
        this.style.display = 'none';
        this.setAttribute('hidden', '');
      }
    } finally {
      this._isLoading = false;
    }
  }

  loadManualProducts(productHandles, maxProducts) {
    // Manual products are already rendered in the Liquid template
    // Event listeners are already set up via event delegation in init()
    const products = this.querySelectorAll('.cart-upsell-product-card');
    
    if (products.length === 0) {
      this.style.display = 'none';
      this.setAttribute('hidden', '');
    }
  }

  async renderProducts(products, container) {
    if (!container) return;

    // Filter out products already in cart
    // Try multiple methods to get cart product IDs since cart might be updating
    let cartProductIds = [];
    
    // Method 1: From cart items component
    const cartItems = document.querySelectorAll('cart-items-component [data-product-id]');
    if (cartItems.length > 0) {
      cartProductIds = Array.from(cartItems).map(el => el.dataset.productId);
    } else {
      // Method 2: Fetch from cart API if DOM elements aren't available yet
      try {
        const cartResponse = await fetch(this.#cartJsUrl);
        if (cartResponse.ok) {
          const cartData = await cartResponse.json();
          if (cartData.items && Array.isArray(cartData.items)) {
            cartProductIds = cartData.items.map(item => item.product_id?.toString()).filter(Boolean);
          }
        }
      } catch (error) {
        console.warn('Could not fetch cart data for filtering:', error);
      }
    }

    const filteredProducts = products.filter(product => 
      !cartProductIds.includes(product.id.toString())
    ).slice(0, parseInt(this.dataset.maxProducts || '4', 10));

    if (filteredProducts.length === 0) {
      if (this.querySelectorAll('.cart-upsell-product-card').length > 0) return;
      container.innerHTML = '';
      this.style.display = 'none';
      this.setAttribute('hidden', '');
      return;
    }

    // Render products directly from JSON data
    // No need for section renderer - we'll render inline
    this.renderProductsManually(filteredProducts, container);
  }

  renderProductsManually(products, container) {
    if (this._sliderEnabled) {
      this.renderProductsAsSlider(products, container);
      return;
    }

    container.innerHTML = products.map((product, index) => {
      const variant = product.variants?.[0] || product.selected_or_first_available_variant;
      const image = product.featured_image || product.images?.[0] || product.featured_media?.preview_image;
      const price = variant?.price || 0;
      const compareAtPrice = variant?.compare_at_price > variant?.price ? variant.compare_at_price : null;
      const available = variant?.available !== false;
      const hasVariants = product.variants && product.variants.length > 1;
      const hasOptions = product.options && product.options.length > 0;

      const productTitle = this.escapeHtml(product.title);
      const productUrl = product.url || `/products/${product.handle}`;
      const imageUrl = image ? (typeof image === 'string' ? image : image.src || image.url) : null;
      const imageAlt = image?.alt || productTitle;
      const productIdSuffix = `${product.id}-${index}`;
      const imageRatio = this.getImageRatio(product);

      // Build variant selector HTML if we have full variant data
      let variantSelectorHtml = '';
      if (hasVariants && hasOptions && product.variants && product.options_with_values) {
        variantSelectorHtml = this.renderVariantSelectorHTML(product, productIdSuffix);
      }

      return `
        <div class="cart-upsell__product">
          <div class="cart-upsell-product-card">
            ${imageUrl ? `
              <a href="${productUrl}" class="cart-upsell-product-card__image">
                <div class="cart-upsell-product-card__image-wrapper" style="--ratio: ${imageRatio};">
                  <img src="${imageUrl}" alt="${imageAlt}" class="cart-upsell-product-card__image-img" loading="lazy">
                </div>
              </a>
            ` : ''}
            <div class="cart-upsell-product-card__content">
            <div>
              <a href="${productUrl}" class="cart-upsell-product-card__title cart-header-typography">
                ${productTitle}
              </a>
              ${compareAtPrice ? `
                <div class="cart-upsell-product-card__price" data-price-container>
                  <span class="cart-upsell-product-card__price-current cart-secondary-typography" data-price-current>${this.formatPriceSplit(price)}</span>
                  <s class="cart-upsell-product-card__price-compare cart-secondary-typography" data-price-compare><span class="cart-upsell-product-card__compare-inner">${this.formatPriceSplit(compareAtPrice)}</span></s>
                </div>
              ` : `
                <div class="cart-upsell-product-card__price cart-upsell-product-card__price--no-compare" data-price-container>
                  <span class="cart-upsell-product-card__price-current cart-secondary-typography" data-price-current>${this.formatPriceSplit(price)}</span>
                </div>
              `}
              </div>
              ${available && variant ? `
              ${hasVariants && hasOptions && product.variants && product.variants.length > 1 ? `
                <button type="button" class="button cart-upsell-product-card__button" 
                  data-product-id="${product.id}"
                  data-product-handle="${product.handle || ''}"
                  data-product-title="${productTitle}"
                  data-has-variants="true">
                  <span class="svg-wrapper">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" width="16" height="16">
                      <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="var(--icon-stroke-width, 1.5)" d="M16.608 9.421V6.906H3.392v8.016c0 .567.224 1.112.624 1.513.4.402.941.627 1.506.627H8.63M8.818 3h2.333c.618 0 1.212.247 1.649.686a2.35 2.35 0 0 1 .683 1.658v1.562H6.486V5.344c0-.622.246-1.218.683-1.658A2.33 2.33 0 0 1 8.82 3"/>
                      <path stroke="currentColor" stroke-linecap="round" stroke-width="var(--icon-stroke-width, 1.5)" d="M14.608 12.563v5m2.5-2.5h-5"/>
                    </svg>
                  </span>
                  <span class="is-visually-hidden-mobile">Add</span>
                </button>
              ` : `
                <button type="button" class="button cart-upsell-product-card__button" 
                  data-variant-id="${variant.id}" 
                  data-product-id="${product.id}"
                  data-product-title="${productTitle}"
                  data-initial-variant-id="${variant.id}">
                  <span class="svg-wrapper">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" width="16" height="16">
                      <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="var(--icon-stroke-width, 1.5)" d="M16.608 9.421V6.906H3.392v8.016c0 .567.224 1.112.624 1.513.4.402.941.627 1.506.627H8.63M8.818 3h2.333c.618 0 1.212.247 1.649.686a2.35 2.35 0 0 1 .683 1.658v1.562H6.486V5.344c0-.622.246-1.218.683-1.658A2.33 2.33 0 0 1 8.82 3"/>
                      <path stroke="currentColor" stroke-linecap="round" stroke-width="var(--icon-stroke-width, 1.5)" d="M14.608 12.563v5m2.5-2.5h-5"/>
                    </svg>
                  </span>
                  <span class="is-visually-hidden-mobile">Add</span>
                </button>
              `}
            ` : `
              <span class="cart-upsell-product-card__unavailable">Sold out</span>
            `}
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Initialize variant selectors for dynamically rendered products
    setTimeout(() => {
      this.initializeVariantSelectors();
      this.syncButtonStatesWithCart();
    }, 100);
  }

  renderVariantSelectorHTML(product, productIdSuffix) {
    if (!product.options_with_values || !product.variants) {
      return '';
    }

    const optionsHtml = product.options_with_values.map((option, optIndex) => {
      if (!option.values || option.values.length <= 1) {
        return '';
      }

      const optionsHtml = option.values.map(value => {
        // Find a variant with this option value
        const matchingVariant = product.variants.find(v => {
          if (optIndex === 0) return v.option1 === value;
          if (optIndex === 1) return v.option2 === value;
          if (optIndex === 2) return v.option3 === value;
          return false;
        });

        const selected = matchingVariant && matchingVariant.id === (product.selected_or_first_available_variant?.id || product.variants[0]?.id);
        const unavailable = matchingVariant && !matchingVariant.available;

        return `
          <option
            value="${this.escapeHtml(value)}"
            ${matchingVariant ? `data-variant-id="${matchingVariant.id}"` : ''}
            ${selected ? 'selected' : ''}
            ${unavailable ? 'disabled' : ''}
          >
            ${this.escapeHtml(value)}${unavailable ? ' - Unavailable' : ''}
          </option>
        `;
      }).join('');

      return `
        <div class="cart-upsell-variant-selector__option">
          <label class="cart-upsell-variant-selector__label" for="cart-upsell-option-${product.id}-${productIdSuffix}-${option.position}">
            ${this.escapeHtml(option.name)}:
          </label>
          <select
            class="cart-upsell-variant-selector__select"
            id="cart-upsell-option-${product.id}-${productIdSuffix}-${option.position}"
            data-option-position="${option.position}"
            data-option-name="${this.escapeHtml(option.name)}"
          >
            ${optionsHtml}
          </select>
        </div>
      `;
    }).join('');

    const variantsJson = JSON.stringify({
      variants: product.variants.map(v => ({
        id: v.id,
        price: v.price,
        compare_at_price: v.compare_at_price || 0,
        available: v.available !== false,
        option1: v.option1 || '',
        option2: v.option2 || '',
        option3: v.option3 || ''
      }))
    });

    return `
      <div class="cart-upsell-variant-selector" data-product-id="${product.id}" data-product-id-suffix="${productIdSuffix}">
        ${optionsHtml}
        <script type="application/json" class="cart-upsell-variant-data">
          ${variantsJson}
        </script>
      </div>
    `;
  }

  escapeHtml(text) {
    if (text == null) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  getImageRatio(product = null) {
    const ratioSetting = this.dataset.imageRatio || 'square';
    let ratio = 1; // default to square
    
    switch (ratioSetting) {
      case 'portrait':
        ratio = 0.8;
        break;
      case 'square':
        ratio = 1;
        break;
      case 'landscape':
        ratio = 1.25;
        break;
      case 'adapt':
        // If product has aspect_ratio, use it; otherwise default to square
        if (product && product.featured_media && product.featured_media.aspect_ratio) {
          ratio = product.featured_media.aspect_ratio;
        } else if (product && product.featured_image && product.featured_image.aspect_ratio) {
          ratio = product.featured_image.aspect_ratio;
        } else {
          ratio = 1;
        }
        break;
      default:
        ratio = 1;
    }
    
    return ratio;
  }

  renderProductsAsSlider(products, container) {
    // Check if swiper container already exists (for related/complementary products)
    let existingSwiper = this.querySelector('.cart-upsell-swiper');
    let swiperWrapper = null;
    
    // If container is the swiper-wrapper itself, use it directly
    if (container && container.classList.contains('swiper-wrapper')) {
      swiperWrapper = container;
    } else if (existingSwiper) {
      // Find the wrapper within the existing swiper
      swiperWrapper = existingSwiper.querySelector('.swiper-wrapper');
    }
    
    if (swiperWrapper) {
      // Clear existing content (like loading state) and populate with slides
      swiperWrapper.innerHTML = '';
    } else {
      // Create new Swiper structure for slider mode
      const swiper = document.createElement('div');
      swiper.className = 'swiper cart-upsell-swiper';
      swiper.setAttribute('data-cart-upsell-swiper', '');

      swiperWrapper = document.createElement('div');
      swiperWrapper.className = 'swiper-wrapper';

      swiper.appendChild(swiperWrapper);

      // Replace container content with Swiper
      if (container && !container.classList.contains('swiper-wrapper')) {
        container.innerHTML = '';
        container.appendChild(swiper);
      } else {
        // If container doesn't exist or is the wrapper, find the loading state and replace it
        const loadingState = this.querySelector('[ref="loadingState"]');
        const parentContainer = loadingState?.parentElement;
        if (parentContainer) {
          parentContainer.innerHTML = '';
          parentContainer.appendChild(swiper);
        } else {
          // Fallback: append to component
          this.appendChild(swiper);
        }
      }
    }

    // Create slides for each product
    products.forEach((product, index) => {
      const variant = product.variants?.[0] || product.selected_or_first_available_variant;
      const image = product.featured_image || product.images?.[0] || product.featured_media?.preview_image;
      const price = variant?.price || 0;
      const compareAtPrice = variant?.compare_at_price > variant?.price ? variant.compare_at_price : null;
      const available = variant?.available !== false;
      const hasVariants = product.variants && product.variants.length > 1;
      const hasOptions = product.options && product.options.length > 0;

      const productTitle = this.escapeHtml(product.title);
      const productUrl = product.url || `/products/${product.handle}`;
      const imageUrl = image ? (typeof image === 'string' ? image : image.src || image.url) : null;
      const imageAlt = image?.alt || productTitle;
      const productIdSuffix = `${product.id}-${index}`;
      const imageRatio = this.getImageRatio(product);

      const slide = document.createElement('div');
      slide.className = 'swiper-slide cart-upsell__slide';

      const productDiv = document.createElement('div');
      productDiv.className = 'cart-upsell__product';
      productDiv.innerHTML = `
        <div class="cart-upsell-product-card">
          ${imageUrl ? `
            <a href="${productUrl}" class="cart-upsell-product-card__image">
              <div class="cart-upsell-product-card__image-wrapper" style="--ratio: ${imageRatio};">
                <img src="${imageUrl}" alt="${imageAlt}" class="cart-upsell-product-card__image-img" loading="lazy">
              </div>
            </a>
          ` : ''}
          <div class="cart-upsell-product-card__content">
          <div>
            <a href="${productUrl}" class="cart-upsell-product-card__title cart-header-typography">
              ${productTitle}
            </a>
            ${compareAtPrice ? `
              <div class="cart-upsell-product-card__price" data-price-container>
                <span class="cart-upsell-product-card__price-current cart-secondary-typography" data-price-current>${this.formatPriceSplit(price)}</span>
                <s class="cart-upsell-product-card__price-compare cart-secondary-typography" data-price-compare><span class="cart-upsell-product-card__compare-inner">${this.formatPriceSplit(compareAtPrice)}</span></s>
              </div>
            ` : `
              <div class="cart-upsell-product-card__price cart-upsell-product-card__price--no-compare" data-price-container>
                <span class="cart-upsell-product-card__price-current cart-secondary-typography" data-price-current>${this.formatPriceSplit(price)}</span>
              </div>
            `}
            </div>
            ${available && variant ? `
              ${hasVariants && hasOptions && product.variants && product.variants.length > 1 ? `
                <button type="button" class="button cart-upsell-product-card__button" 
                  data-product-id="${product.id}"
                  data-product-title="${productTitle}"
                  data-product-handle="${product.handle}"
                  data-has-variants="true">
                  <span class="svg-wrapper">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" width="16" height="16">
                      <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="var(--icon-stroke-width, 1.5)" d="M16.608 9.421V6.906H3.392v8.016c0 .567.224 1.112.624 1.513.4.402.941.627 1.506.627H8.63M8.818 3h2.333c.618 0 1.212.247 1.649.686a2.35 2.35 0 0 1 .683 1.658v1.562H6.486V5.344c0-.622.246-1.218.683-1.658A2.33 2.33 0 0 1 8.82 3"/>
                      <path stroke="currentColor" stroke-linecap="round" stroke-width="var(--icon-stroke-width, 1.5)" d="M14.608 12.563v5m2.5-2.5h-5"/>
                    </svg>
                  </span>
                  <span class="is-visually-hidden-mobile">Add</span>
                </button>
              ` : `
                <button type="button" class="button cart-upsell-product-card__button" 
                  data-variant-id="${variant.id}" 
                  data-product-id="${product.id}"
                  data-product-title="${productTitle}"
                  data-initial-variant-id="${variant.id}">
                  <span class="svg-wrapper">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" width="16" height="16">
                      <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="var(--icon-stroke-width, 1.5)" d="M16.608 9.421V6.906H3.392v8.016c0 .567.224 1.112.624 1.513.4.402.941.627 1.506.627H8.63M8.818 3h2.333c.618 0 1.212.247 1.649.686a2.35 2.35 0 0 1 .683 1.658v1.562H6.486V5.344c0-.622.246-1.218.683-1.658A2.33 2.33 0 0 1 8.82 3"/>
                      <path stroke="currentColor" stroke-linecap="round" stroke-width="var(--icon-stroke-width, 1.5)" d="M14.608 12.563v5m2.5-2.5h-5"/>
                    </svg>
                  </span>
                  <span class="is-visually-hidden-mobile">Add</span>
                </button>
              `}
            ` : `
              <span class="cart-upsell-product-card__unavailable">Sold out</span>
            `}
          </div>
        </div>
      `;

      slide.appendChild(productDiv);
      swiperWrapper.appendChild(slide);
    });

    // Initialize Swiper
    setTimeout(() => {
      if (!this.isConnected) return;
      this.initSwiper();
      this.setupAddToCartButtons();
      this.syncButtonStatesWithCart();
    }, 300);
  }

  setupAddToCartButtons() {
    // Use event delegation - attach listener to the products container, not the whole component
    // This is more resilient to DOM changes
    const productsContainer = this.querySelector('[ref="productsContainer"]') || 
                              this.querySelector('.cart-upsell__products') ||
                              this.querySelector('.swiper-wrapper') ||
                              this;
    
    if (!productsContainer) return;
    
    // Remove old listeners if they exist
    if (this._productsContainer) {
      this._productsContainer.removeEventListener('click', this.handleButtonClick);
      this._productsContainer.removeEventListener('change', this.handleVariantChange);
    }
    
    // Attach to products container
    productsContainer.addEventListener('click', this.handleButtonClick);
    productsContainer.addEventListener('change', this.handleVariantChange);
    this._productsContainer = productsContainer;
    
    // Initialize variant selectors
    this.initializeVariantSelectors();
  }

  initializeVariantSelectors() {
    const variantSelectors = this.querySelectorAll('.cart-upsell-variant-selector');
    
    variantSelectors.forEach(selector => {
      const selects = selector.querySelectorAll('.cart-upsell-variant-selector__select');
      const productCard = selector.closest('.cart-upsell-product-card');
      const button = productCard?.querySelector('.cart-upsell-product-card__button');
      
      if (!button || selects.length === 0) return;
      
      // Set up change listeners for each select
      selects.forEach(select => {
        select.addEventListener('change', () => {
          this.updateVariantForProduct(selector, productCard, button);
        });
      });
      
      // Initialize with current selections
      this.updateVariantForProduct(selector, productCard, button);
    });
  }

  handleVariantChange = (event) => {
    // Handle variant selector changes
    if (event.target.classList.contains('cart-upsell-variant-selector__select')) {
      const selector = event.target.closest('.cart-upsell-variant-selector');
      const productCard = selector?.closest('.cart-upsell-product-card');
      const button = productCard?.querySelector('.cart-upsell-product-card__button');
      
      if (selector && productCard && button) {
        this.updateVariantForProduct(selector, productCard, button);
      }
    }
  }

  updateVariantForProduct(selector, productCard, button) {
    const variantDataElement = selector.querySelector('.cart-upsell-variant-data');
    if (!variantDataElement) return;
    
    try {
      const variantData = JSON.parse(variantDataElement.textContent);
      const selects = selector.querySelectorAll('.cart-upsell-variant-selector__select');
      
      // Get selected values
      const selectedValues = Array.from(selects).map(select => select.value);
      
      // Find matching variant
      const matchingVariant = variantData.variants.find(variant => {
        if (variant.option1 !== selectedValues[0]) return false;
        if (selects.length > 1 && variant.option2 !== selectedValues[1]) return false;
        if (selects.length > 2 && variant.option3 !== selectedValues[2]) return false;
        return true;
      });
      
      if (matchingVariant) {
        // Update button variant ID
        button.dataset.variantId = matchingVariant.id.toString();
        
        // Update price if price container exists
        const priceContainer = productCard.querySelector('[data-price-container]');
        if (priceContainer) {
          const priceCurrent = priceContainer.querySelector('[data-price-current]');
          const priceCompare = priceContainer.querySelector('[data-price-compare]');
          
          if (priceCurrent) {
            priceCurrent.innerHTML = this.formatPriceSplit(matchingVariant.price);

            if (matchingVariant.compare_at_price > matchingVariant.price) {
              priceContainer.classList.remove('cart-upsell-product-card__price--no-compare');
              if (!priceCompare) {
                const compareEl = document.createElement('s');
                compareEl.className = 'cart-upsell-product-card__price-compare cart-secondary-typography';
                compareEl.setAttribute('data-price-compare', '');
                compareEl.innerHTML =
                  '<span class="cart-upsell-product-card__compare-inner">' +
                  this.formatPriceSplit(matchingVariant.compare_at_price) +
                  '</span>';
                priceContainer.appendChild(compareEl);
              } else {
                priceCompare.innerHTML =
                  '<span class="cart-upsell-product-card__compare-inner">' +
                  this.formatPriceSplit(matchingVariant.compare_at_price) +
                  '</span>';
              }
            } else {
              priceContainer.classList.add('cart-upsell-product-card__price--no-compare');
              if (priceCompare) {
                priceCompare.remove();
              }
            }
          }
        }
        
        // Update button availability
        if (matchingVariant.available) {
          button.disabled = false;
          button.classList.remove('unavailable');
          const unavailableText = productCard.querySelector('.cart-upsell-product-card__unavailable');
          if (unavailableText) {
            unavailableText.remove();
          }
        } else {
          button.disabled = true;
          button.classList.add('unavailable');
          // Show unavailable message if not already present
          if (!productCard.querySelector('.cart-upsell-product-card__unavailable')) {
            const unavailableText = document.createElement('span');
            unavailableText.className = 'cart-upsell-product-card__unavailable';
            unavailableText.textContent = 'Sold out';
            button.parentNode.insertBefore(unavailableText, button);
          }
        }
      }
    } catch (error) {
      console.error('Error updating variant:', error);
    }
  }

  handleButtonClick(event) {
    // Check if the click was on an add to cart button or its children (like SVG)
    let button = event.target.closest('.cart-upsell-product-card__button');
    
    // If click was on SVG or span inside button, find the button
    if (!button && (event.target.closest('svg') || event.target.closest('.svg-wrapper'))) {
      button = event.target.closest('.cart-upsell-product-card').querySelector('.cart-upsell-product-card__button');
    }
    
    if (!button) return;

    // Don't process if button is already disabled or processing
    if (button.disabled || button.classList.contains('processing') || button.classList.contains('added')) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    
    // Check if product has variants - open popup instead of direct add
    if (button.dataset.hasVariants === 'true') {
      this.openVariantPopup(button);
    } else {
      this.handleAddToCart(button);
    }
  }

  async handleAddToCart(button) {
    // Get variant data from button (button might be a temporary element not in DOM)
    const variantId = button?.dataset?.variantId;
    const productId = button?.dataset?.productId;
    const productTitle = button?.dataset?.productTitle;

    if (!variantId) {
      console.error('Variant ID is required');
      return Promise.reject(new Error('Variant ID is required'));
    }

    // For temporary buttons (not in DOM), we don't need to check isConnected
    const isTemporaryButton = !button.isConnected;

    // For temporary buttons (from popup), we don't modify the button state
    // Instead, we'll update the popup button state separately
    if (!isTemporaryButton) {
      // Ensure this specific button is the only one being processed
      button.dataset.processing = 'true';
      
      // Disable ONLY this button during request
      button.disabled = true;
      button.classList.add('processing');
      button.innerHTML = 'Adding...';
      
      // Ensure other buttons remain enabled
      const allButtons = this.querySelectorAll('.cart-upsell-product-card__button');
      allButtons.forEach(btn => {
        if (btn !== button && !btn.dataset.processing && !btn.classList.contains('added')) {
          btn.disabled = false;
        }
      });
    }
    
    const originalHTML = isTemporaryButton ? null : button.innerHTML;

    try {
      // Get section IDs from cart items components
      const cartItemsComponents = document.querySelectorAll('cart-items-component');
      const sectionIds = Array.from(cartItemsComponents)
        .map(component => component.dataset.sectionId)
        .filter(Boolean);

      // Use FormData like the product form does to include sections in response
      const formData = new FormData();
      formData.append('id', variantId);
      formData.append('quantity', '1');
      if (sectionIds.length > 0) {
        formData.append('sections', sectionIds.join(','));
      }

      const response = await fetch('/cart/add.js', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to add to cart: ${response.status}`);
      }

      const data = await response.json();

      // Check if there was an error in the response
      if (data.status) {
        throw new Error(data.message || 'Failed to add product to cart');
      }

      // Get sections from response or fetch them
      let sections = {};
      if (data.sections) {
        sections = data.sections;
      } else if (sectionIds.length > 0) {
        // Fallback: use section renderer to fetch sections
        // The cart items component will handle the update via the event
        sectionIds.forEach(sectionId => {
          sectionRenderer.renderSection(sectionId, { cache: false });
        });
      }

      // Dispatch proper CartAddEvent
      const cartAddEvent = new CartAddEvent(
        {},
        this.id || 'cart-upsell-component',
        {
          source: 'cart-upsell-component',
          itemCount: 1,
          variantId: variantId.toString(),
          productId: productId?.toString(),
          sections: sections
        }
      );
      this.dispatchEvent(cartAddEvent);
      document.dispatchEvent(cartAddEvent);

      // Show temporary success feedback (only for buttons in DOM)
      if (!isTemporaryButton) {
        button.innerHTML = 'Added!';
        button.classList.add('processing'); // Keep processing class temporarily
        
        // Hide this product from upsells (only disable this specific button, not the whole card)
        const productCard = button.closest('.cart-upsell-product-card');
        if (productCard) {
          productCard.classList.add('product-added');
        }

        // Remove processing flag
        button.classList.remove('processing');
        delete button.dataset.processing;
      }
      
      // Verify product is actually in cart and sync all button states
      // Wait a bit for cart to update before syncing - this will properly set all button states
      setTimeout(() => {
        this.syncButtonStatesWithCart();
        // Double-check after another delay to ensure component is hidden if needed
        setTimeout(() => {
          this.syncButtonStatesWithCart();
        }, 200);
      }, 300);

    } catch (error) {
      console.error('Error adding product to cart:', error);
      
      // Re-enable this button on error (only for buttons in DOM)
      if (!isTemporaryButton && button && button.isConnected) {
        button.disabled = false;
        button.classList.remove('processing');
        if (originalHTML) {
          button.innerHTML = originalHTML;
        }
        delete button.dataset.processing;
      }
      
      // Ensure other buttons are still enabled
      if (!isTemporaryButton) {
        const allButtons = this.querySelectorAll('.cart-upsell-product-card__button');
        allButtons.forEach(btn => {
          if (btn !== button && !btn.dataset.added) {
            btn.disabled = false;
            btn.classList.remove('processing');
          }
        });
      }
      
      // Show error message
      alert(error.message || 'Unable to add product to cart. Please try again.');
      
      // Re-throw error so promise chain can handle it
      throw error;
    }
  }

  async openVariantPopup(button) {
    const productId = button.dataset.productId;
    const productHandle = button.dataset.productHandle;
    const productTitle = button.dataset.productTitle;
    
    if (!productId) {
      console.error('Product ID is required');
      return;
    }

    // Get or create popup
    let popup = document.getElementById('cart-upsell-variant-popup');
    if (!popup) {
      // Popup should be rendered in Liquid template, but if it doesn't exist, create it
      popup = document.createElement('dialog');
      popup.id = 'cart-upsell-variant-popup';
      popup.className = 'cart-upsell-variant-popup dialog-modal';
      popup.setAttribute('scroll-lock', '');
      
      // Create popup structure
      const content = document.createElement('div');
      content.className = 'cart-upsell-variant-popup__content';
      
      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'button button-unstyled close-button cart-upsell-variant-popup__close';
      closeBtn.setAttribute('data-popup-close', '');
      closeBtn.innerHTML = '<span class="svg-wrapper">✕</span>';
      
      const header = document.createElement('div');
      header.className = 'cart-upsell-variant-popup__header';
      header.innerHTML = '<h3 class="cart-upsell-variant-popup__title" data-popup-title></h3><div class="cart-upsell-variant-popup__price" data-popup-price></div>';
      
      const body = document.createElement('div');
      body.className = 'cart-upsell-variant-popup__body';
      body.setAttribute('data-popup-body', '');
      
      const footer = document.createElement('div');
      footer.className = 'cart-upsell-variant-popup__footer';
      footer.innerHTML = '<button type="button" class="button cart-upsell-variant-popup__add-button" data-popup-add-button><span class="svg-wrapper">+</span><span>Add to cart</span></button>';
      
      content.appendChild(closeBtn);
      content.appendChild(header);
      content.appendChild(body);
      content.appendChild(footer);
      popup.appendChild(content);
      
      document.body.appendChild(popup);
    }

    // Fetch product data
    try {
      // Try to get product handle from data attribute or product link
      let handle = productHandle;
      
      if (!handle) {
        const productCard = button.closest('.cart-upsell-product-card');
        const productLink = productCard?.querySelector('.cart-upsell-product-card__title, .cart-upsell-product-card__image');
        
        if (productLink && productLink.href) {
          const url = new URL(productLink.href);
          handle = url.pathname.split('/products/').pop()?.split('?')[0];
        }
      }
      
      if (!handle) {
        throw new Error('Product handle not found');
      }
      
      const productUrl = `/products/${handle}.js`;
      const response = await fetch(productUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch product: ${response.status}`);
      }
      const product = await response.json();

      // Update popup content
      const titleEl = popup.querySelector('[data-popup-title]');
      const priceEl = popup.querySelector('[data-popup-price]');
      const bodyEl = popup.querySelector('[data-popup-body]');
      const addButton = popup.querySelector('[data-popup-add-button]');

      if (titleEl) {
        titleEl.textContent = product.title;
      }

      // Set initial price
      const firstVariant = product.variants?.[0] || product.selected_or_first_available_variant;
      if (priceEl && firstVariant) {
        const price = this.formatPriceSplit(firstVariant.price);
        const comparePrice = firstVariant.compare_at_price > firstVariant.price 
          ? this.formatPriceSplit(firstVariant.compare_at_price) 
          : null;
        
        priceEl.innerHTML = comparePrice 
          ? `<span class="cart-upsell-variant-popup__price-current">${price}</span><span class="cart-upsell-variant-popup__price-compare">${comparePrice}</span>`
          : `<span class="cart-upsell-variant-popup__price-current">${price}</span>`;
      }

      // Create variant selector
      if (bodyEl && product.variants && product.variants.length > 1) {
        const variantSelector = this.createVariantSelectorForPopup(product, popup);
        
        if (variantSelector && variantSelector.children.length > 0) {
          bodyEl.innerHTML = '';
          bodyEl.appendChild(variantSelector);
        } else {
          bodyEl.innerHTML = '<p>No variants available for selection.</p>';
        }
      } else if (!bodyEl) {
        console.error('Popup body element not found');
      } else if (!product.variants || product.variants.length <= 1) {
        if (bodyEl) {
          bodyEl.innerHTML = '<p>This product has no variants to select.</p>';
        }
      }

      // Set up add button
      if (addButton) {
        addButton.dataset.productId = productId;
        addButton.dataset.productTitle = productTitle;
        addButton.dataset.variantId = firstVariant?.id?.toString() || '';
        
        // Remove any existing event listeners by cloning (but keep the same reference)
        const clickHandler = (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          // Get current variant ID from dataset (updated when variant changes)
          const currentButton = popup.querySelector('[data-popup-add-button]');
          const selectedVariantId = currentButton?.dataset.variantId;
          
          if (!selectedVariantId) {
            console.error('No variant ID found');
            alert('Please select a variant');
            return;
          }
          
          // Disable button during processing
          if (currentButton) {
            currentButton.disabled = true;
            currentButton.classList.add('processing');
            const originalText = currentButton.innerHTML;
            currentButton.innerHTML = 'Adding...';
            
            // Create a temporary button with variant ID for handleAddToCart
            const tempButton = document.createElement('button');
            tempButton.dataset.variantId = selectedVariantId;
            tempButton.dataset.productId = productId;
            tempButton.dataset.productTitle = productTitle;
            
            // Call handleAddToCart
            this.handleAddToCart(tempButton).then(() => {
              // Close popup after successful add
              setTimeout(() => {
                this.closeVariantPopup();
              }, 300);
            }).catch((error) => {
              // Re-enable button on error
              if (currentButton) {
                currentButton.disabled = false;
                currentButton.classList.remove('processing');
                currentButton.innerHTML = originalText;
              }
              console.error('Error adding to cart:', error);
              alert(error.message || 'Unable to add product to cart. Please try again.');
            });
          }
        };
        
        // Remove old listener if exists
        addButton.replaceWith(addButton.cloneNode(true));
        const newAddButton = popup.querySelector('[data-popup-add-button]');
        if (newAddButton) {
          newAddButton.dataset.productId = productId;
          newAddButton.dataset.productTitle = productTitle;
          newAddButton.dataset.variantId = firstVariant?.id?.toString() || '';
          newAddButton.addEventListener('click', clickHandler);
        }
      }

      // Set up close button
      const closeButton = popup.querySelector('[data-popup-close]');
      if (closeButton) {
        closeButton.onclick = () => this.closeVariantPopup();
      }

      // Close on backdrop click
      popup.onclick = (e) => {
        if (e.target === popup) {
          this.closeVariantPopup();
        }
      };

      // Show popup
      popup.showModal();
    } catch (error) {
      console.error('Error opening variant popup:', error);
      alert('Unable to load product variants. Please try again.');
    }
  }

  createVariantSelectorForPopup(product, popup) {
    const container = document.createElement('div');
    container.className = 'cart-upsell-variant-popup__variants';

    // Build options_with_values from product.options and variants if not available
    let optionsWithValues = product.options_with_values;
    
    if (!optionsWithValues && product.options && product.variants) {
      optionsWithValues = product.options.map((option, index) => {
        // Handle both string and object formats
        // If option is a string, use it directly; if it's an object, use option.name
        const optionName = typeof option === 'string' ? option : (option.name || option);
        
        // Get unique values for this option from all variants
        const values = [...new Set(product.variants.map(v => {
          if (index === 0) return v.option1;
          if (index === 1) return v.option2;
          if (index === 2) return v.option3;
          return null;
        }).filter(Boolean))];
        
        return {
          name: optionName,
          position: index + 1,
          values: values
        };
      });
    }

    if (!optionsWithValues || optionsWithValues.length === 0) {
      return container;
    }

    const selects = [];

    optionsWithValues.forEach((option, optIndex) => {
      if (option.values && option.values.length > 0) {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'cart-upsell-variant-popup__option';

        const label = document.createElement('label');
        label.className = 'cart-upsell-variant-popup__option-label';
        // Ensure option.name is a string (handle both string and object cases)
        const optionName = typeof option.name === 'string' ? option.name : String(option.name || 'Option');
        label.textContent = `${optionName}:`;
        label.setAttribute('for', `popup-option-${product.id}-${optIndex}`);

        const select = document.createElement('select');
        select.className = 'cart-upsell-variant-popup__option-select';
        select.id = `popup-option-${product.id}-${optIndex}`;
        select.dataset.optionPosition = optIndex.toString();
        selects.push(select);

        // Helper function to check if option value is available with current selections
        const isOptionValueAvailable = (value, currentSelections) => {
          return product.variants.some(variant => {
            if (optIndex === 0) {
              return variant.option1 === value && 
                     (currentSelections[1] === undefined || variant.option2 === currentSelections[1]) &&
                     (currentSelections[2] === undefined || variant.option3 === currentSelections[2]);
            }
            if (optIndex === 1) {
              return variant.option1 === currentSelections[0] &&
                     variant.option2 === value &&
                     (currentSelections[2] === undefined || variant.option3 === currentSelections[2]);
            }
            if (optIndex === 2) {
              return variant.option1 === currentSelections[0] &&
                     variant.option2 === currentSelections[1] &&
                     variant.option3 === value;
            }
            return false;
          });
        };

        // Populate options based on current selections
        const populateOptions = () => {
          const currentSelections = selects.map((s, i) => i < optIndex ? s.value : undefined);
          
          select.innerHTML = '';
          option.values.forEach(value => {
            const isAvailable = isOptionValueAvailable(value, currentSelections);
            const optionEl = document.createElement('option');
            optionEl.value = value;
            optionEl.textContent = value;
            
            if (!isAvailable) {
              optionEl.disabled = true;
              optionEl.textContent += ' - Unavailable';
            }
            
            select.appendChild(optionEl);
          });
          
          // Set selected value
          const currentValue = currentSelections[optIndex];
          if (currentValue && Array.from(select.options).some(opt => opt.value === currentValue)) {
            select.value = currentValue;
          } else if (select.options.length > 0) {
            select.value = select.options[0].value;
          }
        };

        // Initial population
        populateOptions();

        // Handle change - update dependent selects and variant
        select.addEventListener('change', () => {
          // Update dependent selects
          for (let i = optIndex + 1; i < selects.length; i++) {
            const dependentSelect = selects[i];
            const dependentOption = optionsWithValues[i];
            if (dependentOption && dependentOption.values) {
              const currentSelections = selects.map((s, idx) => idx <= optIndex ? s.value : undefined);
              
              dependentSelect.innerHTML = '';
              dependentOption.values.forEach(value => {
                const isAvailable = product.variants.some(variant => {
                  if (i === 1) {
                    return variant.option1 === currentSelections[0] &&
                           variant.option2 === value &&
                           (currentSelections[2] === undefined || variant.option3 === currentSelections[2]);
                  }
                  if (i === 2) {
                    return variant.option1 === currentSelections[0] &&
                           variant.option2 === currentSelections[1] &&
                           variant.option3 === value;
                  }
                  return false;
                });
                
                const optionEl = document.createElement('option');
                optionEl.value = value;
                optionEl.textContent = value;
                if (!isAvailable) {
                  optionEl.disabled = true;
                  optionEl.textContent += ' - Unavailable';
                }
                dependentSelect.appendChild(optionEl);
              });
              
              if (dependentSelect.options.length > 0) {
                dependentSelect.value = dependentSelect.options[0].value;
              }
            }
          }
          
          this.updateVariantInPopup(product, popup);
        });

        optionDiv.appendChild(label);
        optionDiv.appendChild(select);
        container.appendChild(optionDiv);
      }
    });

    // Store variant data
    const variantData = document.createElement('script');
    variantData.type = 'application/json';
    variantData.className = 'cart-upsell-variant-data';
    variantData.textContent = JSON.stringify({
      variants: product.variants.map(v => ({
        id: v.id,
        price: v.price,
        compare_at_price: v.compare_at_price || 0,
        available: v.available !== false,
        option1: v.option1 || '',
        option2: v.option2 || '',
        option3: v.option3 || ''
      }))
    });
    container.appendChild(variantData);

    return container;
  }

  updateVariantInPopup(product, popup) {
    const selects = popup.querySelectorAll('.cart-upsell-variant-popup__option-select');
    const selectedValues = Array.from(selects).map(select => select.value);
    const variantDataEl = popup.querySelector('.cart-upsell-variant-data');
    
    if (!variantDataEl) return;

    try {
      const variantData = JSON.parse(variantDataEl.textContent);
      const matchingVariant = variantData.variants.find(variant => {
        if (variant.option1 !== selectedValues[0]) return false;
        if (selects.length > 1 && variant.option2 !== selectedValues[1]) return false;
        if (selects.length > 2 && variant.option3 !== selectedValues[2]) return false;
        return true;
      });

      if (matchingVariant) {
        // Update price
        const priceEl = popup.querySelector('[data-popup-price]');
        if (priceEl) {
          const price = this.formatPriceSplit(matchingVariant.price);
          const comparePrice = matchingVariant.compare_at_price > matchingVariant.price 
            ? this.formatPriceSplit(matchingVariant.compare_at_price) 
            : null;
          
          priceEl.innerHTML = comparePrice 
            ? `<span class="cart-upsell-variant-popup__price-current">${price}</span><span class="cart-upsell-variant-popup__price-compare">${comparePrice}</span>`
            : `<span class="cart-upsell-variant-popup__price-current">${price}</span>`;
        }

        // Update add button
        const addButton = popup.querySelector('[data-popup-add-button]');
        if (addButton) {
          addButton.dataset.variantId = matchingVariant.id.toString();
          addButton.disabled = !matchingVariant.available;
        }
      }
    } catch (error) {
      console.error('Error updating variant in popup:', error);
    }
  }

  closeVariantPopup() {
    const popup = document.getElementById('cart-upsell-variant-popup');
    if (popup && popup.open) {
      popup.classList.add('dialog-closing');
      setTimeout(() => {
        popup.close();
        popup.classList.remove('dialog-closing');
      }, 300);
    }
  }

  formatMoney(cents) {
    const theme = typeof window.Theme !== 'undefined'
      ? window.Theme
      : (typeof Theme !== 'undefined' ? Theme : null);
    const amount = Number(cents || 0) / 100;
    const formattedAmount = new Intl.NumberFormat(document.documentElement.lang || 'en', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);

    if (theme?.currencyPrefix || theme?.currencySuffix) {
      return `${theme.currencyPrefix || ''}${formattedAmount}${theme.currencySuffix || ''}`.trim();
    }

    if (theme?.moneyFormat) {
      return theme.moneyFormat.replace('{{amount}}', formattedAmount);
    }

    return new Intl.NumberFormat(document.documentElement.lang || 'en', {
      style: 'currency',
      currency: theme?.currency || 'USD',
    }).format(amount);
  }

  formatPriceSplit(cents) {
    const theme = typeof window.Theme !== 'undefined'
      ? window.Theme
      : (typeof Theme !== 'undefined' ? Theme : null);

    if (theme?.formatPriceSplitHTML) {
      return theme.formatPriceSplitHTML(cents, false, 'cart');
    }
    return this.formatMoney(cents);
  }
}

if (!customElements.get('cart-upsell-component')) {
  customElements.define('cart-upsell-component', CartUpsellComponent);
}

