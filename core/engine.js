'use strict';

// ======================= IRIS ANALYSIS ENGINE =======================
// Pure analysis function — no DOM, no globals, no side effects.
// Works in any UI: eye-D, Blake's UI, a native app wrapper, a server.
//
// Requires (load before this file):
//   core/palette.js   — PALETTE, rgbLab, dE, nearestPal, RARITY,
//                       computeRarityScore, getVibe, rgbHsv, rgbToHex
//   core/rayid.js     — unwrapIris, classifyRayid, RAYID_META
//   core/collarette.js — detectCollarette
//
// Usage:
//   var result = analyzeIris(imgEl, donut, drawInfo, stageW, stageH, side, userAge, options);
//   if (result.error) { /* show error */ } else { /* use result */ }
//
// Parameters:
//   imgEl    — HTMLImageElement containing the eye photo
//   donut    — { cx, cy, cxPupil, cyPupil, rIris, rPupil, threshHi }
//   drawInfo — { dx, dy, dw, dh } (how imgEl is laid out on the stage)
//   stageW   — stage canvas width in pixels
//   stageH   — stage canvas height in pixels
//   side     — 'Left' | 'Right'
//   userAge  — user age in years (0 = unknown)
//   options  — optional: { eyeShape: {label, ar, tiltDeg} | null }
//
// Returns a result object with all iris features, or { error: 'message' }

