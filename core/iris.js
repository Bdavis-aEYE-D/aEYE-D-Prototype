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
  var octx = off.getContext('2d');
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
    var n=(x1-x0)*(y1-y0); return n>0 ? bs(x0,y0,x1,y1)/n : 1e9;
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
    if (inner > darkThresh + 35) return -1e9;
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
    var lh = -1, lm = minGrad;
    for (var x = 2; x < Math.round(refCx) - guardR; x++){
      var d = prof[x-2] - prof[x]; if (d > lm){ lm = d; lh = x; }
    }
    var rh = -1, rm = minGrad;
    for (var x = W-3; x > Math.round(refCx) + guardR; x--){
      var d = prof[x+2] - prof[x]; if (d > rm){ rm = d; rh = x; }
    }
    return { lh: lh, rh: rh };
  }

  // Iris radius bounds for close-up mode.
  // Raised from 0.38 → 0.46: images where the iris fills 80-90% of the frame
  // (UBIRIS-style, or a macro phone shot) have a true limbus at ~0.45× shorter dim.
  var R_MAX_CU = closeup ? Math.round(Math.min(W, H) * 0.46) : Infinity;

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
    var yEnd = Math.min(H - 1, Math.round(pcy + H * 0.30));
    for (var ty = Math.round(pcy) + 3; ty <= yEnd; ty += 3) {
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
        var tRinRange = tR <= R_MAX_CU && (!ok || tR <= Math.max(irisR * 1.45, Math.round(pr * 3.5)));
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
  if (closeup && (!ok || irisR < W * 0.10 || leftHit < 0 || centerDist > W * 0.35)) {
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
      // Find the strongest left-side drop (sclera→iris entering from left half)
      var gleft = -1, gleftMax = minGrad;
      for (var gx = 2; gx < (W>>1); gx++) {
        var gd = gprof[gx-2] - gprof[gx];
        if (gd > gleftMax) { gleftMax = gd; gleft = gx; }
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
  tmp.getContext('2d').drawImage(imgEl, 0, 0);
  var data = tmp.getContext('2d').getImageData(0, 0, W, H).data;
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
function estimateIrisBrightness(imgEl, cx, cy, innerR, outerR) {
  var W = imgEl.naturalWidth  || imgEl.width;
  var H = imgEl.naturalHeight || imgEl.height;
  if (!W || !H) return 128;
  var tmp = document.createElement('canvas');
  tmp.width = W; tmp.height = H;
  tmp.getContext('2d').drawImage(imgEl, 0, 0);
  var data = tmp.getContext('2d').getImageData(0, 0, W, H).data;
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
      sum += 0.299*data[idx] + 0.587*data[idx+1] + 0.114*data[idx+2];
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
  tmp.getContext('2d').drawImage(imgEl, 0, 0);
  var data = tmp.getContext('2d').getImageData(0, 0, W, H).data;

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
  // When an iris-radius hint is supplied (full-face path), cap search at 1.5× that hint
  // so the scan cannot reach eyelid/skin boundaries beyond the iris zone.
  // Without the hint (close-up path), use the pupil-based formula that ensures the
  // scan always reaches past the iris regardless of how small the pupil hint is.
  var maxSearchR;
  if (irisRHint > 0) {
    maxSearchR = Math.round(irisRHint * 1.5);
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
  tmp.getContext('2d').drawImage(imgEl, 0, 0);
  var data = tmp.getContext('2d').getImageData(0, 0, W, H).data;

  function lum(x, y) {
    var px = Math.max(0, Math.min(W-1, Math.round(x)));
    var py = Math.max(0, Math.min(H-1, Math.round(y)));
    var idx = (py * W + px) * 4;
    return 0.299*data[idx] + 0.587*data[idx+1] + 0.114*data[idx+2];
  }

  var cxR = Math.round(cx), cyR = Math.round(cy);
  var rMin = Math.max(4, Math.round(hintR * 0.75));
  var rMax = Math.min(Math.round(Math.min(W, H) * 0.48), Math.round(hintR * 1.40));
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
  tmp.getContext('2d').drawImage(imgEl, 0, 0);
  var data = tmp.getContext('2d').getImageData(0, 0, W, H).data;

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
  tmp.getContext('2d').drawImage(imgEl, 0, 0);
  var data = tmp.getContext('2d').getImageData(0, 0, W, H).data;

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
  tmp.getContext('2d').drawImage(imgEl, 0, 0);
  var data = tmp.getContext('2d').getImageData(0, 0, W, H).data;

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
  tmp.getContext('2d').drawImage(imgEl, rx0, ry0, rw, rh, 0, 0, rw, rh);
  var d = tmp.getContext('2d').getImageData(0, 0, rw, rh).data;
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
  tmp.getContext('2d').drawImage(imgEl, 0, 0);
  var data = tmp.getContext('2d').getImageData(0, 0, W, H).data;

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
