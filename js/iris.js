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
    if (closeup) return (surr[2] - inner);
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
  var minGrad = 25;
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

  // Iris boundary: scan horizontally at the pupil row first.
  var init = scanBand(Math.round(pcy), pcx);
  var leftHit = init.lh, rightHit = init.rh;
  var ok, irisR;
  if (leftHit >= 0 && rightHit >= 0){
    irisR = Math.round((rightHit - leftHit) / 2);
    pcx   = Math.round((leftHit + rightHit) / 2);
    ok = true;
  } else if (leftHit >= 0){
    irisR = Math.round(pcx - leftHit); ok = true;
  } else if (rightHit >= 0){
    irisR = Math.round(rightHit - pcx); ok = true;
  } else {
    irisR = Math.round(pr * 2.1); ok = false;
  }

  // Secondary validation for close-up mode: the iris is a circle, so its
  // horizontal span is WIDEST at the iris center Y. If the pupil detector placed
  // pcy at the upper (eyelid-occluded) edge, scanning downward will find a wider
  // span. Scan pcy → pcy+30% and use the Y with the largest bilateral span.
  if (closeup) {
    // Seed bestSpan from the current irisR so the Y-scan can only win if it finds
    // a wider bilateral span — prevents a half-limbus initial scan (irisR reasonable
    // but one edge missing) from being displaced by a tiny bilateral hit below.
    var bestSpan = ok ? irisR * 2 : 0;
    var bestCy = pcy, bestCx = pcx, bestIrisR = irisR;
    var yEnd = Math.min(H - 1, Math.round(pcy + H * 0.30));
    for (var ty = Math.round(pcy) + 3; ty <= yEnd; ty += 3) {
      var b2 = scanBand(ty, pcx);
      if (b2.lh >= 0 && b2.rh >= 0) {
        var span = b2.rh - b2.lh;
        if (span > bestSpan) {
          bestSpan = span;
          bestCy = ty;
          bestCx = Math.round((b2.lh + b2.rh) / 2);
          bestIrisR = Math.round(span / 2);
        }
      }
    }
    if (bestSpan > 0) {
      pcy = bestCy; pcx = bestCx; irisR = bestIrisR; ok = true;
      leftHit = Math.round(bestCx - bestIrisR);
      rightHit = Math.round(bestCx + bestIrisR);
    }
  }

  // Tier-2 fallback for close-up: global bilateral limbus sweep.
  // When pupil-anchored detection fails (ok=false or weak iris radius),
  // scan every row independently for simultaneous left+right sclera→iris
  // brightness drops. The row with the widest bilateral span = iris center Y.
  // No pupil position needed — works even when the pupil finder locked onto
  // a tear duct, inner-corner shadow, or any other off-center dark region.
  if (closeup && (!ok || irisR < W * 0.10)) {
    var gBestSpan = 0, gBestCy = -1, gBestCx = W>>1, gBestR = 0;
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
        var gspan = gright - gleft;
        if (gspan > gBestSpan) {
          gBestSpan = gspan; gBestCy = gy;
          gBestCx = Math.round((gleft + gright) / 2);
          gBestR   = Math.round(gspan / 2);
        }
      }
    }
    // Accept if the found iris fills at least 18% of image width
    if (gBestCy >= 0 && gBestR > W * 0.09) {
      pcy = gBestCy; pcx = gBestCx; irisR = gBestR; ok = true;
      leftHit = Math.round(gBestCx - gBestR);
      rightHit = Math.round(gBestCx + gBestR);
    }
  }

  return {
    cxFrac: pcx/W, cyFrac: pcy/H,
    rPupilFrac: (pr*1.05)/W,
    rIrisFrac: irisR/W,
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
function findIrisODHorizontal(imgEl, cxHint, cyHint, pupilRHint) {
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
  var guardR = Math.round((pupilRHint || 0) * 1.4);
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

  // Left limbus: scan rightward from left edge, find steepest brightness DROP entering iris
  var leftMax = 20;   // minimum gradient threshold (lum units over 2px)
  for (var x = 2; x < cx - guardR; x++) {
    var drop = profile[x-2] - profile[x];
    if (drop > leftMax) { leftMax = drop; leftHit = x; }
  }
  if (leftHit >= 0) hits.push(cx - leftHit);

  // Right limbus: scan leftward from right edge
  var rightMax = 20;
  for (var x = W - 3; x > cx + guardR; x--) {
    var drop = profile[x+2] - profile[x];
    if (drop > rightMax) { rightMax = drop; rightHit = x; }
  }
  if (rightHit >= 0) hits.push(rightHit - cx);

  // Near-horizontal rays at ±20° and ±30°, firing both left and right
  var rayAngles = [20, -20, 30, -30];
  var rayThresh = 12;
  var maxR = Math.min(W, H) * 0.5;

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
  var exitThresh = Math.max(darkest + 25, 45);
  var maxR = irisR * 0.28;
  var radii = [];

  for (var a = 0; a < 8; a++) {
    var angle = (a / 8) * 2 * Math.PI;
    var cosA = Math.cos(angle), sinA = Math.sin(angle);
    for (var r = 2; r <= maxR; r++) {
      if (lumG(cx + r*cosA, cy + r*sinA) > exitThresh) {
        radii.push(r);
        break;
      }
    }
  }

  if (radii.length < 4) return irisR * 0.25; // fallback
  radii.sort(function(a, b) { return a - b; });
  var pupilR = radii[Math.floor(radii.length / 2)];
  return Math.max(4, Math.min(pupilR, irisR * 0.32));
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
