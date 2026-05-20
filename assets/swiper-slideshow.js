// Swiper Slideshow Component
// Uses Swiper.js CDN version

// @ts-nocheck
class SwiperSlideshow {
  constructor() {
    this.swiperInstances = new Map();
    this.resizeObservers = new Map();
    this.userInteracted = false;
    this.setupUserInteractionHandler();
    this.init();
  }

  setupUserInteractionHandler() {
    // Enable autoplay after first user interaction
    const enableAutoplay = () => {
      this.userInteracted = true;
      // Re-trigger autoplay for all slideshows
      this.swiperInstances.forEach((swiper, element) => {
        this.handleVideoAutoplay(element);
      });
    };

    // Listen for various user interaction events
    ['click', 'touchstart', 'keydown'].forEach(event => {
      document.addEventListener(event, enableAutoplay, { once: true });
    });
  }

  init() {
    // Wait for Swiper to be available
    if (typeof Swiper === 'undefined') {
      // Retry after a short delay
      setTimeout(() => this.init(), 100);
      return;
    }

    // Initialize all swiper slideshows on the page
    this.initSwipers();
    
    // Listen for section loading (for dynamic content)
    document.addEventListener('shopify:section:load', (event) => {
      this.initSwipers(event.target);
    });

    // Clean up when sections are unloaded
    document.addEventListener('shopify:section:unload', (event) => {
      this.destroySwipers(event.target);
    });

    // Add resize observer for adaptive height
    this.setupResizeObserver();
    
    // Add window resize listener as fallback
    this.setupWindowResizeListener();
  }

  initSwipers(container = document) {
    const swiperElements = container.querySelectorAll('.swiper-slideshow');
    
    swiperElements.forEach((element) => {
      if (this.swiperInstances.has(element)) {
        return; // Already initialized
      }

      const config = this.getSwiperConfig(element);
      const swiper = new Swiper(element, config);
      
      this.swiperInstances.set(element, swiper);

      // Setup smooth loading for media elements
      this.setupSmoothLoading(element);

      // Add container to resize observer if it has adaptive height
      if (element.classList.contains('swiper-slideshow--adaptive') && this.resizeObserver) {
        const slideshowContainer = element.closest('.swiper-slideshow-container');
        if (slideshowContainer) {
          this.resizeObserver.observe(slideshowContainer);
        }
      }
    });
  }

  getSwiperConfig(element) {
    const autoplay = element.dataset.autoplay === 'true';
    const autoplayDelay = parseInt(element.dataset.autoplayDelay) || 4000;
    const loop = element.dataset.loop === 'true';
    const effect = element.dataset.effect || 'slide';
    const speed = parseInt(element.dataset.speed) || 500;
    const spaceBetween = parseInt(element.dataset.spaceBetween) || 0;
    const slidesPerView = parseInt(element.dataset.slidesPerView) || 1;
    const slidesPerViewMobile = parseInt(element.dataset.slidesPerViewMobile) || 1;
    const showNavigation = element.dataset.showNavigation === 'true';
    const showPagination = element.dataset.showPagination === 'true';
    const paginationType = element.dataset.paginationType || 'bullets';

    const config = {
      loop: loop,
      speed: speed,
      spaceBetween: spaceBetween,
      slidesPerView: slidesPerView,
      breakpoints: {
        768: {
          slidesPerView: slidesPerView,
        },
        320: {
          slidesPerView: slidesPerViewMobile,
        }
      },
      on: {
        init: () => {
          // Handle video autoplay when slide becomes active
          this.handleVideoAutoplay(element);
          // Handle adaptive height
          this.handleAdaptiveHeight(element);
          // Ensure animations work on first slide
          this.ensureAnimationsWork(element);
        },
        slideChange: () => {
          // Handle video autoplay when slide changes
          this.handleVideoAutoplay(element);
          // Ensure animations work on new active slide
          this.ensureAnimationsWork(element);
        },
        slideChangeTransitionEnd: () => {
          // Handle video autoplay after transition completes
          this.handleVideoAutoplay(element);
        },
        resize: () => {
          // Handle adaptive height on resize
          this.handleAdaptiveHeight(element);
        }
      }
    };

    // Add effect configuration based on selected effect
    if (effect !== 'slide') {
      switch (effect) {
        case 'fade':
          config.effect = 'fade';
          config.fadeEffect = {
            crossFade: true
          };
          break;
        case 'cube':
          config.effect = 'cube';
          config.cubeEffect = {
            shadow: true,
            slideShadows: true,
            shadowOffset: 20,
            shadowScale: 0.94
          };
          break;
        case 'coverflow':
          config.effect = 'coverflow';
          config.coverflowEffect = {
            rotate: 50,
            stretch: 0,
            depth: 100,
            modifier: 1,
            slideShadows: true
          };
          break;
        case 'flip':
          config.effect = 'flip';
          config.flipEffect = {
            slideShadows: true,
            limitRotation: true
          };
          break;
      }
    }

    // Add autoplay configuration
    if (autoplay) {
      config.autoplay = {
        delay: autoplayDelay,
        disableOnInteraction: false,
        pauseOnMouseEnter: true
      };
    }

    // Add navigation configuration
    if (showNavigation) {
      config.navigation = {
        nextEl: '.swiper-button-next',
        prevEl: '.swiper-button-prev',
      };
    }

    // Add pagination configuration
    if (showPagination) {
      config.pagination = {
        el: '.swiper-pagination',
        type: paginationType,
        clickable: true,
        dynamicBullets: false // Disable dynamic bullets to prevent left/right movement
      };
    }

    return config;
  }

