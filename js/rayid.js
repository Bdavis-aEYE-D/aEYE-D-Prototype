'use strict';

// ======================= IRIS UNWRAP =======================
// Daugman rubber-sheet model: maps the iris annulus to a 360×64 grayscale strip.
// imageData: Uint8ClampedArray from canvas getImageData (RGBA)
// W, H: canvas dimensions
// cx, cy: iris centre (stage px)
// cxP, cyP: pupil centre (stage px)
// rOut: iris radius   rIn: pupil radius
function unwrapIris(imageData, W, H, cx, cy, cxP, cyP, rOut, rIn) {
  var SW = 360, SH = 64;
  var strip = new Uint8Array(SW * SH);
  var rInS  = rIn  * 1.05;
  var rOutS = rOut * 0.97;
  for (var col = 0; col < SW; col++) {
    var angle = (col / SW) * 2 * Math.PI;
    var cosA  = Math.cos(angle), sinA = Math.sin(angle);
    for (var row = 0; row < SH; row++) {
      var rho = row / (SH - 1);
      var bx  = cxP + (cx  - cxP) * rho;
      var by  = cyP + (cy  - cyP) * rho;
      var r   = rInS + rho * (rOutS - rInS);
      var px  = bx + r * cosA;
      var py  = by + r * sinA;
      var x0  = px | 0, y0 = py | 0;
      var x1  = x0 + 1, y1 = y0 + 1;
      var fx  = px - x0, fy = py - y0;
      x0 = x0 < 0 ? 0 : x0 >= W ? W-1 : x0;
      x1 = x1 < 0 ? 0 : x1 >= W ? W-1 : x1;
      y0 = y0 < 0 ? 0 : y0 >= H ? H-1 : y0;
      y1 = y1 < 0 ? 0 : y1 >= H ? H-1 : y1;
      var i00 = (y0*W + x0)*4, i10 = (y0*W + x1)*4;
      var i01 = (y1*W + x0)*4, i11 = (y1*W + x1)*4;
      var rp = imageData[i00]*(1-fx)*(1-fy) + imageData[i10]*fx*(1-fy) +
               imageData[i01]*(1-fx)*fy     + imageData[i11]*fx*fy;
      var gp = imageData[i00+1]*(1-fx)*(1-fy) + imageData[i10+1]*fx*(1-fy) +
               imageData[i01+1]*(1-fx)*fy       + imageData[i11+1]*fx*fy;
      var bp = imageData[i00+2]*(1-fx)*(1-fy) + imageData[i10+2]*fx*(1-fy) +
               imageData[i01+2]*(1-fx)*fy       + imageData[i11+2]*fx*fy;
      strip[row * SW + col] = (0.299*rp + 0.587*gp + 0.114*bp + 0.5) | 0;
    }
  }
  return strip; // Uint8Array, 360×64
}

