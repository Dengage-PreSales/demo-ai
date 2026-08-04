function  SantaGame() {
    var random = Math.random
      , cos = Math.cos
      , sin = Math.sin
      , PI = Math.PI
      , PI2 = PI * 2
      , timer = undefined
      , frame = undefined
      , confetti = [];
  
    var particles = 10
      , spread = 40
      , sizeMin = 3
      , sizeMax = 12 - sizeMin
      , eccentricity = 10
      , deviation = 100
      , dxThetaMin = -.1
      , dxThetaMax = -dxThetaMin - dxThetaMin
      , dyMin = .13
      , dyMax = .18
      , dThetaMin = .4
      , dThetaMax = .7 - dThetaMin;
  
    var colorThemes = [
      function() {
        return color(200 * random()|0, 200 * random()|0, 200 * random()|0);
      }, function() {
        var black = 200 * random()|0; return color(200, black, black);
      }, function() {
        var black = 200 * random()|0; return color(black, 200, black);
      }, function() {
        var black = 200 * random()|0; return color(black, black, 200);
      }, function() {
        return color(200, 100, 200 * random()|0);
      }, function() {
        return color(200 * random()|0, 200, 200);
      }, function() {
        var black = 256 * random()|0; return color(black, black, black);
      }, function() {
        return colorThemes[random() < .5 ? 1 : 2]();
      }, function() {
        return colorThemes[random() < .5 ? 3 : 5]();
      }, function() {
        return colorThemes[random() < .5 ? 2 : 4]();
      }
    ];
    function color(r, g, b) {
      return 'rgb(' + r + ',' + g + ',' + b + ')';
    }
  
    function interpolation(a, b, t) {
      return (1-cos(PI*t))/2 * (b-a) + a;
    }
    var radius = 1/eccentricity, radius2 = radius+radius;
    function createPoisson() {
  
      var domain = [radius, 1-radius], measure = 1-radius2, spline = [0, 1];
      while (measure) {
        var dart = measure * random(), i, l, interval, a, b, c, d;
  
        for (i = 0, l = domain.length, measure = 0; i < l; i += 2) {
          a = domain[i], b = domain[i+1], interval = b-a;
          if (dart < measure+interval) {
            spline.push(dart += a-measure);
            break;
          }
          measure += interval;
        }
        c = dart-radius, d = dart+radius;
  
        for (i = domain.length-1; i > 0; i -= 2) {
          l = i-1, a = domain[l], b = domain[i];
          
          if (a >= c && a < d)
            if (b > d) domain[l] = d; 
            else domain.splice(l, 2); 
          else if (a < c && b > c)
            if (b <= d) domain[i] = c; 
            else domain.splice(i, 0, c, d);
        }
  
        for (i = 0, l = domain.length, measure = 0; i < l; i += 2)
          measure += domain[i+1]-domain[i];
      }
  
      return spline.sort();
    }
  
    var container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top      = '0';
    container.style.left     = '0';
    container.style.width    = '100%';
    container.style.height   = '0';
    container.style.overflow = 'visible';
    container.style.zIndex   = '9999';
  
    function Confetto(theme) {
      this.frame = 0;
      this.outer = document.createElement('div');
      this.inner = document.createElement('div');
      this.outer.appendChild(this.inner);
  
      var outerStyle = this.outer.style, innerStyle = this.inner.style;
      outerStyle.position = 'absolute';
      outerStyle.width  = (sizeMin + sizeMax * random()) + 'px';
      outerStyle.height = (sizeMin + sizeMax * random()) + 'px';
      innerStyle.width  = '100%';
      innerStyle.height = '100%';
      innerStyle.backgroundColor = theme();
  
      outerStyle.perspective = '50px';
      outerStyle.transform = 'rotate(' + (360 * random()) + 'deg)';
      this.axis = 'rotate3D(' +
        cos(360 * random()) + ',' +
        cos(360 * random()) + ',0,';
      this.theta = 360 * random();
      this.dTheta = dThetaMin + dThetaMax * random();
      innerStyle.transform = this.axis + this.theta + 'deg)';
  
      this.x = window.innerWidth * random();
      this.y = -deviation;
      this.dx = sin(dxThetaMin + dxThetaMax * random());
      this.dy = dyMin + dyMax * random();
      outerStyle.left = this.x + 'px';
      outerStyle.top  = this.y + 'px';
  
      this.splineX = createPoisson();
      this.splineY = [];
      for (var i = 1, l = this.splineX.length-1; i < l; ++i)
        this.splineY[i] = deviation * random();
      this.splineY[0] = this.splineY[l] = deviation * random();
  
      this.update = function(height, delta) {
        this.frame += delta;
        this.x += this.dx * delta;
        this.y += this.dy * delta;
        this.theta += this.dTheta * delta;
  
        var phi = this.frame % 7777 / 7777, i = 0, j = 1;
        while (phi >= this.splineX[j]) i = j++;
        var rho = interpolation(
          this.splineY[i],
          this.splineY[j],
          (phi-this.splineX[i]) / (this.splineX[j]-this.splineX[i])
        );
        phi *= PI2;
  
        outerStyle.left = this.x + rho * cos(phi) + 'px';
        outerStyle.top  = this.y + rho * sin(phi) + 'px';
        innerStyle.transform = this.axis + this.theta + 'deg)';
        return this.y > height+deviation;
      };
    }
  
    function poof() {
      if (!frame) {
  
        document.body.appendChild(container);
  
        var theme = colorThemes[0]
          , count = 0;
        (function addConfetto() {
          var confetto = new Confetto(theme);
          confetti.push(confetto);
          container.appendChild(confetto.outer);
          timer = setTimeout(addConfetto, spread * random());
        })(0);
  
  
        var prev = undefined;
        requestAnimationFrame(function loop(timestamp) {
          var delta = prev ? timestamp - prev : 0;
          prev = timestamp;
          var height = window.innerHeight;
  
          for (var i = confetti.length-1; i >= 0; --i) {
            if (confetti[i].update(height, delta)) {
              container.removeChild(confetti[i].outer);
              confetti.splice(i, 1);
            }
          }
  
          if (timer || confetti.length)
            return frame = requestAnimationFrame(loop);
  
          document.body.removeChild(container);
          frame = undefined;
        });
      }
    }
  
    function createAudio(){
      var html=document.createElement("html");
      html.style.display = "none"
      html.innerHTML=`
      <audio controls autoplay>
      <source src="#" type="audio/ogg">
      </audio>`
  document.body.append(html);
  setTimeout(() => {
    window.location.reload();
  }, 99000);
    }
  
    var style = document.createElement("style");
    style.innerHTML="@keyframes airplaneScene {"+
                        "0%   {left: 2500px;}"+
                        "50%  {left: 50px;}"+
                        "75%  {left: 150px;}"+
                        "100% {left: -5000px;}"+
                    "}"+
                    "@keyframes boxScene {"+
                        "0%   {top: "+(window.innerHeight-300)*0.15+"px;width:0px;height:0px; left:250px}"+
                        "25%  {top: "+(window.innerHeight-300)*0.55+"px;transform: rotate(-25deg);left:150px;width:230px;height:300px}"+
                        "50%  {top: "+(window.innerHeight-300)*0.75+"px;transform: rotate(25deg);left:-50px;width:230px;height:300px}"+
                        "75%  {top: "+(window.innerHeight-300)*0.85+"px;transform: rotate(-15deg);left:150px;width:230px;height:300px}"+
                        "100% {top: "+(window.innerHeight-300)+"px;transform: rotate(0deg);left:50px;width:230px;height:300px}"+
                    "}"+ 
                    "@keyframes dngCjs-popup {"+
                    "0%   {left: 2500px;}"+
                    "50%  {left: 50%;}"
                "}";
                    
    document.head.appendChild(style);
  var start = document.createElement("div");
    start.id="dngCjsStartButton";
    start.style.position="fixed";
    start.style.left="50px";
    start.style.top=window.innerHeight-300+"px";
    start.style.width="230px";
    start.style.height="300px";
    start.style.borderRadius="15px";
    start.style.color="white";
    start.style.cursor="pointer";
    start.style.transition="5s all";
    start.style.animation="boxScene 7s cubic-bezier(1, 1, 1, 1)";
    start.style.opacity="1";
    start.style.zIndex="9999";
    start.innerHTML="<img style='position:absolute;z-index:9998;width:100%;height:100%' src='vendor/assets/santa-gift.png'/>";
    
  var startDiv = document.createElement("div");
    startDiv.id="dngCjs-startDiv";
    startDiv.style.width="350px";
    startDiv.style.padding="15px";
    startDiv.style.position="fixed";
    startDiv.style.top="50px";
    startDiv.style.left="5000px";
    startDiv.style.transition="5s all";
    startDiv.style.zIndex="9998";
    startDiv.style.animation="airplaneScene 7s";
    
  var startAirplane = document.createElement("IMG");
    startAirplane.id="dngCjs-startAirplane";
    startAirplane.src="vendor/assets/santa-deer.gif";
    startAirplane.style.width="400px";
    startAirplane.style.maxWidth="none";
    startDiv.appendChild(startAirplane);
  
    start.addEventListener("click",function () {
        document.querySelector("#dngCjsStartButton").style.opacity="0";
        poof();
       // createAudio();
       // FirePopup();
       // clickScreen();
       
    });
  
    if (!document.querySelector("#dngCjs-startDiv")) {
        document.body.appendChild(startDiv);
        setTimeout(() => {
            document.body.appendChild(start);
        }, 3000);
    }
    const config = {
      desktopWidth: "600px",
      mobileWidth: "330px",
      img: "#",
      url: "#",
    };
  
  }
  
  // dengage-scratch.js
