
function carouselBanner() {

  var CONTAINER_ID = "cantupneus-carousel-inapp-container";
  var STYLE_ID = "cantupneus-carousel-inapp-styles";

  var defaultSlides = [
    {
      image: "images/scenes/hero-carga.jpg",
      title: "Truck Line",
      description: "Lug, rib and mixed patterns for heavy highway and rough surfaces.",
      alt: "Truck tires stacked at the distribution center"
    },
    {
      image: "images/scenes/story-frota.jpg",
      title: "Marshal KLD01 295/80 R22.5",
      description: "Marshal KLD01 295/80 R22.5 lug tire in stock at five distribution centers.",
      alt: "CantuPneus passenger tire"
    },
    {
      image: "images/scenes/linha-agricola.jpg",
      title: "Industrial & OTR Line",
      description: "Wheel loader, forklift and OTR with reinforced casing for continuous operation.",
      alt: "Industrial and OTR tires"
    },
    {
      image: "images/scenes/linha-carga.jpg",
      title: "Truck Line",
      description: "A dedicated advisor to build your order and check availability per branch.",
      alt: "Heavy-duty truck tires"
    },
    {
      image: "images/scenes/linha-otr.jpg",
      title: "Statement Pieces",
      description: "R1 and R1W lugs for tractors, harvesters and implements, in stock across all regions.",
      alt: "Agricultural tires"
    },
    {
      image: "images/scenes/linha-agricola.jpg",
      title: "Agricultural Line",
      description: "Simulate a full load, lock the price and track delivery right on the portal.",
      alt: "Agricultural tractor tires"
    }
  ];

  var config = {
    headerTitle: "CantuPneus Highlights of the week",
    slides: defaultSlides
  };

  var currentSlide = 0;
  var slidesEl = null;
  var indicatorsEl = null;
  var totalSlides = 0;

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      ".cantupneus-carousel-overlay { position: fixed; inset: 0; min-height: 100svh; padding: 16px; display: grid; place-items: center; background: radial-gradient(circle at center, rgba(212, 168, 83, 0.18), rgba(28, 28, 28, 0.55)); z-index: 100020; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }",
      ".cantupneus-carousel-overlay.hidden { display: none !important; }",
      ".cantupneus-carousel-popup { position: relative; width: min(100%, 760px); border-radius: 18px; overflow: hidden; background: #f6f4fa; box-shadow: 0 20px 60px rgba(28, 28, 28, 0.32); border: 1px solid rgba(184, 134, 11, 0.22); }",
      ".cantupneus-carousel-header { background: linear-gradient(135deg, #1A1030 0%, #35015F 58%, #4E018F 100%); border-bottom: 3px solid #4E018F; color: #F6F4FA; text-align: center; padding: 16px 56px 16px 16px; font-family: 'Barlow Condensed', Georgia, serif; font-size: 22px; font-weight: 500; letter-spacing: 0.04em; }",
      ".cantupneus-carousel-close { position: absolute; top: 12px; right: 12px; width: 34px; height: 34px; border: 1px solid rgba(255,255,255,0.35); border-radius: 50%; background: rgba(28,28,28,0.5); color: #fff; font-size: 16px; cursor: pointer; z-index: 20; line-height: 1; display: flex; align-items: center; justify-content: center; transition: background 0.2s ease; }",
      ".cantupneus-carousel-close:hover { background: rgba(28,28,28,0.75); }",
      ".cantupneus-carousel-container { position: relative; overflow: hidden; background: #f6f4fa; }",
      ".cantupneus-carousel-slides { display: flex; transition: transform 0.35s ease; will-change: transform; touch-action: pan-y; }",
      ".cantupneus-carousel-slide { min-width: 100%; padding: 18px; text-align: center; box-sizing: border-box; }",
      ".cantupneus-carousel-slide img { width: 100%; aspect-ratio: 1024/768; object-fit: cover; border-radius: 12px; display: block; background: #ede9f5; box-shadow: 0 8px 22px rgba(28,28,28,0.15); }",
      ".cantupneus-carousel-slide h3 { margin: 16px 0 8px; color: #1A1030; font-family: 'Barlow Condensed', Georgia, serif; font-size: 26px; font-weight: 500; line-height: 1.2; letter-spacing: 0.01em; }",
      ".cantupneus-carousel-slide p { margin: 0 auto; max-width: 540px; color: #3A3A3A; font-size: 15px; line-height: 1.55; min-height: 44px; }",
      ".cantupneus-carousel-nav { position: absolute; top: 50%; transform: translateY(-50%); width: 42px; height: 42px; border: 1px solid rgba(184,134,11,0.45); border-radius: 50%; background: rgba(255,251,245,0.92); color: #35015F; font-size: 22px; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 10; transition: background 0.2s ease, color 0.2s ease; }",
      ".cantupneus-carousel-nav:hover { background: #1A1030; color: #4E018F; border-color: #1A1030; }",
      ".cantupneus-carousel-nav.prev { left: 12px; } .cantupneus-carousel-nav.next { right: 12px; }",
      ".cantupneus-carousel-indicators { display: flex; justify-content: center; gap: 8px; padding: 4px 0 20px; background: #f6f4fa; }",
      ".cantupneus-carousel-dot { width: 10px; height: 10px; border-radius: 50%; background: #d9cdb8; cursor: pointer; transition: background-color 0.25s ease, transform 0.25s ease; }",
      ".cantupneus-carousel-dot.active { background: #4E018F; transform: scale(1.15); }",
      "@media (max-width: 768px) { .cantupneus-carousel-overlay { padding: 10px; } .cantupneus-carousel-popup { border-radius: 14px; } .cantupneus-carousel-header { font-size: 18px; padding: 14px 50px 14px 14px; } .cantupneus-carousel-slide { padding: 12px; } .cantupneus-carousel-slide h3 { font-size: 21px; } .cantupneus-carousel-slide p { font-size: 13px; min-height: 38px; } .cantupneus-carousel-nav { width: 36px; height: 36px; font-size: 19px; } }"
    ].join("\n");
    document.head.appendChild(style);
  }

  function buildSlidesHTML(slides) {
    if (!slides || !slides.length) return "";
    return slides
      .map(function (s) {
        var img = s.image || "";
        var alt = s.alt != null ? s.alt : "CantuPneus Highlight";
        var title = s.title != null ? s.title : "";
        var desc = s.description != null ? s.description : "";
        return (
          '<div class="cantupneus-carousel-slide">' +
          '<img src="' + img + '" alt="' + alt + '">' +
          "<h3>" + title + "</h3>" +
          "<p>" + desc + "</p>" +
          "</div>"
        );
      })
      .join("");
  }

  function ensureDOM() {
    if (document.getElementById(CONTAINER_ID)) return;
    injectStyles();
    var overlay = document.createElement("div");
    overlay.id = CONTAINER_ID;
    overlay.className = "cantupneus-carousel-overlay hidden";
    overlay.setAttribute("aria-hidden", "true");
    var slides = config.slides || defaultSlides;
    var slidesHTML = buildSlidesHTML(slides);
    overlay.innerHTML =
      '<div class="cantupneus-carousel-popup">' +
      '<button class="cantupneus-carousel-close" aria-label="Close" type="button">&#10005;</button>' +
      '<div class="cantupneus-carousel-header">' + (config.headerTitle || "CantuPneus Highlights of the week") + "</div>" +
      '<div class="cantupneus-carousel-container">' +
      '<button class="cantupneus-carousel-nav prev" aria-label="Previous" type="button">&#8249;</button>' +
      '<div class="cantupneus-carousel-slides">' + slidesHTML + "</div>" +
      '<button class="cantupneus-carousel-nav next" aria-label="Next" type="button">&#8250;</button>' +
      "</div>" +
      '<div class="cantupneus-carousel-indicators"></div>' +
      "</div>";
    document.body.appendChild(overlay);

    slidesEl = overlay.querySelector(".cantupneus-carousel-slides");
    indicatorsEl = overlay.querySelector(".cantupneus-carousel-indicators");
    totalSlides = slidesEl ? slidesEl.children.length : 0;

    overlay.querySelector(".cantupneus-carousel-close").addEventListener("click", hide);
    overlay.querySelector(".cantupneus-carousel-nav.prev").addEventListener("click", function () { changeSlide(-1); });
    overlay.querySelector(".cantupneus-carousel-nav.next").addEventListener("click", function () { changeSlide(1); });

    var startX = 0,
      endX = 0;
    if (slidesEl) {
      slidesEl.addEventListener("touchstart", function (e) {
        startX = e.changedTouches[0].screenX;
      }, { passive: true });
      slidesEl.addEventListener("touchend", function (e) {
        endX = e.changedTouches[0].screenX;
        var diff = endX - startX;
        if (Math.abs(diff) > 40) changeSlide(diff > 0 ? -1 : 1);
      }, { passive: true });
    }

    createIndicators();
  }

  function createIndicators() {
    if (!indicatorsEl || totalSlides === 0) return;
    var html = "";
    for (var i = 0; i < totalSlides; i++) {
      html += '<span class="cantupneus-carousel-dot' + (i === 0 ? " active" : "") + '" data-index="' + i + '"></span>';
    }
    indicatorsEl.innerHTML = html;
    var dots = indicatorsEl.querySelectorAll(".cantupneus-carousel-dot");
    for (var j = 0; j < dots.length; j++) {
      (function (idx) {
        dots[idx].addEventListener("click", function () {
          goToSlide(idx);
        });
      })(j);
    }
  }

  function updateCarousel() {
    if (!slidesEl) return;
    slidesEl.style.transform = "translateX(-" + currentSlide * 100 + "%)";
    var dots = document.querySelectorAll(".cantupneus-carousel-dot");
    for (var i = 0; i < dots.length; i++) dots[i].classList.remove("active");
    if (dots[currentSlide]) dots[currentSlide].classList.add("active");
  }

  function changeSlide(step) {
    currentSlide = (currentSlide + step + totalSlides) % totalSlides;
    updateCarousel();
  }

  function goToSlide(index) {
    if (index >= 0 && index < totalSlides) {
      currentSlide = index;
      updateCarousel();
    }
  }

  function show() {
    ensureDOM();
    var overlay = document.getElementById(CONTAINER_ID);
    if (overlay) {
      currentSlide = 0;
      updateCarousel();
      overlay.classList.remove("hidden");
      overlay.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    }
  }

  function hide() {
    var overlay = document.getElementById(CONTAINER_ID);
    if (overlay) {
      overlay.classList.add("hidden");
      overlay.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    }
  }

  function init(options) {
    if (options && options.headerTitle != null) config.headerTitle = options.headerTitle;
    if (options && options.slides && options.slides.length) config.slides = options.slides;
    var existing = document.getElementById(CONTAINER_ID);
    if (existing) existing.remove();
    slidesEl = null;
    indicatorsEl = null;
    totalSlides = 0;
  }

  window.CarouselInappPopup = {
    show: show,
    hide: hide,
    init: init
  };

  show();
}