// ======================= RAYID CLASSIFIER =======================
// Classifies an unwrapped iris strip as Jewel / Flower / Stream / Shaker.
// strip: Uint8Array from unwrapIris (W×H grayscale)
// Thresholds calibrated on UBIRIS v2 (4,819 irises).
function classifyRayid(strip, W, H) {
  var n = W * H;

  // ---- Stream score: radial gradient energy vs angular gradient energy ----
  // Radial = vertical direction in strip (pupil→limbus)
  // Stream irises have dominant vertical (radial) structure.
  var gySum = 0, gxSum = 0;
  for (var r = 0; r < H-1; r++)
    for (var c = 0; c < W; c++)
      gySum += Math.abs(strip[(r+1)*W + c] - strip[r*W + c]);
  for (var r2 = 0; r2 < H; r2++)
    for (var c2 = 0; c2 < W-1; c2++)
      gxSum += Math.abs(strip[r2*W + c2+1] - strip[r2*W + c2]);
  var gy = gySum / ((H-1) * W);
  var gx = gxSum / (H * (W-1));
  var ssRatio = (gy + gx > 1e-6) ? gy / (gy + gx) : 0.5;
  var streamScore = Math.max(0, Math.min(1, (ssRatio - 0.3) / 0.4));

  // ---- Jewel score: local variance density ----
  // Spots cause high local variance in a small window vs the global baseline.
  var sum = 0;
  for (var i = 0; i < n; i++) sum += strip[i];
  var mean = sum / n;
  var varSum = 0;
  for (var i2 = 0; i2 < n; i2++) { var dv = strip[i2]-mean; varSum += dv*dv; }
  var gStd = Math.sqrt(varSum / n);
  var threshold = gStd * 1.5;
  var hw = 3; // 7×7 window half-width
  var spots = 0, total = 0;
  for (var r3 = hw; r3 < H-hw; r3++) {
    for (var c3 = hw; c3 < W-hw; c3++) {
      var ws = 0, ws2 = 0;
      for (var dr = -hw; dr <= hw; dr++)
        for (var dc = -hw; dc <= hw; dc++) {
          var v = strip[(r3+dr)*W + (c3+dc)];
          ws += v; ws2 += v*v;
        }
      var wn = (2*hw+1)*(2*hw+1);
      var wStd = Math.sqrt(Math.max(0, ws2/wn - (ws/wn)*(ws/wn)));
      if (wStd > threshold) spots++;
      total++;
    }
  }
  var jewelScore = Math.min(1, (spots / total) / 0.25);

  // ---- Flower score: count dark crypts/lacunae in the mid-iris band ----
  // Crypts are dark connected blobs that are wider than tall.
  var r0f = (H * 0.25) | 0, r1f = (H * 0.75) | 0;
  var mH = r1f - r0f, mN = mH * W;
  var mSum = 0;
  for (var mr = r0f; mr < r1f; mr++)
    for (var mc = 0; mc < W; mc++)
      mSum += strip[mr*W + mc];
  var mMean = mSum / mN;
  var mVarSum = 0;
  for (var mr2 = r0f; mr2 < r1f; mr2++)
    for (var mc2 = 0; mc2 < W; mc2++) {
      var dv2 = strip[mr2*W+mc2] - mMean; mVarSum += dv2*dv2;
    }
  var mStd = Math.sqrt(mVarSum / mN);
  var darkT = mMean - mStd * 0.8;

  var dark = new Uint8Array(mH * W);
  for (var mr3 = 0; mr3 < mH; mr3++)
    for (var mc3 = 0; mc3 < W; mc3++)
      dark[mr3*W + mc3] = (strip[(mr3+r0f)*W + mc3] < darkT) ? 1 : 0;

  var visited = new Uint8Array(mH * W);
  var crypts = 0;
  var stack = [];
  for (var sr = 0; sr < mH; sr++) {
    for (var sc = 0; sc < W; sc++) {
      var idx = sr*W + sc;
      if (!dark[idx] || visited[idx]) continue;
      stack.length = 0;
      stack.push(idx);
      visited[idx] = 1;
      var minR = sr, maxR = sr, minC = sc, maxC = sc, area = 0;
      while (stack.length) {
        var cur = stack.pop();
        var cr = (cur / W) | 0, cc = cur % W;
        area++;
        if (cr < minR) minR = cr; if (cr > maxR) maxR = cr;
        if (cc < minC) minC = cc; if (cc > maxC) maxC = cc;
        // 4-connected, no row-wrap
        if (cr > 0)    { var u = cur-W; if (dark[u] && !visited[u]) { visited[u]=1; stack.push(u); } }
        if (cr < mH-1) { var d2 = cur+W; if (dark[d2] && !visited[d2]) { visited[d2]=1; stack.push(d2); } }
        if (cc > 0)    { var l = cur-1;  if (dark[l]  && !visited[l])  { visited[l]=1;  stack.push(l);  } }
        if (cc < W-1)  { var rr = cur+1; if (dark[rr] && !visited[rr]) { visited[rr]=1; stack.push(rr); } }
      }
      var rspan = maxR - minR + 1, cspan = maxC - minC + 1;
      if (area >= 6 && cspan >= rspan) crypts++;
    }
  }
  var flowerScore = Math.min(1, crypts / 10.0);

  // ---- Classify ----
  // Stream score is always elevated in iris images (radial structure is universal).
  // Use it only as tiebreaker. Jewel and Flower are primary discriminators.
  // Thresholds from UBIRIS v2 distribution: jewel p75=0.036, flower p80=0.800.
  var JEWEL_T = 0.040, FLOWER_T = 0.800;
  var hJ = jewelScore >= JEWEL_T, hF = flowerScore >= FLOWER_T;
  var label = (hJ && hF) ? 'Shaker' : hJ ? 'Jewel' : hF ? 'Flower' : 'Stream';

  return {
    label: label,
    streamScore: Math.round(streamScore * 1000) / 1000,
    jewelScore:  Math.round(jewelScore  * 1000) / 1000,
    flowerScore: Math.round(flowerScore * 1000) / 1000
  };
}

// Colour and description for each type
var RAYID_META = {
  Stream: {
    color: '#60a5fa',
    short: 'Radial fibers',
    story: 'Your iris has a <strong>Stream</strong> pattern — fine radial fibers trace smooth lines from the pupil outward to the limbus, giving the iris a flowing, striated quality. Stream is the most common iris structure.'
  },
  Jewel:  {
    color: '#f59e0b',
    short: 'Pigment spots',
    story: 'Your iris shows a <strong>Jewel</strong> pattern — small, concentrated pigment spots (often flecks of a distinct colour) dot the surface. The spots appear as localised high-contrast points standing out from the surrounding tissue.'
  },
  Flower: {
    color: '#34d399',
    short: 'Open crypts',
    story: 'Your iris has a <strong>Flower</strong> pattern — open lacunae (crypts) bloom across the mid-iris zone as petal-shaped dark openings. These are gaps in the iris stroma where the connective fibre layer is thinner or absent.'
  },
  Shaker: {
    color: '#e879f9',
    short: 'Spots + crypts',
    story: 'Your iris shows a <strong>Shaker</strong> pattern — a dynamic mix of pigment spots and open crypts. It combines the concentrated dots of a Jewel iris with the lacunae of a Flower iris, giving the surface a richly varied texture.'
  }
};
