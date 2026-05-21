'use strict';

// ======================= AUTO-FIT =======================
// Classical CV pupil+iris detection. Returns fractions (0..1) so we can apply
// to the stage regardless of how the image is scaled in.
//
// closeup: true  → close-up eye image (UBIRIS-style). Disables center-bias
//                  penalty so off-center pupils are found correctly.
//          false → full-face crop (MediaPipe already centered on iris).
//                  Center bias guides the search toward the known iris position.
function autoFit(src, closeup){
  var sampleSide = 200;  // balanced: better than 160 but coarseR stays calibrated
  var shorter = Math.min(src.width, src.height);
  var scale = sampleSide / shorter;
  var W = Math.max(2, Math.round(src.width * scale));
  var H = Math.max(2, Math.round(src.height * scale));
  var off = document.createElement('canvas');
  off.width = W; off.height = H;
  var octx = off.getContext('2d', { colorSpace: 'srgb' });
  octx.drawImage(src, 0, 0, W, H);
  var data = octx.getImageData(0, 0, W, H).data;
  var lum = new Float32Array(W*H);
  var sat = new Float32Array(W*H);
  var totalLum = 0;
  for (var i=0; i<W*H; i++){
    var r=data[i*4], g=data[i*4+1], b=data[i*4+2];
    lum[i] = 0.299*r + 0.587*g + 0.114*b;
    var mx=Math.max(r,g,b), mn=Math.min(r,g,b);
    sat[i] = mx>0 ? (mx-mn)/mx : 0;
    totalLum += lum[i];
  }
  var meanLum = totalLum / (W*H);

  var II = new Float64Array((W+1)*(H+1));
  for (var y=0; y<H; y++){
    var rowsum = 0;
    for (var x=0; x<W; x++){
      rowsum += lum[y*W + x];
      II[(y+1)*(W+1) + (x+1)] = II[y*(W+1) + (x+1)] + rowsum;
    }
  }
  function bs(x0,y0,x1,y1){
    x0=Math.max(0,x0|0); y0=Math.max(0,y0|0); x1=Math.min(W,x1|0); y1=Math.min(H,y1|0);
    if (x1<=x0||y1<=y0) return 0;
    return II[y1*(W+1)+x1]-II[y0*(W+1)+x1]-II[y1*(W+1)+x0]+II[y0*(W+1)+x0];
  }
  function bm(x0,y0,x1,y1){
    x0=Math.max(0,x0|0); y0=Math.max(0,y0|0); x1=Math.min(W,x1|0); y1=Math.min(H,y1|0);
    // Return meanLum (neutral) for empty boxes — prevents off-screen surround probes
    // from returning 1e9 ("very bright"), which would make edge positions win the coarse scan.
    var n=(x1-x0)*(y1-y0); return n>0 ? bs(x0,y0,x1,y1)/n : meanLum;
  }

  // Pupil: dark circle surrounded by brighter tissue.
  // Compute inner mean excluding bright pixels (catch-light / flash reflection)
  // so a white glare spot in the pupil center doesn't inflate the average.
  var darkThresh = Math.min(75, meanLum * 0.48);
  var glareThresh = 200;  // pixels brighter than this are reflections, ignore
  function darkMean(x0,y0,x1,y1){
    x0=Math.max(0,x0|0); y0=Math.max(0,y0|0); x1=Math.min(W,x1|0); y1=Math.min(H,y1|0);
    var s=0, n=0;
    for (var yy=y0;yy<y1;yy++) for (var xx=x0;xx<x1;xx++){
      var v=lum[yy*W+xx]; if (v<glareThresh){ s+=v; n++; }
    }
    return n>0 ? s/n : 1e9;
  }
  function pupilScore(cx,cy,r){
    var inner = darkMean(cx-r,cy-r,cx+r,cy+r);
    // Close-up: iris-edge positions have darkMean ≈ 70-90 (only the few dark iris pixels
    // at the edge are included; sclera is excluded by glareThresh). True pupils have
    // darkMean ≈ 10-20. Use darkThresh+10 in close-up mode to reject edge positions while
    // accepting real pupils. Full-face: keep the more lenient +35 threshold.
    if (inner > darkThresh + (closeup ? 10 : 35)) return -1e9;
    var hr = Math.max(1, r>>1), gap = Math.max(1, r>>2);
    var surr = [
      bm(cx+r+gap, cy-hr, cx+2*r+gap, cy+hr+1),
      bm(cx-2*r-gap, cy-hr, cx-r-gap, cy+hr+1),
      bm(cx-hr, cy-2*r-gap, cx+hr+1, cy-r-gap),
      bm(cx-hr, cy+r+gap, cx+hr+1, cy+2*r+gap),
      bm(cx+r, cy-2*r, cx+2*r, cy-r),
      bm(cx-2*r, cy-2*r, cx-r, cy-r),
      bm(cx+r, cy+r, cx+2*r, cy+2*r),
      bm(cx-2*r, cy+r, cx-r, cy+2*r)
    ].sort(function(a,b){return a-b;});
    var medSurr = (surr[3]+surr[4])/2;  // median of 8 — robust to partial occlusion
    if (medSurr - inner < 10) return -1e9;
    var cd = Math.hypot(cx - W/2, cy - H/2);
    // Close-up: require 6/8 surround quadrants bright (surr[2] = 3rd-lowest after sort).
    // Black padding bar has 3 dark upper surround samples → surr[2]≈0, so it can't win.
    // Small center penalty: close-up photos frame the iris near center; 0.15/px breaks
    // ties toward center without blocking legitimately off-center irises.
    if (closeup) return (surr[2] - inner) - cd * 0.15;
    var centerBonus = Math.max(0, 1 - cd/(W*0.25));
    return (medSurr - inner) * (1 + centerBonus*0.4) - cd*0.3;
  }

  var best = {cx: W>>1, cy: H>>1, r: 6}, bestScore = -1e9;
  var cxLo=Math.floor(W*0.10), cxHi=Math.ceil(W*0.90);
  var cyLo= closeup ? Math.floor(H*0.22) : Math.floor(H*0.15);
  var cyHi= closeup ? Math.ceil(H*0.78)  : Math.ceil(H*0.85);
  var coarseR = [3,5,7,9,12,15,18,22,26];
  if (closeup) {
    // Extend to cover large close-up pupils (radius up to ~12% of shorter dim).
    // With only r≤26, all surrounding probe quadrants land inside a 115px pupil
    // (zero contrast → score ≈ 0). Larger r values reach the bright amber zone
    // outside the pupil, giving a clear high-contrast signal at the true center.
    var maxCR = Math.round(Math.min(W, H) * 0.12);
    for (var rr0 = 32; rr0 <= maxCR; rr0 = Math.round(rr0 * 1.40)) coarseR.push(rr0);
  }
  for (var cx=cxLo; cx<cxHi; cx+=3){
    for (var cy=cyLo; cy<cyHi; cy+=3){
      for (var ri=0; ri<coarseR.length; ri++){
        var s = pupilScore(cx,cy,coarseR[ri]);
        if (s>bestScore){ bestScore=s; best={cx:cx, cy:cy, r:coarseR[ri]}; }
      }
    }
  }
  var bx=best.cx, by=best.cy, br=best.r;
  for (var cx2=Math.max(cxLo,bx-5); cx2<=Math.min(cxHi,bx+5); cx2++){
    for (var cy2=Math.max(cyLo,by-5); cy2<=Math.min(cyHi,by+5); cy2++){
      for (var rr=Math.max(2,br-4); rr<=br+4; rr++){
        var s2 = pupilScore(cx2,cy2,rr);
        if (s2>bestScore){ bestScore=s2; best={cx:cx2, cy:cy2, r:rr}; }
      }
    }
  }
  var pcx=best.cx, pcy=best.cy, pr=best.r;

  var bandH = 4;
  var minGrad = closeup ? 20 : 25;  // close-up irises can have lower iris-sclera contrast
  var guardR = Math.round(pr * 1.3);
  // For close-up, enforce a minimum guardR based on image size. The coarse pupil
  // radius may underestimate the true pupil, leaving guardR too small to prevent
  // the high-contrast pupil-amber boundary from being detected instead of the limbus.
  if (closeup) guardR = Math.max(guardR, Math.round(Math.min(W, H) * 0.18));

  // Helper: scan one horizontal band at scanY, return {leftHit, rightHit} or {-1,-1}.
  function scanBand(scanY, refCx) {
    var prof = new Float32Array(W);
    for (var x = 0; x < W; x++){
      var s=0, n=0;
      for (var b=-bandH; b<=bandH; b++){
        var ry=scanY+b; if(ry>=0&&ry<H){ s+=lum[ry*W+x]; n++; }
      }
      prof[x] = n ? s/n : 0;
    }
    // Suppress isolated bright spikes (catch-lights) in close-up mode.
    // A catch-light is a narrow bright spot much brighter than its 5px neighbors.
    // Sustained bright regions (sclera) have similar lum to their neighbors so
    // they are NOT suppressed by this filter.
    if (closeup) {
      for (var x = 5; x < W-5; x++) {
        if (prof[x] > 185) {
          var ctx5 = (prof[x-5] + prof[x+5]) * 0.5;
          if (prof[x] > ctx5 + 30) { prof[x] = ctx5; }
        }
      }
    }
    // Left scan — close-up uses a two-pass outermost-drop approach:
    //   Pass 1: find the maximum drop magnitude.
    //   Pass 2: find the FIRST (leftmost/outermost) position with drop ≥ 80% of max.
    // This prefers the true outer limbus over any internal collarette edge that
    // may coincidentally have equal or near-equal contrast (the root cause of the
    // ring landing on the amber zone instead of the iris-sclera boundary).
    // Full-face mode keeps the original max-drop logic (iris is smaller/centered).
    var lh = -1;
    if (closeup) {
      var lmP1 = minGrad;
      for (var x = 2; x < Math.round(refCx) - guardR; x++){
        var d = prof[x-2] - prof[x]; if (d > lmP1) lmP1 = d;
      }
      var lThresh = Math.max(minGrad, lmP1 * 0.80);
      for (var x = 2; x < Math.round(refCx) - guardR; x++){
        var d = prof[x-2] - prof[x]; if (d >= lThresh) { lh = x; break; }
      }
    } else {
      var lm = minGrad;
      for (var x = 2; x < Math.round(refCx) - guardR; x++){
        var d = prof[x-2] - prof[x]; if (d > lm){ lm = d; lh = x; }
      }
    }
    var rh = -1, rm = minGrad;
    for (var x = W-3; x > Math.round(refCx) + guardR; x--){
      var d = prof[x+2] - prof[x]; if (d > rm){ rm = d; rh = x; }
    }
    return { lh: lh, rh: rh };
  }

  // Iris radius bounds for close-up mode.
  // Raised 0.38 → 0.46 → 0.62: very close macro phone shots (iris fills 90-100% of the
  // shorter dimension) have rIris ≈ 0.50–0.60 × min(W,H).  The old 0.46 cap caused the
  // initial horizontal scan to correctly find the limbus but then set ok=false (because
  // irisR exceeded R_MAX_CU), causing all cascade methods to miss the true limbus.
  var R_MAX_CU = closeup ? Math.round(Math.min(W, H) * 0.62) : Infinity;

  // Iris boundary: scan horizontally at the pupil row first.
  var init = scanBand(Math.round(pcy), pcx);
  var leftHit = init.lh, rightHit = init.rh;
  var ok, irisR;
  if (leftHit >= 0 && rightHit >= 0){
    irisR = Math.round((rightHit - leftHit) / 2);
    pcx   = Math.round((leftHit + rightHit) / 2);
    ok = irisR <= R_MAX_CU;
  } else if (leftHit >= 0){
    irisR = Math.round(pcx - leftHit); ok = irisR <= R_MAX_CU;
  } else if (rightHit >= 0){
    irisR = Math.round(rightHit - pcx); ok = irisR <= R_MAX_CU;
  } else {
    irisR = Math.round(pr * 2.1); ok = false;
  }

  // Secondary validation for close-up mode: the iris is a circle, so its
  // horizontal span is WIDEST at its center Y. Scan pcy → pcy+30% looking for
  // a row with a wider, DARK-INTERIOR bilateral span.
  //
  // Scoring uses span × (exterior_lum − interior_lum) instead of span alone.
  // This rejects lower-eyelid lash lines and padding-edge artifacts: both have
  // similar lum inside and outside the span, scoring near zero. A real iris has
  // bright sclera flanking a dark interior, scoring much higher.
  if (closeup) {
    // Seed score from current reading; scan must beat this to displace it.
    var bestScore = ok ? irisR * 2 * 12 : 0;
    var bestCy = pcy, bestCx = pcx, bestIrisR = irisR;
    var tier1Hit = false; // track whether any scan actually improved on the seed
    // Scan one iris-radius ABOVE and below the pupil center. Scanning only below
    // (old behaviour) fails when the iris is very large: the pupil row has no
    // sclera on either side, so the initial horizontal scan finds a garbage radius,
    // and Tier-1 never reaches the upper rows where sclera is visible.  Extending
    // the search symmetrically (±irisR) lets us find those high-contrast rows while
    // the ±irisR cap still prevents hijacking by far-off eyelid/lash lines.
    var yRange = ok ? irisR : Math.round(H * 0.20);
    var yStart = Math.max(0, Math.round(pcy) - yRange);
    var yEnd   = Math.min(H - 1, Math.round(pcy) + yRange);
    for (var ty = yStart; ty <= yEnd; ty += 3) {
      if (Math.abs(ty - Math.round(pcy)) < 3) continue; // skip already-scanned initial row
      var b2 = scanBand(ty, pcx);
      if (b2.lh >= 0 && b2.rh >= 0) {
        var span = b2.rh - b2.lh;
        var tCx  = Math.round((b2.lh + b2.rh) / 2);
        var tFlk = Math.max(5, Math.round(span * 0.10));
        var tInt  = bm(b2.lh, ty - bandH, b2.rh, ty + bandH + 1);
        var tExtL = (b2.lh >= tFlk) ? bm(b2.lh - tFlk, ty - bandH, b2.lh, ty + bandH + 1) : tInt;
        var tExtR = (b2.rh + tFlk <= W) ? bm(b2.rh, ty - bandH, b2.rh + tFlk, ty + bandH + 1) : tInt;
        var tExt  = (tExtL + tExtR) * 0.5;
        var tScore = span * Math.max(0, tExt - tInt);
        var tR = Math.round(span / 2);
        // Cap Tier-1 radius at 1.45× the initial estimate normally.
        // Floor at pr × 3.5 so Tier-1 can still reach the true iris limbus when
        // the horizontal scan locked onto the pupil/collarette boundary (irisR ≈ pupilR)
        // rather than the true outer limbus — a common failure for close-up images
        // with no sclera visible. Without this floor the cap would be ~pupilR × 1.45,
        // too small to ever find a limbus at 2.5-3× pupilR.
        // Lower bound: lash lines are narrow — require ≥65% of the initial radius so a
        // lash-line bilateral (shorter span than the iris) can't displace a good seed.
        var tRinRange = tR <= R_MAX_CU &&
                        (!ok || tR <= Math.max(irisR * 1.45, Math.round(pr * 3.5))) &&
                        (!ok || tR >= irisR * 0.65);
        if (tScore > bestScore && tRinRange) {
          bestScore = tScore;
          bestCy = ty; bestCx = tCx; bestIrisR = tR;
          tier1Hit = true;
        }
      }
    }
    // Only update if Tier-1 actually found a bilateral improvement. If no scan
    // beat the seed, keep the original leftHit/rightHit from the initial band scan
    // rather than overwriting them with pcx ± irisR (which can be negative when
    // the initial scan found only one limbus and irisR = rightHit - pcx).
    if (tier1Hit) {
      pcy = bestCy; pcx = bestCx; irisR = bestIrisR; ok = true;
      leftHit = Math.round(bestCx - bestIrisR);
      rightHit = Math.round(bestCx + bestIrisR);
    }
  }

  // Post-Tier-1 darkness validation: verify the accepted ring has a dark interior
  // (iris body) vs bright sclera flanking it. Catches lash lines and skin creases.
  // Only run when both flanks have enough room from the image edge to sample real
  // sclera — for very large/close-up irises the sclera may not be visible, and
  // the limbal detection is trusted as-is.
  if (closeup && ok) {
    var vFlk  = Math.max(6, Math.round(irisR * 0.12));
    var vHasL = leftHit  >= vFlk;
    var vHasR = rightHit + vFlk <= W;
    if (vHasL && vHasR) {
      var vPcy  = Math.round(pcy);
      var vInt  = bm(leftHit, vPcy - bandH, rightHit, vPcy + bandH + 1);
      var vExtL = bm(leftHit - vFlk, vPcy - bandH, leftHit,         vPcy + bandH + 1);
      var vExtR = bm(rightHit,       vPcy - bandH, rightHit + vFlk, vPcy + bandH + 1);
      var vExt  = (vExtL + vExtR) * 0.5;
      if (vExt - vInt < minGrad * 0.6) ok = false; // interior not dark → not iris
    }
  }

  // Tier-2 fallback: global bilateral limbus sweep with darkness scoring.
  // Runs when ok=false, weak radius, a single-limbus detection, OR the accepted
  // circle center is implausibly far from the image center (>35% of W) — which
  // indicates the seed landed on a non-iris dark region (lash shadow, canthus, etc.)
  // and the bilateral scan built a wrong circle from it.
  var centerDist = Math.hypot(pcx - W/2, pcy - H/2);
  // Also trigger Tier-2 when the detected iris is suspiciously small for a close-up
  // photo (< 38% of the shorter dimension). In extreme close-ups the pupil center row
  // may have no visible sclera, yielding a garbage initial radius that passes the old
  // W*0.10 threshold but is clearly wrong for a true macro shot.
  if (closeup && (!ok || irisR < W * 0.10 || irisR < Math.round(Math.min(W,H) * 0.38) || leftHit < 0 || centerDist > W * 0.35)) {
    var gBestScore = 0, gBestCy = -1, gBestCx = W>>1, gBestR = 0;
    var gyLo = Math.floor(H * 0.15), gyHi = Math.ceil(H * 0.85);
    for (var gy = gyLo; gy <= gyHi; gy += 2) {
      var gprof = new Float32Array(W);
      for (var gx = 0; gx < W; gx++) {
        var gs = 0, gn = 0;
        for (var gb = -bandH; gb <= bandH; gb++) {
          var gry = gy + gb; if (gry >= 0 && gry < H) { gs += lum[gry*W+gx]; gn++; }
        }
        gprof[gx] = gn ? gs/gn : 0;
      }
      // Same catch-light suppression applied to the Tier-2 profile.
      for (var gx = 5; gx < W-5; gx++) {
        if (gprof[gx] > 185) {
          var gctx = (gprof[gx-5] + gprof[gx+5]) * 0.5;
          if (gprof[gx] > gctx + 30) { gprof[gx] = gctx; }
        }
      }
      // Tier-2 left scan: outermost drop ≥ 80% of maximum (same logic as scanBand).
      var gleft = -1, gleftMax = minGrad;
      for (var gx = 2; gx < (W>>1); gx++) {
        var gd = gprof[gx-2] - gprof[gx]; if (gd > gleftMax) gleftMax = gd;
      }
      var glThresh = Math.max(minGrad, gleftMax * 0.80);
      for (var gx = 2; gx < (W>>1); gx++) {
        var gd = gprof[gx-2] - gprof[gx]; if (gd >= glThresh) { gleft = gx; break; }
      }
      // Find the strongest right-side drop (sclera→iris entering from right half)
      var gright = -1, grightMax = minGrad;
      for (var gx = W-3; gx > (W>>1); gx--) {
        var gd = gprof[gx+2] - gprof[gx];
        if (gd > grightMax) { grightMax = gd; gright = gx; }
      }
      if (gleft >= 0 && gright > gleft) {
        var gspan  = gright - gleft;
        var gcx_g  = Math.round((gleft + gright) / 2);
        var gFlk    = Math.max(5, Math.round(gspan * 0.10));
        var gIntL   = bm(gleft, gy - bandH, gright, gy + bandH + 1);
        var gExtLL  = (gleft >= gFlk) ? bm(gleft - gFlk, gy - bandH, gleft, gy + bandH + 1) : gIntL;
        var gExtRL  = (gright + gFlk <= W) ? bm(gright, gy - bandH, gright + gFlk, gy + bandH + 1) : gIntL;
        var gExtL   = (gExtLL + gExtRL) * 0.5;
        var gScore  = gspan * Math.max(0, gExtL - gIntL);
        if (gScore > gBestScore) {
          gBestScore = gScore; gBestCy = gy;
          gBestCx = gcx_g;
          gBestR  = Math.round(gspan / 2);
        }
      }
    }
    // Accept if iris spans ≥18% of image width, ≤48% of shorter dimension, and has a positive darkness score
    if (gBestCy >= 0 && gBestR > W * 0.09 && gBestR <= R_MAX_CU && gBestScore > 0) {
      pcy = gBestCy; pcx = gBestCx; irisR = gBestR; ok = true;
      leftHit = Math.round(gBestCx - gBestR);
      rightHit = Math.round(gBestCx + gBestR);
    }
  }

  // Independent pupil center re-search (close-up + ok only).
  // The coarse pupil grid above runs before iris detection and may place the pupil
  // at the iris center rather than the true (offset) pupil center. Here we do a
  // focused search anchored on the final iris center within 50% of irisR.
  var pupilCx = pcx, pupilCy = pcy, pupilR = pr;
  if (closeup && ok) {
    var pSR    = Math.round(irisR * 0.50);   // search radius from iris center
    var pMaxR  = Math.round(irisR * 0.45);   // pupil can't exceed 45% of irisR
    var pLo    = Math.max(0, pcx - pSR);
    var pHi    = Math.min(W, pcx + pSR + 1);
    var pyLo   = Math.max(0, pcy - pSR);
    var pyHi   = Math.min(H, pcy + pSR + 1);
    var pBest  = -1e9;
    for (var ppx = pLo; ppx < pHi; ppx += 2) {
      for (var ppy = pyLo; ppy < pyHi; ppy += 2) {
        if (Math.hypot(ppx - pcx, ppy - pcy) > pSR) continue;
        for (var ri2 = 0; ri2 < coarseR.length; ri2++) {
          if (coarseR[ri2] > pMaxR) break;
          var ps = pupilScore(ppx, ppy, coarseR[ri2]);
          if (ps > pBest) { pBest = ps; pupilCx = ppx; pupilCy = ppy; pupilR = coarseR[ri2]; }
        }
      }
    }
    // Fine-tune ±4px, ±3r
    var bpx2 = pupilCx, bpy2 = pupilCy, bpr2 = pupilR;
    for (var fpx = Math.max(pLo, bpx2-4); fpx <= Math.min(pHi-1, bpx2+4); fpx++) {
      for (var fpy = Math.max(pyLo, bpy2-4); fpy <= Math.min(pyHi-1, bpy2+4); fpy++) {
        if (Math.hypot(fpx - pcx, fpy - pcy) > pSR) continue;
        for (var frr = Math.max(2, bpr2-3); frr <= Math.min(pMaxR, bpr2+3); frr++) {
          var fps = pupilScore(fpx, fpy, frr);
          if (fps > pBest) { pBest = fps; pupilCx = fpx; pupilCy = fpy; pupilR = frr; }
        }
      }
    }
  }

  return {
    cxFrac:      pcx/W,      cyFrac:      pcy/H,
    cxPupilFrac: pupilCx/W,  cyPupilFrac: pupilCy/H,
    rPupilFrac:  (pupilR*1.05)/W,
    rIrisFrac:   irisR/W,
    ok: ok, leftHit: leftHit, rightHit: rightHit,
    leftGrad: 0, rightGrad: 0
  };
}

