'use strict';

function analyze(){
  var off = document.createElement('canvas');
  off.width = stageW; off.height = stageH;
  var octx = off.getContext('2d');
  octx.fillStyle = '#000'; octx.fillRect(0, 0, stageW, stageH);
  octx.drawImage(imgEl, drawInfo.dx, drawInfo.dy, drawInfo.dw, drawInfo.dh);
  var d = octx.getImageData(0, 0, stageW, stageH).data;
  var cx = donut.cx, cy = donut.cy, rIn = donut.rPupil, rOut = donut.rIris;
  var cxP = donut.cxPupil != null ? donut.cxPupil : cx;
  var cyP = donut.cyPupil != null ? donut.cyPupil : cy;
  var innerBand = rIn + (rOut - rIn) * 0.45;
  // Tighter zones for central-heterochromia gradient detection. The pupillary
  // zone (innermost 25% of the iris-pupil annulus) and ciliary zone (outermost
  // 50%) compare against each other for warmth/lightness gradients — catches
  // "Bryan-style" central het that doesn't cross palette categories but has
  // an obvious brown/amber inner ring within a blue/gray iris (Δb > 4 in Lab).
  var pupilZoneCut  = rIn + (rOut - rIn) * 0.25;
  var ciliaryZoneCut = rIn + (rOut - rIn) * 0.50;
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
      // Deep shadow
      if (lum < 18) { maskStats.shadow++; continue; }
      // Eyelash: dark + desaturated (keeps dark brown iris because it's warm)
      if (lum < 45 && satP < 0.15) { maskStats.lash++; continue; }
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
    showError('Not enough iris pixels. Try enlarging the iris ring or reducing the pupil circle.');
    return;
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

  // Build result
  // Read optional birthdate for age-adjusted scoring
  var birthdateEl = document.getElementById('birthdate-input');
  var userAge = 0;
  if (birthdateEl && birthdateEl.value) {
    var bd = new Date(birthdateEl.value);
    var now = new Date();
    userAge = Math.floor((now - bd) / (1000 * 60 * 60 * 24 * 365.25));
  }
  var result = {
    side: currentSide || 'Right',
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
    rayid: rayid           // {label, streamScore, jewelScore, flowerScore} or null
  };
  // Compute composite rarity score now that all fields are in result
  result.rarityScore = computeRarityScore(result);
  eyeResults[result.side] = result;

  // Render card
  renderResult(result);
  window.__lastResult = result;
  uploadToSupabase(result);
}