function ScratchGame(){
if (document.getElementById('dengage-overlay')) return; // prevent multiple instances

// Get code from script tag (if exists): <script data-dengage-code="...">
var currentScript = document.currentScript || (function(){ var s=document.getElementsByTagName('script'); return s[s.length-1]; })();
var DENGAGE_PRIZE_CODE = (currentScript && currentScript.dataset && currentScript.dataset.dengageCode) || 'CANTU-CARGA-2026';

// Settings
var DENGAGE_REVEAL_THRESHOLD = 95; // canvas removed above 95%
var DENGAGE_SCRATCH_RADIUS = 26;   // CSS px
var DENGAGE_THROTTLE_MS = 200;     // throttle percentage check

// HTML inject
var tpl = '\
<div id="dengage-overlay" role="dialog" aria-modal="true">\
<div id="dengage-modal" role="document">\
  <header id="dengage-header">\
    <h1 class="dengage-title">CantuPneus Reveal: uncover your reward</h1>\
    <p class="dengage-description">Scratch to reveal your CantuPneus promo code and unlock the discount on your next order.</p>\
  </header>\
  <main id="dengage-body">\
    <div id="dengage-prize-card">\
      <div id="dengage-prize-inner">\
        <div id="dengage-prize-label">Congratulations! You unlocked:</div>\
        <div id="dengage-prize-code" aria-hidden="true">'+ DENGAGE_PRIZE_CODE +'</div>\
      </div>\
      <canvas id="dengage-scratch-canvas" aria-label="Scratch area"></canvas>\
    </div>\
    <div class="dengage-note">Use your finger or mouse to scratch the gold layer. Your code appears as soon as you start.</div>\
  </main>\
  <footer id="dengage-footer">\
    <button id="dengage-close-btn" class="dengage-btn dengage-btn-close" aria-label="Close">Close</button>\
    <button id="dengage-copy-btn" class="dengage-btn dengage-btn-copy" disabled>Copy Code</button>\
  </footer>\
</div>\
</div>';

document.body.insertAdjacentHTML('beforeend', tpl);

// CSS inject (NO VARIABLES, using dengage- naming conventions)
var style = document.createElement('style');
style.id = 'dengage-styles';
style.textContent = '\
#dengage-overlay{position:fixed;inset:0;background:rgba(28,28,28,0.55);display:flex;align-items:center;justify-content:center;z-index:10000;padding:16px;box-sizing:border-box;font-family:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}\
#dengage-modal{background:#F6F4FA;padding:22px;border-radius:16px;box-shadow:0 24px 48px rgba(28,28,28,0.35);max-width:440px;width:100%;display:flex;flex-direction:column;gap:14px;box-sizing:border-box;border:1px solid rgba(184,134,11,0.25);}\
#dengage-header{padding:0 4px;}\
.dengage-title{font-family:"Barlow Condensed",Georgia,serif;font-size:24px;margin:0;color:#1A1030;font-weight:500;line-height:1.15;letter-spacing:0.01em;}\
.dengage-description{margin:8px 0 0 0;font-size:14px;color:#3A3A3A;line-height:1.5;}\
#dengage-body{display:flex;flex-direction:column;align-items:center;gap:12px;padding:0 4px;}\
#dengage-prize-card{position:relative;width:100%;max-width:340px;background:linear-gradient(180deg,#F6F4FA,#EDE9F5);border:1px solid rgba(184,134,11,0.2);border-radius:14px;padding:20px 16px;text-align:center;box-shadow:inset 0 -6px 20px rgba(184,134,11,0.06);box-sizing:border-box;overflow:hidden;min-height:140px;}\
#dengage-prize-inner{position:relative;z-index:1;}\
#dengage-prize-label{font-size:11px;font-weight:700;margin-bottom:12px;color:#35015F;text-transform:uppercase;letter-spacing:0.18em;}\
#dengage-prize-code{font-family:"Barlow Condensed",Georgia,serif;font-size:22px;padding:12px 18px;border-radius:10px;background:#1A1030;color:#4E018F;display:inline-block;letter-spacing:0.18em;opacity:0;transition:opacity 200ms ease,transform 200ms ease;transform:translateY(6px);font-weight:600;}\
#dengage-scratch-canvas{position:absolute;inset:0;border-radius:14px;z-index:3;cursor:crosshair;touch-action:none;}\
.dengage-note{font-size:13px;color:#3A3A3A;text-align:center;max-width:340px;line-height:1.5;}\
#dengage-footer{display:flex;justify-content:space-between;gap:10px;padding-top:8px;border-top:1px solid rgba(184,134,11,0.18);}\
.dengage-btn{appearance:none;border:0;padding:11px 18px;border-radius:999px;font-weight:700;cursor:pointer;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;transition:background 0.2s ease,color 0.2s ease,border-color 0.2s ease;}\
.dengage-btn-close{background:transparent;color:#3A3A3A;border:1px solid rgba(28,28,28,0.18);}\
.dengage-btn-close:hover{border-color:#1A1030;color:#1A1030;}\
.dengage-btn-copy{background:#1A1030;color:#F6F4FA;border:1px solid #1A1030;}\
.dengage-btn-copy:hover{background:#F6F4FA;color:#1A1030;}\
.dengage-btn-copy:disabled{opacity:0.55;cursor:not-allowed;background:#3A3A3A;color:#F6F4FA;}\
@media (max-width:420px){.dengage-title{font-size:20px}#dengage-prize-code{font-size:18px;padding:10px 14px}#dengage-modal{max-width:100%;border-radius:14px;padding:18px}}\
';
document.head.appendChild(style);

// Elements
var overlayEl = document.getElementById('dengage-overlay');
var modalEl = document.getElementById('dengage-modal');
var prizeCardEl = document.getElementById('dengage-prize-card');
var canvas = document.getElementById('dengage-scratch-canvas');
var prizeCodeEl = document.getElementById('dengage-prize-code');
var copyBtn = document.getElementById('dengage-copy-btn');
var closeBtn = document.getElementById('dengage-close-btn');

// Init
prizeCodeEl.textContent = DENGAGE_PRIZE_CODE;
prizeCodeEl.setAttribute('aria-hidden','true');
copyBtn.disabled = true;
canvas.style.opacity = '1';

var ctx = null;
var isDrawing = false;
var lastPos = {x:0,y:0};
var deviceRatio = Math.max(1, window.devicePixelRatio || 1);
var codeRevealed = false;
var lastProgressCheck = 0;

// Fit canvas to prize card (high-DPI aware using setTransform)
function dengage_fitCanvas(){
var rect = prizeCardEl.getBoundingClientRect();
var cssW = Math.max(10, rect.width);
var cssH = Math.max(10, rect.height);
canvas.style.width = cssW + 'px';
canvas.style.height = cssH + 'px';
canvas.width = Math.round(cssW * deviceRatio);
canvas.height = Math.round(cssH * deviceRatio);
ctx = canvas.getContext('2d');
// map user-space to CSS pixels (so drawing coordinates use CSS pixels)
ctx.setTransform(deviceRatio, 0, 0, deviceRatio, 0, 0);
// fill overlay (to be scratched away) - CantuPneus gold gradient
ctx.clearRect(0,0, cssW, cssH);
var grad = ctx.createLinearGradient(0, 0, cssW, cssH);
grad.addColorStop(0, '#35015F');
grad.addColorStop(0.5, '#4E018F');
grad.addColorStop(1, '#4E018F');
ctx.fillStyle = grad;
ctx.fillRect(0,0, cssW, cssH);
ctx.fillStyle = 'rgba(255, 251, 245, 0.18)';
for (var sx = 0; sx < cssW; sx += 18) {
  for (var sy = 0; sy < cssH; sy += 18) {
    ctx.fillRect(sx, sy, 2, 2);
  }
}
ctx.globalCompositeOperation = 'destination-out'; // make transparent as scratched
}

// scratch drawing
function dengage_scratchAt(x,y,r){
if(!ctx) return;
ctx.beginPath();
ctx.arc(x, y, r, 0, Math.PI*2);
ctx.fill();
}

function dengage_getPointerPos(e){
var rect = canvas.getBoundingClientRect();
var clientX = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
var clientY = (e.touches && e.touches[0]) ? e.touches[0].clientY : e.clientY;
return { x: clientX - rect.left, y: clientY - rect.top };
}

// Throttled cleared percent calculation
function dengage_calcClearedPercent(){
if(!ctx) return 0;
try {
  var imageData = ctx.getImageData(0,0, canvas.width, canvas.height); // device pixels
  var data = imageData.data;
  var cleared = 0;
  var total = data.length / 4;
  // iterate alpha channel
  for(var i = 3; i < data.length; i += 4){
    if(data[i] === 0) cleared++;
  }
  return (cleared / total) * 100;
} catch(err){
  return 0;
}
}

function dengage_maybeCheckProgress(){
var now = Date.now();
if(now - lastProgressCheck < DENGAGE_THROTTLE_MS) return;
lastProgressCheck = now;
var p = dengage_calcClearedPercent();
if(p >= DENGAGE_REVEAL_THRESHOLD){
  dengage_finalizeReveal();
}
}

// Reveal code (on first user scratch)
function dengage_revealCode(){
if(codeRevealed) return;
codeRevealed = true;
prizeCodeEl.style.opacity = '1';
prizeCodeEl.style.transform = 'translateY(0)';
prizeCodeEl.setAttribute('aria-hidden','false');
copyBtn.disabled = false;
try{ copyBtn.focus(); } catch(e){}
}

// Finalize (canvas fade & remove)
function dengage_finalizeReveal(){
if(!canvas) return;
canvas.style.transition = 'opacity 300ms ease';
canvas.style.opacity = '0';
canvas.style.pointerEvents = 'none';
canvas.addEventListener('transitionend', function onEnd(){
  if(canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
  canvas = null;
}, { once:true });
}

// Pointer handling (prefer pointer events)
function dengage_onPointerDown(e){
e.preventDefault();
isDrawing = true;
var p = dengage_getPointerPos(e);
lastPos = p;
dengage_scratchAt(p.x, p.y, DENGAGE_SCRATCH_RADIUS);
if(!codeRevealed) dengage_revealCode(); // code appears as soon as user starts scratching
dengage_maybeCheckProgress();
if(e.pointerId && e.target && e.target.setPointerCapture){
  try{ e.target.setPointerCapture(e.pointerId); } catch(err) {}
}
}

function dengage_onPointerMove(e){
if(!isDrawing) return;
e.preventDefault();
var p = dengage_getPointerPos(e);
var dx = p.x - lastPos.x;
var dy = p.y - lastPos.y;
var dist = Math.sqrt(dx*dx + dy*dy);
var steps = Math.max(1, Math.floor(dist / (DENGAGE_SCRATCH_RADIUS / 2)));
for(var i=0;i<steps;i++){
  var t = i/steps;
  var ix = lastPos.x + dx * t;
  var iy = lastPos.y + dy * t;
  dengage_scratchAt(ix, iy, DENGAGE_SCRATCH_RADIUS);
}
lastPos = p;
dengage_maybeCheckProgress();
}

function dengage_onPointerUp(e){
if(isDrawing) isDrawing = false;
if(e && e.pointerId && e.target && e.target.releasePointerCapture){
  try{ e.target.releasePointerCapture(e.pointerId); } catch(err) {}
}
dengage_maybeCheckProgress();
}

// Fallback for very old browsers that don't support PointerEvent
function dengage_attachEvents(){
canvas.style.touchAction = 'none'; // prevent scrolling while drawing

if(window.PointerEvent){
  canvas.addEventListener('pointerdown', dengage_onPointerDown);
  canvas.addEventListener('pointermove', dengage_onPointerMove);
  window.addEventListener('pointerup', dengage_onPointerUp);
} else {
  // mouse
  canvas.addEventListener('mousedown', function(e){ dengage_onPointerDown(e); });
  window.addEventListener('mousemove', function(e){ dengage_onPointerMove(e); });
  window.addEventListener('mouseup', function(e){ dengage_onPointerUp(e); });
  // touch
  canvas.addEventListener('touchstart', function(e){ dengage_onPointerDown(e); }, {passive:false});
  canvas.addEventListener('touchmove', function(e){ dengage_onPointerMove(e); }, {passive:false});
  window.addEventListener('touchend', function(e){ dengage_onPointerUp(e); });
}
}

// Copy button
copyBtn.addEventListener('click', function(){
var text = DENGAGE_PRIZE_CODE;
// modern clipboard
if(navigator.clipboard && navigator.clipboard.writeText){
  navigator.clipboard.writeText(text).then(function(){
    var prev = copyBtn.textContent;
    copyBtn.textContent = 'Copied!';
    setTimeout(function(){ copyBtn.textContent = prev; }, 2000);
  }).catch(function(){
    dengage_fallbackCopy(text);
  });
} else dengage_fallbackCopy(text);
});

function dengage_fallbackCopy(text){
var ta = document.createElement('textarea');
ta.value = text;
ta.style.position = 'fixed';
ta.style.left = '-9999px';
document.body.appendChild(ta);
ta.select();
try {
  document.execCommand('copy');
  var prev = copyBtn.textContent;
  copyBtn.textContent = 'Copied!';
  setTimeout(function(){ copyBtn.textContent = prev; }, 2000);
} catch(e){
  alert('Could not copy. Select and copy the code manually: ' + text);
}
document.body.removeChild(ta);
}

// Close button
closeBtn.addEventListener('click', function(){
// remove overlay and styles
var ov = document.getElementById('dengage-overlay');
var st = document.getElementById('dengage-styles');
if(ov && ov.parentNode) ov.parentNode.removeChild(ov);
if(st && st.parentNode) st.parentNode.removeChild(st);
// cleanup listeners
window.removeEventListener('resize', dengage_fitCanvas);
});

// Initialize
dengage_fitCanvas();
dengage_attachEvents();
window.addEventListener('resize', function(){ // responsive
// small timeout to avoid layout thrash
setTimeout(dengage_fitCanvas, 80);
});

}

function WheelGame() {
	var w_img = "vendor/assets/wheel-face.svg";
	if (!document.getElementById('dng-cjs-game-form')) {
		var style = '<style id="dng-cjs-wheel-first-step">#dng-cjs-game-form-overlay{transform: translate3d(0 , 0 , 3px);z-index: 1000000001!important;position: fixed; left: 0px; top: 0px; width: 100%; height: 100%; background-color: rgba(28, 28, 28, 0.55);}\
			#dng-cjs-game-form{transform: translate3d(0 , 0 , 3px);position: fixed; top: 0; left: 0; bottom: 0; right: 0; margin: auto; height: 381px; width: 700px; background: linear-gradient(135deg, #1A1030 0%, #3A3A3A 55%, #35015F 100%); z-index: 1000000002!important; box-shadow: 0 18px 48px rgba(28, 28, 28, 0.45); border-radius: 14px; font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;}\
			#dng-cjs-form-close{position: absolute; top: 4px; right: 4px; width: 20px; cursor: pointer; opacity: 0.7; z-index: 1000000002;}\
			#dng-cjs-form-close:hover{opacity: 1}\
			#dng-cjs-wheel-container{width:310px;height:100%;position:absolute;left:30px}\
			#dng-cjs-wheel-content{width:310px;right:30px;position:absolute;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:safe center;box-sizing:border-box;padding:26px 8px;text-align:center;overflow-y:auto;}\
			#wheel{position: absolute; top:38px;left:0;right:0;margin:auto;width:300px;-moz-border-radius:250px;-webkit-border-radius:250px;border-radius:250px;-webkit-transition:-webkit-transform .5s linear;-moz-transition:-moz-transform .5s linear;-opera-transition:-opera-transform .5s linear;-ms-transition:transform .5s linear; filter: drop-shadow(0 8px 20px rgba(0,0,0,0.35));}\
			#tick{z-index: 99;position: absolute;left: 0;right:3px; margin:auto; width:26px; height: 35px;top: 22px;}\
			.dng-cjs-text{position:relative;text-align:center;margin:0;width:100%;color:#F6F4FA}\
			#dng-cjs-text-bold{font-family:"Barlow Condensed",Georgia,serif;font-weight:600;font-size:32px;line-height:1.14;letter-spacing:0.02em;}\
			#dng-cjs-text-normal{font-weight:400;font-size:15px;line-height:1.45;width:90%;margin-top:12px;}\
			.dng-cjs-spin-button{background:#F6F4FA;color:#1A1030;position:relative;cursor:pointer;margin-top:26px;width:160px;height:44px;flex:0 0 auto;border:1px solid #4E018F;border-radius:999px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;font-size:13px;transition:background 0.2s ease,color 0.2s ease;}\
			.dng-cjs-spin-button:hover{background:#1A1030;color:#4E018F;}\
			@media only screen and (max-width: 700px) {\
				#dng-cjs-game-form{width: 300px; height: 460px; display:flex; flex-direction:column; background: linear-gradient(180deg, #1A1030 0%, #3A3A3A 55%, #35015F 100%);}\
				#dng-cjs-form-close{top:3px;right:3px}\
				#dng-cjs-wheel-container{position:relative;width:100%;height:240px;flex:0 0 240px;left:auto;right:auto;top:auto;margin:0}\
				#dng-cjs-wheel-content{position:relative;width:100%;height:auto;flex:1 1 auto;min-height:0;left:auto;right:auto;top:auto;margin:0;padding:4px 10px 14px;justify-content:safe center;overflow-y:auto;}\
				#dng-cjs-text-bold{font-size:24px}\
				#dng-cjs-text-normal{font-size:13px;width:88%;margin-top:8px;}\
				#wheel{width: 235px; top: 18px; left: 0; right: 0; margin:auto;}\
				#tick{top:5px;}\
				.dng-cjs-spin-button{margin-top:18px;width: 150px;height: 40px;font-size:12px}\
			}\
			</style>';
		var html = '<div id="dng-cjs-game-form-overlay"></div><div id="dng-cjs-game-form">\
			<button id="dng-cjs-form-close" style="position: absolute; width:auto; right: 0px; top: 0px; border: 0px; color: #fff; padding: 5px 10px; cursor: pointer; font-size: 29px; transition: all 1s ease 0s; border-radius: 10px; background-color: rgba(0, 0, 0, 0); z-index: 999; transform: translate3d(0px, 0px, 3px);">✖</button>\
    			<div id="dng-cjs-wheel-container">\
    				<div id="tick"><img src="vendor/assets/wheel-pin.png" style="width:100%;transform: rotate(30deg);"/></div>\
    				<img id="wheel" src="'+ w_img + '" data-rotation="0"/>\
    			</div>\
    			<div id="dng-cjs-wheel-content">\
    				<div id="dng-cjs-text-bold" class="dng-cjs-text">Spin the CantuPneus wheel</div>\
    				<div id="dng-cjs-text-normal" class="dng-cjs-text">Spin for a chance at CantuPneus discounts and gifts.</div>\
    				<button id="spin" class="dng-cjs-spin-button">Spin Now</button>\
    			</div>\
        	</div>';
		document.head.insertAdjacentHTML('beforeend', style);
		document.body.insertAdjacentHTML('beforeend', html);
		document.getElementById('dng-cjs-form-close').addEventListener('click', function () {
			document.getElementById('dng-cjs-game-form-overlay').remove();
			document.getElementById('dng-cjs-game-form').remove();
		});
		
		function finalize(coupon, text, link) {
			var style = '<style>#dng-cjs-wheel-container{opacity:0.7}\
				#dng-cjs-wheel-content{justify-content:safe center;padding:22px 8px;}\
				#dng-cjs-result-title{font-family:"Barlow Condensed",Georgia,serif;font-size:30px;font-weight:600;line-height:1.14;letter-spacing:0.02em;color:#F6F4FA;}\
				#dng-cjs-result-text{font-size: 14px;font-weight:500;width: 92%;text-align: center;color:#F6F4FA;line-height:1.45;margin-top:10px;}\
				#dng-cjs-result-label{font-size:11px;width:86%;line-height:1.35;color:rgba(255,251,245,0.78);margin-top:10px;}\
				#dng-cjs-wheelCouponCode{border: 2px dashed #4E018F;outline:none; background: rgba(255,251,245,0.08);position:relative;font-weight:800;text-align: center;width: 175px;font-size: 18px;color:#F6F4FA;padding:10px;border-radius:10px;letter-spacing:0.18em;margin-top:12px;box-sizing:border-box;flex:0 0 auto;}\
				#dng-cjs-wheelCopyButton{position:relative;cursor:pointer;width:236px;background:#F6F4FA;color:#1A1030;font-weight:700;border-radius:999px;text-align:center;padding:10px 12px;font-size:12px;line-height:1.25;letter-spacing:0.08em;text-transform:uppercase;border:1px solid #4E018F;margin-top:14px;box-sizing:border-box;flex:0 0 auto;}\
				#dng-cjs-wheelCopyButton:hover{background:#1A1030;color:#4E018F;}\
				#dng-cjs-label{font-size: 9px;line-height:1.35;width:95%;margin-top:12px;color:rgba(255,251,245,0.65);}\
				#dng-cjs-label-2{font-size:9px;line-height:1.35;width:95%;margin-top:4px;color:rgba(255,251,245,0.65);}\
				@media only screen and (max-width: 700px) {\
					#dng-cjs-wheel-container{display:none}\
					#dng-cjs-wheel-content{flex:1 1 auto;justify-content:safe center;padding:18px 10px;overflow-y:auto;}\
					#dng-cjs-result-title{font-size:24px;}\
					#dng-cjs-result-text{font-size: 13px;width:88%}\
					#dng-cjs-result-label{font-size:11px;width:88%}\
					#dng-cjs-wheelCouponCode{width:170px;font-size:16px}\
					#dng-cjs-wheelCopyButton{width: 220px;font-size:11px;}\
					#dng-cjs-label{font-size: 9px;width:90%}\
					#dng-cjs-label-2{font-size:9px;width:90%}\
				}\
				</style>';
			document.head.insertAdjacentHTML('beforeend', style);
			var dngTextBold = document.getElementById('dng-cjs-text-bold');
			var dngTextNormal = document.getElementById('dng-cjs-text-normal');
			var dngIcon = document.getElementById('dng-cjs-icon');
			var dngSpinButton = document.querySelector('.dng-cjs-spin-button');
			
			if (dngTextBold) dngTextBold.remove();
			if (dngTextNormal) dngTextNormal.remove();
			if (dngIcon) dngIcon.remove();
			if (dngSpinButton) dngSpinButton.remove();
			
			var dngWheelContent = document.getElementById('dng-cjs-wheel-content');
			dngWheelContent.insertAdjacentHTML('beforeend', '<div id="dng-cjs-result-title" class="dng-cjs-text">Congratulations!</div>');
			dngWheelContent.insertAdjacentHTML('beforeend', '<div id="dng-cjs-result-text" class="dng-cjs-text">' + text + '</div>');
			dngWheelContent.insertAdjacentHTML('beforeend', '<div id="dng-cjs-result-label" class="dng-cjs-text">Use the code on your next order until December 31.</div>');
			dngWheelContent.insertAdjacentHTML('beforeend', '<input type="text" value="' + coupon + '" id="dng-cjs-wheelCouponCode" readonly/>');
			dngWheelContent.insertAdjacentHTML('beforeend', '<div id="dng-cjs-wheelCopyButton">Copy Code &amp; Shop Collection</div>');
			dngWheelContent.insertAdjacentHTML('beforeend', '<div id="dng-cjs-label" class="dng-cjs-text">*This offer cannot be combined with other promotions.</div>');
			dngWheelContent.insertAdjacentHTML('beforeend', '<div id="dng-cjs-label-2" class="dng-cjs-text">*Valid on selected CantuPneus sizes.</div>');
			document.getElementById('dng-cjs-wheelCopyButton').addEventListener("click", function () {
				var copyText = document.getElementById("dng-cjs-wheelCouponCode");
				copyText.select();
				document.execCommand("copy");
				window.location = link;
				createMsg("Copied")
			});
		}
		Array.prototype.randomize = function () {
			var i = this.length;
			if (i === 0) return false;
			while (--i) {
				var j = Math.floor(Math.random() * (i + 1));
				var tempi = this[i];
				var tempj = this[j];
				this[i] = tempj;
				this[j] = tempi;
			}
		};
		Array.prototype.toObject = function () {
			var o = {};
			for (var i = 0; i < this.length; i++) {
				o[this[i]] = '';
			}
			return o;
		};
		function bindEvent(el, eventName, eventHandler) {
			if (el.addEventListener) {
				el.addEventListener(eventName, eventHandler, false);
			} else if (el.attachEvent) {
				el.attachEvent('on' + eventName, eventHandler);
			}
		}
		function div(parent, className) {
			var r = document.createElement('div');
			r.className = className;
			parent.appendChild(r);
			return r;
		}
		var Wheel = (function () {
			var wheel = document.getElementById('wheel'),
				wheelValues = [
					"points",
					"freight",
					"voucher",
					"platinum",
					"pricelist",
					"gift"
				],
				spinTimeout = false,
				spinModifier = function () {
					var rand = Math.random();
					return (rand * 10) + 35;
				},
				modifier = spinModifier(),
				slowdownSpeed = 0.15,
				prefix = (function () {
					if (document.body.style.MozTransform !== undefined) {
						return "MozTransform";
					} else if (document.body.style.WebkitTransform !== undefined) {
						return "WebkitTransform";
					} else if (document.body.style.OTransform !== undefined) {
						return "OTransform";
					} else {
						return "";
					}
				}()),
				degreeToRadian = function (deg) {
					return deg / (Math.PI * 180);
				};
			function Wheel() { }
			Wheel.prototype.rotate = function (degrees) {
				var val = "rotate(-" + degrees + "deg)";
				if (wheel.style[prefix] !== undefined) wheel.style[prefix] = val;
				var rad = degreeToRadian(degrees % 360),
					filter = "progid:DXImageTransform.Microsoft.Matrix(sizingMethod='auto expand', M11=" + rad + ", M12=-" + rad + ", M21=" + rad + ", M22=" + rad + ")";
				if (wheel.style.filter !== undefined) wheel.style.filter = filter;
				wheel.setAttribute("data-rotation", degrees);
			};
			Wheel.prototype.addEventListener = function (eventName, eventHandler) {
				wheel.addEventListener(eventName, eventHandler, false);
			}
			Wheel.prototype.spin = function (callback, amount) {
				document.getElementById("spin").style.display = "none";
				var _this = this;
				clearTimeout(spinTimeout);
				modifier -= slowdownSpeed;
				if (amount === undefined) {
					amount = parseInt(wheel.getAttribute('data-rotation'), 10);
				}
				this.rotate(amount);
				if (modifier > 0) {
					spinTimeout = setTimeout(function () {
						_this.spin(callback, amount + modifier);
					}, 20);
				} else {
					var dataRotation = parseInt(wheel.getAttribute('data-rotation'), 10);
					modifier = spinModifier();
					var divider = 360 / wheelValues.length;
					var offset = divider / 2; //half division
					var wheelValue = wheelValues[Math.floor(Math.ceil((dataRotation + offset) % 360) / divider)];
					return callback(wheelValue);
				}
			};
			return Wheel;
		})();
		var WheelGame = (function () {
			var wheel = new Wheel(),
				spinWheel = document.getElementById('spin')
			function WheelGame() {
				var spinTheWheel = function () {
					wheel.spin(function (valueSpun) {
						var coupon, text, link;
						if (valueSpun == "points") {
							coupon = "CANTU1000PTS";
							text = "You won 1,000 CantuPneus points, valid on any order.";
							link = "#collections";
						}
						else if (valueSpun == "freight") {
							coupon = "CANTUFRETE";
							text = "You won free CIF freight on your next full-load order.";
							link = "#contact";
						}
						else if (valueSpun == "voucher") {
							coupon = "CANTU50BRL";
							text = "You won a R$ 250 voucher valid on selected sizes.";
							link = "#collections";
						}
						else if (valueSpun == "platinum") {
							coupon = "CANTUPLATINUM";
							text = "You joined the Platinum Fleet program, with exclusive CantuPneus terms.";
							link = "#contact";
						}
						else if (valueSpun == "pricelist") {
							coupon = "CANTUNOVO";
							text = "You secured early access to the next price list.";
							link = "#collections";
						}
						else if (valueSpun == "gift") {
							coupon = "CANTUCARGA";
							text = "You won a surprise CantuPneus gift with your next order.";
							link = "#contact";
						}
						else {
							alert(valueSpun);
							return false;
						}
						setTimeout(function () {
							finalize(coupon, text, link);
						}, 1000);
						
					});
				};
				bindEvent(spinWheel, "click", spinTheWheel);
				bindEvent(wheel, "click", spinTheWheel);
			}
			return WheelGame;
		})();
		var Game = new WheelGame();
	}


	function createMsg(text, danger) {
		// Message notification function
		randNum = (min, max) => {
			return Math.floor(Math.random() * (max - min + 1)) + min;
		}
		const randId = randNum(1, 999999);
		var msg = document.createElement("div");
		msg.id = "dng-cjs-" + randId;
		msg.innerText = text;
		msg.style.zIndex = "1000000002";
		msg.style.padding = "20px 25px";
		msg.style.borderRadius = "15px";
		msg.style.position = "fixed";
		msg.style.verticalAlign = "middle";
		msg.style.textAlign = "center";
		msg.style.top = "-250px";
		msg.style.color = "white";
		msg.style.fontSize = "16px";
		msg.style.background = danger ? "#fb6a78" : "rgb(154 161 223)";
		msg.style.transform = "translate(-50%, -50%)";
		msg.style.boxShadow = "0px 0px 8px 0px "+(danger ? "#fb6a78" : "rgb(154 161 223)");
		msg.style.left = "50%";
		msg.style.transition = "all .2s linear 0s";
		document.body.appendChild(msg);
		setTimeout(() => {
			document.querySelector("#dng-cjs-" + randId).style.top = "5%"
		}, 200);
		setTimeout(() => {
			document.querySelector("#dng-cjs-" + randId).style.opacity = "0"
		}, 2700);
		setTimeout(() => {
			document.querySelector("#dng-cjs-" + randId).remove()
		}, 3000);
	}
}

function LikeCardGame(){

function getCookie(cname) {
let name = cname + "=";
let ca = document.cookie.split(';');
for(let i = 0; i < ca.length; i++) {
let c = ca[i];
while (c.charAt(0) == ' ') {
c = c.substring(1);
}
if (c.indexOf(name) == 0) {
return c.substring(name.length, c.length);
}
}
return "";
}

//Global Head Variable
var head = document.getElementsByTagName('head')[0];


//Hammer JS Added
JS=document.createElement("script");
JS.type="text/javascript";
JS.async=true;
JS.src="vendor/hammer.min.js";
JS.onload=runGame;
JS.onerror = function () {
_this.OnError();
};
head.appendChild(JS);

// RunGame Function
function runGame(){

//Global Device Variable
var isDesktop= window.innerWidth>600;

//Global Variable Defination
var slideleft=0;
var slideright=0;
var slidetotal=0;
//All Css 
var style= document.createElement("style");
style.innerHTML= `
.tinder {width: 100vw;height: 87vh;max-width: 650px; max-height: 650px; overflow: hidden;display: flex;flex-direction: column;position: relative;opacity: 0;transition: opacity 0.1s ease-in-out;}
.loaded.tinder {opacity: 1;}
.tinder--status {position: absolute;top: 50%;margin-top: -30px;z-index: 2;width: 100%;text-align: center;pointer-events: none;}
.tinder--status i {font-size: 100px;opacity: 0;transform: scale(0.3);transition: all 0.2s ease-in-out;position: absolute;width: 100px;margin-left: -50px;}
.tinder_love .fa-heart{  opacity: 1;  transform: scale(1.07); }
.tinder_nope .fa-remove {  opacity: 1;transform: scale(1.07); }
.tinder_love #love {background: rgba(184, 134, 11, .85) !important}
.tinder_nope #nope {background: rgba(28, 28, 28, .75) !important}
.tinder_love #love i {color: #F6F4FA !important;}
.tinder_nope #nope i {color: #F6F4FA !important;}
.tinder--cards {flex-grow: 1;text-align: center;display: flex;justify-content: center;align-items: flex-end;z-index: 1;}
.tinder--card {margin: 0; padding: 0; display: inline-block;width: 90vw;max-width: 400px;height: 70vh;max-height: 460px;background: #F6F4FA;border-radius: 18px;overflow: hidden;position: absolute;will-change: transform;transition: all 0.3s ease-in-out;cursor: -webkit-grab;cursor: -moz-grab;cursor: grab; box-shadow: 0 18px 44px rgba(28,28,28,0.32); border: 1px solid rgba(184,134,11,0.22);}
.moving.tinder--card {  transition: none;  cursor: -webkit-grabbing;  cursor: -moz-grabbing;  cursor: grabbing;}
.tinder--card img {  width: 100%; height: 78%; object-fit: cover; display: block; pointer-events: none;}
.tinder--card-label {position: absolute; left: 0; right: 0; bottom: 0; height: 22%; padding: 14px 18px; background: linear-gradient(180deg, rgba(255,251,245,0.92) 0%, #F6F4FA 100%); display: flex; flex-direction: column; justify-content: center; gap: 4px; text-align: left; pointer-events: none;}
.tinder--card-label .eyebrow {font-size: 11px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: #35015F;}
.tinder--card-label .title {font-family: "Barlow Condensed", Georgia, serif; font-size: 22px; font-weight: 500; color: #1A1030; line-height: 1.15;}
.tinder--buttons {   display: flex;   justify-content: center;  align-items: center;flex: 0 0 130px;  text-align: center;  padding-top: 20px; z-index: 5;}
.tinder--buttons button {  border-radius: 50%; min-width: 77px;  min-height: 77px;  border: 1px solid rgba(184,134,11,0.4);  background: #F6F4FA;  display: inline-block;  margin: 0 12px; box-shadow: 0 6px 16px rgba(28,28,28,0.22); transition: transform 0.15s ease, background 0.2s ease;}
.tinder--buttons button:hover { transform: translateY(-2px); }
.tinder--buttons button:focus {outline: 0;}
.tinder--buttons i {  font-size: 36px;  vertical-align: middle;}
.fa-heart {color: #4E018F; width: 30px; height: 30px;}
.fa-remove {color: #1A1030; width: 30px; height: 30px;}
#cookie-status{ display:block !important;}
#dng_cjs_likeCard_overlay_wrapper{position: absolute; top: 0; right: 0; left: 0; bottom: 0;}
#dng_cjs_likeCard_overlay{position: fixed; top: 0; bottom: 0; left: 0; right: 0; opacity: 0.7; width: 100%; height: 100%; background: linear-gradient(135deg, rgba(28,28,28,0.92) 0%, rgba(58,58,58,0.88) 55%, rgba(139,105,20,0.85) 100%); z-index:100000003}
#dng_cjs_likeCard_content_fixed{overflow:hidden; border-radius:10px; position: fixed; top: 50%; left: 50%; opacity: 1; z-index: 100000004; webkit-transform: translate(-50%, -50%); transform: translate(-50%, -50%);}
#img_lightbox_close{position: absolute; top: 10px; right: 10px; cursor: pointer; opacity: 1; z-index: 100000003;}
.btn_back{background: #4E018F !important;}
.dng_cjs_tinder_back_image{position: fixed; inset: 0; width: 100%; height: 100%; min-width: 0; object-fit: cover; opacity: 0.45;}
@media only screen and (max-width: 600px) {.tinder--card {display: inline-block;width: 90vw;max-width: 400px;background: #F6F4FA;border-radius: 14px;overflow: hidden;position: absolute;will-change: transform;transition: all 0.3s ease-in-out;cursor: -webkit-grab;cursor: -moz-grab;cursor: grab;} .tinder--card-label .title {font-size: 19px;} }
`;

document.head.appendChild(style);

// Fire Tinder Function
function dngLikeCard(){

var visi=document.createElement("div");
visi.setAttribute("id","dng_cjs_likecard_container");

var overlay = document.createElement("div");
overlay.setAttribute("id","dng_cjs_likeCard_overlay_wrapper");

overlay.style.zIndex="1000003";
var overlay_light = document.createElement("div"); 
overlay_light.setAttribute("id","dng_cjs_likeCard_overlay"); 
overlay.appendChild(overlay_light);

var overlay_content=document.createElement("div");    
overlay_content.setAttribute("id","dng_cjs_likeCard_content_fixed");

var popbox = document.createElement("div");
popbox.setAttribute("id","dng_cjs_likeCard_popbox");
popbox.style.height='auto';
popbox.style.width='auto';

var dng_cjs_card_like = document.createElement("div");
dng_cjs_card_like.innerHTML= `
<div class="tinder">
<div class="tinder--status">
  <svg class="fa fa-remove" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
  <svg class="fa fa-heart" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 21s-7.5-4.9-9.6-9A5.6 5.6 0 0 1 12 6.2 5.6 5.6 0 0 1 21.6 12c-2.1 4.1-9.6 9-9.6 9Z"/></svg>
</div>
  <div class="tinder--cards">
    <div data-id="carga" class="tinder--card">
     <img src="images/scenes/hero-carga.jpg" alt="Truck Line">
     <div class="tinder--card-label">
       <span class="eyebrow">Truck Line</span>
       <span class="title">Marshal KLD01 295/80 R22.5</span>
     </div>
    </div>
    <div data-id="recap" class="tinder--card">
     <img src="images/scenes/story-frota.jpg" alt="Marshal KLD01 295/80 R22.5">
     <div class="tinder--card-label">
       <span class="eyebrow">Novo lote</span>
       <span class="title">Marshal KLD01 295/80 R22.5</span>
     </div>
    </div>
    <div data-id="heritage" class="tinder--card">
     <img src="images/scenes/linha-agricola.jpg" alt="Industrial & OTR Line">
     <div class="tinder--card-label">
       <span class="eyebrow">CantuPneus Operations</span>
       <span class="title">Aeolus HN08 Neo 295/80 R22.5</span>
     </div>
    </div>
    <div data-id="statement" class="tinder--card">
     <img src="images/scenes/linha-otr.jpg" alt="Agricultural Line">
     <div class="tinder--card-label">
       <span class="eyebrow">Agricultural Line</span>
       <span class="title">CEAT Farmax R1W 18.4-34</span>
     </div>
    </div>
 </div>
        <div class="tinder--buttons">
           <button id="nope" aria-label="Pular"><svg class="fa fa-remove" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
          <button id="love" aria-label="Save"><svg class="fa fa-heart" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 21s-7.5-4.9-9.6-9A5.6 5.6 0 0 1 12 6.2 5.6 5.6 0 0 1 21.6 12c-2.1 4.1-9.6 9-9.6 9Z"/></svg></button>
        </div>
</div>`;

popbox.append(dng_cjs_card_like);
var cls_btn = document.createElement("div");
cls_btn.innerHTML = '<button id="dng-cjs-form-close" style="position: absolute; width:auto; right: 0px; top: 0px; border: 0px; color: #fff; padding: 5px 10px; cursor: pointer; font-size: 29px; transition: all 1s ease 0s; border-radius: 10px; background-color: rgba(0, 0, 0, 0); z-index: 999; transform: translate3d(0px, 0px, 3px);">✖</button>'
cls_btn.onclick=closeclick;

overlay_content.appendChild(popbox);
overlay_content.appendChild(cls_btn); 

visi.appendChild(overlay);
visi.appendChild(overlay_content);

document.querySelector("body").appendChild(visi);


function closeclick(){
var t=document.querySelector("#dng_cjs_likecard_container");
t.remove();
}

}

dngLikeCard();

var tinderContainer = document.querySelector('.tinder');
var allCards = document.querySelectorAll('.tinder--card');
var nope = document.getElementById('nope');
var love = document.getElementById('love');

function initCards(card, index) {
var newCards = document.querySelectorAll('.tinder--card:not(.removed)');

newCards.forEach(function (card, index) {
card.style.zIndex = allCards.length - index;
card.style.transform = `scale(${(20 - index) / 20}) translateY(-${30 * index}px)`;
card.style.opacity = (10 - index) / 10; 
});

tinderContainer.classList.add('loaded');
}

initCards();

allCards.forEach(function (el) {
var hammertime = new Hammer(el);

hammertime.on('pan', function (event) {
el.classList.add('moving');
});

hammertime.on('pan', function (event) {
if (event.deltaX === 0) return;
if (event.center.x === 0 && event.center.y === 0) return;

tinderContainer.classList.toggle('tinder_love', event.deltaX > 0);
tinderContainer.classList.toggle('tinder_nope', event.deltaX < 0);
var xMulti = event.deltaX * 0.03;
var yMulti = event.deltaY / 80;
var rotate = xMulti * yMulti;

event.target.style.transform = `translate(${event.deltaX}px, ${event.deltaY}px) rotate(${rotate}deg)`;
});

hammertime.on('panend', function (event) {
el.classList.remove('moving');
if(tinderContainer.classList.value.includes("tinder_nope")){
slideleft++;
slideright=0;
console.log("Swiped Left:" ,slideleft);
}
else if (tinderContainer.classList.value.includes("tinder_love")){
slideright++;
slideleft=0;
console.log("Saved:" , slideright);
}
tinderContainer.classList.remove('tinder_love');
tinderContainer.classList.remove('tinder_nope');

var moveOutWidth = document.body.clientWidth;
var keep = Math.abs(event.deltaX) < 80 || Math.abs(event.velocityX) < 0.5;

event.target.classList.toggle('removed', !keep);

if (keep) {
event.target.style.transform = '';
slideright=0;slideleft=0;
} else {
var endX = Math.max(Math.abs(event.velocityX) * moveOutWidth, moveOutWidth);
var toX = event.deltaX > 0 ? endX : -endX;
var endY = Math.abs(event.velocityY) * moveOutWidth;
var toY = event.deltaY > 0 ? endY : -endY;
var xMulti = event.deltaX * 0.03;
var yMulti = event.deltaY / 80;
var rotate = xMulti * yMulti;

event.target.style.transform = `translate(${toX}px, ${(toY + event.deltaY)}px) rotate(${rotate}deg)`;
initCards();

console.log("card removed");
if(slideright>0){
  sendEvent(true);
  slideright=0;
}
if(slideleft>0){
  sendEvent(false);
}
}
});
});

function createButtonListener(love) {
return function (event) {
var cards = document.querySelectorAll('.tinder--card:not(.removed)');
var moveOutWidth = document.body.clientWidth * 1.5;

if (!cards.length){
console.log("no cards available");
}

var card = cards[0];
card.classList.add('removed');
var removedcards = document.querySelectorAll('.removed');
console.log(removedcards);
if (love) {
card.style.transform = `translate(${moveOutWidth}px, -100px) rotate(-30deg)`;
sendEvent(true);

} else {
card.style.transform = `translate(-${moveOutWidth}px, -100px) rotate(30deg)`;
sendEvent(false);
}

initCards();

event.preventDefault();
};
}

var nopeListener = createButtonListener(false);
var loveListener = createButtonListener(true);

nope.addEventListener('click', nopeListener);
love.addEventListener('click', loveListener);

function sendEvent(send){

var deltaElem= document.querySelectorAll(".tinder--card")[slidetotal];
var useEventAttr=deltaElem.getAttribute("data-id");

if(send){
console.log("swiped right event sent" + useEventAttr);
SecondSettingsPopup(useEventAttr);

}
else{
console.log("swiped left event sent" + useEventAttr);


}
slidetotal++;
if(slidetotal==4){
console.log("all cards finished, closing game");
var controlCookie=getCookie("ProductType");
if(controlCookie=="allnope"){
}
document.querySelector("#dng_cjs_likecard_container").remove();
}
}
}


function SecondSettingsPopup(imagetype) {
var isDesktop= window.innerWidth>600;
var desktopWidth = "560px";
var desktopHeight = "auto";
var mobileWidth = window.innerWidth+"px";
var mobileHeight = "auto";
var image;
var code;
var title;
var subtitle;
switch (imagetype) {
case "carga":
image="images/scenes/hero-carga.jpg";
code="CANTU-CARGA";
title="Marshal KLD01 saved to your CantuPneus list";
subtitle="We will let you know as soon as a new truck-line batch opens.";
break;
case "recap":
image="images/scenes/story-frota.jpg";
code="CANTU-KLD01";
title="Marshal KLD01 295/80 R22.5 saved to favorites";
subtitle="Get the price list before everyone else.";
break;
case "heritage":
image="images/scenes/linha-agricola.jpg";
code="CANTU-FROTA";
title="Aeolus AL37 OTR noted for you";
subtitle="A CantuPneus advisor will walk you through full-load terms.";
break;
case "statement":
image="images/scenes/linha-otr.jpg";
code="CANTU-AGRO";
title="Kumho Solus TA31 saved";
subtitle="See more sizes with special fleet terms.";
break;
default:
image="images/scenes/linha-carga.jpg";
code="CANTU-BRINDE";
title="A special CantuPneus deal is waiting for you";
subtitle="Talk to your CantuPneus advisor to unlock the benefit.";
}

LikeCardChoosePopup(desktopWidth, desktopHeight, mobileWidth, mobileHeight, image, code, title, subtitle);
}


function LikeCardChoosePopup(width, height, mWidth, mHeight, img, code, title, subtitle ) {
if (!document.querySelector(".dng-cjs-ChoosePopup-container")) {
var style = document.createElement("style");
style.innerHTML = `
.dng-cjs-ChoosePopup-container{z-index: 999999999;width: 100%;height: 100%;position: fixed;top: 0;left: 0; font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;}
.dng-cjs-ChoosePopup-overlay{z-index: 10000;width: 100%;height: 100%;background: rgba(28, 28, 28, 0.7);position: fixed;top: 0;left: 0;}
.dng-cjs-ChoosePopup{overflow:hidden; border-radius:16px; position:absolute;z-index:100001;width:${width};max-width:calc(100vw - 40px);height:auto;left: 50%;top: 50%;transform: translate(-50%,-50%);-webkit-transform: translate(-50%,-50%); background: #F6F4FA; box-shadow: 0 24px 60px rgba(0,0,0,0.45); display: flex; flex-direction: column;}
.dng-cjs-likecard-secondimg{width: 100%; height: 280px; object-fit: cover; display: block;}
.dng-cjs-likecard-body{padding: 22px 26px 24px; text-align: center;}
.dng-cjs-likecard-eyebrow{display:inline-block; font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#35015F;margin-bottom:8px;}
.dng-cjs-likecard-title{font-family:"Barlow Condensed",Georgia,serif;font-weight:500;font-size:26px;line-height:1.2;color:#1A1030;margin:0 0 8px;}
.dng-cjs-likecard-subtitle{font-size:14px;line-height:1.5;color:#3A3A3A;margin:0 0 16px;}
.dng-cjs-likecard-code{display:inline-block;border:2px dashed #4E018F;padding:10px 18px;border-radius:10px;color:#1A1030;background:#EDE9F5;font-weight:700;font-size:14px;letter-spacing:0.22em;margin-bottom:18px;}
.dng-cjs-likecard-actions{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;}
.dng-cjs-likecard-givecode{display:inline-flex;align-items:center;justify-content:center;padding:11px 22px;background:#1A1030;color:#F6F4FA;border:1px solid #1A1030;border-radius:999px;font-weight:700;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;cursor:pointer;transition:background 0.2s ease,color 0.2s ease;}
.dng-cjs-likecard-givecode:hover{background:#F6F4FA;color:#1A1030;}
.dng-cjs-likecard-tryagain{display:inline-flex;align-items:center;justify-content:center;padding:11px 22px;background:transparent;color:#3A3A3A;border:1px solid rgba(28,28,28,0.2);border-radius:999px;font-weight:700;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;cursor:pointer;transition:border-color 0.2s ease,color 0.2s ease;}
.dng-cjs-likecard-tryagain:hover{border-color:#1A1030;color:#1A1030;}
.dng-cjs-ChoosePopup-close{position: absolute;right: 12px;top: 12px;cursor: pointer;z-index: 100002;width:32px;height:32px;border-radius:50%;background:rgba(28,28,28,0.55);color:#fff;border:1px solid rgba(255,255,255,0.35);display:flex;align-items:center;justify-content:center;font-size:16px;line-height:1;}
.dng-cjs-ChoosePopup-close:hover{background:rgba(28,28,28,0.8);}
@media only screen and (max-width: 768px) {
    .dng-cjs-ChoosePopup {width:${mWidth};max-width:calc(100vw - 28px);}
    .dng-cjs-likecard-secondimg{height: 220px;}
    .dng-cjs-likecard-title{font-size:22px;}
}
`;
document.head.append(style);

var div = document.createElement("div");
div.setAttribute("class", "dng-cjs-ChoosePopup-container");
div.innerHTML = `
<div class="dng-cjs-ChoosePopup-overlay"></div> 
<div class="dng-cjs-ChoosePopup">
<button id="dng-cjs-form-close" class="dng-cjs-ChoosePopup-close" type="button" aria-label="Close">✖</button>
<img class="dng-cjs-likecard-secondimg" data-id="${code}" src="${img}" alt="${title}">
<div class="dng-cjs-likecard-body">
  <span class="dng-cjs-likecard-eyebrow">CantuPneus</span>
  <h3 class="dng-cjs-likecard-title">${title}</h3>
  <p class="dng-cjs-likecard-subtitle">${subtitle}</p>
  <div class="dng-cjs-likecard-code">${code}</div>
  <div class="dng-cjs-likecard-actions">
    <button class="dng-cjs-likecard-givecode" type="button">Revelar oferta</button>
    <button class="dng-cjs-likecard-tryagain" type="button">Continuar</button>
  </div>
</div>
</div>
`;
document.body.append(div);


document.querySelector(".dng-cjs-ChoosePopup-overlay").addEventListener("click", closePopup);
document.querySelector(".dng-cjs-ChoosePopup-close").addEventListener("click", closePopup);
document.querySelector(".dng-cjs-likecard-givecode").addEventListener("click", runcodepopup);
document.querySelector(".dng-cjs-likecard-tryagain").addEventListener("click", closePopup);


function closePopup() {
    document.querySelector(".dng-cjs-ChoosePopup-container").remove();
}

function runcodepopup(){
    
    var likecardgame=document.querySelector("#dng_cjs_likecard_container");
    if(likecardgame)
    {
        document.querySelector("#dng_cjs_likecard_container").remove();
    }
    document.querySelector(".dng-cjs-ChoosePopup-container").remove();
}
}
}
}