// Refine the iris/pupil center by finding the weighted centroid of the darkest pixels
// within searchR of the hint center. The pupil is always the darkest structure in the
// eye, so this corrects MP's center error on close-up photos lacking face context.
function findPupilCenter(imgEl, cxHint, cyHint, searchR) {
  var W = imgEl.naturalWidth  || imgEl.width;
  var H = imgEl.naturalHeight || imgEl.height;
  if (!W || !H) return null;
  var tmp = document.createElement('canvas');
  tmp.width = W; tmp.height = H;
  tmp.getContext('2d', { colorSpace: 'srgb' }).drawImage(imgEl, 0, 0);
  var data = tmp.getContext('2d', { colorSpace: 'srgb' }).getImageData(0, 0, W, H).data;
  function lum(x, y) {
    var px = Math.max(0, Math.min(W-1, Math.round(x)));
    var py = Math.max(0, Math.min(H-1, Math.round(y)));
    var idx = (py * W + px) * 4;
    return 0.299*data[idx] + 0.587*data[idx+1] + 0.114*data[idx+2];
  }
  var r = Math.round(searchR);
  var x0 = Math.max(0, Math.round(cxHint - r));
  var x1 = Math.min(W-1, Math.round(cxHint + r));
  var y0 = Math.max(0, Math.round(cyHint - r));
  var y1 = Math.min(H-1, Math.round(cyHint + r));
  // Collect luminances inside circle, find 40th-percentile threshold (darkest 40% = pupil)
  var lums = [];
  for (var y = y0; y <= y1; y++) {
    for (var x = x0; x <= x1; x++) {
      var ddx = x - cxHint, ddy = y - cyHint;
      if (ddx*ddx + ddy*ddy > r*r) continue;
      lums.push(lum(x, y));
    }
  }
  if (lums.length < 10) return null;
  lums.sort(function(a,b){return a-b;});
  // Use very dark pixels only (pupil core) — amber/hazel iris can pull the 40th-pct
  // centroid off-center; capping at lum=50 isolates the true black pupil.
  var threshold = Math.min(lums[Math.floor(lums.length * 0.30)], 50);
  // Weighted centroid of dark pixels (weight = how much darker than threshold)
  var wx = 0, wy = 0, wt = 0;
  for (var y = y0; y <= y1; y++) {
    for (var x = x0; x <= x1; x++) {
      var ddx = x - cxHint, ddy = y - cyHint;
      if (ddx*ddx + ddy*ddy > r*r) continue;
      var l = lum(x, y);
      if (l > threshold) continue;
      var w = threshold - l + 1;
      wx += x * w; wy += y * w; wt += w;
    }
  }
  if (wt < 1) return null;
  return { cx: wx / wt, cy: wy / wt };
}