function renderResult(result){
  var resCard = $('card-result');
  resCard.style.display = 'block';
  $('r-side').textContent = result.side + ' Eye';
  $('r-color').textContent = result.overall.name;
  // ── Opening line: colour + intensity ──────────────────────────────────────
  var cat  = result.overall.cat;   // e.g. 'Blue', 'Green', 'Brown', 'Hazel'
  var name = result.overall.name;  // e.g. 'Sky Blue', 'Emerald', 'Warm Amber'
  var bri  = result.brightness;    // 'Dark' | 'Medium' | 'Bright'
  var sat  = result.saturation;    // 'Muted' | 'Soft' | 'Vivid'
  var side = result.side.toLowerCase();

  // Category-specific opening
  var catOpeners = {
    'Blue':  [
      'Your ' + side + ' eye is a stunning ' + name + ' — a cool, luminous shade that arrests attention the moment people look your way.',
      'A crystalline ' + name + ' fills your ' + side + ' iris — the kind of blue that photographs like gemstone light.',
      'Your ' + side + ' eye blazes with ' + name + ' — pure, striking, and impossible to ignore.'
    ],
    'Green': [
      'Your ' + side + ' eye is a rare, jewel-toned ' + name + ' — fewer than 2% of people share this captivating shade.',
      'A rich ' + name + ' illuminates your ' + side + ' iris — bold, vivid, and genuinely rare.',
      'Your ' + side + ' eye burns with the kind of ' + name + ' that makes people look twice.'
    ],
    'Brown': [
      'Your ' + side + ' eye is a warm, soulful ' + name + ' — deep, rich, and full of dimension.',
      'A luminous ' + name + ' fills your ' + side + ' iris — earthy depth wrapped in golden warmth.',
      'Your ' + side + ' eye radiates ' + name + ' — bold and warm, with a depth that draws people in.'
    ],
    'Hazel': [
      'Your ' + side + ' eye shifts with ' + name + ' — a captivating blend that changes with the light, never quite the same color twice.',
      'A chameleon ' + name + ' dances through your ' + side + ' iris — warm one moment, cool the next.',
      'Your ' + side + ' eye reads as ' + name + ' — a rare, multi-tonal beauty that defies a single description.'
    ],
    'Gray':  [
      'Your ' + side + ' eye is a striking ' + name + ' — cool, magnetic, and quietly intense.',
      'A rare ' + name + ' fills your ' + side + ' iris — silver-cool and effortlessly captivating.',
      'Your ' + side + ' eye carries a beautiful ' + name + ' — the rarest eye category in the world.'
    ]
  };
  var openers = catOpeners[cat] || [
    'Your ' + side + ' eye is a beautiful ' + name + ' — a distinctive, eye-catching shade.'
  ];
  var n = openers[Math.floor(Math.random() * openers.length)] + ' ';

  // Intensity modifier
  if (sat === 'Vivid' && bri === 'Bright') {
    n += 'The color is intensely saturated and luminous — these are eyes that hold a room. ';
  } else if (sat === 'Vivid') {
    n += 'The color is boldly saturated with real depth and richness. ';
  } else if (sat === 'Soft' && bri === 'Bright') {
    n += 'The soft, bright tone gives the iris a dreamy, almost backlit quality. ';
  } else if (bri === 'Dark' && sat === 'Muted') {
    n += 'The deep, subdued tones carry a quiet, smouldering intensity. ';
  }

  // ── Heterochromia ─────────────────────────────────────────────────────────
  if (result.hetero !== 'None') {
    var pupName = result.heteroPup ? (result.heteroPup.displayName || result.heteroPup.color.name).toLowerCase() : 'warm';
    var cilName = result.heteroCil ? (result.heteroCil.displayName || result.heteroCil.color.name).toLowerCase() : 'cooler';
    if (result.hetero.indexOf('warmth') >= 0) {
      n += 'A warm ' + pupName + ' corona glows around your pupil — sometimes called "sunflower eyes" — radiating outward into the ' + cilName + ' outer iris. Only about 10–15% of people have this stunning inner ring. ';
    } else if (result.hetero.indexOf('lightness') >= 0) {
      n += 'A luminous ' + pupName + ' inner ring circles the pupil and radiates outward into the ' + cilName + ' iris — a gorgeous two-tone depth effect. ';
    } else if (result.hetero === 'Central') {
      n += 'Your iris holds two distinct colors: a bold ' + result.inner.name.toLowerCase() + ' inner ring melting into a ' + result.outer.name.toLowerCase() + ' outer iris — true central heterochromia, and genuinely rare. ';
    } else {
      n += 'Central heterochromia layers a ' + result.inner.name.toLowerCase() + ' inner ring against a ' + result.outer.name.toLowerCase() + ' outer iris — a captivating two-toned effect. ';
    }
  }

  // ── Limbal ring ───────────────────────────────────────────────────────────
  if (result.limbal !== 'None' && result.limbalColor) {
    var ftype = result.limbalType || 'ring';
    var lc = result.limbalColor.name.toLowerCase();
    if (ftype === 'halo') {
      n += 'A brilliant ' + lc + ' halo glows just inside the iris edge — a luminous inner border that makes the color feel lit from within. ';
    } else if (result.limbal === 'Dramatic') {
      n += 'A Dramatic ' + lc + ' limbal ring frames the entire iris like natural eyeliner — bold, magnetic, and the feature that makes eyes look deep, intense, and unforgettable. ';
    } else if (result.limbal === 'Strong') {
      n += 'A strong ' + lc + ' limbal ring circles the iris, creating crisp, high-contrast definition. This is the feature that makes eyes pop across a room — striking, beautiful, and arresting. ';
    } else {
      n += 'A ' + result.limbal.toLowerCase() + ' ' + lc + ' limbal ring adds definition and polish at the iris edge. ';
    }
  }

  // ── Sectoral heterochromia ────────────────────────────────────────────────
  if (result.sectoral) {
    n += 'A bold splash of ' + result.sectoral.color.name.toLowerCase() + ' at ' + result.sectoral.clock + " o'clock gives this iris a completely unique signature — like a one-of-a-kind fingerprint. No two people share the same sectoral marking. ";
  }

  // ── Iris freckles ─────────────────────────────────────────────────────────
  if (result.freckles && result.freckles.length) {
    var nf = result.freckles.length;
    if (nf === 1) {
      n += 'A single iris freckle near ' + result.freckles[0].clock + " o'clock adds a distinctive personal mark — a tiny detail that makes this eye truly yours. ";
    } else {
      n += nf + ' iris freckles dot the surface — small concentrations of melanin that add character and are completely unique to you. ';
    }
  }

  // ── Closing punch line (only when features warrant it) ───────────────────
  var hasStrong = (result.limbal === 'Dramatic' || result.limbal === 'Strong');
  var hasHetero = (result.hetero !== 'None');
  var hasSectoral = !!result.sectoral;
  if (hasStrong && hasHetero) {
    n += 'Together, the ' + name.toLowerCase() + ' color, inner ring, and strong limbal border create eyes that are genuinely hard to look away from. ';
  } else if (hasStrong && (sat === 'Vivid' || bri === 'Bright')) {
    n += 'The combination of bold color and that defined limbal ring makes these eyes truly stand out — bright, beautiful, and captivating. ';
  } else if (hasSectoral || (hasHetero && hasStrong)) {
    n += 'This is a rare combination. These are eyes that leave a lasting impression. ';
  }
  $('r-narrative').textContent = n;
  var sr = $('r-swatches'); sr.innerHTML = '';
  result.topColors.forEach(function(rgb){
    var sw = document.createElement('div'); sw.className = 'swatch';
    sw.style.background = 'rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ')';
    sr.appendChild(sw);
  });
  $('r-general').textContent = result.overall.cat;
  $('r-specific').textContent = result.overall.name;
  // Limbal ring shows "Strength · Color" when distinct, just "None" otherwise
  $('r-limbal').textContent = result.limbalColor
    ? (result.limbal + ' · ' + result.limbalColor.name + ' ' + (result.limbalType || 'ring'))
    : result.limbal;
  // Heterochromia cell — name the inner ring color when we have a gradient
  if (result.hetero === 'Central (warmth gradient)' || result.hetero === 'Central (lightness gradient)') {
    var ringDescriptor = result.heteroPup
      ? (result.heteroPup.displayName || result.heteroPup.color.name) + ' pupillary ring'
      : (result.hetero.indexOf('warmth') >= 0 ? 'warm pupillary ring' : 'light pupillary ring');
    $('r-hetero').textContent = 'Central · ' + ringDescriptor;
  } else if (result.hetero === 'Central' && result.heteroPup && result.heteroCil) {
    $('r-hetero').textContent = 'Central · ' + (result.heteroPup.displayName || result.heteroPup.color.name) + ' / ' + (result.heteroCil.displayName || result.heteroCil.color.name);
  } else {
    $('r-hetero').textContent = result.hetero;
  }
  // Render Highlights + Story
  renderHighlights(result);
  renderStory(result);
  $('r-sectoral').textContent = result.sectoral
    ? (result.sectoral.color.name + " · " + result.sectoral.clock + " o'clock")
    : 'None';
  $('r-freckles').textContent = (result.freckles && result.freckles.length)
    ? (result.freckles.length + (result.freckles.length === 1 ? ' freckle' : ' freckles'))
    : 'None';
  $('r-brightness').textContent = result.brightness;
  $('r-saturation').textContent = result.saturation;
  if (result.rayid && RAYID_META[result.rayid.label]) {
    var rm = RAYID_META[result.rayid.label];
    var rv = $('r-rayid');
    if (rv) {
      rv.textContent = result.rayid.label + ' · ' + rm.short;
      rv.style.color = rm.color;
    }
  }

  // If both eyes have been analyzed, show the two-eye summary
  var hasBoth = eyeResults['Left'] && eyeResults['Right'];
  $('twoeye-summary').style.display = hasBoth ? 'grid' : 'none';
  if (hasBoth){
    var L = eyeResults['Left'], R = eyeResults['Right'];
    $('left-name').textContent  = L.overall.name;
    $('left-meta').textContent  = L.overall.cat + ' · Limbal: ' + L.limbal + ' · Het: ' + L.hetero;
    $('right-name').textContent = R.overall.name;
    $('right-meta').textContent = R.overall.cat + ' · Limbal: ' + R.limbal + ' · Het: ' + R.hetero;
    // ===== Bilateral heterochromia (L vs R) =====
    // Compares the two eyes' overall palette anchors. Categories are the
    // strongest signal: David Bowie / Kiefer Sutherland-style "different
    // color eyes" cross category lines (blue vs brown). Same-category but
    // large ΔE flags subtle bilateral hetero (e.g. light vs dark hazel).
    // Using palette anchors (not raw RGB) keeps this stable across lighting.
    var biDe = dE(L.overall.lab, R.overall.lab);
    var sameCat = L.overall.cat === R.overall.cat;
    var verdict, detail, cls;
    if (!sameCat){
      verdict = 'Complete bilateral heterochromia';
      detail  = L.overall.cat + ' (left) vs ' + R.overall.cat + ' (right) — ΔE ' + biDe.toFixed(1)
              + ' between palette anchors. About 1 in 200,000 people have eyes this distinct.';
      cls = 'bilateral';
    } else if (biDe > 18){
      verdict = 'Subtle bilateral heterochromia';
      detail  = 'Both eyes are ' + L.overall.cat.toLowerCase() + ', but they differ by ΔE ' + biDe.toFixed(1)
              + ' (' + L.overall.name + ' vs ' + R.overall.name + ').';
      cls = 'bilateral';
    } else {
      verdict = 'Matched eyes';
      detail  = 'Left and right eyes read as the same color (ΔE ' + biDe.toFixed(1) + ' between palette anchors).';
      cls = 'bilateral match';
    }
    $('bilateral-verdict').textContent = verdict;
    $('bilateral-detail').textContent  = detail;
    $('bilateral-row').className = cls;
  }
  // Hide "Other Eye" button if both done
  $('btn-other-eye').style.display = hasBoth ? 'none' : '';
  // Update Beauty Shot button label based on whether one is already attached
  var btnPortrait = $('btn-portrait');
  if (btnPortrait) {
    btnPortrait.textContent = result.portraitImage
      ? 'Replace Beauty Shot ✓'
      : 'Add Beauty Shot';
  }
  if (hasBoth) {
    $('next-text').textContent = 'Both eyes analyzed. Pop over to Post Maker for the cover-and-uncover reveal, or start over.';
  } else {
    var other = (result.side === 'Left') ? 'Right' : 'Left';
    $('btn-other-eye').textContent = 'Analyze ' + other + ' Eye';
    $('next-text').textContent = 'One eye down. Analyze the ' + other.toLowerCase() + ' eye for a complete pair, make a share card, or start over.';
  }
  setTimeout(function(){ $('card-result').scrollIntoView({behavior:'smooth', block:'start'}); }, 60);
}