  handleVideoAutoplay(element) {
    const activeSlide = element.querySelector('.swiper-slide-active');
    if (!activeSlide) return;

    // Handle Shopify videos (both desktop and mobile)
    // On mobile, prioritize mobile video; on desktop, prioritize desktop video
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
    
    let activeVideo = null;
    if (isMobile) {
      // On mobile, look for mobile video first, then fallback to desktop video
      activeVideo = activeSlide.querySelector('.swiper-slide-video-mobile video') || 
                   activeSlide.querySelector('.swiper-slide-video-desktop video') ||
                   activeSlide.querySelector('video');
    } else {
      // On desktop, look for desktop video first, then fallback to mobile video
      activeVideo = activeSlide.querySelector('.swiper-slide-video-desktop video') || 
                   activeSlide.querySelector('.swiper-slide-video-mobile video') ||
                   activeSlide.querySelector('video');
    }

    // Completely stop all videos first to prevent conflicts
    const allVideos = element.querySelectorAll('video');
    allVideos.forEach(video => {
      // Stop all videos immediately
      video.pause();
      video.currentTime = 0;
      video.load(); // Force reload to clear any pending operations
    });
    
    if (activeVideo) {
      console.log('🎬 Selected video:', {
        isMobile,
        container: activeVideo.parentElement.className,
        src: activeVideo.src || activeVideo.currentSrc,
        visible: activeVideo.offsetParent !== null
      });
      
      // Check if autoplay is enabled for this slide
      const videoBlock = activeSlide.closest('.swiper-slide');
      const autoplayValue = videoBlock && videoBlock.dataset.autoplay;
      const autoplayEnabled = autoplayValue === 'true' || autoplayValue === true;
      const showControlsValue = videoBlock && videoBlock.dataset.showControls;
      const showControls = showControlsValue === 'true' || showControlsValue === true; 
      
      // Small delay to ensure all videos are stopped before starting the active one
      setTimeout(() => {
        this.playActiveVideo(activeVideo, autoplayEnabled, showControls);
      }, 50);
    }
  }