// Mean luminance of the iris annulus (innerR..outerR). Used to pick scan window:
// dark irises need a wider maxR to reach the low-contrast limbal edge.
// maxLum: optional — pixels brighter than this are excluded (catch-light rejection).
// Pass 180 for the pupil zone so a catch-light doesn't inflate the dark-pupil average
// and falsely trigger the zoom sanity abort.
function estimateIrisBrightness(imgEl, cx, cy, innerR, outerR, maxLum) {
  var W = imgEl.naturalWidth  || imgEl.width;
  var H = imgEl.naturalHeight || imgEl.height;
  if (!W || !H) return 128;
  var tmp = document.createElement('canvas');
  tmp.width = W; tmp.height = H;
  tmp.getContext('2d', { colorSpace: 'srgb' }).drawImage(imgEl, 0, 0);
  var data = tmp.getContext('2d', { colorSpace: 'srgb' }).getImageData(0, 0, W, H).data;
  var x0 = Math.max(0, Math.round(cx - outerR));
  var x1 = Math.min(W-1, Math.round(cx + outerR));
  var y0 = Math.max(0, Math.round(cy - outerR));
  var y1 = Math.min(H-1, Math.round(cy + outerR));
  var sum = 0, count = 0;
  for (var y = y0; y <= y1; y++) {
    for (var x = x0; x <= x1; x++) {
      var dx = x - cx, dy = y - cy, d2 = dx*dx + dy*dy;
      if (d2 < innerR*innerR || d2 > outerR*outerR) continue;
      var idx = (y * W + x) * 4;
      var lum = 0.299*data[idx] + 0.587*data[idx+1] + 0.114*data[idx+2];
      if (maxLum && lum > maxLum) continue;  // skip catch-lights / specular glare
      sum += lum;
      count++;
    }
  }
  return count > 0 ? sum / count : 128;
}

