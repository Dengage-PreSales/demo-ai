
function addIcon() {
    if (!document.querySelector("#dng-notification-container")) {
      const selector = ".nav-main";
  
      const items = [
        {
          title: "Trucker Week: preview",
          description: "Talk to an advisor to build your full load before the campaign opens.",
          url: "#contact",
          icon: "gift",
          type: "buttons", // 2 butonlu tip
          buttons: [
            { text: "Talk to an advisor", url: "#contact", primary: true },
            { text: "View lines", url: "#collections", primary: false }
          ],
          startDate: "Jan 01 2025 00:00",
          endDate: "Dec 31 2026 23:59",
        },
        {
          title: "Marshal KLD01 295/80 R22.5: lote limitado",
          description: "The new Marshal KLD01 295/80 R22.5 batch is available for a limited time.",
          url: "#collections",
          icon: "card",
          type: "countdown", // Sayaçlı tip
          countdownDate: "Dec 31 2026 23:59",
          startDate: "Jan 01 2025 00:00",
          endDate: "Dec 31 2026 23:59",
        },
        {
          title: "Free freight on full loads",
          description: "Simulate a full load and see CIF freight applied to your order.",
          url: "#contact",
          icon: "gift",
          type: "buttons", // 2 butonlu tip
          buttons: [
            { text: "Book Care", url: "#contact", primary: true },
            { text: "View details", url: "#craftsmanship", primary: false }
          ],
          startDate: "Jan 01 2025 00:00",
          endDate: "Dec 31 2026 23:59",
        },
        {
          title: "Full-load simulation",
          description: "Build your agricultural order with advisor support, from quote to farm delivery.",
          url: "#contact",
          icon: "campus",
          type: "countdown", // Sayaçlı tip
          countdownDate: "Dec 25 2026 23:59",
          startDate: "Jan 01 2025 00:00",
          endDate: "Dec 31 2026 23:59",
        },
        {
          title: "View agricultural line",
          description: "Check the fastest-moving passenger sizes, ready for delivery.",
          url: "#collections",
          icon: "card",
          type: "default", // Varsayılan tip (tek buton)
          startDate: "Jan 01 2025 00:00",
          endDate: "Dec 31 2026 23:59",
        },
      ];
      const style = document.createElement("style");
      style.innerHTML = `
                  #dng-notification-container {
                      position: relative;
                      align-self: center;
                      user-select: none;
                      z-index: 9;
                      display: inline-block;
                  }
                  
                  #dng-notification {
                      position: relative;
                      display: flex;
                      justify-content: center;
                      align-items: center;
                      height: 44px;
                      width: 44px;
                      border-radius: 50%;
                      cursor: pointer;
                      user-select: none;
                      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                      background: linear-gradient(135deg, rgba(184, 134, 11, 0.12) 0%, rgba(212, 168, 83, 0.12) 100%);
                      backdrop-filter: blur(10px);
                  }
                  
                  #dng-notification:hover {
                      transform: scale(1.15);
                      background: linear-gradient(135deg, rgba(184, 134, 11, 0.18) 0%, rgba(212, 168, 83, 0.18) 100%);
                      box-shadow: 0 4px 16px rgba(184, 134, 11, 0.3);
                  }
                  
                  .dng-bell {
                      width: auto;
                      height: 40px;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      filter: drop-shadow(0 2px 4px rgba(184, 134, 11, 0.24));
                  }
                  
                  .dng-badge-notify {
                      position: absolute;
                      top: -4px;
                      right: -4px;
                      min-width: 20px;
                      height: 20px;
                      border-radius: 50%;
                      background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
                      color: white;
                      display: flex;
                      justify-content: center;
                      align-items: center;
                      user-select: none;
                      font-size: 11px;
                      font-weight: 700;
                      padding: 0 6px;
                      box-shadow: 0 4px 12px rgba(255, 107, 107, 0.5), 0 0 0 3px rgba(255, 255, 255, 0.9);
                      border: none;
                      animation: pulse 2s infinite;
                  }
                  
                  @keyframes pulse {
                      0%, 100% { transform: scale(1); }
                      50% { transform: scale(1.1); }
                  }
                  
                  #dng-notification-list {
                      position: absolute;
                      width: 470px;
                      max-height: 520px;
                      flex-direction: column;
                      z-index: 99999;
                      background: rgba(255, 255, 255, 0.98);
                      backdrop-filter: blur(20px);
                      -webkit-backdrop-filter: blur(20px);
                      border-radius: 20px;
                      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15), 0 8px 24px rgba(184, 134, 11, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.8);
                      display: none;
                      overflow: hidden;
                      border: 1px solid rgba(184, 134, 11, 0.18);
                  }
                  
                  #dng-notification-header {
                      background: linear-gradient(135deg, #1A1030 0%, #35015F 50%, #4E018F 100%);
                      color: white;
                      padding: 20px 24px;
                      font-weight: 700;
                      font-size: 17px;
                      letter-spacing: 0.3px;
                      display: flex;
                      justify-content: space-between;
                      align-items: center;
                      box-shadow: 0 4px 12px rgba(184, 134, 11, 0.24);
                      position: relative;
                      overflow: hidden;
                  }
                  
                  #dng-notification-header::before {
                      content: '';
                      position: absolute;
                      top: 0;
                      left: 0;
                      right: 0;
                      bottom: 0;
                      background: linear-gradient(45deg, rgba(255, 255, 255, 0.1) 0%, transparent 100%);
                      pointer-events: none;
                  }
                  
                  #dng-notification-list .dng-close-btn {
                      background: rgba(255, 255, 255, 0.25);
                      backdrop-filter: blur(10px);
                      border: 1px solid rgba(255, 255, 255, 0.3);
                      color: white;
                      width: 32px;
                      height: 32px;
                      border-radius: 50%;
                      cursor: pointer;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      font-size: 20px;
                      font-weight: 300;
                      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                      padding: 0;
                      position: relative;
                      z-index: 1;
                  }
                  
                  #dng-notification-list .dng-close-btn:hover {
                      background: rgba(255, 255, 255, 0.4);
                      transform: rotate(90deg) scale(1.1);
                      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
                  }
                  
                  #dng-notification-content {
                      max-height: 420px;
                      overflow-y: auto;
                      padding: 16px;
                      background: linear-gradient(to bottom, transparent, rgba(184, 134, 11, 0.04));
                  }
                  
                  #dng-notification-content::-webkit-scrollbar {
                      width: 8px;
                  }
                  
                  #dng-notification-content::-webkit-scrollbar-track {
                      background: rgba(241, 241, 241, 0.5);
                      border-radius: 10px;
                      margin: 4px 0;
                  }
                  
                  #dng-notification-content::-webkit-scrollbar-thumb {
                      background: linear-gradient(135deg, #35015F 0%, #4E018F 100%);
                      border-radius: 10px;
                      border: 2px solid rgba(255, 255, 255, 0.8);
                      box-shadow: inset 0 1px 0 rgba(0, 0, 0, 0.1);
                  }
                  
                  #dng-notification-content::-webkit-scrollbar-thumb:hover {
                      background: linear-gradient(135deg, #4E018F 0%, #4E018F 100%);
                      box-shadow: 0 2px 8px rgba(184, 134, 11, 0.3);
                  }
                  
                  .dng-notification-item {
                      padding: 18px;
                      margin-bottom: 10px;
                      border-radius: 16px;
                      background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
                      border: 1.5px solid rgba(184, 134, 11, 0.14);
                      cursor: pointer;
                      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                      display: flex;
                      gap: 16px;
                      text-decoration: none;
                      color: inherit;
                      position: relative;
                      overflow: hidden;
                  }
                  
                  .dng-notification-item::before {
                      content: '';
                      position: absolute;
                      top: 0;
                      left: -100%;
                      width: 100%;
                      height: 100%;
                      background: linear-gradient(90deg, transparent, rgba(184, 134, 11, 0.08), transparent);
                      transition: left 0.5s ease;
                  }
                  
                  .dng-notification-item:hover {
                      background: linear-gradient(135deg, #F6F4FA 0%, #EDE9F5 100%);
                      border-color: #4E018F;
                      transform: translateX(6px) translateY(-2px);
                      box-shadow: 0 8px 24px rgba(184, 134, 11, 0.22), 0 4px 12px rgba(184, 134, 11, 0.12);
                  }
                  
                  .dng-notification-item:hover::before {
                      left: 100%;
                  }
                  
                  .dng-notification-item:last-child {
                      margin-bottom: 0;
                  }
                  
                  .dng-notification-icon {
                      flex-shrink: 0;
                      width: 56px;
                      height: 56px;
                      border-radius: 14px;
                      background: linear-gradient(135deg, #F6F4FA 0%, #EDE9F5 50%, #4E018F 100%);
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      border: 2px solid #4E018F;
                      box-shadow: 0 4px 12px rgba(184, 134, 11, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.5);
                      transition: all 0.3s ease;
                      position: relative;
                  }
                  
                  .dng-notification-item:hover .dng-notification-icon {
                      transform: scale(1.1) rotate(5deg);
                      box-shadow: 0 6px 16px rgba(184, 134, 11, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.5);
                  }
                  
                  .dng-notification-icon svg {
                      width: 30px;
                      height: 30px;
                      stroke: #35015F;
                      fill: none;
                      stroke-width: 2.5;
                      filter: drop-shadow(0 2px 4px rgba(184, 134, 11, 0.24));
                  }
                  
                  .dng-notification-text {
                      flex: 1;
                      display: flex;
                      flex-direction: column;
                      gap: 8px;
                  }
                  
                  .dng-notification-title {
                      font-weight: 700;
                      font-size: 15px;
                      color: #1a1a1a;
                      line-height: 1.5;
                      letter-spacing: -0.2px;
                  }
                  
                  .dng-notification-description {
                      font-size: 13px;
                      color: #5a5a5a;
                      line-height: 1.6;
                      font-weight: 400;
                  }
                  
                  .dng-notification-actions {
                      display: flex;
                      gap: 10px;
                      margin-top: 14px;
                      flex-wrap: wrap;
                  }
                  
                  .dng-notification-button {
                      flex: 1;
                      min-width: 130px;
                      padding: 12px 20px;
                      border-radius: 12px;
                      font-size: 13px;
                      font-weight: 700;
                      letter-spacing: 0.3px;
                      border: none;
                      cursor: pointer;
                      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                      text-decoration: none;
                      display: inline-flex;
                      align-items: center;
                      justify-content: center;
                      text-align: center;
                      position: relative;
                      overflow: hidden;
                  }
                  
                  .dng-notification-button::before {
                      content: '';
                      position: absolute;
                      top: 50%;
                      left: 50%;
                      width: 0;
                      height: 0;
                      border-radius: 50%;
                      background: rgba(255, 255, 255, 0.3);
                      transform: translate(-50%, -50%);
                      transition: width 0.6s, height 0.6s;
                  }
                  
                  .dng-notification-button:hover::before {
                      width: 300px;
                      height: 300px;
                  }
                  
                  .dng-notification-button-primary {
                      background: linear-gradient(135deg, #1A1030 0%, #35015F 50%, #4E018F 100%);
                      color: white;
                      box-shadow: 0 4px 14px rgba(184, 134, 11, 0.35), 0 2px 6px rgba(184, 134, 11, 0.2);
                  }
                  
                  .dng-notification-button-primary:hover {
                      transform: translateY(-3px);
                      box-shadow: 0 8px 20px rgba(184, 134, 11, 0.45), 0 4px 10px rgba(184, 134, 11, 0.3);
                  }
                  
                  .dng-notification-button-primary:active {
                      transform: translateY(-1px);
                  }
                  
                  .dng-notification-button-secondary {
                      background: white;
                      color: #35015F;
                      border: 2px solid #4E018F;
                      box-shadow: 0 2px 8px rgba(184, 134, 11, 0.18);
                  }
                  
                  .dng-notification-button-secondary:hover {
                      background: linear-gradient(135deg, #F6F4FA 0%, #EDE9F5 100%);
                      border-color: #4E018F;
                      transform: translateY(-3px);
                      box-shadow: 0 6px 16px rgba(184, 134, 11, 0.25);
                  }
                  
                  .dng-notification-button-secondary:active {
                      transform: translateY(-1px);
                  }
                  
                  .dng-notification-countdown {
                      margin-top: 14px;
                      padding: 14px;
                      background: linear-gradient(135deg, #fff8e1 0%, #ffe082 50%, #ffd54f 100%);
                      border-radius: 12px;
                      border: 2px solid #ffc107;
                      box-shadow: 0 4px 12px rgba(255, 193, 7, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.5);
                      position: relative;
                      overflow: hidden;
                  }
                  
                  .dng-notification-countdown::before {
                      content: '';
                      position: absolute;
                      top: -50%;
                      left: -50%;
                      width: 200%;
                      height: 200%;
                      background: linear-gradient(45deg, transparent, rgba(255, 255, 255, 0.3), transparent);
                      animation: shine 3s infinite;
                  }
                  
                  @keyframes shine {
                      0% { transform: translateX(-100%) translateY(-100%) rotate(45deg); }
                      100% { transform: translateX(100%) translateY(100%) rotate(45deg); }
                  }
                  
                  .dng-countdown-label {
                      font-size: 11px;
                      color: #856404;
                      font-weight: 700;
                      margin-bottom: 8px;
                      text-transform: uppercase;
                      letter-spacing: 1px;
                      text-align: center;
                      position: relative;
                      z-index: 1;
                  }
                  
                  .dng-countdown-timer {
                      display: flex;
                      gap: 10px;
                      justify-content: center;
                      align-items: center;
                      position: relative;
                      z-index: 1;
                  }
                  
                  .dng-countdown-item {
                      display: flex;
                      flex-direction: column;
                      align-items: center;
                      min-width: 50px;
                  }
                  
                  .dng-countdown-value {
                      font-size: 20px;
                      font-weight: 800;
                      color: #1a1a1a;
                      background: linear-gradient(135deg, #ffffff 0%, #f5f5f5 100%);
                      padding: 8px 12px;
                      border-radius: 10px;
                      min-width: 45px;
                      text-align: center;
                      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.8), inset 0 -1px 0 rgba(0, 0, 0, 0.05);
                      border: 1px solid rgba(255, 193, 7, 0.3);
                      font-variant-numeric: tabular-nums;
                      transition: all 0.3s ease;
                  }
                  
                  .dng-countdown-item:hover .dng-countdown-value {
                      transform: scale(1.1);
                      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.8);
                  }
                  
                  .dng-countdown-label-item {
                      font-size: 10px;
                      color: #856404;
                      margin-top: 6px;
                      font-weight: 600;
                      text-transform: uppercase;
                      letter-spacing: 0.5px;
                  }
                  
                  .dng-countdown-separator {
                      font-size: 22px;
                      font-weight: 800;
                      color: #ffc107;
                      align-self: flex-end;
                      margin-bottom: 12px;
                      text-shadow: 0 2px 4px rgba(255, 193, 7, 0.3);
                      animation: blink 1s infinite;
                  }
                  
                  @keyframes blink {
                      0%, 100% { opacity: 1; }
                      50% { opacity: 0.5; }
                  }
                  
                  #dng-arrow {
                      position: absolute;
                      display: inline-block;
                      left: 24px;
                      top: -10px;
                      width: 0;
                      height: 0;
                      border-left: 10px solid transparent;
                      border-right: 10px solid transparent;
                      border-bottom: 10px solid #35015F;
                      filter: drop-shadow(0 -2px 4px rgba(0, 0, 0, 0.1));
                  }
                  
                  .dng-notify {
                      animation: bell 1s ease-in-out;
                      animation-iteration-count: 3;
                      transform-origin: center top;
                  }
                  
                  @keyframes bell {
                      0% {transform: rotate(35deg);}
                      12.5% {transform: rotate(-30deg);}
                      25% {transform: rotate(25deg);}
                      37.5% {transform: rotate(-20deg);}
                      50% {transform: rotate(15deg);}
                      62.5% {transform: rotate(-10deg);}
                      75% {transform: rotate(5deg);}
                      100% {transform: rotate(0);}
                  }
                  
                  @media screen and (max-width: 768px) {
                      #dng-notification-container {
                          top: unset;
                      }
                      
                      #dng-notification {
                          height: 42px;
                          width: 42px;
                      }
                      
                      .dng-bell {
                          height: 36px;
                          width: 36px;
                      }
                      
                      .dng-badge-notify {
                          height: 18px;
                          min-width: 18px;
                          font-size: 10px;
                          right: -3px;
                          top: -3px;
                          padding: 0 5px;
                      }
                      
                      #dng-notification-list {
                          width: 340px;
                          max-height: 480px;
                          left: -298px;
                          top: 55px;
                          border-radius: 18px;
                      }
                      
                      #dng-arrow {
                          left: 298px;
                          top: -10px;
                          border-left-width: 10px;
                          border-right-width: 10px;
                          border-bottom-width: 10px;
                      }
                      
                      #dng-notification-header {
                          padding: 16px 18px;
                          font-size: 15px;
                      }
                      
                      #dng-notification-content {
                          padding: 14px;
                          max-height: 400px;
                      }
                      
                      .dng-notification-item {
                          padding: 14px;
                          gap: 14px;
                          border-radius: 14px;
                      }
                      
                      .dng-notification-icon {
                          width: 48px;
                          height: 48px;
                          border-radius: 12px;
                      }
                      
                      .dng-notification-icon svg {
                          width: 26px;
                          height: 26px;
                      }
                      
                      .dng-notification-title {
                          font-size: 14px;
                      }
                      
                      .dng-notification-description {
                          font-size: 12px;
                      }
                      
                      .dng-notification-actions {
                          flex-direction: column;
                          gap: 8px;
                          margin-top: 12px;
                      }
                      
                      .dng-notification-button {
                          width: 100%;
                          min-width: auto;
                          font-size: 12px;
                          padding: 11px 18px;
                          border-radius: 10px;
                      }
                      
                      .dng-notification-countdown {
                          padding: 12px;
                          border-radius: 10px;
                      }
                      
                      .dng-countdown-timer {
                          gap: 6px;
                      }
                      
                      .dng-countdown-item {
                          min-width: 42px;
                      }
                      
                      .dng-countdown-value {
                          font-size: 16px;
                          padding: 6px 10px;
                          min-width: 38px;
                          border-radius: 8px;
                      }
                      
                      .dng-countdown-label-item {
                          font-size: 9px;
                          margin-top: 4px;
                      }
                      
                      .dng-countdown-separator {
                          font-size: 18px;
                          margin-bottom: 10px;
                      }
                  }
              `;
      document.head.appendChild(style);
  
      let visitedPage = getVisistedPageList();
      let nonVisitedPage = [];

      items.forEach((item) => {
        if (
          !visitedPage.includes(item.title) &&
          compareDates(item.startDate, item.endDate)
        ) {
          nonVisitedPage.push(item.title);
        }
      });

      // İkon SVG'leri - CantuPneus gold outline stilinde
      const iconSVGs = {
        mobile: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="5" y="2" width="14" height="20" rx="2" ry="2" stroke="#35015F" stroke-width="2"/>
          <line x1="12" y1="18" x2="12.01" y2="18" stroke="#35015F" stroke-width="2" stroke-linecap="round"/>
        </svg>`,
        card: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="2" y="6" width="20" height="12" rx="2" ry="2" stroke="#35015F" stroke-width="2"/>
          <line x1="2" y1="10" x2="22" y2="10" stroke="#35015F" stroke-width="2"/>
          <line x1="6" y1="14" x2="10" y2="14" stroke="#35015F" stroke-width="2" stroke-linecap="round"/>
        </svg>`,
        campus: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="#35015F" stroke-width="2" stroke-linejoin="round"/>
          <path d="M2 17l10 5 10-5" stroke="#35015F" stroke-width="2" stroke-linejoin="round"/>
          <path d="M2 12l10 5 10-5" stroke="#35015F" stroke-width="2" stroke-linejoin="round"/>
        </svg>`,
        gift: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="8" width="18" height="4" stroke="#35015F" stroke-width="2" rx="1"/>
          <path d="M12 8v13" stroke="#35015F" stroke-width="2"/>
          <path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="#35015F" stroke-width="2"/>
          <rect x="7" y="8" width="10" height="10" rx="1" stroke="#35015F" stroke-width="2"/>
        </svg>`,
        diamond: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M6 3h12l4 6-10 12L2 9l4-6Z" stroke="#35015F" stroke-width="2" stroke-linejoin="round"/>
          <path d="M2 9h20M8 3l4 18M16 3l-4 18" stroke="#35015F" stroke-width="2" stroke-linejoin="round"/>
        </svg>`
      };

      const notificationContainer = document.createElement("div");
      notificationContainer.id = "dng-notification-container";

      const notification = document.createElement("div");
      notification.id = "dng-notification";
      notification.innerHTML = `
          <span class="dng-bell">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="#35015F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="#35015F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
          <span class="dng-badge-notify">${nonVisitedPage.length}</span>
      `;

      notificationContainer.append(notification);

      const listContainer = document.createElement("div");
      listContainer.id = "dng-notification-list";

      const arrow = document.createElement("div");
      arrow.id = "dng-arrow";
      listContainer.append(arrow);

      const header = document.createElement("div");
      header.id = "dng-notification-header";
      header.innerHTML = `
        <span>Avisos CantuPneus</span>
        <button class="dng-close-btn" aria-label="Close">×</button>
      `;
      listContainer.append(header);

      const content = document.createElement("div");
      content.id = "dng-notification-content";

      let validCampCount = 0;

      // Sayaç fonksiyonu
      function createCountdown(countdownDate) {
        const countdownDiv = document.createElement("div");
        countdownDiv.className = "dng-notification-countdown";
        
        const label = document.createElement("div");
        label.className = "dng-countdown-label";
        label.textContent = "The preview ends in";
        
        const timer = document.createElement("div");
        timer.className = "dng-countdown-timer";
        timer.id = `countdown-${validCampCount}`;
        
        countdownDiv.append(label);
        countdownDiv.append(timer);
        
        function updateCountdown() {
          const now = new Date().getTime();
          const end = new Date(countdownDate).getTime();
          const distance = end - now;
          
          if (distance < 0) {
            timer.innerHTML = '<span style="color: #35015F; font-weight: 600;">Preview ended</span>';
            return;
          }
          
          const days = Math.floor(distance / (1000 * 60 * 60 * 24));
          const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((distance % (1000 * 60)) / 1000);
          
          timer.innerHTML = `
            <div class="dng-countdown-item">
              <div class="dng-countdown-value">${String(days).padStart(2, '0')}</div>
              <div class="dng-countdown-label-item">Days</div>
            </div>
            <div class="dng-countdown-separator">:</div>
            <div class="dng-countdown-item">
              <div class="dng-countdown-value">${String(hours).padStart(2, '0')}</div>
              <div class="dng-countdown-label-item">Hours</div>
            </div>
            <div class="dng-countdown-separator">:</div>
            <div class="dng-countdown-item">
              <div class="dng-countdown-value">${String(minutes).padStart(2, '0')}</div>
              <div class="dng-countdown-label-item">Minutes</div>
            </div>
            <div class="dng-countdown-separator">:</div>
            <div class="dng-countdown-item">
              <div class="dng-countdown-value">${String(seconds).padStart(2, '0')}</div>
              <div class="dng-countdown-label-item">Seconds</div>
            </div>
          `;
        }
        
        updateCountdown();
        const countdownInterval = setInterval(updateCountdown, 1000);
        
        return countdownDiv;
      }
      
      items.forEach((item) => {
        if (!compareDates(item.startDate, item.endDate)) return;
        else {
          const listItem = document.createElement("div");
          listItem.className = "dng-notification-item";
          listItem.dataset.title = item.title;
          
          const icon = document.createElement("div");
          icon.className = "dng-notification-icon";
          icon.innerHTML = iconSVGs[item.icon] || iconSVGs.mobile;
          
          const text = document.createElement("div");
          text.className = "dng-notification-text";
          
          const title = document.createElement("div");
          title.className = "dng-notification-title";
          title.textContent = item.title;
          
          const description = document.createElement("div");
          description.className = "dng-notification-description";
          description.textContent = item.description || '';
          
          text.append(title);
          text.append(description);
          
          // Type'a göre ek içerikler
          const itemType = item.type || "default";
          
          if (itemType === "buttons" && item.buttons && item.buttons.length > 0) {
            // Butonlu item'lar tıklanabilir değil, sadece butonlar
            listItem.style.cursor = "default";
            listItem.style.pointerEvents = "none";
            
            const actions = document.createElement("div");
            actions.className = "dng-notification-actions";
            actions.style.pointerEvents = "auto";
            
            item.buttons.forEach((button) => {
              const btn = document.createElement("a");
              btn.href = button.url;
              btn.className = `dng-notification-button ${button.primary ? 'dng-notification-button-primary' : 'dng-notification-button-secondary'}`;
              btn.textContent = button.text;
              btn.addEventListener("click", (e) => {
                e.stopPropagation();
                clickItem.call({ dataset: { title: item.title }, href: button.url });
              });
              actions.append(btn);
            });
            
            text.append(actions);
          } else if (itemType === "countdown" && item.countdownDate) {
            const countdown = createCountdown(item.countdownDate);
            text.append(countdown);
            // Countdown item'ları da tıklanabilir
            listItem.style.cursor = "pointer";
            listItem.dataset.href = item.url;
          } else {
            // Varsayılan: Tek tıklanabilir link
            listItem.style.cursor = "pointer";
            listItem.dataset.href = item.url;
          }
          
          // Tüm item'lara href ekle
          if (!listItem.dataset.href) {
            listItem.dataset.href = item.url;
          }
          
          listItem.append(icon);
          listItem.append(text);
          content.append(listItem);
          validCampCount++;
        }
      });

      listContainer.append(content);
  
      notificationContainer.append(listContainer);
      if (validCampCount === 0)
        throw Error("vl notification error: All camps expired");
      else {
        const targetContainer = document.querySelector(selector) || document.querySelector(".header-inner");
        if (!targetContainer) return;
        if (window.innerWidth > 768) {
          targetContainer.appendChild(notificationContainer);
        } else {
          setTimeout(() => {
            targetContainer.appendChild(notificationContainer);
          }, 1000);
        }
        if (nonVisitedPage.length === 0) {
          document.querySelector(".dng-badge-notify").style.display = "none";
        }
      }
      const bell = document.querySelector(".dng-bell");
  
      notification.addEventListener("click", function (e) {
        e.stopPropagation();
        toggleList();
      });
      
      const closeBtn = header.querySelector(".dng-close-btn");
      closeBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        toggleList();
      });
      
      // Dışarı tıklanınca kapat
      document.addEventListener("click", function (e) {
        if (!notificationContainer.contains(e.target) && listContainer.style.display === "flex") {
          toggleList();
        }
      });

      // Kampanya item'larına click event ekle (sadece buttons olmayanlar için)
      content.querySelectorAll(".dng-notification-item").forEach((item) => {
        // Butonlu item'larda butonlar zaten event'e sahip ve item tıklanabilir değil
        if (!item.querySelector(".dng-notification-actions") && item.dataset.href) {
          item.addEventListener("click", function(e) {
            // Butonlara tıklanmışsa işlem yapma
            if (e.target.closest(".dng-notification-button")) return;
            clickItem.call({ dataset: { title: item.dataset.title }, href: item.dataset.href });
          });
        }
      });
  
      // Pozisyonlama
      const updatePosition = () => {
        const rect = notification.getBoundingClientRect();
        if (window.innerWidth > 768) {
          listContainer.style.top = `${rect.bottom + 8}px`;
          listContainer.style.right = `0px`;
          listContainer.style.left = `auto`;
          arrow.style.left = `${rect.width / 2 - 8}px`;
        } else {
          listContainer.style.top = `${rect.bottom + 8}px`;
          listContainer.style.left = `auto`;
          listContainer.style.right = `0px`;
          arrow.style.right = `${rect.width / 2 - 8}px`;
          arrow.style.left = `auto`;
        }
      };

      if (nonVisitedPage.length > 0) {
        const bell = document.querySelector(".dng-bell");
        bell.classList.add("dng-notify");
      }

      function clickItem(e) {
        if (e && e.preventDefault) {
          e.preventDefault();
          e.stopPropagation();
        }
        const title = this.dataset.title;
        const href = this.href || this.dataset?.href;
        
        if (title) {
          addVisitedPageToLocalStorage(title);
          updateNotVisitedPage();
          if (nonVisitedPage.length === 0) {
            const badge = document.querySelector(".dng-badge-notify");
            if (badge) badge.style.display = "none";
          }
        }
        
        // URL'e git
        if (href) {
          window.location.href = href;
        }
      }
  
      function toggleList() {
        const duration = 300;
        const isOpen = listContainer.style.display === "flex";
        
        if (!isOpen) {
          updatePosition();
          listContainer.style.display = "flex";
          listContainer.style.opacity = "0";
          listContainer.style.transform = "translateY(-10px) scale(0.95)";
          
          requestAnimationFrame(() => {
            listContainer.style.transition = `all ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`;
            listContainer.style.opacity = "1";
            listContainer.style.transform = "translateY(0) scale(1)";
          });
        } else {
          listContainer.style.transition = `all ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`;
          listContainer.style.opacity = "0";
          listContainer.style.transform = "translateY(-10px) scale(0.95)";
          
          setTimeout(() => {
            listContainer.style.display = "none";
          }, duration);
        }
      }

      function addVisitedPageToLocalStorage(title) {
        let pages = { visited: [] };
        if (localStorage.getItem("dng-notification-page")) {
          pages = JSON.parse(localStorage.getItem("dng-notification-page"));
        }
        if (!pages.visited.includes(title)) {
          pages.visited.push(title);
          localStorage.setItem("dng-notification-page", JSON.stringify(pages));
        }
      }

      function getVisistedPageList() {
        let pages = { visited: [] };
        if (localStorage.getItem("dng-notification-page")) {
          pages = JSON.parse(localStorage.getItem("dng-notification-page"));
        }
        return pages.visited;
      }

      function updateNotVisitedPage() {
        visitedPage = getVisistedPageList();
        nonVisitedPage = items
          .filter((item) => 
            !visitedPage.includes(item.title) && 
            compareDates(item.startDate, item.endDate)
          )
          .map((item) => item.title);
        
        const badge = document.querySelector(".dng-badge-notify");
        if (badge) {
          if (nonVisitedPage.length > 0) {
            badge.innerText = nonVisitedPage.length;
            badge.style.display = "flex";
          } else {
            badge.style.display = "none";
          }
        }
      }

      function compareDates(startingDate, endingDate) {
        startingDate = new Date(startingDate);
        endingDate = new Date(endingDate);
        if (Date.now() > startingDate && Date.now() < endingDate) {
          return true;
        } else {
          return false;
        }
      }
    }
  }
  
 