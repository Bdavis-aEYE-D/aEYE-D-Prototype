'use strict';

// ======================= POST MAKER =======================
// Template system: v1 ships with one template (Iris Story — 9:16 story card).
// Future templates slot in by pushing to PM_TEMPLATES.

var PM_TEMPLATES = [
  { id: 'iris-story',  icon: '👁',  label: 'Iris Story',  desc: '9:16 · Iris Close-Up' },
  { id: 'full-eye',    icon: '✨', label: 'Full Eye',     desc: 'Coming soon', comingSoon: true },
  { id: 'both-eyes',   icon: '🌟', label: 'Both Eyes',   desc: 'Coming soon', comingSoon: true },
  { id: 'full-face',   icon: '📸', label: 'Full Face',   desc: 'Coming soon', comingSoon: true },
];
var pmActiveTemplate = 'iris-story';
var _pmPickerInited  = false;

// ---- called by tab switcher in app.js ----
function drawPostStage() {
  if (!_pmPickerInited) { _initPostPicker(); _pmPickerInited = true; }
  _renderPostAsync();
}

// ---- Build template picker chips ----
function _initPostPicker() {
  var picker = document.getElementById('pm-template-picker');
  if (!picker) return;
  picker.innerHTML = '';
  PM_TEMPLATES.forEach(function(t) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pm-tmpl-btn'
      + (t.id === pmActiveTemplate ? ' active' : '')
      + (t.comingSoon ? ' soon' : '');
    btn.innerHTML =
      '<span class="pm-tmpl-icon">' + t.icon + '</span>' +
      '<span class="pm-tmpl-label">' + t.label + '</span>' +
      '<span class="pm-tmpl-desc">' + t.desc + '</span>';
    if (!t.comingSoon) {
      btn.addEventListener('click', function() {
        pmActiveTemplate = t.id;
        var all = document.querySelectorAll('.pm-tmpl-btn');
        for (var i = 0; i < all.length; i++) all[i].classList.remove('active');
        btn.classList.add('active');
        _renderPostAsync();
      });
    }
    picker.appendChild(btn);
  });
}

// ---- Load stored image then render (avoids flickering on repeat calls) ----
function _renderPostAsync() {
  var result = window.__lastResult;
  if (!result) { _renderPlaceholder(); return; }

  var stored = result.portraitImage || result.analysisImage || null;
  if (stored && stored.src && !stored._loadedImg) {
    var img = new Image();
    img.onload  = function() { stored._loadedImg = img; _renderCard(result); };
    img.onerror = function() { _renderCard(result); };
    img.src = stored.src;
  } else {
    _renderCard(result);
  }
}

function _renderCard(result) {
  var c = document.getElementById('post-canvas');
  if (!c) return;
  c.width  = 1080;
  c.height = 1920;
  var ctx = c.getContext('2d');
  if (pmActiveTemplate === 'iris-story') {
    _drawIrisStoryCard(ctx, 1080, 1920, result);
  }
}

function _renderPlaceholder() {
  var c = document.getElementById('post-canvas');
  if (!c) return;
  var W = c.width = 1080, H = c.height = 1920;
  var ctx = c.getContext('2d');
  ctx.fillStyle = '#060a14'; ctx.fillRect(0, 0, W, H);
  // Faint eye icon
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.font = '300px serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.fillText('👁', W/2, H*0.42);
  ctx.restore();
  ctx.fillStyle = 'rgba(170,177,204,0.55)';
  ctx.font = '700 40px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText('Analyze an iris first', W/2, H*0.58);
  ctx.fillStyle = 'rgba(170,177,204,0.30)';
  ctx.font = '400 30px -apple-system, sans-serif';
  ctx.fillText('Then your post will appear here', W/2, H*0.58 + 56);
  // eyeD bottom badge
  _drawBottomBadge(ctx, W, H, [80, 100, 140]);
}

