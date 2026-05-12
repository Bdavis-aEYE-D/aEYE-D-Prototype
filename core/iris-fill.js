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
  var irisSrcMaxL  = irisRefLum + 0.12;   // source lum ceiling (iris tissue range)

  /* ── isSkin: pixel is eyelid / lower-lid skin ────────────────────── */
  function isSkin(i) {
    if (pixels[i + 3] < 20) return false;
    var lm = pixLum(i);
    if (lm < 0.22 || lm > 0.92) return false;   // not too dark, not glare
    return lm > lidLumThresh;
  }

  /* ── isSkinSrc: pixel is valid iris-tissue replacement ───────────── */
  // Requires: (1) not glare/lash, (2) not skin (lum check), (3) not too
  // dark to be iris (limbal ring), (4) not too bright (skin range).
  // Floor lowered to 0.20 so the dark outer limbal ring qualifies.
  function isSkinSrc(i) {
    if (pixels[i + 3] < 20) return false;
    if (isBad(i)) return false;
    if (isSkin(i)) return false;
    var lm = pixLum(i);
    return lm >= 0.20 && lm <= irisSrcMaxL;
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
      if (pixLum(pia) > 0.18) continue;   // only genuinely dark pupil pixels
      pSumR += pixels[pia]; pSumG += pixels[pia + 1]; pSumB += pixels[pia + 2];
      pN++;
    }
  }
  // Fallback: if pupil is mostly glare (very unusual), use near-black
  var pAvgR = pN >= 4 ? Math.round(pSumR / pN) : 18;
  var pAvgG = pN >= 4 ? Math.round(pSumG / pN) : 18;
  var pAvgB = pN >= 4 ? Math.round(pSumB / pN) : 18;

  // Sub-pass B: replace any pixel that's noticeably brighter than a pupil
  // should be. Threshold lowered to 0.30 to catch secondary/diffuse catchlights
  // that are bright but not fully specular (primary reflections are > 0.80,
  // secondary diffuse reflections can be 0.30-0.50).
  for (var pyb = pupZoneY0; pyb <= pupZoneY1; pyb++) {
    for (var pxb = 0; pxb < outSize; pxb++) {
      var pbdx = pxb - cx,  pbdy = pyb - cy;
      if (pbdx * pbdx + pbdy * pbdy > pupilReplaceR * pupilReplaceR) continue;
      var pib = (pyb * outSize + pxb) * 4;
      if (pixels[pib + 3] < 20) continue;
      if (pixLum(pib) > 0.30) {   // replace catchlights and diffuse reflections
        pixels[pib]     = pAvgR;
        pixels[pib + 1] = pAvgG;
        pixels[pib + 2] = pAvgB;
      }
    }
  }

  /* ── Rotational offsets — 180° first, then ±90° (cleanest lateral),
     then ±30° steps ─────────────────────────────────────────────────── */
  // ±90° added: for a bottom-skin pixel (angle≈90°) the ±90° offsets land
  // at 0° and 180° — the pure lateral positions which are always clean iris.
  // For a top-lash pixel (angle≈270°) ±90° also reaches pure lateral.
  var OFFS = [
    Math.PI,                             // 180° — opposite side
    Math.PI / 2,   -Math.PI / 2,         // ±90° — pure lateral (NEW)
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
  for (var k = 0; k < toFill.length; k += 4) {
    var fpx = toFill[k], fpy = toFill[k + 1];
    var fr  = toFill[k + 2], ftheta = toFill[k + 3];
    var dstI = (fpy * outSize + fpx) * 4;

    for (var o = 0; o < OFFS.length; o++) {
      var spx = Math.round(cx + fr * Math.cos(ftheta + OFFS[o]));
      var spy = Math.round(cy + fr * Math.sin(ftheta + OFFS[o]));
      if (spx < 0 || spy < 0 || spx >= outSize || spy >= outSize) continue;
      var srcI = (spy * outSize + spx) * 4;
      if (!isBad(srcI) && pixels[srcI + 3] > 20 && !isSkin(srcI)) {
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

  // Restrict skin pass to outer iris only — inner ring (amber heterochromia,
  // warm-coloured but real iris tissue) is at < 60% irisR and must be left alone.
  var skinMinR = Math.max(wPR_eff * 1.03, wIR * 0.60);

  for (var spy2 = skinBoxT; spy2 <= skinBoxB; spy2++) {
    for (var spx2 = 0; spx2 < outSize; spx2++) {
      var sdx = spx2 - cx,  sdy = spy2 - cy;
      var sdist = Math.sqrt(sdx * sdx + sdy * sdy);
      if (sdist < skinMinR || sdist > maxR) continue;
      var si2 = (spy2 * outSize + spx2) * 4;
      if (isBad(si2)) continue;   // already handled by pass 2
      var lm3 = pixLum(si2);

      // ── Skin: brighter than outer iris reference ──────────────────────
      var needsFill = lm3 > lidLumThresh;

      // ── Eyelid margin / shadow: DARKER than outer iris reference ─────
      // The conjunctival margin and the eyelid shadow on the lower iris are
      // medium-dark (lm ≈ 0.15–0.38). They are too bright for isBad() and
      // too dark for isSkin(). Without this criterion they survive all passes
      // and appear as the "brown line exactly where the eyelid was."
      //   • Only in the outer iris (r > 70% irisR) — safely above the amber
      //     inner ring (r < 50% irisR) so no false positives on heterochromia.
      //   • Must be noticeably darker than iris reference (–0.06 headroom).
      //   • Must be above 0.15 lum to avoid re-catching lash-dark pixels that
      //     isBad already processed (but whose neighbours landed here).
      if (!needsFill && sdist > wIR * 0.70 && lm3 > 0.15 && lm3 < irisRefLum - 0.06) {
        needsFill = true;
      }

      if (needsFill) {
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
