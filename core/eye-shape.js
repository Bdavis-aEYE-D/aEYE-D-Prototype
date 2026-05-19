'use strict';

/**
 * core/eye-shape.js — Eye shape classification from iris fit data
 *
 * classifyEyeShape(imgEl, irisSpec) → result object
 *
 * Standalone, pluggable module. No DOM side-effects, no global dependencies.
 * Same irisSpec format as buildFilledIris() and analyzeIris().
 *
 * Usage (any app):
 *   var shape = classifyEyeShape(imgEl, {
 *     cx: donut.cx, cy: donut.cy,
 *     rIris: donut.rIris, rPupil: donut.rPupil,
 *     drawInfo: drawInfo          // { dx, dy, dw, dh }
 *   });
 *   // shape.label  → 'Almond' | 'Round' | 'Hooded' | 'Monolid' | 'Unknown'
 *   // shape.traits → raw measurements for further use
 *
 * ── Shapes detected ──────────────────────────────────────────────────────
 *
 *  almond   Standard oval aperture, upper lid slightly covers iris,
 *           no sclera below. Most common shape — the baseline.
 *
 *  round    High vertical aperture. Sclera visible below the iris.
 *           Less upper lid coverage than almond.
 *
 *  hooded   Upper eyelid fold droops over the iris, significantly
 *           darkening the upper iris region. Lid crease still visible.
 *           Detection note: upper iris may be partially occluded.
 *
 *  monolid  No visible lid crease above the iris. Upper eyelid covers
 *           a large portion of the iris with no fold break visible.
 *           Common in East Asian heritage. Detection note: worse than hooded.
 *
 * ── How it works ─────────────────────────────────────────────────────────
 *
 *  1. Extracts a 3× iris-diameter crop from the source image (capped at 500 px)
 *  2. Establishes a horizontal reference luminance (3 & 9 o'clock iris tissue)
 *  3. Fires 11 upper-hemisphere rays; any ray ≥28% darker than ref → lid blocked
 *  4. Checks for lower sclera (6 o'clock, just outside iris)
 *  5. Scans for a lid-crease brightness dip just above the iris
 *  6. Classifies from upperCoverage + lowerSclera + lidCrease
 *
 * ── Return value ─────────────────────────────────────────────────────────
 *
 *  shape:      string   'almond' | 'round' | 'hooded' | 'monolid' | 'unknown'
 *  label:      string   Display name, e.g. 'Almond'
 *  confidence: number   0–1  (0.30–0.90 range in practice)
 *  traits: {
 *    upperCoverage:       number  0–1  (fraction of upper rays blocked by lid)
 *    lowerScleraVisible:  bool    true = bright white below iris
 *    lidCreaseVisible:    bool    false = monolid indicator
 *    lateralScleraScore:  number  0–1  (sclera brightness flanking iris)
 *  }
 *  advisory:   string|null  Detection-relevant note, or null if no concern.
 *
 * @param {HTMLImageElement} imgEl
 * @param {Object} irisSpec  { cx, cy, rIris, rPupil, drawInfo:{dx,dy,dw,dh} }
 * @returns {Object}
 */