// ---- Iris OD: horizontal band + near-horizontal rays ----
// Scans the sclera→iris boundary horizontally where the contrast is strongest.
// Returns { irisR, cxIris, cyIris } in imgEl pixels, or null if not enough hits.
// pupilRHint: guard radius so we skip the pupil→iris boundary.
function findIrisODHorizontal(imgEl, cxHint, cyHint, pupilRHint, irisRHint) {
  var W = imgEl.naturalWidth  || imgEl.width;
  var H = imgEl.naturalHeight || imgEl.height;
  if (!W || !H) return null;
  var tmp = document.createElement('canvas');
  tmp.width = W; tmp.height = H;
  tmp.getContext('2d', { colorSpace: 'srgb' }).drawImage(imgEl, 0, 0);
  var data = tmp.getContext('2d', { colorSpace: 'srgb' }).getImageData(0, 0, W, H).data;

  function lum(x, y) {
    var px = Math.max(0, Math.min(W-1, Math.round(x)));
    var py = Math.max(0, Math.min(H-1, Math.round(y)));
    var idx = (py * W + px) * 4;
    return 0.299*data[idx] + 0.587*data[idx+1] + 0.114*data[idx+2];
  }

  var cx = Math.round(cxHint), cy = Math.round(cyHint);
  // Guard must clear the pupil AND any catch-light (specular highlight) inside the iris.
  // Catch-lights typically extend to ~1.8× the pupil radius, so use 2.0× to be safe.
  // Minimum of 12px so tiny pupils don't leave guardR at zero.
  var guardR = Math.max(12, Math.round((pupilRHint || 0) * 2.0));
  var bandH = 6;

  // Smooth horizontal profile across ±6px band
  var profile = new Float32Array(W);
  for (var x = 0; x < W; x++) {
    var s = 0, n = 0;
    for (var b = -bandH; b <= bandH; b++) {
      var ry = cy + b;
      if (ry >= 0 && ry < H) { s += lum(x, ry); n++; }
    }
    profile[x] = n ? s / n : 0;
  }

  var hits = [];       // collected limbal distances from center
  var leftHit = -1, rightHit = -1;

  // Restrict horizontal scan to a plausible limbus zone.
  // When an iris-radius hint is supplied (full-face path), cap search at 2.0× that hint
  // (raised from 1.5×) so the scan can reach the true limbus even when the hint (iR)
  // was set by the IPD floor and underestimates the actual iris by up to ~55%.
  // Without the hint (close-up path), use the pupil-based formula that ensures the
  // scan always reaches past the iris regardless of how small the pupil hint is.
  var maxSearchR;
  if (irisRHint > 0) {
    maxSearchR = Math.round(irisRHint * 2.0);
  } else if (pupilRHint > 0) {
    maxSearchR = Math.min(Math.min(W, H) * 0.47, Math.max(Math.round(pupilRHint * 5.5), Math.round(Math.min(W, H) * 0.38)));
  } else {
    maxSearchR = Math.min(W, H) * 0.47;
  }

  // Left limbus: scan rightward from the capped start, find steepest brightness DROP entering iris
  var leftMax = 20;   // minimum gradient threshold (lum units over 2px)
  var leftFrom = Math.max(2, Math.round(cx - maxSearchR));
  for (var x = leftFrom; x < cx - guardR; x++) {
    var drop = profile[x-2] - profile[x];
    if (drop > leftMax) { leftMax = drop; leftHit = x; }
  }
  if (leftHit >= 0) hits.push(cx - leftHit);

  // Right limbus: scan leftward from the capped end
  var rightMax = 20;
  var rightTo = Math.min(W - 3, Math.round(cx + maxSearchR));
  for (var x = rightTo; x > cx + guardR; x--) {
    var drop = profile[x+2] - profile[x];
    if (drop > rightMax) { rightMax = drop; rightHit = x; }
  }
  if (rightHit >= 0) hits.push(rightHit - cx);

  // Near-horizontal rays at ±20° and ±30°, firing both left and right
  // Use the same maxSearchR cap as the horizontal scan — these rays were previously
  // uncapped (W*0.5) and could reach eyelid/skin, inflating the median.
  var rayAngles = [20, -20, 30, -30];
  var rayThresh = 12;
  var maxR = maxSearchR;

  for (var ai = 0; ai < rayAngles.length; ai++) {
    var angle = rayAngles[ai] * Math.PI / 180;
    var cosA = Math.cos(angle), sinA = Math.sin(angle);

    // Rightward ray — look for brightness RISE (dark iris → bright sclera)
    var bestR = -1, bestG = rayThresh;
    for (var r = guardR + 2; r < maxR - 2; r++) {
      var x1 = cx + r*cosA, y1 = cy + r*sinA;
      if (x1 < 0 || x1 >= W || y1 < 0 || y1 >= H) break;
      var g = lum(x1, y1) - lum(cx + (r-2)*cosA, cy + (r-2)*sinA);
      if (g > bestG) { bestG = g; bestR = r; }
    }
    if (bestR > 0) hits.push(bestR);

    // Leftward ray (mirror angle)
    bestR = -1; bestG = rayThresh;
    for (var r = guardR + 2; r < maxR - 2; r++) {
      var x1 = cx - r*cosA, y1 = cy + r*sinA;
      if (x1 < 0 || x1 >= W || y1 < 0 || y1 >= H) break;
      var g = lum(x1, y1) - lum(cx - (r-2)*cosA, cy + (r-2)*sinA);
      if (g > bestG) { bestG = g; bestR = r; }
    }
    if (bestR > 0) hits.push(bestR);
  }

  if (hits.length < 2) return null;
  hits.sort(function(a, b) { return a - b; });
  var irisR = hits[Math.floor(hits.length / 2)];

  // Iris center x: midpoint of horizontal hits if both found; otherwise keep hint
  var cxIris = (leftHit >= 0 && rightHit >= 0)
    ? Math.round((leftHit + rightHit) / 2)
    : cx;

  return { irisR: irisR, cxIris: cxIris, cyIris: cy };
}

// ---- Iris OD: Radial Intensity Profile (full-circle mean, confidence-scored) ----
// PRIMARY iris OD algorithm. For each candidate radius r, samples 64 evenly-spaced
// points around the full circle and computes a weighted mean luminance. The limbus
// (iris→sclera boundary) appears as the sharpest brightness rise in the profile.
//
// Returns { irisR, confidence } where confidence is 0–1:
//   ≥ 0.35 → use this result; < 0.35 → fall back to secondary, show advisory.
//
// Why this beats horizontal-gradient scan: the full-circle mean dilutes eyelid
// corners and lash shadows to ~2/64 of the signal instead of dominating when
// they happen to fall at 3 or 9 o'clock.
function findIrisODByRIP(imgEl, cx, cy, hintR) {
  var W = imgEl.naturalWidth  || imgEl.width;
  var H = imgEl.naturalHeight || imgEl.height;
  if (!W || !H || !hintR || hintR < 4) return null;

  var tmp = document.createElement('canvas');
  tmp.width = W; tmp.height = H;
  tmp.getContext('2d', { colorSpace: 'srgb' }).drawImage(imgEl, 0, 0);
  var data = tmp.getContext('2d', { colorSpace: 'srgb' }).getImageData(0, 0, W, H).data;

  function lum(x, y) {
    var px = Math.max(0, Math.min(W-1, Math.round(x)));
    var py = Math.max(0, Math.min(H-1, Math.round(y)));
    var idx = (py * W + px) * 4;
    return 0.299*data[idx] + 0.587*data[idx+1] + 0.114*data[idx+2];
  }

  var cxR = Math.round(cx), cyR = Math.round(cy);
  var rMin = Math.max(4, Math.round(hintR * 0.75));
  // Cap raised from 0.48 → 0.62 to match R_MAX_CU: extreme close-up irises can
  // fill up to 62 % of the shorter image dimension, so the old 0.48 cap caused
  // the search window to end before the true limbus was reached when the initial
  // hintR was also underestimated (e.g., from a collarette-locked autoFit pass).
  var rMax = Math.min(Math.round(Math.min(W, H) * 0.62), Math.round(hintR * 2.00));
  if (rMax <= rMin + 4) return null;

  var SAMPLES = 64;
  var profLen  = rMax - rMin + 1;
  var profile  = new Float32Array(profLen);
  var profOk   = new Uint8Array(profLen);

  for (var r = rMin; r <= rMax; r++) {
    var wsum = 0, wcount = 0;
    for (var si = 0; si < SAMPLES; si++) {
      var angle = (2 * Math.PI * si) / SAMPLES;
      var cosA = Math.cos(angle), sinA = Math.sin(angle);
      // Skip upper hemisphere — top eyelid causes false limbus edges.
      // Threshold widened from -0.50 to -0.30: the 9–10 o'clock band
      // (sinA ≈ -0.26 to -0.50) is included by -0.50 but frequently
      // contains eyelid shadow whose shadow→sclera gradient is sharper
      // than the true limbus, inflating the detected radius by 8–12%.
      // Excluding to -0.30 removes that band with minimal loss of valid
      // iris-edge information (the lower and lateral iris still provide
      // enough samples for a reliable fit).
      if (sinA < -0.30) continue;
      var sx = cxR + r * cosA, sy = cyR + r * sinA;
      if (sx < 0 || sx >= W || sy < 0 || sy >= H) continue;
      var l = lum(sx, sy);
      // Down-weight extreme pixels: bright = eyelid skin/sclera spill; dark = lash shadow
      var w = (l > 210 || l < 35) ? 0.15 : 1.0;
      wsum += l * w; wcount += w;
    }
    var pi = r - rMin;
    if (wcount > 2) { profile[pi] = wsum / wcount; profOk[pi] = 1; }
  }

  // 3-point smoothing pass to reduce single-pixel noise
  var smooth = new Float32Array(profLen);
  for (var i = 0; i < profLen; i++) {
    if (!profOk[i]) { smooth[i] = -1; continue; }
    var cnt = 1, s = profile[i];
    if (i > 0 && profOk[i-1]) { s += profile[i-1]; cnt++; }
    if (i < profLen-1 && profOk[i+1]) { s += profile[i+1]; cnt++; }
    smooth[i] = s / cnt;
  }

  // Find the radius with the largest positive derivative (iris→sclera brightness rise)
  var maxDeriv = 5, bestIdx = -1;   // require at least 5 lum-unit rise
  for (var i = 2; i < profLen - 2; i++) {
    if (smooth[i+2] < 0 || smooth[i-2] < 0) continue;
    var deriv = smooth[i+2] - smooth[i-2];
    if (deriv > maxDeriv) { maxDeriv = deriv; bestIdx = i; }
  }
  if (bestIdx < 0) return null;

  // Confidence = peak derivative / total luminance range in profile (0–1).
  // 1.0 → perfectly sharp limbus; < 0.35 → gradual / noisy, use fallback.
  var vMin = 255, vMax = 0;
  for (var i = 0; i < profLen; i++) {
    if (smooth[i] < 0) continue;
    if (smooth[i] < vMin) vMin = smooth[i];
    if (smooth[i] > vMax) vMax = smooth[i];
  }
  var lumRange   = vMax - vMin;
  var confidence = lumRange > 5 ? Math.min(1, maxDeriv / lumRange) : 0;

  return { irisR: rMin + bestIdx, confidence: confidence };
}