  playActiveVideo(video, autoplayEnabled, showControls) {
    if (!video) return;
    
    console.log('🎬 Playing active video:', {
      autoplayEnabled,
      showControls,
      userInteracted: this.userInteracted,
      paused: video.paused
    });
    
    // Ensure video is muted for autoplay compliance
    video.muted = true;
    
    // Set controls based on settings
    if (!showControls) {
      video.controls = false;
    }
    
    if (autoplayEnabled && this.userInteracted) {
      // User has interacted, try to play
      if (video.paused) {
        video.currentTime = 0;
        
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            console.log('✅ Video autoplay successful');
            if (showControls) {
              video.controls = true;
            }
            
            // Add event listener for looping
            const handleVideoEnd = () => {
              if (autoplayEnabled && this.userInteracted) {
                video.currentTime = 0;
                video.play().catch(e => console.log('Video restart failed:', e));
              }
            };
            
            video.removeEventListener('ended', handleVideoEnd);
            video.addEventListener('ended', handleVideoEnd);
          }).catch(error => {
            console.log('❌ Video autoplay failed:', error);
            if (showControls) {
              video.controls = true;
            }
          });
        }
      }
    } else if (autoplayEnabled && !this.userInteracted) {
      // Autoplay enabled but no user interaction yet
      if (showControls) {
        video.controls = true;
      }
    } else if (video.hasAttribute('autoplay') && !this.userInteracted) {
      // HTML autoplay attribute for first slide
      if (video.paused) {
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            console.log('✅ HTML autoplay successful');
            if (showControls) {
              video.controls = true;
            }
          }).catch(error => {
            console.log('❌ HTML autoplay failed:', error);
            if (showControls) {
              video.controls = true;
            }
          });
        }
      } else if (showControls) {
        video.controls = true;
      }
    } else {
      // No autoplay, just set controls
      if (showControls) {
        video.controls = true;
      }
    }
  }

  ensureAnimationsWork(element) {
    // Small delay to ensure Swiper has finished its initialization
    setTimeout(() => {
      const activeSlide = element.querySelector('.swiper-slide-active');
      if (activeSlide) {
        // Ensure the active slide has the proper class
        activeSlide.classList.add('swiper-slide-active');
        
        // Find content elements and ensure they can animate
        const contentElements = activeSlide.querySelectorAll('.swiper-slide-content-inner');
        contentElements.forEach(contentElement => {
          // Force animation to restart by temporarily removing and re-adding the animation class
          const animationClass = Array.from(contentElement.classList).find(cls => 
            cls.startsWith('swiper-slide-animate-')
          );
          
          if (animationClass) {
            // Remove the animation class temporarily
            contentElement.classList.remove(animationClass);
            
            // Force a reflow
            contentElement.offsetHeight;
            
            // Re-add the animation class to trigger the animation
            setTimeout(() => {
              contentElement.classList.add(animationClass);
            }, 10);
          }
        });
      }
    }, 50);
  }

  setupSmoothLoading(element) {
    // Handle image loading
    const images = element.querySelectorAll('.swiper-slide-img, .swiper-slide-video-poster, .swiper-slide-bg-img');
    images.forEach(img => {
      if (img.complete && img.naturalHeight !== 0) {
        // Image is already loaded
        img.classList.add('loaded');
      } else {
        // Wait for image to load
        img.addEventListener('load', () => {
          img.classList.add('loaded');
        });
        img.addEventListener('error', () => {
          // Still show the image even if it failed to load
          img.classList.add('loaded');
        });
      }
    });

    // Handle video loading
    const videos = element.querySelectorAll('.swiper-slide-video-element');
    videos.forEach(video => {
      if (video.readyState >= 2) {
        // Video metadata is loaded
        video.classList.add('loaded');
      } else {
        // Wait for video metadata to load
        video.addEventListener('loadedmetadata', () => {
          video.classList.add('loaded');
        });
        video.addEventListener('canplay', () => {
          video.classList.add('loaded');
        });
        video.addEventListener('error', () => {
          // Still show the video even if it failed to load
          video.classList.add('loaded');
        });
      }
    });
  }

  handleAdaptiveHeight(element) {
    // Only handle adaptive height if the element has the adaptive class
    if (!element.classList.contains('swiper-slideshow--adaptive')) return;

    const container = element.closest('.swiper-slideshow-container');
    if (!container) return;

    // Get the container width to calculate proper height
    const containerWidth = container.offsetWidth;
    if (containerWidth === 0) return;

    // Get the aspect ratio from CSS custom property
    const aspectRatio = parseFloat(getComputedStyle(element).getPropertyValue('--aspect-ratio')) || 1;
    const maxHeight = parseFloat(getComputedStyle(element).getPropertyValue('--max-height')) || 800;
    
    // Calculate height based on container width and aspect ratio
    const calculatedHeight = containerWidth / aspectRatio;
    
    // Apply the calculated height, respecting max-height
    const finalHeight = Math.min(calculatedHeight, maxHeight);
    
    // Only update if the calculated height is different from current height
    const currentHeight = element.offsetHeight;
    if (Math.abs(currentHeight - finalHeight) > 1) {
      element.style.height = `${finalHeight}px`;
    }
  }

  setupResizeObserver() {
    // Create a single ResizeObserver for all adaptive slideshows
    if (this.resizeObserver) return;

    this.resizeObserver = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        const element = entry.target.querySelector('.swiper-slideshow--adaptive');
        if (element) {
          this.handleAdaptiveHeight(element);
        }
      });
    });

    // Observe all slideshow containers
    const containers = document.querySelectorAll('.swiper-slideshow-container');
    containers.forEach(container => {
      this.resizeObserver.observe(container);
    });
  }

  setupWindowResizeListener() {
    // Debounced resize handler
    let resizeTimeout;
    this.handleWindowResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        const adaptiveElements = document.querySelectorAll('.swiper-slideshow--adaptive');
        adaptiveElements.forEach(element => {
          this.handleAdaptiveHeight(element);
        });
      }, 100);
    };

    window.addEventListener('resize', this.handleWindowResize);
  }

  destroySwipers(container) {
    const swiperElements = container.querySelectorAll('.swiper-slideshow');
    
    swiperElements.forEach((element) => {
      const swiper = this.swiperInstances.get(element);
      if (swiper) {
        swiper.destroy(true, true);
        this.swiperInstances.delete(element);
      }
    });
  }

  // Public method to get swiper instance
  getSwiper(element) {
    return this.swiperInstances.get(element);
  }

  // Public method to destroy all instances
  destroyAll() {
    this.swiperInstances.forEach((swiper) => {
      swiper.destroy(true, true);
    });
    this.swiperInstances.clear();

    // Clean up resize observer
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    // Clean up window resize listener
    if (this.handleWindowResize) {
      window.removeEventListener('resize', this.handleWindowResize);
      this.handleWindowResize = null;
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new SwiperSlideshow();
  });
} else {
  new SwiperSlideshow();
}

// Export for potential external use
window.SwiperSlideshow = SwiperSlideshow;
