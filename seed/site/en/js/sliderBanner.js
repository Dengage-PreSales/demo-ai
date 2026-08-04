function sliderBanner() {

  const STYLE_ID = 'cantupneus-banner-slider-styles';
  const SECTION_ID = 'cantupneus-highlights-slider';

  if (document.getElementById(SECTION_ID)) {
    return;
  }

  const anchor =
    document.querySelector('.featured-piece') ||
    document.querySelector('#featured-piece') ||
    document.querySelector('#about') ||
    document.querySelector('.about.section');

  if (!anchor) {
    console.warn('sliderBanner: .featured-piece anchor not found, slider will not be inserted');
    return;
  }

  if (!document.querySelector('link[href*="swiper"]')) {
    const swiperCSS = document.createElement('link');
    swiperCSS.rel = 'stylesheet';
    swiperCSS.href = 'vendor/swiper-bundle.min.css';
    document.head.appendChild(swiperCSS);
  }

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .banner-slider {
        padding: var(--space-xl, 6rem) 0;
        background-color: var(--color-cream, #F6F4FA);
      }
      .banner-slider .slider-header {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 1.5rem;
        margin-bottom: 2.25rem;
        flex-wrap: wrap;
      }
      .banner-slider .slider-header-content {
        max-width: 560px;
      }
      .banner-slider .section-subtitle {
        font-family: var(--font-body, 'Inter', sans-serif);
        font-size: 0.75rem;
        font-weight: 600;
        letter-spacing: 0.28em;
        text-transform: uppercase;
        color: var(--color-gold-dark, #35015F);
        display: inline-block;
        margin-bottom: 0.85rem;
      }
      .banner-slider .section-title {
        font-family: var(--font-display, 'Barlow Condensed', Georgia, serif);
        font-weight: 500;
        font-size: clamp(2rem, 3.4vw, 3rem);
        color: var(--color-charcoal, #1A1030);
        margin: 0;
        line-height: 1.1;
      }
      .banner-slider .slider-nav {
        display: flex;
        gap: 0.75rem;
      }
      .banner-slider .slider-btn {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        border: 1px solid rgba(28, 28, 28, 0.18);
        background: var(--color-cream, #F6F4FA);
        color: var(--color-charcoal, #1A1030);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
        font-size: 18px;
      }
      .banner-slider .slider-btn:hover {
        background: var(--color-charcoal, #1A1030);
        color: var(--color-cream, #F6F4FA);
        border-color: var(--color-charcoal, #1A1030);
      }
      .banner-slider .swiper { overflow: hidden; border-radius: 18px; }
      .banner-slider .banner-slide {
        position: relative;
        width: 100%;
        aspect-ratio: 16 / 7;
        min-height: 320px;
        border-radius: 18px;
        overflow: hidden;
        background-color: var(--color-ivory, #EDE9F5);
        box-shadow: 0 18px 42px rgba(28, 28, 28, 0.18);
      }
      .banner-slider .banner-slide img {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .banner-slider .banner-overlay {
        position: absolute;
        inset: 0;
        background: linear-gradient(115deg, rgba(28,28,28,0.62) 0%, rgba(28,28,28,0.28) 45%, rgba(28,28,28,0) 70%);
        display: flex;
        align-items: center;
      }
      .banner-slider .banner-text {
        max-width: 460px;
        padding: 2rem 2.5rem;
        color: var(--color-cream, #F6F4FA);
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
      }
      .banner-slider .banner-eyebrow {
        font-family: var(--font-body, 'Inter', sans-serif);
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.28em;
        text-transform: uppercase;
        color: var(--color-gold-light, #4E018F);
      }
      .banner-slider .banner-title {
        font-family: var(--font-display, 'Barlow Condensed', Georgia, serif);
        font-weight: 500;
        font-size: clamp(1.6rem, 2.6vw, 2.4rem);
        line-height: 1.15;
        margin: 0;
      }
      .banner-slider .banner-desc {
        font-family: var(--font-body, 'Inter', sans-serif);
        font-size: 0.95rem;
        line-height: 1.55;
        color: rgba(255, 251, 245, 0.85);
        margin: 0;
      }
      .banner-slider .banner-cta {
        align-self: flex-start;
        margin-top: 0.6rem;
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.7rem 1.4rem;
        border-radius: 999px;
        font-family: var(--font-body, 'Inter', sans-serif);
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        text-decoration: none;
        color: var(--color-charcoal, #1A1030);
        background: var(--color-cream, #F6F4FA);
        border: 1px solid var(--color-cream, #F6F4FA);
        transition: background 0.2s ease, color 0.2s ease;
      }
      .banner-slider .banner-cta:hover {
        background: transparent;
        color: var(--color-cream, #F6F4FA);
      }
      .banner-slider .swiper-pagination {
        position: static;
        margin-top: 1.5rem;
        display: flex;
        justify-content: center;
        gap: 0.5rem;
      }
      .banner-slider .swiper-pagination-bullet {
        width: 28px;
        height: 3px;
        border-radius: 999px;
        background: rgba(28, 28, 28, 0.18);
        opacity: 1;
        transition: background 0.2s ease, width 0.2s ease;
      }
      .banner-slider .swiper-pagination-bullet-active {
        background: var(--color-gold, #4E018F);
        width: 44px;
      }
      @media (max-width: 768px) {
        .banner-slider .banner-slide { aspect-ratio: 4 / 5; min-height: 380px; }
        .banner-slider .banner-overlay { background: linear-gradient(180deg, rgba(28,28,28,0) 30%, rgba(28,28,28,0.7) 100%); align-items: flex-end; }
        .banner-slider .banner-text { padding: 1.5rem 1.25rem; }
        .banner-slider .slider-header { align-items: flex-start; }
        .banner-slider .slider-nav { display: none; }
      }
    `;
    document.head.appendChild(style);
  }

  if (typeof Swiper === 'undefined') {
    const swiperJS = document.createElement('script');
    swiperJS.src = 'vendor/swiper-bundle.min.js';
    swiperJS.onload = initSlider;
    document.head.appendChild(swiperJS);
  } else {
    initSlider();
  }

  function initSlider() {
    const slides = [
      {
        image: 'images/scenes/hero-carga.jpg',
        alt: 'Semi truck fitted with CantuPneus truck tires',
        eyebrow: 'Truck Line',
        title: 'Truck Line: guaranteed turnover',
        desc: 'Lug and rib patterns in the fastest-moving sizes, with stock checked per distribution center.',
        cta: 'View Truck line',
        href: '#collections'
      },
      {
        image: 'images/scenes/operacao-estoque.jpg',
        alt: 'Tire stock at the distribution center',
        eyebrow: 'CantuPneus Operations',
        title: 'Importer stock, 24-hour delivery',
        desc: 'We buy straight from the factory and deliver to carriers, resellers and fleet owners with no middlemen along the way.',
        cta: 'See the operation',
        href: '#collections'
      },
      {
        image: 'images/scenes/linha-agricola.jpg',
        alt: 'Agricultural tractor tire',
        eyebrow: 'Dedicated service',
        title: 'Talk to a CantuPneus advisor',
        desc: 'A dedicated advisor to build your order, check availability per branch and unlock credit for active companies.',
        cta: 'Talk to an advisor',
        href: '#contact'
      }
    ];

    const slidesMarkup = slides.map(slide => `
      <div class="swiper-slide">
        <div class="banner-slide">
          <img src="${slide.image}" alt="${slide.alt}">
          <div class="banner-overlay">
            <div class="banner-text">
              <span class="banner-eyebrow">${slide.eyebrow}</span>
              <h3 class="banner-title">${slide.title}</h3>
              <p class="banner-desc">${slide.desc}</p>
              <a class="banner-cta" href="${slide.href}" data-widget="CantuPneus Highlights" data-slide="${slide.title}">
                ${slide.cta}
                <span aria-hidden="true">→</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    `).join('');

    const sliderSection = document.createElement('section');
    sliderSection.className = 'section banner-slider';
    sliderSection.id = SECTION_ID;
    sliderSection.innerHTML = `
      <div class="container">
        <div class="slider-header">
          <div class="slider-header-content">
            <span class="section-subtitle">Highlights of the week</span>
            <h2 class="h2 section-title">CantuPneus stock highlights</h2>
          </div>
          <div class="slider-nav">
            <button class="slider-btn slider-prev" type="button" aria-label="Previous slide">
              <ion-icon name="chevron-back-outline"></ion-icon>
            </button>
            <button class="slider-btn slider-next" type="button" aria-label="Next slide">
              <ion-icon name="chevron-forward-outline"></ion-icon>
            </button>
          </div>
        </div>
        <div class="swiper bannerSwiper">
          <div class="swiper-wrapper">
            ${slidesMarkup}
          </div>
          <div class="swiper-pagination"></div>
        </div>
      </div>
    `;

    anchor.insertAdjacentElement('beforebegin', sliderSection);

    sliderSection.querySelectorAll('.banner-cta').forEach(cta => {
      cta.addEventListener('click', function() {
        const slideTitle = this.getAttribute('data-slide') || '';
        if (typeof window.dataLayer !== 'undefined') {
          window.dataLayer.push({
            event: 'dengage',
            actionType: 'highlight-banner-click',
            widgetName: 'CantuPneus Highlights Slider',
            category: 'Inline Scenarios',
            slideName: slideTitle
          });
        }
      });
    });

    setTimeout(() => {
      if (typeof Swiper !== 'undefined') {
        new Swiper('#' + SECTION_ID + ' .bannerSwiper', {
          loop: true,
          spaceBetween: 24,
          slidesPerView: 1,
          autoplay: { delay: 5000, disableOnInteraction: false },
          pagination: { el: '#' + SECTION_ID + ' .swiper-pagination', clickable: true },
          navigation: {
            nextEl: '#' + SECTION_ID + ' .slider-next',
            prevEl: '#' + SECTION_ID + ' .slider-prev'
          }
        });
      } else {
        console.warn('sliderBanner: Swiper library not loaded');
      }
    }, 200);
  }
}

window.showSliderBanner = sliderBanner;

/* Sem execução automática no carregamento: o Mega Banner é um cenário de
   demonstração e só entra na página quando o botão do catálogo chama
   showSliderBanner(). Com o auto-run antigo a seção já estava na página
   antes do clique, então o clique não tinha efeito visível nenhum. */