// ---- Iris OD: Saturation Ring Profile (dark-iris fallback) ----
// Tier-3.5 cascade: used when all luminance-based methods fail (e.g. very dark
// irises where iris and sclera have similar brightness but different chroma).
//
// The iris is almost always MORE saturated than the sclera — even near-black
// brown irises carry amber/brown chroma that the white sclera lacks.
// This method looks for the sharpest DROP in saturation as radius increases
// (iris→sclera = saturation falls off), rather than a luminance rise.
//
// Returns { irisR, confidence } — same contract as findIrisODByRIP.
// confidence ≥ 0.25 is good enough to trust (lower bar than RIP since chroma
// signal is weaker but still meaningfully different from noise).
function findIrisODBySaturation(imgEl, cx, cy, hintR) {
  var W = imgEl.naturalWidth  || imgEl.width;
  var H = imgEl.naturalHeight || imgEl.height;
  if (!W || !H || !hintR || hintR < 4) return null;

  var tmp = document.createElement('canvas');
  tmp.width = W; tmp.height = H;
  tmp.getContext('2d', { colorSpace: 'srgb' }).drawImage(imgEl, 0, 0);
  var data = tmp.getContext('2d', { colorSpace: 'srgb' }).getImageData(0, 0, W, H).data;

  function sat(x, y) {
    var px = Math.max(0, Math.min(W-1, Math.round(x)));
    var py = Math.max(0, Math.min(H-1, Math.round(y)));
    var idx = (py * W + px) * 4;
    var r = data[idx], g = data[idx+1], b = data[idx+2];
    var mx = Math.max(r, g, b);
    if (mx < 8) return 0; // near-black — saturation undefined, treat as 0
    return (mx - Math.min(r, g, b)) / mx; // HSV saturation 0–1
  }

  var cxR = Math.round(cx), cyR = Math.round(cy);
  var rMin = Math.max(4, Math.round(hintR * 0.70));
  var rMax = Math.min(Math.round(Math.min(W, H) * 0.48), Math.round(hintR * 1.45));
  if (rMax <= rMin + 4) return null;

  var SAMPLES = 48;
  var profLen = rMax - rMin + 1;
  var profile = new Float32Array(profLen);
  var profOk  = new Uint8Array(profLen);

  for (var r = rMin; r <= rMax; r++) {
    var sum = 0, count = 0;
    for (var si = 0; si < SAMPLES; si++) {
      var angle = (2 * Math.PI * si) / SAMPLES;
      var cosA = Math.cos(angle), sinA = Math.sin(angle);
      if (sinA < -0.45) continue; // skip upper-eyelid zone (same as RIP)
      var sx = cxR + r * cosA, sy = cyR + r * sinA;
      if (sx < 0 || sx >= W || sy < 0 || sy >= H) continue;
      sum += sat(sx, sy);
      count++;
    }
    var pi = r - rMin;
    if (count > 3) { profile[pi] = sum / count; profOk[pi] = 1; }
  }

  // 3-point smoothing
  var smooth = new Float32Array(profLen);
  for (var i = 0; i < profLen; i++) {
    if (!profOk[i]) { smooth[i] = -1; continue; }
    var cnt = 1, s = profile[i];
    if (i > 0 && profOk[i-1]) { s += profile[i-1]; cnt++; }
    if (i < profLen-1 && profOk[i+1]) { s += profile[i+1]; cnt++; }
    smooth[i] = s / cnt;
  }

  // Find the radius with the sharpest NEGATIVE derivative (saturation drop = iris→sclera)
  var maxDrop = 0.03, bestIdx = -1; // require at least 3% saturation drop
  for (var i = 2; i < profLen - 2; i++) {
    if (smooth[i+2] < 0 || smooth[i-2] < 0) continue;
    var drop = smooth[i-2] - smooth[i+2]; // positive = saturation falling off
    if (drop > maxDrop) { maxDrop = drop; bestIdx = i; }
  }
  if (bestIdx < 0) return null;

  // Confidence = peak drop / total saturation range in profile
  var vMin = 1, vMax = 0;
  for (var i = 0; i < profLen; i++) {
    if (smooth[i] < 0) continue;
    if (smooth[i] < vMin) vMin = smooth[i];
    if (smooth[i] > vMax) vMax = smooth[i];
  }
  var satRange  = vMax - vMin;
  var confidence = satRange > 0.02 ? Math.min(1, maxDrop / satRange) : 0;

  return { irisR: rMin + bestIdx, confidence: confidence };
}

// ---- Pupil radius: 8-ray inward scan ----
// Fires 8 rays outward from pupil center and finds where each exits the dark pupil.
// Returns pupil radius in imgEl pixels (capped to irisR × 0.32).
function findPupilRadiusByRays(imgEl, cxPupil, cyPupil, irisR) {
  var W = imgEl.naturalWidth  || imgEl.width;
  var H = imgEl.naturalHeight || imgEl.height;
  if (!W || !H) return irisR * 0.25;
  var tmp = document.createElement('canvas');
  tmp.width = W; tmp.height = H;
  tmp.getContext('2d', { colorSpace: 'srgb' }).drawImage(imgEl, 0, 0);
  var data = tmp.getContext('2d', { colorSpace: 'srgb' }).getImageData(0, 0, W, H).data;

  // Build luminance array with glare pre-pass (corneal reflections → neighbor average)
  var gl = new Float32Array(W * H);
  for (var i = 0; i < W * H; i++) {
    var idx = i * 4;
    gl[i] = 0.299*data[idx] + 0.587*data[idx+1] + 0.114*data[idx+2];
  }
  for (var y = 1; y < H - 1; y++) {
    for (var x = 1; x < W - 1; x++) {
      if (gl[y*W+x] > 220) {
        gl[y*W+x] = (gl[(y-1)*W+x] + gl[(y+1)*W+x] + gl[y*W+x-1] + gl[y*W+x+1]) * 0.25;
      }
    }
  }
  function lumG(x, y) {
    var px = Math.max(0, Math.min(W-1, Math.round(x)));
    var py = Math.max(0, Math.min(H-1, Math.round(y)));
    return gl[py*W+px];
  }

  // Darkest pixel in 5×5 window around pupil center → calibrate exit threshold
  var cx = Math.round(cxPupil), cy = Math.round(cyPupil);
  var darkest = 255;
  for (var dy = -2; dy <= 2; dy++) {
    for (var dx = -2; dx <= 2; dx++) {
      var v = lumG(cx+dx, cy+dy);
      if (v < darkest) darkest = v;
    }
  }
  // Sample ambient iris luminance at ~70% of irisR to calibrate the exit threshold.
  // For dark irises (pupil ≈ iris in luminance) the fixed +25 delta overshoots into
  // the iris stroma, so we use a contrast-proportional threshold instead.
  var ambientSum = 0, ambientN = 0;
  var sampleR = Math.round(irisR * 0.70);
  for (var sa = 0; sa < 8; sa++) {
    var sang = (sa / 8) * 2 * Math.PI;
    ambientSum += lumG(cx + sampleR * Math.cos(sang), cy + sampleR * Math.sin(sang));
    ambientN++;
  }
  var ambientLum = ambientSum / ambientN;
  // Exit threshold sits 35% of the way from pupil-dark to iris-ambient.
  // Clamp: never lower than darkest+18, never higher than darkest+50.
  var contrast   = Math.max(0, ambientLum - darkest);
  var exitThresh = Math.max(darkest + 18, Math.min(darkest + 50, darkest + contrast * 0.35));

  var maxR  = irisR * 0.25;   // search ceiling (was 0.28 — tightened for dark irises)
  var radii = [];
  var hitMax = 0;              // count rays that reached maxR without a clean exit

  for (var a = 0; a < 8; a++) {
    var angle = (a / 8) * 2 * Math.PI;
    var cosA = Math.cos(angle), sinA = Math.sin(angle);
    var found = false;
    for (var r = 2; r <= maxR; r++) {
      if (lumG(cx + r*cosA, cy + r*sinA) > exitThresh) {
        radii.push(r);
        found = true;
        break;
      }
    }
    if (!found) hitMax++;
  }

  // If most rays hit the ceiling without a clean exit the pupil/iris contrast is too
  // low to trust the scan (common for graphite/dark-brown irises).
  // Fall back to a conservative 20% of iris radius rather than inflating to the cap.
  if (radii.length < 4 || hitMax >= 5) return irisR * 0.20;
  radii.sort(function(a, b) { return a - b; });
  var pupilR = radii[Math.floor(radii.length / 2)];
  return Math.max(4, Math.min(pupilR, irisR * 0.26));  // hard cap reduced from 0.32
}