function classifyEyeShape(imgEl, irisSpec) {
  var UNKNOWN = {
    shape: 'unknown', label: 'Unknown', confidence: 0,
    traits: null, advisory: null
  };

  if (!imgEl || !irisSpec || !(irisSpec.rIris > 0)) return UNKNOWN;
  var di = irisSpec.drawInfo;
  if (!di || !(di.dw > 0) || !(di.dh > 0)) return UNKNOWN;

  var srcW = imgEl.naturalWidth  || imgEl.width  || 0;
  var srcH = imgEl.naturalHeight || imgEl.height || 0;
  if (srcW <= 0 || srcH <= 0) return UNKNOWN;

  /* ── Map iris from stage coords → source-image coords ─────────────── */
  var sxR = srcW / di.dw,  syR = srcH / di.dh;
  var iCx = (irisSpec.cx - di.dx) * sxR;
  var iCy = (irisSpec.cy - di.dy) * syR;
  var iR  = irisSpec.rIris * sxR;
  var pR  = Math.max(iR * 0.15, (irisSpec.rPupil || 0) * sxR);

  /* ── Extract periocular region (3× iris diameter), cap at 500 px ─── */
  var rawMargin = Math.round(iR * 3.0);
  var rx0 = Math.max(0, Math.round(iCx - rawMargin));
  var ry0 = Math.max(0, Math.round(iCy - rawMargin));
  var rx1 = Math.min(srcW, Math.round(iCx + rawMargin));
  var ry1 = Math.min(srcH, Math.round(iCy + rawMargin));
  if (rx1 - rx0 < 20 || ry1 - ry0 < 20) return UNKNOWN;

  var rawW = rx1 - rx0,  rawH = ry1 - ry0;
  var maxPx = 500;
  var cs  = Math.min(1, maxPx / Math.max(rawW, rawH));  // canvas scale
  var cW  = Math.round(rawW * cs),  cH  = Math.round(rawH * cs);

  /* ── Canvas coords for iris center + radii ─────────────────────────── */
  var lcx = (iCx - rx0) * cs;
  var lcy = (iCy - ry0) * cs;
  var liR = iR * cs;
  var lpR = pR * cs;

  /* ── Draw into work canvas ──────────────────────────────────────────── */
  var tmp = document.createElement('canvas');
  tmp.width = cW; tmp.height = cH;
  try {
    tmp.getContext('2d', { colorSpace: 'srgb' }).drawImage(imgEl, rx0, ry0, rawW, rawH, 0, 0, cW, cH);
  } catch (e) { return UNKNOWN; }

  var data;
  try {
    data = tmp.getContext('2d', { colorSpace: 'srgb' }).getImageData(0, 0, cW, cH).data;
  } catch (e) { return UNKNOWN; }  // CORS taint

  /* ── Pixel helpers ──────────────────────────────────────────────────── */
  function lum(x, y) {
    var px = Math.max(0, Math.min(cW - 1, Math.round(x)));
    var py = Math.max(0, Math.min(cH - 1, Math.round(y)));
    var i  = (py * cW + px) * 4;
    return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  var pr = Math.max(2, Math.round(liR * 0.07));  // patch radius ≈ 7% of irisR
  function patchLum(x, y, r) {
    r = r || pr;
    r = Math.max(1, Math.round(r));
    var s = 0, n = 0;
    for (var dy = -r; dy <= r; dy++) {
      for (var dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        s += lum(x + dx, y + dy);
        n++;
      }
    }
    return n > 0 ? s / n : 0;
  }

  /* ── Horizontal reference luminance (iris tissue at 3 & 9 o'clock) ── */
  // These positions are rarely occluded by lids. Used as a per-photo baseline
  // so dark irises don't inflate the upper-coverage score.
  var sR       = liR * 0.78;          // sample radius — well inside iris ring
  var horizRef = (patchLum(lcx + sR, lcy) + patchLum(lcx - sR, lcy)) / 2;
  var darkThresh = horizRef * 0.72;   // 28% darker than horizontal = lid/lash

  /* ── 1. Upper lid coverage ─────────────────────────────────────────── */
  // 11 rays spanning the upper hemisphere (200°→340°; 270°=straight up in
  // screen coords where y increases downward).
  // A ray is "covered" when its iris-annulus sample is ≥28% darker than the
  // horizontal reference — compensates for naturally dark irises.
  var COV_ANGLES = [200, 214, 228, 242, 256, 270, 284, 298, 312, 326, 340];
  var covBlocked = 0;
  for (var ai = 0; ai < COV_ANGLES.length; ai++) {
    var rad = COV_ANGLES[ai] * Math.PI / 180;
    if (patchLum(lcx + sR * Math.cos(rad), lcy + sR * Math.sin(rad)) < darkThresh) {
      covBlocked++;
    }
  }
  var upperCoverage = covBlocked / COV_ANGLES.length;

  /* ── 2. Lower sclera visibility ─────────────────────────────────────── */
  // Sample just outside the iris at 6 o'clock. Bright = visible white sclera
  // below the iris → round / wide-open eye.
  var lowerLum            = patchLum(lcx, lcy + liR * 1.22, pr * 1.5);
  var lowerScleraVisible  = lowerLum > 130;

  /* ── 3. Lid crease detection ────────────────────────────────────────── */
  // Scan a vertical strip above the upper iris (1.05–1.45× irisR above center).
  // A lid crease = a local dark band in this zone (shadow in the eyelid fold).
  // Absent in monolid eyes, which show smooth eyelid skin with no dip.
  var creaseStep = Math.max(1, Math.round(liR * 0.04));
  var creaseMin = 255, creaseMax = 0;
  for (var r = Math.round(liR * 1.05); r <= Math.round(liR * 1.45); r += creaseStep) {
    var cl = patchLum(lcx, lcy - r);
    if (cl < creaseMin) creaseMin = cl;
    if (cl > creaseMax) creaseMax = cl;
  }
  // Crease = brightness dip of ≥25 lum units AND the dip is in a reasonably
  // dark range (rules out a dark brow as a false crease)
  var lidCreaseVisible = (creaseMax - creaseMin) >= 25 && creaseMin < 145;

  /* ── 4. Lateral sclera score ────────────────────────────────────────── */
  var rightSclera      = patchLum(lcx + liR * 1.35, lcy, pr * 1.5);
  var leftSclera       = patchLum(lcx - liR * 1.35, lcy, pr * 1.5);
  var lateralScleraScore = Math.min(1, (rightSclera + leftSclera) / 2 / 180);

  /* ── Classification ─────────────────────────────────────────────────── */
  var shape, label, confidence, advisory = null;

  if (upperCoverage >= 0.64) {
    // Large fraction of upper iris blocked — hooded or monolid
    if (!lidCreaseVisible && upperCoverage >= 0.73) {
      shape      = 'monolid';
      label      = 'Monolid';
      confidence = 0.50 + (upperCoverage - 0.73) * 1.5;
      advisory   = 'Monolid shape — upper iris likely occluded. Manual ring adjustment recommended.';
    } else {
      shape      = 'hooded';
      label      = 'Hooded';
      confidence = 0.50 + (upperCoverage - 0.64) * 1.0;
      advisory   = 'Hooded lid — upper iris may be partially occluded. Results reflect visible region.';
    }
  } else if (lowerScleraVisible && upperCoverage < 0.28) {
    // Sclera below iris and open above → round
    shape      = 'round';
    label      = 'Round';
    confidence = 0.55 + Math.min(0.28, (lowerLum - 130) / 150 * 0.25);
    advisory   = null;
  } else {
    // Default: almond (most common)
    shape      = 'almond';
    label      = 'Almond';
    confidence = 0.55 + (0.64 - upperCoverage) * 0.30;
    advisory   = null;
  }

  confidence = Math.min(0.90, Math.max(0.30, confidence));

  return {
    shape:      shape,
    label:      label,
    confidence: Math.round(confidence * 100) / 100,
    traits: {
      upperCoverage:       Math.round(upperCoverage      * 100) / 100,
      lowerScleraVisible:  lowerScleraVisible,
      lidCreaseVisible:    lidCreaseVisible,
      lateralScleraScore:  Math.round(lateralScleraScore * 100) / 100
    },
    advisory: advisory
  };
}
