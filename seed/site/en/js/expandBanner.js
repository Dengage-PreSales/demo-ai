function ExpandBanner() {
if (!document.querySelector("#min-bar-container")) {
    let animateLink = document.createElement("link");
    animateLink.rel = "stylesheet";
    animateLink.href = "vendor/animate.min.css";
    animateLink.onload = initSwiper;
  
    document.head.append(animateLink);
  
    function initSwiper() {
      const swiperJS = document.createElement("script");
      swiperJS.src = "vendor/swiper-bundle.min.js";
  
      const swiperCSS = document.createElement("link");
      swiperCSS.rel = "stylesheet";
      swiperCSS.href = "vendor/swiper-bundle.min.css";
  
      document.head.append(swiperJS);
      document.head.append(swiperCSS);
  
      swiperJS.onload = setTimeout(initMinBar, 1000);
    }
  
    const isDesktop = window.innerWidth > 768;

    const CONFIG = {
      logo: "vendor/assets/dengage-logo-dark.svg",
      brand: "CantuPneus",
    };

    const MAX_BAR_CONFIG = [];

    // Trucker Week, 25% na linha de carga
    MAX_BAR_CONFIG.push({
      type: "banner",
      coupon: "CARRETEIRO25",
      desktopImg: "images/scenes/hero-carga.jpg",
      mobileImg: "images/scenes/hero-carga.jpg",
      title: "Trucker Week",
      subtitle: "25% off the truck line all week long.",
      href: null,
    });

    // Campanha Frotista, 20% para frotas cadastradas
    MAX_BAR_CONFIG.push({
      type: "banner",
      coupon: "CANTUFROTA20",
      desktopImg: "images/scenes/operacao-estoque.jpg",
      mobileImg: "images/scenes/operacao-estoque.jpg",
      title: "Campanha Frotista",
      subtitle: "20% off the fastest-moving sizes for registered fleets.",
      href: null,
    });

    // Marshal KLD01 295/80 R22.5, limited release
    MAX_BAR_CONFIG.push({
      type: "banner",
      coupon: "KLD01FRETE",
      desktopImg: "images/scenes/linha-agricola.jpg",
      mobileImg: "images/scenes/linha-agricola.jpg",
      title: "Marshal KLD01 295/80 R22.5, lote limitado",
      subtitle: "CIF freight included on 72-unit orders of the Marshal KLD01.",
      href: null,
    });

    // Complimentary pós-venda
    MAX_BAR_CONFIG.push({
      type: "banner",
      coupon: "CANTUFRETE",
      desktopImg: "images/scenes/linha-agricola.jpg",
      mobileImg: "images/scenes/linha-agricola.jpg",
      title: "Free freight on full loads",
      subtitle: "DOT checks and allocation per distribution center at no extra cost.",
      href: null,
    });

    let MIN_BAR_CONFIG = [
      { text: "✦ CantuPneus Exclusive Offers", href: null, isInitMaxBar: true },
      { text: "Trucker Week: up to 25% off", href: null, isInitMaxBar: true },
      { text: "CIF freight for full-load orders", href: null, isInitMaxBar: true },
    ];

    let isOpened = false;
    function initMinBar() {
      addActionStyles();
  
      const minBarContainer = document.createElement("section");
      minBarContainer.id = "min-bar-container";
      minBarContainer.className = "css-selector";
  
      const minBar = document.createElement("div");
      minBar.id = "dng-min-bar";
  
      let swiperHTML = "";
  
      MIN_BAR_CONFIG.forEach((item) => {
        swiperHTML += `<div class="swiper-slide">${item.href ? `<a href="${item.href}" target="_blank"> ${item.text}</a>` : item.text}</div>`;
      });
  
      minBar.innerHTML = `
                  <span class="dng-min-bar_close">&#10005;</span>
                  <div class="dng-min-bar-swiper-container">
                    <div class="swiper-wrapper">${swiperHTML}</div>
                  </div>
                `;
  
      document.body.append(minBarContainer);
      minBarContainer.append(minBar);

      const swiper = new Swiper(".dng-min-bar-swiper-container", {
        direction: "vertical",
        loop: true,
        autoplay: {
          delay: 4000,
          disableOnInteraction: false,
        },
        speed: 1000,
      });
  
  
      minBar.addEventListener("click", (e) => {
        if (!e.target.classList.contains("dng-min-bar_close")) {
          if (e.target.href) {
            window.location.href = e.target.href;
          } else {
            if (!isOpened) {
              initMaxBar();
            } else {
              document.querySelector("#max-bar-container").style.display = "block";
              isOpened = !isOpened;
            }
          }
        } else if (e.target.classList.contains("dng-min-bar_close")) {
          minBarContainer.style.display = "none";
        }
      });
  
      minBar.querySelector(".dng-min-bar_close").addEventListener("click", function (e) {
        e.stopPropagation();
        minBarContainer.style.display = "none";
      });
    }
  
    function initMaxBar() {
      document.body.style.overflow = "hidden";
      const maxBarContainer = document.createElement("section");
      maxBarContainer.id = "max-bar-container";
      maxBarContainer.innerHTML = `<div class="dng-top-bar_up">
        <img class="dng-max-bar_logo" src=${CONFIG.logo} /><span class="dng-max-bar_close dng-close-btn">&#10005;</span>
        </div>`;
  
      let _downHTML = "";
  
      function buildOverlay(item) {
        if (!item.title && !item.subtitle) return "";
        return `
          <div class="dng-campaign-overlay">
            ${item.title ? `<span class="dng-campaign-title">${item.title}</span>` : ""}
            ${item.subtitle ? `<span class="dng-campaign-subtitle">${item.subtitle}</span>` : ""}
          </div>
        `;
      }

      for (let el = 0; el < MAX_BAR_CONFIG.length; el++) {
        const currentElement = MAX_BAR_CONFIG[el];
        const overlay = buildOverlay(currentElement);
        const altText = currentElement.title || "Campanha CantuPneus";
        if (currentElement.type === "banner") {
          if (currentElement.href && currentElement.coupon) {
            _downHTML += `
              <div class="dng-campaign-wrapper" style='cursor:pointer;' data-coupon-code="${currentElement.coupon}">
                <a href="${currentElement.href}">
                  <picture>
                    <source media="(max-width:768px)" srcset="${currentElement.mobileImg}">
                    <img class="dng-campaign-banner" src="${currentElement.desktopImg}" alt="${altText}">
                  </picture>
                </a>
                ${overlay}
                <div class='dng-max-copy-btn'>Copy Code</div>
              </div>
            `;
          } else if (currentElement.href) {
            _downHTML += `
              <div class="dng-campaign-wrapper" style='cursor:pointer;'>
                <a href="${currentElement.href}">
                  <picture>
                    <source media="(max-width:768px)" srcset="${currentElement.mobileImg}">
                    <img class="dng-campaign-banner" src="${currentElement.desktopImg}" alt="${altText}">
                  </picture>
                </a>
                ${overlay}
              </div>
            `;
          } else if (currentElement.coupon) {
            _downHTML += `
              <div class="dng-campaign-wrapper" data-coupon-code="${currentElement.coupon}">
                <picture>
                  <source media="(max-width:768px)" srcset="${currentElement.mobileImg}">
                  <img class="dng-campaign-banner" src="${currentElement.desktopImg}" alt="${altText}">
                </picture>
                ${overlay}
                <div class='dng-max-copy-btn'>Copy Code</div>
              </div>
            `;
          } else {
            _downHTML += `
              <div class="dng-campaign-wrapper">
                <picture>
                  <source media="(max-width:768px)" srcset="${currentElement.mobileImg}">
                  <img class="dng-campaign-banner" src="${currentElement.desktopImg}" alt="${altText}">
                </picture>
                ${overlay}
              </div>
            `;
          }
        } else {
          _downHTML += `
            <div class="dng-campaign-wrapper" data-type="${currentElement.type}" data-order="${el}">
            </div>
          `;
        }
      }
  
      const downPart = document.createElement("div");
      downPart.className = "dng-max-bar_down";
  
      downPart.innerHTML = _downHTML;
      maxBarContainer.append(downPart);
      document.body.append(maxBarContainer);
  
      downPart.addEventListener("click", function (e) {
        if (e.target.closest(".dng-campaign-wrapper")) {
          let clickedWrapper = e.target.closest(".dng-campaign-wrapper");
          if (clickedWrapper.querySelector("a") && !clickedWrapper.dataset.couponCode) {
            return;
          }
          if (e.target.classList.contains("dng-max-copy-btn")) {
            let coupon = clickedWrapper.dataset.couponCode;
            copyCoupon(coupon);
            e.target.innerText = "Copied";
            e.target.classList.add("dng-max-copy-btn--copied");

            if (typeof window.dataLayer !== 'undefined') {
              window.dataLayer.push({
                event: 'dengage',
                actionType: 'expand-banner-copy',
                widgetName: 'CantuPneus Expand Banner',
                category: 'Inline Scenarios',
                couponCode: coupon
              });
            }
          }
        }
      });
  
      function copyCoupon(coupon) {
        if (!navigator.clipboard) {
          var elem = document.createElement("textarea");
          document.body.appendChild(elem);
          elem.value = coupon;
          elem.select();
          document.execCommand("copy");
          document.body.removeChild(elem);
        } else {
          navigator.clipboard.writeText(coupon);
        }
      }
  
      maxBarContainer.querySelector(".dng-max-bar_close").addEventListener("click", function () {
        maxBarContainer.remove();
        document.body.style.overflow = "unset";
        document.body.style.overflowX = "hidden";
      });
  
      MAX_BAR_CONFIG.forEach((el, index) => {
        if (el.type === "function") {
          addCouponBanner(el.type, index);
        }
      });
    }
  
    function addActionStyles() {
      const actionStyle = document.createElement("style");
      actionStyle.innerHTML = `
      
      :root {
        --cantupneus-gold: #4E018F;
        --cantupneus-gold-light: #4E018F;
        --cantupneus-gold-dark: #35015F;
        --cantupneus-charcoal: #1A1030;
        --cantupneus-cream: #F6F4FA;
        --cantupneus-ivory: #EDE9F5;
      }
      
      
      #min-bar-container {
        position: fixed !important;
        bottom: 30px;
        left: 50%;
        cursor: pointer;
        -webkit-transform: translateX(-50%);
        -ms-transform: translateX(-50%);
        transform: translateX(-50%);
        z-index: 90;
        font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      
         -webkit-animation: relatedModalBanner 6s ease infinite, slideUpBanner 1s forwards;
           -moz-animation: relatedModalBanner 6s ease infinite, slideUpBanner 1s forwards;
           animation: relatedModalBanner 6s ease infinite, slideUpBanner 1s forwards;
      }
      
      @keyframes slideUpBanner {
           from {
               bottom: -100px;
           }
           to {
               bottom: ${isDesktop ? "30px" : "60px"};
           }
       }
      
      .css-selector {
          background: linear-gradient(270deg, #1A1030 0%, #3A3A3A 45%, #35015F 100%);
          background-size: 400% 400%;
          border-radius: 999px;
          box-shadow: 0 12px 30px rgba(28, 28, 28, 0.28), 0 0 0 1px rgba(184, 134, 11, 0.35) inset;
      }
      
       
      
      @-webkit-keyframes relatedModalBanner {
          0%{background-position:0% 50%}
          50%{background-position:100% 50%}
          100%{background-position:0% 50%}
      }
      @-moz-keyframes relatedModalBanner {
          0%{background-position:0% 50%}
          50%{background-position:100% 50%}
          100%{background-position:0% 50%}
      }
      @keyframes relatedModalBanner {
          0%{background-position:0% 50%}
          50%{background-position:100% 50%}
          100%{background-position:0% 50%}
      }
      
      #dng-min-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px;
        font-size: 14px;
        overflow: hidden;
      }
      
      .dng-min-bar_close {
        cursor: pointer;
      }
      
      
      
      #sliding-text-content {
        display: inline-block;
        opacity: 0;
      }
      
      .slide-in {
        animation: slideIn 300ms forwards;
      }
      
      .slide-out {
        animation: slideOut 300ms forwards;
      }
      
      @keyframes slideIn {
        0% {
          transform: translateY(100%);
          opacity: 0;
        }
        100% {
          transform: translateY(0);
          opacity: 1;
        }
      }
      
      @keyframes slideOut {
        0% {
          transform: translateY(0);
          opacity: 1;
        }
        100% {
          transform: translateY(-100%);
          opacity: 0;
        }
      }
      
      
      #dng-min-bar {
        display: -webkit-box !important;
        display: -ms-flexbox !important;
        display: flex !important;
        -webkit-box-align: center;
        -ms-flex-align: center;
        align-items: center;
        -webkit-box-pack: center;
        -ms-flex-pack: center;
        justify-content: center;
        height: 56px;
        width: 471px;
        font-size: 15px;
        font-weight: 600;
        letter-spacing: 0.04em;
        color: var(--cantupneus-cream);
        border-radius: 999px;
        user-select: none;

        -webkit-animation: slideInUp;
        -moz-animation: slideInUp;
        -o-animation: slideInUp;
        animation: slideInUp;
        animation-duration: 300ms;
      }

      #dng-min-bar .dng-min-bar_close {
        font-size: 15px;
        left: 30px;
        position: absolute;
        z-index: 999999999;
        color: var(--cantupneus-gold-light);
        opacity: 0.85;
      }
      #dng-min-bar .dng-min-bar_close:hover { opacity: 1; }

      #max-bar-container {
        padding: 20px 0px;
        width: 100%;
        height: 100%;
        position: fixed;
        z-index: 1000000;
        background-color: var(--cantupneus-cream);
        font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: var(--cantupneus-charcoal);
        display: -webkit-box;
        display: -ms-flexbox;
        display: flex;
        -webkit-box-orient: vertical;
        -webkit-box-direction: normal;
        -ms-flex-direction: column;
        flex-direction: column;
        align-items: center;
        top: 0;
        left: 0;

        -webkit-animation: slideInUp;
        -moz-animation: slideInUp;
        -o-animation: slideInUp;
        animation: slideInUp;
        animation-duration: 300ms;
      }
      
      #max-bar-container .dng-top-bar_up {
        display: -webkit-box;
        display: -ms-flexbox;
        display: flex;
        -webkit-box-pack: center;
        -ms-flex-pack: center;
        justify-content: center;
        -webkit-box-align: center;
        -ms-flex-align: center;
        align-items: center;
        height: 120px;
        width: 100%;
      }
      
      #max-bar-container .dng-top-bar_up {
        border-bottom: 1px solid rgba(184, 134, 11, 0.18);
      }

      #max-bar-container .dng-top-bar_up .dng-max-bar_close {
        right: 1rem;
        top: 2rem;
        position: absolute;
        font-size: 30px;
        user-select: none;
        color: var(--cantupneus-charcoal);
        cursor: pointer;
        transition: color 0.2s ease, transform 0.2s ease;
      }
      #max-bar-container .dng-top-bar_up .dng-max-bar_close:hover {
        color: var(--cantupneus-gold-dark);
        transform: scale(1.05);
      }

      #max-bar-container .dng-top-bar_up .dng-max-bar_logo {
        width: 220px;
        top: 40px;
        filter: brightness(0.2);
      }
      
      #max-bar-container .dng-max-bar_down {
          padding: 30px 15%;
          box-sizing: border-box;
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          justify-items: center;
          align-items: center;
          max-width: calc(1220px + 30%);
          margin: 0 auto;
          position: relative;
          column-gap: 2rem;
          row-gap: 2rem;
          overflow-y: auto;
          overflow-x: hidden;
      }
      
      ::-webkit-scrollbar {
        width: 0px;
        background: transparent;
      }
      
      
      
      .dng-max-copy-btn{
        position: absolute;
        background: var(--cantupneus-cream);
        color: var(--cantupneus-charcoal);
        bottom: 14px;
        right: 14px;
        padding: 9px 18px;
        border-radius: 999px;
        cursor: pointer;
        font-weight: 700;
        font-size: 11px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        border: 1px solid var(--cantupneus-cream);
        box-shadow: 0 6px 16px rgba(28, 28, 28, 0.25);
        z-index: 3;
        transition: background 0.2s ease, color 0.2s ease;
      }
      .dng-max-copy-btn:hover{
        background: var(--cantupneus-gold-dark);
        color: var(--cantupneus-cream);
        border-color: var(--cantupneus-gold-dark);
      }
      .dng-max-copy-btn--copied{
        background: var(--cantupneus-gold);
        color: var(--cantupneus-cream);
        border-color: var(--cantupneus-gold);
      }

      #max-bar-container .dng-max-bar_down .dng-campaign-wrapper {
        width: 600px;
        display: block;
        height: 270px;
        position: relative;
        overflow: hidden;
        border-radius: 14px;
        box-shadow: 0 14px 32px rgba(28, 28, 28, 0.18);
        border: 1px solid rgba(184, 134, 11, 0.16);
        background: var(--cantupneus-ivory);
      }

      .dng-campaign-banner {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 0.4s ease;
      }

      .dng-campaign-wrapper:hover .dng-campaign-banner {
        transform: scale(1.05);
      }

      .dng-campaign-overlay {
        position: absolute;
        inset: 0;
        background: linear-gradient(115deg, rgba(28,28,28,0.7) 0%, rgba(28,28,28,0.4) 40%, rgba(28,28,28,0) 70%);
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        align-items: flex-start;
        padding: 22px 26px;
        gap: 6px;
        color: var(--cantupneus-cream);
        pointer-events: none;
        z-index: 2;
      }
      .dng-campaign-title {
        font-family: "Barlow Condensed", Georgia, serif;
        font-size: 22px;
        font-weight: 500;
        line-height: 1.2;
      }
      .dng-campaign-subtitle {
        font-size: 13px;
        line-height: 1.5;
        color: rgba(255, 251, 245, 0.85);
        max-width: 75%;
      }
      .dng-campaign-wrapper a { display: block; height: 100%; }
      
      .dng-min-bar-swiper-container {
           position: relative;
           width: 100%;
           height: 60px;
           overflow: hidden;
       }
       
       .dng-min-bar-swiper-container .swiper-wrapper {
           display: flex;
           flex-direction: column;
           height: 100%;
       }
       
       .dng-min-bar-swiper-container .swiper-wrapper .swiper-slide {
           width: 100%;
           display: flex;
           align-items: center;
           justify-content: center;
           height: 100%;
           text-align: center;
           flex-direction: column;
       }
       
       .dng-min-bar-swiper-container .swiper-wrapper .swiper-slide a {
           text-decoration: none;
           color: var(--cantupneus-gold-light);
       }
       .dng-min-bar-swiper-container .swiper-wrapper .swiper-slide a:hover { color: var(--cantupneus-cream); }
       
      
      
      @media (max-width: 1228px) {
        #max-bar-container .dng-max-bar_down {
          max-width: calc(1025px + 30%);
        }
      
        #max-bar-container .dng-max-bar_down .dng-campaign-wrapper {
          width: 500px;
          height: 225px;
          border-radius: 6px;
        }
      
        #dng-coupon-info {
          gap: 1em;
        }
      
        #dng-coupon-info .dng-coupon-wrapper .dng-coupon-container {
          background-size: 100% 100%;
          width: 85%;
          height: 85%;
        }
      
        #dng-coupon-info .dng-coupon-bottom {
          width: 100%;
          gap: unset;
        }
      
        #dng-coupon-info .dng-coupon-wrapper {
          gap: 0.5rem;
          width: 100%;
          height: auto;
        }
      
        #dng-coupon-info .dng-coupon-header span:nth-child(2) {
          font-size: 25px;
        }
      
        #dng-coupon-info .dng-coupon-wrapper .dng-coupon-container .dng-coupon-mid-text {
          font-size: 20px;
        }
      
        #dng-coupon-info .dng-coupon-wrapper button {
          line-height: 10px;
        }
      }
      
      @media (max-width: 1024px) {
        #max-bar-container .dng-max-bar_down {
          grid-template-columns: 1fr;
          padding: 25px 10%;
        }
        
        #max-bar-container .dng-max-bar_down .dng-campaign-wrapper {
          width: 100%;
          max-width: 600px;
        }
      }
      
      @media (max-width: 768px) {
      
      .css-selector { border-radius: 15px 15px 0 0 !important;}
      
      .page-up.active{
      display:none;
      }
          .scroll-to-top, .scroll-to-top.active {
              display: none;
          }
      #min-bar-container {
        bottom:  "68px";
        width: 80%;
        }
      
      #dng-min-bar{
          width: 100% !important;
          font-size: 20px;
          border-radius: 15px 15px 0 0;
          transition: all 0.3s linear;
        }
      
        #dng-min-bar .dng-min-bar_close {
          left:20px;
        }
      
        .sliding-text {
          width: 66%;
          text-align: center;
      }
      
        #dng-coupon-info {
          border-radius: 7px;
          padding: 1em 0.5em;
          max-width: 330px;
          -webkit-box-pack: justify;
          -ms-flex-pack: justify;
          justify-content: space-around;
          gap: 0em;
        }
      
        #max-bar-container .dng-max-bar_down {
          padding: 20px 5%;
          grid-template-columns: 1fr;
          column-gap: 1rem;
          row-gap: 1rem;
        }
        
        #max-bar-container .dng-max-bar_down .dng-campaign-wrapper {
          width: 100%;
          max-width: 100%;
          height: 225px;
        }
      
        #max-bar-container .dng-top-bar_up .dng-max-bar_logo {
        width: 150px;
        top: 26px;
        position: absolute;
      }
      
      #max-bar-container .dng-top-bar_up{
      }
      
      #max-bar-container .dng-top-bar_up .dng-max-bar_close{
        top: 30px;
        font-size: 22px;
      }
      
      .dng-max-copy-btn{
      bottom: 12px;
      right: 12px;
      font-size: 10px;
      padding: 8px 14px;
        }

      .dng-campaign-overlay {
        padding: 16px 18px;
        background: linear-gradient(180deg, rgba(28,28,28,0) 35%, rgba(28,28,28,0.75) 100%);
      }
      .dng-campaign-title { font-size: 19px; }
      .dng-campaign-subtitle { font-size: 12px; max-width: 100%; }
      
      }
      
      `;
      document.head.append(actionStyle);
    }
  }
  


}