// Radial brightness scan: find iris outer radius anchored on a known center point.
// hintR: MP iris radius in crop pixels — used to set a minimum search radius so we
// skip the pupil→iris boundary and only find the iris→sclera limbal transition.
// maxRFactor: upper bound = hintR * maxRFactor (default 1.22; use ~1.55 for dark irises).
// Returns median radius in imgEl pixels, or null if <3 rays succeed.
function findIrisRadiusByRadialScan(imgEl, cxCrop, cyCrop, hintR, maxRFactor) {
  if (!maxRFactor) maxRFactor = 1.22;
  var W = imgEl.naturalWidth  || imgEl.width;
  var H = imgEl.naturalHeight || imgEl.height;
  if (!W || !H) return null;
  var tmp = document.createElement('canvas');
  tmp.width = W; tmp.height = H;
  tmp.getContext('2d', { colorSpace: 'srgb' }).drawImage(imgEl, 0, 0);
  var data = tmp.getContext('2d', { colorSpace: 'srgb' }).getImageData(0, 0, W, H).data;

  function lum(x, y) {
    var px = Math.max(0, Math.min(W-1, Math.round(x)));
    var py = Math.max(0, Math.min(H-1, Math.round(y)));
    var idx = (py * W + px) * 4;
    return 0.299*data[idx] + 0.587*data[idx+1] + 0.114*data[idx+2];
  }

  // If we have an MP hint, clamp the search window tightly around the expected limbal radius.
  // Lower: skip pupil-iris gradient. Upper: 1.22× keeps Terri's limbal (×1.18) and blocks
  // Bryan's eyelid/corner hit (×1.22 * 0.97 threshold = ×1.18 effective ceiling).
  var minR  = hintR ? Math.max(Math.min(W,H)*0.05, hintR * 0.80) : Math.min(W,H)*0.05;
  var maxR  = hintR ? Math.min(Math.min(W,H)*0.48, hintR * maxRFactor) : Math.min(W,H)*0.48;
  var step  = Math.max(1, Math.round(Math.min(W, H) * 0.005));
  var N     = 16;
  var radii = [];

  for (var a = 0; a < N; a++) {
    var angle = (a / N) * 2 * Math.PI;
    var cosA  = Math.cos(angle), sinA = Math.sin(angle);
    if (sinA < -0.5) continue;   // skip rays toward upper eyelid

    var profile = [];
    for (var r = Math.ceil(minR); r < maxR; r += step) {
      profile.push({ r: r, l: lum(cxCrop + r*cosA, cyCrop + r*sinA) });
    }
    if (profile.length < 6) continue;

    // Find r of maximum positive gradient (steepest brightness rise = iris→sclera)
    var bestR = null, bestGrad = 8;
    for (var i = 2; i < profile.length - 2; i++) {
      var g = profile[i+2].l - profile[i-2].l;
      if (g > bestGrad) { bestGrad = g; bestR = profile[i].r; }
    }
    if (bestR && bestR > minR && bestR < maxR * 0.97) radii.push(bestR);
  }

  if (radii.length < 3) return null;
  radii.sort(function(a,b){ return a-b; });
  return radii[Math.floor(radii.length / 2)];   // median
}

// ---- Ring-contrast iris finder ----
// Searches for the (cx, cy, r) that maximizes outer_mean - inner_mean, where
// outer is sampled at 1.2× r (sclera) and inner at 0.5× r (iris body + pupil).
// This signature is unique to a real iris — dark backgrounds, skin, and hair all
// score near zero because there is no bright sclera ring surrounding them.
//
// cxHint, cyHint, rHint: starting point in imgEl pixel space (e.g. MediaPipe iris landmark).
// Returns { cx, cy, r, score } in imgEl pixels, or null if no iris found (score < 15).
function findIrisByRingContrast(imgEl, cxHint, cyHint, rHint) {
  var W = imgEl.naturalWidth || imgEl.width;
  var H = imgEl.naturalHeight || imgEl.height;
  if (!W || !H || !rHint || rHint < 4) return null;

  // Clamp hint to image bounds so an off-frame MP landmark doesn't break the search
  cxHint = Math.max(rHint, Math.min(W - rHint, cxHint));
  cyHint = Math.max(rHint, Math.min(H - rHint, cyHint));

  // Crop to 4× rHint — large enough to contain the iris even when MP underestimates radius
  var margin = Math.round(rHint * 4.0);
  var rx0 = Math.max(0, Math.round(cxHint - margin));
  var ry0 = Math.max(0, Math.round(cyHint - margin));
  var rx1 = Math.min(W, Math.round(cxHint + margin));
  var ry1 = Math.min(H, Math.round(cyHint + margin));
  var rw = rx1 - rx0, rh = ry1 - ry0;
  if (rw < 20 || rh < 20) return null;

  var tmp = document.createElement('canvas');
  tmp.width = rw; tmp.height = rh;
  tmp.getContext('2d', { colorSpace: 'srgb' }).drawImage(imgEl, rx0, ry0, rw, rh, 0, 0, rw, rh);
  var d = tmp.getContext('2d', { colorSpace: 'srgb' }).getImageData(0, 0, rw, rh).data;
  var lumArr = new Float32Array(rw * rh);
  for (var i = 0; i < rw * rh; i++) {
    var idx = i * 4;
    lumArr[i] = 0.299 * d[idx] + 0.587 * d[idx+1] + 0.114 * d[idx+2];
  }

  function sL(x, y) {
    return lumArr[Math.max(0, Math.min(rh-1, Math.round(y))) * rw +
                  Math.max(0, Math.min(rw-1, Math.round(x)))];
  }

  // Ring contrast score at candidate (cx, cy, r) — all in local crop coords
  var N_RAYS = 16;
  function ringScore(cx, cy, r) {
    var inS = 0, outS = 0, outN = 0;
    for (var a = 0; a < N_RAYS; a++) {
      var ang = (a / N_RAYS) * 2 * Math.PI;
      var cosA = Math.cos(ang), sinA = Math.sin(ang);
      inS += sL(cx + r * 0.5 * cosA, cy + r * 0.5 * sinA);
      var ox = cx + r * 1.2 * cosA, oy = cy + r * 1.2 * sinA;
      if (ox >= 0 && ox < rw && oy >= 0 && oy < rh) { outS += sL(ox, oy); outN++; }
    }
    if (outN < N_RAYS / 2) return -1e9;
    return (outS / outN) - (inS / N_RAYS);
  }

  // Local hint coords
  var lcx = cxHint - rx0, lcy = cyHint - ry0;

  var SCORE_MIN = 15;
  // Two-tier search strategy:
  // Tier 1 — tight range near MP hint (±30% radius, ±65% center offset).
  //   Handles well-detected cases (close-up shots where MP is accurate).
  //   If a confident result (score > 22) is found here, use it directly.
  // Tier 2 — wide range (0.3–3× radius, ±150% center offset).
  //   Handles poorly-detected cases (angled selfies where MP underestimates
  //   the iris radius by 2–3×). Only runs when Tier 1 finds nothing good.
  function coarseSearch(sR, rLo, rHi, rStp, stp) {
    var b = SCORE_MIN - 1, bx = -1, by = -1, br = -1;
    for (var cx = lcx - sR; cx <= lcx + sR; cx += stp) {
      for (var cy = lcy - sR; cy <= lcy + sR; cy += stp) {
        for (var r = rLo; r <= rHi; r += rStp) {
          var s = ringScore(cx, cy, r);
          if (s > b) { b = s; bx = cx; by = cy; br = r; }
        }
      }
    }
    return { score: b, cx: bx, cy: by, r: br };
  }

  var step  = Math.max(3, Math.round(rHint * 0.08));
  var rStep = Math.max(2, Math.round(rHint * 0.08));

  // Tier 1: tight
  var t1 = coarseSearch(rHint * 0.65, rHint * 0.70, rHint * 1.30, rStep, step);
  var res = (t1.score >= 22) ? t1 : null;

  // Tier 2: wide fallback — only if Tier 1 didn't find a confident result
  if (!res) {
    var stepW  = Math.max(4, Math.round(rHint * 0.12));
    var rStepW = Math.max(3, Math.round(rHint * 0.12));
    var t2 = coarseSearch(rHint * 1.5,
                          rHint * 0.30, Math.min(rw * 0.45, rHint * 3.0),
                          rStepW, stepW);
    res = (t2.score >= SCORE_MIN) ? t2 : null;
  }

  if (!res || res.cx < 0) return null;

  // Fine-tune ±step around coarse best
  var fBest = res.score, fCx = res.cx, fCy = res.cy, fR = res.r;
  for (var cx2 = res.cx - step; cx2 <= res.cx + step; cx2++) {
    for (var cy2 = res.cy - step; cy2 <= res.cy + step; cy2++) {
      for (var r2 = Math.max(4, res.r - rStep); r2 <= res.r + rStep; r2++) {
        var s2 = ringScore(cx2, cy2, r2);
        if (s2 > fBest) { fBest = s2; fCx = cx2; fCy = cy2; fR = r2; }
      }
    }
  }

  if (fBest < SCORE_MIN) return null;
  // Return in imgEl (not crop-local) coordinates
  return { cx: fCx + rx0, cy: fCy + ry0, r: fR, score: fBest };
}

