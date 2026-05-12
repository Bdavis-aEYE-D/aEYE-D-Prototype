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

  wCtx.putImageData(id, 0, 0);
  return work;
}