function analyzeIris(imgEl, donut, drawInfo, stageW, stageH, side, userAge, options) {
  options  = options  || {};
  userAge  = userAge  || 0;

  var off = document.createElement('canvas');
  off.width = stageW; off.height = stageH;
  var octx = off.getContext('2d');
  octx.fillStyle = '#000'; octx.fillRect(0, 0, stageW, stageH);
  octx.drawImage(imgEl, drawInfo.dx, drawInfo.dy, drawInfo.dw, drawInfo.dh);
  var d = octx.getImageData(0, 0, stageW, stageH).data;
  var cx = donut.cx, cy = donut.cy, rOut = donut.rIris;
  // Always enforce a minimum inner exclusion zone even if pupil detection failed
  // (e.g. catch-light kills the scan and rPupil=6). Luminance filters below then
  // exclude any remaining dark pupil tissue that leaks outside this ring.
  var rIn = Math.max(donut.rPupil || 0, rOut * 0.08);
  var cxP = donut.cxPupil != null ? donut.cxPupil : cx;
  var cyP = donut.cyPupil != null ? donut.cyPupil : cy;
  // innerBand: boundary between inner (collarette zone) and outer (true iris body).
  // Pushed from 0.45 → 0.62 so a prominent collarette — which can extend to ~55%
  // of the iris span — is fully captured in `inner` rather than contaminating the
  // `outer` dominant color. `outerM` (= overall color) then reads clean stroma.
  var innerBand = rIn + (rOut - rIn) * 0.62;
  // Tighter zones for central-heterochromia gradient detection. The pupillary
  // zone (innermost 25% of the iris-pupil annulus) and ciliary zone (outermost
  // 50%) compare against each other for warmth/lightness gradients — catches
  // "Bryan-style" central het that doesn't cross palette categories but has
  // an obvious brown/amber inner ring within a blue/gray iris (Δb > 4 in Lab).
  var pupilZoneCut  = rIn + (rOut - rIn) * 0.25;
  var ciliaryZoneCut = rIn + (rOut - rIn) * 0.55;
  var inner = [], outer = [], edge = [], bodyIris = [];
  var pupilZone = [], ciliaryZone = [];
  var edgeDarkSum = 0, edgeDarkCount = 0, midLumSum = 0, midLumCount = 0;
  // Sectoral heterochromia: accumulate per-wedge pixel arrays + base-band Lab sums.
  // 12 wedges of 30 deg, base band = [0.30, 0.85] of rIris (matches Python ref).
  var SECT_WEDGES = 12, SECT_LO = 0.30, SECT_HI = 0.85;
  var wedgePix = [];
  for (var wi = 0; wi < SECT_WEDGES; wi++) wedgePix.push([]);
  var baseLsum = 0, baseAsum = 0, baseBsum = 0, baseN = 0;
  var x0 = Math.max(0, Math.floor(cx - rOut));
  var x1 = Math.min(stageW, Math.ceil(cx + rOut));
  var y0 = Math.max(0, Math.floor(cy - rOut));
  var y1 = Math.min(stageH, Math.ceil(cy + rOut));
  var maskStats = {sclera:0, lash:0, lid:0, glare:0, shadow:0, kept:0};
  // Freckle detection bbox: capture L channel + valid-iris mask for DoG pass.
  // valid_iris for freckles is more permissive than analyze's main mask: we
  // KEEP dark blobs (lash filter would kill freckles), so the freckle pass
  // re-derives the mask using only iris-ring + glare + sclera + lid cone.
  var FRK_INNER_F = 1.15, FRK_OUTER_F = 0.85;
  var bboxW = x1 - x0, bboxH = y1 - y0;
  var Lbuf = new Float32Array(bboxW * bboxH);
  var validFrk = new Uint8Array(bboxW * bboxH);
  for (var y = y0; y < y1; y++){
    for (var x = x0; x < x1; x++){
      var dx = x - cx, dy = y - cy;
      var dist = Math.sqrt(dx*dx + dy*dy);
      var distP = Math.sqrt((x-cxP)*(x-cxP) + (y-cyP)*(y-cyP));
      var i = (y * stageW + x) * 4;
      var r = d[i], g = d[i+1], b = d[i+2], a = d[i+3];
      // Always populate Lbuf for the bbox so the freckle DoG pass has padding.
      // (Use rgbLab for accurate perceptual L; same function used elsewhere.)
      var bboxIdx = (y - y0) * bboxW + (x - x0);
      Lbuf[bboxIdx] = (a >= 200) ? rgbLab(r, g, b)[0] : 0;
      // Freckle mask: iris ring (with limbal pullback) + skip glare/sclera/lid,
      // but KEEP dark pixels (no lash/shadow filter — those would kill freckles).
      if (a >= 200 && distP >= rIn * FRK_INNER_F && dist <= rOut * FRK_OUTER_F) {
        var lumF = 0.299*r + 0.587*g + 0.114*b;
        var mxF = Math.max(r,g,b), mnF = Math.min(r,g,b);
        var satF = mxF>0 ? (mxF - mnF)/mxF : 0;
        var lidF = Math.abs(dy) / (dist > 0 ? dist : 1) > 0.34;
        if (!(lumF > 230) && !(lumF > 190 && satF < 0.12) && !lidF) {
          validFrk[bboxIdx] = 1;
        }
      }
      if (distP < rIn || dist > rOut) continue;
      if (a < 200) continue;
      var lum = 0.299*r + 0.587*g + 0.114*b;
      var mxc = Math.max(r,g,b), mnc = Math.min(r,g,b);
      var satP = mxc>0 ? (mxc - mnc)/mxc : 0;
      // Glare (existing)
      if (lum > donut.threshHi) { maskStats.glare++; continue; }
      // Sclera: bright + desaturated (keeps pale blue irises since they're less bright)
      if (lum > 190 && satP < 0.12) { maskStats.sclera++; continue; }
      // Deep shadow / pupil tissue — raised from 18→32 so any pupil pixels
      // that leak outside the rIn exclusion ring are still rejected without
      // affecting dark-brown irises (which are warm-toned, lum typically >40).
      if (lum < 32) { maskStats.shadow++; continue; }
      // Eyelash: dark + desaturated (keeps dark brown iris because it's warm)
      if (lum < 55 && satP < 0.15) { maskStats.lash++; continue; }
      // Eyelid wedges: reject top/bottom ~20 degree cones
      if (Math.abs(dy) / dist > 0.34) { maskStats.lid++; continue; }
      maskStats.kept++;
      // Outer ring band (0.85-1.00) for limbal-ring color isolation.
      // Widened from 0.92 → 0.85 for more pixels and a more stable dominant.
      if (dist > rOut * 0.85) {
        edge.push([r,g,b]);
        edgeDarkSum += lum; edgeDarkCount++;
      }
      // Clean iris body band (0.35-0.82) — excludes the edge ring so it can
      // serve as an uncontaminated baseline for the limbal comparison.
      if (dist >= rOut * 0.35 && dist < rOut * 0.82) {
        bodyIris.push([r,g,b]);
      }
      // Mid band kept for backwards compatibility (no longer drives limbal label)
      if (dist > rOut * 0.40 && dist < rOut * 0.80) {
        midLumSum += lum; midLumCount++;
      }
      if (dist < innerBand) inner.push([r,g,b]);
      else outer.push([r,g,b]);
      // Pupillary / ciliary zones for central-het gradient detection
      if (dist < pupilZoneCut) pupilZone.push([r,g,b]);
      else if (dist >= ciliaryZoneCut) ciliaryZone.push([r,g,b]);
      // Sectoral: collect pixels in the iris-baseline band, bucketed by wedge.
      if (dist >= rOut * SECT_LO && dist <= rOut * SECT_HI) {
        var ang = Math.atan2(dy, dx);
        if (ang < 0) ang += 2*Math.PI;
        var widx = Math.floor(ang / (2*Math.PI / SECT_WEDGES));
        if (widx >= SECT_WEDGES) widx = 0;
        wedgePix[widx].push([r,g,b]);
        // Pixel-weighted Lab mean for the entire base band (robust baseline)
        var pl = rgbLab(r,g,b);
        baseLsum += pl[0]; baseAsum += pl[1]; baseBsum += pl[2]; baseN++;
      }
    }
  }
  window.__lastMaskStats = maskStats;

  // === Sclera white-balance ===
  // Sample the whites of the eye flanking the iris as a neutral reference.
  // Gray-world correction: scale each channel so the sclera reads as neutral,
  // removing the color cast from warm/cool ambient light before any color match.
  var scleraSamples = [];
  var sclWBands = [
    [Math.max(0, Math.floor(cx - rOut * 2.6)), Math.max(0, Math.floor(cx - rOut * 1.15))],
    [Math.min(stageW, Math.ceil(cx + rOut * 1.15)), Math.min(stageW, Math.ceil(cx + rOut * 2.6))]
  ];
  var sclYlo = Math.max(0, Math.floor(cy - rOut * 0.4));
  var sclYhi = Math.min(stageH, Math.ceil(cy + rOut * 0.4));
  for (var si = 0; si < 2; si++) {
    var sxLo = sclWBands[si][0], sxHi = sclWBands[si][1];
    for (var sy = sclYlo; sy < sclYhi; sy++) {
      for (var sx = sxLo; sx < sxHi; sx++) {
        var sIdx = (sy * stageW + sx) * 4;
        if (d[sIdx+3] < 200) continue;
        var sr = d[sIdx], sg = d[sIdx+1], sb = d[sIdx+2];
        var slum = 0.299*sr + 0.587*sg + 0.114*sb;
        var smx = Math.max(sr, sg, sb);
        var ssat = smx > 0 ? (smx - Math.min(sr, sg, sb)) / smx : 0;
        if (slum > 160 && ssat < 0.20) scleraSamples.push([sr, sg, sb]);
      }
    }
  }
  var wbR = 1, wbG = 1, wbB = 1;
  if (scleraSamples.length >= 30) {
    var wbSumR = 0, wbSumG = 0, wbSumB = 0;
    for (var pi = 0; pi < scleraSamples.length; pi++) {
      wbSumR += scleraSamples[pi][0];
      wbSumG += scleraSamples[pi][1];
      wbSumB += scleraSamples[pi][2];
    }
    var wbMeanR = wbSumR / scleraSamples.length;
    var wbMeanG = wbSumG / scleraSamples.length;
    var wbMeanB = wbSumB / scleraSamples.length;
    var wbGray = (wbMeanR + wbMeanG + wbMeanB) / 3;
    wbR = wbMeanR > 0 ? Math.min(1.35, Math.max(0.74, wbGray / wbMeanR)) : 1;
    wbG = wbMeanG > 0 ? Math.min(1.35, Math.max(0.74, wbGray / wbMeanG)) : 1;
    wbB = wbMeanB > 0 ? Math.min(1.35, Math.max(0.74, wbGray / wbMeanB)) : 1;
  }
  window.__lastWB = { n: scleraSamples.length, wbR: wbR, wbG: wbG, wbB: wbB };
  function applyWB(arr) {
    for (var wi = 0; wi < arr.length; wi++) {
      arr[wi][0] = Math.min(255, Math.round(arr[wi][0] * wbR));
      arr[wi][1] = Math.min(255, Math.round(arr[wi][1] * wbG));
      arr[wi][2] = Math.min(255, Math.round(arr[wi][2] * wbB));
    }
  }
  applyWB(inner); applyWB(outer); applyWB(edge); applyWB(bodyIris);
  applyWB(pupilZone); applyWB(ciliaryZone);
  for (var wbi = 0; wbi < SECT_WEDGES; wbi++) applyWB(wedgePix[wbi]);
  // Recompute base-band Lab means from corrected wedge pixels
  baseLsum = 0; baseAsum = 0; baseBsum = 0; baseN = 0;
  for (var wbi2 = 0; wbi2 < SECT_WEDGES; wbi2++) {
    for (var wpi = 0; wpi < wedgePix[wbi2].length; wpi++) {
      var wp = wedgePix[wbi2][wpi];
      var wpl = rgbLab(wp[0], wp[1], wp[2]);
      baseLsum += wpl[0]; baseAsum += wpl[1]; baseBsum += wpl[2]; baseN++;
    }
  }

  if (outer.length < 50){
    return { error: 'Not enough iris pixels. If wearing glasses, try removing them. Otherwise drag the circle onto your iris and make it larger.' };
  }
  function dominant(pixels){
    if (!pixels.length) return null;
    var buckets = {}, keys = [];
    for (var k=0;k<pixels.length;k++){
      var p = pixels[k];
      var key = ((p[0]>>4)<<8) | ((p[1]>>4)<<4) | (p[2]>>4);
      var v = buckets[key];
      if (!v){ v = {n:0,r:0,g:0,b:0}; buckets[key] = v; keys.push(key); }
      v.n++; v.r += p[0]; v.g += p[1]; v.b += p[2];
    }
    var best = null;
    for (var m=0;m<keys.length;m++){
      var v2 = buckets[keys[m]];
      if (!best || v2.n > best.n) best = v2;
    }
    return [Math.round(best.r/best.n), Math.round(best.g/best.n), Math.round(best.b/best.n)];
  }
  function topK(pixels, k){
    var buckets = {}, keys = [];
    for (var kk=0;kk<pixels.length;kk++){
      var p = pixels[kk];
      var key = ((p[0]>>4)<<8) | ((p[1]>>4)<<4) | (p[2]>>4);
      var v = buckets[key];
      if (!v){ v = {n:0,r:0,g:0,b:0}; buckets[key] = v; keys.push(key); }
      v.n++; v.r += p[0]; v.g += p[1]; v.b += p[2];
    }
    var arr = keys.map(function(kk2){ var v = buckets[kk2];
      return { n: v.n, rgb: [Math.round(v.r/v.n), Math.round(v.g/v.n), Math.round(v.b/v.n)] };
    });
    arr.sort(function(a,b){ return b.n - a.n; });
    return arr.slice(0, k);
  }
  var innerDom    = dominant(inner.length ? inner : outer);
  var outerDom    = dominant(outer);
  var edgeDom     = dominant(edge.length ? edge : outer);
  var bodyIrisDom = dominant(bodyIris.length >= 30 ? bodyIris : outer);
  var innerM = nearestPal(innerDom), outerM = nearestPal(outerDom);
  // ===== Heterochromia: combined detection =====
  // Path 1 (legacy): cross-category color shift between inner/outer halves
  //   (catches Bowie-style cross-category central hetero like brown/blue).
  // Path 2 (new): warmth/lightness gradient between tight pupillary zone
  //   (innermost 25%) and ciliary zone (outermost 50%) — even within the same
  //   palette category. Calibrated against Bryan's eyes (Δb≈+9.8, ΔL≈+6.2)
  //   where the brown pupillary ring sits inside a blue-gray iris.
  var heteroDist = dE(rgbLab(innerDom[0],innerDom[1],innerDom[2]),
                      rgbLab(outerDom[0],outerDom[1],outerDom[2]));
  var hetero = 'None', heteroDb = 0, heteroDL = 0;
  // Names + RGB for the pupillary and ciliary zones (always populated when
  // we have enough samples, so the Davis Card can show the inner-ring color
  // even when the gradient detection didn't trigger).
  var heteroPup = null, heteroCil = null;
  if (pupilZone.length >= 20 && ciliaryZone.length >= 20) {
    var pupDom_ = dominant(pupilZone), cilDom_ = dominant(ciliaryZone);
    var pupLab_ = rgbLab(pupDom_[0], pupDom_[1], pupDom_[2]);
    var cilLab_ = rgbLab(cilDom_[0], cilDom_[1], cilDom_[2]);
    heteroPup = { rgb: pupDom_, lab: pupLab_, color: nearestPal(pupDom_).entry };
    heteroCil = { rgb: cilDom_, lab: cilLab_, color: nearestPal(cilDom_).entry };
  }
  if (heteroDist > 25 && innerM.entry.cat !== outerM.entry.cat) hetero = 'Central';
  else if (heteroDist > 14) hetero = 'Subtle';
  // Path 2: warmth/lightness gradient between zones
  if (hetero === 'None' && heteroPup && heteroCil) {
    heteroDb = heteroPup.lab[2] - heteroCil.lab[2];   // positive = pupillary zone is warmer
    heteroDL = heteroPup.lab[0] - heteroCil.lab[0];   // positive = pupillary zone is lighter
    if (Math.abs(heteroDb) > 4 && Math.abs(heteroDb) > Math.abs(heteroCil.lab[2])) {
      hetero = 'Central (warmth gradient)';
    } else if (heteroDL > 6) {
      hetero = 'Central (lightness gradient)';
    }
  }
  // Synthesize a descriptive ring name when both zones collapse to the same
  // palette anchor (e.g. desaturated browns within blue-gray that both round
  // to "Graphite"). Uses Lab b (warmth) and L (lightness) directly.
  if (heteroPup && heteroCil) {
    function describeRing(lab, isWarmer, isLighter){
      var b = lab[2], L = lab[0];
      if (isWarmer) {
        if (b > 18)  return L > 55 ? 'Golden' : 'Amber';
        if (b > 10)  return L > 55 ? 'Honey' : 'Bronze';
        if (b > 4)   return L > 55 ? 'Warm Tan' : 'Warm Bronze';
        return 'Warm-tinged';
      }
      if (isLighter) {
        if (L > 70)  return 'Pale';
        if (L > 50)  return 'Light';
        return 'Lighter';
      }
      // cooler zone descriptor
      if (b < -18) return L > 55 ? 'Ice Blue' : 'Deep Blue';
      if (b < -10) return 'Cool Blue';
      if (b < -4)  return L > 55 ? 'Cool-blue' : 'Slate-blue';
      if (L < 35)  return 'Deep';
      if (L > 65)  return 'Pale';
      return null;
    }
    if (heteroPup.color.name === heteroCil.color.name) {
      // Collisions — synthesize names from Lab values
      var pupName = describeRing(heteroPup.lab, heteroDb > 4, heteroDL > 6);
      var cilName = describeRing(heteroCil.lab, false, false);
      heteroPup.displayName = pupName || heteroPup.color.name;
      heteroCil.displayName = cilName || heteroCil.color.name;
    } else {
      heteroPup.displayName = heteroPup.color.name;
      heteroCil.displayName = heteroCil.color.name;
    }
  }
  // Limbal ring detection — compare the clean iris body (0.35-0.82 of rOut, no edge
  // contamination) against the outer ring band (0.85-1.00) in full Lab space.
  // Using dE as the primary metric catches both luminance-only rings (dark rim) and
  // hue/chroma-shift rings (warm amber halo). ΔL sign determines ring vs halo type.
  var edgeLab      = rgbLab(edgeDom[0],      edgeDom[1],      edgeDom[2]);
  var bodyIrisLab  = rgbLab(bodyIrisDom[0],  bodyIrisDom[1],  bodyIrisDom[2]);
  var outerLab     = rgbLab(outerDom[0],     outerDom[1],     outerDom[2]);  // kept for brightness/sat below
  // Signed L drop: positive = ring is darker (typical limbal ring),
  // negative = ring is brighter than the iris baseline (a "halo" — bright
  // amber/golden zone just inside the iris edge, like Carlie's iris).
  var limbalDropL    = bodyIrisLab[0] - edgeLab[0];
  var limbalAbsDrop  = Math.abs(limbalDropL);
  var limbalContrast = dE(bodyIrisLab, edgeLab);
  var limbalLabel = 'None';
  if      (limbalContrast > 28) limbalLabel = 'Dramatic';
  else if (limbalContrast > 18) limbalLabel = 'Strong';
  else if (limbalContrast > 10) limbalLabel = 'Moderate';
  else if (limbalContrast >  5) limbalLabel = 'Faint';
  // Distinguish "ring" from "halo" — both are real iris features.
  var limbalType = (limbalDropL >= 0) ? 'ring' : 'halo';
  // Ring color: only meaningful when the ring is actually distinct from the iris
  var limbalMatch = nearestPal(edgeDom);
  var limbalColor = (limbalLabel === 'None') ? null : limbalMatch.entry;
  var hsv = rgbHsv(outerDom[0], outerDom[1], outerDom[2]);
  var brightness = hsv[2] < 0.30 ? 'Dark' : hsv[2] < 0.55 ? 'Medium' : 'Bright';
  var saturation = hsv[1] < 0.18 ? 'Muted' : hsv[1] < 0.40 ? 'Soft' : 'Vivid';
  var top = topK(inner.concat(outer), 4);

  // ===== Sectoral heterochromia detection =====
  // Mirrors sectoral_hetero.py. Pixel-weighted mean Lab of the base band is the
  // canonical "base color" — uniform paint can't hijack it. Per-wedge dominants
  // are checked against base by Lab dE + palette category, with a luminance-
  // envelope guard to reject sclera/lash leakage from oversized auto-fit.
  var SECT_MIN_PX = 40, SECT_MIN_DE = 15, SECT_MIN_SPAN = 2, SECT_MIN_AGREE = 4;
  var SECT_DL_HI = 30, SECT_DL_LO = 32, SECT_LMAX = 80, SECT_LMIN = 12;
  var sectoral = null, sectBaseLab = null, sectBasePal = null;
  if (baseN >= 200) {
    sectBaseLab = [baseLsum/baseN, baseAsum/baseN, baseBsum/baseN];
    // Build per-wedge dominants
    var wInfo = [];
    for (var wi2 = 0; wi2 < SECT_WEDGES; wi2++) {
      var px = wedgePix[wi2];
      if (px.length < SECT_MIN_PX) { wInfo.push(null); continue; }
      var dom = dominant(px);
      var dlab = rgbLab(dom[0], dom[1], dom[2]);
      var pal = nearestPal(dom);
      wInfo.push({rgb: dom, lab: dlab, pal: pal.entry, n: px.length});
    }
    var validW = wInfo.filter(function(w){ return w; });
    if (validW.length >= SECT_MIN_AGREE) {
      // Pick representative wedge for base display = wedge closest to base Lab
      var baseWedge = validW[0], baseBest = Infinity;
      for (var k1 = 0; k1 < validW.length; k1++) {
        var de1 = dE(validW[k1].lab, sectBaseLab);
        if (de1 < baseBest) { baseBest = de1; baseWedge = validW[k1]; }
      }
      sectBasePal = baseWedge.pal;
      // Flag discordant wedges
      var flags = [];
      for (var wi3 = 0; wi3 < SECT_WEDGES; wi3++) {
        var w3 = wInfo[wi3];
        if (!w3) { flags.push(false); continue; }
        var de3 = dE(w3.lab, sectBaseLab);
        w3.dE = de3;
        var wL = w3.lab[0];
        var inEnv = (wL <= sectBaseLab[0] + SECT_DL_HI) &&
                    (wL >= sectBaseLab[0] - SECT_DL_LO) &&
                    (wL >= SECT_LMIN) && (wL <= SECT_LMAX);
        var diffCat = w3.pal.cat !== sectBasePal.cat;
        flags.push(diffCat && (de3 >= SECT_MIN_DE) && inEnv);
      }
      // Find contiguous groups (with wrap-around)
      var groups = [];
      for (var ii = 0; ii < SECT_WEDGES; ) {
        if (!flags[ii]) { ii++; continue; }
        var s = ii;
        while (ii < SECT_WEDGES && flags[ii]) ii++;
        groups.push({start: s, len: ii - s});
      }
      if (groups.length >= 2 &&
          groups[0].start === 0 &&
          groups[groups.length-1].start + groups[groups.length-1].len === SECT_WEDGES) {
        var first = groups.shift();
        var last  = groups.pop();
        groups.push({start: last.start, len: last.len + first.len});
      }
      var big = groups.filter(function(g){ return g.len >= SECT_MIN_SPAN; });
      big.sort(function(a,b){ return b.len - a.len; });
      if (big.length) {
        var g0 = big[0];
        var members = [];
        for (var mm = 0; mm < g0.len; mm++) {
          var idx = (g0.start + mm) % SECT_WEDGES;
          if (wInfo[idx]) members.push(wInfo[idx]);
        }
        var winner = members[0];
        for (var mm2 = 1; mm2 < members.length; mm2++) {
          if (members[mm2].n > winner.n) winner = members[mm2];
        }
        var sumDe = 0;
        for (var mm3 = 0; mm3 < members.length; mm3++) sumDe += members[mm3].dE;
        var centerW = (g0.start + g0.len/2 - 0.5);
        // wrap into 0..SECT_WEDGES-1
        centerW = ((centerW % SECT_WEDGES) + SECT_WEDGES) % SECT_WEDGES;
        var centerDeg = (centerW + 0.5) * (360 / SECT_WEDGES);
        var clockH = Math.round((centerDeg + 90) / 30) % 12;
        if (clockH === 0) clockH = 12;
        sectoral = {
          color:    winner.pal,
          rgb:      winner.rgb,
          clock:    clockH,
          spanW:    g0.len,
          spanDeg:  g0.len * (360 / SECT_WEDGES),
          meanDE:   sumDe / members.length
        };
      }
    }
  }

  // ===== Freckle (iris nevus) detection =====
  // Multi-scale Difference of Gaussians on the Lab L channel. Mirrors freckles.py.
  // Constants validated on UBIRIS: synthetic positive at 0.5px, mean 0.5/image
  // false-positive rate. See freckles.py for full design.
  var FRK_SIGMAS = [1.5, 2.5, 4.0];
  var FRK_K = 1.6;
  var FRK_CONTRAST = 3.5;
  var FRK_LOCAL_R = 3;
  var FRK_MIN_DROP = 10.0;
  var FRK_MIN_CV = 0.70;
  var FRK_MAX = 10;
  var FRK_NMS_F = 2.0;
  var FRK_RING_LMIN = 22;
  var FRK_RING_LMAX = 75;
  var freckles = [];

  function frkGaussKernel(sigma){
    var rad = Math.max(1, Math.ceil(3.0 * sigma));
    var k = new Float32Array(2*rad+1), sum = 0;
    for (var ki = -rad; ki <= rad; ki++){
      var v = Math.exp(-(ki*ki)/(2*sigma*sigma));
      k[ki+rad] = v; sum += v;
    }
    for (var ki2 = 0; ki2 < k.length; ki2++) k[ki2] /= sum;
    return { k: k, r: rad };
  }
  function frkConvSep(src, W, H, sigma){
    var kk = frkGaussKernel(sigma), kern = kk.k, rad = kk.r;
    var tmp = new Float32Array(W*H), out = new Float32Array(W*H);
    // horizontal
    for (var yy = 0; yy < H; yy++){
      for (var xx = 0; xx < W; xx++){
        var sum = 0;
        for (var ki = -rad; ki <= rad; ki++){
          var sx = xx + ki;
          if (sx < 0) sx = -sx; else if (sx >= W) sx = 2*W - sx - 2;
          sum += src[yy*W + sx] * kern[ki+rad];
        }
        tmp[yy*W + xx] = sum;
      }
    }
    // vertical
    for (var yy2 = 0; yy2 < H; yy2++){
      for (var xx2 = 0; xx2 < W; xx2++){
        var sum2 = 0;
        for (var ki2 = -rad; ki2 <= rad; ki2++){
          var sy = yy2 + ki2;
          if (sy < 0) sy = -sy; else if (sy >= H) sy = 2*H - sy - 2;
          sum2 += tmp[sy*W + xx2] * kern[ki2+rad];
        }
        out[yy2*W + xx2] = sum2;
      }
    }
    return out;
  }

  if (bboxW > 12 && bboxH > 12) {
    var frkCands = [];
    for (var si = 0; si < FRK_SIGMAS.length; si++){
      var sigma = FRK_SIGMAS[si];
      var Gin = frkConvSep(Lbuf, bboxW, bboxH, sigma);
      var Gout = frkConvSep(Lbuf, bboxW, bboxH, sigma * FRK_K);
      var rad = FRK_LOCAL_R;
      var innerR = sigma * Math.SQRT2 * 1.4, outerR = sigma * 3.5;
      var ringR = Math.round(outerR);
      for (var yy3 = rad; yy3 < bboxH - rad; yy3++){
        for (var xx3 = rad; xx3 < bboxW - rad; xx3++){
          if (!validFrk[yy3*bboxW + xx3]) continue;
          var dogV = Gin[yy3*bboxW + xx3] - Gout[yy3*bboxW + xx3];
          if (dogV > -FRK_CONTRAST) continue;
          // local minimum check in (2*rad+1)^2 neighborhood
          var isMin = true;
          for (var dy2 = -rad; dy2 <= rad && isMin; dy2++){
            for (var dx2 = -rad; dx2 <= rad && isMin; dx2++){
              if (dx2 === 0 && dy2 === 0) continue;
              var nv = Gin[(yy3+dy2)*bboxW + (xx3+dx2)] - Gout[(yy3+dy2)*bboxW + (xx3+dx2)];
              if (nv < dogV) isMin = false;
            }
          }
          if (!isMin) continue;
          // Ring annulus mean L (excludes blob, restricts to valid iris)
          var ry0 = Math.max(0, yy3 - ringR), ry1 = Math.min(bboxH, yy3 + ringR + 1);
          var rx0 = Math.max(0, xx3 - ringR), rx1 = Math.min(bboxW, xx3 + ringR + 1);
          var ringSum = 0, ringN = 0;
          var inR2 = innerR*innerR, outR2 = outerR*outerR;
          for (var ry = ry0; ry < ry1; ry++){
            for (var rx = rx0; rx < rx1; rx++){
              if (!validFrk[ry*bboxW + rx]) continue;
              var ddx = rx - xx3, ddy = ry - yy3;
              var d2v = ddx*ddx + ddy*ddy;
              if (d2v < inR2 || d2v > outR2) continue;
              ringSum += Lbuf[ry*bboxW + rx]; ringN++;
            }
          }
          if (ringN < 6) continue;
          var ringMean = ringSum / ringN;
          if (ringMean < FRK_RING_LMIN || ringMean > FRK_RING_LMAX) continue;
          // Bright-side drop + circularity CV via 8-direction probes
          var blobR = sigma * Math.SQRT2;
          var step = Math.max(3, Math.round(blobR * 1.6));
          var offsets = [[step,0],[-step,0],[0,step],[0,-step],
                         [step,step],[step,-step],[-step,step],[-step,-step]];
          var drops = [];
          var Lhere = Lbuf[yy3*bboxW + xx3];
          for (var oi = 0; oi < offsets.length; oi++){
            var nx = xx3 + offsets[oi][0], ny = yy3 + offsets[oi][1];
            if (nx < 0 || nx >= bboxW || ny < 0 || ny >= bboxH) continue;
            if (!validFrk[ny*bboxW + nx]) continue;
            drops.push(Lbuf[ny*bboxW + nx] - Lhere);
          }
          if (drops.length < 6) continue;
          var brightDrop = -Infinity;
          for (var di = 0; di < drops.length; di++) if (drops[di] > brightDrop) brightDrop = drops[di];
          if (brightDrop < FRK_MIN_DROP) continue;
          var posDrops = [];
          for (var pi = 0; pi < drops.length; pi++) if (drops[pi] > 1.0) posDrops.push(drops[pi]);
          if (posDrops.length < 4) continue;
          var meanD = 0;
          for (var mi2 = 0; mi2 < posDrops.length; mi2++) meanD += posDrops[mi2];
          meanD /= posDrops.length;
          var varD = 0;
          for (var vi = 0; vi < posDrops.length; vi++){
            var dv = posDrops[vi] - meanD; varD += dv*dv;
          }
          varD /= posDrops.length;
          var cvF = meanD > 0 ? Math.sqrt(varD) / meanD : 99;
          if (cvF > FRK_MIN_CV) continue;
          frkCands.push({
            x: xx3 + x0, y: yy3 + y0,
            sigma: sigma, rPx: blobR,
            dog: dogV, dropL: brightDrop, cv: cvF
          });
        }
      }
    }
    // Cross-scale NMS: bigger sigma wins
    frkCands.sort(function(a,b){ if (a.sigma !== b.sigma) return b.sigma - a.sigma; return a.dog - b.dog; });
    var kept = [];
    for (var ci = 0; ci < frkCands.length; ci++){
      var c = frkCands[ci], suppr = false;
      for (var kj = 0; kj < kept.length; kj++){
        var dxk = c.x - kept[kj].x, dyk = c.y - kept[kj].y;
        var dk = Math.sqrt(dxk*dxk + dyk*dyk);
        if (dk < Math.max(c.sigma, kept[kj].sigma) * FRK_NMS_F){ suppr = true; break; }
      }
      if (!suppr) kept.push(c);
      if (kept.length >= FRK_MAX) break;
    }
    // Annotate with palette + clock
    for (var fi = 0; fi < kept.length; fi++){
      var fc = kept[fi];
      var pi2 = (fc.y * stageW + fc.x) * 4;
      var fr = d[pi2], fg = d[pi2+1], fb = d[pi2+2];
      fc.rgb = [fr, fg, fb];
      var pal = nearestPal([fr, fg, fb]);
      fc.palette = pal.entry;
      var fdx = fc.x - cx, fdy = fc.y - cy;
      var fdeg = (Math.atan2(fdy, fdx) * 180 / Math.PI + 360) % 360;
      var clockF = Math.round((fdeg + 90) / 30) % 12;
      if (clockF === 0) clockF = 12;
      fc.clock = clockF;
    }
    freckles = kept;
  }

  // ---- Rayid iris type classification ----
  var rayid = null;
  try {
    var stripGray = unwrapIris(d, stageW, stageH, cx, cy, cxP, cyP, rOut, rIn);
    rayid = classifyRayid(stripGray, 360, 64);
  } catch(e) {
    console.warn('Rayid classify failed:', e);
  }

  // ---- Collarette (autonomic nerve wreath) detection ----
  var collarette = null;
  try {
    collarette = detectCollarette(d, stageW, stageH, cx, cy, rOut, rIn);
  } catch(e) {
    console.warn('Collarette detect failed:', e);
  }

  // ---- Pupil eccentricity (iris center vs pupil center offset) ----
  // Close-up images confirmed pupil ≠ iris center; this surfaces the offset.
  var pupilEcc = null;
  try {
    var eccCxP = donut.cxPupil != null ? donut.cxPupil : donut.cx;
    var eccCyP = donut.cyPupil != null ? donut.cyPupil : donut.cy;
    var eccDx  = eccCxP - donut.cx, eccDy = eccCyP - donut.cy;
    var eccPx  = Math.sqrt(eccDx*eccDx + eccDy*eccDy);
    var eccPct = Math.round(eccPx / rOut * 100);
    var eccLabel = eccPct <= 3 ? 'Centered'
                 : eccPct <= 8 ? 'Slight offset · ' + eccPct + '%'
                 : 'Eccentric · ' + eccPct + '%';
    pupilEcc = { label: eccLabel, pct: eccPct };
  } catch(e) {}

  // Build result
  var result = {
    side: side || 'Right',
    userAge: userAge,
    overall: outerM.entry,
    inner: innerM.entry,
    outer: outerM.entry,
    hetero: hetero,
    heteroDb: heteroDb,
    heteroDL: heteroDL,
    heteroDist: heteroDist,
    heteroPup: heteroPup,    // {rgb, color} for inner pupillary zone (always populated when samples sufficient)
    heteroCil: heteroCil,    // {rgb, color} for outer ciliary zone
    limbal: limbalLabel,
    limbalType: limbalType,             // 'ring' (darker rim) or 'halo' (brighter inner edge)
    limbalColor: limbalColor,           // palette entry or null
    limbalRgb: edgeDom,                 // raw ring RGB (for swatch)
    limbalDropL: limbalDropL,           // Lab-L drop, useful for debug/share card
    sectoral: sectoral,                 // {color, rgb, clock, spanW, spanDeg, meanDE} or null
    freckles: freckles,                 // [{x, y, rPx, sigma, dropL, clock, palette, rgb}, ...]
    rarity: RARITY[outerM.entry.cat] || null,                      // {pct, label, line}
    rarityScore: null,   // populated after result object is built
    vibe: getVibe(outerM.entry.cat, outerM.entry.lab),              // descriptive nickname
    fingerprint: {
      lab: rgbLab(outerDom[0], outerDom[1], outerDom[2]),
      hex: rgbToHex(outerDom),
      rgb: outerDom,
    },
    brightness: brightness,
    saturation: saturation,
    topColors: top.map(function(t){ return t.rgb; }),
    // Dual-photo workflow: snapshot the analysis photo + iris fit so the
    // share card can re-render the iris from this image at high resolution
    // even after a portrait photo replaces imgEl.
    analysisImage: {
      src: imgEl ? (imgEl.src || imgEl.toDataURL && imgEl.toDataURL()) : null,
      naturalW: imgEl ? imgEl.naturalWidth : 0,
      naturalH: imgEl ? imgEl.naturalHeight : 0,
      iris: {
        cx: donut.cx, cy: donut.cy,
        rPupil: donut.rPupil, rIris: donut.rIris,
        drawInfo: { dx: drawInfo.dx, dy: drawInfo.dy,
                    dw: drawInfo.dw, dh: drawInfo.dh }
      }
    },
    portraitImage: null,   // populated by btn-portrait flow
    rayid: rayid,          // {label, streamScore, jewelScore, flowerScore} or null
    collarette: collarette, // {label, radialPct, score} or null
    eyeShape: options.eyeShape || null,  // {label, ar, tiltDeg} or null
    pupilEcc: pupilEcc     // {label, pct} or null
  };
  // Compute composite rarity — multiplicative "1 in X" model
  var _rd = computeRarityScore(result);
  result.rarityScore   = _rd.score;
  result.rarityOneInX  = _rd.oneInX;
  result.rarityFactors = _rd.factors;

  return result;
}