// ---- Ring boundary saturation fraction ----
// Samples N evenly-spaced points ON the ring boundary and returns the fraction
// that fall in scleral/non-iris territory (saturation < SAT_THRESH).
//
// Saturation is used instead of luminance because:
//   • Iris stroma (any colour) has sat 30–55; sclera has sat < 20.
//   • Specular highlights (sat ≈ 4, lum ≈ 240) look like bright sclera to
//     luminance-only checks — saturation correctly flags them as non-iris.
//
// The top 60° arc (eyelid zone) is excluded — eyelid skin has moderate sat
// and is always legitimately outside the iris; excluding it avoids false fails.
//
// A return value > 0.15 means the ring extends substantially into sclera.
function ringBoundarySatFraction(imgEl, cx, cy, rIris) {
  var W = imgEl.naturalWidth || imgEl.width;
  var H = imgEl.naturalHeight || imgEl.height;
  if (!W || !H || rIris < 5) return 0;
  var tmp = document.createElement('canvas');
  tmp.width = W; tmp.height = H;
  var tctx = tmp.getContext('2d', { colorSpace: 'srgb' });
  tctx.drawImage(imgEl, 0, 0);
  var data = tctx.getImageData(0, 0, W, H).data;

  function pixInfo(x, y) {
    var px = Math.max(0, Math.min(W-1, Math.round(x)));
    var py = Math.max(0, Math.min(H-1, Math.round(y)));
    var i = (py * W + px) * 4;
    var ri = data[i], gi = data[i+1], bi = data[i+2];
    var rf = ri/255, gf = gi/255, bf = bi/255;
    var mx = Math.max(rf, gf, bf), mn = Math.min(rf, gf, bf);
    return {
      sat: mx === 0 ? 0 : (mx - mn) / mx * 100,
      lum: 0.299 * ri + 0.587 * gi + 0.114 * bi
    };
  }

  // A ring boundary sample is "scleral" only when it has BOTH:
  //   • low saturation (sat < 25)  — iris stroma is colourful
  //   • bright luminance (lum > 140) — true sclera is nearly white
  //
  // Requiring both avoids false positives from the dark limbal ring:
  // the outer iris ring has sat < 25 (nearly grey) but lum ≈ 60-100
  // (dark brown/black).  Treating it as scleral incorrectly fires
  // VIS-FIT for dark hazel/amber irises and shrinks the ring.
  var SAT_THRESH     = 25;
  var SCLERA_MIN_LUM = 140;
  var N = 24;
  var scleral = 0, effective = 0;
  for (var i = 0; i < N; i++) {
    var ang = i / N * 2 * Math.PI;
    // Exclude the eyelid zone: angles near 270° (top of ring, -y direction)
    var deg = (i / N * 360 + 360) % 360;
    if (deg > 240 && deg < 300) continue;   // top 60° = eyelid
    effective++;
    var info = pixInfo(cx + rIris * Math.cos(ang), cy + rIris * Math.sin(ang));
    if (info.sat < SAT_THRESH && info.lum > SCLERA_MIN_LUM) scleral++;
  }
  return effective > 0 ? scleral / effective : 0;
}

// ---- Visible-iris horizontal fit ----
// When the ring boundary falls in scleral territory on one side (detected via
// ringBoundarySatFraction), this function corrects the iris x-centre and radius
// by scanning outward from the current centre in the ±x direction until
// saturation drops below the iris-stroma threshold (sat < 25).
//
// Use-case: selfie photos where the eye looks slightly to the side. The temporal
// iris is partially occluded, so the visible iris extends further on the nasal
// side.  MediaPipe gives the anatomical (3-D) iris centre which is correct but
// the 2-D visible iris centre is shifted toward the nasal side.
//
// Returns { cx, rIris, r_left, r_right } in imgEl pixel space, or null when:
//   • The scan cannot find either limbus (entire frame is iris or sclera), or
//   • The eye looks symmetric (asymmetry < MIN_ASYM of rIrisHint → no correction needed).
function fitVisibleIrisHoriz(imgEl, cx, cy, rIrisHint, pupilR) {
  // Locate the iris horizontal span by finding the LONGEST CONTIGUOUS region of
  // high saturation across the crop horizontal midline.
  //
  // Why "longest contiguous run" instead of scanning from edges or from centre:
  //   • Outward-from-centre scan: dark iris fibres (sat<25) inside the stroma
  //     trigger premature stops, giving false limbus positions.
  //   • Inward-from-edge scan: periocular skin BEYOND the canthi often has
  //     sat > 25 (nose skin, temple skin), causing the scan to stop at the
  //     skin border rather than the true sclera→iris limbus.
  //   • Longest-run: the iris stroma is a wide (≥ 100 px) contiguous high-sat
  //     region.  Periocular skin patches and specular highlights are much
  //     shorter (< 80 px).  Taking the longest run reliably isolates the iris
  //     even when non-iris high-sat regions exist at the crop edges.
  //
  // Band height ±20 px: wider than the original ±4 px to smooth individual
  // 2–4 px dark fibres so only sustained low-sat zones (sclera, skin) register.
  //
  // Returns { cx, rIris, r_left, r_right } or null if no reliable iris found.
  //   cx    = midpoint of longest high-sat run  (corrected iris centre x)
  //   rIris = half-width of the run             (visible horizontal iris radius)
  //   r_left  = run_start → cascade-cx distance (logging)
  //   r_right = cascade-cx → run_end distance   (logging)
  var W = imgEl.naturalWidth || imgEl.width;
  var H = imgEl.naturalHeight || imgEl.height;
  if (!W || !H || rIrisHint < 10) return null;

  var tmp = document.createElement('canvas');
  tmp.width = W; tmp.height = H;
  var tctx = tmp.getContext('2d', { colorSpace: 'srgb' });
  tctx.drawImage(imgEl, 0, 0);
  var data = tctx.getImageData(0, 0, W, H).data;

  var BAND_H = 20;   // ±px vertical band — smooths individual iris fibres
  function bandSat(x) {
    var xpx = Math.max(0, Math.min(W - 1, Math.round(x)));
    var sum = 0, n = 0;
    for (var dy = -BAND_H; dy <= BAND_H; dy++) {
      var py = Math.max(0, Math.min(H - 1, Math.round(cy + dy)));
      var i  = (py * W + xpx) * 4;
      var r  = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
      var mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      sum += mx === 0 ? 0 : (mx - mn) / mx * 100;
      n++;
    }
    return n ? sum / n : 0;
  }

  var SAT_THRESH = 25;
  var STEP       = 3;      // scan step (px)
  var MIN_RUN    = Math.round(rIrisHint * 1.0);   // minimum iris run length (≥ full radius)

  // Find the longest contiguous high-sat run across the entire crop width
  var best_start = -1, best_end = -1, best_len = 0;
  var cur_start  = -1;
  for (var xi = 0; xi < W; xi += STEP) {
    if (bandSat(xi) >= SAT_THRESH) {
      if (cur_start < 0) cur_start = xi;
      var cur_len = xi - cur_start + STEP;
      if (cur_len > best_len) {
        best_len  = cur_len;
        best_start = cur_start;
        best_end   = xi;
      }
    } else {
      cur_start = -1;
    }
  }

  // Reject if run too short (no proper iris found)
  if (best_start < 0 || best_len < MIN_RUN) return null;

  // Require sclera (low-sat region) before AND after the iris run.
  // If the run starts at x < MIN_SCLERA, the crop is clipped on the temporal side.
  // If the run ends beyond W − MIN_SCLERA, the crop is clipped on the nasal side.
  var MIN_SCLERA = 10;
  if (best_start < MIN_SCLERA)         return null;   // temporal sclera not visible
  if (best_end   > W - MIN_SCLERA)     return null;   // nasal sclera not visible

  var cx_new = Math.round((best_start + best_end) / 2);
  var r_new  = Math.round((best_end - best_start) / 2);

  // Skip trivial corrections (< 5 % of iris radius)
  if (Math.abs(cx_new - cx) < rIrisHint * 0.05 &&
      Math.abs(r_new  - rIrisHint) < rIrisHint * 0.05) return null;

  return {
    cx:      cx_new,
    rIris:   r_new,
    r_left:  Math.round(cx - best_start),   // logging: temporal half from cascade cx
    r_right: Math.round(best_end   - cx)    // logging: nasal half from cascade cx
  };
}

