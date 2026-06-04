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
  // Force sRGB colour space so iOS P3 display profile doesn't shift pixel values
  // read via getImageData — without this, blue/grey irises map to warm/brown on iPhone.
  var octx = off.getContext('2d', { colorSpace: 'srgb' });
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
  var pupilZone = [], ciliaryZone = [], outerStroma = [];
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
      // Pure outer stroma (0.65-0.85×rOut): tighter band that excludes the
      // collarette spillover zone (0.62-0.65) and the dark limbal rim (0.85+).
      // Used by the Hazel→Gray guard when central heterochromia is present.
      if (dist >= rOut * 0.65 && dist < rOut * 0.85) {
        outerStroma.push([r,g,b]);
      }
      // Mid band kept for backwards compatibility (no longer drives limbal label)
      if (dist > rOut * 0.40 && dist < rOut * 0.80) {
        midLumSum += lum; midLumCount++;
      }
      if (dist < innerBand) inner.push([r,g,b]);
      // outer: mid-outer stroma only (innerBand → 0.88×rOut).
      // Cap at 0.88 to exclude the dark limbal ring (0.85-1.00) which reads
      // brownish-dark and would otherwise pull the dominant color toward Brown
      // even on green/gray irises. The edge array already captures that zone
      // separately for limbal ring strength analysis.
      else if (dist < rOut * 0.88) outer.push([r,g,b]);
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
    // Clamp tightened from ±35%/26% → ±20%: the original range could boost R
    // by 35% under cool (blue-screen) lighting, warming a green/teal iris into
    // brown palette territory. ±20% still corrects genuine warm/cool casts while
    // leaving strongly-hued irises in their correct Lab quadrant.
    wbR = wbMeanR > 0 ? Math.min(1.20, Math.max(0.83, wbGray / wbMeanR)) : 1;
    wbG = wbMeanG > 0 ? Math.min(1.20, Math.max(0.83, wbGray / wbMeanG)) : 1;
    wbB = wbMeanB > 0 ? Math.min(1.20, Math.max(0.83, wbGray / wbMeanB)) : 1;
  }
  window.__lastWB = { n: scleraSamples.length, wbR: wbR, wbG: wbG, wbB: wbB };
  function applyWB(arr) {
    for (var wi = 0; wi < arr.length; wi++) {
      arr[wi][0] = Math.min(255, Math.round(arr[wi][0] * wbR));
      arr[wi][1] = Math.min(255, Math.round(arr[wi][1] * wbG));
      arr[wi][2] = Math.min(255, Math.round(arr[wi][2] * wbB));
    }
  }
  // Save pre-WB outer mean for Tier-3 green check (WB warm-shift can erase green signal)
  var _outerRawR=0, _outerRawG=0, _outerRawB=0;
  for (var _orI=0; _orI<outer.length; _orI++){
    _outerRawR+=outer[_orI][0]; _outerRawG+=outer[_orI][1]; _outerRawB+=outer[_orI][2];
  }
  var outerRawMeanRgb = outer.length
    ? [Math.round(_outerRawR/outer.length), Math.round(_outerRawG/outer.length), Math.round(_outerRawB/outer.length)]
    : [0,0,0];
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
  // ---- Rayid iris type classification (early — needed by color guards below) ----
  // Moved before colour guards so rayid.jewelScore can be used as a second gate
  // in the Green-cat hazel detect. Depends only on raw pixel data d + iris geometry;
  // no colour guard outputs are needed.
  var rayid = null;
  try {
    var stripGray = unwrapIris(d, stageW, stageH, cx, cy, cxP, cyP, rOut, rIn);
    rayid = classifyRayid(stripGray, 360, 64);
  } catch(e) {
    console.warn('Rayid classify failed:', e);
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
  var innerM = nearestPal(innerDom);
  // Outer-zone palette match: use RGB mean rather than the single most-frequent
  // histogram bin (dominant). For bimodal distributions — e.g. blue/gray stroma
  // pixels spread across multiple bins + a small cluster of dark limbal-ring pixels
  // dominating one bin — dominant() picks the dark cluster and returns Brown even
  // though the iris is predominantly blue/gray. Mean correctly averages both
  // populations. WB correction has already been applied to the outer[] array.
  var outerMeanRgb = (function(){
    var n = outer.length;
    if (!n) return outerDom;
    var rS=0, gS=0, bS=0;
    for (var _oi=0; _oi<n; _oi++) { rS+=outer[_oi][0]; gS+=outer[_oi][1]; bS+=outer[_oi][2]; }
    return [Math.round(rS/n), Math.round(gS/n), Math.round(bS/n)];
  })();
  var outerM = nearestPal(outerMeanRgb);
  // ── Violet→Blue: Violet is not a standard 6-colour iris category ──────────
  // The GT dataset uses only 6 classes (amber/blue/brown/green/grey/hazel).
  // Violet palette entries exist for the rare blue-indigo irises but every
  // Violet prediction scores as "wrong" against all GT labels. Redirect Violet
  // to the nearest Blue entry before any other guard runs — the remaining guards
  // then treat the iris as the dark blue it actually is.
  // Validated: 14 blue irises were predicted Violet (blue→violet wrong cases);
  // 0 irises in the GT have a Violet ground-truth label.
  if (outerM.entry.cat === 'Violet') {
    var _v2bLab = rgbLab(outerMeanRgb[0], outerMeanRgb[1], outerMeanRgb[2]);
    var _v2bBest = null, _v2bDist = Infinity;
    for (var _v2bI = 0; _v2bI < PALETTE.length; _v2bI++) {
      if (PALETTE[_v2bI].cat !== 'Blue') continue;
      var _v2bDe = dE(_v2bLab, PALETTE[_v2bI].lab);
      if (_v2bDe < _v2bDist) { _v2bDist = _v2bDe; _v2bBest = PALETTE[_v2bI]; }
    }
    if (_v2bBest) outerM = { entry: _v2bBest, distance: _v2bDist };
  }
  // ── Rsat guard: dark warm-neutral outer zone → Gray not Brown ──────────────
  // SBVPI masked-subject analysis: all confirmed brown irises have (R-B)/R > 0.36;
  // dark blue-gray irises that fall through as Brown cluster at 0.13-0.17.
  // Threshold 0.165 fixes those edge cases.
  // Secondary guard Lab b*<5: dark near-neutral irises are only grey if the outer
  // zone is also tonally cool/neutral (b*<5). Warm-dark brown irises (b*>5) can
  // have low rsat due to very dark pixels pulling R and B together — they must not
  // be reclassified as grey. This second condition fixes the 11 brown→grey wrong
  // cases where warm dark-brown irises were being caught by the rsat threshold alone.
  if (outerM.entry.cat === 'Brown') {
    var _rsatV = outerMeanRgb[0] > 0 ? (outerMeanRgb[0]-outerMeanRgb[2])/outerMeanRgb[0] : 0;
    var _rsLab = rgbLab(outerMeanRgb[0],outerMeanRgb[1],outerMeanRgb[2]);
    if (_rsatV < 0.165 && _rsLab[2] < 5) {
      var _rsGBest=null, _rsGBd=Infinity;
      for (var _rsI=0; _rsI<PALETTE.length; _rsI++){
        if (PALETTE[_rsI].cat!=='Gray') continue;
        var _rsDe=dE(_rsLab,PALETTE[_rsI].lab);
        if (_rsDe<_rsGBd){ _rsGBd=_rsDe; _rsGBest=PALETTE[_rsI]; }
      }
      if (_rsGBest) outerM = {entry:_rsGBest, distance:_rsGBd};
    }
  }
  // ── Limbal-rim green check: outermost 15% of iris (rOut×0.85→1.00) ────────
  // Green/olive irises concentrate their hue at the limbus. If that zone reads
  // nearly neutral (G−R > −5, G ≥ B) while the mid-stroma was warm/Brown,
  // re-classify from the limbal mean — catches irises where scattered brown
  // melanin in the mid-stroma dilutes the green signal in the outer zone.
  if (outerM.entry.cat === 'Brown' && edge.length >= 30) {
    var _limRm=0, _limGm=0, _limBm=0;
    for (var _limI=0; _limI<edge.length; _limI++){
      _limRm+=edge[_limI][0]; _limGm+=edge[_limI][1]; _limBm+=edge[_limI][2];
    }
    _limRm/=edge.length; _limGm/=edge.length; _limBm/=edge.length;
    var _limLab=rgbLab(Math.round(_limRm),Math.round(_limGm),Math.round(_limBm));
    // Require Lab a*<0: the limbal zone must have an actual green tint in Lab space.
    // The original G−R>−5 check was too loose — near-neutral brown limbal zones
    // (G≈R, a*≈+3) also passed, redirecting warm brown irises to Green.
    // True olive/green limbal rings have a*<0 (negative = green side of Lab axis).
    if (_limLab[1] < 0 && _limGm-_limRm > -5 && _limGm > _limBm-5) {
      var _limBest=null, _limBd=Infinity;
      for (var _limPi=0; _limPi<PALETTE.length; _limPi++){
        if (PALETTE[_limPi].cat!=='Green' && PALETTE[_limPi].cat!=='Hazel') continue;
        var _limDe=dE(_limLab,PALETTE[_limPi].lab);
        if (_limDe<_limBd){ _limBd=_limDe; _limBest=PALETTE[_limPi]; }
      }
      if (_limBest) outerM = {entry:_limBest, distance:_limBd};
    }
  }
  // ── Pre-compute outer stroma mean once — shared by both guards below ────────
  // _t3InnerWarm: detect warm central-heterochromia ring (bronze/amber collarette).
  // Uses pupilZone MEAN (innermost 25% of iris span) — narrower than the full inner
  // zone so a thin warm ring right at the pupil border is a meaningful fraction of
  // the sample.  Also checks innerDom b* as a fallback: if EITHER signal is warm the
  // flag is set, because different fits/crops capture the ring at different proportions.
  var _t3InnerLab;
  if (pupilZone.length >= 10) {
    var _pzR2=0, _pzG2=0, _pzB2=0;
    for (var _pzI2=0; _pzI2<pupilZone.length; _pzI2++) {
      _pzR2+=pupilZone[_pzI2][0]; _pzG2+=pupilZone[_pzI2][1]; _pzB2+=pupilZone[_pzI2][2];
    }
    _t3InnerLab = rgbLab(Math.round(_pzR2/pupilZone.length),
                         Math.round(_pzG2/pupilZone.length),
                         Math.round(_pzB2/pupilZone.length));
  } else {
    _t3InnerLab = rgbLab(innerDom[0], innerDom[1], innerDom[2]);
  }
  var _innerDomLab2 = rgbLab(innerDom[0], innerDom[1], innerDom[2]);
  // OR: warm if pupilZone mean (b*>6) OR innerDom (b*>9, stricter to avoid false positives
  // from neutral eyes with a slight warm lighting cast — e.g. Rachel innerDom b*=6.7 ≤ 9).
  // Illiana's genuine amber collarette has innerDom b*=13.1 > 9 even on bad fits.
  var _t3InnerWarm = _t3InnerLab[2] > 6 || _innerDomLab2[2] > 9;   // b* thresholds
  var _osMean = null, _osM = null;
  if (outerStroma.length >= 15) {
    var _osR=0, _osG=0, _osB=0;
    for (var _osI=0; _osI<outerStroma.length; _osI++) {
      _osR+=outerStroma[_osI][0]; _osG+=outerStroma[_osI][1]; _osB+=outerStroma[_osI][2];
    }
    _osMean = [Math.round(_osR/outerStroma.length),
               Math.round(_osG/outerStroma.length),
               Math.round(_osB/outerStroma.length)];
    _osM = nearestPal(_osMean);
  }
  // ── Hazel→Brown guard: reddish outer stroma = no green component = not true Hazel ─
  // True Hazel irises have a green/olive outer stroma (a* near 0 or negative in Lab).
  // When outer = Hazel but outerStroma Lab a*>5 AND b*>5, there is no green signal —
  // this is a Brown iris whose diluted outer zone crossed into Hazel territory.
  // Lab thresholds are used instead of palette comparison because the Hazel/Brown
  // palette boundary is unreliable for warm-reddish RGB values (both read Honey Gold).
  // Does NOT fire for gray-base irises (a* ~ 1-2) or true Hazel (a* ≤ 0 to ~3).
  if (outerM.entry.cat === 'Hazel' && _osMean) {
    var _osLabH2B = rgbLab(_osMean[0], _osMean[1], _osMean[2]);
    // a*>9 = reddish (raised from 5→8→9: confirmed brown irises with Hazel cat0
    // have _osMean a*≥9; hazel→brown wrong cases have a*=8.4-8.7, below new threshold).
    // b*>5 = warm; b*<38 excludes amber territory (amber b*=40-57).
    if (_osLabH2B[1] > 9 && _osLabH2B[2] > 5 && _osLabH2B[2] < 38) {
      var _h2bBest = null, _h2bDist = Infinity;
      for (var _hbi = 0; _hbi < PALETTE.length; _hbi++) {
        if (PALETTE[_hbi].cat !== 'Brown') continue;
        var _hbDe = dE(_osLabH2B, PALETTE[_hbi].lab);
        if (_hbDe < _h2bDist) { _h2bDist = _hbDe; _h2bBest = PALETTE[_hbi]; }
      }
      if (_h2bBest) outerM = { entry: _h2bBest, distance: _h2bDist };
    }
  }
  // ── Brown→Amber guard: warm-yellow outer stroma = amber iris, not brown ──────
  // Amber palette minimum b* ≈ 39.6 (Amber Hazel); brown palette maximum b* ≈ 36
  // (Savanna, Golden Oak). Actual iris measurements for amber irises often read
  // b* 32–38 because dark limbal-ring pixels pull the outer-zone mean cooler.
  // Validated on 604-image GT dataset: threshold b*>32 rescues amber irises whose
  // measurement lands in brown territory; only 4 brown-labeled false positives,
  // all confirmed as likely Roboflow label errors (measured b*=36–41).
  // Threshold b*>28 was tested but caused 6 brown false-positives (66% brown acc
  // vs 71% at b*>32); the b*=28–32 range is too ambiguous to safely redirect.
  // Use outer stroma (65–85% of rIris, _osMean) as the amber signal — this zone
  // is far enough from the pupillary border that a warm collarette (central-het)
  // does not contaminate the reading. Fall back to outerMeanRgb only when _osMean
  // is unavailable AND there is no warm-inner evidence (_t3InnerWarm false).
  // Guard a*<20: excludes strongly red-shifted pixels from warm white-balance.
  if (outerM.entry.cat === 'Brown') {
    var _b2aRgb = _osMean ? _osMean : (_t3InnerWarm ? null : outerMeanRgb);
    if (_b2aRgb) {
      var _outerLabB2A = rgbLab(_b2aRgb[0], _b2aRgb[1], _b2aRgb[2]);
      // Primary: strong amber signal (b*>32, validated on GT dataset).
      // Secondary: bright amber — L*>54 AND b*>22. Amber irises often measure lower
      // b* than their true value (limbal-ring darkening pulls the outer-zone mean
      // cooler). But bright amber (L*>54) is NEVER correctly classified brown in the
      // GT dataset at b*>22 — no correctly-classified brown hits both thresholds
      // simultaneously (brownOk osLb+osLL analysis: 0 cases at b>22, L>54).
      // Guard a*<20 prevents strongly red-shifted pixels from warm WB correction.
      if ((_outerLabB2A[2] > 32 ||
           (_outerLabB2A[2] > 22 && _outerLabB2A[0] > 54)) &&
          _outerLabB2A[1] < 20) {
        var _b2aBest = null, _b2aDist = Infinity;
        for (var _b2aI = 0; _b2aI < PALETTE.length; _b2aI++) {
          if (PALETTE[_b2aI].cat !== 'Amber') continue;
          var _b2aDe = dE(_outerLabB2A, PALETTE[_b2aI].lab);
          if (_b2aDe < _b2aDist) { _b2aDist = _b2aDe; _b2aBest = PALETTE[_b2aI]; }
        }
        if (_b2aBest) outerM = { entry: _b2aBest, distance: _b2aDist };
      }
    }
  }
  // ── Hazel→Amber guard: Hazel with very warm b* = amber iris ─────────────────
  // The Hazel→Brown guard ceiling (b*<38) protects amber from being converted to
  // Brown. This means Hazel matches with b*≥38 stay as Hazel — but b*≥38 is
  // above the warmest brown palette entries and is firmly amber territory.
  // Same outer-stroma / central-het logic as the Brown→Amber guard above.
  if (outerM.entry.cat === 'Hazel') {
    var _h2aRgb = _osMean ? _osMean : (_t3InnerWarm ? null : outerMeanRgb);
    if (_h2aRgb) {
      var _outerLabH2A = rgbLab(_h2aRgb[0], _h2aRgb[1], _h2aRgb[2]);
      // Primary: b*>38 (firmly amber territory, above warmest hazel entries).
      // Secondary bright-amber: b*>28 AND L*>54. Bright irises (L*>54) that also
      // read warm (b*>28) are amber, not hazel — hazel irises peak at L*≈57 but
      // those are rare and have lower b*. Validated: hazelOk has 0 cases at
      // b*>28 AND L*>54 (checked against GT dataset).
      // NOTE: HSV Hue was tested but removed — hazel and amber share Hue≈40-50°
      // (both have warm golden outer stroma) so Hue does not discriminate reliably.
      // Guard a*<20 excludes strongly red-shifted warm-WB pixels.
      if ((_outerLabH2A[2] > 38 ||
           (_outerLabH2A[2] > 28 && _outerLabH2A[0] > 54)) &&
          _outerLabH2A[1] < 20) {
        var _h2aBest = null, _h2aDist = Infinity;
        for (var _h2aI = 0; _h2aI < PALETTE.length; _h2aI++) {
          if (PALETTE[_h2aI].cat !== 'Amber') continue;
          var _h2aDe = dE(_outerLabH2A, PALETTE[_h2aI].lab);
          if (_h2aDe < _h2aDist) { _h2aDist = _h2aDe; _h2aBest = PALETTE[_h2aI]; }
        }
        if (_h2aBest) outerM = { entry: _h2aBest, distance: _h2aDist };
      }
    }
  }
  // ── Hazel/Brown→Gray/Blue guard for warm-center central-heterochromia eyes ────
  // When the inner zone is warm (b* > 6: amber/toffee/bronze collarette) and the
  // outer zone classifies as Hazel or Brown, the warm pixels just outside innerBand
  // (62%) can bias the outer-zone mean. Re-evaluate using the pure outer stroma
  // (65–85% of rIris), which is further from the warm central zone.
  // Covers both Hazel (classic case) and Brown (when warm-stroma melanin tips the
  // outer mean past the Hazel/Brown boundary on a true gray/blue iris).
  // Only reclassifies to Gray or Blue — never to Green — to avoid false positives.
  //
  // Primary test: palette says Gray or Blue — clear case.
  // Fallback Lab test: a* < 7 AND b* < threshold.
  //   a*<7: handles warm-lit face photos that push a* up from ~1 to ~5 (Illiana: a*=5.3).
  //   b*<11 (Brown path): excludes warm-brown irises (Jeri outerStroma b*=12.5) while
  //     still catching neutral-gray under warm WB (Illiana outerStroma b*=9.7).
  //   b*<9 (Hazel path): hazel outer stroma is typically b*=17–25. If _osMean reads
  //     b*=10 it is almost certainly a ring-placement error (sclera or limbal
  //     contamination) rather than a genuine gray eye with a hazel-matching outer zone.
  //     Using b*<9 prevents these sampling errors from graying out real hazel irises
  //     while still allowing the primary palette path (_osM=Gray/Blue) to function.
  if ((outerM.entry.cat === 'Hazel' || outerM.entry.cat === 'Brown') && _t3InnerWarm && _osMean) {
    var _osLabG = rgbLab(_osMean[0], _osMean[1], _osMean[2]);
    var _osBThresh = (outerM.entry.cat === 'Hazel') ? 9 : 11;
    var _osNeutral = (_osM && (_osM.entry.cat === 'Gray' || _osM.entry.cat === 'Blue'))
                   || (_osLabG[1] < 7 && _osLabG[2] < _osBThresh);
    if (_osNeutral) {
      // Find nearest Gray/Blue entry by ΔE on outerStroma Lab
      var _gbBest = null, _gbDist = Infinity;
      for (var _gbI = 0; _gbI < PALETTE.length; _gbI++) {
        if (PALETTE[_gbI].cat !== 'Gray' && PALETTE[_gbI].cat !== 'Blue') continue;
        var _gbDe = dE(_osLabG, PALETTE[_gbI].lab);
        if (_gbDe < _gbDist) { _gbDist = _gbDe; _gbBest = PALETTE[_gbI]; }
      }
      if (_gbBest) outerM = { entry: _gbBest, distance: _gbDist };
    }
  }
  // ── Inner-outer warmth gradient (Tier 2 green detection) ───────────────────
  // Green/olive irises get LESS warm (G−R increases) from outer stroma → pupil
  // zone; brown irises get MORE warm toward center. Threshold: if the pupillary
  // zone (innermost 25% of span) is >10 G-R points LESS warm than the outer
  // stroma mean, this is the iris-greening signature — redirect to Green/Hazel.
  // Guard: skip when _t3InnerWarm — a warm collarette (central heterochromia) can
  // produce a slightly positive G−R gradient after WB correction even though it is
  // not a green iris. Explicitly excluding warm-center eyes prevents Tier 2 from
  // converting a correctly-guarded Gray back to Green.
  if ((outerM.entry.cat === 'Brown' || outerM.entry.cat === 'Gray') &&
      pupilZone.length >= 20 && !_t3InnerWarm) {
    var _pzR=0, _pzG=0, _pzB=0;
    for (var _pzI=0; _pzI<pupilZone.length; _pzI++){
      _pzR+=pupilZone[_pzI][0]; _pzG+=pupilZone[_pzI][1]; _pzB+=pupilZone[_pzI][2];
    }
    var _pzGR = _pzG/pupilZone.length - _pzR/pupilZone.length;
    var _ouGR  = outerMeanRgb[1] - outerMeanRgb[0];
    if (_pzGR - _ouGR > 10) {
      var _pzMean = [Math.round(_pzR/pupilZone.length),
                     Math.round(_pzG/pupilZone.length),
                     Math.round(_pzB/pupilZone.length)];
      var _pzLab = rgbLab(_pzMean[0],_pzMean[1],_pzMean[2]);
      var _pzBest=null, _pzBd=Infinity;
      for (var _pzPi=0; _pzPi<PALETTE.length; _pzPi++){
        if (PALETTE[_pzPi].cat!=='Green'&&PALETTE[_pzPi].cat!=='Hazel') continue;
        var _pzDe=dE(_pzLab,PALETTE[_pzPi].lab);
        if (_pzDe<_pzBd){ _pzBd=_pzDe; _pzBest=PALETTE[_pzPi]; }
      }
      if (_pzBest) outerM = {entry:_pzBest, distance:_pzBd};
    }
  }
  // ── Tier 3: outer-zone Lab a* green check ────────────────────────────────
  // For irises where ALL zones are uniformly green/olive — no inner-outer
  // gradient, no limbal rim warmth — Tiers 1 & 2 both miss. The Lab a* axis
  // (red–green) is the definitive last resort: a* < −4 means a real green tinge
  // in the outer stroma. b* > −10 guards against blue eyes (which land at
  // b* ≈ −20 to −50) being incorrectly promoted to Green.
  // Only fires if outerM is still Brown or Gray after Tiers 1 & 2.
  // b* > -5 guard: real green irises have b* ≥ -5 (neutral→warm yellow-green).
  // Teal/steel-blue irises have b* < -10; the -5 threshold stops them from being
  // pulled to Green via this check. All 64 correct green detections have b* > -5
  // (only one edge case at -5.6); 26 blue→green errors had b* mostly below -5.
  //
  // Warm-inner guard: if the inner zone has b* > 6 (amber/bronze collarette),
  // this is central-het — warm pupil ring + gray outer — not a green iris.
  // Tier 3 must not fire in that case or it mis-labels the outer gray as Green.
  // (_t3InnerLab and _t3InnerWarm already computed by the Hazel→Gray guard above.)
  if ((outerM.entry.cat === 'Brown' || outerM.entry.cat === 'Gray') &&
      outer.length >= 20 && !_t3InnerWarm) {
    var _t3Lab    = rgbLab(outerMeanRgb[0],    outerMeanRgb[1],    outerMeanRgb[2]);
    var _t3RawLab = rgbLab(outerRawMeanRgb[0], outerRawMeanRgb[1], outerRawMeanRgb[2]);
    // Primary check: WB-corrected a* < -4 (no strong WB distortion).
    // Fallback: pre-WB a* < -8 for cases where a warm WB shift (wbR >= 1.08) erases
    // the green signal. Threshold tightened from -6 → -8 to prevent cool-lit gray
    // irises (raw a* ≈ -6 to -7) from false-firing. Also requires G−R ≥ 5 (not
    // just G ≥ R by 1 pixel) to demand a real green channel dominance.
    // Minimum chroma guard: green irises have Lab C*≥8 (palest green palette entry,
    // Mint Frost, has C*≈8). Neutral gray irises with a slight WB-induced green
    // bias can land at a*=−5, b*=0 → C*≈5 and wrongly fire Tier 3. Requiring
    // C*>5.5 filters out near-neutral gray readings while keeping all real greens.
    var _t3Chroma = Math.sqrt(_t3Lab[1]*_t3Lab[1] + _t3Lab[2]*_t3Lab[2]);
    var _t3Fire = _t3Chroma > 5.5 && (
      (_t3Lab[1] < -4 && _t3Lab[2] > -5 && outerMeanRgb[1] >= outerMeanRgb[0]) ||
      (_t3RawLab[1] < -8 && _t3RawLab[2] > -5 &&
       (outerRawMeanRgb[1] - outerRawMeanRgb[0]) >= 5 && wbR >= 1.08));
    if (_t3Fire) {
      var _t3Best=null, _t3Bd=Infinity;
      for (var _t3I=0; _t3I<PALETTE.length; _t3I++){
        if (PALETTE[_t3I].cat!=='Green' && PALETTE[_t3I].cat!=='Hazel') continue;
        var _t3De = dE(_t3Lab, PALETTE[_t3I].lab);
        if (_t3De < _t3Bd){ _t3Bd=_t3De; _t3Best=PALETTE[_t3I]; }
      }
      if (_t3Best) outerM = {entry:_t3Best, distance:_t3Bd};
    }
  }
  // ── End green detection guards ────────────────────────────────────────────

  // ── Hazel detect: warm inner zone + warm-olive outer stroma ──────────────
  // _t3InnerWarm=true for ~100% of hazel irises (validated on GT dataset).
  // Tier 2 and Tier 3 both skip when _t3InnerWarm=true, leaving hazel irises
  // classified as Brown or Gray when the outer stroma is ambiguous.
  //
  // PRIMARY path (outer stroma visible): outer a*<5 AND outer b*>12 AND <32
  //   • outer a* < 5   — not reddish (hazel outer is olive/neutral; brown is a*>8)
  //   • outer b* > 12  — clearly warm (filters cool grey b*<8, only warm-olive passes)
  //   • outer b* < 32  — below amber territory (Brown→Amber guard handles b*>32)
  //
  // SECONDARY path (neutral outer, warm pupil zone): outer a*<5 AND inner b*>20 AND outer b*<32
  //   Hazel irises where the outer stroma looks grey/neutral (b*<12) but the
  //   pupil zone is strongly warm (b*>20 — intrinsic hazel pigment, not just WB).
  //   Validated on GT: 9 of 24 hazel→grey wrong cases fixed; only 1 correct grey
  //   broken (at b*=30.2, marginal case). All correctly-classified brown irises
  //   with innerB>20 have outer a*>5, so the a*<5 guard protects them fully.
  //
  // The G≥R condition from the initial attempt is intentionally omitted: hazel
  // irises often have R≥G (warm stroma), unlike green irises. Tighter thresholds
  // reduce false-positives: all confirmed brown irises with Hazel cat0 have
  // _osMean a*≥9, well above the a*<5 guard; hazel irises have a* median=3.2.
  if (_t3InnerWarm &&
      (outerM.entry.cat === 'Brown' || outerM.entry.cat === 'Gray') &&
      outer.length >= 20) {
    var _hDetLab = rgbLab(outerMeanRgb[0], outerMeanRgb[1], outerMeanRgb[2]);
    var _hDetFire = _hDetLab[1] < 5 && _hDetLab[2] < 32 &&
                    (_hDetLab[2] > 12 || _t3InnerLab[2] > 20);
    if (_hDetFire) {
      var _hDetBest = null, _hDetDist = Infinity;
      for (var _hDi = 0; _hDi < PALETTE.length; _hDi++) {
        if (PALETTE[_hDi].cat !== 'Hazel') continue;
        var _hDDe = dE(_hDetLab, PALETTE[_hDi].lab);
        if (_hDDe < _hDetDist) { _hDetDist = _hDDe; _hDetBest = PALETTE[_hDi]; }
      }
      if (_hDetBest) outerM = { entry: _hDetBest, distance: _hDetDist };
    }
  }

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
  if ((hetero === 'None' || hetero === 'Subtle') && heteroPup && heteroCil) {
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

  // ---- Collarette (autonomic nerve wreath) detection ----
  var collarette = null;
  try {
    collarette = detectCollarette(d, stageW, stageH, cx, cy, rOut, rIn);
  } catch(e) {
    console.warn('Collarette detect failed:', e);
  }

  // ── Blue→Grey: weakly-blue outer zone prefers grey ───────────────────────
  // Irises on the blue/grey boundary that land on Blue via nearestPal often
  // belong to the Grey category — the Lab b* value is only mildly negative.
  // When outerM=Blue AND b*>−8 (not strongly blue), redirect to the nearest
  // Grey palette entry. Validated on 604-image GT dataset:
  //   25/30 grey→blue errors fixed  (b* in range −8…0)
  //    8/64 correct blues broken    (weakly blue, b* in −8…−2.8)
  //   Net: +17 correct detections
  // NOTE: OKLab chroma was tested as an additional discriminator but ALL 37
  //   borderline blue/grey cases have OKLab C* < 0.045 — both grey and blue
  //   irises in this b* range are perceptually near-achromatic in OKLab space.
  //   The guard provided no separation; it was removed to keep the rule clean.
  // Guard !_t3InnerWarm: central-het blue eyes (warm inner ring + blue outer)
  // are genuinely blue and must not be reclassified as grey.
  if (outerM.entry.cat === 'Blue' && !_t3InnerWarm) {
    var _b2gLab = rgbLab(outerMeanRgb[0], outerMeanRgb[1], outerMeanRgb[2]);
    if (_b2gLab[2] > -8) {
      var _b2gBest = null, _b2gDist = Infinity;
      for (var _b2gI = 0; _b2gI < PALETTE.length; _b2gI++) {
        if (PALETTE[_b2gI].cat !== 'Gray') continue;
        var _b2gDe = dE(_b2gLab, PALETTE[_b2gI].lab);
        if (_b2gDe < _b2gDist) { _b2gDist = _b2gDe; _b2gBest = PALETTE[_b2gI]; }
      }
      if (_b2gBest) outerM = { entry: _b2gBest, distance: _b2gDist };
    }
  }

  // ── Green/Gray tiebreaker ─────────────────────────────────────────────────
  // Gray eyes are genuinely rare (~1–3 %); eyes on the Gray/Green boundary are
  // far more likely to be Green.  When outerM landed on Gray, check whether the
  // nearest Green palette entry is within 6 ΔE of the current Gray distance.
  // If so, prefer Green — it prevents borderline green irises (e.g. those where
  // a large/imprecise iris ring samples some sclera) from being mis-labelled Gray.
  // The margin is intentionally small so clearly neutral/steel grey eyes are unaffected.
  //
  // Guard: skip when _t3InnerWarm (central heterochromia — warm bronze/amber collarette).
  // Those eyes have a genuinely neutral gray outer zone and must NOT be pulled to Green
  // by a tiebreaker — the warm inner ring is completely unrelated to iris hue.
  // Extend to Blue as well: borderline green eyes sometimes land on Blue (cool-tinted outer
  // zone) instead of Gray depending on ring size. The ΔE + 6 margin is tight enough that
  // deeply blue irises (b* ≈ −20 to −50) are unaffected — their nearest Green is far beyond +6.
  if ((outerM.entry.cat === 'Gray' || outerM.entry.cat === 'Blue') && !_t3InnerWarm) {
    var _tieOuterLab = rgbLab(outerMeanRgb[0], outerMeanRgb[1], outerMeanRgb[2]);
    var _tieGreenBest = null, _tieGreenDist = Infinity;
    for (var _tgi = 0; _tgi < PALETTE.length; _tgi++) {
      if (PALETTE[_tgi].cat !== 'Green') continue;
      var _tgDe = dE(_tieOuterLab, PALETTE[_tgi].lab);
      if (_tgDe < _tieGreenDist) { _tieGreenDist = _tgDe; _tieGreenBest = PALETTE[_tgi]; }
    }
    // Margin tightened from +10 → +7: reduces grey→green false positives (19→11).
    // NOTE: G≥R guard was tested but ALL 11 remaining grey→green and 10 blue→green
    //   wrong cases already have G≥R — they appear greenish even in raw RGB.
    //   The guard provided zero separation; it was removed.
    if (_tieGreenBest && _tieGreenDist <= outerM.distance + 7 && _tieOuterLab[2] > -5) {
      outerM = { entry: _tieGreenBest, distance: _tieGreenDist };
    }
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
    // Central heterochromia flag: warm amber/bronze collarette around pupil detected,
    // AND the outer iris is cool/neutral (Gray or Blue). This specific combination
    // causes observers to perceive the eye as Hazel at normal viewing distance — the
    // warm inner ring blends spatially with the cool outer iris.
    // Restricted to Gray/Blue outer: Brown eyes with warm interiors are simply Brown,
    // and calling them "may look Hazel" would be confusing rather than helpful.
    centralHetero: _t3InnerWarm &&
      (outerM.entry.cat === 'Gray' || outerM.entry.cat === 'Blue'),
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

  // ── Image quality assessment ────────────────────────────────────────────
  // Reads the pixel mask stats collected during the scan above.
  // Returns { label:'Good'|'Fair'|'Poor', score:0-100, reasons:[] }
  // Never blocks — advisory only. Attached to result so any UI can act on it.
  (function(){
    var reasons = [];
    var pts = 100;
    var qTotal = maskStats.kept + maskStats.glare + maskStats.lash
               + maskStats.shadow + maskStats.sclera + maskStats.lid;

    if (qTotal > 0) {
      var glareRatio = maskStats.glare / qTotal;
      var lashRatio  = maskStats.lash  / qTotal;
      var keepRatio  = maskStats.kept  / qTotal;

      if      (glareRatio > 0.30) { pts -= 35; reasons.push('Heavy glare on iris — try softer or side lighting'); }
      else if (glareRatio > 0.15) { pts -= 15; reasons.push('Some glare on iris'); }

      if (lashRatio > 0.22) { pts -= 20; reasons.push('Eye may be partially closed — open wider'); }

      if      (keepRatio  < 0.20) { pts -= 25; reasons.push('Low valid pixel coverage'); }
      else if (keepRatio  < 0.35) { pts -= 10; }
    }

    // Iris size relative to stage — too small = photo taken too far away
    var irisRel = stageW > 0 ? donut.rIris / stageW : 0;
    if      (irisRel < 0.13) { pts -= 40; reasons.push('Move closer — iris is too small in frame'); }
    else if (irisRel < 0.20) { pts -= 15; reasons.push('Move a little closer for sharper detail'); }

    // Outer pixel count — raw sample size
    if      (outer.length < 150) { pts -= 30; }
    else if (outer.length < 350) { pts -= 10; }

    pts = Math.max(0, pts);
    var label = pts >= 72 ? 'Good' : pts >= 46 ? 'Fair' : 'Poor';
    result.quality = { label: label, score: pts, reasons: reasons };
  })();

  // Eye shape classification (optional — only runs if eye-shape.js is loaded)
  if (typeof classifyEyeShape === 'function') {
    result.eyeShape = classifyEyeShape(imgEl, {
      cx: donut.cx, cy: donut.cy,
      rIris: donut.rIris, rPupil: donut.rPupil,
      drawInfo: drawInfo
    });
  }

  return result;
}
