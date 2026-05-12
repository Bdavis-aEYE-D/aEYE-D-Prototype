'use strict';

/**
 * core/iris-fill.js — Rotational sector fill for occluded iris regions
 *
 * buildFilledIris(srcImg, irisSpec) → HTMLCanvasElement | null
 *
 *   Returns a square canvas showing the iris crop with glare, lash, and
 *   lid pixels replaced by rotationally-sampled clean pixels from the
 *   same annular radius.  Rotational symmetry means a clean sector at
 *   4 o'clock is a good stand-in for an occluded sector at 8 o'clock.
 *
 *   Drop-in use inside a clipped canvas context:
 *     ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.clip();
 *     var filled = buildFilledIris(srcImg, iris);
 *     if (filled) ctx.drawImage(filled, cx - r, cy - r, r * 2, r * 2);
 *
 * @param {HTMLImageElement} srcImg
 * @param {Object} irisSpec  { cx, cy, rIris, rPupil, drawInfo:{dx,dy,dw,dh} }
 * @param {number} [cropFactor=1.9]  Output size as a multiple of iris radius
 * @returns {HTMLCanvasElement | null}
 */
function buildFilledIris(srcImg, irisSpec, cropFactor) {
  if (!srcImg || !irisSpec || !(irisSpec.rIris > 0)) return null;
  var di = irisSpec.drawInfo;
  if (!di || !(di.dw > 0) || !(di.dh > 0)) return null;
  cropFactor = cropFactor || 1.9;

  /* ── Map iris from stage coords → source-image coords ─────────────── */
  var srcW = srcImg.naturalWidth  || srcImg.width  || 0;
  var srcH = srcImg.naturalHeight || srcImg.height || 0;
  if (srcW <= 0 || srcH <= 0) return null;

  var sxR   = srcW / di.dw;
  var syR   = srcH / di.dh;
  var imgCx = (irisSpec.cx - di.dx) * sxR;
  var imgCy = (irisSpec.cy - di.dy) * syR;
  var imgIR = irisSpec.rIris  * sxR;
  var imgPR = Math.max(0, (irisSpec.rPupil || 0) * sxR);

  /* ── Work canvas (capped at 700 px for performance) ───────────────── */
  var rawOut  = Math.round(imgIR * cropFactor);
  var outSize = Math.min(700, Math.max(40, rawOut));
  var ws      = outSize / rawOut;      // scale: src-image px → work-canvas px
  var wIR     = imgIR * ws;            // iris radius in work-canvas px
  var wPR     = imgPR * ws;            // pupil radius in work-canvas px

  var work = document.createElement('canvas');
  work.width = work.height = outSize;
  var wCtx = work.getContext('2d');

  /* ── Draw source image into work canvas ──────────────────────────── */
  var cropHalf = rawOut / 2;
  var srcL = imgCx - cropHalf,  srcT = imgCy - cropHalf;
  var sX0  = Math.max(0, Math.floor(srcL));
  var sY0  = Math.max(0, Math.floor(srcT));
  var sX1  = Math.min(srcW, Math.ceil(srcL + rawOut));
  var sY1  = Math.min(srcH, Math.ceil(srcT + rawOut));
  if (sX1 <= sX0 || sY1 <= sY0) return null;

  var dX0 = (sX0 - srcL) * ws,  dY0 = (sY0 - srcT) * ws;
  var dW  = (sX1 - sX0)  * ws,  dH  = (sY1 - sY0)  * ws;
  try {
    wCtx.drawImage(srcImg, sX0, sY0, sX1 - sX0, sY1 - sY0, dX0, dY0, dW, dH);
  } catch (e) { return null; }

  /* ── Get pixel data ─────────────────────────────────────────────── */
  var id, pixels;
  try {
    id = wCtx.getImageData(0, 0, outSize, outSize);
    pixels = id.data;
  } catch (e) { return null; }   // CORS taint — bail gracefully

  var cx = outSize * 0.5,  cy = outSize * 0.5;

  /* ── Luminance helper (HSL) ─────────────────────────────────────── */
  function pixLum(i) {
    var r = pixels[i] / 255, g = pixels[i+1] / 255, b = pixels[i+2] / 255;
    var mx = Math.max(r, g, b),  mn = Math.min(r, g, b);
    return (mx + mn) * 0.5;
  }

  /* ── Bad-pixel test (glare or lash/lid) ─────────────────────────── */
  function isBad(i) {
    if (pixels[i + 3] < 20) return false;      // transparent = out-of-bounds
    var r = pixels[i] / 255, g = pixels[i+1] / 255, b = pixels[i+2] / 255;
    var mx = Math.max(r, g, b),  mn = Math.min(r, g, b);
    var lum = (mx + mn) * 0.5;
    var sat = (mx === mn) ? 0
            : (lum < 0.5 ? (mx - mn) / (mx + mn)
                         : (mx - mn) / (2 - mx - mn));
    // Glare: very bright + desaturated (specular reflection)
    if (lum > 0.82 && sat < 0.18) return true;
    // Lash / lid: very dark + desaturated
    if (lum < 0.19 && sat < 0.22) return true;
    return false;
  }

  /* ── Iris reference color (lateral sectors only) ────────────────── */
  // Sample iris tissue at 3 & 9 o'clock ± a few degrees — least-occluded.
  // Captures both luminance AND warm/cool balance (R-B) so skin detection
  // works across all iris colors, not just dark ones.
  var REF_ANGLES_DEG = [0, 15, 345, 30, 330, 180, 165, 195, 150, 210];
  var refSampleR = wIR * 0.75;
  var irisRefSumL = 0, irisRefSumR = 0, irisRefSumB = 0, irisRefN = 0;
  for (var ri = 0; ri < REF_ANGLES_DEG.length; ri++) {
    var ra = REF_ANGLES_DEG[ri] * Math.PI / 180;
    var rsx = Math.round(cx + refSampleR * Math.cos(ra));
    var rsy = Math.round(cy + refSampleR * Math.sin(ra));
    if (rsx < 0 || rsy < 0 || rsx >= outSize || rsy >= outSize) continue;
    var rsi = (rsy * outSize + rsx) * 4;
    if (pixels[rsi + 3] < 20) continue;
    irisRefSumL += pixLum(rsi);
    irisRefSumR += pixels[rsi]     / 255;
    irisRefSumB += pixels[rsi + 2] / 255;
    irisRefN++;
  }
  var irisRefLum  = irisRefN > 0 ? irisRefSumL / irisRefN : 0.35;
  var irisRefR    = irisRefN > 0 ? irisRefSumR / irisRefN : 0.40;
  var irisRefB    = irisRefN > 0 ? irisRefSumB / irisRefN : 0.35;
  // Iris warmth baseline: negative = cool (blue/grey), positive = warm (brown)
  var irisRefWarm = irisRefR - irisRefB;

  // Skin triggers if EITHER significantly brighter OR significantly warmer
  // than the iris reference. The warmth criterion catches light irises where
  // lum alone can't separate grey iris tissue from pinkish skin.
  var lidLumThresh  = irisRefLum + 0.15;    // much brighter than iris
  var lidWarmThresh = irisRefWarm + 0.12;   // notably warmer/pinker than iris

  // Source guard: the replacement pixel must look like iris, not skin
  var irisSrcMaxL = irisRefLum  + 0.12;
  var irisSrcMaxW = irisRefWarm + 0.08;     // not warmer than iris + small margin

  /* ── isSkin: lower-hemisphere pixel is eyelid skin ───────────────── */
  function isSkin(i) {
    if (pixels[i + 3] < 20) return false;
    var lm = pixLum(i);
    if (lm < 0.22 || lm > 0.92) return false;   // not too dark, not glare
    var rw = pixels[i] / 255 - pixels[i + 2] / 255;  // red-blue warmth
    return (lm > lidLumThresh) || (rw > lidWarmThresh);
  }

  /* ── isSkinSrc: pixel is suitable iris-tissue replacement ────────── */
  function isSkinSrc(i) {
    if (pixels[i + 3] < 20) return false;
    if (isBad(i)) return false;
    if (pixLum(i) > irisSrcMaxL) return false;
    var rw = pixels[i] / 255 - pixels[i + 2] / 255;
    return rw <= irisSrcMaxW;
  }

  /* ── Rotational offsets — 180° mirror first, then ±30° steps ────── */
  var OFFS = [
    Math.PI,
    Math.PI / 6,   -Math.PI / 6,
    Math.PI / 3,   -Math.PI / 3,
    Math.PI * 2/3, -Math.PI * 2/3,
    Math.PI * 5/6, -Math.PI * 5/6
  ];

  /* ── First pass: collect bad pixels in the iris ring ────────────── */
  var minR  = Math.max(0, wPR * 0.85);  // just inside pupil edge
  var maxR  = wIR * 1.08;               // just past iris edge
  var boxMn = Math.max(0, Math.floor(cy - maxR));
  var boxMx = Math.min(outSize - 1, Math.ceil(cy + maxR));
  var toFill = [];   // [ px, py, dist, theta, ... ] packed 4-per-entry

  for (var py = boxMn; py <= boxMx; py++) {
    for (var px = 0; px < outSize; px++) {
      var ddx = px - cx,  ddy = py - cy;
      var dist = Math.sqrt(ddx * ddx + ddy * ddy);
      if (dist < minR || dist > maxR) continue;
      if (isBad((py * outSize + px) * 4)) {
        toFill.push(px, py, dist, Math.atan2(ddy, ddx));
      }
    }
  }

  /* ── Second pass: fill from clean rotationally-offset pixels ─────── */
  for (var k = 0; k < toFill.length; k += 4) {
    var fpx = toFill[k], fpy = toFill[k + 1];
    var fr  = toFill[k + 2], ftheta = toFill[k + 3];
    var dstI = (fpy * outSize + fpx) * 4;

    for (var o = 0; o < OFFS.length; o++) {
      var spx = Math.round(cx + fr * Math.cos(ftheta + OFFS[o]));
      var spy = Math.round(cy + fr * Math.sin(ftheta + OFFS[o]));
      if (spx < 0 || spy < 0 || spx >= outSize || spy >= outSize) continue;
      var srcI = (spy * outSize + spx) * 4;
      if (!isBad(srcI) && pixels[srcI + 3] > 20) {
        pixels[dstI]     = pixels[srcI];
        pixels[dstI + 1] = pixels[srcI + 1];
        pixels[dstI + 2] = pixels[srcI + 2];
        // leave alpha unchanged — keeps edge transparency intact
        break;
      }
    }
    // if no clean sample found at any angle: leave original (graceful degradation)
  }

  /* ── Third pass: lower-hemisphere eyelid skin ────────────────────── */
  // Lashes (dark) and glare are caught by passes 1-2.  Eyelid SKIN is in
  // the middle: pinkish, medium brightness, lum ≈ 0.45–0.70.  It won't
  // trigger isBad(), but isSkin() flags it by luminance OR warmth (R-B).
  // The warmth criterion is key for light grey/blue irises where lum alone
  // cannot separate cool iris tissue from warm pink skin.
  // Scan ONLY below the iris center (ddy > 0 = 6 o'clock direction).
  var toFillSkin = [];
  var skinBoxT = Math.max(0, Math.ceil(cy));
  var skinBoxB = Math.min(outSize - 1, Math.ceil(cy + maxR));

  for (var spy2 = skinBoxT; spy2 <= skinBoxB; spy2++) {
    for (var spx2 = 0; spx2 < outSize; spx2++) {
      var sdx = spx2 - cx,  sdy = spy2 - cy;
      var sdist = Math.sqrt(sdx * sdx + sdy * sdy);
      if (sdist < minR || sdist > maxR) continue;
      var si2 = (spy2 * outSize + spx2) * 4;
      if (isBad(si2)) continue;   // already handled by pass 2
      if (isSkin(si2)) {
        toFillSkin.push(spx2, spy2, sdist, Math.atan2(sdy, sdx));
      }
    }
  }

  for (var ks = 0; ks < toFillSkin.length; ks += 4) {
    var fspx = toFillSkin[ks], fspy = toFillSkin[ks + 1];
    var fsr  = toFillSkin[ks + 2], fstheta = toFillSkin[ks + 3];
    var dstIs = (fspy * outSize + fspx) * 4;

    for (var os = 0; os < OFFS.length; os++) {
      var sspx = Math.round(cx + fsr * Math.cos(fstheta + OFFS[os]));
      var sspy = Math.round(cy + fsr * Math.sin(fstheta + OFFS[os]));
      if (sspx < 0 || sspy < 0 || sspx >= outSize || sspy >= outSize) continue;
      var srcIs = (sspy * outSize + sspx) * 4;
      if (isSkinSrc(srcIs)) {
        pixels[dstIs]     = pixels[srcIs];
        pixels[dstIs + 1] = pixels[srcIs + 1];
        pixels[dstIs + 2] = pixels[srcIs + 2];
        break;
      }
    }
    // if no clean iris-tissue source found at any angle: leave original
  }

  wCtx.putImageData(id, 0, 0);
  return work;
}