// ======================= HIGHLIGHTS + STORY VIEW =======================
function rgbCss(rgb){ return 'rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ')'; }

function renderHighlights(result){
  var box = $('r-highlights');
  box.innerHTML = '';
  var items = [];
  // ===== Always-on highlights (color profile) =====
  // Rarity callout
  if (result.rarity) {
    var rarityTitle = result.rarityScore !== undefined
      ? (rarityScoreLabel(result.rarityScore) + ' · ' + result.rarityScore + '/100')
      : (result.rarity.label + ' · ' + result.rarity.pct + '% of people');
    items.push({
      title: rarityTitle,
      desc: result.rarity.line,
      swatch: { type: 'solid', c1: rgbCss(result.overall.rgb) },
    });
  }
  // Vibe descriptor
  if (result.vibe) {
    items.push({
      title: '"' + result.vibe + '"',
      desc: "A descriptive nickname capturing your eye's overall character — based on category and lightness.",
      swatch: { type: 'solid', c1: rgbCss(result.overall.rgb) },
    });
  }
  // Pattern hint
  var patternHint = getPatternHint(result.brightness, result.saturation);
  if (patternHint) {
    items.push({
      title: 'Iris character',
      desc: patternHint + ' · brightness=' + result.brightness + ' · saturation=' + result.saturation,
      swatch: { type: 'solid', c1: rgbCss(result.fingerprint ? result.fingerprint.rgb : result.overall.rgb) },
    });
  }
  // ===== Heterochromia (any kind) =====
  if (result.hetero !== 'None') {
    var pupName, cilName, pupRgb, cilRgb, label, descParts = [];
    if (result.heteroPup && result.heteroCil) {
      pupName = result.heteroPup.displayName || result.heteroPup.color.name;
      cilName = result.heteroCil.displayName || result.heteroCil.color.name;
      pupRgb = result.heteroPup.rgb; cilRgb = result.heteroCil.rgb;
    } else {
      pupRgb = result.outer.rgb || [128,128,128];
      cilRgb = result.outer.rgb || [128,128,128];
    }
    if (result.hetero.indexOf('warmth') >= 0) {
      label = 'Central heterochromia';
      descParts.push((pupName||'Warmer') + ' pupillary ring within ' + (cilName||'cooler') + ' outer iris');
      descParts.push('Δb=' + result.heteroDb.toFixed(1) + ' (warmth)');
    } else if (result.hetero.indexOf('lightness') >= 0) {
      label = 'Central heterochromia';
      descParts.push((pupName||'Lighter') + ' pupillary ring within ' + (cilName||'darker') + ' outer iris');
      descParts.push('ΔL=' + result.heteroDL.toFixed(1) + ' (lightness)');
    } else if (result.hetero === 'Central') {
      label = 'Central heterochromia';
      descParts.push((pupName||result.inner.name) + ' inside ' + (cilName||result.outer.name));
      descParts.push('ΔE=' + result.heteroDist.toFixed(1));
    } else {
      label = 'Subtle heterochromia';
      descParts.push('Inner ' + result.inner.name + ' vs outer ' + result.outer.name);
      descParts.push('ΔE=' + result.heteroDist.toFixed(1));
    }
    items.push({
      title: label, desc: descParts.join(' · '),
      swatch: { type: 'split', c1: rgbCss(pupRgb), c2: rgbCss(cilRgb) },
    });
  }
  // Limbal ring or halo
  if (result.limbal !== 'None' && result.limbalColor) {
    var ftype = result.limbalType || 'ring';
    items.push({
      title: result.limbal + ' limbal ' + ftype,
      desc: ftype === 'halo'
        ? result.limbalColor.name + ' halo glowing inside the iris edge · L lift=' + Math.abs(result.limbalDropL).toFixed(1)
        : result.limbalColor.name + ' rim around the iris · L drop=' + result.limbalDropL.toFixed(1),
      swatch: { type: 'solid', c1: rgbCss(result.limbalRgb || result.limbalColor.rgb) },
    });
  }
  // Sectoral patch
  if (result.sectoral) {
    items.push({
      title: 'Sectoral patch · ' + result.sectoral.color.name,
      desc: 'Localized at ' + result.sectoral.clock + " o'clock · spans " + Math.round(result.sectoral.spanDeg) + '° · ΔE=' + result.sectoral.meanDE.toFixed(1),
      swatch: { type: 'solid', c1: rgbCss(result.sectoral.rgb) },
    });
  }
  // Freckles
  if (result.freckles && result.freckles.length) {
    var nf = result.freckles.length;
    var clocks = result.freckles.map(function(f){ return f.clock; }).slice(0, 3).join(", ");
    items.push({
      title: nf + ' iris freckle' + (nf === 1 ? '' : 's'),
      desc: 'Pigmented spot' + (nf === 1 ? '' : 's') + ' at clock ' + clocks + (nf > 3 ? ' (+' + (nf-3) + ' more)' : ''),
      swatch: { type: 'solid', c1: rgbCss(result.freckles[0].rgb || [60,40,20]) },
    });
  }
  // ===== Rayid iris type =====
  if (result.rayid && RAYID_META[result.rayid.label]) {
    var rm2 = RAYID_META[result.rayid.label];
    items.push({
      title: result.rayid.label + ' iris · ' + rm2.short,
      desc:  rm2.story.replace(/<[^>]+>/g, ''),
      swatch: { type: 'solid', c1: rm2.color }
    });
  }
  // ===== Color fingerprint (always shown last, smaller) =====
  if (result.fingerprint) {
    items.push({
      title: 'Color fingerprint',
      desc: 'Lab(' + result.fingerprint.lab[0].toFixed(0) + ', '
                   + result.fingerprint.lab[1].toFixed(0) + ', '
                   + result.fingerprint.lab[2].toFixed(0) + ') · '
                   + result.fingerprint.hex.toUpperCase()
                   + ' · No two irises share an identical reading.',
      swatch: { type: 'solid', c1: rgbCss(result.fingerprint.rgb) },
    });
  }
  // Render
  if (items.length === 0) {
    box.style.display = 'none';
    return;
  }
  box.style.display = 'flex';
  items.forEach(function(it){
    var row = document.createElement('div');
    row.className = 'highlight';
    var sw = document.createElement('div');
    sw.className = 'swatch-circle' + (it.swatch.type === 'split' ? ' split' : '');
    if (it.swatch.type === 'split') {
      sw.style.setProperty('--c1', it.swatch.c1);
      sw.style.setProperty('--c2', it.swatch.c2);
    } else {
      sw.style.background = it.swatch.c1;
    }
    var body = document.createElement('div');
    body.className = 'body';
    var t = document.createElement('div'); t.className = 'title'; t.textContent = it.title;
    var d2 = document.createElement('div'); d2.className = 'desc'; d2.textContent = it.desc;
    body.appendChild(t); body.appendChild(d2);
    row.appendChild(sw); row.appendChild(body);
    box.appendChild(row);
  });
}

