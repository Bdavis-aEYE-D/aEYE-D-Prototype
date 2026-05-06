'use strict';

// ======================= SHARE CARD =======================
// Generates a 1080x1350 PNG (Instagram portrait ratio) summarizing the
// analysis. Uses canvas rendering — no external libraries required.

function generateShareCard(result){
  // Pick portrait image if user added one; else analysis image; else fall
  // back to the live globals (imgEl + donut + drawInfo).
  var stored = result.portraitImage || result.analysisImage || null;
  return loadResultImage(stored).then(function(loadedImg){
    var imageSpec = (loadedImg && stored && stored.iris)
      ? { img: loadedImg, iris: stored.iris }
      : null;
    return renderShareCardSync(result, imageSpec);
  });
}

function renderShareCardSync(result, imageSpec){
  return new Promise(function(resolve){
    var W = 1080, H = 1350;
    var canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');

    var baseRgb = result.fingerprint ? result.fingerprint.rgb : (result.overall.rgb || [60, 60, 80]);
    function darken(rgb, amt){
      return [Math.max(0, rgb[0]-amt), Math.max(0, rgb[1]-amt), Math.max(0, rgb[2]-amt)];
    }
    function rgbStr(rgb){ return 'rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ')'; }

    // ---- Background gradient + vignette ----
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, rgbStr(darken(baseRgb, 30)));
    grad.addColorStop(0.5, rgbStr(darken(baseRgb, 80)));
    grad.addColorStop(1, '#0a0a14');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
    var vg = ctx.createRadialGradient(W/2, H/2, W*0.2, W/2, H/2, W*0.8);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

    // ---- Top bar ----
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '600 36px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('eyeD', 60, 60);
    ctx.font = '300 22px -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.textAlign = 'right';
    ctx.fillText(result.side + ' eye · Davis Scale', W - 60, 60);

    // ---- Iris circle (1.85× crop, with bloom) ----
    var irisCx = W/2, irisCy = 380, irisR = 280;
    drawIrisCrop(ctx, irisCx, irisCy, irisR, baseRgb, imageSpec);

    // ---- Pick hero feature ----
    var hero = pickHero(result);
    var allPills = buildFeaturePills(result);
    var supportingPills = filterPillsForHero(allPills, hero.type);

    // ---- HERO label (with sparkles when not vibe-default) ----
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(255,255,255,0.97)';
    ctx.font = '700 72px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    var heroY = 720;
    var heroW = ctx.measureText(hero.label).width;
    if (hero.type !== 'vibe') {
      drawSparkle(ctx, (W - heroW)/2 - 30, heroY + 35, 14);
      drawSparkle(ctx, (W + heroW)/2 + 30, heroY + 35, 14);
    }
    ctx.fillText(hero.label, W/2, heroY);

    // ---- Gradient underline beneath hero ----
    var ulW = Math.min(heroW * 0.6, 480), ulX = (W - ulW)/2, ulY = heroY + 95;
    var ulGrad = ctx.createLinearGradient(ulX, ulY, ulX + ulW, ulY);
    ulGrad.addColorStop(0, 'rgba(' + baseRgb.join(',') + ',0.0)');
    ulGrad.addColorStop(0.5, 'rgba(255,255,255,0.4)');
    ulGrad.addColorStop(1, 'rgba(' + baseRgb.join(',') + ',0.0)');
    ctx.fillStyle = ulGrad; ctx.fillRect(ulX, ulY, ulW, 3);

    // ---- Hero subtitle ----
    var subEndY = ulY + 30;
    if (hero.subtitle) {
      ctx.font = '400 28px -apple-system, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText(hero.subtitle, W/2, ulY + 18);
      subEndY = ulY + 60;
    }

    // ---- Stats line: vibe (smaller) + color · name · rarity ----
    var statY = subEndY + 30;
    if (hero.type !== 'vibe') {
      ctx.font = '700 36px -apple-system, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText('"' + (result.vibe || '') + '"', W/2, statY);
      statY += 50;
    }
    ctx.font = '500 28px -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    var cParts = [result.overall.cat, result.overall.name];
    if (result.rarity) cParts.push(result.rarity.label);
    ctx.fillText(cParts.join('  ·  '), W/2, statY);

    // ---- Rarity sparkle callout ----
    if (result.rarity) {
      ctx.font = '700 26px -apple-system, sans-serif';
      ctx.fillStyle = 'rgba(255,235,180,0.88)';
      ctx.fillText('✦ ' + result.rarity.pct + '% of people ✦', W/2, statY + 42);
      statY += 72;
    } else {
      statY += 40;
    }

    // ---- Supporting pills (max 3) ----
    var pillY = statY + 50;
    supportingPills.slice(0, 3).forEach(function(p){
      drawPill(ctx, W/2, pillY, p);
      pillY += 58;
    });

    // ---- Palette swatches (5 anchors from same category) ----
    var siblings = [];
    if (typeof PALETTE !== 'undefined') {
      for (var i = 0; i < PALETTE.length && siblings.length < 5; i++) {
        if (PALETTE[i].cat === result.overall.cat) siblings.push(PALETTE[i].rgb);
      }
    }
    if (siblings.length) {
      var sw = 50, gap = 10;
      var totalW = siblings.length * sw + (siblings.length - 1) * gap;
      var sx = (W - totalW) / 2;
      siblings.forEach(function(rgb){
        ctx.fillStyle = rgbStr(rgb);
        roundRect(ctx, sx, 1200, sw, sw, 10); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 2;
        roundRect(ctx, sx, 1200, sw, sw, 10); ctx.stroke();
        sx += sw + gap;
      });
    }

    // ---- Color fingerprint ----
    if (result.fingerprint) {
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = '400 18px ui-monospace, Menlo, monospace';
      var fp = 'Lab(' + result.fingerprint.lab[0].toFixed(0) + ', '
                       + result.fingerprint.lab[1].toFixed(0) + ', '
                       + result.fingerprint.lab[2].toFixed(0) + ')   '
                       + result.fingerprint.hex.toUpperCase();
      ctx.fillText(fp, W/2, 1275);
    }

    // ---- Brand line ----
    ctx.fillStyle = 'rgba(255,255,255,0.32)';
    ctx.font = '300 16px -apple-system, sans-serif';
    ctx.fillText('eyeD · iris.color', W/2, 1310);

    canvas.toBlob(function(blob){ resolve({ canvas: canvas, blob: blob }); }, 'image/png');
  });
}