// ---- Gross-error placement check ----
// After the iris circle is set, verify that the boundary makes anatomical sense.
// Samples small patches just outside the iris at 3 o'clock and 9 o'clock:
//   • Those spots should be bright white sclera (lum > SCLERA_MIN)
//   • They should be noticeably brighter than the iris body at the same radius
// Returns { ok, leftOk, rightOk, advisory } in imgEl pixel space.
// "ok" = at least one side passes; advisory = null when ok, human-readable string otherwise.
function checkIrisPlacement(imgEl, cx, cy, rIris) {
  var W = imgEl.naturalWidth || imgEl.width;
  var H = imgEl.naturalHeight || imgEl.height;
  if (!W || !H || rIris < 5) return { ok: true, advisory: null };

  var tmp = document.createElement('canvas');
  tmp.width = W; tmp.height = H;
  tmp.getContext('2d', { colorSpace: 'srgb' }).drawImage(imgEl, 0, 0);
  var data = tmp.getContext('2d', { colorSpace: 'srgb' }).getImageData(0, 0, W, H).data;

  // Average luminance in a small square patch centred on (px, py)
  function patchLum(px, py, pr) {
    pr = Math.max(2, Math.round(pr));
    var s = 0, n = 0;
    for (var dy = -pr; dy <= pr; dy++) {
      for (var dx = -pr; dx <= pr; dx++) {
        var xx = Math.round(px + dx), yy = Math.round(py + dy);
        if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
        var idx = (yy * W + xx) * 4;
        s += 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        n++;
      }
    }
    return n > 0 ? s / n : 0;
  }

  var pr       = Math.max(3, Math.round(rIris * 0.08)); // patch half-size
  var outerMul = 1.18;   // just outside the iris boundary
  var innerMul = 0.72;   // inside the iris body

  var rightOuterLum = patchLum(cx + rIris * outerMul, cy, pr);
  var leftOuterLum  = patchLum(cx - rIris * outerMul, cy, pr);
  var rightInnerLum = patchLum(cx + rIris * innerMul, cy, pr);
  var leftInnerLum  = patchLum(cx - rIris * innerMul, cy, pr);

  var SCLERA_MIN    = 80;   // sclera should be at least this bright (80 supports dark-sclera eyes)
  var CONTRAST_MIN  = 25;   // and at least this much brighter than the iris body beside it

  var rightOk = rightOuterLum >= SCLERA_MIN &&
                (rightOuterLum - rightInnerLum) >= CONTRAST_MIN;
  var leftOk  = leftOuterLum  >= SCLERA_MIN &&
                (leftOuterLum  - leftInnerLum)  >= CONTRAST_MIN;
  var ok = rightOk || leftOk;

  return {
    ok:             ok,
    leftOk:         leftOk,
    rightOk:        rightOk,
    leftOuterLum:   Math.round(leftOuterLum),
    rightOuterLum:  Math.round(rightOuterLum),
    advisory:       ok ? null : 'Circle may be off — drag the ring to adjust'
  };
}

// ---- Collarette guard: outward limbus refinement ----
// Amber/hazel eyes have a bright inner collarette ring at ~30–50 % of the true
// iris radius. RIP and ODH often anchor on this boundary (bright collarette →
// strong gradient), returning an underestimated irisR. This function detects
// the pattern: bright collarette → dark iris stroma → bright sclera and returns
// the radius of the dark stroma minimum (= the true limbus). If the candidate
// is already the true limbus (luminance rises just outside it), it is returned
// unchanged.
//
// Parameters:
//   imgEl      — source image (jump crop or zoom crop, any scale)
//   cx, cy     — iris/pupil center in imgEl pixel space
//   candidateR — radius from the cascade (pixels in imgEl space)
//   maxSearchR — optional upper bound (defaults to 3× candidateR, image-edge capped)
function findTrueLimbusOutward(imgEl, cx, cy, candidateR, maxSearchR) {
  var W = imgEl.naturalWidth || imgEl.width;
  var H = imgEl.naturalHeight || imgEl.height;
  if (!W || !H || candidateR < 6) return candidateR;

  var tmp = document.createElement('canvas');
  tmp.width = W; tmp.height = H;
  var ctx = tmp.getContext('2d', { colorSpace: 'srgb' });
  ctx.drawImage(imgEl, 0, 0);
  var data = ctx.getImageData(0, 0, W, H).data;

  var N = 32;
  function ringLum(r) {
    var s = 0, n = 0;
    for (var i = 0; i < N; i++) {
      var ang = (i / N) * 2 * Math.PI;
      var px = Math.round(cx + Math.cos(ang) * r);
      var py = Math.round(cy + Math.sin(ang) * r);
      if (px < 0 || py < 0 || px >= W || py >= H) continue;
      var idx = (py * W + px) * 4;
      s += 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      n++;
    }
    return n >= Math.ceil(N * 0.5) ? s / n : null;
  }

  var candidateLum  = ringLum(candidateR);
  var justOutside   = ringLum(candidateR * 1.12);
  if (candidateLum === null || justOutside === null) return candidateR;

  // If luminance rises just outside → two possibilities:
  // (a) TRUE LIMBUS: candidateR is the dark limbal band; the gradient here is steep and
  //     decreases moving further into sclera (which plateaus).
  // (b) BELOW LIMBUS: candidateR is on the stroma ramp; the gradient is mild here and
  //     *increases* further outward until it peaks at the true limbus.
  // Distinguish by scanning forward.  Key fix: the initial gradient spans ~candidateR*0.12 px
  // while the step gradient spans ~candidateR*0.04 px — comparing them directly was
  // ~3× too strict.  Normalise both to per-pixel rates before comparing.
  // Also add a sclera-fallback: for gradual stroma ramps (e.g. amber/hazel irises) the
  // gradient never spikes sharply, so we fall back to the first radius that clearly
  // enters sclera brightness territory.
  if (justOutside >= candidateLum + 5) {
    var _initGrad = justOutside - candidateLum;          // rise over ~candidateR*0.12 px span
    var _initGradPerPx = _initGrad / Math.max(1, candidateR * 0.12); // per-pixel rate
    var _scanMax  = Math.min(candidateR * 2.0, Math.min(W, H) * 0.46); // wider window
    var _stepFwd  = Math.max(1, Math.round(candidateR * 0.04));
    var _prevLf   = justOutside;
    var _peakR    = 0;
    var _firstSclR = 0;  // first radius where lum enters sclera territory (candidateLum+35)
    for (var _rf = Math.round(candidateR * 1.15); _rf <= _scanMax; _rf += _stepFwd) {
      var _lf = ringLum(_rf);
      if (_lf === null) break;
      var _gfPerPx = (_lf - _prevLf) / _stepFwd;  // per-pixel gradient this step
      if (_gfPerPx > _initGradPerPx * 1.2) { _peakR = _rf; break; } // gradient accelerated → below limbus
      _prevLf = _lf;
      if (_firstSclR === 0 && _lf > candidateLum + 35) _firstSclR = _rf;
      if (_lf > candidateLum + 55) break; // well into sclera plateau — stop
    }
    // Sclera fallback: if gradient acceleration didn't trigger but the scan crossed
    // well into sclera brightness, the candidate was in mid-stroma (gradual ramp).
    // Use the sclera entry radius if it's ≥25% beyond the candidate.
    if (_peakR === 0 && _firstSclR > 0 && _firstSclR > candidateR * 1.25) {
      _peakR = _firstSclR;
    }
    if (_peakR > candidateR * 1.05 && _peakR < candidateR * 2.0) {
      console.log('[LIMBUS GUARD] candidateR=' + Math.round(candidateR) +
                  ' → expanded to ' + Math.round(_peakR));
      return Math.round(_peakR);
    }
    console.log('[LIMBUS GUARD] candidateR=' + Math.round(candidateR) +
                ' → no change (already limbus)');
    return candidateR;
  }
  // Require a meaningful drop (noise tolerance = 8 lum) to avoid false activations.
  if (candidateLum - justOutside < 8) return candidateR;

  // Drop confirmed: scan outward for the valley (dark stroma) then sclera rise.
  // Collarette is typically 30–50 % of the true iris radius, so the true limbus
  // can be up to 3× the candidate radius away.
  var maxR = (maxSearchR != null) ? maxSearchR
             : Math.min(candidateR * 3.0, Math.min(W, H) * 0.47);
  if (maxR <= candidateR * 1.1) return candidateR;

  var step = candidateR * 0.04;
  var minLum = justOutside, minR = candidateR * 1.12;
  for (var r = minR + step; r <= maxR; r += step) {
    var lum = ringLum(r);
    if (lum === null) break;
    if (lum < minLum) { minLum = lum; minR = r; }
    // Valley confirmed and sclera brightening: return the radius of the dark minimum.
    if (minLum < candidateLum - 12 && lum > minLum + 20) {
      return Math.round(minR);
    }
  }

  return candidateR; // no collarette pattern found — original estimate was the limbus
}
