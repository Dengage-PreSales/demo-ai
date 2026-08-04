/* Inline Scenario: CantuPneus premium head banner */
(function () {
    "use strict";

    function initHeadBanner() {
        if (document.getElementById("cantupneus-head-banner")) return;
        var siteHeader = document.querySelector(".site-header");
        if (!siteHeader || !siteHeader.parentNode) return;

        if (!document.getElementById("cantupneus-head-banner-styles")) {
            var style = document.createElement("style");
            style.id = "cantupneus-head-banner-styles";
            style.textContent = [
                "#cantupneus-head-banner{position:fixed;top:0;left:0;right:0;width:100%;background:linear-gradient(135deg,#1a1030 0%,#35015f 52%,#4e018f 100%);color:#fff;padding:10px 16px;z-index:1100;box-shadow:0 8px 24px rgba(139,105,20,.28);font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}",
                ".cantupneus-head-banner-inner{max-width:1400px;margin:0 auto;display:flex;gap:14px;align-items:center;justify-content:center;flex-wrap:wrap;text-align:center;}",
                ".cantupneus-head-banner-badge{background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.24);padding:4px 10px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;}",
                ".cantupneus-head-banner-title{font-family:'Barlow Condensed',Georgia,serif;font-size:20px;font-weight:500;letter-spacing:.02em;}",
                ".cantupneus-head-banner-text{font-size:13px;opacity:.92;}",
                ".cantupneus-head-banner-link{color:#1a1030;text-decoration:none;background:#f6f4fa;padding:7px 14px;border-radius:999px;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;}",
                ".cantupneus-head-banner-close{position:absolute;right:14px;top:50%;transform:translateY(-50%);width:26px;height:26px;border:1px solid rgba(255,255,255,.3);border-radius:50%;background:rgba(255,255,255,.12);color:#fff;cursor:pointer;line-height:1;font-size:16px;}",
                "@media (max-width:768px){#cantupneus-head-banner{padding:9px 42px 9px 12px}.cantupneus-head-banner-inner{gap:8px}.cantupneus-head-banner-title{font-size:17px}.cantupneus-head-banner-text{font-size:12px}.cantupneus-head-banner-link{padding:6px 11px;font-size:11px}}"
            ].join("\n");
            document.head.appendChild(style);
        }

        var banner = document.createElement("div");
        banner.id = "cantupneus-head-banner";

        banner.innerHTML =
            '<div class="cantupneus-head-banner-inner">' +
            '<span class="cantupneus-head-banner-badge">Offer of the week</span>' +
            '<span class="cantupneus-head-banner-title">CantuPneus Trucker Week</span>' +
            '<span class="cantupneus-head-banner-text">Special terms on full loads and CIF freight to served state capitals.</span>' +
            '<a class="cantupneus-head-banner-link" href="#contact">Talk to an advisor</a>' +
            "</div>" +
            '<button class="cantupneus-head-banner-close" type="button" aria-label="Close">&times;</button>';

        siteHeader.parentNode.insertBefore(banner, siteHeader);

        function updateHeaderOffset() {
            siteHeader.style.top = banner.offsetHeight + "px";
        }

        updateHeaderOffset();
        window.addEventListener("resize", updateHeaderOffset);

        banner.querySelector(".cantupneus-head-banner-close").addEventListener("click", function () {
            window.removeEventListener("resize", updateHeaderOffset);
            banner.remove();
            siteHeader.style.top = "";
        });
    }

    window.showHeadBanner = initHeadBanner;
})();