function pickHero(result){
  // Hero priority: rarest/most exciting feature first.
  if (result.sectoral) {
    return { type: 'sectoral', label: 'Sectoral Heterochromia',
             subtitle: result.sectoral.color.name + ' @ ' + result.sectoral.clock + " o'clock",
             color: result.sectoral.rgb };
  }
  if (result.hetero !== 'None') {
    var pup = result.heteroPup ? (result.heteroPup.displayName || result.heteroPup.color.name) : null;
    var sub;
    if (result.hetero.indexOf('warmth') >= 0) sub = (pup ? pup + ' ' : 'warm ') + 'pupillary ring';
    else if (result.hetero.indexOf('lightness') >= 0) sub = (pup ? pup + ' ' : 'light ') + 'pupillary ring';
    else if (result.hetero === 'Central') sub = (pup || result.inner.name) + ' inside ' + (result.heteroCil ? (result.heteroCil.displayName || result.heteroCil.color.name) : result.outer.name);
    else sub = result.heteroDist ? 'ΔE=' + result.heteroDist.toFixed(1) : '';
    return { type: 'hetero', label: 'Central Heterochromia', subtitle: sub,
             color: result.heteroPup ? result.heteroPup.rgb : [180,140,90] };
  }
  if (result.limbal === 'Strong' || result.limbal === 'Dramatic') {
    var ftype = result.limbalType || 'ring';
    return { type: 'limbal_' + ftype,
             label: result.limbal + ' Limbal ' + (ftype === 'halo' ? 'Halo' : 'Ring'),
             subtitle: result.limbalColor ? result.limbalColor.name : '',
             color: result.limbalRgb || (result.limbalColor ? result.limbalColor.rgb : [80,80,80]) };
  }
  if (result.freckles && result.freckles.length >= 2) {
    return { type: 'freckles',
             label: result.freckles.length + ' Iris Freckles',
             subtitle: 'A unique pigmented fingerprint',
             color: result.freckles[0].rgb || [60,40,20] };
  }
  // Default — vibe is the hero
  return { type: 'vibe', label: result.vibe || result.overall.name,
           subtitle: null, color: result.overall.rgb };
}