// =============================================================
//  TEMPLATE: IRIS STORY  —  1080 × 1920  (9:16 story format)
// =============================================================
function _drawIrisStoryCard(ctx, W, H, result) {
  var baseRgb = result.fingerprint ? result.fingerprint.rgb : [60, 80, 130];

  // ---- Helpers ----
  function rgb(r) { return 'rgb(' + r[0] + ',' + r[1] + ',' + r[2] + ')'; }
  function rgba(r, a) { return 'rgba(' + r[0] + ',' + r[1] + ',' + r[2] + ',' + a + ')'; }
  function darken(r, n) { return [Math.max(0,r[0]-n), Math.max(0,r[1]-n), Math.max(0,r[2]-n)]; }
  function lighten(r, n) { return [Math.min(255,r[0]+n), Math.min(255,r[1]+n), Math.min(255,r[2]+n)]; }

  // ---- 1. Background ----
  ctx.fillStyle = '#060a14'; ctx.fillRect(0, 0, W, H);

  // Radial color wash centered on where the iris will sit
  var irisCenterY = Math.round(H * 0.365);
  var wash = ctx.createRadialGradient(W/2, irisCenterY, 0, W/2, irisCenterY, W * 0.9);
  wash.addColorStop(0, rgba(darken(baseRgb, 10), 0.42));
  wash.addColorStop(0.55, rgba(darken(baseRgb, 40), 0.12));
  wash.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = wash; ctx.fillRect(0, 0, W, H);

  // Subtle bottom-darkening gradient so CTA text always pops
  var bottomFade = ctx.createLinearGradient(0, H * 0.65, 0, H);
  bottomFade.addColorStop(0, 'rgba(0,0,0,0)');
  bottomFade.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = bottomFade; ctx.fillRect(0, H * 0.65, W, H * 0.35);

  // ---- 2. Iris hero circle ----
  var irisCx = W / 2;
  var irisCy = irisCenterY;
  var irisR  = 340;

  // Bloom / glow rings
  ctx.save();
  for (var b = 0; b < 7; b++) {
    var rr = irisR + 10 + b * 22;
    var alpha = 0.22 - b * 0.028;
    var bloomG = ctx.createRadialGradient(irisCx, irisCy, irisR - 10, irisCx, irisCy, rr + 20);
    bloomG.addColorStop(0, rgba(baseRgb, alpha));
    bloomG.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bloomG;
    ctx.beginPath(); ctx.arc(irisCx, irisCy, rr + 20, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  // Subtle outer ring border
  ctx.save();
  ctx.beginPath(); ctx.arc(irisCx, irisCy, irisR + 6, 0, Math.PI * 2);
  ctx.strokeStyle = rgba(lighten(baseRgb, 60), 0.5);
  ctx.lineWidth = 2.5; ctx.stroke();
  ctx.restore();

  // Iris crop (clipped circle)
  ctx.save();
  ctx.beginPath(); ctx.arc(irisCx, irisCy, irisR, 0, Math.PI * 2); ctx.clip();

  var stored  = result.portraitImage || result.analysisImage || null;
  var srcImg  = (stored && stored._loadedImg) ? stored._loadedImg
              : ((typeof imgEl !== 'undefined') ? imgEl : null);
  var irisSpec = (stored && stored.iris) ? stored.iris
               : ((typeof donut !== 'undefined' && donut) ?
                  { cx: donut.cx, cy: donut.cy, rIris: donut.rIris,
                    rPupil: donut.rPupil,
                    drawInfo: (typeof drawInfo !== 'undefined') ? drawInfo : null }
                  : null);

  var drewReal = false;
  if (srcImg && irisSpec && irisSpec.rIris && irisSpec.drawInfo && irisSpec.drawInfo.dw > 0) {
    var srcW = srcImg.naturalWidth  || srcImg.width;
    var srcH = srcImg.naturalHeight || srcImg.height;
    var di   = irisSpec.drawInfo;
    var sxR  = srcW / di.dw, syR = srcH / di.dh;
    var imgIrisX = (irisSpec.cx - di.dx) * sxR;
    var imgIrisY = (irisSpec.cy - di.dy) * syR;
    var imgIrisR = irisSpec.rIris * sxR;
    var crop = imgIrisR * 1.90;
    var sx = imgIrisX - crop / 2, sy = imgIrisY - crop / 2;
    ctx.fillStyle = rgb(darken(baseRgb, 20));
    ctx.fillRect(irisCx - irisR, irisCy - irisR, irisR*2, irisR*2);
    var sX0 = Math.max(0, sx), sY0 = Math.max(0, sy);
    var sX1 = Math.min(srcW, sx + crop), sY1 = Math.min(srcH, sy + crop);
    if (sX1 > sX0 && sY1 > sY0) {
      var dx0 = (sX0 - sx)/crop, dy0 = (sY0 - sy)/crop;
      var dx1 = (sX1 - sx)/crop, dy1 = (sY1 - sy)/crop;
      ctx.drawImage(srcImg, sX0, sY0, sX1-sX0, sY1-sY0,
        irisCx - irisR + dx0*(irisR*2), irisCy - irisR + dy0*(irisR*2),
        (dx1-dx0)*(irisR*2), (dy1-dy0)*(irisR*2));
      drewReal = true;
    }
  }
  if (!drewReal) {
    // Fallback: painted color disc
    var disc = ctx.createRadialGradient(irisCx, irisCy, 0, irisCx, irisCy, irisR);
    disc.addColorStop(0, rgb(lighten(baseRgb, 50)));
    disc.addColorStop(0.65, rgb(baseRgb));
    disc.addColorStop(1, rgb(darken(baseRgb, 40)));
    ctx.fillStyle = disc;
    ctx.fillRect(irisCx - irisR, irisCy - irisR, irisR*2, irisR*2);
    // Pupil
    ctx.fillStyle = '#05080f';
    ctx.beginPath(); ctx.arc(irisCx, irisCy, irisR * 0.28, 0, Math.PI*2); ctx.fill();
    // Catch-light
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.beginPath(); ctx.arc(irisCx - irisR*0.12, irisCy - irisR*0.18, irisR*0.05, 0, Math.PI*2); ctx.fill();
  }

  // Inner vignette on iris edge
  var iVig = ctx.createRadialGradient(irisCx, irisCy, irisR*0.62, irisCx, irisCy, irisR);
  iVig.addColorStop(0, 'rgba(0,0,0,0)');
  iVig.addColorStop(1, 'rgba(0,0,0,0.30)');
  ctx.fillStyle = iVig;
  ctx.fillRect(irisCx - irisR, irisCy - irisR, irisR*2, irisR*2);
  ctx.restore();

  // ---- 3. Color name ----
  var textY = irisCy + irisR + 68;

  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  var nameText = result.overall.name.toUpperCase();
  ctx.font = '800 96px -apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif';
  var nw = ctx.measureText(nameText).width;
  if (nw > W - 100) {
    ctx.font = '800 ' + Math.round(96 * (W - 100) / nw) + 'px -apple-system, BlinkMacSystemFont, sans-serif';
  }
  ctx.fillStyle = 'rgba(255,255,255,0.97)';
  ctx.fillText(nameText, W/2, textY);

  // Gradient underline
  var ulY = textY + 108;
  var ulGrad = ctx.createLinearGradient(W*0.18, ulY, W*0.82, ulY);
  ulGrad.addColorStop(0, 'rgba(0,0,0,0)');
  ulGrad.addColorStop(0.5, rgba(lighten(baseRgb, 70), 0.95));
  ulGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = ulGrad; ctx.fillRect(W*0.18, ulY, W*0.64, 3);

  // ---- 4. Rarity ----
  var rarityY = ulY + 38;

  if (result.rarity) {
    ctx.font = '700 38px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = 'rgba(255,232,140,0.94)';
    var rarPct = result.rarity.pct;
    ctx.fillText('✦  Only ' + rarPct + '% of people share this color  ✦', W/2, rarityY);
    rarityY += 60;
  }

  if (result.rarityScore !== null && result.rarityScore !== undefined) {
    var scoreLabel = (typeof rarityScoreLabel === 'function') ? rarityScoreLabel(result.rarityScore) : '';
    ctx.font = '600 30px -apple-system, sans-serif';
    ctx.fillStyle = rgba(lighten(baseRgb, 90), 0.80);
    ctx.fillText(result.rarityScore + '/100 Uniqueness  ·  ' + scoreLabel, W/2, rarityY);
    rarityY += 52;
  }

  // ---- 5. Feature pills (max 2 standout traits) ----
  var pills = (typeof buildFeaturePills === 'function') ? buildFeaturePills(result) : [];
  var pillY = rarityY + 20;
  pills.slice(0, 2).forEach(function(p) {
    _pmDrawPill(ctx, W/2, pillY + 28, p);
    pillY += 70;
  });
  pillY += 10;

  // ---- 6. Palette swatches (up to 6 siblings from same color family) ----
  var siblings = [];
  if (typeof PALETTE !== 'undefined') {
    for (var i = 0; i < PALETTE.length && siblings.length < 6; i++) {
      if (PALETTE[i].cat === result.overall.cat) siblings.push(PALETTE[i].rgb);
    }
  }
  if (siblings.length) {
    var sw = 56, sgap = 12;
    var totalSwW = siblings.length * sw + (siblings.length - 1) * sgap;
    var swX = (W - totalSwW) / 2;
    var swY = pillY + 20;
    siblings.forEach(function(srgb) {
      // Highlight the active swatch
      var isActive = Math.abs(srgb[0]-baseRgb[0]) + Math.abs(srgb[1]-baseRgb[1]) + Math.abs(srgb[2]-baseRgb[2]) < 15;
      ctx.fillStyle = rgb(srgb);
      _pmRoundRect(ctx, swX, swY, sw, sw, 11); ctx.fill();
      if (isActive) {
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
        _pmRoundRect(ctx, swX - 1, swY - 1, sw + 2, sw + 2, 12); ctx.stroke();
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1.5;
        _pmRoundRect(ctx, swX, swY, sw, sw, 11); ctx.stroke();
      }
      swX += sw + sgap;
    });
    pillY = swY + sw + 20;
  }

  // ---- 7. Bottom CTA ----
  _drawBottomBadge(ctx, W, H, baseRgb);

  // CTA block positioned in lower quarter
  var ctaZoneTop = H * 0.78;
  // Thin separator
  var sep = ctx.createLinearGradient(W*0.12, ctaZoneTop, W*0.88, ctaZoneTop);
  sep.addColorStop(0,   'rgba(255,255,255,0)');
  sep.addColorStop(0.5, 'rgba(255,255,255,0.22)');
  sep.addColorStop(1,   'rgba(255,255,255,0)');
  ctx.fillStyle = sep; ctx.fillRect(W*0.12, ctaZoneTop, W*0.76, 1.5);

  ctx.textAlign = 'center'; ctx.textBaseline = 'top';

  ctx.font = '400 42px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  ctx.fillText('What color are', W/2, ctaZoneTop + 40);

  ctx.font = '800 72px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,1.0)';
  ctx.fillText('YOUR EYES?', W/2, ctaZoneTop + 96);

  ctx.font = '600 34px -apple-system, sans-serif';
  ctx.fillStyle = rgba(lighten(baseRgb, 80), 0.80);
  ctx.fillText('Find out at iris.color', W/2, ctaZoneTop + 188);

  // Top mini badge
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.font = '700 26px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.40)';
  ctx.fillText('eye', 52, 58);
  var ew = ctx.measureText('eye').width;
  ctx.fillStyle = rgba(lighten(baseRgb, 50), 0.75);
  ctx.fillText('D', 52 + ew, 58);

  // Side · Davis Scale  top-right
  ctx.textAlign = 'right';
  ctx.font = '400 22px -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.32)';
  ctx.fillText(result.side + ' Eye  ·  Davis Scale', W - 52, 58);
}

// ---- bottom eyeD wordmark ----
function _drawBottomBadge(ctx, W, H, baseRgb) {
  function rgba(r, a) { return 'rgba(' + r[0] + ',' + r[1] + ',' + r[2] + ',' + a + ')'; }
  function lighten(r, n) { return [Math.min(255,r[0]+n), Math.min(255,r[1]+n), Math.min(255,r[2]+n)]; }

  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '700 30px -apple-system, BlinkMacSystemFont, sans-serif';
  // Build "eyeD  ·  #eyeD"
  var eyeW  = ctx.measureText('eye').width;
  var dW    = ctx.measureText('D').width;
  var tagW  = ctx.measureText('  ·  #eyeD').width;
  var total = eyeW + dW + tagW;
  var startX = W/2 - total/2;
  var bY = H - 60;

  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText('eye', startX, bY);
  ctx.fillStyle = rgba(lighten(baseRgb, 60), 0.88);
  ctx.fillText('D', startX + eyeW, bY);
  ctx.fillStyle = 'rgba(255,255,255,0.32)';
  ctx.font = '400 30px -apple-system, sans-serif';
  ctx.fillText('  ·  #eyeD', startX + eyeW + dW, bY);
  ctx.restore();
}

// ---- pill (matches share.js buildFeaturePills output) ----
function _pmDrawPill(ctx, cx, y, p) {
  var fontSize = 28;
  ctx.font = '500 ' + fontSize + 'px -apple-system, BlinkMacSystemFont, sans-serif';
  var lw = ctx.measureText(p.label).width;
  var dot = 20, padL = 26, padR = 26, gap = 12;
  var pillH = 54, pillW = Math.min(lw + padL + padR + dot + gap, 960);
  var x = cx - pillW / 2;

  ctx.fillStyle = 'rgba(0,0,0,0.42)';
  _pmRoundRect(ctx, x, y - pillH/2, pillW, pillH, pillH/2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1.5;
  _pmRoundRect(ctx, x, y - pillH/2, pillW, pillH, pillH/2); ctx.stroke();

  ctx.fillStyle = 'rgb(' + p.color[0] + ',' + p.color[1] + ',' + p.color[2] + ')';
  ctx.beginPath(); ctx.arc(x + padL + dot/2, y, dot/2, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(x + padL + dot/2, y, dot/2, 0, Math.PI*2); ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.90)';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.font = '500 ' + fontSize + 'px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText(p.label, x + padL + dot + gap, y);
  ctx.textAlign = 'center';
}

function _pmRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
