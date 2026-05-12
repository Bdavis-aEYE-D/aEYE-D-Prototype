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
    // Lash / lid: very dark + mostly desaturated.
    // Dark-brown lashes on warm irises can reach sat ≈ 0.30–0.35 —
    // raising threshold to 0.35 catches them without touching the
    // iris ring (which is always brighter than lum 0.19 in this zone).
    if (lum < 0.19 && sat < 0.35) return true;
    return false;
  }

  /* ── Iris reference color (upper-lateral sectors only) ──────────── */
  // Sample iris tissue at 3 & 9 o'clock ± offsets — strictly in the upper
  // hemisphere (sin < 0 in screen coords where y increases downward).
  // All angles must have sin ≤ 0 in screen coords (y↓) so sample points land
  // in the upper / lateral hemisphere, never on the lower eyelid.
  //   sin(θ) in screen coords = Math.sin(θ * π/180)
  //   positive sin → below centre → eyelid territory → excluded
  //
  // History of fixes:
  //   v1.25: removed 30° (sin=+0.50) and 150° (sin=+0.50)
  //   v1.26: also removed 15° (sin=+0.259) and 165° (sin=+0.259);
  //          replaced with upper-hemisphere mirrors 315° and 225°.
  //
  // Final set — all 10 angles have sin ≤ 0:
  //   Right side:  0°(0), 345°(-0.26), 330°(-0.50), 315°(-0.71), 300°(-0.87)
  //   Left  side: 180°(0), 195°(-0.26), 210°(-0.50), 225°(-0.71), 240°(-0.87)
  var REF_ANGLES_DEG = [0, 345, 330, 315, 300, 180, 195, 210, 225, 240];
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
  var irisRefLum = irisRefN > 0 ? irisRefSumL / irisRefN : 0.35;

  // ── Why lum-only skin detection (warmth criterion removed) ──────────
  // Two symmetric failures when a warmth margin is applied:
  //
  //  Grey iris (Bryan): irisRefWarm ≈ −0.08 → lidWarmThresh = +0.04.
  //  The amber heterochromia inner ring has warmth ≈ +0.20 → above threshold
  //  → amber flagged as skin → isSkinSrc rejects it → no source found
  //  → skin left unfilled.
  //
  //  Warm amber iris (Terri1): irisRefWarm ≈ +0.28 → lidWarmThresh = +0.40.
  //  Eyelid skin warmth ≈ +0.15–0.25 < 0.40 → skin NOT detected by warmth
  //  → Pass 2 uses skin as lash-fill source → skin pasted over lash positions.
  //
  // Lum-only is reliable because eyelid skin is ALWAYS meaningfully brighter
  // than the iris tissue sampled at the same radius (diffuse surface vs. deep
  // pigmented tissue). Amber ring (lm ≈ 0.35–0.45) stays well below the
  // threshold; actual skin (lm ≈ 0.55–0.80) is reliably above it.
  var lidLumThresh = irisRefLum + 0.15;   // brighter than outer iris → skin

  /* ── isSkin: pixel is eyelid / lower-lid skin ────────────────────── */
  function isSkin(i) {
    if (pixels[i + 3] < 20) return false;
    var lm = pixLum(i);
    if (lm < 0.22 || lm > 0.92) return false;   // not too dark, not glare
    return lm > lidLumThresh;
  }

  /* ── Pupil pass: fill catchlight / glare inside pupil zone ─────── */
  // The pupil is an almost-black disc. Any bright pixel inside it is a
  // specular catchlight (camera flash reflection). Replace those bright
  // pixels with the average dark color sampled from the same pupil zone,
  // producing a clean solid-dark pupil for the share card.
  //
  // Guard: if rPupil wasn't detected (wPR very small), estimate it as 20%
  // of iris radius so the pass doesn't silently no-op on undetected pupils.
  var wPR_eff = wPR > 4 ? wPR : wIR * 0.20;

  // Sampling zone: strictly inside 70% of effective pupil radius so we never
  // accidentally include the inner amber/heterochromia ring which starts just
  // outside the pupil edge.
  var pupilSampleR = wPR_eff * 0.70;
  // Replacement zone: full pupil (1.02× to safely cover the entire dark disc).
  var pupilReplaceR = wPR_eff * 1.02;
  var pupZoneY0   = Math.max(0,            Math.floor(cy - pupilReplaceR));
  var pupZoneY1   = Math.min(outSize - 1,  Math.ceil( cy + pupilReplaceR));
  // Sub-pass A: collect average dark pupil color from strict inner zone
  var pSumR = 0, pSumG = 0, pSumB = 0, pN = 0;
  for (var pya = pupZoneY0; pya <= pupZoneY1; pya++) {
    for (var pxa = 0; pxa < outSize; pxa++) {
      var pddx = pxa - cx,  pddy = pya - cy;
      if (pddx * pddx + pddy * pddy > pupilSampleR * pupilSampleR) continue;
      var pia = (pya * outSize + pxa) * 4;
      if (pixels[pia + 3] < 20) continue;
      if (pixLum(pia) > 0.10) continue;   // only truly dark pupil pixels; 0.10 excludes catchlight/ring bleed from avg
      pSumR += pixels[pia]; pSumG += pixels[pia + 1]; pSumB += pixels[pia + 2];
      pN++;
    }
  }
  // Fallback: if pupil is mostly glare (very unusual), use near-black
  var pAvgR = pN >= 4 ? Math.round(pSumR / pN) : 18;
  var pAvgG = pN >= 4 ? Math.round(pSumG / pN) : 18;
  var pAvgB = pN >= 4 ? Math.round(pSumB / pN) : 18;

  // Sub-pass B: replace any pixel inside the pupil zone that is noticeably
  // brighter than the true dark pupil (~lm 0.04-0.05).  The threshold is set
  // to 0.10 to catch not just specular/diffuse catchlights (lm 0.30–1.0) but
  // also medium-dark amber / heterochromia-ring pixels (lm 0.10–0.20) that
  // bleed into the pupil area and create a visible brown ring if left alone.
  for (var pyb = pupZoneY0; pyb <= pupZoneY1; pyb++) {
    for (var pxb = 0; pxb < outSize; pxb++) {
      var pbdx = pxb - cx,  pbdy = pyb - cy;
      if (pbdx * pbdx + pbdy * pbdy > pupilReplaceR * pupilReplaceR) continue;
      var pib = (pyb * outSize + pxb) * 4;
      if (pixels[pib + 3] < 20) continue;
      if (pixLum(pib) > 0.10) {   // replace catchlights, diffuse reflections, and amber-ring bleed
        pixels[pib]     = pAvgR;
        pixels[pib + 1] = pAvgG;
        pixels[pib + 2] = pAvgB;
      }
    }
  }

  /* ── Rotational offsets — 180° first, then ±90° (cleanest lateral),
     then ±30° steps ─────────────────────────────────────────────────── */
  var OFFS = [
    Math.PI,                             // 180° — opposite side
    Math.PI / 2,   -Math.PI / 2,         // ±90° — pure lateral
    Math.PI / 6,   -Math.PI / 6,         // ±30°
    Math.PI / 3,   -Math.PI / 3,         // ±60°
    Math.PI * 2/3, -Math.PI * 2/3,       // ±120°
    Math.PI * 5/6, -Math.PI * 5/6        // ±150°
  ];

  /* ── First pass: collect bad pixels in the iris ring ────────────── */
  // minR uses wPR_eff so it stays consistent with the pupil pass zone.
  // The pupil zone (0 → pupilReplaceR) was already cleaned above; start
  // Pass 1 just past that boundary so it never re-darkens the replacement.
  var minR  = Math.max(0, wPR_eff * 1.03);  // just past pupil replacement edge
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
  // Source guard: !isBad(srcI) is required; !isSkin(srcI) prevents the amber
  // inner ring from being pasted onto lash positions in the lower hemisphere.
  //
  // Lower-hemisphere warm-source guard: when filling a lower-hemisphere pixel
  // (ftheta ∈ (0,π)), reject any candidate source that (a) comes from above
  // the iris centre (upper hemisphere) AND (b) is noticeably warm (R−B > 0.10).
  // This stops the upper amber/heterochromia iris zone from being pasted into
  // the cool-grey lower iris during lash/shadow fill.  When no non-warm source
  // is found the pixel is left as-is (graceful degradation — a dark iris/lash
  // pixel is far less visible than a warm amber smear).
  var isLowerFill = false;
  for (var k = 0; k < toFill.length; k += 4) {
    var fpx = toFill[k], fpy = toFill[k + 1];
    var fr  = toFill[k + 2], ftheta = toFill[k + 3];
    var dstI = (fpy * outSize + fpx) * 4;
    isLowerFill = (ftheta > 0 && ftheta < Math.PI);

    for (var o = 0; o < OFFS.length; o++) {
      var spx = Math.round(cx + fr * Math.cos(ftheta + OFFS[o]));
      var spy = Math.round(cy + fr * Math.sin(ftheta + OFFS[o]));
      if (spx < 0 || spy < 0 || spx >= outSize || spy >= outSize) continue;
      var srcI = (spy * outSize + spx) * 4;
      if (!isBad(srcI) && pixels[srcI + 3] > 20 && !isSkin(srcI)) {
        if (isLowerFill && spy < cy) {
          // source is in upper hemisphere — reject if warm
          if ((pixels[srcI] - pixels[srcI + 2]) > 25) continue;  // > ~0.10 warm
        }
        pixels[dstI]     = pixels[srcI];
        pixels[dstI + 1] = pixels[srcI + 1];
        pixels[dstI + 2] = pixels[srcI + 2];
        // leave alpha unchanged — keeps edge transparency intact
        break;
      }
    }
    // if no clean non-warm source found: leave original (graceful degradation)
  }

  wCtx.putImageData(id, 0, 0);
  return work;
}