function filterPillsForHero(pills, heroType){
  return pills.filter(function(p){
    var l = p.label.toLowerCase();
    if (heroType === 'hetero' && l.indexOf('heterochromia') >= 0) return false;
    if (heroType === 'sectoral' && l.indexOf('sectoral') === 0) return false;
    if (heroType === 'limbal_ring' && l.indexOf('ring') >= 0 && l.indexOf('pupillary') < 0) return false;
    if (heroType === 'limbal_halo' && l.indexOf('halo') >= 0) return false;
    if (heroType === 'freckles' && l.indexOf('freckle') >= 0) return false;
    // Suppress useless "Faint X ring" where X color matches outer iris (no real contrast)
    return true;
  });
}

function drawSparkle(ctx, x, y, size){
  var s = size;
  ctx.save();
  ctx.fillStyle = 'rgba(255,235,180,0.85)';
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.lineTo(x + s*0.3, y - s*0.3);
  ctx.lineTo(x + s, y);
  ctx.lineTo(x + s*0.3, y + s*0.3);
  ctx.lineTo(x, y + s);
  ctx.lineTo(x - s*0.3, y + s*0.3);
  ctx.lineTo(x - s, y);
  ctx.lineTo(x - s*0.3, y - s*0.3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawIrisCrop(ctx, cx, cy, r, baseRgb, imageSpec){
  // Bloom (soft glow ring just outside the iris circle)
  ctx.save();
  for (var i = 0; i < 4; i++) {
    var rr = r + 8 + i*4;
    ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI*2);
    ctx.strokeStyle = 'rgba(' + baseRgb.join(',') + ',' + (0.18 - i*0.04) + ')';
    ctx.lineWidth = 3; ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r + 3, 0, Math.PI*2);
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 3; ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.clip();
  // imageSpec: { img: HTMLImageElement, iris: {cx, cy, rPupil, rIris, drawInfo} }
  // Falls back to the live globals (imgEl + donut + drawInfo) if not provided.
  var srcImg = (imageSpec && imageSpec.img) ? imageSpec.img : imgEl;
  var iris = (imageSpec && imageSpec.iris) ? imageSpec.iris :
             (donut ? { cx: donut.cx, cy: donut.cy, rIris: donut.rIris,
                        rPupil: donut.rPupil, drawInfo: drawInfo } : null);
  if (srcImg && iris && iris.rIris && iris.drawInfo && iris.drawInfo.dw > 0) {
    var srcW = srcImg.naturalWidth || srcImg.width;
    var srcH = srcImg.naturalHeight || srcImg.height;
    var di = iris.drawInfo;
    var sxRatio = srcW / di.dw, syRatio = srcH / di.dh;
    var imgIrisX = (iris.cx - di.dx) * sxRatio;
    var imgIrisY = (iris.cy - di.dy) * syRatio;
    var imgIrisR = iris.rIris * sxRatio;
    var crop = imgIrisR * 1.85;
    var sx = imgIrisX - crop / 2, sy = imgIrisY - crop / 2;
    ctx.fillStyle = 'rgb(' + baseRgb.join(',') + ')';
    ctx.fillRect(cx - r, cy - r, r*2, r*2);
    var srcX0 = Math.max(0, sx), srcY0 = Math.max(0, sy);
    var srcX1 = Math.min(srcW, sx + crop), srcY1 = Math.min(srcH, sy + crop);
    if (srcX1 > srcX0 && srcY1 > srcY0) {
      var dx0 = (srcX0 - sx) / crop, dy0 = (srcY0 - sy) / crop;
      var dx1 = (srcX1 - sx) / crop, dy1 = (srcY1 - sy) / crop;
      ctx.drawImage(srcImg,
        srcX0, srcY0, srcX1-srcX0, srcY1-srcY0,
        cx - r + dx0 * (r*2), cy - r + dy0 * (r*2),
        (dx1-dx0) * (r*2), (dy1-dy0) * (r*2));
    }
  } else {
    ctx.fillStyle = 'rgb(' + baseRgb.join(',') + ')';
    ctx.fillRect(cx - r, cy - r, r*2, r*2);
  }
  ctx.restore();
}

// Helper: load an Image from a stored result.{analysis|portrait}Image.src.
// Returns a Promise that resolves with the HTMLImageElement (or null).
function loadResultImage(stored){
  return new Promise(function(resolve){
    if (!stored || !stored.src) { resolve(null); return; }
    var img = new Image();
    img.onload = function(){ resolve(img); };
    img.onerror = function(){ resolve(null); };
    img.src = stored.src;
  });
}

function buildFeaturePills(result){
  var pills = [];
  // Heterochromia
  if (result.hetero !== 'None') {
    var pup = result.heteroPup ? (result.heteroPup.displayName || result.heteroPup.color.name) : null;
    var label;
    if (result.hetero.indexOf('warmth') >= 0 || result.hetero.indexOf('lightness') >= 0) {
      label = 'Central heterochromia · ' + (pup || 'gradient ring');
    } else if (result.hetero === 'Central') {
      label = 'Central heterochromia · ' + (result.inner.name || pup);
    } else {
      label = result.hetero + ' heterochromia';
    }
    pills.push({ label: label, color: result.heteroPup ? result.heteroPup.rgb : [180,140,90] });
  }
  // Limbal ring or halo. Suppress "Faint X ring" when iris and ring resolve
  // to the same palette color — no informative contrast.
  if (result.limbal !== 'None' && result.limbalColor) {
    var ftype = result.limbalType || 'ring';
    var sameAsIris = result.outer && result.outer.name === result.limbalColor.name;
    var suppress = result.limbal === 'Faint' && sameAsIris;
    if (!suppress) {
      pills.push({
        label: result.limbal + ' ' + result.limbalColor.name + ' ' + ftype,
        color: result.limbalRgb || result.limbalColor.rgb,
      });
    }
  }
  // Sectoral
  if (result.sectoral) {
    pills.push({
      label: 'Sectoral patch · ' + result.sectoral.color.name + ' @ ' + result.sectoral.clock + " o'clock",
      color: result.sectoral.rgb,
    });
  }
  // Freckles
  if (result.freckles && result.freckles.length) {
    pills.push({
      label: result.freckles.length + ' iris freckle' + (result.freckles.length === 1 ? '' : 's'),
      color: result.freckles[0].rgb || [60, 40, 20],
    });
  }
  // Iris character (always)
  var ph = (typeof getPatternHint === 'function') ? getPatternHint(result.brightness, result.saturation) : null;
  if (ph) {
    pills.push({ label: ph, color: result.fingerprint ? result.fingerprint.rgb : [128,128,128] });
  }
  return pills;
}

function drawPill(ctx, cx, y, p){
  // Measure label width, draw rounded pill with color dot + label
  var ctxFont = '500 26px -apple-system, sans-serif';
  ctx.font = ctxFont;
  var lw = ctx.measureText(p.label).width;
  var dot = 18, padL = 28, padR = 28, gap = 14;
  var pillH = 50, pillW = lw + padL + padR + dot + gap;
  var x = cx - pillW/2;
  // pill background
  ctx.fillStyle = 'rgba(0,0,0,0.40)';
  roundRect(ctx, x, y - pillH/2, pillW, pillH, pillH/2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1.5;
  roundRect(ctx, x, y - pillH/2, pillW, pillH, pillH/2); ctx.stroke();
  // color dot
  ctx.fillStyle = 'rgb(' + p.color.join(',') + ')';
  ctx.beginPath(); ctx.arc(x + padL + dot/2, y, dot/2, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x + padL + dot/2, y, dot/2, 0, Math.PI*2); ctx.stroke();
  // label
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.font = ctxFont;
  ctx.fillText(p.label, x + padL + dot + gap, y);
  ctx.textAlign = 'center';
}

function roundRect(ctx, x, y, w, h, r){
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.lineTo(x+w-r, y); ctx.quadraticCurveTo(x+w, y, x+w, y+r);
  ctx.lineTo(x+w, y+h-r); ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
  ctx.lineTo(x+r, y+h); ctx.quadraticCurveTo(x, y+h, x, y+h-r);
  ctx.lineTo(x, y+r); ctx.quadraticCurveTo(x, y, x+r, y);
  ctx.closePath();
}

// Auto-run autofit when the fit card becomes visible (triggered from showFit)
function autoRunFit(){
  var hint = $('autofit-hint');
  if (hint) hint.textContent = 'Auto-fitting iris ring…';
  setTimeout(function(){
    var ab = $('btn-autofit');
    if (ab) ab.click();
    if (hint) hint.textContent = 'Auto-fit complete. Tap "Analyze Iris" or adjust manually.';
  }, 80);
}