function renderStory(result){
  var box = $('view-story-content');
  box.innerHTML = '';
  var paras = [];
  // Opening
  var side = result.side.toLowerCase();
  // Opening — specific palette name + vibe
  var openLine = 'Your <strong>' + side + ' eye</strong> is <strong>' + result.overall.name + '</strong>';
  if (result.vibe) openLine += ' — ' + result.vibe;
  openLine += '.';
  paras.push(openLine);
  // Rarity + score
  if (result.rarity) {
    var rarityLine = result.rarity.line;
    if (result.rarityScore !== undefined) {
      rarityLine += ' Your composite rarity score is <strong>' + result.rarityScore + '/100</strong> — ' + rarityScoreLabel(result.rarityScore).toLowerCase() + '.';
    }
    paras.push(rarityLine);
  }
  // Iris character — plain language only
  var ph = getPatternHint(result.brightness, result.saturation);
  if (ph) {
    var patDesc = ph.toLowerCase();
    paras.push('The iris itself is <strong>' + patDesc + '</strong>' + (result.fingerprint ? ', with a unique color fingerprint at ' + result.fingerprint.hex.toUpperCase() : '') + '.');
  }
  // Heterochromia
  if (result.hetero !== 'None') {
    var pupName = result.heteroPup ? (result.heteroPup.displayName || result.heteroPup.color.name) : null;
    var cilName = result.heteroCil ? (result.heteroCil.displayName || result.heteroCil.color.name) : null;
    if (result.hetero.indexOf('warmth') >= 0) {
      paras.push('The most distinctive feature: <strong>central heterochromia</strong>. A ' + (pupName ? '<strong>' + pupName + '</strong>' : 'warmer') + ' ring sits immediately around the pupil, transitioning into a ' + (cilName ? cilName.toLowerCase() : 'cooler') + ' outer iris. The Lab b-channel shifts by ' + result.heteroDb.toFixed(1) + ' between the pupillary zone and the ciliary zone — that is a clear, measurable warmth gradient. Central heterochromia of this kind appears in roughly 10-15% of the population and is most often inherited as a recessive trait.');
    } else if (result.hetero.indexOf('lightness') >= 0) {
      paras.push('The eye shows <strong>central heterochromia of the lightness-gradient type</strong>: a ' + (pupName ? '<strong>' + pupName + '</strong>' : 'lighter') + ' pupillary zone within a ' + (cilName ? cilName.toLowerCase() : 'darker') + ' outer iris (ΔL=' + result.heteroDL.toFixed(1) + ').');
    } else if (result.hetero === 'Central') {
      paras.push('The eye shows <strong>central heterochromia</strong>: a clearly different color in the inner pupillary zone (' + result.inner.name + ') compared to the outer ciliary zone (' + result.outer.name + '). ΔE between zones is ' + result.heteroDist.toFixed(1) + ' — large enough to cross palette categories.');
    } else {
      paras.push('A <strong>subtle heterochromia</strong> shows up: inner ring reads as ' + result.inner.name + ', outer as ' + result.outer.name + '. ΔE=' + result.heteroDist.toFixed(1) + '.');
    }
  }
  // Limbal ring or halo
  if (result.limbal !== 'None' && result.limbalColor) {
    var strength = result.limbal.toLowerCase();
    var lftype = result.limbalType || 'ring';
    var lifAbs = Math.abs(result.limbalDropL).toFixed(1);
    if (lftype === 'halo') {
      paras.push('A <strong>' + strength + ' ' + result.limbalColor.name.toLowerCase() + ' halo</strong> glows just inside the iris edge — a bright amber/golden zone instead of the typical dark rim. The Lab L channel rises by ' + lifAbs + ' from the iris baseline to the outermost 8% band. Halos are less talked about than limbal rings but are equally distinctive — they give the iris a luminous, inset quality.');
    } else if (result.limbal === 'Strong' || result.limbal === 'Dramatic') {
      paras.push('A <strong>' + strength + ' ' + result.limbalColor.name.toLowerCase() + ' limbal ring</strong> traces the iris edge — the dark rim that makes the iris pop. The Lab L channel drops by ' + lifAbs + ' between the iris baseline and the outermost 8% ring band. Strong limbal rings tend to be most visible in younger people and gradually fade with age.');
    } else {
      paras.push('A <strong>' + strength + ' ' + result.limbalColor.name.toLowerCase() + ' limbal ring</strong> sits at the iris edge (L drop of ' + lifAbs + ') — present, but on the subtler side.');
    }
  }
  // Sectoral
  if (result.sectoral) {
    var s = result.sectoral;
    paras.push('A <strong>sectoral patch of ' + s.color.name.toLowerCase() + '</strong> appears near ' + s.clock + " o'clock, spanning roughly " + Math.round(s.spanDeg) + '° of the iris. Sectoral heterochromia is rare — about 1 in 1,000 people — and gives each affected iris a one-of-a-kind signature.');
  }
  // Freckles
  if (result.freckles && result.freckles.length) {
    var nf = result.freckles.length;
    if (nf === 1) {
      paras.push('A single <strong>iris freckle</strong> sits at clock ' + result.freckles[0].clock + ' — a small pigmented spot that is essentially a permanent fingerprint inside the iris.');
    } else {
      var clocks = result.freckles.map(function(f){ return f.clock; }).join(', ');
      paras.push('<strong>' + nf + ' iris freckles</strong> dot the iris at clock positions ' + clocks + '. These small pigmented spots act as a permanent visual fingerprint — no two irises share the same freckle pattern.');
    }
  }
  // If nothing detected beyond the base color
  if (paras.length === 1) {
    paras.push('No heterochromia, limbal ring, sectoral patches, or iris freckles were detected at the current resolution. That does not mean none exist — subtle features may need a closer crop or better lighting to surface.');
  }
  // Rayid type
  if (result.rayid && RAYID_META[result.rayid.label]) {
    paras.push(RAYID_META[result.rayid.label].story);
  }
  // Closing
  paras.push('<em style="color: var(--ink-dim); font-size:12px">Measurements are computed in CIE Lab space using a curated palette of ' + (typeof PALETTE !== 'undefined' ? PALETTE.length : 38) + ' eye-color anchors. Rarity figures are global approximations from published prevalence research. No two irises produce identical fingerprints — your eye is mathematically unique.</em>');

  paras.forEach(function(p){
    var el = document.createElement('p');
    el.innerHTML = p;
    box.appendChild(el);
  });
}
