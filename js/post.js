'use strict';

// ======================= POST MAKER =======================
// Template system: v1 ships with one template (Iris Story — 9:16 story card).
// Future templates slot in by pushing to PM_TEMPLATES.

var PM_TEMPLATES = [
  { id: 'iris-story',  icon: '👁',  label: 'Iris Story',  desc: '9:16 · Iris Close-Up' },
  { id: 'full-eye',    icon: '✨', label: 'Full Eye',     desc: '9:16 · Eye + Lashes' },
  { id: 'both-eyes',   icon: '🌟', label: 'Both Eyes',   desc: '9:16 · Eye Pair' },
  { id: 'full-face',   icon: '📸', label: 'Full Face',   desc: '9:16 · Portrait Card' },
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

  // Both-eyes template needs images from both eyeResults — separate load path
  if (pmActiveTemplate === 'both-eyes') {
    _renderBothEyesAsync();
    return;
  }

  // Full-face template uses the in-memory originalImgEl — no async load needed
  if (pmActiveTemplate === 'full-face') {
    _renderCard(result);
    return;
  }

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

// Preload images for both eyeResults then render
function _renderBothEyesAsync() {
  var c = document.getElementById('post-canvas');
  if (!c) return;
  var rR = window.eyeResults && window.eyeResults['Right'];
  var rL = window.eyeResults && window.eyeResults['Left'];

  function loadOne(result, cb) {
    if (!result) { cb(null); return; }
    var stored = result.portraitImage || result.analysisImage || null;
    if (stored && stored.src && !stored._loadedImg) {
      var img = new Image();
      img.onload  = function() { stored._loadedImg = img; cb(result); };
      img.onerror = function() { cb(result); };
      img.src = stored.src;
    } else { cb(result); }
  }

  loadOne(rR, function(right) {
    loadOne(rL, function(left) {
      c.width = 1080; c.height = 1920;
      _drawBothEyesCard(c.getContext('2d'), 1080, 1920, right, left);
    });
  });
}

function _renderCard(result) {
  var c = document.getElementById('post-canvas');
  if (!c) return;
  c.width  = 1080;
  c.height = 1920;
  var ctx = c.getContext('2d');
  if      (pmActiveTemplate === 'iris-story') _drawIrisStoryCard(ctx, 1080, 1920, result);
  else if (pmActiveTemplate === 'full-eye')   _drawFullEyeCard(ctx, 1080, 1920, result);
  else if (pmActiveTemplate === 'full-face')  _drawFullFaceCard(ctx, 1080, 1920, result);
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
    var filled = (typeof buildFilledIris === 'function')
      ? buildFilledIris(srcImg, irisSpec) : null;
    if (filled) {
      ctx.drawImage(filled, irisCx - irisR, irisCy - irisR, irisR*2, irisR*2);
      drewReal = true;
    } else if (sX1 > sX0 && sY1 > sY0) {
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
  var nameText = colorDisplayName(result.overall.name, result.overall.cat).toUpperCase();
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

// =============================================================
//  TEMPLATE: FULL EYE  —  wide crop showing lashes / sclera
// =============================================================
function _drawFullEyeCard(ctx, W, H, result) {
  var baseRgb = result.fingerprint ? result.fingerprint.rgb : [60, 80, 130];
  function rgb(r)      { return 'rgb('  + r[0] + ',' + r[1] + ',' + r[2] + ')'; }
  function rgba(r, a)  { return 'rgba(' + r[0] + ',' + r[1] + ',' + r[2] + ',' + a + ')'; }
  function darken(r,n) { return [Math.max(0,r[0]-n), Math.max(0,r[1]-n), Math.max(0,r[2]-n)]; }
  function lighten(r,n){ return [Math.min(255,r[0]+n), Math.min(255,r[1]+n), Math.min(255,r[2]+n)]; }

  // Background
  ctx.fillStyle = '#060a14'; ctx.fillRect(0, 0, W, H);
  var wash = ctx.createRadialGradient(W/2, H*0.28, 0, W/2, H*0.28, W*0.95);
  wash.addColorStop(0, rgba(darken(baseRgb, 10), 0.38));
  wash.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = wash; ctx.fillRect(0, 0, W, H);

  // Wide eye photo frame (landscape)
  var fX = 56, fY = 90, fW = W - 112, fH = Math.round(fW * 0.65); // ~7:4.5
  ctx.save();
  _pmRoundRect(ctx, fX, fY, fW, fH, 38); ctx.clip();

  var stored   = result.portraitImage || result.analysisImage || null;
  var srcImg   = stored && stored._loadedImg ? stored._loadedImg : null;
  var irisSpec = stored && stored.iris ? stored.iris : null;
  var drewReal = false;

  if (srcImg && irisSpec && irisSpec.rIris && irisSpec.drawInfo && irisSpec.drawInfo.dw > 0) {
    var srcW = srcImg.naturalWidth  || srcImg.width;
    var srcH = srcImg.naturalHeight || srcImg.height;
    var di   = irisSpec.drawInfo;
    var sxR  = srcW / di.dw;
    var imgCx = (irisSpec.cx - di.dx) * sxR;
    var imgCy = (irisSpec.cy - di.dy) * (srcH / di.dh);
    var imgR  = irisSpec.rIris * sxR;
    // Wide crop: 4× iris radius wide, 2.8× tall — shows lashes, sclera, some lid
    var cropW = imgR * 4.2, cropH = imgR * 2.9;
    var sx = imgCx - cropW/2, sy = imgCy - cropH/2;
    var sX0 = Math.max(0, sx), sY0 = Math.max(0, sy);
    var sX1 = Math.min(srcW, sx + cropW), sY1 = Math.min(srcH, sy + cropH);
    if (sX1 > sX0 && sY1 > sY0) {
      ctx.fillStyle = rgb(darken(baseRgb, 30));
      ctx.fillRect(fX, fY, fW, fH);
      var dx0 = (sX0-sx)/cropW, dy0 = (sY0-sy)/cropH;
      var dx1 = (sX1-sx)/cropW, dy1 = (sY1-sy)/cropH;
      ctx.drawImage(srcImg, sX0, sY0, sX1-sX0, sY1-sY0,
        fX+dx0*fW, fY+dy0*fH, (dx1-dx0)*fW, (dy1-dy0)*fH);
      drewReal = true;
    }
  }
  if (!drewReal) {
    var fg = ctx.createLinearGradient(fX, fY, fX+fW, fY+fH);
    fg.addColorStop(0, rgb(lighten(baseRgb, 30)));
    fg.addColorStop(1, rgb(darken(baseRgb, 30)));
    ctx.fillStyle = fg; ctx.fillRect(fX, fY, fW, fH);
  }
  ctx.restore();

  // Frame border + subtle inner vignette
  ctx.strokeStyle = rgba(lighten(baseRgb, 60), 0.45);
  ctx.lineWidth = 2.5;
  _pmRoundRect(ctx, fX, fY, fW, fH, 38); ctx.stroke();

  // Dashed iris-measurement ring overlay
  if (drewReal && irisSpec && irisSpec.rIris && irisSpec.drawInfo && irisSpec.drawInfo.dw > 0) {
    var di2  = irisSpec.drawInfo;
    var sxR2 = (srcImg.naturalWidth || srcImg.width) / di2.dw;
    var imgR2 = irisSpec.rIris * sxR2;
    var cropW2 = imgR2 * 4.2;
    var ringR  = (imgR2 / cropW2) * fW;
    ctx.save();
    ctx.strokeStyle = rgba(lighten(baseRgb, 90), 0.42);
    ctx.lineWidth = 2.5; ctx.setLineDash([10, 7]);
    ctx.beginPath(); ctx.arc(fX + fW/2, fY + fH/2, ringR, 0, Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // Color name
  var textY = fY + fH + 68;
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  var nameText = colorDisplayName(result.overall.name, result.overall.cat).toUpperCase();
  ctx.font = '800 92px -apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif';
  var nw = ctx.measureText(nameText).width;
  if (nw > W - 100) ctx.font = '800 ' + Math.round(92*(W-100)/nw) + 'px -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.97)';
  ctx.fillText(nameText, W/2, textY);

  var ulY = textY + 110;
  var ulG = ctx.createLinearGradient(W*0.18, ulY, W*0.82, ulY);
  ulG.addColorStop(0,'rgba(0,0,0,0)'); ulG.addColorStop(0.5,rgba(lighten(baseRgb,70),0.95)); ulG.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle = ulG; ctx.fillRect(W*0.18, ulY, W*0.64, 3);

  var statY = ulY + 38;
  if (result.rarity) {
    ctx.font = '700 36px -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(255,232,140,0.94)';
    ctx.fillText('✦  Only ' + result.rarity.pct + '% share this color  ✦', W/2, statY);
    statY += 58;
  }
  if (result.rarityScore != null) {
    var sl = (typeof rarityScoreLabel === 'function') ? rarityScoreLabel(result.rarityScore) : '';
    ctx.font = '600 28px -apple-system, sans-serif';
    ctx.fillStyle = rgba(lighten(baseRgb, 90), 0.78);
    ctx.fillText(result.rarityScore + '/100 Uniqueness  ·  ' + sl, W/2, statY);
    statY += 50;
  }
  var pills = (typeof buildFeaturePills === 'function') ? buildFeaturePills(result) : [];
  statY += 10;
  pills.slice(0, 2).forEach(function(p) { _pmDrawPill(ctx, W/2, statY+28, p); statY += 68; });

  _drawBottomBadge(ctx, W, H, baseRgb);

  // CTA
  var ctaY = H * 0.80;
  var sep = ctx.createLinearGradient(W*0.12,ctaY,W*0.88,ctaY);
  sep.addColorStop(0,'rgba(255,255,255,0)'); sep.addColorStop(0.5,'rgba(255,255,255,0.20)'); sep.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle = sep; ctx.fillRect(W*0.12, ctaY, W*0.76, 1.5);
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.font = '400 40px -apple-system, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.70)';
  ctx.fillText('What color are', W/2, ctaY+40);
  ctx.font = '800 70px -apple-system, "SF Pro Display", sans-serif'; ctx.fillStyle = '#fff';
  ctx.fillText('YOUR EYES?', W/2, ctaY+94);
  ctx.font = '600 32px -apple-system, sans-serif'; ctx.fillStyle = rgba(lighten(baseRgb,80), 0.80);
  ctx.fillText('Find out at iris.color', W/2, ctaY+184);

  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.font = '700 26px -apple-system, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.40)';
  ctx.fillText('eye', 52, 58);
  var ew = ctx.measureText('eye').width;
  ctx.fillStyle = rgba(lighten(baseRgb,50), 0.75); ctx.fillText('D', 52+ew, 58);
  ctx.textAlign = 'right'; ctx.font = '400 22px -apple-system, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.30)';
  ctx.fillText(result.side + ' Eye  ·  Davis Scale', W-52, 58);
}

// =============================================================
//  TEMPLATE: BOTH EYES  —  eye pair, side-by-side circles
// =============================================================
function _drawBothEyesCard(ctx, W, H, rRight, rLeft) {
  var r1 = rRight || rLeft;  // at least one must exist (we got here from lastResult)
  var r2 = (rRight && rLeft) ? (rRight === r1 ? rLeft : rRight) : null;
  var baseRgb = r1.fingerprint ? r1.fingerprint.rgb : [60,80,130];
  var base2   = r2 && r2.fingerprint ? r2.fingerprint.rgb : baseRgb;

  function rgb(r)      { return 'rgb('  + r[0]+','+r[1]+','+r[2]+')'; }
  function rgba(r,a)   { return 'rgba(' + r[0]+','+r[1]+','+r[2]+','+a+')'; }
  function darken(r,n) { return [Math.max(0,r[0]-n),Math.max(0,r[1]-n),Math.max(0,r[2]-n)]; }
  function lighten(r,n){ return [Math.min(255,r[0]+n),Math.min(255,r[1]+n),Math.min(255,r[2]+n)]; }
  function blend(a,b,t){ return [Math.round(a[0]*(1-t)+b[0]*t),Math.round(a[1]*(1-t)+b[1]*t),Math.round(a[2]*(1-t)+b[2]*t)]; }

  // Background — dual gradient wash for each eye's color
  ctx.fillStyle = '#060a14'; ctx.fillRect(0, 0, W, H);
  var washL = ctx.createRadialGradient(W*0.28, H*0.32, 0, W*0.28, H*0.32, W*0.7);
  washL.addColorStop(0, rgba(darken(baseRgb,10), 0.38)); washL.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle = washL; ctx.fillRect(0,0,W,H);
  var washR = ctx.createRadialGradient(W*0.72, H*0.32, 0, W*0.72, H*0.32, W*0.7);
  washR.addColorStop(0, rgba(darken(base2,10), 0.38)); washR.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle = washR; ctx.fillRect(0,0,W,H);

  // Bottom darkener
  var bFade = ctx.createLinearGradient(0,H*0.6,0,H);
  bFade.addColorStop(0,'rgba(0,0,0,0)'); bFade.addColorStop(1,'rgba(0,0,0,0.55)');
  ctx.fillStyle = bFade; ctx.fillRect(0,H*0.6,W,H*0.4);

  // Heading
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.font = '700 38px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillText('YOUR EYE PAIR', W/2, 72);

  // Two iris circles — R=220, centers at x=270 and x=810, y=480
  var cR = 230;
  var cLx = 270, cRx = 810, cY = 490;

  function drawEyeCircle(result, cx, sideLabel) {
    var bRgb = result && result.fingerprint ? result.fingerprint.rgb : [50,60,90];
    // Bloom
    ctx.save();
    for (var b=0;b<5;b++){
      var rr=cR+8+b*18, alpha=0.20-b*0.03;
      var bg2=ctx.createRadialGradient(cx,cY,cR-10,cx,cY,rr+16);
      bg2.addColorStop(0,rgba(bRgb,alpha)); bg2.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=bg2; ctx.beginPath(); ctx.arc(cx,cY,rr+16,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();

    // Ring border
    ctx.save();
    ctx.beginPath(); ctx.arc(cx,cY,cR+5,0,Math.PI*2);
    ctx.strokeStyle=rgba(lighten(bRgb,60),0.50); ctx.lineWidth=2.5; ctx.stroke();
    ctx.restore();

    // Clip + draw iris image
    ctx.save();
    ctx.beginPath(); ctx.arc(cx,cY,cR,0,Math.PI*2); ctx.clip();

    var stored  = result && (result.portraitImage || result.analysisImage) || null;
    var srcImg  = stored && stored._loadedImg ? stored._loadedImg : null;
    var iSpec   = stored && stored.iris ? stored.iris : null;
    var drew    = false;

    if (result && srcImg && iSpec && iSpec.rIris && iSpec.drawInfo && iSpec.drawInfo.dw > 0) {
      var srcW2=srcImg.naturalWidth||srcImg.width, srcH2=srcImg.naturalHeight||srcImg.height;
      var di3=iSpec.drawInfo, sxR3=srcW2/di3.dw;
      var ix=(iSpec.cx-di3.dx)*sxR3, iy=(iSpec.cy-di3.dy)*(srcH2/di3.dh);
      var iR3=iSpec.rIris*sxR3, crop=iR3*1.9;
      var sx=ix-crop/2, sy=iy-crop/2;
      var sX0=Math.max(0,sx),sY0=Math.max(0,sy),sX1=Math.min(srcW2,sx+crop),sY1=Math.min(srcH2,sy+crop);
      ctx.fillStyle=rgb(darken(bRgb,20));
      ctx.fillRect(cx-cR,cY-cR,cR*2,cR*2);
      var filledB = (typeof buildFilledIris === 'function')
        ? buildFilledIris(srcImg, iSpec) : null;
      if (filledB) {
        ctx.drawImage(filledB, cx-cR, cY-cR, cR*2, cR*2);
        drew = true;
      } else if (sX1>sX0&&sY1>sY0){
        var dx0=(sX0-sx)/crop, dy0=(sY0-sy)/crop, dx1=(sX1-sx)/crop, dy1=(sY1-sy)/crop;
        ctx.drawImage(srcImg,sX0,sY0,sX1-sX0,sY1-sY0,
          cx-cR+dx0*cR*2,cY-cR+dy0*cR*2,(dx1-dx0)*cR*2,(dy1-dy0)*cR*2);
        drew = true;
      }
    }
    if (!drew) {
      if (result) {
        // Color disc fallback
        var disc=ctx.createRadialGradient(cx,cY,0,cx,cY,cR);
        disc.addColorStop(0,rgb(lighten(bRgb,50))); disc.addColorStop(0.65,rgb(bRgb)); disc.addColorStop(1,rgb(darken(bRgb,40)));
        ctx.fillStyle=disc; ctx.fillRect(cx-cR,cY-cR,cR*2,cR*2);
        ctx.fillStyle='#05080f'; ctx.beginPath(); ctx.arc(cx,cY,cR*0.28,0,Math.PI*2); ctx.fill();
      } else {
        // No result — placeholder
        ctx.fillStyle='rgba(255,255,255,0.05)'; ctx.fillRect(cx-cR,cY-cR,cR*2,cR*2);
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.font='700 36px -apple-system, sans-serif'; ctx.fillStyle='rgba(255,255,255,0.22)';
        ctx.fillText('?', cx, cY-20);
        ctx.font='400 26px -apple-system, sans-serif'; ctx.fillStyle='rgba(255,255,255,0.18)';
        ctx.fillText('Analyze ' + sideLabel, cx, cY+26);
      }
    }
    // Inner vignette
    var iv=ctx.createRadialGradient(cx,cY,cR*0.65,cx,cY,cR);
    iv.addColorStop(0,'rgba(0,0,0,0)'); iv.addColorStop(1,'rgba(0,0,0,0.30)');
    ctx.fillStyle=iv; ctx.fillRect(cx-cR,cY-cR,cR*2,cR*2);
    ctx.restore();

    // Eye side label above circle
    ctx.textAlign='center'; ctx.textBaseline='bottom';
    ctx.font='600 30px -apple-system, sans-serif';
    ctx.fillStyle='rgba(255,255,255,0.42)';
    ctx.fillText(sideLabel + ' Eye', cx, cY - cR - 14);

    // Color name below circle
    if (result && result.overall) {
      ctx.textBaseline='top';
      ctx.font='700 34px -apple-system, sans-serif';
      ctx.fillStyle='rgba(255,255,255,0.92)';
      var cn = colorDisplayName(result.overall.name, result.overall.cat);
      if (ctx.measureText(cn).width > cR*2+20) ctx.font = '700 26px -apple-system, sans-serif';
      ctx.fillText(cn, cx, cY + cR + 18);
    }
  }

  // Draw right eye (person's right = left side of image = left on screen)
  drawEyeCircle(rRight, cLx, 'Right');
  drawEyeCircle(rLeft,  cRx, 'Left');

  // Divider line between circles
  ctx.save();
  ctx.strokeStyle='rgba(255,255,255,0.10)'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(W/2, cY-cR-20); ctx.lineTo(W/2, cY+cR+80); ctx.stroke();
  ctx.restore();

  // Stats zone
  var statY = cY + cR + 130;

  // Heterochromia callout if both eyes have different categories
  var bothDone = rRight && rLeft;
  var heteroMsg = null;
  if (bothDone && rRight.overall && rLeft.overall && rRight.overall.cat !== rLeft.overall.cat) {
    heteroMsg = 'Bilateral Heterochromia';
  } else if (bothDone && rRight.overall && rLeft.overall && rRight.overall.name !== rLeft.overall.name) {
    heteroMsg = 'Unique Eye Pair';
  }
  if (heteroMsg) {
    ctx.textAlign='center'; ctx.textBaseline='top';
    ctx.font='700 44px -apple-system, "SF Pro Display", sans-serif';
    ctx.fillStyle='rgba(255,232,140,0.96)';
    ctx.fillText('✦  ' + heteroMsg + '  ✦', W/2, statY);
    statY += 64;
  }

  // Rarity for primary result
  if (r1.rarity) {
    ctx.font='600 34px -apple-system, sans-serif'; ctx.fillStyle='rgba(255,232,140,0.86)';
    ctx.textAlign='center'; ctx.textBaseline='top';
    ctx.fillText('Only ' + r1.rarity.pct + '% share ' + (r1.side||'this') + ' eye color', W/2, statY);
    statY += 54;
  }
  if (r1.rarityScore != null) {
    var sl2=(typeof rarityScoreLabel==='function')?rarityScoreLabel(r1.rarityScore):'';
    ctx.font='500 28px -apple-system, sans-serif';
    ctx.fillStyle=rgba(lighten(baseRgb,80), 0.72);
    ctx.fillText(r1.rarityScore+'/100 Uniqueness  ·  '+sl2, W/2, statY);
    statY += 48;
  }

  // Pills from primary result
  var pills2=(typeof buildFeaturePills==='function')?buildFeaturePills(r1):[];
  statY += 8;
  pills2.slice(0,2).forEach(function(p){ _pmDrawPill(ctx,W/2,statY+26,p); statY+=64; });

  _drawBottomBadge(ctx, W, H, blend(baseRgb, base2, 0.5));

  // CTA
  var ctaY2 = H*0.81;
  var sep2=ctx.createLinearGradient(W*0.12,ctaY2,W*0.88,ctaY2);
  sep2.addColorStop(0,'rgba(255,255,255,0)'); sep2.addColorStop(0.5,'rgba(255,255,255,0.18)'); sep2.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=sep2; ctx.fillRect(W*0.12,ctaY2,W*0.76,1.5);
  ctx.textAlign='center'; ctx.textBaseline='top';
  ctx.font='400 40px -apple-system, sans-serif'; ctx.fillStyle='rgba(255,255,255,0.68)';
  ctx.fillText('What color are', W/2, ctaY2+40);
  ctx.font='800 70px -apple-system, "SF Pro Display", sans-serif'; ctx.fillStyle='#fff';
  ctx.fillText('YOUR EYES?', W/2, ctaY2+94);
  ctx.font='600 32px -apple-system, sans-serif'; ctx.fillStyle=rgba(lighten(blend(baseRgb,base2,0.5),80),0.80);
  ctx.fillText('Find out at iris.color', W/2, ctaY2+184);

  ctx.textAlign='left'; ctx.textBaseline='middle';
  ctx.font='700 26px -apple-system, sans-serif'; ctx.fillStyle='rgba(255,255,255,0.40)';
  ctx.fillText('eye',52,58);
  var ew2=ctx.measureText('eye').width;
  ctx.fillStyle=rgba(lighten(blend(baseRgb,base2,0.5),50),0.75); ctx.fillText('D',52+ew2,58);
}

// =============================================================
//  TEMPLATE: FULL FACE  —  portrait photo with color overlay
// =============================================================
function _drawFullFaceCard(ctx, W, H, result) {
  var baseRgb = result.fingerprint ? result.fingerprint.rgb : [60, 80, 130];
  function rgb(r)      { return 'rgb('  + r[0]+','+r[1]+','+r[2]+')'; }
  function rgba(r,a)   { return 'rgba(' + r[0]+','+r[1]+','+r[2]+','+a+')'; }
  function darken(r,n) { return [Math.max(0,r[0]-n),Math.max(0,r[1]-n),Math.max(0,r[2]-n)]; }
  function lighten(r,n){ return [Math.min(255,r[0]+n),Math.min(255,r[1]+n),Math.min(255,r[2]+n)]; }

  // Background
  ctx.fillStyle = '#060a14'; ctx.fillRect(0,0,W,H);

  // Full-face photo — use in-memory originalImgEl global
  var faceImg = (typeof originalImgEl !== 'undefined') ? originalImgEl : null;
  var fX=0, fY=0, fW=W, fH=Math.round(H*0.60);

  if (faceImg && (faceImg.naturalWidth || faceImg.width) > 10) {
    // Draw face photo in top 60%, letterboxed / cover
    ctx.save();
    _pmRoundRect(ctx, 0, 0, W, fH, 0); ctx.clip();
    var iW = faceImg.naturalWidth  || faceImg.width;
    var iH = faceImg.naturalHeight || faceImg.height;
    var scale = Math.max(W/iW, fH/iH);
    var dw = iW*scale, dh = iH*scale;
    ctx.drawImage(faceImg, (W-dw)/2, (fH-dh)/2, dw, dh);
    // Gradient overlay: fade photo into background at bottom
    var photoFade = ctx.createLinearGradient(0, fH*0.55, 0, fH);
    photoFade.addColorStop(0,'rgba(6,10,20,0)');
    photoFade.addColorStop(1,'rgba(6,10,20,1)');
    ctx.fillStyle = photoFade; ctx.fillRect(0, 0, W, fH);
    ctx.restore();
  } else {
    // No face photo — show color wash placeholder
    var wash2=ctx.createRadialGradient(W/2,H*0.28,0,W/2,H*0.28,W*0.9);
    wash2.addColorStop(0,rgba(darken(baseRgb,10),0.45)); wash2.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=wash2; ctx.fillRect(0,0,W,fH);
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.font='700 36px -apple-system, sans-serif'; ctx.fillStyle='rgba(255,255,255,0.22)';
    ctx.fillText('Go back to Analyze to load your photo', W/2, fH/2);
  }

  // Color wash below photo area
  var wash3=ctx.createRadialGradient(W/2,fH+200,0,W/2,fH+200,W*0.8);
  wash3.addColorStop(0,rgba(darken(baseRgb,10),0.22)); wash3.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=wash3; ctx.fillRect(0,fH,W,H-fH);

  // Color name
  var textY = fH + 54;
  ctx.textAlign='center'; ctx.textBaseline='top';
  var nameText=colorDisplayName(result.overall.name, result.overall.cat).toUpperCase();
  ctx.font='800 96px -apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif';
  var nw=ctx.measureText(nameText).width;
  if (nw>W-100) ctx.font='800 '+Math.round(96*(W-100)/nw)+'px -apple-system, sans-serif';
  ctx.fillStyle='rgba(255,255,255,0.97)';
  ctx.fillText(nameText, W/2, textY);

  var ulY=textY+114;
  var ulG=ctx.createLinearGradient(W*0.18,ulY,W*0.82,ulY);
  ulG.addColorStop(0,'rgba(0,0,0,0)'); ulG.addColorStop(0.5,rgba(lighten(baseRgb,70),0.95)); ulG.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=ulG; ctx.fillRect(W*0.18,ulY,W*0.64,3);

  var statY3=ulY+38;
  if (result.rarity) {
    ctx.font='700 36px -apple-system, sans-serif'; ctx.fillStyle='rgba(255,232,140,0.94)';
    ctx.fillText('✦  Only '+result.rarity.pct+'% share this color  ✦', W/2, statY3);
    statY3+=58;
  }
  if (result.rarityScore!=null){
    var sl3=(typeof rarityScoreLabel==='function')?rarityScoreLabel(result.rarityScore):'';
    ctx.font='600 30px -apple-system, sans-serif'; ctx.fillStyle=rgba(lighten(baseRgb,90),0.78);
    ctx.fillText(result.rarityScore+'/100 Uniqueness  ·  '+sl3, W/2, statY3);
    statY3+=50;
  }
  var pills3=(typeof buildFeaturePills==='function')?buildFeaturePills(result):[];
  statY3+=10;
  pills3.slice(0,2).forEach(function(p){ _pmDrawPill(ctx,W/2,statY3+28,p); statY3+=68; });

  _drawBottomBadge(ctx, W, H, baseRgb);

  // CTA
  var ctaY3=H*0.80;
  var sep3=ctx.createLinearGradient(W*0.12,ctaY3,W*0.88,ctaY3);
  sep3.addColorStop(0,'rgba(255,255,255,0)'); sep3.addColorStop(0.5,'rgba(255,255,255,0.20)'); sep3.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=sep3; ctx.fillRect(W*0.12,ctaY3,W*0.76,1.5);
  ctx.textAlign='center'; ctx.textBaseline='top';
  ctx.font='400 40px -apple-system, sans-serif'; ctx.fillStyle='rgba(255,255,255,0.70)';
  ctx.fillText('What color are', W/2, ctaY3+40);
  ctx.font='800 70px -apple-system, "SF Pro Display", sans-serif'; ctx.fillStyle='#fff';
  ctx.fillText('YOUR EYES?', W/2, ctaY3+94);
  ctx.font='600 32px -apple-system, sans-serif'; ctx.fillStyle=rgba(lighten(baseRgb,80),0.80);
  ctx.fillText('Find out at iris.color', W/2, ctaY3+184);

  ctx.textAlign='left'; ctx.textBaseline='middle';
  ctx.font='700 26px -apple-system, sans-serif'; ctx.fillStyle='rgba(255,255,255,0.40)';
  ctx.fillText('eye',52,58);
  var ew3=ctx.measureText('eye').width;
  ctx.fillStyle=rgba(lighten(baseRgb,50),0.75); ctx.fillText('D',52+ew3,58);
  ctx.textAlign='right'; ctx.font='400 22px -apple-system, sans-serif'; ctx.fillStyle='rgba(255,255,255,0.30)';
  ctx.fillText(result.side+' Eye  ·  Davis Scale', W-52, 58);
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
